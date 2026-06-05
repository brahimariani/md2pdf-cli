'use strict';

const assert = require('assert');
const {
  parseFrontMatter,
  buildCoverHtml,
  coverRequested,
  getCoverLogos,
} = require('../lib/frontmatter');
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
  assert.ok(/<section class="cover[ "]/.test(html));
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
  assert.ok(/class="cover/.test(out), 'class kept');
});

check('renders a version line', () => {
  const html = buildCoverHtml({ title: 'Doc', version: '1.4.0' });
  assert.ok(/cover-version">1\.4\.0</.test(html));
});

check('accepts version inside the cover object', () => {
  const html = buildCoverHtml({ title: 'Doc', cover: { version: 'v2' } });
  assert.ok(/cover-version">v2</.test(html));
});

check('renders cover and logo images as file URLs', () => {
  const html = buildCoverHtml(
    { title: 'Doc', image: 'assets/cover.png', logo: 'assets/logo.svg' },
    { baseDir: '/docs' }
  );
  assert.ok(/<img class="cover-logo"/.test(html), 'logo present');
  assert.ok(/<img class="cover-image"/.test(html), 'image present');
  assert.ok(/src="file:\/\/\//.test(html), 'paths resolved to file URLs');
});

check('keeps remote and data image URLs untouched', () => {
  const html = buildCoverHtml({
    title: 'Doc',
    logo: 'https://example.com/l.png',
  });
  assert.ok(/src="https:\/\/example\.com\/l\.png"/.test(html));
});

check('background image moves into a full-bleed layer', () => {
  const html = buildCoverHtml({
    title: 'Doc',
    cover: { image: 'bg.jpg', background: true },
  });
  assert.ok(/class="cover cover-align-center cover-bg"/.test(html));
  assert.ok(/<img class="cover-bg-image"/.test(html), 'background layer present');
  assert.ok(!/cover-image"/.test(html), 'no inline image when background');
});

check('applies the requested vertical alignment', () => {
  const top = buildCoverHtml({ title: 'Doc', cover: { align: 'top' } });
  assert.ok(/cover-align-top/.test(top));
  const between = buildCoverHtml({ title: 'Doc', cover: { align: 'between' } });
  assert.ok(/cover-align-between/.test(between));
  const fallback = buildCoverHtml({ title: 'Doc', cover: { align: 'weird' } });
  assert.ok(/cover-align-center/.test(fallback));
});

check('renders a cover from a background-only object', () => {
  const html = buildCoverHtml({ cover: { image: 'bg.jpg', background: true } });
  assert.ok(/<section class="cover/.test(html), 'section emitted');
  assert.ok(/cover-bg-image/.test(html));
});

check('coverRequested handles boolean and object forms', () => {
  assert.strictEqual(coverRequested({ cover: true }), true);
  assert.strictEqual(coverRequested({ cover: { image: 'x.png' } }), true);
  assert.strictEqual(coverRequested({ cover: { enabled: false } }), false);
  assert.strictEqual(coverRequested({ cover: false }), false);
  assert.strictEqual(coverRequested({}), false);
});

check('single logo renders centered without a row wrapper', () => {
  const html = buildCoverHtml(
    { title: 'Doc', cover: { logo: 'a.png' } },
    { baseDir: '/docs' }
  );
  assert.ok(/<img class="cover-logo"/.test(html), 'logo present');
  assert.ok(!/cover-logos/.test(html), 'no row wrapper for a single logo');
});

check('multiple logos render in a space-between row', () => {
  const html = buildCoverHtml(
    { title: 'Doc', cover: { logos: ['a.png', 'b.png', 'c.png'] } },
    { baseDir: '/docs' }
  );
  assert.ok(/<div class="cover-logos">/.test(html), 'row wrapper present');
  assert.strictEqual((html.match(/class="cover-logo"/g) || []).length, 3);
});

check('caps the cover logos at three', () => {
  const logos = getCoverLogos(
    { cover: { logos: ['a.png', 'b.png', 'c.png', 'd.png'] } },
    '/docs'
  );
  assert.strictEqual(logos.length, 3);
  assert.ok(logos.every((u) => /^file:\/\/\//.test(u)));
});

check('getCoverLogos accepts a single string and top-level keys', () => {
  assert.deepStrictEqual(
    getCoverLogos({ logo: 'https://x/y.png' }, '/docs'),
    ['https://x/y.png']
  );
  assert.strictEqual(getCoverLogos({}, '/docs').length, 0);
});

check('cover logos survive sanitization', () => {
  const html = buildCoverHtml(
    { title: 'Doc', cover: { logos: ['a.png', 'b.png'] } },
    { baseDir: '/docs' }
  );
  const out = sanitizeHtml(html);
  assert.ok(/cover-logos/.test(out), 'row wrapper kept');
  assert.strictEqual((out.match(/<img/g) || []).length, 2);
});

check('cover images survive sanitization', () => {
  const html = buildCoverHtml(
    { title: 'Doc', logo: 'assets/logo.png' },
    { baseDir: '/docs' }
  );
  const out = sanitizeHtml(html);
  assert.ok(/<img/.test(out), 'img kept');
  assert.ok(/src="file:\/\/\//.test(out), 'file URL preserved by sanitizer');
});

if (failures > 0) {
  console.error(`\n${failures} front matter test(s) failed.`);
  process.exit(1);
}
console.log('\nAll front matter tests passed.');
