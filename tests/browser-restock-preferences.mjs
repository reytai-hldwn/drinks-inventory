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
  assert.deepEqual(await page.locator('[data-stock-drink-id]').evaluateAll(rows=>rows.map(row=>row.dataset.stockDrinkId)),['zero','few','ten','high','unknown']);
  assert.equal(await page.locator('.warehouse-low').count(),0,'no numeric threshold creates a red quantity');
  for(const id of ['high','unknown'])assert.equal(await row(id).locator('[data-restock-toggle]').count(),1);
  await row('high').locator('[data-restock-toggle]').check();await done();assert.equal(await page.locator('[data-stock-drink-id]').first().getAttribute('data-stock-drink-id'),'high');assert.equal(await row('high').locator('.warehouse-low').count(),1);
  await row('zero').locator('[data-restock-toggle]').check();await done();assert.deepEqual(await page.locator('[data-stock-drink-id]').evaluateAll(rows=>rows.map(row=>row.dataset.stockDrinkId)),['zero','high','few','ten','unknown']);
  await page.locator('[data-action=copy-low]').click();assert.match(await page.evaluate(()=>window.__copiedRestock),/測試大量/);assert.match(await page.evaluate(()=>window.__copiedRestock),/測試用完/);assert.doesNotMatch(await page.evaluate(()=>window.__copiedRestock),/測試少量/);
  await page.locator('[data-filter=low]').click();assert.deepEqual(await page.locator('[data-stock-drink-id]').evaluateAll(rows=>rows.map(row=>row.dataset.stockDrinkId)),['few','ten']);assert.equal(await page.locator('[data-filter=low]').textContent(),'庫存量少');
  await page.locator('[data-filter=empty]').click();assert.deepEqual(await page.locator('[data-stock-drink-id]').evaluateAll(rows=>rows.map(row=>row.dataset.stockDrinkId)),['zero']);
  await row('zero').locator('[data-restock-toggle]').uncheck();await done();assert.equal(await row('zero').locator('.warehouse-low').count(),0);
  await page.locator('[data-filter=all]').click();rejectNext=true;await row('few').locator('[data-restock-toggle]').check();await done();assert.equal(await row('few').locator('[data-restock-toggle]').isChecked(),false);assert.equal(await row('few').locator('.warehouse-low').count(),0);
  const shared=await connect();await shared.page.goto(`${base}/index.html#products`);await shared.page.waitForSelector('[data-stock-drink-id=high]');assert.equal(await shared.page.locator('[data-stock-drink-id=high] [data-restock-toggle]').isChecked(),true);assert.equal(await shared.page.locator('[data-stock-drink-id=high] .warehouse-low').count(),1);await shared.context.close();
  await page.locator('[data-action=warehouse-kind][data-id=noodle]').click();await page.locator('[data-action=supply-stock-filter][data-id=low]').click();assert.deepEqual(await page.locator('[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.supplyId)),['supply-noodle-01','supply-noodle-04']);assert.match(await supply('supply-noodle-01').innerText(),/已到期/);
  await supply('supply-noodle-04').locator('[data-restock-toggle]').check();await done();assert.equal(await supply('supply-noodle-04').locator('.warehouse-low').count(),1,'manual flags do not require the old automatic threshold');
  await page.locator('[data-action=warehouse-kind][data-id=toner]').click();await supply('supply-toner-black').locator('[data-restock-toggle]').check();await done();assert.equal(await page.locator('[data-supply-id]').first().getAttribute('data-supply-id'),'supply-toner-black');assert.equal(await page.locator('[data-action=supply-stock-filter][data-id=empty]').count(),0);
  assert.equal(sources(),before,'manual choices do not alter quantities, expiry history or source catalogs');
  const old=await connect(true);await old.page.goto(`${base}/index.html#products`);await old.page.waitForSelector('[data-restock-toggle]');assert.equal(await old.page.locator('[data-restock-toggle]').first().evaluate(element=>element.disabled),true);await old.context.close();
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: manual flags, red quantities, priority sorting, shared readers, flagged-only copy, quantity browse ranges, preserved expiry, rejected-write rollback and old-deployment gates`);await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
