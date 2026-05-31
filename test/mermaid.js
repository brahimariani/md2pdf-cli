'use strict';

const assert = require('assert');
const puppeteer = require('puppeteer');
const { getMermaidScript } = require('../lib/mermaid');
const { renderMarkdown } = require('../lib/index');

const DIAGRAM = ['flowchart LR', '  A[Start] --> B{OK?}', '  B -- Yes --> C[Ship]'].join('\n');

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
  await check('getMermaidScript returns the bundled script', () => {
    const script = getMermaidScript();
    assert.ok(typeof script === 'string' && script.length > 1000);
    assert.ok(/mermaid/.test(script));
  });

  await check('mermaid fences become .mermaid containers when enabled', async () => {
    const md = '```mermaid\n' + DIAGRAM + '\n```\n';
    const { body } = await renderMarkdown({
      md,
      math: false,
      toc: false,
      highlight: false,
      mermaid: true,
    });
    assert.ok(/<pre class="mermaid">/.test(body), 'should produce a .mermaid container');
    assert.ok(!/<code/.test(body), 'should not stay a code block');
  });

  await check('mermaid fences stay code blocks when disabled', async () => {
    const md = '```mermaid\n' + DIAGRAM + '\n```\n';
    const { body } = await renderMarkdown({
      md,
      math: false,
      toc: false,
      highlight: false,
      mermaid: false,
    });
    assert.ok(!/class="mermaid"/.test(body), 'should not create a diagram container');
    assert.ok(/<code/.test(body), 'should remain a code block');
  });

  await check('mermaid renders to SVG inside Chromium', async () => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(`<!doctype html><html><body><pre class="mermaid">${DIAGRAM}</pre></body></html>`);
      await page.addScriptTag({ content: getMermaidScript() });
      await page.evaluate(async () => {
        window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        await window.mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
      });
      const svgCount = await page.evaluate(() => document.querySelectorAll('.mermaid svg').length);
      assert.strictEqual(svgCount, 1, 'one diagram should be rendered to SVG');
    } finally {
      await browser.close();
    }
  });

  if (failures > 0) {
    console.error(`\n${failures} mermaid test(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll mermaid tests passed.');
})();
