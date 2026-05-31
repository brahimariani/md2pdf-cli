'use strict';

const fs = require('fs');
const path = require('path');
const { Marked } = require('marked');
const markedKatex = require('marked-katex-extension');
const puppeteer = require('puppeteer');
const { defaultCss, katexCssLink, getThemeCss } = require('./styles');
const { sanitizeHtml } = require('./sanitize');
const { collectHeadings, buildTocHtml, slugify } = require('./toc');
const { createCodeHighlighter } = require('./highlight');
const { parseFrontMatter, buildCoverHtml } = require('./frontmatter');
const { getMermaidScript } = require('./mermaid');

// Recursively collect the fenced-code languages used anywhere in the document
// (including inside lists/blockquotes) so only those grammars are loaded.
function collectCodeLangs(tokens, out = new Set()) {
  for (const token of tokens) {
    if (token.type === 'code' && token.lang) {
      out.add(token.lang.trim().split(/\s+/)[0]);
    }
    if (token.tokens) collectCodeLangs(token.tokens, out);
    if (token.items) collectCodeLangs(token.items, out);
    if (token.rows) for (const row of token.rows) collectCodeLangs(row, out);
  }
  return out;
}

// Render Markdown to HTML using an isolated Marked instance so per-call state
// (heading ids, KaTeX extension, highlighter) never leaks across invocations.
async function renderMarkdown({ md, math, toc, tocDepth, tocTitle, highlight, codeTheme, mermaid }) {
  const m = new Marked();
  m.setOptions({ gfm: true, breaks: false });
  if (math) {
    m.use(markedKatex({ throwOnError: false, output: 'html', nonStandard: true }));
  }

  const tokens = m.lexer(md);
  const headings = collectHeadings(tokens);
  const slugs = headings.map((h) => h.slug);

  let highlighter = null;
  if (highlight) {
    const langs = Array.from(collectCodeLangs(tokens));
    highlighter = await createCodeHighlighter({ theme: codeTheme, langs });
  }

  let idx = 0;
  const renderer = {
    heading(text, level) {
      const slug = slugs[idx++] || slugify(text) || `section-${idx}`;
      return `<h${level} id="${slug}">${text}</h${level}>\n`;
    },
  };
  if (highlighter || mermaid) {
    renderer.code = (text, infostring) => {
      const lang = (infostring || '').trim().split(/\s+/)[0];
      if (mermaid && lang === 'mermaid') {
        return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
      }
      if (highlighter && highlighter.supports(lang)) {
        return highlighter.toHtml(text, lang);
      }
      const cls = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${cls}>${escapeHtml(text)}</code></pre>\n`;
    };
  }
  m.use({ renderer });

  const body = m.parse(md);
  const tocHtml = toc ? buildTocHtml(headings, { title: tocTitle, depth: tocDepth }) : '';
  return { body, tocHtml };
}

function buildHtml({ body, title, css, math }) {
  const katexTag = math ? katexCssLink() : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
${katexTag}
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// marked-katex-extension only treats `$$...$$` as a display-math block when
// surrounded by blank lines. Normalize the source so users don't trip on it.
function normalizeBlockMath(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  let inFence = false;
  let inMath = false;
  const pushBlankIfNeeded = () => {
    if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!inMath && /^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) { out.push(line); continue; }
    const singleBlock = /^\$\$[^$]+\$\$$/.test(trimmed);
    const opensBlock  = !inMath && !singleBlock && /^\$\$/.test(trimmed) && !/\$\$.+\$\$$/.test(trimmed);
    const closesBlock = inMath && /\$\$\s*$/.test(trimmed);
    if (singleBlock) {
      pushBlankIfNeeded();
      out.push(line);
      if (i + 1 < lines.length && lines[i + 1].trim() !== '') out.push('');
      continue;
    }
    if (opensBlock) {
      pushBlankIfNeeded();
      inMath = true;
      out.push(line);
      continue;
    }
    if (closesBlock) {
      inMath = false;
      out.push(line);
      if (i + 1 < lines.length && lines[i + 1].trim() !== '') out.push('');
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

async function convert(options) {
  const {
    input,
    output,
    title,
    css,
    cssFile,
    format = 'A4',
    margin = { top: '22mm', bottom: '22mm', left: '18mm', right: '18mm' },
    pageNumbers = true,
    headerTemplate,
    footerTemplate,
    puppeteerOptions = {},
    keepHtml = false,
    math = true,
    sanitize = true,
    toc = false,
    tocDepth = 3,
    tocTitle = 'Contents',
    highlight = false,
    codeTheme = 'github-light',
    cover,
    theme = 'default',
    mermaid = false,
    mermaidTheme = 'base',
  } = options;

  if (!input) throw new Error('`input` is required');
  if (!output) throw new Error('`output` is required');

  const inputAbs = path.resolve(input);
  const outputAbs = path.resolve(output);

  if (!fs.existsSync(inputAbs)) {
    throw new Error(`Input markdown file not found: ${inputAbs}`);
  }

  const rawMd = fs.readFileSync(inputAbs, 'utf8');
  const { data: frontMatter, content } = parseFrontMatter(rawMd);
  const md = math ? normalizeBlockMath(content) : content;
  const { body: parsedBody, tocHtml } = await renderMarkdown({
    md,
    math,
    toc,
    tocDepth,
    tocTitle,
    highlight,
    codeTheme,
    mermaid,
  });

  const wantCover =
    cover === true || (cover == null && frontMatter.cover === true);
  const coverHtml = wantCover ? buildCoverHtml(frontMatter) : '';
  const fullBody = [coverHtml, tocHtml, parsedBody].filter(Boolean).join('\n');
  const body = sanitize ? sanitizeHtml(fullBody) : fullBody;

  let resolvedCss;
  if (cssFile) {
    resolvedCss = fs.readFileSync(path.resolve(cssFile), 'utf8');
  } else if (css) {
    resolvedCss = css;
  } else {
    resolvedCss = getThemeCss(theme);
  }

  const docTitle =
    title || frontMatter.title || path.basename(inputAbs, path.extname(inputAbs));
  const html = buildHtml({ body, title: docTitle, css: resolvedCss, math });

  const tmpHtmlPath = outputAbs.replace(/\.pdf$/i, '') + '.tmp.html';
  fs.writeFileSync(tmpHtmlPath, html, 'utf8');
  const fileUrl = 'file:///' + tmpHtmlPath.replace(/\\/g, '/');

  const launchOptions = Object.assign(
    { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    puppeteerOptions
  );

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: ['load', 'networkidle0'] });

    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return;
        return new Promise((res) => {
          img.addEventListener('load', res);
          img.addEventListener('error', res);
        });
      }));
    });

    const broken = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.src)
    );

    if (mermaid && (await page.$('.mermaid'))) {
      await page.addScriptTag({ content: getMermaidScript() });
      await page.evaluate(async (themeName) => {
        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: themeName,
        });
        await window.mermaid.run({
          querySelector: '.mermaid',
          suppressErrors: true,
        });
      }, mermaidTheme);
    }

    const pdfOptions = {
      path: outputAbs,
      format,
      printBackground: true,
      margin,
    };

    if (pageNumbers || headerTemplate || footerTemplate) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = headerTemplate || '<div></div>';
      pdfOptions.footerTemplate =
        footerTemplate ||
        '<div style="font-size:8pt; color:#64748b; width:100%; text-align:center;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span>' +
        '</div>';
    }

    await page.pdf(pdfOptions);
    return { output: outputAbs, brokenImages: broken };
  } finally {
    await browser.close();
    if (!keepHtml) {
      try { fs.unlinkSync(tmpHtmlPath); } catch (_) { /* ignore */ }
    }
  }
}

module.exports = { convert, defaultCss, renderMarkdown };
