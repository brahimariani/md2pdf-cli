#!/usr/bin/env node
'use strict';

const path = require('path');
const { convert } = require('../lib/index');

function printUsage() {
  console.log(`Usage:
  md2pdf <input.md> [output.pdf] [options]

Options:
  --title <text>        Document title (defaults to input filename)
  --css <file>          Path to a custom CSS file (replaces the default styles)
  --format <size>       Page format (A4, Letter, ...). Default: A4
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
    if (a === '--title') { args.flags.title = argv[++i]; continue; }
    if (a === '--css') { args.flags.cssFile = argv[++i]; continue; }
    if (a === '--format') { args.flags.format = argv[++i]; continue; }
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

  try {
    const result = await convert({
      input,
      output,
      title: args.flags.title,
      cssFile: args.flags.cssFile,
      format: args.flags.format || 'A4',
      pageNumbers: args.flags.pageNumbers !== false,
      math: args.flags.math !== false,
      sanitize: args.flags.sanitize !== false,
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
