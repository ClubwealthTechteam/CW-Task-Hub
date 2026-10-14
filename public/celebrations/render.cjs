// Renders a Club Wealth poster to PNG at exactly 1080 x 1350.
//   node render.cjs "<poster url>" out.png
// Uses the Playwright that is installed globally in Claude's cloud sessions.
const { execSync } = require('child_process');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const [url, out] = process.argv.slice(2);
  if (!url || !out) { console.error('usage: node render.cjs <url> <out.png>'); process.exit(1); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 20000 }).catch(() => null);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  await browser.close();
  console.log('saved', out);
})().catch((e) => { console.error('render failed:', e.message); process.exit(1); });
