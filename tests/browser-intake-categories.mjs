// Runs against the in-memory Apps Script harness. No real inventory is used.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { websiteBackend } from './helpers/google-website.mjs';
const { chromium } = await import(process.env.PANTRY_PLAYWRIGHT_MODULE || 'playwright-core');
const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp' };
const server = createServer(async (req,res) => {
  try { const path=resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');if(!path.startsWith(root))throw new Error();res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path)); }
  catch {res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/INTAKE_CATEGORIES/exec';
const browser=await chromium.launch({executablePath:process.env.PANTRY_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
  for(const width of [1440,390]) {
    const b=websiteBackend();
    b.send('supply-stocktake',{recorder:'虛構',entries:[{supplyId:'supply-snack-01',quantity:6},{supplyId:'supply-snack-02',quantity:5},{supplyId:'supply-snack-03',quantity:0}]});
    const fresh=(name,category,flavor,quantity)=>b.send('new-arrival',{kind:'snack',name,category,flavor,unit:'包',quantity,recorder:'虛構'}).result.id;
    const protein1=fresh('虛構蛋白脆片','蛋白質零食','黑巧',4),protein2=fresh('虛構蛋白脆片','蛋白質零食','甘梅',7),high=fresh('虛構巧克力','巧克力','',15);
    for(const id of ['supply-snack-01','supply-snack-03',high]) b.send('restock-preference',{kind:'snack',itemId:id,mode:'consider',expectedMode:'normal'});
    const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await context.newPage(),posts=[],errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
    await page.route(`${endpoint}**`,async r=>{
      if(r.request().method()==='POST'){const parameter=Object.fromEntries(new URLSearchParams(r.request().postData()));posts.push(JSON.parse(parameter.payload));return r.fulfill({contentType:'text/html',body:b.ctx.doPost({parameter}).body});}
      return r.fulfill({contentType:'application/javascript',body:b.ctx.doGet({parameter:Object.fromEntries(new URL(r.request().url()).searchParams)}).body});
    });
    const go=async hash=>{await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(h=>document.body.dataset.view===h,hash);};
    const done=()=>page.waitForFunction(()=>!document.querySelector('iframe[name^="holdwin_write_"]')&&!document.querySelector('form[aria-busy=true]'));
    const ids=()=>page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId));
    await page.goto(base+'/#products');await page.waitForSelector('[data-action=warehouse-kind]');
    await page.locator('[data-action=warehouse-kind][data-id=snack]').click();
    const before=posts.length;
    await page.locator('#snack-category-filter').selectOption('蛋白質零食');
    assert.deepEqual(new Set(await ids()),new Set([protein1,protein2]));
    await page.locator('#snack-product-filter').selectOption('虛構蛋白脆片');assert.equal((await ids()).length,2);
    await page.locator('#supply-search').fill('黑巧');assert.deepEqual(await ids(),[protein1]);
    await page.locator('#supply-search').fill('');await page.locator('#snack-category-filter').selectOption('巧克力');
    assert.equal(await page.locator('#snack-product-filter').inputValue(),'');assert.deepEqual(await ids(),[high]);
    await page.locator('#snack-category-filter').selectOption('');
    await page.locator('[data-action=supply-stock-filter][data-id=low]').click();assert.deepEqual(await ids(),['supply-snack-01']);
    await page.locator('[data-action=supply-stock-filter][data-id=empty]').click();assert.deepEqual(await ids(),['supply-snack-03']);
    assert.equal(posts.length,before,'filtering is local and never changes a stock or manual mark');
    await page.screenshot({path:`/tmp/intake-category-${width}-filters.png`,fullPage:true});
    await go('restock');await page.waitForSelector('#restock-form');
    await page.locator('#restock-drink').selectOption('__new__');
    await page.locator('#restock-form [name=recorder]').fill('虛構測試者');await page.locator('#restock-form [name=newName]').fill('虛構茶飲'+width);
    assert.ok((await page.locator('#restock-form [name=newCategory]').innerText()).includes('牛乳／植物奶'));
    await page.locator('#restock-form [name=newCategory]').selectOption('茶飲');await page.locator('#restock-form [name=newUnit]').selectOption('包');await page.locator('#restock-form [name=loose]').fill('3');
    await page.locator('#restock-submit').click();await done();assert.equal(b.sheets.Catalog.rows.find(row=>row[1]==='虛構茶飲'+width)[2],'茶飲');
    await page.locator('[data-action=batch-arrival]').click();const row=page.locator('.batch-row');
    await row.locator('[data-batch-item]').selectOption('__new__');await row.locator('[data-batch-name]').fill('虛構果汁'+width);
    await row.locator('[data-batch-category]').selectOption('果汁');await row.locator('[data-batch-quantity]').fill('4');await page.locator('#batch-arrival-form [name=recorder]').fill('虛構測試者');
    await page.locator('#batch-arrival-form [type=submit]').click();await done();assert.equal(b.sheets.Catalog.rows.find(row=>row[1]==='虛構果汁'+width)[2],'果汁');
    await go('count');await page.waitForSelector('[data-action=count-kind]');
    for(const kind of ['snack','noodle','toner']) {
      await page.locator(`[data-action=count-kind][data-id=${kind}]`).click();await page.waitForSelector('.supply-count-table');
      const cell=page.locator('.supply-count-name').first();const bounds=await cell.boundingBox(),panel=await page.locator('.supply-count-panel').boundingBox();
      assert.ok(bounds.x>=panel.x&&bounds.x+bounds.width<=panel.x+panel.width+1,'first column stays within its panel');
      assert.equal(await cell.locator('.supply-count-avatar').count(),1);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`/tmp/intake-category-${width}-count-${kind}.png`,fullPage:true});
    }
    await page.locator('[data-action=count-kind][data-id=snack]').click();
    await page.locator('#supply-count-form [name=recorder]').fill('虛構測試者');await page.locator(`#supply-count-form [name="${protein1}"]`).fill('0');
    await page.locator('#supply-count-form [type=submit]').click();await done();
    const inventory=b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss));assert.equal(inventory.find(item=>item.id===protein1).stock,0);assert.equal(inventory.find(item=>item.id===protein2).stock,7);
    await go('admin');await page.waitForSelector('#admin-low-stock [data-admin-summary-count]');
    assert.equal(await page.locator('#admin-restock').count(),0);assert.equal(await page.locator('.admin-disclosure').count(),2);
    await page.locator('#admin-low-stock > summary').click();await page.waitForSelector('#admin-low-stock [data-manual-snack-id]');
    assert.deepEqual(await page.locator('#admin-low-stock [data-manual-snack-id]').evaluateAll(rows=>rows.map(row=>row.dataset.manualSnackId)),['supply-snack-01']);
    assert.deepEqual(errors,[]);console.log(`PASS ${width}: classified single/batch drinks, snack category/product/flavor filters, manual 1–10 list, unclipped count icons, blank count preservation and compact summary`);
    await context.close();
  }
} finally {await browser.close();await new Promise(done=>server.close(done));}
