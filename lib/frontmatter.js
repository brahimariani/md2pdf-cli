'use strict';

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

// Builds a standalone title page from front matter metadata. Returns '' when
// there is nothing meaningful to show.
function buildCoverHtml(data = {}) {
  const parts = [];
  if (data.title) {
    parts.push(`<h1 class="cover-title">${escapeHtml(data.title)}</h1>`);
  }
  if (data.subtitle) {
    parts.push(`<p class="cover-subtitle">${escapeHtml(data.subtitle)}</p>`);
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
  if (!parts.length) return '';
  return `<section class="cover">${parts.join('')}</section>`;
}

module.exports = { parseFrontMatter, buildCoverHtml };
