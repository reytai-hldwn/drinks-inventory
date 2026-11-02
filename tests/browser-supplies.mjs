// Native forms against the in-memory Apps Script harness; no real Google writes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
import {createCompanyData} from '../js/catalog.js';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html',path=resolve(root,name);
    if(!path.startsWith(root)||!(/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name)))throw new Error('not found');
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
  }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/TEST_SUPPLIES/exec';
const browser=await chromium.launch({executablePath:process.env.PANTRY_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
  for(const width of [1440,390]){
    const backend=websiteBackend(),drinks=createCompanyData().drinks;
    backend.sheets.Catalog.rows.splice(1,99,...drinks.map(d=>[d.id,d.name,d.category,d.packaging,d.unit,d.perCase,d.threshold,d.active]));
    const originalDrinks=JSON.stringify(backend.sheets.Catalog.rows),posts=[],errors=[],reads=[];
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
        const parameter=Object.fromEntries(new URL(request.url()).searchParams);
        reads.push(parameter.action);
        let body=backend.ctx.doGet({parameter}).body;
        if(legacy)body=body.replace('"supplyEntry":{"version":1,"expiryVersion":1}','"supplyEntry":{}');
        return route.fulfill({contentType:'application/javascript',body});
      });
      return{context,page};
    };
    const {context,page}=await connect();
    const done=async()=>{await page.waitForFunction(()=>!document.querySelector('iframe[name^=holdwin_write_]')&&!document.querySelector('form[aria-busy=true]'));await page.waitForFunction(()=>!document.querySelector('#modal').open);};
    const tab=async kind=>{await page.locator(`[data-action=warehouse-kind][data-id=${kind}]`).click();await page.waitForSelector('#supply-inventory');};
    const row=id=>page.locator(`[data-supply-id=${id}]`);
    await page.goto(`${base}/index.html#products`);await page.waitForSelector('[data-action=warehouse-kind]');
    assert.deepEqual(reads,['warehouse'],'direct back-office link needs only one initial Google read');
    await tab('noodle');assert.equal(await page.locator('[data-supply-id]').count(),5);assert.match(await row('supply-noodle-05').innerText(),/奶油白醬辣火雞麵/);assert.match(await row('supply-noodle-02').innerText(),/碗/);
    if(width<=640){const box=await row('supply-noodle-01').locator('[data-action=supply-arrival]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,'quick arrival is visible without horizontal scrolling');}
    await row('supply-noodle-01').locator('[data-action=supply-count]').click();
    await page.locator('#supply-count-form [name=recorder]').fill('盤點測試');await page.locator('#supply-count-form [data-supply-count]').fill('0');await page.locator('#supply-count-form [type=submit]').click();await done();
    const future=days=>new Date(Date.now()+days*86400000+8*3600000).toISOString().slice(0,10);
    const one=future(15),two=future(60);
    for(const [quantity,expiry] of [['2',one],['3',two]]){
      await row('supply-noodle-01').locator('[data-action=supply-arrival]').click();
      assert.equal(await page.locator('#supply-arrival-form [name=cases],#supply-arrival-form [name=loose]').count(),0);
      await page.locator('#supply-arrival-form [name=recorder]').fill('到貨測試');await page.locator('#supply-arrival-form [name=quantity]').fill(quantity);
      const before=posts.length;await page.locator('#supply-arrival-form [type=submit]').click();assert.equal(posts.length,before,'expiry is required before posting');
      await page.locator('#supply-arrival-form [name=expiresOn]').fill(expiry);
      await page.locator('#supply-arrival-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await done();
    }
    assert.equal(posts.filter(post=>post.operation==='supply-arrival').length,2,'double submit does not double arrivals');
    assert.match(await row('supply-noodle-01').locator('.stock-value').innerText(),/5/);
    await row('supply-noodle-01').locator('summary').click();
    assert.equal(await row('supply-noodle-01').locator('[data-batch-id]').count(),2);
    assert.match(await row('supply-noodle-01').innerText(),new RegExp(one));assert.match(await row('supply-noodle-01').innerText(),new RegExp(two));
    assert.equal(await row('supply-noodle-01').locator('.expiry-near').count()>0,true);
    // Simulate time passing for a previously accepted batch; new expired stock
    // is rejected by the server, but old stock must still show a clear warning.
    backend.sheets.SupplyHistory.rows.find(record=>record[2]==='restock')[9]='2000-01-01';
    await page.evaluate(()=>document.querySelector('#refresh-button').click());await page.waitForSelector('.expiry-expired');
    await row('supply-noodle-01').locator('summary').click();await row('supply-noodle-01').locator('[data-action=supply-expiry-close]').first().click();
    await page.locator('#supply-expiry-close-form [name=recorder]').fill('效期核對');await page.locator('#supply-expiry-close-form [type=submit]').click();await done();
    assert.equal(await row('supply-noodle-01').locator('.expiry-expired').count(),0);assert.match(await row('supply-noodle-01').locator('.stock-value').innerText(),/5/);
    await page.screenshot({path:`/tmp/supplies-noodles-${width}.png`,fullPage:true});
    await tab('toner');assert.equal(await page.locator('[data-supply-id]').count(),4);assert.equal(await page.locator('.toner-swatch').count(),4);
    await row('supply-toner-black').locator('[data-action=supply-count]').click();await page.locator('#supply-count-form [name=recorder]').fill('盤點測試');await page.locator('#supply-count-form [data-supply-count]').fill('0');await page.locator('#supply-count-form [type=submit]').click();await done();
    await row('supply-toner-black').locator('[data-action=supply-arrival]').click();assert.equal(await page.locator('#supply-arrival-form [name=expiresOn],#supply-arrival-form [name=cases]').count(),0);
    await page.locator('#supply-arrival-form [name=recorder]').fill('到貨測試');await page.locator('#supply-arrival-form [name=quantity]').fill('3');await page.locator('#supply-arrival-form [type=submit]').click();await done();
    assert.match(await row('supply-toner-black').locator('.stock-value').innerText(),/3.*盒/s);
    await page.screenshot({path:`/tmp/supplies-toner-${width}.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(JSON.stringify(backend.sheets.Catalog.rows),originalDrinks);
    const second=await connect();await second.page.goto(`${base}/index.html#products`);await second.page.waitForSelector('[data-action=warehouse-kind]');await second.page.locator('[data-action=warehouse-kind][data-id=toner]').click();
    assert.match(await second.page.locator('[data-supply-id=supply-toner-black] .stock-value').innerText(),/3.*盒/s);await second.context.close();
    const old=await connect(true);await old.page.goto(`${base}/index.html#products`);await old.page.waitForSelector('[data-action=warehouse-kind]');await old.page.locator('[data-action=warehouse-kind][data-id=noodle]').click();
    assert.match(await old.page.locator('.supply-upgrade').innerText(),/更新 Apps Script/);assert.equal(await old.page.locator('[data-action=supply-arrival]:enabled').count(),0);await old.context.close();
    assert.deepEqual(errors,[]);console.log(`PASS ${width}: five noodle units, four boxed toner colors, no cases, required batch expiry, date warnings/close, idempotent native arrivals, cross-device read, legacy gate, unchanged drinks.`);
    await context.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
