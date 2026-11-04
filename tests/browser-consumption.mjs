// Fictional stocktake quantities only; production writes are never used.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
const {chromium}=await import(process.env.PANTRY_PLAYWRIGHT_MODULE||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url)),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.avif':'image/avif'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');if(!path.startsWith(root.replace(/\/$/,'')+sep))throw new Error('missing');res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,endpoint='https://script.google.com/macros/s/CONSUMPTION_FIXTURE/exec',ago=days=>new Date(Date.now()-days*86400000).toISOString();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{for(const width of [1440,390]){
 const b=websiteBackend();b.sheets.Catalog.rows.splice(1,99,
  ['a','立頓原味奶茶','茶飲','鋁箔包','包',24,10,true],['b','Milkis','汽水','長鐵罐','罐',24,10,true],['c','原萃綠茶','茶飲','寶特瓶','瓶',24,10,true],
  ['pending','尚在等盤點','茶飲','鋁箔包','包',24,10,true],['empty','區間內無庫存','茶飲','鋁箔包','包',24,10,true],['unused','未觀察到消耗','茶飲','鋁箔包','包',24,10,true],['old','測試歷史品項','茶飲','鋁箔包','包',24,10,false]);
 b.sheets.History.rows.splice(1);
 for(const [id,first,last,start,end]of [['a',50,22,14,7],['b',30,9,14,7],['c',20,6,14,7],['empty',0,0,14,7],['unused',3,3,14,7],['old',60,11,60,53]])for(const [suffix,days,quantity]of [['first',start,first],['last',end,last]])b.sheets.History.rows.push([`${id}-${suffix}`,ago(days),'count',id,id,quantity,'測試區間','測試人','採計']);
 b.ctx.ensureSupplyStorage_(b.ss);
 for(const [id,first,last]of [['supply-snack-01',20,6],['supply-snack-02',12,5]])for(const [suffix,days,quantity]of [['first',14,first],['last',7,last]])b.sheets.SupplyHistory.rows.push([`${id}-${suffix}`,ago(days),'count',id,id,quantity,'測試區間','測試人','採計','','']);
 const original=structuredClone({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows,supplies:b.sheets.SupplyHistory.rows});
 const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),page=await context.newPage(),reads=[],writes=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
 await page.route(`${endpoint}**`,route=>{if(route.request().method()!=='GET'){writes.push(route.request().method());return route.abort();}const parameter=Object.fromEntries(new URL(route.request().url()).searchParams);reads.push(parameter.action);return route.fulfill({contentType:'application/javascript',body:b.ctx.doGet({parameter}).body});});
 await page.goto(base+'/#consumption');await page.waitForSelector('[data-ranking-item]');
 assert.deepEqual(await page.locator('[data-action=ranking-kind]').evaluateAll(nodes=>nodes.map(node=>node.dataset.id)),['drink','snack']);
 const ids=()=>page.locator('[data-ranking-item]').evaluateAll(nodes=>nodes.map(node=>node.dataset.rankingItem));
 assert.deepEqual(await ids(),['a','b','c']);assert.equal(await page.locator('[data-ranking-filter=unit]').inputValue(),'*');assert.equal(await page.locator('.ranking-winner').count(),3);assert.match(await page.locator('.ranking-winner').first().innerText(),/換算每工作週/);assert.match(await page.locator('.ranking-observation').first().innerText(),/觀察 5 個工作日 · 消耗 28 包/);
 await page.locator('[data-ranking-item=a] .ranking-evidence>summary').focus();await page.keyboard.press('Enter');assert.match(await page.locator('[data-ranking-item=a] .ranking-intervals').innerText(),/盤點 50 ＋入庫 0 −盤點 22 ＝ 28 包/);
 await page.screenshot({path:`/tmp/consumption-ranking-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('#ranking-search').fill('Milkis');assert.deepEqual(await ids(),['b']);assert.equal(await page.evaluate(()=>document.activeElement.id),'ranking-search');await page.locator('#ranking-search').fill('');
 await page.locator('[data-ranking-filter=unit]').selectOption('包');assert.deepEqual(await ids(),['a']);await page.locator('[data-ranking-filter=unit]').selectOption('*');
 await page.locator('[data-ranking-filter=category]').selectOption('汽水');assert.deepEqual(await ids(),['b']);await page.locator('[data-ranking-filter=category]').selectOption('');
 await page.locator('[data-ranking-filter=archived]').check();assert.deepEqual(await ids(),['old','a','b','c']);await page.locator('[data-ranking-filter=days]').selectOption('30');assert.deepEqual(await ids(),['a','b','c']);
 await page.locator('[data-action=ranking-kind][data-id=snack]').click();assert.deepEqual(await ids(),['supply-snack-01','supply-snack-02']);await page.locator('#ranking-search').fill('雙倍起司');assert.deepEqual(await ids(),['supply-snack-01']);await page.locator('.ranking-evidence>summary').click();assert.match(await page.locator('.ranking-flavors').innerText(),/香菜/);
 await page.screenshot({path:`/tmp/consumption-flavors-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(reads,['warehouse'],'all ranking filters reuse the one warehouse snapshot');assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);assert.deepEqual({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows,supplies:b.sheets.SupplyHistory.rows},original);
 await context.close();console.log(`PASS ${width}: drink packages ranked together, two kinds only, measured podium, period/unit/category/search/history filters, flavor comparison, keyboard details, one read, zero writes.`);
}
 const b=websiteBackend();b.sheets.History.rows.splice(1);const context=await browser.newContext({viewport:{width:390,height:960}}),page=await context.newPage();
 await page.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:`window.DRINKS_CONFIG=${JSON.stringify({provider:'google',googleScriptUrl:endpoint})};`}));
 await page.route(`${endpoint}**`,r=>r.fulfill({contentType:'application/javascript',body:b.ctx.doGet({parameter:Object.fromEntries(new URL(r.request().url()).searchParams)}).body}));
 await page.goto(base+'/#consumption');await page.waitForSelector('.ranking-empty');assert.match(await page.locator('.ranking-empty').innerText(),/排行榜準備中/);assert.equal(await page.locator('.ranking-winner').count(),0);assert.equal(await page.locator('[data-ranking-item]').count(),0);await page.screenshot({path:'/tmp/consumption-empty-390.png',fullPage:true});await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
