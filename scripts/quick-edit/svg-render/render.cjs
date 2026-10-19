// npm ci --prefix scripts/quick-edit/svg-render
// node scripts/quick-edit/svg-render/render.cjs <folder containing SVG cards>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Resvg } = require('@resvg/resvg-js');
const folder = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.statSync(folder).isDirectory()) {
  throw new Error('Supply the folder containing the SVG cards');
}
const fonts = ['Anton.ttf', 'Mono.ttf'].map(name => path.join(__dirname, '..', 'fonts', name));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const report = { renderer: '@resvg/resvg-js@2.6.2', fonts: {}, cards: [] };
for (const file of fonts) report.fonts[path.basename(file)] = digest(fs.readFileSync(file));
const manifest = path.join(folder, 'render-manifest.json');
let previous = {};
try { previous = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch {}
const reusable = previous.renderer === report.renderer && JSON.stringify(previous.fonts) === JSON.stringify(report.fonts);
let rendered = 0;
for (const name of fs.readdirSync(folder).filter(name => name.endsWith('.svg')).sort()) {
  const source = fs.readFileSync(path.join(folder, name));
  const target = name.replace(/\.svg$/, '.png');
  const cached = reusable && previous.cards?.find(card => card.source === name && card.output === target && card.source_sha256 === digest(source));
  if (cached && fs.existsSync(path.join(folder, target)) && digest(fs.readFileSync(path.join(folder, target))) === cached.sha256) {
    report.cards.push(cached);
    continue;
  }
  const png = new Resvg(source, { font: { fontFiles: fonts, loadSystemFonts: false } }).render().asPng();
  fs.writeFileSync(path.join(folder, target), png);
  rendered++;
  report.cards.push({ source: name, source_sha256: digest(source), output: target, sha256: digest(png) });
}
fs.writeFileSync(path.join(folder, 'render-manifest.json'), JSON.stringify(report, null, 2));
console.log(`Verified ${report.cards.length} cards; rendered ${rendered}, reused ${report.cards.length-rendered} with exact source, output and font hashes`);
