const { chromium } = require('playwright');
const dir = __dirname;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  for (let i = 1; i <= 6; i++) {
    await page.goto(`file://${dir}/card-${i}.html`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/out/card-${i}.png` });
  }
  await browser.close();
})();
