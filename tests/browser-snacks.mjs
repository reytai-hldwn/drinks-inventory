// Browser integration uses only fictional in-memory Sheets; no production writes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.avif':'image/avif'};
const categories=['太空包','巧克力','甜/鹹餅乾','燕麥棒/餅','其他鹹食','其他甜食'];
const server=createServer(async(req,res)=>{try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',path=resolve(root,name);
  if(!path.startsWith(root.replace(/\/$/,'')+sep)||!/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name))throw new Error('not found');
  res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/TEST_SNACKS/exec';
const browser=await chromium.launch({executablePath:process.env.PANTRY_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{for(const width of [1440,390]){
  const backend=websiteBackend(),posts=[],reads=[],errors=[];
  const connect=async(legacy=false)=>{
    const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
    await page.route(`${endpoint}**`,async route=>{
      const request=route.request();
      if(request.method()==='POST'){
        const parameter=Object.fromEntries(new URLSearchParams(request.postData()));posts.push(JSON.parse(parameter.payload));
        await new Promise(resolve=>setTimeout(resolve,100));
        return route.fulfill({contentType:'text/html',body:backend.ctx.doPost({parameter}).body});
      }
      const parameter=Object.fromEntries(new URL(request.url()).searchParams);reads.push(parameter.action);
      let body=backend.ctx.doGet({parameter}).body;
      if(legacy){
        const payload=JSON.parse(body.slice(parameter.callback.length+1,-2));
        if(payload.supplyEntry)delete payload.supplyEntry.snackVersion;
        const snackIds=new Set((payload.supplies||[]).filter(item=>item.kind==='snack').map(item=>item.id));
        if(payload.supplies)payload.supplies=payload.supplies.filter(item=>item.kind!=='snack');
        if(payload.supplyEvents)payload.supplyEvents=payload.supplyEvents.filter(event=>!snackIds.has(event.supplyId));
        body=`${parameter.callback}(${JSON.stringify(payload)});`;
      }
      return route.fulfill({contentType:'application/javascript',body});
    });
    return {context,page};
  };
  const {context,page}=await connect();
  const form=()=>page.locator('#supply-restock-form');
  const field=name=>form().locator(`[name=${name}]`);
  const done=async()=>{await page.waitForFunction(()=>!document.querySelector('iframe[name^=holdwin_write_]')&&!document.querySelector('form[aria-busy=true]'));await page.waitForFunction(()=>!document.querySelector('#modal').open);};
  const options=()=>page.locator('#restock-supply option[value^=supply-snack-]');
  const go=async hash=>{await page.evaluate(hash=>{location.hash=hash;},hash);await page.waitForFunction(hash=>document.body.dataset.view===hash,hash);};
  const future=days=>new Date(Date.now()+days*86400000+8*3600000).toISOString().slice(0,10),expiry=future(60);
  await page.goto(`${base}/index.html#restock-snack`);await page.waitForSelector('#supply-restock-form[data-kind=snack]');
  assert.deepEqual(await page.locator('.restock-kind-tabs a').allTextContents(),['飲料','零食','泡麵','碳粉']);
  assert.deepEqual(await page.locator('[data-snack-category] option').allTextContents(),['全部分類',...categories]);
  assert.equal(await options().count(),4);assert.ok((await options().allTextContents()).every(text=>/待盤點.*包/.test(text)));
  assert.match(await page.locator('[data-snack-selection]').innerText(),/太空包.*包/);
  const originalDrinks=JSON.stringify(backend.sheets.Catalog.rows),initialReads=reads.length;
  await field('recorder').fill('虛構到貨者');await field('quantity').fill('3');await field('expiresOn').fill(expiry);
  await page.locator('[data-snack-query]').fill('多力');assert.equal(await options().count(),2);assert.equal(reads.length,initialReads,'search uses loaded metadata only');
  await page.locator('[data-snack-category]').selectOption('巧克力');assert.equal(await options().count(),0);assert.equal(await field('supplyId').inputValue(),'');
  assert.equal(await field('quantity').inputValue(),'3');assert.equal(await field('recorder').inputValue(),'虛構到貨者');assert.equal(await field('expiresOn').inputValue(),expiry);assert.equal(posts.length,0,'typing/filtering cannot create a product');
  const name='虛構燕麥棒測試';await page.locator('[data-snack-query]').fill(name);await page.locator('[data-snack-category]').selectOption('');
  await page.locator('[data-action=snack-new]').click();assert.equal(await field('newName').inputValue(),name);assert.equal(await field('newCategory').inputValue(),'');
  assert.deepEqual(await field('newCategory').locator('option:not([value=""])').allTextContents(),categories);
  const beforeInvalid=posts.length;await form().locator('[type=submit]').click();assert.equal(posts.length,beforeInvalid,'a new snack needs its classification');
  await field('newCategory').selectOption('燕麥棒/餅');await field('newUnit').selectOption('條');
  await field('expiresOn').fill('');await form().locator('[type=submit]').click();assert.equal(posts.length,beforeInvalid,'food expiry is required');await field('expiresOn').fill(expiry);
  await page.locator('[data-snack-query]').fill('另外查一下');await page.locator('[data-snack-category]').selectOption('巧克力');
  assert.equal(await field('newName').inputValue(),name);assert.equal(await field('newCategory').inputValue(),'燕麥棒/餅');assert.equal(await field('newUnit').inputValue(),'條');assert.equal(await field('quantity').inputValue(),'3');assert.equal(await field('expiresOn').inputValue(),expiry);
  await form().evaluate(form=>{form.requestSubmit();form.requestSubmit();});await done();assert.equal(posts.filter(post=>post.operation==='new-arrival').length,1,'double submission creates one product and arrival');
  const created=backend.ctx.supplyCatalog_(backend.ss).find(item=>item.name===name);assert.equal(created.category,'燕麥棒/餅');assert.equal(created.unit,'條');
  const newInventory=backend.ctx.supplyInventory_(backend.ctx.supplyCatalog_(backend.ss),backend.ctx.supplyEvents_(backend.ss)).find(item=>item.id===created.id);assert.equal(newInventory.stock,null,'arrival never invents a zero baseline');
  assert.equal(await options().count(),5);assert.match(await page.locator('[aria-label="零食最近入庫紀錄"]').innerText(),new RegExp(expiry));
  await page.locator('[data-snack-query]').fill(name);assert.equal(await options().count(),1);await field('supplyId').selectOption(created.id);
  await field('recorder').fill('虛構追加者');await field('quantity').fill('2');await field('expiresOn').fill(future(75));await form().locator('[type=submit]').click();await done();
  assert.equal(backend.ctx.supplyCatalog_(backend.ss).filter(item=>item.kind==='snack').length,5,'follow-up search reuses the same product');
  await page.locator('[data-snack-query]').fill(name);await page.locator('[data-action=snack-new]').click();await field('newCategory').selectOption('燕麥棒/餅');await field('newUnit').selectOption('條');await field('recorder').fill('虛構重名者');await field('quantity').fill('1');await field('expiresOn').fill(expiry);
  await form().locator('[type=submit]').click();await done();await page.waitForSelector('#toast.error');
  assert.equal(backend.ctx.supplyCatalog_(backend.ss).filter(item=>item.kind==='snack').length,5);assert.equal(await field('newName').inputValue(),name);assert.equal(await field('quantity').inputValue(),'1');assert.match(await page.locator('#toast').innerText(),/同名|已經有/);
  // A rejected attempt keeps the draft and may be corrected without duplicating the old product.
  await field('newName').fill('虛構第二款巧克力');await field('newCategory').selectOption('巧克力');await field('newUnit').selectOption('顆');await form().locator('[type=submit]').click();await done();
  assert.equal(backend.ctx.supplyCatalog_(backend.ss).filter(item=>item.kind==='snack').length,6);
  await field('recorder').fill('還沒送出的草稿');let dialogs=0;page.on('dialog',dialog=>{dialogs++;dialog.dismiss();});
  await page.locator('.restock-kind-tabs a[href="#restock-noodle"]').click();await page.waitForFunction(()=>location.hash==='#restock-snack');assert.equal(await field('recorder').inputValue(),'還沒送出的草稿');assert.ok(dialogs>0);
  page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());await page.locator('.restock-kind-tabs a[href="#restock-noodle"]').click();await page.waitForSelector('#supply-restock-form[data-kind=noodle]');
  await go('products');await page.waitForSelector('[data-action=warehouse-kind]');await page.locator('[data-action=warehouse-kind][data-id=snack]').click();if(await page.locator('[data-action=supply-stock-filter][data-id=all]').count())await page.locator('[data-action=supply-stock-filter][data-id=all]').click();
  const row=()=>page.locator(`[data-supply-id="${created.id}"]`);
  assert.equal(await page.locator('[data-supply-id]').count(),6);assert.match(await row().innerText(),/燕麥棒\/餅/);
  await row().locator('[data-action=supply-count]').click();await page.locator('#supply-count-form [name=recorder]').fill('虛構盤點者');await page.locator('#supply-count-form [data-supply-count]').fill('1');await page.locator('#supply-count-form [type=submit]').click();await done();
  await row().locator('[data-action=supply-arrival]').click();assert.equal(await page.locator('#supply-arrival-form [name=cases]').count(),0);await page.locator('#supply-arrival-form [name=recorder]').fill('虛構補貨者');await page.locator('#supply-arrival-form [name=quantity]').fill('4');await page.locator('#supply-arrival-form [name=expiresOn]').fill(expiry);await page.locator('#supply-arrival-form [type=submit]').click();await done();
  assert.match(await row().locator('.stock-value').innerText(),/5.*條/s);assert.match(await row().innerText(),new RegExp(expiry));
  assert.equal(await page.locator('.supply-stock-filters').count(),0,'snacks use quantity sorting instead of a low-stock filter');assert.equal(await row().locator('[data-restock-toggle]').count(),0,'snacks do not show per-flavour refill reminders');assert.equal(await row().locator('.stock-value.low,.stock-value.warehouse-low').count(),0,'low snack quantities keep neutral styling');
  await row().locator('[data-action=supply-expiry-set]').click();await page.locator('#supply-expiry-set-form [name=recorder]').fill('虛構效期核對');await page.locator('[data-expiry-quantity]').fill('5');await page.locator('[data-expiry-date]').fill('2001-01-01');await page.locator('#supply-expiry-set-form [type=submit]').click();await done();assert.ok(await row().locator('.expiry-expired').count()>0);assert.match(await row().locator('.stock-value').innerText(),/5.*條/s);
  await row().locator('summary').click();await row().locator('[data-action=supply-expiry-close]').click();await page.locator('#supply-expiry-close-form [name=recorder]').fill('虛構批次核對');await page.locator('#supply-expiry-close-form [type=submit]').click();await done();assert.equal(await row().locator('.expiry-expired').count(),0);assert.match(await row().locator('.stock-value').innerText(),/5.*條/s);
  const ordered=await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId));assert.equal(ordered[0],created.id,'observed quantities precede pending items');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`/tmp/snacks-warehouse-${width}.png`,fullPage:true});
  await go('admin');await page.waitForSelector('.admin-low-list');assert.doesNotMatch(await page.locator('.admin-low-list').innerText(),new RegExp(name),'snacks are excluded from replenishment suggestions');
  assert.equal(JSON.stringify(backend.sheets.Catalog.rows),originalDrinks);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await context.close();
  const old=await connect(true);await old.page.goto(`${base}/index.html#restock-snack`);await old.page.waitForSelector('.supply-upgrade');
  const activeButtons=await old.page.locator('#supply-restock-form button[type=submit]').evaluateAll(buttons=>buttons.filter(button=>!button.disabled&&!button.closest('fieldset[disabled]')).length);assert.equal(activeButtons,0,'an old deployment cannot submit snack arrivals');
  const beforeLegacy=posts.length;assert.match(await old.page.locator('.supply-upgrade').innerText(),/零食/);assert.equal(posts.length,beforeLegacy);await old.context.close();
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: ordered snack arrival tab, six classes, local filtered search, preserved drafts, explicit new item, required category/expiry, one write on duplicate submit, reusable products, duplicate rejection, snack counts/expiry and legacy capability gating`);
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
