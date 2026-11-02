// Optional browser integration: PANTRY_PLAYWRIGHT_MODULE can point to an
// installed playwright-core module. Every Google request uses the in-memory
// Apps Script harness; this never submits data to a real spreadsheet.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE || 'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
    const path=resolve(root,name);
    if(!path.startsWith(root)||!(/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name)))throw new Error('not found');
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
  }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const endpoint='https://script.google.com/macros/s/TEST_WEBSITE/exec';
const browser=await chromium.launch({executablePath:process.env.PANTRY_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
  for(const width of [1440,390]){
    const backend=websiteBackend();
    backend.sheets.Catalog.rows[1][1]='麥萃麥茶';backend.sheets.Catalog.rows[2][1]='光泉牛乳';
    const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[],posts=[];let popups=0,googleForms=0;
    page.on('pageerror',error=>errors.push(error.message));page.on('popup',()=>{popups++;});
    await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
    await page.route('https://docs.google.com/forms/**',route=>{googleForms++;return route.fulfill({status:503,body:'Unexpected external form'});});
    await page.route(`${endpoint}**`,async route=>{
      const request=route.request();
      if(request.method()==='POST'){
        const parameter=Object.fromEntries(new URLSearchParams(request.postData()));
        posts.push(JSON.parse(parameter.payload));await new Promise(resolve=>setTimeout(resolve,200));
        const output=backend.ctx.doPost({parameter});await route.fulfill({contentType:'text/html',body:output.body});
      }else{
        const parameter=Object.fromEntries(new URL(request.url()).searchParams);
        const output=backend.ctx.doGet({parameter});await route.fulfill({contentType:'application/javascript',body:output.body});
      }
    });
    const go=async view=>{await page.evaluate(value=>{location.hash=value;},view);await page.waitForFunction(expected=>document.body.dataset.view===expected,view);};
    const done=async()=>{await page.waitForFunction(()=>document.querySelectorAll('iframe[name^="holdwin_write_"]').length===0);await page.waitForFunction(()=>!document.querySelector('form[aria-busy="true"]'));};
    await page.goto(`${base}/index.html#count`);await page.waitForSelector('#count-form');
    await page.locator('#count-form [name="recorder"]').fill('網頁測試');await page.locator('#count-form [name="tea"]').fill('0');
    await page.locator('#count-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
    await page.waitForSelector('.form-save-status');assert.equal(posts.filter(p=>p.operation==='stocktake').length,1);
    await done();assert.equal(backend.inventory()[0].stock,0);assert.equal(backend.inventory()[1].stock,9);
    assert.deepEqual(posts[0].data.entries,[{drinkId:'tea',quantity:0}]);
    await go('restock');await page.waitForSelector('#restock-form');
    for(const [cases,loose,total] of [['','3',3],['1','',27],['1','2',53]]){
      await page.locator('#restock-form [name="recorder"]').fill('網頁測試');await page.locator('#restock-drink').selectOption('tea');
      await page.locator('#restock-form [name="cases"]').fill(cases);await page.locator('#restock-form [name="loose"]').fill(loose);
      await page.locator('#restock-submit').click();await done();assert.equal(backend.inventory()[0].stock,total);
    }
    await go('wishes');await page.waitForSelector('[data-action="new-wish"]');await page.locator('[data-action="new-wish"]').first().click();
    assert.equal(await page.locator('#wish-form [name="recorder"], #wish-form [name="voterName"]').count(),0);
    await page.locator('#wish-form [name="kind"]').selectOption('snack');await page.locator('#wish-form [name="name"]').fill('網站原生測試餅乾');
    await page.locator('#wish-form [type="submit"]').click();await done();await page.waitForSelector('.wish-card');
    assert.equal(backend.sheets.WishReview.rows[1][6],'snack');
    await page.locator('[data-action="vote-wish"]').click();const before=posts.length;
    await page.locator('#vote-form [type="submit"]').click();assert.equal(posts.length,before);
    await page.locator('#vote-form [name="voterName"]').fill('網站測試者');await page.locator('#vote-form [type="submit"]').click();await done();
    await page.waitForSelector('.wish-vote-button.is-voted');assert.equal(backend.sheets.WishVotes.rows.length,2);
    await page.locator('[data-action="view-wish-supporters"]').click();await page.waitForSelector('.wish-supporter-list');
    assert.match(await page.locator('.wish-supporter-list').innerText(),/網站測試者/);await page.locator('#modal [data-action="close-modal"]').first().click();
    await go('admin');await page.waitForSelector('[data-action="quick-add-drink"]');await page.locator('[data-action="quick-add-drink"]').click();
    await page.locator('#quick-drink-form [name="name"]').fill('光泉牛乳');await page.locator('#quick-drink-form [name="recorder"]').fill('網頁測試');
    await page.locator('#quick-drink-form [type="submit"]').click();await done();await page.waitForSelector('#modal-error:not([hidden])');
    assert.equal(await page.locator('#quick-drink-form [name="name"]').inputValue(),'光泉牛乳');
    await page.locator('#quick-drink-form [name="name"]').fill('網站原生測試飲料');await page.locator('#quick-drink-form [name="category"]').selectOption('茶飲');await page.locator('#quick-drink-form [name="packaging"]').selectOption('寶特瓶');
    await page.screenshot({path:`/tmp/native-google-${width}-form.png`});
    await page.locator('#quick-drink-form [type="submit"]').click();await done();await page.waitForSelector('[data-drink-id^="custom-drink-"]');
    const created=backend.sheets.Catalog.rows.find(row=>row[1]==='網站原生測試飲料');assert.equal(created[5],24);
    assert.equal(backend.inventory().find(row=>row.drink.id===created[0]).stock,null);
    assert.equal(googleForms,0);assert.equal(popups,0);assert.ok(page.url().startsWith(base));assert.deepEqual(errors,[]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    console.log(`PASS ${width}: five native forms, one request on double submit, partial zero count, case/loose arrivals, anonymous wishes, named votes, supporters, preserved error input, quick product, no Google Forms or navigation`);
    await context.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
