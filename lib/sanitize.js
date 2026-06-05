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
    // Local conversion tool: allow absolute file URLs so cover/logo images
    // referenced by path survive sanitization.
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

module.exports = { sanitizeHtml };
