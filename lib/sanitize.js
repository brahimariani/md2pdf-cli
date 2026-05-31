'use strict';

const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

let purifier = null;

function getPurifier() {
  if (purifier) return purifier;
  const { window } = new JSDOM('');
  purifier = createDOMPurify(window);
  return purifier;
}

function sanitizeHtml(html) {
  const DOMPurify = getPurifier();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style'],
    ALLOW_DATA_ATTR: false,
  });
}

module.exports = { sanitizeHtml };
