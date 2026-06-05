'use strict';

const path = require('path');

function katexCssLink() {
  let katexCssPath;
  try {
    katexCssPath = require.resolve('katex/dist/katex.min.css');
  } catch (_) {
    return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">';
  }
  const fileUrl = 'file:///' + katexCssPath.replace(/\\/g, '/');
  return `<link rel="stylesheet" href="${fileUrl}">`;
}

// Structural rules required by the converter's features (KaTeX, TOC, cover
// page, images, page-break safety). These are theme-agnostic and always
// applied; per-theme skins below only handle typography and colors.
const baseCss = `
@page { size: A4; margin: 22mm 18mm 22mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; max-width: 100%; }
h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px auto;
  page-break-inside: avoid;
  break-inside: avoid;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 18px 0;
  page-break-inside: avoid;
}
pre { overflow-x: auto; page-break-inside: avoid; }
.mermaid {
  text-align: center;
  margin: 14px 0;
  background: #ffffff;
  color: #000;
  padding: 8px 0;
  border: none;
  page-break-inside: avoid;
  break-inside: avoid;
}
.mermaid svg { max-width: 100%; height: auto; background: #ffffff; }
.katex { font-size: 1.05em; }
.katex-display { margin: 14px 0; overflow-x: auto; overflow-y: hidden; page-break-inside: avoid; }
.katex-display > .katex { display: inline-block; text-align: center; max-width: 100%; }
nav.toc { page-break-after: always; break-after: page; margin-bottom: 8px; }
nav.toc .toc-title { margin-top: 0; padding-bottom: 4px; }
nav.toc ul { list-style: none; margin: 4px 0; padding-left: 18px; }
nav.toc > ul { padding-left: 0; }
nav.toc li { margin-bottom: 3px; }
section.cover {
  position: relative;
  page-break-after: always;
  break-after: page;
  display: flex;
  flex-direction: column;
  text-align: center;
  min-height: 88vh;
  overflow: hidden;
}
section.cover .cover-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  position: relative;
  z-index: 1;
}
section.cover.cover-align-top { justify-content: flex-start; }
section.cover.cover-align-center { justify-content: center; }
section.cover.cover-align-bottom { justify-content: flex-end; }
section.cover.cover-align-between { justify-content: stretch; }
section.cover.cover-align-between .cover-content {
  flex: 1 1 auto;
  justify-content: space-between;
}
section.cover .cover-logo {
  max-width: 180px;
  max-height: 120px;
  width: auto;
  margin: 0 0 22px 0;
  border: none;
  border-radius: 0;
  page-break-inside: avoid;
}
section.cover .cover-logos {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 24px;
  margin: 0 0 28px 0;
}
section.cover .cover-logos .cover-logo {
  max-height: 90px;
  margin: 0;
  flex: 0 1 auto;
}
section.cover .cover-image {
  max-width: 72%;
  max-height: 44vh;
  width: auto;
  margin: 0 0 26px 0;
  border: none;
  border-radius: 0;
  page-break-inside: avoid;
}
section.cover .cover-bg-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  margin: 0;
  border: none;
  border-radius: 0;
  z-index: 0;
}
section.cover .cover-title { font-size: 24pt; font-weight: 700; border: none; margin: 0 0 8px 0; padding: 0; }
section.cover .cover-subtitle { font-size: 15pt; margin: 0 0 14px 0; }
section.cover .cover-version { font-size: 11pt; margin: 0 0 28px 0; letter-spacing: 0.04em; }
section.cover .cover-author { font-size: 13pt; margin: 0 0 6px 0; }
section.cover .cover-date { font-size: 11pt; margin: 0; }
`;

const defaultSkin = `
body {
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.55;
  color: #1a1a1a;
}
h1, h2, h3, h4 { color: #1a1a1a; font-weight: 700; }
h1 { font-size: 18pt; padding-bottom: 6px; margin-top: 0; }
h2 { font-size: 14pt; padding-bottom: 4px; margin-top: 28px; }
h3 { font-size: 12pt; margin-top: 22px; }
h4 { font-size: 11pt; margin-top: 18px; }
p { text-align: justify; margin: 0 0 10px 0; }
ul, ol { margin: 6px 0 12px 0; padding-left: 24px; }
li { margin-bottom: 4px; }
strong { color: #1a1a1a; }
code {
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: "Consolas", "Courier New", monospace;
  font-size: 9.5pt;
  color: #b91c1c;
}
pre { background: #0f172a; color: #f1f5f9; padding: 12px; border-radius: 5px; font-size: 9pt; }
pre code { background: transparent; color: inherit; padding: 0; }
table { font-size: 9.5pt; }
th, td { border: 1px solid #cbd5e1; padding: 6px 9px; text-align: left; vertical-align: top; }
th { background: #e2e8f0; color: #0b2447; font-weight: 600; }
tr:nth-child(even) td { background: #f8fafc; }
hr { border: none; border-top: 1px solid #cbd5e1; margin: 24px 0; }
blockquote { border-left: 4px solid #64748b; padding: 4px 12px; color: #475569; background: #f8fafc; margin: 10px 0; }
img { border: 1px solid #e2e8f0; border-radius: 4px; }
img + em, p > em { display: block; text-align: center; color: #475569; font-size: 9.5pt; margin-bottom: 14px; }
a { color: #1d4ed8; text-decoration: none; }
nav.toc .toc-title { border-bottom: 1px solid #bcccdc; }
nav.toc a { color: #1a1a1a; }
section.cover .cover-subtitle { color: #475569; }
section.cover .cover-version { color: #64748b; }
section.cover .cover-author { color: #102a43; }
section.cover .cover-date { color: #64748b; }
`;

