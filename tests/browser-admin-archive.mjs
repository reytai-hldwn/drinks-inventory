import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.avif':'image/avif'};
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html',path=resolve(root,name);if(!path.startsWith(root.replace(/\/$/,'')+sep)||!/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name))throw new Error('missing');res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/TEST_ADMIN_ARCHIVE/exec';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{for(const width of [1440,390]){
  const b=websiteBackend(),context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],reads=[],posts=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  let release,started;const gate=new Promise(resolve=>{release=resolve;}),began=new Promise(resolve=>{started=resolve;});let hold=true;
  await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
  await page.route(`${endpoint}**`,async route=>{
    if(route.request().method()==='POST'){const parameter=Object.fromEntries(new URLSearchParams(route.request().postData()));posts.push(JSON.parse(parameter.payload));await route.fulfill({contentType:'text/html',body:b.ctx.doPost({parameter}).body});}
    else{const parameter=Object.fromEntries(new URL(route.request().url()).searchParams);reads.push(parameter.action);if(parameter.action==='admin'&&hold){started();await gate;hold=false;}await route.fulfill({contentType:'application/javascript',body:b.ctx.doGet({parameter}).body});}
  });
  const beganAt=Date.now();await page.goto(`${base}/index.html#admin`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.admin-grid');await began;
  assert.ok(Date.now()-beganAt<3000);assert.deepEqual(reads,['admin'],'entry does not request full warehouse history');
  assert.match(await page.locator('#admin-low-stock').innerText(),/正在整理/);assert.equal(await page.locator('.admin-card').count(),5);
  release();await page.waitForSelector('.admin-low-list');assert.match(await page.locator('.admin-low-list').innerText(),/牛乳.*9/s);assert.equal(await page.locator('.admin-low-list .needs-restock').count(),1);
  await page.locator('.admin-low-heading a').click();await page.waitForSelector('[data-stock-drink-id]');
  assert.deepEqual(await page.locator('[data-filter]').allTextContents(),['10 以內','供應中','歷史品項']);assert.equal(await page.locator('[data-filter=low]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-stock-drink-id]').count(),1);
  await page.locator('[data-stock-drink-id=milk] [data-restock-toggle]').check();await page.waitForFunction(()=>!document.querySelector('[data-stock-drink-id=milk] [data-restock-toggle]').disabled);
  const reason=page.locator('[data-stock-drink-id=milk] .restock-reason-button');assert.equal(await reason.innerText(),'非長青品項，可以換成新品試試看！');assert.ok(await reason.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))<await page.locator('.restock-toggle').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)));
  await page.evaluate(()=>{location.hash='admin';});await page.waitForSelector('.admin-low-list .is-paused');assert.equal(await page.locator('.admin-low-list .needs-restock').count(),0);assert.match(await page.locator('.admin-low-list .is-paused').innerText(),/暫不需要補貨/);
  await page.evaluate(()=>{location.hash='archive';});await page.waitForSelector('[data-action=archive-wish]');const archiveButton=page.locator('[data-action=archive-wish]');assert.match(await archiveButton.innerText(),/我還想喝，希望有機會可以再買/);
  await archiveButton.click();await page.locator('#archive-wish-form [name=voterName]').fill('Rey');await page.locator('#archive-wish-form [type=submit]').click();await page.waitForSelector('[data-action=archive-wish].is-voted');assert.equal(posts.filter(command=>command.operation==='archive-wish').length,1);assert.equal(b.sheets.WishReview.rows.length,2);assert.equal(b.sheets.WishVotes.rows.length,2);
  assert.match(await page.locator('.archive-wish-actions').innerText(),/1 人還想喝/);await page.locator('.archive-wish-actions [data-action=view-wish-supporters]').click();assert.match(await page.locator('.wish-supporter-list').innerText(),/Rey/);await page.locator('#modal [data-action=close-modal]').first().click();
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-action=archive-wish].is-voted');await page.evaluate(()=>{location.hash='wishes';});await page.waitForSelector('.wish-card');assert.match(await page.locator('.wish-card').innerText(),/舊飲料.*我還想喝/s);
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`/tmp/pantry-admin-archive-${width}.png`,fullPage:true});
  console.log(`PASS ${width}: immediate admin entry, compact low-stock summary, low-first tabs, small replacement text, paused neutral quantities, shared archived return wishes, named supporters and one browser one vote`);await context.close();
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
