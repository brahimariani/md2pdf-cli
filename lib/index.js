'use strict';

const fs = require('fs');
const path = require('path');
const { Marked } = require('marked');
const markedKatex = require('marked-katex-extension');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const { defaultCss, katexCssLink, getThemeCss } = require('./styles');
const { sanitizeHtml } = require('./sanitize');
const { collectHeadings, buildTocHtml, slugify } = require('./toc');
const { createCodeHighlighter } = require('./highlight');
const {
  parseFrontMatter,
  buildCoverHtml,
  coverRequested,
  getCoverLogos,
} = require('./frontmatter');
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

// Page dimensions in millimetres (portrait) for the formats Puppeteer accepts.
const PAGE_SIZES_MM = {
  a0: [841, 1189],
  a1: [594, 841],
  a2: [420, 594],
  a3: [297, 420],
  a4: [210, 297],
  a5: [148, 210],
  a6: [105, 148],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
  tabloid: [279.4, 431.8],
  ledger: [431.8, 279.4],
};

const PX_PER_MM = 96 / 25.4;

function lengthToMm(value, fallbackMm) {
  if (value == null) return fallbackMm;
  const m = String(value).trim().match(/^([\d.]+)\s*(mm|cm|in|px|pt)?$/i);
  if (!m) return fallbackMm;
  const n = parseFloat(m[1]);
  switch ((m[2] || 'mm').toLowerCase()) {
    case 'cm': return n * 10;
    case 'in': return n * 25.4;
    case 'pt': return (n / 72) * 25.4;
    case 'px': return n / PX_PER_MM;
    default: return n;
  }
}

// Computes the usable content area (inside the page margins) in CSS pixels, so
// oversized diagrams can be scaled down to fit a single page.
function printableAreaPx(format, margin = {}) {
  const size = PAGE_SIZES_MM[String(format || 'A4').toLowerCase()] || PAGE_SIZES_MM.a4;
  const [wMm, hMm] = size;
  const left = lengthToMm(margin.left, 0);
  const right = lengthToMm(margin.right, 0);
  const top = lengthToMm(margin.top, 0);
  const bottom = lengthToMm(margin.bottom, 0);
  return {
    width: Math.max(1, (wMm - left - right) * PX_PER_MM),
    height: Math.max(1, (hMm - top - bottom) * PX_PER_MM),
  };
}

const MIME_BY_EXT = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// Puppeteer's header/footer run in an isolated context that frequently fails to
// load external image files, so local logos are inlined as base64 data URIs.
function toDataUri(resolvedUrl) {
  if (!resolvedUrl) return null;
  if (/^data:/i.test(resolvedUrl)) return resolvedUrl;
  if (/^file:/i.test(resolvedUrl)) {
    const p = decodeURI(resolvedUrl.replace(/^file:\/{2,3}/i, ''));
    try {
      const buf = fs.readFileSync(p);
      const mime = MIME_BY_EXT[path.extname(p).toLowerCase()] || 'image/png';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch (_) {
      return null;
    }
  }
  // Remote URLs are passed through as a best effort.
  return resolvedUrl;
}

// Builds the per-page header showing the cover logos, spread evenly and aligned
// with the body's side margins.
function buildLogoHeader(logos, marginLeft, marginRight) {
  const sources = logos.map(toDataUri).filter(Boolean);
  if (!sources.length) return '';
  const imgs = sources
    .map(
      (src) =>
        `<img src="${src}" style="max-height:22px;max-width:150px;object-fit:contain;">`
    )
    .join('');
  return (
    `<div style="width:100%;font-size:8pt;box-sizing:border-box;` +
    `padding:4px ${marginRight} 0 ${marginLeft};display:flex;` +
    `align-items:center;justify-content:space-between;">${imgs}</div>`
  );
}

// Safe-area padding for a full-bleed cover page. The cover is printed with zero
// page margins (so its background image reaches the paper edges and no header /
// footer is reserved), so the flowing content — title, edge-aligned logos —
// must be inset by the document margins or the printer would clip it. The
// absolutely-positioned background image ignores this padding.
function buildCoverSafeAreaCss(margin) {
  const top = lengthToMm(margin.top, 22);
  const right = lengthToMm(margin.right, 18);
  const bottom = lengthToMm(margin.bottom, 22);
  const left = lengthToMm(margin.left, 18);
  return `section.cover { padding: ${top}mm ${right}mm ${bottom}mm ${left}mm; }`;
}

// Loads an HTML document, waits for images (and optionally renders Mermaid),
// then returns the PDF as a buffer plus the list of images that failed to load.
async function renderPdfBuffer(browser, fileUrl, renderOpts, pdfOptions) {
  const page = await browser.newPage();
  try {
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

    if (renderOpts.mermaid && (await page.$('.mermaid'))) {
      await page.addScriptTag({ content: getMermaidScript() });
      const area = printableAreaPx(renderOpts.format, renderOpts.margin);
      await page.evaluate(async (opts) => {
        const { themeName, maxW, maxH } = opts;
        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: themeName,
        });
        await window.mermaid.run({
          querySelector: '.mermaid',
          suppressErrors: true,
        });
        document.querySelectorAll('.mermaid svg').forEach((svg) => {
          const vb = svg.viewBox && svg.viewBox.baseVal;
          let w = vb && vb.width;
          let h = vb && vb.height;
          if (!w || !h) {
            const rect = svg.getBoundingClientRect();
            w = rect.width;
            h = rect.height;
          }
          if (!w || !h) return;
          const scale = Math.min((maxW * 0.99) / w, (maxH * 0.98) / h, 1);
          svg.style.maxWidth = 'none';
          svg.style.width = `${Math.floor(w * scale)}px`;
          svg.style.height = `${Math.floor(h * scale)}px`;
        });
      }, { themeName: renderOpts.mermaidTheme, maxW: area.width, maxH: area.height });
    }

    const buffer = await page.pdf(pdfOptions);
    return { buffer, broken };
  } finally {
    await page.close();
  }
}

