// Cold homepage and sandboxed Google receipt integration, using fictional data only.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url)),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.avif':'image/avif'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');if(!path.startsWith(root.replace(/\/$/,'')+sep))throw Error('missing');res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/FAST_BROWSER_TEST/exec',sandbox='https://n-test-script.googleusercontent.com';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const b=websiteBackend(),context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await context.newPage(),reads=[],posts=[],replies=new Map(),errors=[];let release,mode='message';
  const publicGate=new Promise(resolve=>{release=resolve;});page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
  await page.route(sandbox+'/**',r=>r.fulfill({contentType:'text/html',body:replies.get(new URL(r.request().url()).pathname)}));
  await page.route(endpoint+'**',async r=>{
   if(r.request().method()==='POST'){
    const parameter=Object.fromEntries(new URLSearchParams(r.request().postData())),command=JSON.parse(parameter.payload);posts.push(command);
    const path='/reply/'+command.requestId,html=b.ctx.doPost({parameter}).body;
    replies.set(path,mode==='blocked'?html.replace(/<script>[\s\S]*?<\/script>/,''):html);
    return r.fulfill({contentType:'text/html',body:`<!doctype html><iframe sandbox="allow-scripts allow-same-origin" src="${sandbox+path}"></iframe>`});
   }
   const parameter=Object.fromEntries(new URL(r.request().url()).searchParams);reads.push(parameter.action);
   if(parameter.action==='public')await publicGate;
   return r.fulfill({contentType:'application/javascript',body:b.ctx.doGet({parameter}).body});
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.waitForSelector('.pantry-stage');
  assert.equal(await page.locator('main').getAttribute('aria-busy'),'true','cold scene paints while the first Google request remains held');
  assert.equal(await page.locator('.fridge-product').count(),0);
  await page.locator('.fridge-door').click();await page.waitForSelector('.fridge-loading:visible');
  assert.doesNotMatch(await page.locator('main').innerText(),/這一格還沒有飲料/);
  assert.equal(await page.locator('.fridge-popularity').isVisible(),false);
  await page.locator('#navigation [data-view=wishes]').click();release();await page.waitForSelector('[data-action=new-wish]');
  assert.equal(await page.locator('body').getAttribute('data-view'),'wishes','early navigation is preserved when the initial response arrives');
  assert.deepEqual(reads,['public']);
  await page.locator('[data-action=new-wish]').first().click();await page.locator('#wish-form [name=kind]').selectOption('drink');await page.locator('#wish-form [name=name]').fill('虛構跨框架測試茶');await page.locator('#wish-form [type=submit]').click();await page.waitForSelector('.wish-card');await page.waitForSelector('#modal:not([open])',{state:'attached'});
  assert.equal(reads.filter(action=>action==='receipt').length,0,'sandbox descendant delivers the committed receipt without a second Google request');
  await page.locator('[data-action=vote-wish]').click();await page.locator('#vote-form [name=voterName]').fill('虛構測試者');await page.locator('#vote-form [type=submit]').click();await page.waitForSelector('.wish-vote-button.is-voted');
  assert.equal(reads.filter(action=>action==='receipt').length,0);assert.equal(reads.filter(action=>action==='public').length,1);assert.equal(b.sheets.WishVotes.rows.length,2);
  mode='blocked';await page.locator('[data-action=new-wish]').first().click();await page.locator('#wish-form [name=kind]').selectOption('drink');await page.locator('#wish-form [name=name]').fill('虛構回條備援測試茶');await page.locator('#wish-form [type=submit]').click();await page.waitForSelector('#modal:not([open])',{state:'attached'});
  assert.equal(reads.filter(action=>action==='receipt').length,1,'a blocked sandbox message falls back to a durable receipt read');
  assert.equal(b.sheets.WishReview.rows.length,3);assert.equal(posts.length,3);assert.equal(await page.locator('iframe[name^=holdwin_write_]').count(),0);assert.deepEqual(errors,[]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log(`PASS ${width}: cold fridge before held data, open-door loading state, early navigation, nested cross-origin receipts, wish/vote without GET polling, blocked-message fallback, no duplicate writes.`);await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
