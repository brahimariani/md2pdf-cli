'use strict';

const assert = require('assert');
const { marked } = require('marked');
const markedKatex = require('marked-katex-extension');
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

check('strips <script> tags', () => {
  const out = sanitizeHtml('<p>hi</p><script>window.x=1</script>');
  assert.ok(!/<script/i.test(out), 'script tag should be removed');
  assert.ok(/<p>hi<\/p>/.test(out), 'safe content should remain');
});

check('strips event-handler attributes', () => {
  const out = sanitizeHtml('<img src="x" onerror="alert(1)">');
  assert.ok(!/onerror/i.test(out), 'onerror attribute should be removed');
});

check('strips javascript: URIs', () => {
  const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
  assert.ok(!/javascript:/i.test(out), 'javascript: scheme should be removed');
});

check('removes <iframe> embeds', () => {
  const out = sanitizeHtml('<iframe src="https://evil.test"></iframe>');
  assert.ok(!/<iframe/i.test(out), 'iframe should be removed');
});

check('preserves legitimate markdown HTML', () => {
  const html = marked.parse('# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n`code`');
  const out = sanitizeHtml(html);
  assert.ok(/<h1/.test(out), 'heading kept');
  assert.ok(/<table/.test(out), 'table kept');
  assert.ok(/<code/.test(out), 'inline code kept');
});

check('preserves KaTeX math output', () => {
  marked.use(markedKatex({ throwOnError: false, output: 'html', nonStandard: true }));
  const html = marked.parse('Inline $e^{i\\pi}+1=0$ done.');
  const out = sanitizeHtml(html);
  assert.ok(/class="katex/.test(out), 'KaTeX markup should be preserved');
});

if (failures > 0) {
  console.error(`\n${failures} sanitization test(s) failed.`);
  process.exit(1);
}
console.log('\nAll sanitization tests passed.');
