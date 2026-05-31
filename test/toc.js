'use strict';

const assert = require('assert');
const { marked } = require('marked');
const { slugify, collectHeadings, buildTocHtml } = require('../lib/toc');
const { sanitizeHtml } = require('../lib/sanitize');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('OK:', name);
  } catch (err) {
    failures++;
    console.error('FAIL:', name, '->', err.message);
  }
}

check('slugify normalizes text', () => {
  assert.strictEqual(slugify('Hello World'), 'hello-world');
  assert.strictEqual(slugify('  Café & Co!  '), 'caf-co');
  assert.strictEqual(slugify('A -- B'), 'a-b');
});

check('collectHeadings dedupes slugs', () => {
  const tokens = marked.lexer('# Intro\n## Intro\n## Intro');
  const heads = collectHeadings(tokens);
  assert.deepStrictEqual(
    heads.map((h) => h.slug),
    ['intro', 'intro-1', 'intro-2']
  );
});

check('buildTocHtml respects depth', () => {
  const tokens = marked.lexer('# A\n## B\n### C');
  const html = buildTocHtml(collectHeadings(tokens), { depth: 2 });
  assert.ok(html.includes('href="#a"'), 'h1 included');
  assert.ok(html.includes('href="#b"'), 'h2 included');
  assert.ok(!html.includes('href="#c"'), 'h3 excluded by depth');
});

check('buildTocHtml nests levels', () => {
  const tokens = marked.lexer('# A\n## B\n## C');
  const html = buildTocHtml(collectHeadings(tokens), { depth: 3 });
  assert.ok(/<nav class="toc">/.test(html));
  const ulCount = (html.match(/<ul>/g) || []).length;
  assert.strictEqual(ulCount, 2, 'one root list + one nested list');
});

check('buildTocHtml returns empty string without headings', () => {
  assert.strictEqual(buildTocHtml([], {}), '');
});

check('sanitization preserves TOC nav, ids and anchors', () => {
  const tokens = marked.lexer('# Intro\n## Details');
  const toc = buildTocHtml(collectHeadings(tokens), {});
  const out = sanitizeHtml(`${toc}<h1 id="intro">Intro</h1>`);
  assert.ok(/<nav/.test(out), 'nav kept');
  assert.ok(/href="#intro"/.test(out), 'anchor kept');
  assert.ok(/id="intro"/.test(out), 'heading id kept');
});

if (failures > 0) {
  console.error(`\n${failures} TOC test(s) failed.`);
  process.exit(1);
}
console.log('\nAll TOC tests passed.');
