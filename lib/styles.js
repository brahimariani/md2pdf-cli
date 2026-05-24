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

const defaultCss = `
@page { size: A4; margin: 22mm 18mm 22mm 18mm; }
* { box-sizing: border-box; }
body {
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.55;
  color: #1a1a1a;
  max-width: 100%;
  margin: 0;
}
h1, h2, h3, h4 {
  color: #102a43;
  page-break-after: avoid;
  break-after: avoid;
}
h1 { font-size: 22pt; border-bottom: 2px solid #102a43; padding-bottom: 6px; margin-top: 0; }
h2 { font-size: 16pt; border-bottom: 1px solid #bcccdc; padding-bottom: 4px; margin-top: 28px; }
h3 { font-size: 13pt; margin-top: 22px; }
h4 { font-size: 11.5pt; margin-top: 18px; }
p { text-align: justify; margin: 0 0 10px 0; }
ul, ol { margin: 6px 0 12px 0; padding-left: 24px; }
li { margin-bottom: 4px; }
strong { color: #0b2447; }
code {
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: "Consolas", "Courier New", monospace;
  font-size: 9.5pt;
  color: #b91c1c;
}
pre {
  background: #0f172a;
  color: #f1f5f9;
  padding: 12px;
  border-radius: 5px;
  overflow-x: auto;
  font-size: 9pt;
}
pre code { background: transparent; color: inherit; padding: 0; }
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0 18px 0;
  page-break-inside: avoid;
  font-size: 9.5pt;
}
th, td {
  border: 1px solid #cbd5e1;
  padding: 6px 9px;
  text-align: left;
  vertical-align: top;
}
th { background: #e2e8f0; color: #0b2447; font-weight: 600; }
tr:nth-child(even) td { background: #f8fafc; }
hr { border: none; border-top: 1px solid #cbd5e1; margin: 24px 0; }
blockquote {
  border-left: 4px solid #64748b;
  padding: 4px 12px;
  color: #475569;
  background: #f8fafc;
  margin: 10px 0;
}
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 12px auto;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  page-break-inside: avoid;
  break-inside: avoid;
}
img + em, p > em {
  display: block;
  text-align: center;
  color: #475569;
  font-size: 9.5pt;
  margin-bottom: 14px;
}
a { color: #1d4ed8; text-decoration: none; }
.katex { font-size: 1.05em; }
.katex-display { margin: 14px 0; overflow-x: auto; overflow-y: hidden; page-break-inside: avoid; }
.katex-display > .katex { display: inline-block; text-align: center; max-width: 100%; }
`;

module.exports = { defaultCss, katexCssLink };
