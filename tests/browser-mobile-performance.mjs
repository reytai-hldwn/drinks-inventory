// Browser integration: simulated Google reads only; no owner data or writes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
import {createCompanyData} from '../js/catalog.js';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.avif':'image/avif','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
    if(!/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name))throw new Error('not found');
    const path=resolve(root,name);if(!path.startsWith(root.replace(/\/$/,'')+sep))throw new Error('not found');
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
  }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/TEST_MOBILE/exec';
const browser=await chromium.launch({executablePath:process.env.PANTRY_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
  const backend=websiteBackend(),drinks=createCompanyData().drinks;
  backend.sheets.Catalog.rows.splice(1,99,...drinks.map(d=>[d.id,d.name,d.category,d.packaging,d.unit,d.perCase,d.threshold,d.active]));
  const at=days=>new Date(Date.now()-days*86400000).toISOString();
  backend.sheets.History.rows.splice(1,99,
    ['first',at(14),'count',drinks[0].id,drinks[0].name,20,'','測試','採計'],
    ['arrival',at(12),'restock',drinks[0].id,drinks[0].name,24,'','測試','採計'],
    ['second',at(7),'count',drinks[0].id,drinks[0].name,12,'','測試','採計'],
    ['other-first',at(14),'count',drinks[1].id,drinks[1].name,40,'','測試','採計'],
    ['other-second',at(7),'count',drinks[1].id,drinks[1].name,20,'','測試','採計']);
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),requests=[],reads=[],errors=[];
  page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
  const deferred=()=>{let release,begin;return{wait:new Promise(resolve=>{release=resolve;}),started:new Promise(resolve=>{begin=resolve;}),release:()=>release(),begin:()=>begin()};};
  const stats=deferred();let publicGate;
  await page.route(`${endpoint}**`,async route=>{
    assert.equal(route.request().method(),'GET');const parameter=Object.fromEntries(new URL(route.request().url()).searchParams);reads.push(parameter.action);
    if(parameter.action==='popularity'){stats.begin();await stats.wait;}
    if(parameter.action==='public'&&publicGate){const gate=publicGate;publicGate=null;gate.begin();await gate.wait;}
    await route.fulfill({contentType:'application/javascript',body:backend.ctx.doGet({parameter}).body});
  });
  await page.goto(`${base}/index.html`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.pantry-stage');await page.evaluate(()=>document.fonts.ready);
  assert.deepEqual(reads,['public']);
  assert.ok(requests.every(url=>!url.includes('/assets/display/')&&!url.includes('pantry-office-')&&!url.includes('pantry-scene-approved.png')&&!url.includes('holdwin-mark.png')&&!url.includes('pantry-hand-complete')),'closed mobile view avoids drink originals, desktop scenes, full board/logo/font');
  await page.locator('.fridge-door').click();await page.waitForSelector('.fridge.is-ready');await stats.started;
  assert.equal(await page.locator('.fridge-product').count(),32);assert.match(await page.locator('.fridge-popularity').innerText(),/正在整理/);
  await page.locator('#search').fill('光泉牛乳');assert.equal(await page.locator('.fridge-product').count(),1);
  await page.locator('#navigation [data-view=archive]').click();await page.waitForSelector('.archive-card');stats.release();
  await page.waitForTimeout(200);assert.equal(await page.locator('.archive-card').count(),8,'late stats never change the route');
  await page.locator('#navigation [data-view=overview]').click();await page.waitForSelector('.popular-drink');
  const cards=page.locator('.popular-drink');assert.equal(await cards.count(),2);
  assert.match(await cards.first().innerText(),/32.*包／工作週/s);assert.match(await cards.nth(1).innerText(),/20.*包／工作週/s);
  assert.equal(reads.filter(action=>action==='popularity').length,1,'reopening uses cached aggregate stats');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'/tmp/pantry-mobile-popularity.png',fullPage:true});
  await cards.first().click();await page.waitForSelector('#modal[open]');assert.match(await page.locator('#modal').innerText(),/光泉牛乳/);await page.locator('#modal [data-action=close-modal]').first().click();

  const gate=deferred();publicGate=gate;
  const start=Date.now();await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.pantry-stage');await gate.started;
  assert.ok(Date.now()-start<2000,'warm view appears while Google is still held');
  assert.match(await page.locator('#connection-status').innerText(),/上次讀取/);
  await page.locator('#navigation [data-view=wishes]').click();await page.waitForSelector('[data-action=new-wish]');
  await page.locator('[data-action=new-wish]').first().click();await page.locator('#wish-form [name=name]').fill('尚未送出的願望');gate.release();
  await page.waitForTimeout(300);assert.equal(await page.locator('#wish-form [name=name]').inputValue(),'尚未送出的願望');
  assert.deepEqual(errors,[]);
  console.log('PASS mobile: no closed-door photo downloads, nonblocking measured weekly ranking, safe late responses, warm start before Google, preserved draft.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
