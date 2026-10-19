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
for (const name of fs.readdirSync(folder).filter(name => name.endsWith('.svg')).sort()) {
  const source = fs.readFileSync(path.join(folder, name));
  const png = new Resvg(source, { font: { fontFiles: fonts, loadSystemFonts: false } }).render().asPng();
  const target = name.replace(/\.svg$/, '.png');
  fs.writeFileSync(path.join(folder, target), png);
  report.cards.push({ source: name, source_sha256: digest(source), output: target, sha256: digest(png) });
}
fs.writeFileSync(path.join(folder, 'render-manifest.json'), JSON.stringify(report, null, 2));
console.log(`Rendered ${report.cards.length} cards with pinned fonts and renderer`);
