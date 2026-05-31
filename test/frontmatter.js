'use strict';

const assert = require('assert');
const { parseFrontMatter, buildCoverHtml } = require('../lib/frontmatter');
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

check('parses and strips front matter', () => {
  const { data, content } = parseFrontMatter(
    '---\ntitle: Hello\ncover: true\n---\n# Body\n'
  );
  assert.strictEqual(data.title, 'Hello');
  assert.strictEqual(data.cover, true);
  assert.ok(!/title: Hello/.test(content), 'front matter stripped from body');
  assert.ok(/# Body/.test(content), 'body preserved');
});

check('returns empty metadata when no front matter', () => {
  const { data, content } = parseFrontMatter('# Just a title\n');
  assert.deepStrictEqual(data, {});
  assert.ok(/# Just a title/.test(content));
});

check('malformed YAML falls back to raw content', () => {
  const raw = '---\ntitle: [unclosed\n---\n# Body\n';
  const { data, content } = parseFrontMatter(raw);
  assert.deepStrictEqual(data, {});
  assert.strictEqual(content, raw);
});

check('builds a cover from metadata', () => {
  const html = buildCoverHtml({
    title: 'My Report',
    subtitle: 'An overview',
    author: ['Alice', 'Bob'],
    date: '2026-05-31',
  });
  assert.ok(/<section class="cover">/.test(html));
  assert.ok(/cover-title">My Report/.test(html));
  assert.ok(/cover-subtitle">An overview/.test(html));
  assert.ok(/Alice, Bob/.test(html));
  assert.ok(/2026-05-31/.test(html));
});

check('formats Date objects as YYYY-MM-DD', () => {
  const html = buildCoverHtml({ title: 'X', date: new Date('2026-05-31T00:00:00Z') });
  assert.ok(/cover-date">2026-05-31</.test(html));
});

check('escapes cover metadata', () => {
  const html = buildCoverHtml({ title: '<script>alert(1)</script>' });
  assert.ok(!/<script>/.test(html), 'raw script must be escaped');
  assert.ok(/&lt;script&gt;/.test(html));
});

check('returns empty string with no usable metadata', () => {
  assert.strictEqual(buildCoverHtml({}), '');
  assert.strictEqual(buildCoverHtml({ cover: true }), '');
});

check('cover survives sanitization', () => {
  const html = buildCoverHtml({ title: 'Doc', author: 'Alice' });
  const out = sanitizeHtml(html);
  assert.ok(/<section/.test(out), 'section kept');
  assert.ok(/class="cover"/.test(out), 'class kept');
});

if (failures > 0) {
  console.error(`\n${failures} front matter test(s) failed.`);
  process.exit(1);
}
console.log('\nAll front matter tests passed.');
