const fs = require('fs');
const path = require('path');
const outHtml = path.join(__dirname, '..', 'test-output.html');
const target = path.join(__dirname, '..', 'injected-code.txt');
const s = fs.readFileSync(outHtml, 'utf8');
const re = /window.JSTRACING_EXERCISE\s*=\s*(\{[\s\S]*?\});/;
const m = s.match(re);
if (!m) {
  console.error('window.JSTRACING_EXERCISE not found');
  process.exit(2);
}
const obj = JSON.parse(m[1]);
fs.writeFileSync(target, obj.code, 'utf8');
console.log('WROTE', target);
