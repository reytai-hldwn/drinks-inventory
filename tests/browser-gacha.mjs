// Fictional stock only; every browser POST is blocked.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
import {GACHA_FORTUNES,GACHA_ANIMATION_MS,GACHA_OPEN_MS,GACHA_UNFOLD_MS} from '../js/gacha.js';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url)),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.avif':'image/avif'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');if(!path.startsWith(root.replace(/\/$/,'')+sep))throw new Error('missing');res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/GACHA_BROWSER/exec';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
async function configured(context,b,{legacy=false,gate=null}={}){
 await context.addInitScript(()=>{Date.now=()=>Date.parse('2026-11-03T08:00:00Z');});
 const page=await context.newPage(),reads=[],writes=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
 await page.route(`${endpoint}**`,async r=>{
  if(r.request().method()!=='GET'){writes.push(r.request().method());return r.abort();}
  const parameter=Object.fromEntries(new URL(r.request().url()).searchParams);reads.push(parameter.action);if(parameter.action==='gacha'&&gate)await gate;
  if(legacy&&parameter.action==='public'){
   const value=b.ctx.publicData_(b.ss);delete value.websiteEntry.gachaVersion;return r.fulfill({contentType:'application/javascript',body:`${parameter.callback}(${JSON.stringify(value)});`});
  }
  return r.fulfill({contentType:'application/javascript',body:b.ctx.doGet({parameter}).body});
 });
 return{page,reads,writes,errors};
}
async function checkFortuneWrapping(page){
 const result=await page.evaluate(async()=>{
  const {GACHA_FORTUNES,renderGacha}=await import('/js/gacha.js'),width=document.querySelector('.gacha-ticket').getBoundingClientRect().width;
  const fixture=document.createElement('article');fixture.className='gacha-ticket';fixture.style.cssText=`position:fixed;left:-10000px;top:0;width:${width}px;visibility:hidden`;document.body.append(fixture);
  const issues=[],wrapper=document.createElement('div');
  for(const fortune of GACHA_FORTUNES){
   wrapper.innerHTML=renderGacha({draw:{fortuneId:fortune.id,day:'2026-11-03'}},[]);const paragraph=wrapper.querySelector('.gacha-fortune');fixture.replaceChildren(paragraph);
   if(paragraph.textContent!==fortune.text)issues.push({id:fortune.id,issue:'changed text'});
   const origin=paragraph.getBoundingClientRect(),lineHeight=parseFloat(getComputedStyle(paragraph).lineHeight),lines=new Map(),walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);let node;
   while(node=walker.nextNode())for(let offset=0;offset<node.length;offset++){
    const range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);const rect=range.getBoundingClientRect(),line=Math.round((rect.top-origin.top)/lineHeight);lines.set(line,(lines.get(line)||'')+node.textContent[offset]);
   }
   for(const line of lines.values())if(/^[，。！？；：、,.!?;:]$|^\p{Script=Han}$/u.test(line.trim()))issues.push({id:fortune.id,issue:'orphan',line});
   const clauses=[...paragraph.querySelectorAll('.gacha-fortune-clause')];
   if(clauses.length>1){const first=clauses[0].getBoundingClientRect(),second=clauses[1].getBoundingClientRect();if(first.width+second.width>origin.width+1&&second.top<=first.top+1)issues.push({id:fortune.id,issue:'comma did not wrap'});}
  }
  fixture.style.width='1400px';const paragraph=fixture.querySelector('.gacha-fortune'),tops=[...paragraph.children].filter(node=>node.tagName==='SPAN').map(node=>node.getBoundingClientRect().top);const fitsOneLine=tops.every(top=>Math.abs(top-tops[0])<1);fixture.remove();return{issues,fitsOneLine,count:GACHA_FORTUNES.length};
 });
 assert.deepEqual(result.issues,[],'all approved fortunes keep their text and avoid orphan Chinese characters or punctuation');assert.equal(result.fitsOneLine,true,'commas do not force a break when the full sentence fits');assert.equal(result.count,39);
}
try{
 for(const width of [1440,390]){
  const b=websiteBackend();b.sheets.Catalog.rows.splice(1,99,['known','立頓原味奶茶','茶飲','鋁箔包','包',24,10,true],['zero','可口可樂','汽水','小型鐵罐','罐',24,10,true],['old','Milkis','汽水','長鐵罐','罐',24,10,false],['unknown','可爾必思開心成長160ml','其他','鋁箔包','包',24,10,true]);b.sheets.History.rows.splice(1);for(const[id,quantity]of [['known',10],['zero',0],['old',10]])b.sheets.History.rows.push([`fixture-${id}`,'2026-01-01T00:00:00Z','count',id,id,quantity,'測試','測試人','採計']);
  const before=structuredClone({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows});let release;const gate=new Promise(resolve=>{release=resolve;});
  const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),{page,reads,writes,errors}=await configured(context,b,{gate});
  await page.goto(base+'/');await page.waitForSelector('.pantry-stage');assert.equal(await page.locator('body').getAttribute('data-view'),'overview');assert.equal(await page.locator('.gacha-machine').count(),0);assert.deepEqual(await page.locator('#navigation a[data-front]:visible').evaluateAll(nodes=>nodes.map(node=>node.dataset.view)),['overview','archive','wishes','gacha']);await page.locator('[data-gacha]').click();await page.waitForSelector('.gacha-machine');assert.equal(await page.locator('[data-gacha]').isVisible(),true);assert.deepEqual(reads,['public']);assert.equal(await page.locator('#navigation a[data-front]:visible').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1)),true,'all four navigation labels fit inside their touch targets');
  const began=Date.now();await page.locator('[data-action=gacha-draw]').click();await page.waitForSelector('.gacha-ticket',{timeout:1500});assert.ok(Date.now()-began<1500,'fortune never waits for the held Google request');const fortune=await page.locator('.gacha-fortune').innerText();assert.equal(await page.locator('[data-action=gacha-draw]').isDisabled(),true);assert.match(await page.locator('.gacha-drink-status').innerText(),/正在替你找/);
  await page.evaluate(()=>location.hash='overview');await page.waitForSelector('.pantry-stage');release();await page.waitForFunction(()=>{const key=Object.keys(localStorage).find(key=>key.startsWith('holdwin-gacha-v1:'));return key&&JSON.parse(localStorage.getItem(key)).drinkId==='known';});assert.equal(await page.locator('body').getAttribute('data-view'),'overview','late recommendation cannot replace the page after navigation');
  await page.evaluate(()=>location.hash='gacha');await page.waitForSelector('.gacha-drink');assert.equal(await page.locator('.gacha-fortune').innerText(),fortune);assert.equal(await page.locator('.gacha-drink h3').innerText(),'要來一包立頓原味奶茶嗎？');assert.match(await page.locator('.gacha-drink .drink-photo-viewport').evaluate(element=>getComputedStyle(element).clipPath),/^polygon\(/);assert.doesNotMatch(await page.locator('.gacha-ticket').innerText(),/可口可樂|Milkis|可爾必思/);await page.locator('.gacha-drink img').evaluate(image=>image.decode());await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`/tmp/gacha-result-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.gacha-drink [data-action=view-drink]').click();await page.waitForSelector('.nutrition-table');assert.ok(await page.locator('.nutrition-table tbody tr').count()>=8);await page.locator('#modal [data-action=close-modal]').last().click();
  await page.reload();await page.waitForSelector('.gacha-drink');assert.equal(await page.locator('.gacha-fortune').innerText(),fortune);assert.equal(reads.filter(action=>action==='gacha').length,1,'reload reuses the saved daily pairing');assert.equal(await page.locator('[data-action=gacha-draw]').isDisabled(),true);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);assert.deepEqual({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows},before);
  for(const fortuneId of ['supply-33','supply-38','supply-39','pause-01','pause-02']){
   const selected=GACHA_FORTUNES.find(row=>row.id===fortuneId);
   await page.evaluate(fortuneId=>{const key=Object.keys(localStorage).find(key=>key.startsWith('holdwin-gacha-v1:')),draw=JSON.parse(localStorage.getItem(key));localStorage.setItem(key,JSON.stringify({...draw,fortuneId}));},fortuneId);
   await page.reload();await page.waitForSelector('.gacha-drink');assert.equal(await page.locator('.gacha-fortune').innerText(),selected.text);assert.equal(await page.locator('.gacha-ticket-top span').innerText(),`✧ ${selected.kind==='pause'?'宇宙小暫停':'今日補給'}`);await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(['supply-38','pause-01'].includes(fortuneId))await page.screenshot({path:`/tmp/gacha-${fortuneId}-${width}.png`,fullPage:true});
  }
  assert.equal(reads.filter(action=>action==='gacha').length,1);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  await checkFortuneWrapping(page);
  await context.close();console.log(`PASS ${width}: instant fortune during held read, navigation stays usable, eligible drink only, daily persistence, product information, no inventory writes or horizontal overflow.`);
 }
 {
  const b=websiteBackend(),context=await browser.newContext({viewport:{width:390,height:960},reducedMotion:'reduce'}),{page,reads,writes,errors}=await configured(context,b,{legacy:true});await page.goto(base+'/');await page.waitForSelector('.pantry-stage');assert.equal(await page.locator('body').getAttribute('data-view'),'overview');assert.equal(await page.locator('[data-gacha]').isVisible(),true);await page.locator('[data-gacha]').click();await page.waitForSelector('.gacha-machine');await page.locator('[data-action=gacha-draw]').click();await page.waitForSelector('.gacha-ticket');assert.match(await page.locator('.gacha-drink-status').innerText(),/飲料推薦準備中/);assert.equal(reads.filter(action=>action==='gacha').length,0);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/gacha-preview-legacy-390.png',fullPage:true});await context.close();
 }
 {
  const b=websiteBackend();b.sheets.History.rows.splice(1);const context=await browser.newContext({viewport:{width:390,height:960},reducedMotion:'reduce'});await context.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('holdwin-gacha-v1:'))throw new Error('storage blocked');return original.call(this,key,value);};});const{page,writes,errors}=await configured(context,b);await page.goto(base+'/#gacha');await page.waitForSelector('.gacha-machine');await page.locator('[data-action=gacha-draw]').click();await page.waitForFunction(()=>document.querySelector('.gacha-drink-status')?.textContent.includes('今天的飲料推薦先留白'));const fortune=await page.locator('.gacha-fortune').innerText();assert.match(await page.locator('#gacha-result').innerText(),/無法保存/);
  b.send('arrival',{drinkId:'tea',cases:0,loose:2,recorder:'測試',note:''});await page.locator('[data-action=gacha-retry]').click();await page.waitForSelector('.gacha-drink');assert.equal(await page.locator('.gacha-fortune').innerText(),fortune);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await context.close();
 }
 for(const width of [1440,390]){
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const b=websiteBackend(),context=await browser.newContext({viewport:{width,height:960},reducedMotion:'no-preference'}),{page,writes,errors}=await configured(context,b,{gate});
  await page.goto(base+'/#gacha');await page.waitForSelector('.gacha-machine');const other=await configured(context,b);await other.page.goto(base+'/#gacha');await other.page.waitForSelector('.gacha-machine');await page.bringToFront();await page.evaluate(()=>document.fonts.ready);
  // Hold completion callbacks so each phase can be inspected without timing races.
  await page.evaluate(durations=>{const original=setTimeout;window.gachaTestTimers={};window.setTimeout=(fn,ms,...args)=>{if(durations.includes(ms)){window.gachaTestTimers[ms]=()=>fn(...args);return 0;}return original(fn,ms,...args);};},[GACHA_ANIMATION_MS,GACHA_OPEN_MS,GACHA_UNFOLD_MS]);
  await page.locator('[data-action=gacha-draw]').focus();await page.keyboard.press('Enter');await page.waitForSelector('.gacha-machine.is-spinning');
  const phase=(progress,duration=GACHA_ANIMATION_MS)=>page.evaluate(({progress,duration})=>{
   const machine=document.querySelector('.gacha-machine');for(const animation of document.querySelector('.gacha-layout').getAnimations({subtree:true})){animation.pause();animation.currentTime=progress*duration;}
   const knob=getComputedStyle(machine.querySelector('.gacha-knob')),capsule=getComputedStyle(machine.querySelector('.gacha-capsule-out')),matrix=new DOMMatrix(knob.transform);
   return{angle:(Math.atan2(matrix.b,matrix.a)*180/Math.PI+360)%360,capsule:Number(capsule.opacity),position:capsule.transform,top:getComputedStyle(machine.querySelector('.gacha-capsule-top')).transform,bottom:getComputedStyle(machine.querySelector('.gacha-capsule-bottom')).transform,note:Number(getComputedStyle(machine.querySelector('.gacha-capsule-note')).opacity),ticketOpacity:document.querySelector('.gacha-ticket')?Number(getComputedStyle(document.querySelector('.gacha-ticket')).opacity):null};
  },{progress,duration});
  const pauseStart=await phase(.38),pauseEnd=await phase(.46);assert.ok(Math.abs(pauseStart.angle-180)<.1);assert.equal(pauseStart.angle,pauseEnd.angle,'the knob catches after half a turn');assert.equal(pauseEnd.capsule,0);assert.equal(await page.locator('.gacha-ticket').count(),0);
  await page.screenshot({path:`/tmp/gacha-half-turn-${width}.png`,fullPage:true});
  const secondHalf=await phase(.62);assert.ok(secondHalf.angle>180&&secondHalf.angle<360);assert.equal(secondHalf.capsule,0,'the capsule stays inside until both half-turns finish');
  const roll=await phase(.88);assert.equal(roll.capsule,1);assert.notEqual(roll.position,pauseEnd.position);await page.screenshot({path:`/tmp/gacha-roll-${width}.png`,fullPage:true});
  await phase(1);await page.evaluate(duration=>window.gachaTestTimers[duration](),GACHA_ANIMATION_MS);await page.waitForSelector('.gacha-machine.is-opening');assert.equal(await page.locator('.gacha-ticket').count(),0,'the capsule opens before the fortune appears');
  const closed=await phase(0,GACHA_OPEN_MS),opened=await phase(.9,GACHA_OPEN_MS);assert.notEqual(opened.top,closed.top);assert.notEqual(opened.bottom,closed.bottom);assert.equal(opened.note,1);await page.screenshot({path:`/tmp/gacha-opening-${width}.png`,fullPage:true});
  await page.locator('.gacha-machine').evaluate(node=>{node.dataset.testContinuity='opening';});release();await page.waitForFunction(()=>{const key=Object.keys(localStorage).find(key=>key.startsWith('holdwin-gacha-v1:'));return !!JSON.parse(localStorage.getItem(key))?.drinkId;});assert.equal(await page.locator('.gacha-machine').getAttribute('data-test-continuity'),'opening','a drink reply during opening cannot restart the animation');
  await phase(1,GACHA_OPEN_MS);await page.evaluate(duration=>window.gachaTestTimers[duration](),GACHA_OPEN_MS);await page.waitForSelector('.gacha-ticket.is-unfolding',{state:'attached'});assert.equal(await page.locator('.gacha-ticket').getAttribute('inert'),'');
  const folded=await phase(0,GACHA_UNFOLD_MS),unfolded=await phase(.7,GACHA_UNFOLD_MS);assert.equal(folded.ticketOpacity,0);assert.equal(unfolded.ticketOpacity,1);await page.screenshot({path:`/tmp/gacha-unfolding-${width}.png`,fullPage:true});
  await phase(1,GACHA_UNFOLD_MS);await page.evaluate(duration=>window.gachaTestTimers[duration](),GACHA_UNFOLD_MS);await page.waitForSelector('.gacha-ticket:not(.is-unfolding)');await page.waitForSelector('.gacha-drink');assert.equal(await page.locator('.gacha-ticket').getAttribute('inert'),null);assert.equal(await page.locator('.gacha-machine.is-spinning').count(),0);assert.equal(await page.locator('.gacha-machine.is-opened .gacha-capsule-out').evaluate(node=>getComputedStyle(node).opacity),'1');assert.equal(await page.evaluate(()=>document.activeElement.id),'gacha-result');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`/tmp/gacha-opened-result-${width}.png`,fullPage:true});
  const fortune=await page.locator('.gacha-fortune').innerText();await other.page.bringToFront();await other.page.locator('[data-action=gacha-draw]').click();await other.page.waitForSelector('.gacha-drink');assert.equal(await other.page.locator('.gacha-fortune').innerText(),fortune);assert.equal(other.reads.filter(action=>action==='gacha').length,0,'a second open tab reuses the first daily pairing');await page.bringToFront();
  const savedDraw=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key=>key.startsWith('holdwin-gacha-v1:')))));
  await page.locator('[data-action=gacha-replay]').click();
  for(const [selector,duration] of [['.is-spinning',GACHA_ANIMATION_MS],['.is-opening',GACHA_OPEN_MS],['.is-unfolding',GACHA_UNFOLD_MS]]){await page.waitForSelector(selector,{state:'attached'});await page.evaluate(duration=>window.gachaTestTimers[duration](),duration);}
  await page.waitForSelector('.gacha-ticket:not(.is-unfolding)');assert.equal(await page.locator('.gacha-fortune').innerText(),fortune);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key=>key.startsWith('holdwin-gacha-v1:'))))),savedDraw,'replay preserves the complete daily draw and recommendation');
  await page.locator('[data-action=gacha-replay]').click();await page.waitForSelector('.is-spinning');await page.evaluate(duration=>window.gachaTestTimers[duration](),GACHA_ANIMATION_MS);await page.waitForSelector('.is-opening');await page.evaluate(()=>location.hash='overview');await page.waitForSelector('.pantry-stage');await page.evaluate(duration=>window.gachaTestTimers[duration](),GACHA_OPEN_MS);assert.equal(await page.locator('body').getAttribute('data-view'),'overview','leaving during opening never returns to the draw');await page.evaluate(()=>location.hash='gacha');await page.waitForSelector('.gacha-ticket:not(.is-unfolding)');assert.equal(await page.locator('.gacha-fortune').innerText(),fortune);
  await page.evaluate(()=>{Date.now=()=>Date.parse('2026-11-04T08:00:00Z');document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>!document.querySelector('[data-action=gacha-draw]').disabled);assert.equal(await page.locator('.gacha-ticket').count(),0);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}: half-turn pause, rollout, split capsule, emerging note, unfolding fortune in the original location, uninterrupted drink reply, daily cross-tab reuse and midnight reset.`);
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
