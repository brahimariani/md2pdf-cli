'use strict';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collectHeadings(tokens) {
  const used = new Map();
  const out = [];
  for (const token of tokens) {
    if (token.type !== 'heading') continue;
    const text = token.text;
    let slug = slugify(text) || 'section';
    if (used.has(slug)) {
      const next = used.get(slug) + 1;
      used.set(slug, next);
      slug = `${slug}-${next}`;
    } else {
      used.set(slug, 0);
    }
    out.push({ level: token.depth, text, slug });
  }
  return out;
}

function nest(items) {
  const root = { level: -Infinity, children: [] };
  const stack = [root];
  for (const item of items) {
    const node = { ...item, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return root.children;
}

function renderNodes(nodes) {
  if (!nodes.length) return '';
  const items = nodes
    .map(
      (n) =>
        `<li><a href="#${n.slug}">${escapeHtml(n.text)}</a>${renderNodes(n.children)}</li>`
    )
    .join('');
  return `<ul>${items}</ul>`;
}

function buildTocHtml(headings, { title = 'Contents', depth = 3 } = {}) {
  const items = headings.filter((h) => h.level <= depth);
  if (!items.length) return '';
  const heading = title
    ? `<h2 class="toc-title">${escapeHtml(title)}</h2>`
    : '';
  return `<nav class="toc">${heading}${renderNodes(nest(items))}</nav>`;
}

module.exports = { slugify, collectHeadings, buildTocHtml };
