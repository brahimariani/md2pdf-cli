'use strict';

const assert = require('assert');
const { getThemeCss, listThemes, defaultCss } = require('../lib/styles');

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

check('lists the expected themes', () => {
  const themes = listThemes();
  assert.deepStrictEqual(themes.sort(), ['academic', 'default', 'latex']);
});

check('every theme keeps structural feature rules', () => {
  for (const name of listThemes()) {
    const css = getThemeCss(name);
    assert.ok(/\.katex-display/.test(css), `${name} missing katex rules`);
    assert.ok(/nav\.toc/.test(css), `${name} missing toc rules`);
    assert.ok(/section\.cover/.test(css), `${name} missing cover rules`);
    assert.ok(/page-break-inside/.test(css), `${name} missing page-break safety`);
  }
});

check('themes differ in typography/colors', () => {
  assert.notStrictEqual(getThemeCss('academic'), getThemeCss('default'));
  assert.notStrictEqual(getThemeCss('latex'), getThemeCss('academic'));
  assert.ok(/serif/.test(getThemeCss('academic')), 'academic theme should use a serif font');
  assert.ok(/Computer Modern/.test(getThemeCss('latex')), 'latex theme should use a Computer Modern stack');
});

check('unknown theme falls back to default css', () => {
  assert.strictEqual(getThemeCss('does-not-exist'), getThemeCss('default'));
});

check('defaultCss matches the default theme', () => {
  assert.strictEqual(defaultCss, getThemeCss('default'));
});

if (failures > 0) {
  console.error(`\n${failures} theme test(s) failed.`);
  process.exit(1);
}
console.log('\nAll theme tests passed.');
