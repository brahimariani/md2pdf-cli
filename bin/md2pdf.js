#!/usr/bin/env node
'use strict';

const path = require('path');
const { convert } = require('../lib/index');
const { listThemes } = require('../lib/styles');

function printUsage() {
  console.log(`Usage:
  md2pdf <input.md> [output.pdf] [options]

Options:
  --title <text>        Document title (defaults to input filename)
  --css <file>          Path to a custom CSS file (replaces the default styles)
  --theme <name>        Built-in theme: default, academic, latex
  --format <size>       Page format (A4, Letter, ...). Default: A4
  --toc                 Prepend an auto-generated table of contents
  --toc-depth <n>       Max heading level included in the TOC. Default: 3
  --toc-title <text>    TOC heading text. Default: "Contents"
  --highlight           Syntax-highlight fenced code blocks (Shiki)
  --code-theme <name>   Shiki theme for code blocks. Default: github-light
  --mermaid             Render mermaid fenced code blocks as diagrams
  --mermaid-theme <t>   Mermaid theme: base, default, neutral, dark, forest. Default: base
  --cover               Render a title page from YAML front matter
  --no-cover            Never render a title page (overrides front matter)
  --header-logos        Repeat the cover logos in every page header (skips the cover)
  --no-page-numbers     Disable footer page numbers
  --no-math             Disable KaTeX equation rendering ($...$ / $$...$$)
  --no-sanitize         Disable HTML sanitization (UNSAFE: allows raw HTML/scripts)
  --keep-html           Keep the intermediate .tmp.html file
  -h, --help            Show this help

Examples:
  md2pdf research.md
  md2pdf research.md out/research.pdf
  md2pdf report.md report.pdf --title "Quarterly Report" --css theme.css
`);
}

function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { args.flags.help = true; continue; }
    if (a === '--no-page-numbers') { args.flags.pageNumbers = false; continue; }
    if (a === '--no-math') { args.flags.math = false; continue; }
    if (a === '--no-sanitize' || a === '--unsafe') { args.flags.sanitize = false; continue; }
    if (a === '--keep-html') { args.flags.keepHtml = true; continue; }
    if (a === '--toc') { args.flags.toc = true; continue; }
    if (a === '--highlight') { args.flags.highlight = true; continue; }
    if (a === '--mermaid') { args.flags.mermaid = true; continue; }
    if (a === '--cover') { args.flags.cover = true; continue; }
    if (a === '--no-cover') { args.flags.cover = false; continue; }
    if (a === '--header-logos') { args.flags.headerLogos = true; continue; }
    if (a === '--title') { args.flags.title = argv[++i]; continue; }
    if (a === '--css') { args.flags.cssFile = argv[++i]; continue; }
    if (a === '--theme') { args.flags.theme = argv[++i]; continue; }
    if (a === '--format') { args.flags.format = argv[++i]; continue; }
    if (a === '--toc-depth') { args.flags.tocDepth = parseInt(argv[++i], 10); continue; }
    if (a === '--toc-title') { args.flags.tocTitle = argv[++i]; continue; }
    if (a === '--code-theme') { args.flags.codeTheme = argv[++i]; continue; }
    if (a === '--mermaid-theme') { args.flags.mermaidTheme = argv[++i]; continue; }
    if (a.startsWith('--')) {
      console.error(`Unknown option: ${a}`);
      process.exit(2);
    }
    args.positional.push(a);
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags.help || args.positional.length === 0) {
    printUsage();
    process.exit(args.flags.help ? 0 : 1);
  }

  const input = args.positional[0];
  const output =
    args.positional[1] ||
    input.replace(/\.md$/i, '') + '.pdf';

  if (args.flags.theme && !listThemes().includes(args.flags.theme)) {
    console.warn(
      `WARNING: unknown theme "${args.flags.theme}", falling back to "default". ` +
        `Available: ${listThemes().join(', ')}`
    );
    args.flags.theme = 'default';
  }

  try {
    const result = await convert({
      input,
      output,
      title: args.flags.title,
      cssFile: args.flags.cssFile,
      theme: args.flags.theme || 'default',
      format: args.flags.format || 'A4',
      pageNumbers: args.flags.pageNumbers !== false,
      math: args.flags.math !== false,
      sanitize: args.flags.sanitize !== false,
      toc: !!args.flags.toc,
      tocDepth: Number.isInteger(args.flags.tocDepth) ? args.flags.tocDepth : 3,
      tocTitle: args.flags.tocTitle,
      highlight: !!args.flags.highlight,
      codeTheme: args.flags.codeTheme,
      mermaid: !!args.flags.mermaid,
      mermaidTheme: args.flags.mermaidTheme || 'base',
      cover: args.flags.cover,
      headerLogos: !!args.flags.headerLogos,
      keepHtml: !!args.flags.keepHtml,
    });
    if (result.brokenImages && result.brokenImages.length) {
      console.warn('WARNING: broken images:');
      for (const src of result.brokenImages) console.warn('  -', src);
    }
    console.log('PDF generated:', result.output);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
