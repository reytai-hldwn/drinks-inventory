import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {websiteBackend} from './helpers/google-website.mjs';
import {GoogleInventoryStore} from '../js/google-store.js';
import {inventoryTotals,normalizeInventoryTotals} from '../js/inventory-activity.js';
const code='8642',plain=x=>JSON.parse(JSON.stringify(x)),intent={kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'};
const storage=()=>{const values=new Map();return {values,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
const domain=b=>plain({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows,supplies:b.sheets.SupplyCatalog?.rows,supplyHistory:b.sheets.SupplyHistory?.rows,prefs:b.sheets.RestockPreferences?.rows});
function client(b,extra={}){const disk=storage(),pending=storage(),reads=[],posts=[];let now=0;const store=new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/PIN_TEST/exec'},{publicStorage:disk,pendingStorage:pending,now:()=>now,readPublicData:async(_url,opts)=>{reads.push(opts.action);return plain(opts.action==='warehouse'?b.ctx.warehouseData_():opts.action==='admin'?b.ctx.adminSummaryData_():b.ctx.publicData_());},submitWebsiteCommand:async(_url,command)=>{posts.push(command);const receipt=b.send(command.operation,command.data,command.requestId);if(receipt.state==='rejected'){const error=new Error(receipt.message);error.code=receipt.errorCode;throw error;}return receipt.result;},...extra});return {store,disk,pending,reads,posts,setNow:value=>{now=value;}};}

test('configured code protects setting/canceling and the legacy zero-stock path before catalog reads',()=>{
 const b=websiteBackend();b.ctx.ensureSupplyStorage_(b.ss);b.props.set('HOLDWIN_RESTOCK_PIN',code);const before=domain(b),catalog=b.ctx.catalog_;b.ctx.catalog_=()=>{throw Error('must authenticate before reads');};
 for(const pin of [undefined,'9999',8642,'',null])for(const operation of ['restock-preference','zero-stock-decision']){
  const result=b.send(operation,{...intent,restockPin:pin});assert.equal(result.state,'rejected');assert.equal(result.errorCode,'restock_auth');assert.deepEqual(domain(b),before);
 }
 b.ctx.catalog_=catalog;
 assert.equal(b.send('restock-preference',{...intent,restockPin:code}).state,'accepted');
 const cancel={...intent,mode:'normal',expectedMode:'consider'};
 assert.equal(b.send('restock-preference',cancel).errorCode,'restock_auth');assert.equal(b.ctx.restockPreferences_(b.ss)[0].mode,'consider');
 assert.equal(b.send('restock-preference',{...cancel,restockPin:code}).state,'accepted');
 assert.equal(b.ctx.publicData_().websiteEntry.restockAuthVersion,1);
 for(const raw of [JSON.stringify(b.sheets.WebsiteRequests.rows),JSON.stringify(b.ctx.warehouseData_()),JSON.stringify(b.ctx.adminSummaryData_())])assert.ok(!raw.includes(JSON.stringify(code)),'code never appears in stored rows or read models');
 const a={operation:'restock-preference',data:intent};assert.equal(b.ctx.websiteFingerprint_(a),b.ctx.websiteFingerprint_({...a,data:{...intent,restockPin:code}}));
 const wish=b.send('wish',{kind:'drink',name:'測試願望',url:'',note:''});assert.equal(wish.state,'accepted','unrelated forms need no code');
});

test('private setup is optional for old installations and malformed nonempty setup fails closed',()=>{
 const b=websiteBackend();assert.equal(b.ctx.publicData_().websiteEntry.restockAuthVersion,0);assert.equal(b.send('restock-preference',intent).state,'accepted');
 b.props.set('HOLDWIN_RESTOCK_PIN',' 1234');assert.equal(b.ctx.publicData_().websiteEntry.restockAuthVersion,1);assert.equal(b.send('restock-preference',{...intent,mode:'normal',expectedMode:'consider',restockPin:' 1234'}).errorCode,'restock_auth');
 b.props.set('HOLDWIN_RESTOCK_PIN','0864');assert.equal(b.send('restock-preference',{...intent,mode:'normal',expectedMode:'consider',restockPin:'0864'}).state,'accepted','leading zero is retained');
});

test('verification and first save share one POST; secrets stay in tab memory and out of pending storage',async()=>{
 const b=websiteBackend();b.props.set('HOLDWIN_RESTOCK_PIN',code);const c=client(b);await c.store.readWarehouse();
 assert.equal(c.store.requiresRestockAuth,true);assert.equal(c.store.hasRestockAuthorization,false);
 await assert.rejects(c.store.setRestockPreference(intent),e=>e.code==='restock_auth');assert.equal(c.posts.length,0);
 c.store.setRestockCode('9999');await assert.rejects(c.store.setRestockPreference(intent),e=>e.code==='restock_auth');assert.equal(c.store.hasRestockAuthorization,false);assert.equal(c.pending.values.size,0);
 c.store.setRestockCode(code);await c.store.setRestockPreference(intent);assert.equal(c.store.hasRestockAuthorization,true);assert.equal(c.posts.length,2);assert.deepEqual(c.reads,['warehouse']);
 await c.store.setRestockPreference({...intent,mode:'normal',expectedMode:'consider'});assert.equal(c.posts.length,3);assert.deepEqual(c.reads,['warehouse']);
 assert.equal(JSON.stringify(c.store).includes(JSON.stringify(code)),false);for(const raw of [...c.disk.values.values(),...c.pending.values.values()])assert.equal(raw.includes(JSON.stringify(code)),false);
 const next=client(b);await next.store.readWarehouse();assert.equal(next.store.hasRestockAuthorization,false);
 c.setNow(30*60*1000);assert.equal(c.store.hasRestockAuthorization,false);await assert.rejects(c.store.setRestockPreference(intent),e=>e.code==='restock_auth');assert.equal(c.posts.length,3);
});

test('changed private code invalidates the remembered code and a rejected intent can use a new request',async()=>{
 const b=websiteBackend();b.props.set('HOLDWIN_RESTOCK_PIN',code);const c=client(b);await c.store.readWarehouse();c.store.setRestockCode(code);await c.store.setRestockPreference(intent);
 b.props.set('HOLDWIN_RESTOCK_PIN','4682');const cancel={...intent,mode:'normal',expectedMode:'consider'};
 await assert.rejects(c.store.setRestockPreference(cancel),e=>e.code==='restock_auth');assert.equal(c.store.hasRestockAuthorization,false);assert.equal(c.store.restockPreferences[0].mode,'consider');c.store.setRestockCode('4682');await c.store.setRestockPreference(cancel);assert.equal(c.store.restockPreferences[0].mode,'normal');assert.notEqual(c.posts[1].requestId,c.posts[2].requestId);
});

test('uncertain retries preserve authorized intent without storing the code or accepting changed business data',async()=>{
 const b=websiteBackend();b.props.set('HOLDWIN_RESTOCK_PIN',code);let first=true;const c=client(b,{submitWebsiteCommand:async(_url,command)=>{c.posts.push(command);const receipt=b.send(command.operation,command.data,command.requestId);if(first){first=false;const error=Error('pending');error.code='pending';throw error;}return receipt.result;}});
 await c.store.readWarehouse();c.store.setRestockCode(code);await assert.rejects(c.store.setRestockPreference(intent),/pending/);assert.equal(c.store.hasRestockAuthorization,false);assert.equal(c.store.restockPreferences.length,0);for(const raw of c.pending.values.values())assert.ok(!raw.includes(JSON.stringify(code)));
 await c.store.setRestockPreference(intent);assert.equal(c.posts[0].requestId,c.posts[1].requestId);assert.equal(c.store.hasRestockAuthorization,false,'recovered receipts do not validate a new code candidate');assert.equal(b.sheets.RestockPreferences.rows.length,2);
 assert.throws(()=>b.send('restock-preference',{...intent,mode:'normal',restockPin:code},c.posts[0].requestId),/request_conflict/);
});

test('authentication metadata cache changes on configuration without exposing the private value',()=>{
 const b=websiteBackend(),cache=new Map();b.ctx.CacheService={getScriptCache:()=>({get:key=>cache.get(key)||null,put:(key,json)=>cache.set(key,json)})};
 assert.equal(b.ctx.warehouseData_().websiteEntry.restockAuthVersion,0);b.props.set('HOLDWIN_RESTOCK_PIN',code);assert.equal(b.ctx.warehouseData_().websiteEntry.restockAuthVersion,1);
 for(const [key,value]of cache)assert.ok(!value.includes(JSON.stringify(code)));
 // Cache readers reject old/raw DTOs even if accidentally placed at a new key.
 for(const key of cache.keys())cache.set(key,JSON.stringify({ok:true,stale:true}));assert.notEqual(b.ctx.warehouseData_().stale,true);
});

test('totals use every latest balance and all later arrivals, independent of the most recent count batch',async()=>{
 const b=websiteBackend();b.ctx.ensureSupplyStorage_(b.ss);b.send('stocktake',{entries:[{drinkId:'milk',quantity:3}],recorder:'虛構'});b.send('arrival',{drinkId:'tea',cases:0,loose:4,recorder:'虛構',note:''});
 b.send('supply-stocktake',{entries:[{supplyId:'supply-snack-01',quantity:0},{supplyId:'supply-noodle-01',quantity:6}],recorder:'虛構'});
 b.sheets.Catalog.rows.push(['unmeasured','待盤點品項','茶飲','鐵罐','罐',24,10,true]);b.sheets.Catalog.rows.push(['historic-positive','歷史餘量','茶飲','鐵罐','罐',24,10,false]);b.sheets.History.rows.push(['h-count','2020-01-02T00:00:00Z','count','historic-positive','歷史餘量',2,'','虛構','採計']);
 const c=client(b);await c.store.readWarehouse();const warm=plain(await c.store.readAdminSummary()),fresh=plain(await c.store.readAdminSummary({force:true}));assert.deepEqual(warm.inventoryTotals,fresh.inventoryTotals);
 const drinks=fresh.inventoryTotals.find(g=>g.kind==='drink');assert.equal(drinks.items.find(i=>i.id==='tea').stock,24);assert.equal(drinks.items.find(i=>i.id==='milk').stock,3);assert.equal(drinks.items.length,3);assert.equal(drinks.unknownCount,1);assert.equal(drinks.items.find(i=>i.id==='historic-positive').active,false);
 assert.equal(fresh.inventoryTotals.find(g=>g.kind==='noodle').items.find(i=>i.id==='supply-noodle-01').stock,6);assert.equal(fresh.inventoryTotals.find(g=>g.kind==='snack').items.length,0);
 assert.equal(fresh.recentCounts.find(g=>g.kind==='drink').items.length,1,'fixture reproduces partial recent count, not total');
 assert.deepEqual(normalizeInventoryTotals(fresh.inventoryTotals),fresh.inventoryTotals);
 for(const bad of [[],[...fresh.inventoryTotals.slice(0,3),fresh.inventoryTotals[0]],fresh.inventoryTotals.map(g=>g.kind==='drink'?{...g,items:[{...g.items[0],stock:NaN}]}:g)])assert.throws(()=>normalizeInventoryTotals(bad));
 assert.equal(inventoryTotals([{kind:'drink',id:'zero',stock:0,active:true},{kind:'drink',id:'unknown',stock:null,active:true}])[0].items.length,0);
});
