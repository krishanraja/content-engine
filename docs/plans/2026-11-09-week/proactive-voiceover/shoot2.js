const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, process.env.META||'proof.json')));
  const out = path.join(__dirname, process.env.OUT||'frames'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, (JSON.parse(fs.readFileSync(path.join(__dirname, process.env.META||'proof.json'))).page||'proof.html'))); await page.evaluate(() => document.fonts.ready);
  const fps = 30, n = Math.round((meta.t1 - meta.t0) * fps);
  const list = only ? only.map(s => Math.round((s - meta.t0) * fps)) : [...Array(n).keys()];
  for (const i of list) {
    await page.evaluate(t => window.render(t), meta.t0 + i / fps);
    await page.screenshot({ path: path.join(out, `f${String(i).padStart(5, '0')}.png`) });
  }
  await browser.close();
})();
