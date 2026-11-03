// Browser integration uses fictional in-memory Sheets only; no production writes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.avif':'image/avif'};
const categories=['太空包','巧克力','甜/鹹餅乾','燕麥棒/餅','蛋白質零食','其他鹹食','其他甜食'];
const server=createServer(async(req,res)=>{try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',path=resolve(root,name);
  if(!path.startsWith(root.replace(/\/$/,'')+sep)||!/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name))throw new Error('not found');
  res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/TEST_SNACKS/exec';
const browser=await chromium.launch({executablePath:process.env.PANTRY_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const widths=process.env.PANTRY_SNACK_WIDTHS?process.env.PANTRY_SNACK_WIDTHS.split(',').map(Number):[1440,390];
try{for(const width of widths){
  const backend=websiteBackend(),posts=[],reads=[],errors=[];
  backend.ctx.ensureSupplyStorage_(backend.ss);
  backend.sheets.SupplyHistory.rows.push(['historical-snack-date','2020-02-01T00:00:00Z','restock','supply-snack-01','多力多滋雙倍起司口味',2,'舊批次資料保留','虛構歷史者','採計','2001-01-01','']);
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
        if(legacy==='dated'){
          if(payload.supplyEntry)payload.supplyEntry.snackPolicyVersion=1;
          if(payload.restockPreferenceEntry)delete payload.restockPreferenceEntry.snackManualVersion;
          if(payload.restockPreferences)payload.restockPreferences=payload.restockPreferences.filter(entry=>entry.kind!=='snack');
        }else if(legacy==='manual'){
          if(payload.restockPreferenceEntry)delete payload.restockPreferenceEntry.snackManualVersion;
          if(payload.restockPreferences)payload.restockPreferences=payload.restockPreferences.filter(entry=>entry.kind!=='snack');
        }else{
          if(payload.supplyEntry){delete payload.supplyEntry.snackVersion;delete payload.supplyEntry.snackPolicyVersion;}
          if(payload.restockPreferenceEntry)delete payload.restockPreferenceEntry.snackManualVersion;
          const snackIds=new Set((payload.supplies||[]).filter(item=>item.kind==='snack').map(item=>item.id));
          if(payload.supplies)payload.supplies=payload.supplies.filter(item=>item.kind!=='snack');
          if(payload.supplyEvents)payload.supplyEvents=payload.supplyEvents.filter(event=>!snackIds.has(event.supplyId));
          if(payload.restockPreferences)payload.restockPreferences=payload.restockPreferences.filter(entry=>entry.kind!=='snack');
        }
        body=`${parameter.callback}(${JSON.stringify(payload)});`;
      }
      return route.fulfill({contentType:'application/javascript',body});
    });
    return {context,page};
  };
  const {context,page}=await connect();
  const form=()=>page.locator('#supply-restock-form'),field=name=>form().locator(`[name=${name}]`);
  const done=async(target=page)=>{await target.waitForFunction(()=>!document.querySelector('iframe[name^=holdwin_write_]')&&!document.querySelector('form[aria-busy=true]')&&!document.querySelector('[data-restock-control][aria-busy=true]'));await target.waitForFunction(()=>!document.querySelector('#modal').open);};
  const options=()=>page.locator('#restock-supply option[value^=supply-snack-]');
  const go=async(hash,target=page)=>{await target.evaluate(hash=>{location.hash=hash;},hash);await target.waitForFunction(hash=>document.body.dataset.view===hash,hash);};
  const snackWarehouse=async(target=page)=>{await go('products',target);await target.waitForSelector('[data-action=warehouse-kind]');await target.locator('[data-action=warehouse-kind][data-id=snack]').click();await target.waitForSelector('[data-supply-id]');};
  const openAdminSection=async(id,target=page)=>{const details=target.locator(id);if(!await details.evaluate(element=>element.open))await details.locator(':scope > summary').click();};
  const checkbox=(id,target=page)=>target.locator(`[data-restock-toggle][data-restock-kind=snack][data-restock-id="${id}"]`);
  const preference=id=>backend.ctx.restockPreferences_(backend.ss).find(entry=>entry.kind==='snack'&&entry.itemId===id)?.mode||'normal';
  const assertNoSnackExpiry=async(target=page)=>{
    assert.equal(await target.locator('[name=expiresOn],[data-action=supply-expiry-set],[data-action=supply-expiry-close],.expiry-badge,.supply-batches').count(),0,'snack UI neither requests expiry nor raises old batch expiry reminders');
  };
  await page.goto(`${base}/index.html#restock-snack`);await page.waitForSelector('#supply-restock-form[data-kind=snack]');
  assert.deepEqual(await page.locator('.restock-kind-tabs a').allTextContents(),['飲料','零食','泡麵','碳粉']);
  assert.deepEqual(await page.locator('[data-snack-category] option').allTextContents(),['全部分類',...categories]);
  assert.equal(await options().count(),4);assert.ok((await options().allTextContents()).every(text=>/尚未確認.*包/.test(text)));
  assert.match(await page.locator('[data-snack-selection]').innerText(),/太空包.*包/);await assertNoSnackExpiry();
  const originalDrinks=JSON.stringify(backend.sheets.Catalog.rows),initialReads=reads.length;
  await field('recorder').fill('虛構到貨者');await field('quantity').fill('3');
  await page.locator('[data-snack-query]').fill('多力');assert.equal(await options().count(),2);assert.equal(reads.length,initialReads,'search uses loaded metadata only');
  await page.locator('[data-snack-category]').selectOption('巧克力');assert.equal(await options().count(),0);assert.equal(await field('supplyId').inputValue(),'');
  assert.equal(await field('quantity').inputValue(),'3');assert.equal(await field('recorder').inputValue(),'虛構到貨者');assert.equal(posts.length,0,'typing/filtering cannot create a product');
  const name='虛構燕麥棒測試';await page.locator('[data-snack-query]').fill(name);await page.locator('[data-snack-category]').selectOption('');
  await page.locator('[data-action=snack-new]').click();assert.equal(await field('newName').inputValue(),name);assert.equal(await field('newCategory').inputValue(),'');
  assert.deepEqual(await field('newCategory').locator('option:not([value=""])').allTextContents(),categories);
  const beforeInvalid=posts.length;await form().locator('[type=submit]').click();assert.equal(posts.length,beforeInvalid,'new snacks still require a classification');
  await field('newCategory').selectOption('燕麥棒/餅');await field('newUnit').selectOption('條');
  await page.locator('[data-snack-query]').fill('另外查一下');await page.locator('[data-snack-category]').selectOption('巧克力');
  assert.equal(await field('newName').inputValue(),name);assert.equal(await field('newCategory').inputValue(),'燕麥棒/餅');assert.equal(await field('newUnit').inputValue(),'條');assert.equal(await field('quantity').inputValue(),'3');
  await form().evaluate(form=>{form.requestSubmit();form.requestSubmit();});await done();assert.equal(posts.filter(post=>post.operation==='new-arrival').length,1,'double submission creates one product and arrival');
  const created=backend.ctx.supplyCatalog_(backend.ss).find(item=>item.name===name);assert.equal(created.category,'燕麥棒/餅');assert.equal(created.unit,'條');
  const newInventory=backend.ctx.supplyInventory_(backend.ctx.supplyCatalog_(backend.ss),backend.ctx.supplyEvents_(backend.ss)).find(item=>item.id===created.id);assert.equal(newInventory.stock,null,'arrival never invents a zero baseline');
  assert.equal(await options().count(),5);await assertNoSnackExpiry();
  await page.locator('[data-snack-query]').fill(name);assert.equal(await options().count(),1);await field('supplyId').selectOption(created.id);
  await field('recorder').fill('虛構追加者');await field('quantity').fill('2');await form().locator('[type=submit]').click();await done();
  assert.equal(backend.ctx.supplyCatalog_(backend.ss).filter(item=>item.kind==='snack').length,5,'follow-up search reuses the same product');
  await page.locator('[data-snack-query]').fill(name);await page.locator('[data-action=snack-new]').click();await field('newCategory').selectOption('燕麥棒/餅');await field('newUnit').selectOption('條');await field('recorder').fill('虛構重名者');await field('quantity').fill('1');
  await form().locator('[type=submit]').click();await done();await page.waitForSelector('#toast.error');
  assert.equal(backend.ctx.supplyCatalog_(backend.ss).filter(item=>item.kind==='snack').length,5);assert.equal(await field('newName').inputValue(),name);assert.equal(await field('quantity').inputValue(),'1');assert.match(await page.locator('#toast').innerText(),/同名|已經有/);
  await field('newName').fill('虛構第二款巧克力');await field('newCategory').selectOption('巧克力');await field('newUnit').selectOption('顆');await form().locator('[type=submit]').click();await done();
  assert.equal(backend.ctx.supplyCatalog_(backend.ss).filter(item=>item.kind==='snack').length,6);
  await field('recorder').fill('還沒送出的草稿');let dialogs=0;page.on('dialog',dialog=>{dialogs++;dialog.dismiss();});
  await page.locator('.restock-kind-tabs a[href="#restock-noodle"]').click();await page.waitForFunction(()=>location.hash==='#restock-snack');assert.equal(await field('recorder').inputValue(),'還沒送出的草稿');assert.ok(dialogs>0);
  page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());await page.locator('.restock-kind-tabs a[href="#restock-noodle"]').click();await page.waitForSelector('#supply-restock-form[data-kind=noodle]');assert.equal(await page.locator('[name=expiresOn][required]').count(),1,'noodles retain mandatory expiry');
  await snackWarehouse();const row=id=>page.locator(`[data-supply-id="${id}"]`);assert.equal(await page.locator('[data-supply-id]').count(),6);assert.match(await row(created.id).innerText(),/燕麥棒\/餅/);await assertNoSnackExpiry();
  assert.deepEqual(await page.locator('[data-action=supply-stock-filter]').evaluateAll(buttons=>buttons.map(button=>button.dataset.id)),['low','empty','all']);assert.equal(await page.locator('[data-action=supply-stock-filter][data-id=all]').getAttribute('aria-pressed'),'true','snacks open with all quantities, including unknown');
  await page.locator('[data-action=supply-stock-filter][data-id=low]').click();assert.equal(await page.locator('[data-supply-id]').count(),0,'unknown quantities are excluded from one-through-ten browsing');await page.locator('[data-action=supply-stock-filter][data-id=all]').click();
  assert.equal(await page.locator('[data-restock-toggle][data-restock-kind=snack]').count(),6,'every active snack has an explicit manual choice, including unknown quantities');
  assert.match(await row('supply-snack-02').innerText(),/可以考慮補貨/);await checkbox('supply-snack-02').check();await done();assert.equal(preference('supply-snack-02'),'consider');
  const shared=await connect();await shared.page.goto(`${base}/index.html#products`);await shared.page.waitForSelector('[data-action=warehouse-kind]');await shared.page.locator('[data-action=warehouse-kind][data-id=snack]').click();assert.equal(await checkbox('supply-snack-02',shared.page).isChecked(),true,'manual flags are shared across browsers');
  await checkbox('supply-snack-02',shared.page).uncheck();await done(shared.page);assert.equal(preference('supply-snack-02'),'normal');
  await checkbox('supply-snack-02').uncheck();await done();assert.equal(await checkbox('supply-snack-02').isChecked(),true,'a rejected stale write restores the prior checkbox');assert.equal(preference('supply-snack-02'),'normal');assert.match(await page.locator('#toast').innerText(),/其他裝置|已更新/);
  if(width<=900&&await page.locator('#pantry-utilities').isHidden())await page.locator('.mobile-menu-toggle').click();
  await page.locator('#refresh-button').click();await page.waitForFunction(()=>!document.querySelector('#refresh-button').disabled);assert.equal(await checkbox('supply-snack-02').isChecked(),false);await checkbox('supply-snack-02').check();await done();assert.equal(preference('supply-snack-02'),'consider');
  // The unknown flag survives an arrival; zero and high quantities also allow explicit manual choices.
  await row('supply-snack-02').locator('[data-action=supply-arrival]').click();assert.equal(await page.locator('#supply-arrival-form [name=expiresOn]').count(),0);await page.locator('#supply-arrival-form [name=recorder]').fill('虛構未知庫存者');await page.locator('#supply-arrival-form [name=quantity]').fill('2');await page.locator('#supply-arrival-form [type=submit]').click();await done();assert.equal(await checkbox('supply-snack-02').isChecked(),true);
  await row('supply-snack-03').locator('[data-action=supply-count]').click();await page.locator('#supply-count-form [name=recorder]').fill('虛構零庫存盤點');await page.locator('#supply-count-form [data-supply-count]').fill('0');await page.locator('#supply-count-form [type=submit]').click();await done();assert.equal(await checkbox('supply-snack-03').isEnabled(),true);await checkbox('supply-snack-03').check();await done();assert.equal(preference('supply-snack-03'),'consider');await checkbox('supply-snack-03').uncheck();await done();assert.equal(preference('supply-snack-03'),'normal');
  await row(created.id).locator('[data-action=supply-count]').click();await page.locator('#supply-count-form [name=recorder]').fill('虛構盤點者');await page.locator('#supply-count-form [data-supply-count]').fill('25');await page.locator('#supply-count-form [type=submit]').click();await done();assert.equal(await checkbox(created.id).isEnabled(),true,'high stock does not disable the manual choice');
  await checkbox(created.id).check();await done();assert.equal(preference(created.id),'consider');
  const markedAt=backend.ctx.restockPreferences_(backend.ss).find(entry=>entry.kind==='snack'&&entry.itemId===created.id).updatedAt;
  await row(created.id).locator('[data-action=supply-arrival]').click();assert.equal(await page.locator('#supply-arrival-form [name=cases],[name=expiresOn]').count(),0);await page.locator('#supply-arrival-form [name=recorder]').fill('虛構高庫存補貨者');await page.locator('#supply-arrival-form [name=quantity]').fill('3');await page.locator('#supply-arrival-form [type=submit]').click();await done();assert.match(await row(created.id).locator('.stock-value').innerText(),/28.*條/s);assert.equal(await checkbox(created.id).isChecked(),true);
  await row(created.id).locator('[data-action=supply-count]').click();await page.locator('#supply-count-form [name=recorder]').fill('虛構再盤點者');await page.locator('#supply-count-form [data-supply-count]').fill('5');await page.locator('#supply-count-form [type=submit]').click();await done();assert.match(await row(created.id).locator('.stock-value').innerText(),/5.*條/s);assert.equal(await checkbox(created.id).isChecked(),true);assert.equal(await row(created.id).locator('.stock-value.low,.stock-value.warehouse-low').count(),0,'manual flags never paint quantity red');
  assert.equal(backend.ctx.restockPreferences_(backend.ss).find(entry=>entry.kind==='snack'&&entry.itemId===created.id).updatedAt,markedAt,'stock changes do not silently reset or re-mark a manual choice');
  const browseReads=reads.length,browsePosts=posts.length;await page.locator('[data-action=supply-stock-filter][data-id=low]').click();assert.deepEqual(await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId)),[created.id]);assert.equal(await row(created.id).locator('.stock-value.low,.stock-value.warehouse-low').count(),0,'browse ranges do not create red snack stock alerts');await page.locator('[data-action=supply-stock-filter][data-id=empty]').click();assert.deepEqual(await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId)),['supply-snack-03']);await page.locator('[data-action=supply-stock-filter][data-id=all]').click();assert.equal(reads.length,browseReads,'snack browse filters use loaded data');assert.equal(posts.length,browsePosts,'browse filters never write a manual flag');
  const ordered=await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId));assert.deepEqual(ordered.slice(0,2),['supply-snack-03',created.id],'zero then observed quantities precede pending items');await assertNoSnackExpiry();
  await page.reload();await page.waitForSelector('[data-action=warehouse-kind]');await page.locator('[data-action=warehouse-kind][data-id=snack]').click();assert.equal(await checkbox(created.id).isChecked(),true);assert.equal(await checkbox('supply-snack-02').isChecked(),true,'unknown quantity flag survives reload');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`/tmp/snacks-warehouse-${width}.png`,fullPage:true});
  await go('admin');await openAdminSection('#admin-snack-restock');await page.waitForSelector('#admin-snack-restock .admin-manual-snack-list');
  assert.deepEqual(await page.locator('[data-manual-snack-id]').evaluateAll(rows=>rows.map(row=>row.dataset.manualSnackId)),[created.id,'supply-snack-02']);assert.match(await page.locator('[data-manual-snack-id="supply-snack-02"]').innerText(),/尚未確認/);assert.doesNotMatch(await page.locator('#admin-low-stock').textContent(),new RegExp(name),'snacks remain separate from automatic low-stock warnings');
  await page.locator('#admin-snack-restock [data-action=open-snack-stock]').click();await page.waitForSelector(`[data-supply-id="${created.id}"]`);await checkbox(created.id).uncheck();await done();await go('admin');await openAdminSection('#admin-snack-restock');await page.waitForSelector('#admin-snack-restock .admin-manual-snack-list');await page.waitForSelector(`[data-manual-snack-id="${created.id}"]`,{state:'detached'});assert.equal(preference(created.id),'normal');assert.equal(preference('supply-snack-02'),'consider');
  await go('history');await page.waitForFunction(()=>document.querySelector('#main').textContent.includes('舊批次資料保留'));assert.match(await page.locator('#main').innerText(),/2001-01-01/);assert.equal(backend.sheets.SupplyHistory.rows.find(row=>row[0]==='historical-snack-date')[9],'2001-01-01','existing dated source rows remain intact');
  assert.ok(posts.filter(post=>post.operation==='new-arrival'&&post.data.kind==='snack'||post.operation==='supply-arrival').every(post=>post.data.expiresOn==null),'all current snack receipts are date-less');assert.equal(JSON.stringify(backend.sheets.Catalog.rows),originalDrinks);await shared.context.close();await context.close();
  for(const legacy of [true,'dated']){
    const old=await connect(legacy);await old.page.goto(`${base}/index.html#restock-snack`);await old.page.waitForSelector('.supply-upgrade');
    const activeButtons=await old.page.locator('#supply-restock-form button[type=submit]').evaluateAll(buttons=>buttons.filter(button=>!button.disabled&&!button.closest('fieldset[disabled]')).length);assert.equal(activeButtons,0,'old snack policy cannot submit date-less arrivals');assert.match(await old.page.locator('.supply-upgrade').innerText(),/零食/);await old.context.close();
  }
  const noManual=await connect('manual');await noManual.page.goto(`${base}/index.html#products`);await noManual.page.waitForSelector('[data-action=warehouse-kind]');await noManual.page.locator('[data-action=warehouse-kind][data-id=snack]').click();assert.ok(await checkbox('supply-snack-02',noManual.page).evaluate(element=>element.disabled),'manual flags require their explicit deployment capability');await noManual.context.close();
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: date-less snack arrivals/new items, seven-category local search, preserved drafts/duplicates, no snack expiry UI, separate positive/zero browse ranges, unknown/high shared manual flags, stale restore, flags retained until uncheck, separate admin list, dated history retained and old policy gates`);
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
