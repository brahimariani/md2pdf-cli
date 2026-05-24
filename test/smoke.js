'use strict';

const fs = require('fs');
const path = require('path');
const { convert } = require('../lib/index');

(async () => {
  const input = path.join(__dirname, 'fixtures', 'sample.md');
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const output = path.join(outputDir, 'sample.pdf');

  const result = await convert({ input, output, title: 'Smoke Test' });

  const stat = fs.statSync(result.output);
  if (stat.size < 1024) {
    console.error('FAIL: output PDF is suspiciously small:', stat.size, 'bytes');
    process.exit(1);
  }
  console.log('OK:', result.output, '(', stat.size, 'bytes )');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
