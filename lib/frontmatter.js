'use strict';

const path = require('path');
const matter = require('gray-matter');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Splits YAML front matter from the Markdown body. Always returns a plain
// metadata object and the remaining content (front matter stripped).
function parseFrontMatter(rawMd) {
  try {
    const { data, content } = matter(rawMd);
    return { data: data && typeof data === 'object' ? data : {}, content };
  } catch (_) {
    // Malformed YAML: fall back to treating the whole file as content.
    return { data: {}, content: rawMd };
  }
}

function formatDate(value) {
  if (value instanceof Date && !isNaN(value)) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function normalizeAuthors(data) {
  const raw = data.author != null ? data.author : data.authors;
  if (raw == null) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((a) => String(a)).filter(Boolean);
}

// Returns the cover configuration object regardless of whether the front matter
// uses the boolean (`cover: true`) or the structured (`cover: { ... }`) form.
function getCoverConfig(data = {}) {
  return data.cover && typeof data.cover === 'object' ? data.cover : {};
}

// True when the front matter asks for a cover page on its own (boolean `true`
// or an object that is not explicitly disabled via `enabled: false`).
function coverRequested(data = {}) {
  const c = data.cover;
  if (c === true) return true;
  if (c && typeof c === 'object') return c.enabled !== false;
  return false;
}

// Restricts the vertical placement to the values backed by CSS modifiers.
function normalizeAlign(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'top' || v === 'start') return 'top';
  if (v === 'bottom' || v === 'end') return 'bottom';
  if (v === 'between' || v === 'space-between') return 'between';
  return 'center';
}

// Turns a user-supplied image reference into something the headless browser can
// load. Remote/data/file URLs pass through untouched; bare paths are resolved
// against the Markdown file's directory and emitted as absolute file URLs so
// they remain valid no matter where the output PDF is written.
function resolveAssetUrl(src, baseDir) {
  if (src == null) return '';
  const s = String(src).trim();
  if (!s) return '';
  if (/^(https?:|data:|file:)/i.test(s)) return s;
  const abs = path.resolve(baseDir || process.cwd(), s);
  return 'file:///' + abs.replace(/\\/g, '/');
}

function imageTag(src, baseDir, className, alt) {
  const url = resolveAssetUrl(src, baseDir);
  if (!url) return '';
  return `<img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt || '')}">`;
}

// Resolves the list of cover logos (capped at 3) into loadable URLs. Accepts a
// single value or an array, from either `cover.logos` / `cover.logo` or the
// top-level `logos` / `logo` keys. The cap keeps the top row readable.
const MAX_LOGOS = 3;

function getCoverLogos(data = {}, baseDir) {
  const cfg = getCoverConfig(data);
  const raw =
    cfg.logos != null ? cfg.logos
    : cfg.logo != null ? cfg.logo
    : data.logos != null ? data.logos
    : data.logo;
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((s) => resolveAssetUrl(s, baseDir))
    .filter(Boolean)
    .slice(0, MAX_LOGOS);
}

function logosHtml(logos) {
  if (!logos.length) return '';
  const imgs = logos
    .map((u) => `<img class="cover-logo" src="${escapeHtml(u)}" alt="Logo">`)
    .join('');
  // A single logo stays centered (the cover column centers it); two or three
  // spread across the top with even spacing.
  if (logos.length === 1) return imgs;
  return `<div class="cover-logos">${imgs}</div>`;
}

// Builds a standalone title page from front matter metadata. Returns '' when
// there is nothing meaningful to show. `options.baseDir` is used to resolve
// relative image paths (logo / cover image).
function buildCoverHtml(data = {}, options = {}) {
  const cfg = getCoverConfig(data);
  const baseDir = options.baseDir || process.cwd();

  const image = cfg.image != null ? cfg.image : data.image;
  const version = cfg.version != null ? cfg.version : data.version;
  const background = cfg.background === true && !!image;
  const align = normalizeAlign(cfg.align);
  const logos = getCoverLogos(data, baseDir);

  const parts = [];
  const logoBlock = logosHtml(logos);
  if (logoBlock) {
    parts.push(logoBlock);
  }
  if (image && !background) {
    parts.push(imageTag(image, baseDir, 'cover-image', 'Cover'));
  }
  if (data.title) {
    parts.push(`<h1 class="cover-title">${escapeHtml(data.title)}</h1>`);
  }
  if (data.subtitle) {
    parts.push(`<p class="cover-subtitle">${escapeHtml(data.subtitle)}</p>`);
  }
  if (version != null && version !== '') {
    parts.push(`<p class="cover-version">${escapeHtml(version)}</p>`);
  }
  const authors = normalizeAuthors(data);
  if (authors.length) {
    parts.push(
      `<p class="cover-author">${authors.map(escapeHtml).join(', ')}</p>`
    );
  }
  if (data.date != null && data.date !== '') {
    parts.push(`<p class="cover-date">${escapeHtml(formatDate(data.date))}</p>`);
  }

  const filtered = parts.filter(Boolean);
  if (!filtered.length && !background) return '';

  const classes = ['cover', `cover-align-${align}`];
  if (background) classes.push('cover-bg');

  const bg = background ? imageTag(image, baseDir, 'cover-bg-image', '') : '';
  const content = `<div class="cover-content">${filtered.join('')}</div>`;
  return `<section class="${classes.join(' ')}">${bg}${content}</section>`;
}

module.exports = {
  parseFrontMatter,
  buildCoverHtml,
  coverRequested,
  resolveAssetUrl,
  getCoverLogos,
};
