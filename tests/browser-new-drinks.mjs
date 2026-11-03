// Public new-product fixtures only. All API requests use the memory backend;
// this check never reads or writes the real warehouse.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { websiteBackend } from './helpers/google-website.mjs';
const { chromium } = await import(process.env.PANTRY_PLAYWRIGHT_MODULE || 'playwright-core');
const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html');
    if (!path.startsWith(root)) throw new Error('not found');
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const endpoint = 'https://script.google.com/macros/s/NEW_DRINK_FIXTURE/exec';
const names = ['午后時光重乳奶茶', '義美寶吉葡萄汁', '波蜜蜂蜜檸檬', '可爾必思開心成長160ml'];
const browser = await chromium.launch({ executablePath: process.env.PANTRY_CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const width of [1440, 390]) {
    const backend = websiteBackend();
    backend.sheets.Catalog.rows.splice(1, 99, ...names.map((name, i) => ['new-' + i, name, ['茶飲','果汁','果汁','牛乳／植物奶'][i], i===3?'鋁箔包':'其他', '包', 24, 10, true]));
    const originalRows = structuredClone(backend.sheets.Catalog.rows);
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], photos = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/\/assets\/(?:display\/)?(?:afternoon-rich|imei-grape|bomy-honey|calpis-happy)/.test(r.url())) photos.push(r.url()); });
    await page.route('**/config.js', route => route.fulfill({ contentType:'application/javascript', body:`window.DRINKS_CONFIG=${JSON.stringify({ provider:'google', googleScriptUrl:endpoint })};` }));
    await page.route(`${endpoint}**`, route => {
      if (route.request().method() !== 'GET') { writes.push(route.request().method()); return route.abort(); }
      return route.fulfill({ contentType:'application/javascript', body:backend.ctx.doGet({ parameter:Object.fromEntries(new URL(route.request().url()).searchParams) }).body });
    });
    await page.goto(base);
    await page.waitForSelector('.pantry-stage[data-scene]');
    assert.ok(photos.every(url => url.includes('/display/')), 'closed office scene never downloads full-size originals');
    if (width < 900) assert.equal(photos.length, 0, 'closed mobile fridge does not download product photos');
    await page.locator('.fridge-door').click();
    await page.waitForSelector('.fridge.is-ready');
    assert.equal(await page.locator('.fridge-product').count(), 4);
    for (let i = 0; i < names.length; i++) {
      const card = i===3?page.locator('.fridge-product[data-drink-id="new-3"]'):page.locator('.fridge-product').filter({ hasText: names[i] });
      await card.scrollIntoViewIfNeeded();
      const img = card.locator('.drink-product-photo');
      await img.evaluate(image => image.decode());
      assert.match(await card.locator('.drink-photo-viewport').evaluate(e => getComputedStyle(e).clipPath), /^polygon\(/);
      await card.locator('[data-action="view-drink"]').click();
      await page.waitForSelector('.drink-information');
      assert.equal(await page.locator('.drink-detail-hero .subtle').innerText(), '鋁箔包');
      assert.ok((await page.locator('.drink-information').innerText()).includes(['330 毫升', '125 毫升', '160 毫升', '160 毫升'][i]));
      if (i===3) {
        assert.equal(await page.locator('.nutrition-table tbody tr').count(), 9);
        assert.ok((await page.locator('.drink-information').innerText()).includes('乳製品及大豆'));
        assert.equal(await card.locator('h4').innerText(),'可爾必思');
        assert.equal(await page.locator('.drink-detail-hero .category-label').innerText(),'其他');
        assert.equal(await page.evaluate(async()=>{const f=await document.fonts.load('700 22px "Pantry Product Characters"','爾思');return f.length===1&&f[0].status==='loaded';}),true);
      }
      else if (i < 2) assert.equal(await page.locator('.nutrition-table tbody tr').count(), 8);
      else assert.equal(await page.locator('.nutrition-table').count(), 0);
      await page.locator('.drink-detail-hero img').evaluate(image => image.decode());
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path:`/tmp/new-drink-${width}-${i}.png`, fullPage:true });
      await page.locator('#modal [data-action="close-modal"]').last().click();
    }
    await page.screenshot({ path:`/tmp/new-drinks-fridge-${width}.png`, fullPage:true });
    assert.equal(new Set(photos.filter(url => url.includes('/display/'))).size, 4);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(backend.sheets.Catalog.rows, originalRows);
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}: four original photo cutouts, Calpis nutrition/allergens/glyphs, foil carton labels, deferred WebP loading, correct capacities, pending lemon fields, no inventory writes`);
    await context.close();
  }
} finally { await browser.close(); await new Promise(done => server.close(done)); }
