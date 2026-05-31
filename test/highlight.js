'use strict';

const assert = require('assert');
const { createCodeHighlighter } = require('../lib/highlight');
const { sanitizeHtml } = require('../lib/sanitize');

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log('OK:', name);
  } catch (err) {
    failures++;
    console.error('FAIL:', name, '->', err.message);
  }
}

(async () => {
  await check('highlights a supported language', async () => {
    const hl = await createCodeHighlighter({ theme: 'github-light', langs: ['js'] });
    assert.ok(hl.supports('js'), 'js should be supported');
    const html = hl.toHtml('const x = 1;', 'js');
    assert.ok(/class="shiki/.test(html), 'shiki markup present');
    assert.ok(/style="[^"]*color:/.test(html), 'inline colors present');
  });

  await check('falls back to default theme for unknown theme', async () => {
    const hl = await createCodeHighlighter({ theme: 'does-not-exist', langs: ['js'] });
    assert.strictEqual(hl.theme, 'github-light');
  });

  await check('reports unsupported languages', async () => {
    const hl = await createCodeHighlighter({ theme: 'github-light', langs: ['js'] });
    assert.ok(!hl.supports('totally-made-up-lang'));
    assert.ok(!hl.supports(''));
  });

  await check('sanitization preserves Shiki output', async () => {
    const hl = await createCodeHighlighter({ theme: 'github-light', langs: ['js'] });
    const out = sanitizeHtml(hl.toHtml('const x = 1;', 'js'));
    assert.ok(/<pre/.test(out), 'pre kept');
    assert.ok(/class="shiki/.test(out), 'shiki class kept');
    assert.ok(/style="[^"]*color:/.test(out), 'inline colors kept');
  });

  if (failures > 0) {
    console.error(`\n${failures} highlight test(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll highlight tests passed.');
})();
