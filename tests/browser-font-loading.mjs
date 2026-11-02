// Website-only font shards; fictional demo data, no Google writes or external reads.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url)),manifest=JSON.parse(await readFile(resolve(root,'assets/pantry-font-fallbacks.json')));
const probes=manifest.filter(row=>row.start>=0x4E00&&row.end<=0x9FFF).filter((_,index)=>index%12===0).slice(0,2);
assert.equal(probes.length,2);
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.avif':'image/avif'};
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html',path=resolve(root,name);if(!path.startsWith(root.replace(/\/$/,'')+sep)||!/^(?:index\.html|config\.js|theme\.js|(?:styles|themes|fridge|pantry)\.css|(?:assets|js)\/[A-Za-z0-9_.\/-]+)$/.test(name))throw new Error('missing');res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(name==='config.js'?'window.DRINKS_CONFIG={};':await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:960}}),page=await context.newPage(),requests=[],errors=[];
  page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForSelector('.pantry-stage');await page.evaluate(()=>document.fonts.ready);
  assert.equal(requests.filter(url=>url.includes('/assets/fonts/')).length,0,'known headings need only the UI subset');
  await page.evaluate(codes=>{document.querySelector('h1').textContent=codes.map(code=>String.fromCodePoint(code)).join('');},probes.map(row=>row.probe));
  await page.evaluate(()=>document.fonts.ready);
  const shards=requests.filter(url=>url.includes('/assets/fonts/'));assert.equal(shards.length,2);assert.ok(probes.every(row=>shards.some(url=>url.endsWith(row.file.slice(1)))));
  assert.ok(requests.every(url=>!url.includes('pantry-hand-complete.woff2')),'uncommon headings never download the complete font');
  const bytes=await page.evaluate(()=>performance.getEntriesByType('resource').filter(row=>row.name.includes('/assets/fonts/')).reduce((total,row)=>total+row.encodedBodySize,0));
  assert.ok(bytes>0&&bytes<500000);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,uncommonHeadingShards:shards.length,bytes,fullFontDownloads:0}));await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
