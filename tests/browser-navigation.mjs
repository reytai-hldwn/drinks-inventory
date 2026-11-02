// Optional: PANTRY_PLAYWRIGHT_MODULE points to playwright-core; Chromium is
// required. Controlled Google responses reproduce slow reads without waiting
// a real minute or writing anything to the owner's spreadsheet.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
import {createCompanyData} from '../js/catalog.js';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.avif':'image/avif'};
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
    if(!/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name))throw new Error('not found');
    const path=resolve(root,name);if(!path.startsWith(root.replace(/\/$/,'')+sep))throw new Error('not found');
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
  }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/TEST_NAVIGATION/exec';
const browser=await chromium.launch({executablePath:process.env.PANTRY_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
  for(const width of [1440,390]){
    const backend=websiteBackend();
    backend.sheets.Catalog.rows.splice(1,99,...createCompanyData().drinks.map(d=>[d.id,d.name,d.category,d.packaging,d.unit,d.perCase,d.threshold,d.active]));
    const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await context.newPage(),reads=[],errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
    await page.addInitScript(()=>{
      const original=window.setInterval;
      window.setInterval=(callback,delay,...args)=>{
        if(delay===60000){window.__pantryPoll=()=>callback(...args);return 60000;}
        return original(callback,delay,...args);
      };
    });
    let gate;
    const holdNext=()=>{
      assert.equal(gate,undefined);let release,started;
      const value={waiting:new Promise(resolve=>{release=resolve;}),started:new Promise(resolve=>{started=resolve;}),release,begin:started};
      gate=value;return value;
    };
    await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
    await page.route(`${endpoint}**`,async route=>{
      assert.equal(route.request().method(),'GET');
      const parameter=Object.fromEntries(new URL(route.request().url()).searchParams);reads.push(parameter.action);
      const held=gate;gate=undefined;
      const body=backend.ctx.doGet({parameter}).body;
      if(held){held.begin();await held.waiting;if(held.fail){await route.abort();return;}}
      await route.fulfill({contentType:'application/javascript',body});
    });
    const nav=async view=>{
      await page.locator(`#navigation [data-view="${view}"]`).click();
      await page.waitForFunction(view=>document.body.dataset.view===view&&!document.querySelector('#main .loading-state'),view);
    };
    const poll=()=>page.evaluate(()=>{window.__pantryPollResult=window.__pantryPoll();});
    const finishPoll=()=>page.evaluate(()=>window.__pantryPollResult);
    const menu=async()=>{if(width<=900&&await page.locator('#pantry-utilities').isHidden())await page.locator('.mobile-menu-toggle').click();};
    await page.goto(`${base}/index.html`);await page.waitForSelector('.pantry-stage');
    assert.deepEqual(reads,['public'],'initial data is not fetched twice');
    await nav('archive');assert.equal(await page.locator('.archive-card').count(),8);await nav('wishes');await nav('overview');
    assert.deepEqual(reads,['public'],'front tabs reuse the same loaded catalog');

    backend.sheets.Catalog.rows[1][1]='更新後的牛乳';
    let held=holdNext();await poll();await held.started;
    await nav('archive');assert.equal(reads.length,2,'navigation does not wait for polling');
    held.release();await finishPoll();assert.equal(await page.locator('.archive-card').count(),8);
    assert.match(await page.locator('h1').innerText(),/曾經喝過/);

    await menu();held=holdNext();await page.locator('#refresh-button').click();await held.started;
    await nav('wishes');held.release();
    await page.waitForFunction(()=>!document.querySelector('#refresh-button').disabled);
    assert.match(await page.locator('h1').innerText(),/採買許願池/);

    held=holdNext();await poll();await held.started;
    await page.locator('[data-action="new-wish"]').first().click();
    await page.locator('#wish-form [name="name"]').fill('尚未送出的願望');
    held.release();await finishPoll();
    assert.equal(await page.locator('#wish-form [name="name"]').inputValue(),'尚未送出的願望');
    assert.equal(await page.locator('#modal').evaluate(modal=>modal.open),true);
    await page.locator('#modal [data-action="close-modal"]').first().click();

    held=holdNext();held.fail=true;await poll();await held.started;await nav('archive');
    held.release();await finishPoll();assert.doesNotMatch(await page.locator('#connection-status').innerText(),/中斷/);

    await menu();await page.locator('#auth-button').click();await page.waitForSelector('.admin-grid');
    assert.equal(reads.filter(action=>action==='warehouse').length,0,'admin entry uses its lightweight summary');
    await nav('count');const warehouseReads=reads.filter(action=>action==='warehouse').length;assert.equal(warehouseReads,1);
    for(const view of ['restock','products','history'])await nav(view);
    assert.equal(reads.filter(action=>action==='warehouse').length,warehouseReads,'management tabs reuse the loaded warehouse');

    await nav('count');held=holdNext();await menu();await page.locator('#refresh-button').click();await held.started;
    await page.locator('#count-form [name="recorder"]').fill('保留中的盤點');
    await page.locator('#count-form [name="company-drink-01"]').fill('0');
    held.release();await page.waitForFunction(()=>!document.querySelector('#refresh-button').disabled);
    assert.equal(await page.locator('#count-form [name="recorder"]').inputValue(),'保留中的盤點');
    assert.equal(await page.locator('#count-form [name="company-drink-01"]').inputValue(),'0');
    await nav('history');

    held=holdNext();await poll();await held.started;await menu();await page.locator('#auth-button').click();await page.waitForSelector('.pantry-stage');
    held.release();await finishPoll();assert.equal(await page.locator('body').getAttribute('data-view'),'overview');
    assert.equal(await page.locator('.pantry-stage').count(),1,'late warehouse response cannot replace the new front page');
    assert.deepEqual(errors,[]);console.log(`PASS ${width}: immediate cached navigation during slow automatic/manual reads, preserved draft, stale/error response isolation, one initial read and one management read`);
    await context.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
