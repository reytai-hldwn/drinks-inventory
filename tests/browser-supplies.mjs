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
        if(legacy===true)body=body.replace(/"supplyEntry":\{[^}]*\}/,'"supplyEntry":{}').replace('"newArrivalVersion":1','"newArrivalVersion":0');
        if(legacy==='expiry')body=body.replace('"expirySetVersion":1','"expirySetVersion":0');
        return route.fulfill({contentType:'application/javascript',body});
      });
      return{context,page};
    };
    const {context,page}=await connect();
    const done=async()=>{await page.waitForFunction(()=>!document.querySelector('iframe[name^=holdwin_write_]')&&!document.querySelector('form[aria-busy=true]'));await page.waitForFunction(()=>!document.querySelector('#modal').open);};
    const tab=async kind=>{await page.locator(`[data-action=warehouse-kind][data-id=${kind}]`).click();await page.waitForSelector('#supply-inventory');await page.locator('[data-action=supply-stock-filter][data-id=all]').click();};
    const row=id=>page.locator(`[data-supply-id=${id}]`);
    await page.goto(`${base}/index.html#products`);await page.waitForSelector('[data-action=warehouse-kind]');
    assert.deepEqual(reads,['warehouse'],'direct back-office link needs only one initial Google read');
    await tab('noodle');assert.equal(await page.locator('[data-supply-id]').count(),6);assert.match(await row('supply-noodle-05').innerText(),/奶油白醬辣火雞麵/);assert.match(await row('supply-noodle-02').innerText(),/碗/);
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

    await tab('noodle');await row('supply-noodle-04').locator('[data-action=supply-count]').click();
    await page.locator('#supply-count-form [name=recorder]').fill('既有庫存盤點');await page.locator('#supply-count-form [data-supply-count]').fill('6');await page.locator('#supply-count-form [type=submit]').click();await done();
    const countedAt=await row('supply-noodle-04').locator('.supply-col-count').innerText();
    await row('supply-noodle-04').locator('[data-action=supply-expiry-set]').click();
    await page.locator('#supply-expiry-set-form [name=recorder]').fill('既有庫存效期核對');
    await page.locator('[data-expiry-quantity]').fill('2');await page.locator('[data-expiry-date]').fill('2000-01-01');
    const beforeExpiry=posts.length;await page.locator('#supply-expiry-set-form [type=submit]').click();assert.equal(posts.length,beforeExpiry,'batch total must match counted stock');
    await page.locator('[data-action=supply-expiry-add]').click();
    await page.locator('[data-expiry-quantity]').nth(1).fill('4');await page.locator('[data-expiry-date]').nth(1).fill(two);
    await page.screenshot({path:`/tmp/supply-expiry-editor-${width}.png`,fullPage:true});
    await page.locator('#supply-expiry-set-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await done();
    assert.equal(posts.length,beforeExpiry+1);assert.equal(posts.at(-1).operation,'supply-expiry-set');
    assert.match(await row('supply-noodle-04').locator('.stock-value').innerText(),/6/);assert.equal(await row('supply-noodle-04').locator('.supply-col-count').innerText(),countedAt);
    assert.match(await row('supply-noodle-04').locator('.supply-col-arrival').innerText(),/尚無紀錄/,'expiry backfill does not create arrivals');
    await row('supply-noodle-04').locator('summary').click();assert.equal(await row('supply-noodle-04').locator('[data-batch-id]').count(),2);assert.match(await row('supply-noodle-04').innerText(),/已到期/);
    await page.evaluate(()=>{location.hash='history';});await page.waitForSelector('.history-expiry-set');
    assert.match(await page.locator('tr').filter({has:page.locator('.history-expiry-set')}).first().innerText(),/拉麵道豚骨拉麵/);
    await page.evaluate(()=>{location.hash='products';});await page.waitForSelector('[data-action=warehouse-kind]');await tab('noodle');
    await row('supply-noodle-04').locator('[data-action=supply-expiry-set]').click();
    await page.locator('#supply-expiry-set-form [name=recorder]').fill('另一個效期核對');await page.locator('[data-expiry-date]').fill(two);
    backend.send('supply-arrival',{supplyId:'supply-noodle-04',quantity:1,expiresOn:two,recorder:'另一裝置到貨'});
    await page.locator('#supply-expiry-set-form [type=submit]').click();await page.waitForSelector('#modal-error:not([hidden])');assert.match(await page.locator('#modal-error').innerText(),/新紀錄/);
    assert.equal(await page.locator('[data-expiry-quantity]').inputValue(),'6','stale rejection preserves the draft');
    page.once('dialog',dialog=>dialog.accept());await page.locator('#supply-expiry-set-form [data-action=close-modal]').click();

    backend.send('stocktake',{entries:[{drinkId:drinks[0].id,quantity:7},{drinkId:drinks[1].id,quantity:2},{drinkId:drinks[2].id,quantity:0}],recorder:'排序測試'});
    backend.send('supply-stocktake',{entries:[{supplyId:'supply-noodle-02',quantity:1},{supplyId:'supply-noodle-03',quantity:0},{supplyId:'supply-toner-red',quantity:0},{supplyId:'supply-toner-yellow',quantity:1}],recorder:'排序測試'});
    const countReads=reads.length;await page.evaluate(()=>document.querySelector('#refresh-button').click());
    await page.waitForFunction(()=>!document.querySelector('#refresh-button').disabled);assert.equal(reads.length,countReads+1);

    // Arrival subpages keep their own forms and histories while using the same
    // receipt-backed supply writer as the warehouse shortcut.
    await page.evaluate(()=>{location.hash='restock';});await page.waitForSelector('#restock-form');
    assert.equal(await page.locator('.restock-kind-tabs a').count(),3);
    assert.deepEqual((await page.locator('#restock-drink option:not([value=__new__])').evaluateAll(options=>options.map(option=>option.value))).slice(0,3),[drinks[2].id,drinks[1].id,drinks[0].id]);
    assert.doesNotMatch(await page.locator('#restock-drink').innerText(),/需要補貨/);
    await page.locator('.restock-kind-tabs a[href="#restock-noodle"]').click();await page.waitForSelector('#restock-supply');
    assert.equal(await page.locator('body').getAttribute('data-view'),'restock-noodle');
    assert.equal(await page.locator('#navigation [data-view=restock].active').count(),1);
    assert.equal(await page.locator('#restock-supply option:not([value=__new__])').count(),6);
    assert.deepEqual((await page.locator('#restock-supply option:not([value=__new__])').evaluateAll(options=>options.map(option=>option.value))).slice(0,3),['supply-noodle-03','supply-noodle-02','supply-noodle-01']);
    assert.equal(await page.locator('[name=cases],[name=loose],[name=drinkId]').count(),0);
    await page.locator('#restock-supply').selectOption('supply-noodle-02');
    assert.match(await page.locator('main [data-supply-quantity-label]').innerText(),/碗/);
    await page.locator('#supply-restock-form [name=recorder]').fill('分頁到貨');
    await page.locator('#supply-restock-form [name=quantity]').fill('2');
    const arrivalBefore=posts.length;
    await page.locator('#supply-restock-form [type=submit]').click();assert.equal(posts.length,arrivalBefore,'subpage still requires expiry');
    await page.locator('#supply-restock-form [name=expiresOn]').fill(two);
    page.once('dialog',dialog=>dialog.dismiss());
    await page.locator('.restock-kind-tabs a[href="#restock-toner"]').click();
    await page.waitForFunction(()=>location.hash==='#restock-noodle');
    assert.equal(await page.locator('#supply-restock-form [name=quantity]').inputValue(),'2','cancelled navigation keeps the draft');
    await page.locator('#supply-restock-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();document.querySelector('.restock-kind-tabs a[href="#restock-toner"]').click();});
    await done();assert.equal(posts.length,arrivalBefore+1,'subpage arrival saves once');
    assert.equal(await page.locator('body').getAttribute('data-view'),'restock-noodle','busy form blocks tab navigation');
    assert.match(await page.locator('.order-card').first().innerText(),new RegExp(`滿漢大餐牛肉麵[\\s\\S]*${two}`));
    assert.equal(await page.locator('.order-card').filter({hasText:'黑色碳粉'}).count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`/tmp/supply-arrival-noodles-${width}.png`,fullPage:true});
    await page.locator('.restock-kind-tabs a[href="#restock-toner"]').click();await page.waitForSelector('#restock-supply');
    assert.equal(await page.locator('#restock-supply option').count(),4);
    assert.deepEqual(await page.locator('#restock-supply option').evaluateAll(options=>options.map(option=>option.value)),['supply-toner-red','supply-toner-yellow','supply-toner-black','supply-toner-blue']);
    assert.equal(await page.locator('[name=expiresOn],[name=cases],[name=loose]').count(),0);
    assert.match(await page.locator('main [data-supply-quantity-label]').innerText(),/盒/);
    assert.equal(await page.locator('.order-card').filter({hasText:'滿漢大餐牛肉麵'}).count(),0);
    await page.locator('#restock-supply').selectOption('supply-toner-black');
    await page.locator('#supply-restock-form [name=recorder]').fill('碳粉分頁到貨');await page.locator('#supply-restock-form [name=quantity]').fill('2');
    await page.locator('#supply-restock-form [type=submit]').click();await done();
    assert.match(await page.locator('#restock-supply option[value=supply-toner-black]').innerText(),/5 盒/);
    await page.screenshot({path:`/tmp/supply-arrival-toner-${width}.png`,fullPage:true});
    await page.locator('.restock-kind-tabs a[href="#restock"]').click();await page.waitForSelector('#restock-form');
    assert.equal(await page.locator('.order-card').count(),0,'drink arrival history excludes supplies');
    assert.equal(await page.locator('#restock-form .new-arrival-fields:visible').count(),0);
    await page.locator('#restock-drink').selectOption('__new__');
    assert.equal(await page.locator('#restock-form .new-arrival-fields:visible').count(),1);
    assert.equal(await page.locator('#restock-form [name=cases]').isDisabled(),true);
    const newDrinkName=`分頁新品飲料 ${width}`;
    await page.locator('#restock-form [name=recorder]').fill('新品到貨同事');
    await page.locator('#restock-form [name=newName]').fill(newDrinkName);await page.locator('#restock-form [name=loose]').fill('4');
    const newBefore=posts.length;await page.locator('#restock-form [type=submit]').click();assert.equal(posts.length,newBefore,'new unit is required');
    await page.locator('#restock-form [name=newUnit]').selectOption('罐');
    await page.screenshot({path:`/tmp/new-arrival-drink-${width}.png`,fullPage:true});
    await page.locator('#restock-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await done();
    assert.equal(posts.length,newBefore+1);assert.equal(posts.at(-1).operation,'new-arrival');
    assert.ok(await page.locator('#restock-drink option').filter({hasText:newDrinkName}).count());
    assert.match(await page.locator('.order-card').first().innerText(),new RegExp(newDrinkName));
    await page.locator('.restock-kind-tabs a[href="#restock-noodle"]').click();await page.waitForSelector('#restock-supply');
    await page.locator('#restock-supply').selectOption('__new__');
    const newNoodleName=`分頁新品泡麵 ${width}`;
    await page.locator('#supply-restock-form [name=recorder]').fill('新品到貨同事');await page.locator('#supply-restock-form [name=newName]').fill(newNoodleName);
    await page.locator('#supply-restock-form [name=newUnit]').selectOption('碗');await page.locator('#supply-restock-form [name=quantity]').fill('3');
    const noodleBefore=posts.length;await page.locator('#supply-restock-form [type=submit]').click();assert.equal(posts.length,noodleBefore,'new noodles still require expiry');
    await page.locator('#supply-restock-form [name=expiresOn]').fill(two);
    assert.match(await page.locator('main [data-supply-quantity-label]').innerText(),/碗/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`/tmp/new-arrival-noodle-${width}.png`,fullPage:true});
    await page.locator('#supply-restock-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await done();
    assert.equal(posts.length,noodleBefore+1);assert.equal(posts.at(-1).operation,'new-arrival');
    assert.equal(await page.locator('#restock-supply option').filter({hasText:newNoodleName}).count(),1);
    assert.match(await page.locator('.order-card').first().innerText(),new RegExp(`${newNoodleName}[\\s\\S]*${two}`));
    assert.equal(await page.locator('.order-card').filter({hasText:newDrinkName}).count(),0);
    await page.locator('.restock-kind-tabs a[href="#restock-toner"]').click();await page.waitForSelector('#restock-supply');
    assert.equal(await page.locator('#restock-supply option[value=__new__]').count(),0,'toner stays fixed to four colors');
    const readsBefore=reads.length,second=await connect();await second.page.goto(`${base}/index.html#restock-toner`);await second.page.waitForSelector('#restock-supply');
    assert.deepEqual(reads.slice(readsBefore),['warehouse'],'direct arrival subpage needs one warehouse read');
    await second.page.locator('#restock-supply').selectOption('supply-toner-black');
    assert.match(await second.page.locator('main [data-supply-arrival-summary]').innerText(),/5 盒/);await second.context.close();
    const old=await connect(true);await old.page.goto(`${base}/index.html#products`);await old.page.waitForSelector('[data-action=warehouse-kind]');await old.page.locator('[data-action=warehouse-kind][data-id=noodle]').click();await old.page.locator('[data-action=supply-stock-filter][data-id=all]').click();
    assert.match(await old.page.locator('.supply-upgrade').innerText(),/更新 Apps Script/);assert.equal(await old.page.locator('[data-action=supply-arrival]:enabled').count(),0);
    await old.page.evaluate(()=>{location.hash='restock-noodle';});await old.page.waitForSelector('#restock-supply');
    assert.equal(await old.page.locator('.restock-kind-tabs a').count(),3);
    assert.equal(await old.page.locator('#supply-restock-form .arrival-fields[disabled]').count(),1);assert.match(await old.page.locator('.supply-upgrade').innerText(),/更新 Apps Script/);
    assert.equal(await old.page.locator('#restock-supply option[value=__new__]').isDisabled(),true);await old.context.close();
    const priorExpiry=await connect('expiry');await priorExpiry.page.goto(`${base}/index.html#products`);await priorExpiry.page.waitForSelector('[data-action=warehouse-kind]');await priorExpiry.page.locator('[data-action=warehouse-kind][data-id=noodle]').click();await priorExpiry.page.locator('[data-action=supply-stock-filter][data-id=all]').click();
    assert.equal(await priorExpiry.page.locator('[data-supply-id=supply-noodle-04] [data-action=supply-expiry-set]').getAttribute('disabled'),'');
    assert.equal(await priorExpiry.page.locator('[data-supply-id=supply-noodle-04] [data-action=supply-arrival]').getAttribute('disabled'),null);await priorExpiry.context.close();
    assert.deepEqual(errors,[]);console.log(`PASS ${width}: arrival pages/new items, quantity-neutral existing-stock expiry, split/past dates, total/stale checks, single writes, history names and legacy gates.`);
    await context.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
