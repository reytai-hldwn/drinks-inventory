// Optional browser check: requires Chromium and Playwright Core. Uses the real
// UI with intercepted Google reads, never the owner's spreadsheet.
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
    if(!/^(?:index\.html|demo\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name))throw new Error('not found');
    const path=resolve(root,name);if(!path.startsWith(root.replace(/\/$/,'')+sep))throw new Error('not found');
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
  }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/TEST_SCENE/exec';
const browser=await chromium.launch({executablePath:process.env.PANTRY_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
  for(const [width,height] of [[1026,1330],[2191,1444],[1440,900],[1920,1080],[1024,768],[1280,1024],[2560,1440],[390,844]]){
    const backend=websiteBackend();
    backend.sheets.Catalog.rows.splice(1,99,...createCompanyData().drinks.map(d=>[d.id,d.name,d.category,d.packaging,d.unit,d.perCase,d.threshold,d.active]));
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
    page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
    await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
    await page.route(`${endpoint}**`,route=>{
      assert.equal(route.request().method(),'GET');const parameter=Object.fromEntries(new URL(route.request().url()).searchParams);
      return route.fulfill({contentType:'application/javascript',body:backend.ctx.doGet({parameter}).body});
    });
    const ready=async()=>{
      await page.waitForSelector('.pantry-stage[data-scene]');
      await page.evaluate(async()=>{
        await document.fonts.ready;
        const kind=document.querySelector('.pantry-stage').dataset.scene;
        if(kind==='mobile')return;
        const src=document.querySelector(`.pantry-office-${kind} image`).getAttribute('href');
        await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=src;});
      });
    };
    const geometry=()=>page.evaluate(()=>{
      const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
      const kind=document.querySelector('.pantry-stage').dataset.scene;
      return {kind,stage:rect('.pantry-stage'),room:rect('.pantry-room'),door:rect('.fridge-door'),pageWidth:document.documentElement.scrollWidth};
    });
    const inspect=async()=>{
      await ready();const data=await geometry();assert.ok(data.pageWidth<=page.viewportSize().width+1);
      if(page.viewportSize().width<=900){
        assert.equal(data.kind,'mobile');assert.equal(await page.locator('.fridge-open-guide').isVisible(),false);
        assert.equal(await page.locator('.pantry-mobile-scene > svg').getAttribute('viewBox'),'1388 388 347 475');
        assert.ok(requests.every(url=>!url.includes('pantry-office-')),'phone does not download desktop artwork');
        return;
      }
      const {kind,stage,room,door}=data;
      const dimensions=kind==='wide'?[1672,941]:[1122,1402];
      assert.ok(Math.abs(room.w/room.h-dimensions[0]/dimensions[1])<0.002);
      assert.ok(room.x<=stage.x+2&&room.right>=stage.right-2&&room.y<=stage.y+2&&room.bottom>=stage.bottom-2,'art fills the stage');
      assert.ok(door.x>=stage.x-1&&door.right<=stage.right+1&&door.y>=stage.y-1&&door.bottom<=stage.bottom+1,'entire fridge remains in view');
      const points=kind==='wide'?[[966,334],[1450,350],[1080,650],[1400,540]]:[[674,581],[995,540],[766,990],[1010,806]];
      for(const [x,y] of points){const px=room.x+x/dimensions[0]*room.w,py=room.y+y/dimensions[1]*room.h;assert.ok(px>=stage.x&&px<=stage.right&&py>=stage.y&&py<=stage.bottom,'TV, city and both chair rows stay visible');}
      assert.equal(await page.locator(`.fridge-guide-${kind} text`).textContent(),'點擊打開冰箱');
      const bubble=await page.locator(`.fridge-guide-${kind} .guide-bubble`).boundingBox();
      assert.ok(bubble.x>=stage.x&&bubble.x+bubble.width<=door.x+5&&bubble.y>=stage.y&&bubble.y+bubble.height<=stage.bottom,'small cloud label stays visible to the left of the fridge');
      const tip=await page.locator(`.fridge-guide-${kind}`).evaluate(svg=>{
        const path=svg.querySelector('.guide-arrow'),end=path.getPointAtLength(path.getTotalLength()),p=end.matrixTransform(svg.getScreenCTM());return{x:p.x,y:p.y};
      });
      assert.ok(tip.x>=door.x&&tip.x<=door.right&&tip.y>=door.y&&tip.y<=door.bottom,'arrow points into the clickable fridge');
      const arrow=await page.locator(`.fridge-guide-${kind} .guide-gold-arrow`).boundingBox();
      assert.ok(arrow.width<stage.w*.095&&arrow.height<stage.h*.075,'gold loop arrow stays compact');
      assert.equal(await page.locator(`.pantry-office-${kind} .pantry-painted-door`).count(),4);
    };
    await page.goto(`${base}/index.html`);await inspect();
    if([1026,2191,1440,390].includes(width))await page.screenshot({path:`/tmp/pantry-new-${width}-closed.png`,fullPage:true});
    assert.equal(await page.locator('.fridge-panel > .toolbar').isVisible(),false);
    if(width>900){
      await page.locator('.fridge-open-guide').focus();await page.keyboard.press('Enter');await page.waitForSelector('.fridge.is-ready');
      assert.equal(await page.locator('.fridge-open-guide').isVisible(),false);await page.locator('.fridge-close').click();
    }
    await page.locator('.fridge-door').click();await page.waitForSelector('.fridge.is-ready');
    assert.equal(await page.locator('.fridge-product').count(),32);assert.equal(await page.locator('.fridge-panel > .toolbar').isVisible(),true);
    const scrolled=await page.locator('.fridge-interior').evaluate(e=>{e.scrollTop=e.scrollHeight;return e.scrollTop;});assert.ok(scrolled>0);
    await page.locator('#search').fill('光泉牛乳');await page.waitForFunction(()=>document.querySelectorAll('.fridge-product').length===1);
    await page.locator('.fridge-close').click();assert.equal(await page.locator('.fridge-panel > .toolbar').isVisible(),false);
    if(width===1440){
      for(const [nextWidth,nextHeight] of [[1026,1330],[1280,1024],[1920,1080],[1440,900]]){
        await page.setViewportSize({width:nextWidth,height:nextHeight});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await inspect();
        await page.locator('.fridge-open-guide').click();await page.waitForSelector('.fridge.is-ready');await page.locator('.fridge-close').click();
      }
    }
    assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height}: visible office/chair rows, comic bubble left of fridge, arrow aligned after cropping/resizing, keyboard opening, shelves/search; original mobile retained`);
    await context.close();
  }
  // Normal motion must visibly open the doors before the shelf/zoom covers them.
  // Reduced-motion checks above cannot catch overlapping or skipped animation.
  for(const [width,height] of [[1440,900],[1026,1330]]){
    const backend=websiteBackend(),context=await browser.newContext({viewport:{width,height},reducedMotion:'no-preference'}),page=await context.newPage();
    backend.sheets.Catalog.rows.splice(1,99,...createCompanyData().drinks.map(d=>[d.id,d.name,d.category,d.packaging,d.unit,d.perCase,d.threshold,d.active]));
    await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
    await page.route(`${endpoint}**`,route=>route.fulfill({contentType:'application/javascript',body:backend.ctx.doGet({parameter:Object.fromEntries(new URL(route.request().url()).searchParams)}).body}));
    await page.goto(`${base}/index.html`);await page.waitForSelector('.pantry-stage[data-scene]');await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(async()=>{
      const stage=document.querySelector('.pantry-stage');
      await Promise.all([...stage.querySelectorAll(`.pantry-office-${stage.dataset.scene} image[href]`)].map(async element=>{
        const image=new Image();image.src=element.getAttribute('href');await image.decode();
      }));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    const before=await page.locator('.pantry-stage').evaluate(e=>({kind:e.dataset.scene,height:e.clientHeight}));
    await page.evaluate(()=>{
      window.fridgeMotion=[];
      document.querySelector('.fridge-open-guide').addEventListener('click',()=>{
        const started=performance.now(),stage=document.querySelector('.pantry-stage'),fridge=stage.querySelector('.fridge'),interior=stage.querySelector('.fridge-interior');
        const sample=()=>{
          const style=e=>getComputedStyle(e);
          window.fridgeMotion.push({elapsed:performance.now()-started,ready:fridge.classList.contains('is-ready'),kind:stage.dataset.scene,height:stage.clientHeight,roomOpacity:+style(stage.querySelector('.pantry-room')).opacity,interiorOpacity:+style(interior).opacity,inert:interior.inert,controlsHidden:document.querySelector('.fridge-panel > .toolbar').hidden,doors:[...stage.querySelectorAll(`.pantry-office-${stage.dataset.scene} .pantry-painted-door`)].map(e=>({opacity:+style(e).opacity,matrix:style(e).transform}))});
          if(!fridge.classList.contains('is-ready')&&performance.now()-started<1500)requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },{once:true});
    });
    await page.locator('.fridge-open-guide').click();await page.waitForFunction(()=>window.fridgeMotion.some(frame=>frame.ready));
    const frames=await page.evaluate(()=>window.fridgeMotion);
    const swinging=frames.find(frame=>frame.roomOpacity===1&&frame.interiorOpacity===0&&frame.doors.length===4&&frame.doors.every(door=>{
      if(door.opacity<.95||!door.matrix.startsWith('matrix3d('))return false;
      const matrix=door.matrix.slice(9,-1).split(',').map(Number);return Math.abs(matrix[2])>.1&&Math.abs(matrix[0])<.98;
    }));
    assert.ok(swinging,'all four doors visibly rotate before shelves cover them');
    for(const frame of frames.filter(frame=>!frame.ready)){
      assert.equal(frame.kind,before.kind);assert.equal(frame.height,before.height,'no layout jump during opening');assert.equal(frame.inert,true);assert.equal(frame.controlsHidden,true);
    }
    assert.ok(await page.locator(`.pantry-office-${before.kind} .pantry-recess-interior image[href]`).count()>0,'actual drink images fill the opening instead of a blank recess');
    assert.ok(frames.some(frame=>frame.roomOpacity<1&&frame.roomOpacity>0&&frame.interiorOpacity>0&&frame.interiorOpacity<1),'shelves fade in during the zoom without a pause');
    assert.ok(frames.find(frame=>frame.ready).elapsed<1000,'opening finishes promptly');
    assert.equal(await page.locator('.fridge-interior').evaluate(e=>e.inert),false);
    assert.equal(await page.locator('.fridge-panel > .toolbar').isVisible(),true);
    await page.locator('.fridge-close').click();await page.waitForTimeout(900);
    // Cancel an opening via the real close action, then open again. The old
    // completion timer must not reveal controls over a closed scene.
    await page.locator('.fridge-open-guide').click();await page.waitForTimeout(180);await page.locator('.fridge-close').dispatchEvent('click');
    await page.waitForTimeout(900);assert.equal(await page.locator('.fridge').getAttribute('data-door-state'),'closed');assert.equal(await page.locator('.fridge-panel > .toolbar').isVisible(),false);
    assert.equal(await page.locator('.fridge-interior').evaluate(e=>e.inert),true);
    await page.locator('.fridge-open-guide').click();await page.waitForSelector('.fridge.is-ready');
    console.log(`PASS ${width}x${height} normal motion: visible doors with stocked interior, continuous quick zoom, stable scene, cancel and reopen`);
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage(),external=[];
  page.on('request',request=>{if(!request.url().startsWith(base)&&!request.url().startsWith('data:'))external.push(request.url());});
  await page.goto(`${base}/demo.html`);await page.waitForSelector('.pantry-stage[data-scene=wide]');
  const embedded=await page.locator('.pantry-office-wide .pantry-scene-art image').getAttribute('href');assert.ok(embedded.startsWith('data:image/png;base64,'));
  const dimensions=await page.evaluate(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([image.naturalWidth,image.naturalHeight]);image.onerror=reject;image.src=src;}),embedded);
  assert.deepEqual(dimensions,[1672,941]);await page.locator('.fridge-open-guide').click();await page.waitForSelector('.fridge.is-ready');
  assert.equal(await page.locator('.fridge-product').count(),32);assert.deepEqual(external,[]);
  console.log('PASS standalone preview: native PNG and vector hint work without external requests');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
