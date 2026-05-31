'use strict';

const DEFAULT_THEME = 'github-light';

// Shiki is ESM-only; load it lazily via dynamic import so this CommonJS
// package keeps working and pays the cost only when highlighting is enabled.
let shikiPromise = null;
function loadShiki() {
  if (!shikiPromise) shikiPromise = import('shiki');
  return shikiPromise;
}

// Builds a highlighter preloaded with the requested theme and languages.
// `codeToHtml` is synchronous once the highlighter exists, so it can safely be
// called from marked's synchronous `code` renderer.
async function createCodeHighlighter({ theme = DEFAULT_THEME, langs = [] } = {}) {
  const shiki = await loadShiki();

  const safeTheme = theme in shiki.bundledThemes ? theme : DEFAULT_THEME;
  const safeLangs = Array.from(new Set(langs)).filter(
    (lang) => lang in shiki.bundledLanguages || lang in shiki.bundledLanguagesAlias
  );

  const highlighter = await shiki.createHighlighter({
    themes: [safeTheme],
    langs: safeLangs,
  });
  const loaded = new Set(highlighter.getLoadedLanguages());

  return {
    theme: safeTheme,
    supports: (lang) => !!lang && loaded.has(lang),
    toHtml: (code, lang) =>
      highlighter.codeToHtml(code, { lang, theme: safeTheme }),
  };
}

module.exports = { createCodeHighlighter, DEFAULT_THEME };
