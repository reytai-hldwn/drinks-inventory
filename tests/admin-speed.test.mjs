import test from 'node:test';import assert from 'node:assert/strict';
import {websiteBackend,memorySheet} from './helpers/google-website.mjs';
import {GoogleInventoryStore} from '../js/google-store.js';
const plain=x=>JSON.parse(JSON.stringify(x));
const storage=()=>{const values=new Map();return{values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const endpoint='https://script.google.com/macros/s/ADMIN_SPEED_TEST/exec';
function client(b,extra={}){const reads=[],disk=storage();let now=100000;const store=new GoogleInventoryStore({googleScriptUrl:endpoint},{pendingStorage:storage(),publicStorage:disk,now:()=>now,readPublicData:async(_url,options)=>{reads.push(options.action);return plain(options.action==='warehouse'?b.ctx.warehouseData_():options.action==='admin'?b.ctx.adminSummaryData_(options.force):b.ctx.publicData_());},submitWebsiteCommand:async(_url,command)=>{const receipt=b.send(command.operation,command.data,command.requestId);if(receipt.state==='rejected'){const error=Error(receipt.message);error.code='rejected';throw error;}return receipt.result;},...extra});return{store,reads,disk,setNow:value=>{now=value;}};}

test('confirmed restock updates the row and summary without a full read or extending stock freshness',async()=>{
 const b=websiteBackend(),c=client(b);await c.store.readWarehouse();const before=plain(c.store.data),readAt=c.store.warehouseSnapshot.readAt;c.setNow(readAt+1000);
 await c.store.setRestockPreference({kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'});assert.deepEqual(c.reads,['warehouse']);assert.equal(c.store.restockPreferences.find(row=>row.itemId==='milk').mode,'consider');assert.deepEqual(plain(c.store.data),before);assert.equal(c.store.warehouseSnapshot.readAt,readAt);
 const summary=await c.store.readAdminSummary();assert.equal(summary.restockItems[0].id,'milk');assert.deepEqual(c.reads,['warehouse']);
 await c.store.setRestockPreference({kind:'drink',itemId:'milk',mode:'normal',expectedMode:'consider'});assert.equal((await c.store.readAdminSummary()).restockItems.length,0);assert.deepEqual(c.reads,['warehouse']);
 c.setNow(readAt+31000);await c.store.openPublic();await c.store.openWarehouse();assert.deepEqual(c.reads,['warehouse','warehouse'],'expired memory is replaced');
});

test('old, incomplete or mismatched preference receipts retain the full-read fallback',async()=>{
 for(const variation of ['legacy','mismatch','missing']){
  const b=websiteBackend(),c=client(b,{submitWebsiteCommand:async(_url,command)=>{const result=b.send(command.operation,command.data,command.requestId).result;if(variation==='mismatch')result.itemId='another';if(variation==='missing')delete result.updatedAt;return result;}});await c.store.readWarehouse();if(variation==='legacy')c.store.fastRestockVersion=0;
  await c.store.setRestockPreference({kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'});assert.deepEqual(c.reads,['warehouse','warehouse']);assert.equal(c.store.restockPreferences.find(row=>row.itemId==='milk').mode,'consider');
 }
});

test('memory prefetch is shared, never changes the public view, never persists counts and expires in 30 seconds',async()=>{
 const b=websiteBackend();let release;const gate=new Promise(resolve=>{release=resolve;});const c=client(b,{readPublicData:async(_url,{action})=>{c.reads.push(action);if(action==='warehouse')await gate;return plain(action==='warehouse'?b.ctx.warehouseData_():b.ctx.publicData_());}});
 await c.store.init();const publicBefore=plain(c.store.data),first=c.store.prefetchWarehouse(),second=c.store.prefetchWarehouse();assert.deepEqual(c.reads,['public','warehouse']);release();await Promise.all([first,second]);assert.equal(c.store.inWarehouse,false);assert.deepEqual(plain(c.store.data),publicBefore);for(const raw of c.disk.values.values()){const saved=JSON.parse(raw).payload;assert.ok(saved.drinks.every(item=>item.stock===0&&item.lastCountAt===null));assert.equal(saved.events,undefined);assert.equal(saved.supplies,undefined);}
 await c.store.openWarehouse();assert.equal(c.reads.length,2);await c.store.openPublic();assert.ok(c.store.data.drinks.every(item=>item.stock===0&&item.lastCountAt===null));assert.equal(c.store.data.events.length,0);await c.store.openWarehouse();assert.equal(c.reads.length,2);
 c.setNow(131000);await c.store.openPublic();await c.store.openWarehouse();assert.equal(c.reads.length,3);await c.store.readWarehouse();assert.equal(c.reads.length,4,'explicit reads always get fresh data');
});

test('a pre-write warehouse response cannot overwrite a confirmed preference or warm stale memory',async()=>{
 const b=websiteBackend(),c=client(b);await c.store.readWarehouse();const old=plain(b.ctx.warehouseData_());let release;const gate=new Promise(resolve=>{release=resolve;});c.store.readPublicData=async()=>{await gate;return old;};const stale=c.store.readWarehouse();await c.store.setRestockPreference({kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'});release();await stale;assert.equal(c.store.restockPreferences.find(row=>row.itemId==='milk').mode,'consider');assert.equal(c.store.freshWarehouseSnapshot().result.restockPreferences.find(row=>row.itemId==='milk').mode,'consider');
});

test('flag confirmation after navigation keeps private preferences out of the public view',async()=>{
 const b=websiteBackend();let accept;const gate=new Promise(resolve=>{accept=resolve;});const c=client(b,{submitWebsiteCommand:async(_url,command)=>{await gate;return b.send(command.operation,command.data,command.requestId).result;}});await c.store.readWarehouse();const saving=c.store.setRestockPreference({kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'});await c.store.openPublic();accept();await saving;assert.equal(c.store.inWarehouse,false);assert.deepEqual(c.store.restockPreferences,[]);assert.equal(c.store.data.events.length,0);await c.store.openWarehouse();assert.equal(c.store.restockPreferences.find(row=>row.itemId==='milk').mode,'consider');
});

test('warehouse-derived summary agrees with the server and force refresh bypasses memory',async()=>{
 const b=websiteBackend();b.send('supply-stocktake',{recorder:'虛構',entries:[{supplyId:'supply-snack-01',quantity:2},{supplyId:'supply-noodle-01',quantity:1}]});for(const [kind,itemId]of [['drink','old'],['snack','supply-snack-01'],['noodle','supply-noodle-01']])b.send('restock-preference',{kind,itemId,mode:'consider',expectedMode:'normal'});
 const c=client(b);await c.store.readWarehouse();const fast=plain(await c.store.readAdminSummary()),fresh=plain(await c.store.readAdminSummary({force:true}));for(const key of ['lowItems','restockItems','recentCounts','recentArrivals'])assert.deepEqual(fast[key],fresh[key],key);assert.deepEqual(c.reads,['warehouse','admin']);
});

function seededViews(b){
 const headers=Array(11).fill('');headers[9]='狀態';b.sheets.Warehouse=memorySheet([[],[],[],[],[],headers,['milk','牛乳','牛乳／植物奶','鋁箔包','包',24,9,'原盤點',0,'',10]]);
 b.ctx.ensureSupplyStorage_(b.ss);b.sheets.SupplyWarehouse=memorySheet([['品項 ID','品項名稱','分類','單位','目前庫存','最近實際盤點','入庫批次保存期限','補貨標示'],['supply-snack-01','虛構零食','零食','包',2,'原日期','', '']]);
}
test('normal checkbox writes touch one generated label and never reread histories or rebuild views',()=>{
 for(const [kind,itemId,sheetName,row,column]of [['drink','milk','Warehouse',6,9],['snack','supply-snack-01','SupplyWarehouse',1,7]]){
  const b=websiteBackend();seededViews(b);const before=plain(b.sheets[sheetName].rows);for(const name of ['historyEvents_','supplyEvents_','computeInventory_','renderWarehouse_','renderSupplyWarehouse_'])b.ctx[name]=()=>{throw Error('unnecessary '+name);};
  assert.equal(b.send('restock-preference',{kind,itemId,mode:'consider',expectedMode:'normal'}).state,'accepted');before[row][column]='需要補貨';assert.deepEqual(plain(b.sheets[sheetName].rows),before);assert.equal(b.send('restock-preference',{kind,itemId,mode:'normal',expectedMode:'consider'}).state,'accepted');
 }
});

test('summary cache expires, invalidates on writes/edits, supports fresh=1 and does not cache an obsolete generation',()=>{
 const b=websiteBackend(),cache=new Map();let now=0,builds=0,puts=0;const original=b.ctx.buildAdminSummary_;b.ctx.buildAdminSummary_=()=>{builds++;return original();};b.ctx.CacheService={getScriptCache:()=>({get:key=>{const value=cache.get(key);return value&&value.until>now?value.json:null;},put:(key,json,seconds)=>{puts++;cache.set(key,{json,until:now+seconds*1000});}})};
 b.ctx.adminSummaryData_();b.ctx.adminSummaryData_();assert.equal(builds,1);b.ctx.doGet({parameter:{action:'admin',fresh:'1'}});assert.equal(builds,2);b.send('restock-preference',{kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'});assert.equal(b.ctx.adminSummaryData_().restockItems.length,1);assert.equal(builds,3);
 b.ctx.handleSheetEdit({range:{getSheet:()=>({getName:()=>b.ctx.SHEETS.supplyHistory})}});b.ctx.adminSummaryData_();assert.equal(builds,4);now=16000;b.ctx.adminSummaryData_();assert.equal(builds,5);
 const before=puts;b.ctx.buildAdminSummary_=()=>{const value=original();b.props.set('HOLDWIN_READ_REVISION','concurrent');return value;};b.ctx.adminSummaryData_(true);assert.equal(puts,before,'a concurrent generation is never cached under the old read');
});

test('an uncertain flag never patches the UI, and retry uses its original request exactly once',async()=>{
 const b=websiteBackend();let fail=true,requests=[];const c=client(b,{submitWebsiteCommand:async(_url,command)=>{requests.push(command.requestId);const receipt=b.send(command.operation,command.data,command.requestId);if(fail){fail=false;const error=Error('unconfirmed');error.code='pending';throw error;}return receipt.result;}});await c.store.readWarehouse();const data={kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'};await assert.rejects(c.store.setRestockPreference(data),/unconfirmed/);assert.equal(c.store.restockPreferences.length,0);await c.store.setRestockPreference(data);assert.equal(requests[0],requests[1]);assert.equal(b.sheets.RestockPreferences.rows.length,2);assert.equal(c.store.restockPreferences[0].mode,'consider');
});

test('later inventory writes invalidate warm memory and still wait for their real full refresh',async()=>{
 const b=websiteBackend(),c=client(b);await c.store.openWarehouse();await c.store.submitStocktake([{drinkId:'milk',quantity:4}],'虛構');assert.deepEqual(c.reads,['warehouse','warehouse']);assert.equal(c.store.data.drinks.find(item=>item.id==='milk').stock,4);assert.equal(c.store.freshWarehouseSnapshot().result.data.drinks.find(item=>item.id==='milk').stock,4);assert.equal((await c.store.readAdminSummary()).lowItems.find(item=>item.id==='milk').stock,4);
});

test('recovered older intent cannot put a superseded flag back into a generated view',()=>{
 const b=websiteBackend();seededViews(b);const original=b.ctx.updateRestockView_;let fail=true;b.ctx.updateRestockView_=(...args)=>{if(fail){fail=false;throw Error('view interrupted');}return original(...args);};
 const first='restock-recovery-request-00000001';assert.throws(()=>b.send('restock-preference',{kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'},first));assert.equal(b.send('restock-preference',{kind:'drink',itemId:'milk',mode:'normal',expectedMode:'consider'}).state,'accepted');const result=b.send('restock-preference',{kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'},first);assert.equal(result.state,'accepted');assert.equal(result.result.mode,'normal');assert.equal(b.sheets.Warehouse.rows[6][9],'');
});

test('short server warehouse cache holds real-size DTOs, expires and honors explicit refresh',()=>{
 const b=websiteBackend(),cache=new Map();let now=0,builds=0;const original=b.ctx.buildWarehouseData_;b.ctx.buildWarehouseData_=()=>{builds++;const value=original();value.cacheSizeFixture='x'.repeat(40000);return value;};b.ctx.CacheService={getScriptCache:()=>({get:key=>{const value=cache.get(key);return value&&value.until>now?value.json:null;},put:(key,json,seconds)=>cache.set(key,{json,until:now+seconds*1000})})};
 b.ctx.warehouseData_();b.ctx.warehouseData_();assert.equal(builds,1);b.ctx.doGet({parameter:{action:'warehouse',fresh:'1'}});assert.equal(builds,2);now=9000;b.ctx.warehouseData_();assert.equal(builds,3);b.send('restock-preference',{kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'});const fresh=b.ctx.warehouseData_();assert.equal(builds,4);assert.equal(fresh.restockPreferences[0].mode,'consider');
});
