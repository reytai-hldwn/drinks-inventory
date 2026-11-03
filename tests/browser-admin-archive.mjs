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
  b.sheets.Catalog.rows.push(['empty','虛構已用完飲料','茶飲','鋁箔包','包',24,10,true]);b.sheets.History.rows.push(['baseline-empty','2020-01-01T00:00:00Z','count','empty','虛構已用完飲料',0,'','虛構盤點者','採計']);
  b.send('supply-stocktake',{entries:[{supplyId:'supply-noodle-01',quantity:1},{supplyId:'supply-noodle-02',quantity:0},{supplyId:'supply-snack-01',quantity:0},{supplyId:'supply-toner-black',quantity:0}],recorder:'虛構用品盤點者'});
  const supplyName=id=>b.ctx.supplyCatalog_(b.ss).find(item=>item.id===id).name,emptyNames=['虛構已用完飲料',supplyName('supply-snack-01'),supplyName('supply-noodle-02')];
  const openSection=async id=>{const details=page.locator(id);if(!await details.evaluate(element=>element.open))await details.locator(':scope > summary').click();};
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  let release,started;const gate=new Promise(resolve=>{release=resolve;}),began=new Promise(resolve=>{started=resolve;});let hold=true;
  await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
  await page.route(`${endpoint}**`,async route=>{
    if(route.request().method()==='POST'){const parameter=Object.fromEntries(new URLSearchParams(route.request().postData()));posts.push(JSON.parse(parameter.payload));await route.fulfill({contentType:'text/html',body:b.ctx.doPost({parameter}).body});}
    else{const parameter=Object.fromEntries(new URL(route.request().url()).searchParams);reads.push(parameter.action);if(parameter.action==='admin'&&hold){started();await gate;hold=false;}await route.fulfill({contentType:'application/javascript',body:b.ctx.doGet({parameter}).body});}
  });
  const beganAt=Date.now();await page.goto(`${base}/index.html#admin`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.admin-grid');await began;
  assert.ok(Date.now()-beganAt<3000);assert.deepEqual(reads,['admin'],'entry does not request full warehouse history');
  const sections=['#admin-low-stock','#admin-empty-stock','#admin-snack-restock'];
  assert.deepEqual(await page.locator(sections.join(',')).evaluateAll(elements=>elements.map(element=>({tag:element.tagName,open:element.open}))),sections.map(()=>({tag:'DETAILS',open:false})),'admin lists start collapsed');
  assert.match(await page.locator('#admin-low-stock').textContent(),/正在整理/);assert.equal(await page.locator('.admin-card').count(),5);
  await page.locator('#admin-low-stock > summary').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#admin-low-stock').open);
  await page.locator('#admin-empty-stock > summary').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#admin-empty-stock').open);
  await page.evaluate(()=>{window.__adminDetails=[...document.querySelectorAll('.admin-disclosure')];window.__adminSummary=document.activeElement;});
  release();await page.waitForSelector('#admin-low-stock .admin-low-list');
  assert.equal(await page.evaluate(()=>window.__adminDetails.every(element=>element===document.getElementById(element.id))&&document.activeElement===window.__adminSummary),true,'async summary keeps disclosure nodes and keyboard focus');
  assert.deepEqual(await page.locator(sections.join(',')).evaluateAll(elements=>elements.map(element=>element.open)),[true,true,false],'async summary preserves the chosen disclosure states');
  assert.match(await page.locator('#admin-low-stock .admin-low-list').innerText(),/牛乳.*9/s);assert.equal(await page.locator('#admin-low-stock .needs-restock').count(),3);
  assert.match(await page.locator('#admin-low-stock .admin-low-list').innerText(),new RegExp(supplyName('supply-toner-black')),'zero toner stays in low reminders');
  for(const name of emptyNames){assert.ok((await page.locator('#admin-empty-stock .admin-low-list').innerText()).includes(name));assert.ok(!(await page.locator('#admin-low-stock .admin-low-list').innerText()).includes(name),'zero drinks, snacks and noodles remain separate');}
  assert.deepEqual(await page.locator('#admin-empty-stock [data-action=open-empty-stock][data-id]').evaluateAll(links=>links.map(link=>link.dataset.id)),['drink','snack','noodle']);
  assert.equal(await page.locator('#admin-empty-stock [data-admin-summary-count]').innerText(),'3 種');
  await page.locator('#admin-empty-stock > summary').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('#admin-empty-stock').open);

  await page.locator('#admin-low-stock .admin-low-heading a').click();await page.waitForSelector('[data-stock-drink-id]');
  assert.deepEqual(await page.locator('[data-filter]').evaluateAll(buttons=>buttons.map(button=>button.dataset.filter)),['low','empty','all','archived']);assert.equal(await page.locator('[data-filter=low]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-stock-drink-id]').count(),1);
  await page.locator('[data-stock-drink-id=milk] [data-restock-toggle]').check();await page.waitForFunction(()=>!document.querySelector('[data-stock-drink-id=milk] [data-restock-toggle]').disabled);
  const reason=page.locator('[data-stock-drink-id=milk] .restock-reason-button');assert.equal(await reason.innerText(),'非長青品項，可以換成新品試試看！');assert.ok(await reason.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))<await page.locator('.restock-toggle').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)));
  await page.evaluate(()=>{location.hash='admin';});await page.waitForSelector('#admin-low-stock');await openSection('#admin-low-stock');await page.waitForSelector('#admin-low-stock .is-paused');assert.equal(await page.locator('#admin-low-stock .needs-restock').count(),2);assert.match(await page.locator('#admin-low-stock .is-paused').innerText(),/暫不需要補貨/);
  for(const [kind,id] of [['drink','empty'],['snack','supply-snack-01'],['noodle','supply-noodle-02']]){
    if(kind!=='drink'){
      await page.evaluate(()=>{location.hash='products';});await page.waitForSelector('[data-action=warehouse-kind]');await page.locator(`[data-action=warehouse-kind][data-id=${kind}]`).click();
      await page.locator('#supply-search').fill('虛構搜尋沒有相符品項');await page.waitForFunction(()=>!document.querySelector('[data-supply-id]'));
      await page.evaluate(()=>{location.hash='admin';});await page.waitForSelector('#admin-empty-stock');
    }
    await openSection('#admin-empty-stock');await page.locator(`#admin-empty-stock [data-action=open-empty-stock][data-id=${kind}]`).click();await page.waitForFunction(()=>document.body.dataset.view==='products');
    assert.equal(await page.locator(`[data-action=warehouse-kind][data-id=${kind}]`).getAttribute('aria-pressed'),'true');assert.equal(await page.locator(kind==='drink'?'[data-filter=empty]':'[data-action=supply-stock-filter][data-id=empty]').getAttribute('aria-pressed'),'true');assert.deepEqual(await page.locator(kind==='drink'?'[data-stock-drink-id]':'[data-supply-id]').evaluateAll(rows=>rows.map(row=>row.dataset.stockDrinkId||row.dataset.supplyId)),[id]);
    if(kind!=='drink')assert.equal(await page.locator('#supply-search').inputValue(),'','empty-stock drilldown clears an earlier nonmatching supply search');
    await page.evaluate(()=>{location.hash='admin';});await page.waitForSelector('#admin-empty-stock');
  }
  await page.evaluate(()=>{location.hash='archive';});await page.waitForSelector('[data-action=archive-wish]');const archiveButton=page.locator('[data-action=archive-wish]');assert.match(await archiveButton.innerText(),/我還想喝，希望有機會可以再買/);
  await archiveButton.click();await page.locator('#archive-wish-form [name=voterName]').fill('Rey');await page.locator('#archive-wish-form [type=submit]').click();await page.waitForSelector('[data-action=archive-wish].is-voted');assert.equal(posts.filter(command=>command.operation==='archive-wish').length,1);assert.equal(b.sheets.WishReview.rows.length,2);assert.equal(b.sheets.WishVotes.rows.length,2);
  assert.match(await page.locator('.archive-wish-actions').innerText(),/1 人還想喝/);await page.locator('.archive-wish-actions [data-action=view-wish-supporters]').click();assert.match(await page.locator('.wish-supporter-list').innerText(),/Rey/);await page.locator('#modal [data-action=close-modal]').first().click();
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-action=archive-wish].is-voted');await page.evaluate(()=>{location.hash='wishes';});await page.waitForSelector('.wish-card');assert.match(await page.locator('.wish-card').innerText(),/舊飲料.*我還想喝/s);
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`/tmp/pantry-admin-archive-${width}.png`,fullPage:true});
  console.log(`PASS ${width}: immediate admin entry, collapsed keyboard-accessible summaries with async state persistence, separate zero-stock lists and category drilldowns that clear stale searches, low-first tabs, small replacement text, paused neutral quantities, shared archived return wishes, named supporters and one browser one vote`);await context.close();
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
