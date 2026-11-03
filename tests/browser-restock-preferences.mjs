import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html',path=resolve(root,name);if(!path.startsWith(root)||!(/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name)))throw new Error('not found');res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/RESTOCK_PREF_TEST/exec';
const browser=await chromium.launch({executablePath:process.env.PANTRY_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const backend=websiteBackend(),posts=[],errors=[];let rejectNext=false;
  const drinks=[['high','測試大量',20],['few','測試少量',3],['unknown','測試待盤點',null],['zero','測試用完',0],['ten','測試十個',10]];
  backend.sheets.Catalog.rows.splice(1,99,...drinks.map(([id,name])=>[id,name,'茶飲','鋁箔包','包',24,10,true]));
  backend.sheets.History.rows.splice(1,99,...drinks.filter(([, ,stock])=>stock!==null).map(([id,name,stock])=>[`baseline-${id}`,'2020-01-01T00:00:00Z','count',id,name,stock,'','盤點','採計']));
  backend.send('supply-stocktake',{entries:[{supplyId:'supply-noodle-01',quantity:0},{supplyId:'supply-noodle-02',quantity:0},{supplyId:'supply-noodle-03',quantity:15},{supplyId:'supply-noodle-04',quantity:3},{supplyId:'supply-noodle-05',quantity:4},{supplyId:'supply-toner-black',quantity:8},{supplyId:'supply-toner-yellow',quantity:0},{supplyId:'supply-toner-red',quantity:20}],recorder:'用品盤點'});
  backend.send('supply-arrival',{supplyId:'supply-noodle-01',quantity:1,expiresOn:'2099-12-31',recorder:'用品到貨'});
  backend.sheets.SupplyHistory.rows.find(row=>row[2]==='restock')[9]='2000-01-01';
  const sources=()=>JSON.stringify({catalog:backend.sheets.Catalog.rows,history:backend.sheets.History.rows,supplyCatalog:backend.sheets.SupplyCatalog.rows,supplyHistory:backend.sheets.SupplyHistory.rows}),before=sources();
  const connect=async(legacy=false)=>{
   const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await context.newPage();
   page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copiedRestock=text;}}});});
   await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
   await page.route(`${endpoint}**`,async route=>{
    const request=route.request();
    if(request.method()==='POST'){
     const parameter=Object.fromEntries(new URLSearchParams(request.postData())),command=JSON.parse(parameter.payload);posts.push(command);
     if(rejectNext){rejectNext=false;command.data.mode='invalid';parameter.payload=JSON.stringify(command);}
     await new Promise(resolve=>setTimeout(resolve,100));return route.fulfill({contentType:'text/html',body:backend.ctx.doPost({parameter}).body});
    }
    const parameter=Object.fromEntries(new URL(request.url()).searchParams);let body=backend.ctx.doGet({parameter}).body;
    if(legacy)body=body.replace(/"restockPreferenceEntry":\{[^}]*\}/,'"restockPreferenceEntry":{}');
    return route.fulfill({contentType:'application/javascript',body});
   });return{context,page};
  };
  const {page,context}=await connect(),done=async()=>{await page.waitForFunction(()=>!document.querySelector('iframe[name^=holdwin_write_]')&&!document.querySelector('[data-restock-control][aria-busy=true]'));};
  const row=id=>page.locator(`[data-stock-drink-id=${id}]`),supply=id=>page.locator(`[data-supply-id=${id}]`);
  await page.goto(`${base}/index.html#products`);await page.waitForSelector('[data-stock-drink-id]');
  await page.locator('[data-filter=all]').click();
  assert.deepEqual(await page.locator('[data-stock-drink-id]').evaluateAll(rows=>rows.map(row=>row.dataset.stockDrinkId)),['zero','few','ten','high','unknown']);
  assert.equal(await row('high').locator('[data-restock-toggle]').count(),0);assert.equal(await row('unknown').locator('[data-restock-toggle]').count(),0);
  await page.locator('[data-filter=low]').click();assert.deepEqual(await page.locator('[data-stock-drink-id]').evaluateAll(rows=>rows.map(row=>row.dataset.stockDrinkId)),['few','ten'],'drink browse range is one through ten');
  await page.locator('[data-filter=empty]').click();assert.deepEqual(await page.locator('[data-stock-drink-id]').evaluateAll(rows=>rows.map(row=>row.dataset.stockDrinkId)),['zero'],'zero stock has its own browse range');
  const redBefore=await row('zero').locator('.stock-value').evaluate(element=>getComputedStyle(element).color);
  await row('zero').locator('[data-restock-toggle]').evaluate(input=>{input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));});await done();
  assert.equal(posts.length,1,'a second change during saving cannot duplicate a preference');assert.equal(posts[0].operation,'restock-preference');
  assert.equal(await row('zero').locator('[data-restock-toggle]').isChecked(),true);assert.equal(await row('zero').locator('.warehouse-low').count(),0);
  assert.notEqual(await row('zero').locator('.stock-value').evaluate(element=>getComputedStyle(element).color),redBefore);
  assert.equal(await page.locator('[data-stock-drink-id]').count(),1,'held item remains in the zero-stock list');
  assert.match(await row('zero').innerText(),/暫不需要補貨/);assert.match(await page.locator('.admin-summary').innerText(),/2 種需要確認補貨/);
  await page.locator('[data-action=copy-low]').click();assert.equal(await page.evaluate(()=>window.__copiedRestock),undefined,'paused zero stock is excluded from the current view copy');assert.match(await page.locator('#toast').innerText(),/沒有需要列入補貨清單/);
  await page.locator('[data-filter=low]').click();await page.locator('[data-action=copy-low]').click();assert.match(await page.evaluate(()=>window.__copiedRestock),/測試少量/);assert.match(await page.evaluate(()=>window.__copiedRestock),/測試十個/);assert.doesNotMatch(await page.evaluate(()=>window.__copiedRestock),/測試用完/);await page.locator('[data-filter=empty]').click();
  await row('zero').locator('[data-restock-mode=replace]').click();await done();assert.match(await row('zero').innerText(),/可以準備替換新品項/);assert.equal(await row('zero').locator('.warehouse-low').count(),0);
  const second=await connect();await second.page.goto(`${base}/index.html#products`);await second.page.waitForSelector('[data-stock-drink-id]');await second.page.locator('[data-filter=empty]').click();assert.equal(await second.page.locator('[data-stock-drink-id=zero] [data-restock-toggle]').isChecked(),true);assert.match(await second.page.locator('[data-stock-drink-id=zero]').innerText(),/可以準備替換新品項/);await second.context.close();
  await page.screenshot({path:`/tmp/restock-preferences-drinks-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await row('zero').locator('[data-restock-toggle]').uncheck();await done();assert.equal(await row('zero').locator('.warehouse-low').count(),1);
  await page.locator('[data-filter=low]').click();rejectNext=true;await row('few').locator('[data-restock-toggle]').check();await done();assert.equal(await row('few').locator('[data-restock-toggle]').isChecked(),false);assert.equal(await row('few').locator('.warehouse-low').count(),1);assert.match(await page.locator('#toast').innerText(),/設定不正確/);
  await page.locator('[data-action=warehouse-kind][data-id=noodle]').click();await page.locator('[data-action=supply-stock-filter][data-id=all]').click();
  assert.deepEqual((await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId))).slice(0,5),['supply-noodle-02','supply-noodle-01','supply-noodle-04','supply-noodle-05','supply-noodle-03']);
  await page.locator('[data-action=supply-stock-filter][data-id=empty]').click();assert.deepEqual(await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId)),['supply-noodle-02']);
  await page.locator('[data-action=supply-stock-filter][data-id=low]').click();assert.deepEqual(await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId)),['supply-noodle-01','supply-noodle-04'],'noodle browse range is one through three');assert.equal(await supply('supply-noodle-04').locator('[data-restock-toggle]').count(),0,'three remaining does not trigger the one-item reminder');
  await supply('supply-noodle-01').locator('[data-restock-toggle]').check();await done();assert.equal(await page.locator('[data-supply-id]').count(),2);assert.ok(await supply('supply-noodle-01').locator('.expiry-expired').count()>0,'stock preference never suppresses expiry');
  await page.screenshot({path:`/tmp/restock-preferences-noodles-${width}.png`,fullPage:true});
  await page.locator('[data-action=warehouse-kind][data-id=toner]').click();await page.locator('[data-action=supply-stock-filter][data-id=all]').click();assert.deepEqual(await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId)),['supply-toner-yellow','supply-toner-black','supply-toner-red','supply-toner-blue']);
  assert.equal(await supply('supply-toner-black').locator('[data-restock-toggle]').count(),0,'positive toner stock does not trigger a reminder');assert.equal(await page.locator('[data-action=supply-stock-filter][data-id=empty]').count(),0,'toner has one zero-stock view');
  await page.locator('[data-action=supply-stock-filter][data-id=low]').click();assert.deepEqual(await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId)),['supply-toner-yellow']);await supply('supply-toner-yellow').locator('[data-restock-toggle]').check();await done();assert.equal(await page.locator('[data-supply-id]').count(),1);
  await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.__exportedInventory=blob.text();return original(blob);};HTMLAnchorElement.prototype.click=function(){};});await page.locator('[data-action=export]').click();const csv=await page.evaluate(async()=>await window.__exportedInventory);assert.match(csv,/補貨標示/);assert.match(csv,/暫不需要補貨/);assert.ok(csv.indexOf('黃色碳粉')<csv.indexOf('黑色碳粉'));
  assert.equal(sources(),before,'preference toggles never alter quantities, expiry or registration history');
  const legacy=await connect(true);await legacy.page.goto(`${base}/index.html#products`);await legacy.page.waitForSelector('[data-stock-drink-id]');await legacy.page.locator('[data-filter=empty]').click();assert.equal(await legacy.page.locator('[data-stock-drink-id=zero] [data-restock-toggle]').evaluate(input=>input.disabled),true);assert.equal(await legacy.page.locator('.restock-preference-upgrade').count(),1);await legacy.context.close();
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: all inventory sorted, hold/replace/restore shared across readers, separate positive/zero browse ranges, kind-specific reminder thresholds, neutral stock, copy exclusion, expiry preserved, rejected writes restored and CSV sorted.`);await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
