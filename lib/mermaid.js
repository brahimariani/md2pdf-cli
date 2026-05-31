'use strict';

const fs = require('fs');

// Mermaid's bundled UMD build is large (~3 MB); read it lazily and cache it so
// it is only loaded into memory when a document actually uses diagrams.
let cachedScript = null;

function getMermaidScript() {
  if (cachedScript != null) return cachedScript;
  const scriptPath = require.resolve('mermaid/dist/mermaid.min.js');
  cachedScript = fs.readFileSync(scriptPath, 'utf8');
  return cachedScript;
}

module.exports = { getMermaidScript };
