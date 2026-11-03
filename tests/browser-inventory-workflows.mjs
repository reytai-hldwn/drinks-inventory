import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=process.env.PANTRY_WORKFLOW_ROOT?resolve(process.env.PANTRY_WORKFLOW_ROOT):fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.avif':'image/avif'};
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html',path=resolve(root,name);if(!path.startsWith(root.replace(/\/$/,'')+sep))throw Error();res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/TEST_BATCH_WORKFLOWS/exec';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{for(const width of [1440,390]){
 const b=websiteBackend(),context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],posts=[],reads=[];
 await page.addInitScript(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.__stockExport=blob;return original(blob);};});
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 await page.route('**/config.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
 await page.route(`${endpoint}**`,async route=>{
  if(route.request().method()==='POST'){const parameter=Object.fromEntries(new URLSearchParams(route.request().postData()));posts.push(JSON.parse(parameter.payload));await new Promise(r=>setTimeout(r,50));await route.fulfill({contentType:'text/html',body:b.ctx.doPost({parameter}).body});}
  else{const parameter=Object.fromEntries(new URL(route.request().url()).searchParams);reads.push(parameter.action);await route.fulfill({contentType:'application/javascript',body:b.ctx.doGet({parameter}).body});}
 });
 const done=async()=>{await page.waitForFunction(()=>!document.querySelector('form[aria-busy=true], [data-restock-control][aria-busy=true]'));await page.waitForTimeout(80);};
 const go=async route=>{await page.evaluate(route=>{location.hash=route;},route);await page.waitForTimeout(100);};
 const row=id=>page.locator(`[data-supply-id="${id}"]`);
 await page.goto(`${base}/#restock-snack`);await page.waitForSelector('#supply-restock-form');
 await page.locator('[data-action=batch-arrival]').click();await page.waitForSelector('#batch-arrival-form');await page.locator('#batch-arrival-form [name=recorder]').fill('虛構批次登記者');
 let rows=page.locator('.batch-row');await rows.nth(0).locator('[data-batch-item]').selectOption('supply-snack-01');await rows.nth(0).locator('[data-batch-quantity]').fill('7');
 await page.locator('[data-action=batch-add]').click();await rows.nth(1).locator('[data-batch-kind]').selectOption('drink');await rows.nth(1).locator('[data-batch-item]').selectOption('tea');await rows.nth(1).locator('[data-batch-quantity]').fill('3');
 await page.locator('[data-action=batch-add]').click();await rows.nth(2).locator('[data-batch-kind]').selectOption('snack');await rows.nth(2).locator('[data-batch-item]').selectOption('__new__');await rows.nth(2).locator('[data-batch-name]').fill('虛構燕麥棒');await rows.nth(2).locator('[data-batch-flavor]').fill('莓果');await rows.nth(2).locator('[data-batch-category]').selectOption('燕麥棒/餅');await rows.nth(2).locator('[data-batch-quantity]').fill('5');
 await page.locator('[data-action=batch-add]').click();await rows.nth(3).locator('[data-batch-kind]').selectOption('noodle');await rows.nth(3).locator('[data-batch-item]').selectOption('supply-noodle-01');await rows.nth(3).locator('[data-batch-quantity]').fill('4');
 // A missing required date keeps the full batch draft and sends nothing.
 await page.locator('#batch-arrival-form [type=submit]').click();assert.equal(posts.length,0);assert.equal(await rows.count(),4);assert.equal(await rows.nth(0).locator('[data-batch-quantity]').inputValue(),'7');
 await rows.nth(3).locator('[data-batch-expiry]').fill('2099-01-01');await page.locator('#batch-arrival-form [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);await done();
 assert.equal(posts.filter(post=>post.operation==='batch-arrival').length,1);assert.equal(posts[0].data.entries.length,4);const fresh=b.ctx.supplyCatalog_(b.ss).find(item=>item.name==='虛構燕麥棒');assert.equal(fresh.flavor,'莓果');
 await go('products');await page.waitForSelector('[data-stock-drink-id=tea]');assert.match(await page.locator('[data-stock-drink-id=tea] .stock-value').innerText(),/23/);assert.equal(await page.locator('[data-stock-drink-id=milk] .warehouse-low').count(),0,'low quantity is neutral without a manual flag');
 await page.locator('[data-stock-drink-id=tea] [data-restock-toggle]').check();await done();assert.equal(await page.locator('[data-stock-drink-id]').first().getAttribute('data-stock-drink-id'),'tea');assert.equal(await page.locator('[data-stock-drink-id=tea] .warehouse-low').count(),1,'manual flag colors high stock too');
 assert.equal(await page.locator('[data-filter=low]').textContent(),'庫存量少');
 await page.locator('[data-action=warehouse-kind][data-id=snack]').click();await row(fresh.id).waitFor();assert.match(await row('supply-snack-01').locator('.stock-value').innerText(),/7/);assert.match(await row(fresh.id).innerText(),/莓果/);assert.match(await row(fresh.id).locator('.stock-value').innerText(),/5/);assert.equal(await row(fresh.id).locator('.warehouse-low').count(),0);
 await row('supply-snack-01').locator('[data-restock-toggle]').check();await done();assert.equal(await page.locator('[data-supply-id]').first().getAttribute('data-supply-id'),'supply-snack-01');assert.equal(await row('supply-snack-01').locator('.warehouse-low').count(),1);
 await row(fresh.id).locator('[data-action=snack-details]').click();await page.locator('#snack-details-form [name=flavor]').fill('可可');await page.locator('#snack-details-form [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);await done();assert.match(await row(fresh.id).innerText(),/可可/);assert.match(await row(fresh.id).locator('.stock-value').innerText(),/5/);
 await page.locator('[data-action=export]').click();const csv=await page.evaluate(()=>window.__stockExport.text());assert.match(csv.split('\n')[0],/口味/);assert.match(csv,/可可/);assert.ok(csv.trim().split(/\r?\n/).every(line=>line.split(',').length===7),'stock CSV header and rows retain seven aligned fields');
 await page.locator('.snack-flavor-stats summary').click();assert.match(await page.locator('.snack-flavor-stats').innerText(),/累積盤點中/);
 await go('count');await page.waitForSelector('[data-action=count-kind]');await page.locator('[data-action=count-kind][data-id=snack]').click();await page.waitForSelector('#supply-count-form');await page.locator('#supply-count-form [name=recorder]').fill('虛構盤點者');await page.locator(`#supply-count-form [name="${fresh.id}"]`).fill('0');await page.locator('#supply-count-form [type=submit]').click();await done();assert.equal(b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss)).find(item=>item.id===fresh.id).stock,0);assert.equal(b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss)).find(item=>item.id==='supply-snack-01').stock,7,'blank counts preserve other items');
 const before=reads.length;await go('admin');await page.waitForSelector('#admin-activity .activity-list');assert.deepEqual(reads.slice(before),['admin'],'home uses one compact activity read');assert.equal(await page.locator('.admin-card').count(),0);assert.deepEqual(await page.locator('.admin-disclosure').evaluateAll(nodes=>nodes.map(node=>node.open)),[false,false,false]);assert.equal(await page.locator('.count-activity').count(),4);
 await page.locator('#admin-restock > summary').click();assert.match(await page.locator('#admin-restock').innerText(),/茶|多力多滋/);assert.equal(await page.locator('#admin-restock .needs-restock').count(),2);await page.locator('.count-activity').filter({hasText:'零食'}).locator('summary').click();assert.match(await page.locator('.count-activity').filter({hasText:'零食'}).innerText(),/虛構燕麥棒.*0 包/s);
 await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`/tmp/pantry-workflow-admin-${width}.png`,fullPage:true});
 assert.deepEqual(errors,[]);console.log(`PASS ${width}: one mixed batch, date validation retains draft, arrival-only stock, optional flavor edit, manual priority/red quantities, snack multi-count, compact home activity and no overflow`);await context.close();
}}finally{await browser.close();await new Promise(r=>server.close(r));}
