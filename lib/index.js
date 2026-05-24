'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const markedKatex = require('marked-katex-extension');
const puppeteer = require('puppeteer');
const { defaultCss, katexCssLink } = require('./styles');

let katexExtensionRegistered = false;
function ensureKatexExtension() {
  if (katexExtensionRegistered) return;
  marked.use(markedKatex({ throwOnError: false, output: 'html', nonStandard: true }));
  katexExtensionRegistered = true;
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
  } = options;

  if (!input) throw new Error('`input` is required');
  if (!output) throw new Error('`output` is required');

  const inputAbs = path.resolve(input);
  const outputAbs = path.resolve(output);

  if (!fs.existsSync(inputAbs)) {
    throw new Error(`Input markdown file not found: ${inputAbs}`);
  }

  const rawMd = fs.readFileSync(inputAbs, 'utf8');
  marked.setOptions({ gfm: true, breaks: false });
  if (math) ensureKatexExtension();
  const md = math ? normalizeBlockMath(rawMd) : rawMd;
  const body = marked.parse(md);

  let resolvedCss = css || defaultCss;
  if (cssFile) {
    resolvedCss = fs.readFileSync(path.resolve(cssFile), 'utf8');
  }

  const docTitle = title || path.basename(inputAbs, path.extname(inputAbs));
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

module.exports = { convert, defaultCss };
