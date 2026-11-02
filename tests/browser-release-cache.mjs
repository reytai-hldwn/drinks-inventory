// Requires a production dist/ build, Chromium, and Playwright Core. Uses a real
// warm HTTP cache; request routing would disable that cache and hide the bug.
// The local server substitutes demo config, so no Google data is read/written.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PANTRY_PLAYWRIGHT_MODULE || 'playwright-core');
const root = fileURLToPath(new URL('../', import.meta.url));
const built = resolve(root, 'dist');
const html = await readFile(resolve(built, 'index.html'), 'utf8');
const revision = html.match(/name="pantry-release" content="([a-f0-9]+)"/)?.[1];
assert.ok(revision, 'Build the production dist/ before running this check.');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.avif': 'image/avif' };
let legacy = true;
const requests = [];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const name = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
    if (!/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name)) throw new Error('not found');
    requests.push(url.pathname + url.search);
    const directory = legacy ? root : built;
    const path = resolve(directory, name);
    if (!path.startsWith(directory.replace(/\/$/, '') + sep)) throw new Error('not found');
    let body = name === 'config.js' ? 'window.DRINKS_CONFIG = {};' : await readFile(path);
    if (legacy && name === 'js/fridge.js') body = body.toString().replaceAll('guide-hand-arrow', 'guide-gold-arrow');
    if (legacy && name === 'pantry.css') {
      body = body.toString().replaceAll('guide-hand-arrow', 'guide-gold-arrow') + '\n.fridge-open-guide .guide-arrow{stroke:#e8b847;stroke-width:6}.fridge-open-guide .guide-arrowhead{stroke:#e8b847;fill:#e8b847}';
    }
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.setHeader('Cache-Control', name === 'index.html' ? 'no-store' : 'public, max-age=600');
    res.end(body);
  } catch {
    res.statusCode = 404; res.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.PANTRY_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const styles = () => page.evaluate(() => {
    const style = selector => getComputedStyle(document.querySelector(`.fridge-guide-wide ${selector}`));
    return { arrow: style('.guide-arrow').stroke, cloud: style('.guide-bubble').stroke, head: style('.guide-arrowhead').fill, paper: style('.guide-bubble').fill };
  });
  await page.goto(`${base}/?preview=old`);
  await page.waitForSelector('.pantry-stage[data-scene=wide]');
  assert.equal((await styles()).arrow, 'rgb(232, 184, 71)', 'prime the browser with the old bright gold arrow');
  assert.equal(await page.locator('.fridge-guide-wide .guide-gold-arrow').count(), 1);

  legacy = false;
  const before = requests.length;
  const cached = await page.evaluate(() => fetch('./pantry.css').then(response => response.text()));
  assert.ok(cached.includes('stroke:#e8b847;stroke-width:6'), 'the old stylesheet is still in the browser cache');
  assert.equal(requests.length, before, 'reading old CSS does not contact the server');

  await page.goto(`${base}/?update=${revision}`);
  await page.waitForSelector('.pantry-stage[data-scene=wide]');
  const updated = await styles();
  assert.equal(updated.arrow, 'rgb(182, 138, 82)');
  assert.equal(updated.arrow, updated.cloud, 'arrow and cloud use matching ink');
  assert.equal(updated.head, updated.paper, 'arrowhead and cloud use matching paper');
  assert.equal(await page.locator('.fridge-guide-wide .guide-hand-arrow').count(), 1, 'cached fridge.js was replaced too');
  const fresh = requests.slice(before).filter(path => /\.(?:css|js)(?:\?|$)/.test(path));
  assert.ok(fresh.some(path => path.startsWith('/js/fridge.js?')));
  for (const path of fresh) assert.equal(new URL(path, base).searchParams.get('v'), revision, 'all runtime requests use one release');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '/tmp/pantry-cache-fixed.png', fullPage: true });
  await page.locator('.fridge-open-guide').click(); await page.waitForSelector('.fridge.is-ready');
  assert.equal(await page.locator('.fridge-product').count(), 32);
  await page.locator('#navigation [data-view=archive]').click(); await page.waitForSelector('.archive-card');
  assert.equal(await page.locator('.archive-card').count(), 8);
  assert.deepEqual(errors, []);
  console.log('PASS warm cache: old gold CSS/module retained, new release loads matching hand-drawn arrow and cloud; opening/navigation work.');
  await context.close();
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