// Emulates the classic LaTeX `article` look: Computer Modern serif, justified
// and indented paragraphs, booktabs-style rules, centered title.
const latexSkin = `
body {
  font-family: "Latin Modern Roman", "CMU Serif", "Computer Modern", "Georgia", "Times New Roman", serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #000;
}
h1, h2, h3, h4 { color: #000; font-weight: 700; }
h1 { font-size: 18pt; margin-top: 0; margin-bottom: 20px; }
h2 { font-size: 14pt; margin-top: 24px; }
h3 { font-size: 12pt; margin-top: 18px; }
h4 { font-size: 11pt; margin-top: 14px; font-style: italic; font-weight: 600; }
p { text-align: justify; margin: 0 0 2px 0; text-indent: 1.5em; }
p:first-of-type, h1 + p, h2 + p, h3 + p, h4 + p { text-indent: 0; }
ul, ol { margin: 6px 0 10px 0; padding-left: 24px; }
li { margin-bottom: 2px; }
code {
  background: #f4f4f4;
  padding: 1px 4px;
  border-radius: 2px;
  font-family: "Consolas", "Courier New", monospace;
  font-size: 9.5pt;
  color: #222;
}
pre { background: #f4f4f4; color: #1a1a1a; padding: 12px; border: 1px solid #ddd; border-radius: 3px; font-size: 9pt; }
pre code { background: transparent; color: inherit; padding: 0; }
table { font-size: 10pt; margin: 14px auto; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; }
th, td { border: none; padding: 5px 12px; text-align: left; vertical-align: top; }
th { border-bottom: 1px solid #000; font-weight: 700; }
hr { border: none; border-top: 1px solid #000; margin: 22px 0; }
blockquote { border-left: 2px solid #000; padding: 2px 14px; color: #1a1a1a; margin: 10px 24px; }
img + em, p > em { display: block; text-align: center; color: #333; font-size: 9.5pt; margin-bottom: 14px; }
a { color: #000; text-decoration: none; }
nav.toc .toc-title { border-bottom: 1px solid #000; text-align: center; }
nav.toc a { color: #000; }
section.cover .cover-subtitle { color: #333; }
section.cover .cover-version { color: #333; }
section.cover .cover-date { color: #333; }
`;

const academicSkin = `
body {
  font-family: "Georgia", "Times New Roman", "Cambria", serif;
  font-size: 11.5pt;
  line-height: 1.6;
  color: #161616;
}
h1, h2, h3, h4 { color: #161616; font-weight: 700; font-family: "Georgia", "Times New Roman", serif; }
h1 { font-size: 18pt; margin-top: 0; margin-bottom: 18px; }
h2 { font-size: 14pt; margin-top: 26px; }
h3 { font-size: 12pt; margin-top: 20px; font-style: italic; }
h4 { font-size: 11.5pt; margin-top: 16px; }
p { text-align: justify; margin: 0 0 4px 0; text-indent: 1.6em; }
p:first-of-type, h1 + p, h2 + p, h3 + p, h4 + p { text-indent: 0; }
ul, ol { margin: 8px 0 12px 0; padding-left: 26px; }
li { margin-bottom: 3px; }
code {
  background: #f2f2f0;
  padding: 1px 4px;
  border-radius: 2px;
  font-family: "Consolas", "Courier New", monospace;
  font-size: 9.5pt;
  color: #333;
}
pre { background: #f2f2f0; color: #1a1a1a; padding: 12px; border: 1px solid #ddd; border-radius: 3px; font-size: 9pt; }
pre code { background: transparent; color: inherit; padding: 0; }
table { font-size: 10pt; margin: 14px auto; }
th, td { border: 1px solid #999; padding: 5px 10px; text-align: left; vertical-align: top; }
th { background: #ececec; font-weight: 700; }
hr { border: none; border-top: 1px solid #999; margin: 22px 0; }
blockquote { border-left: 3px solid #888; padding: 2px 14px; color: #333; font-style: italic; margin: 10px 20px; }
img + em, p > em { display: block; text-align: center; color: #444; font-size: 9.5pt; margin-bottom: 14px; }
a { color: #1a1a1a; text-decoration: underline; }
nav.toc .toc-title { border-bottom: 1px solid #999; text-align: center; }
nav.toc a { color: #161616; }
section.cover .cover-subtitle { color: #444; font-style: italic; }
section.cover .cover-version { color: #555; }
section.cover .cover-date { color: #555; }
`;

const themes = {
  default: defaultSkin,
  academic: academicSkin,
  latex: latexSkin,
};

function listThemes() {
  return Object.keys(themes);
}

function getThemeCss(name) {
  const skin = themes[name] || themes.default;
  return `${baseCss}\n${skin}`;
}

const defaultCss = getThemeCss('default');

module.exports = { defaultCss, katexCssLink, getThemeCss, listThemes };