// Concatenates several PDF buffers into one. A single buffer is returned as-is.
async function mergePdfBuffers(buffers) {
  if (buffers.length === 1) return buffers[0];
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return Buffer.from(await merged.save());
}

const ZERO_MARGIN = { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' };

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
    headerLogos = false,
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

  const baseDir = path.dirname(inputAbs);
  const wantCover =
    cover === true || (cover == null && coverRequested(frontMatter));
  const coverHtml = wantCover ? buildCoverHtml(frontMatter, { baseDir }) : '';

  const coverLogos = getCoverLogos(frontMatter, baseDir);
  const logoHeader =
    headerLogos && coverLogos.length
      ? buildLogoHeader(coverLogos, margin.left || '18mm', margin.right || '18mm')
      : '';
  const effectiveHeader = headerTemplate || logoHeader || '';
  const showChrome = !!(pageNumbers || effectiveHeader || footerTemplate);

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

  const contentHtml = [tocHtml, parsedBody].filter(Boolean).join('\n');
  const hasContent = contentHtml.trim() !== '';
  const maybeSanitize = (h) => (sanitize ? sanitizeHtml(h) : h);

  const footerHtml =
    footerTemplate ||
    (pageNumbers
      ? '<div style="font-size:8pt; color:#64748b; width:100%; text-align:center;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span>' +
        '</div>'
      : '<div></div>');

  // A cover combined with header/footer chrome must be rendered on its own (no
  // header, footer or page number) and merged ahead of the body, otherwise
  // Chromium reserves the header/footer band on every page — including the
  // cover. Splitting also restarts the body's page numbering at 1.
  const splitCover = wantCover && showChrome;

  const stem = outputAbs.replace(/\.pdf$/i, '');
  const tmpFiles = [];
  const writeTmpHtml = (suffix, html) => {
    const p = `${stem}${suffix}`;
    fs.writeFileSync(p, html, 'utf8');
    tmpFiles.push(p);
    return 'file:///' + p.replace(/\\/g, '/');
  };

  const launchOptions = Object.assign(
    { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    puppeteerOptions
  );

  const browser = await puppeteer.launch(launchOptions);
  try {
    const buffers = [];
    const broken = [];

    if (splitCover) {
      const coverDoc = buildHtml({
        body: maybeSanitize(coverHtml),
        title: docTitle,
        css: `${resolvedCss}\n${buildCoverSafeAreaCss(margin)}`,
        math,
      });
      const coverUrl = writeTmpHtml('.cover.tmp.html', coverDoc);
      const coverRes = await renderPdfBuffer(
        browser,
        coverUrl,
        { mermaid: false, format, margin },
        { printBackground: true, format, margin: ZERO_MARGIN, displayHeaderFooter: false }
      );
      buffers.push(coverRes.buffer);
      broken.push(...coverRes.broken);

      if (hasContent) {
        const bodyDoc = buildHtml({
          body: maybeSanitize(contentHtml),
          title: docTitle,
          css: resolvedCss,
          math,
        });
        const bodyUrl = writeTmpHtml('.body.tmp.html', bodyDoc);
        const bodyRes = await renderPdfBuffer(
          browser,
          bodyUrl,
          { mermaid, mermaidTheme, format, margin },
          {
            printBackground: true,
            format,
            margin,
            displayHeaderFooter: true,
            headerTemplate: effectiveHeader || '<div></div>',
            footerTemplate: footerHtml,
          }
        );
        buffers.push(bodyRes.buffer);
        broken.push(...bodyRes.broken);
      }
    } else {
      const fullBody = [coverHtml, contentHtml].filter(Boolean).join('\n');
      const fullDoc = buildHtml({
        body: maybeSanitize(fullBody),
        title: docTitle,
        css: resolvedCss,
        math,
      });
      const url = writeTmpHtml('.tmp.html', fullDoc);
      const pdfOptions = { printBackground: true, format, margin };
      if (showChrome) {
        pdfOptions.displayHeaderFooter = true;
        pdfOptions.headerTemplate = effectiveHeader || '<div></div>';
        pdfOptions.footerTemplate = footerHtml;
      }
      const res = await renderPdfBuffer(
        browser,
        url,
        { mermaid, mermaidTheme, format, margin },
        pdfOptions
      );
      buffers.push(res.buffer);
      broken.push(...res.broken);
    }

    const merged = await mergePdfBuffers(buffers);
    fs.writeFileSync(outputAbs, merged);
    return { output: outputAbs, brokenImages: broken };
  } finally {
    await browser.close();
    if (!keepHtml) {
      for (const p of tmpFiles) {
        try { fs.unlinkSync(p); } catch (_) { /* ignore */ }
      }
    }
  }
}

module.exports = { convert, defaultCss, renderMarkdown, printableAreaPx };
