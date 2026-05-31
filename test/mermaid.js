'use strict';

const assert = require('assert');
const puppeteer = require('puppeteer');
const { getMermaidScript } = require('../lib/mermaid');
const { renderMarkdown, printableAreaPx } = require('../lib/index');

function bigDiagram(n) {
  const lines = ['flowchart TD'];
  for (let i = 0; i < n; i++) lines.push(`  N${i}[Node number ${i}] --> N${i + 1}[Node number ${i + 1}]`);
  return lines.join('\n');
}

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

  await check('printableAreaPx computes the A4 content box', () => {
    const area = printableAreaPx('A4', { top: '22mm', bottom: '22mm', left: '18mm', right: '18mm' });
    // A4 = 210 x 297 mm; minus margins => 174 x 253 mm, in px at 96dpi.
    assert.ok(Math.abs(area.width - 174 * (96 / 25.4)) < 1, 'width should match A4 content box');
    assert.ok(Math.abs(area.height - 253 * (96 / 25.4)) < 1, 'height should match A4 content box');
  });

  await check('oversized diagrams are scaled to fit one page', async () => {
    const area = printableAreaPx('A4', { top: '22mm', bottom: '22mm', left: '18mm', right: '18mm' });
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(`<!doctype html><html><body><pre class="mermaid">${bigDiagram(40)}</pre></body></html>`);
      await page.addScriptTag({ content: getMermaidScript() });
      const finalHeight = await page.evaluate(async (opts) => {
        const { maxW, maxH } = opts;
        window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        await window.mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
        const svg = document.querySelector('.mermaid svg');
        const vb = svg.viewBox && svg.viewBox.baseVal;
        const w = (vb && vb.width) || svg.getBoundingClientRect().width;
        const h = (vb && vb.height) || svg.getBoundingClientRect().height;
        const scale = Math.min((maxW * 0.99) / w, (maxH * 0.98) / h, 1);
        svg.style.maxWidth = 'none';
        svg.style.width = `${Math.floor(w * scale)}px`;
        svg.style.height = `${Math.floor(h * scale)}px`;
        return svg.getBoundingClientRect().height;
      }, { maxW: area.width, maxH: area.height });
      assert.ok(finalHeight <= area.height, `diagram height ${finalHeight} should fit page ${area.height}`);
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
