// Controlled latency, fictional data, no requests to the owner's Google project.
// Optional PANTRY_BASELINE_ROOT compares the same browser flows with an older build.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url)),baseline=process.env.PANTRY_BASELINE_ROOT;
const roots={current:root,...(baseline?{before:resolve(baseline)}:{})};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.avif':'image/avif'};
const server=createServer(async(req,res)=>{
  try{
    const [version,...parts]=new URL(req.url,'http://localhost').pathname.slice(1).split('/');
    const name=parts.join('/')||'index.html',base=roots[version],path=resolve(base,name);
    if(!base||!path.startsWith(base.replace(/\/$/,'')+sep)||!/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name))throw new Error('not found');
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=3600');res.end(await readFile(path));
  }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/TEST_TIMING/exec';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  for(const version of Object.keys(roots))for(const width of [1660,390]){
    const b=websiteBackend(),context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),reads=[],errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/config.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
    await page.route(`${endpoint}**`,async route=>{
      if(route.request().method()==='POST'){
        await delay(400);const parameter=Object.fromEntries(new URLSearchParams(route.request().postData()));
        await route.fulfill({contentType:'text/html',body:b.ctx.doPost({parameter}).body});
      }else{
        const parameter=Object.fromEntries(new URL(route.request().url()).searchParams);reads.push(parameter.action);
        await delay(parameter.action==='public'?1200:parameter.action==='warehouse'?1500:200);
        await route.fulfill({contentType:'application/javascript',body:b.ctx.doGet({parameter}).body});
      }
    });
    const started=Date.now();await page.goto(`${base}/${version}/index.html`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.pantry-stage[data-scene]');
    const coldReadyMs=Date.now()-started;
    await page.evaluate(async()=>{
      await document.fonts.ready;
      const stage=document.querySelector('.pantry-stage');if(stage.dataset.scene==='mobile')return;
      const src=stage.querySelector(`.pantry-office-${stage.dataset.scene} image`).getAttribute('href');
      await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=src;});
    });
    const sceneBytes=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/pantry-office-/.test(r.name)).reduce((sum,r)=>sum+r.encodedBodySize,0));
    if(version==='current'&&width>900){assert.ok(sceneBytes>0&&sceneBytes<500000);assert.ok((await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/pantry-office-/.test(r.name)).map(r=>r.name))).every(url=>url.endsWith('.webp')));}
    await page.locator('#navigation [data-view=wishes]').click();await page.locator('[data-action=new-wish]').first().click();
    await page.locator('#wish-form [name=kind]').selectOption('drink');
    await page.locator('#wish-form [name=name]').fill('虛構效能測試飲料');
    const beforeWish=reads.filter(a=>a==='public').length,wishStart=Date.now();
    await page.locator('#wish-form [type=submit]').click();await page.waitForSelector('.wish-card');await page.waitForSelector('#modal:not([open])',{state:'attached'});
    const wishMs=Date.now()-wishStart;
    if(version==='current')assert.equal(reads.filter(a=>a==='public').length,beforeWish,'wish receipt avoids another full read');
    await page.locator('[data-action=vote-wish]').click();await page.locator('#vote-form [name=voterName]').fill('虛構測試者');
    const beforeVote=reads.filter(a=>a==='public').length,voteStart=Date.now();await page.locator('#vote-form [type=submit]').click();await page.waitForSelector('.wish-vote-button.is-voted');
    const voteMs=Date.now()-voteStart;
    if(version==='current')assert.equal(reads.filter(a=>a==='public').length,beforeVote,'vote receipt avoids another full read');
    await page.evaluate(()=>{location.hash='products';});await page.waitForSelector('[data-stock-drink-id]');
    const returnStart=Date.now();await page.evaluate(()=>{location.hash='overview';});await page.waitForSelector('.pantry-stage');const returnMs=Date.now()-returnStart;
    if(version==='current')assert.ok(returnMs<600,'return to the fridge does not wait for Google');
    assert.equal(b.sheets.WishReview.rows.length,2);assert.equal(b.sheets.WishVotes.rows.length,2);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({version,width,coldReadyMs,sceneBytes,wishMs,voteMs,returnMs,fullReads:reads.filter(a=>a==='public'||a==='warehouse').length}));
    await context.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
