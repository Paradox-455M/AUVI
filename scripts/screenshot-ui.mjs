import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5175/';
const out = process.argv[3] || '/tmp/auvi-ui.png';
const width = Number(process.argv[4] || 1728);
const height = Number(process.argv[5] || 1080);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: true });

await browser.close();
console.log(`Saved screenshot: ${out}`);
