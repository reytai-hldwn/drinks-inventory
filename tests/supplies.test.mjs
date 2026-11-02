import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SUPPLY_CATALOG,initialSupplies,normalizeSupplyWarehouse,supplyBatches,supplyHasUntrackedExpiry,supplyExpiryStatus,supplyToday,validSupplyExpiry} from '../js/supplies.js';
import {GoogleInventoryStore,normalizeGooglePublicData} from '../js/google-store.js';
import {InventoryStore} from '../js/store.js';
import {websiteBackend,memorySheet} from './helpers/google-website.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));
const storage=()=>{const values=new Map();return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const endpoint='https://script.google.com/macros/s/SUPPLY_TEST/exec';

test('confirmed supply catalog has five cup/bowl noodles and exactly four boxed toner colors',()=>{
  assert.deepEqual(SUPPLY_CATALOG.filter(item=>item.kind==='noodle').map(item=>[item.name,item.unit]),[
    ['來一客海鮮','杯'],['滿漢大餐牛肉麵','碗'],['拉麵道味噌拉麵','杯'],['拉麵道豚骨拉麵','杯'],['奶油白醬辣火雞麵','杯']]);
  assert.deepEqual(SUPPLY_CATALOG.filter(item=>item.kind==='toner').map(item=>[item.name,item.unit]),[
    ['黑色碳粉','盒'],['黃色碳粉','盒'],['紅色碳粉','盒'],['藍色碳粉','盒']]);
  assert.ok(initialSupplies().every(item=>item.stock===null&&item.lastCountAt===null&&!('perCase' in item)));
  const backend=websiteBackend();assert.deepEqual(plain(backend.ctx.INITIAL_SUPPLIES),plain(SUPPLY_CATALOG));
});

test('read-only warehouse upgrade exposes pending supply rows, without changing sheets or public drinks',()=>{
  const backend=websiteBackend(),before=Object.keys(backend.sheets);
  const data=plain(backend.ctx.warehouseData_());assert.equal(data.supplies.length,9);assert.deepEqual(data.supplyEvents,[]);
  assert.ok(data.supplies.every(item=>item.stock===null));assert.deepEqual(Object.keys(backend.sheets),before);
  const front=plain(backend.ctx.publicData_());assert.equal(front.supplies,undefined);assert.equal(front.supplyEvents,undefined);
  const normalized=normalizeGooglePublicData(data,{warehouse:true});assert.equal(normalized.supplyEntryVersion,1);assert.equal(normalized.supplies.length,9);
  assert.equal(normalizeGooglePublicData(data).supplies.length,0,'public cache cannot retain supply observations');
  assert.deepEqual(normalizeSupplyWarehouse({}),{supplies:[],supplyEvents:[],supplyEntryVersion:0,supplyExpiryVersion:0});
  for(const alter of [item=>{item.stock=-1;},item=>{item.unit='箱';},item=>{item.id='supply-toner-green';}]){
    const invalid=structuredClone(data),item=invalid.supplies.find(item=>item.kind==='toner');alter(item);assert.throws(()=>normalizeSupplyWarehouse(invalid));
  }
});

test('supply writes preserve drinks and retries, require observed counts, and add single units with stable same-time ordering',()=>{
  const backend=websiteBackend(),before=plain({catalog:backend.sheets.Catalog.rows,history:backend.sheets.History.rows});
  const stamp='2026-11-02T04:00:00Z',RealDate=Date;
  backend.ctx.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[stamp]));}};
  const id='supply-noodle-01',toner='supply-toner-black';
  assert.equal(backend.send('supply-arrival',{supplyId:id,quantity:4,recorder:'小王',expiresOn:'2099-12-31'}).state,'accepted');
  let data=plain(backend.ctx.warehouseData_());assert.equal(data.supplies.find(item=>item.id===id).stock,null,'an arrival cannot invent an initial balance');
  backend.send('supply-stocktake',{entries:[{supplyId:id,quantity:0},{supplyId:toner,quantity:3}],recorder:'小王'});
  const requestId=randomUUID(),command={supplyId:id,quantity:7,recorder:'小李',note:'本次到貨',expiresOn:'2099-12-31'};
  backend.send('supply-arrival',command,requestId);backend.send('supply-arrival',command,requestId);
  data=plain(backend.ctx.warehouseData_());assert.equal(data.supplies.find(item=>item.id===id).stock,7,'later arrival at the same timestamp is retained');
  assert.equal(data.supplies.find(item=>item.id===toner).stock,3);assert.equal(data.supplyEvents.length,4);
  assert.equal(data.supplyEvents.filter(event=>event.id.includes(requestId)).length,1);
  assert.deepEqual(plain({catalog:backend.sheets.Catalog.rows,history:backend.sheets.History.rows}),before);
  assert.equal(backend.sheets.SupplyCatalog.rows.length,10);assert.equal(backend.sheets.SupplyWarehouse.rows.length,10);
  assert.throws(()=>backend.send('supply-arrival',{...command,quantity:8},requestId),/request_conflict/);
});

test('supply commands reject invalid, duplicate, boxed, unnamed and cross-catalog requests atomically',()=>{
  for(const [operation,data] of [
    ['supply-arrival',{supplyId:'supply-toner-black',quantity:0,recorder:'小王'}],
    ['supply-arrival',{supplyId:'supply-toner-black',quantity:1.5,recorder:'小王'}],
    ['supply-arrival',{supplyId:'supply-toner-black',quantity:2,cases:1,recorder:'小王'}],
    ['supply-arrival',{supplyId:'supply-toner-green',quantity:2,recorder:'小王'}],
    ['supply-arrival',{supplyId:'tea',quantity:2,recorder:'小王'}],
    ['supply-arrival',{supplyId:'supply-toner-black',quantity:2,recorder:' '}],
    ['supply-stocktake',{entries:[],recorder:'小王'}],
    ['supply-stocktake',{entries:[{supplyId:'supply-noodle-01',quantity:2},{supplyId:'supply-noodle-01',quantity:3}],recorder:'小王'}],
    ['supply-stocktake',{entries:[{supplyId:'supply-noodle-01',quantity:2},{supplyId:'supply-noodle-02',quantity:-1}],recorder:'小王'}],
  ]){
    const backend=websiteBackend(),receipt=backend.send(operation,data);assert.equal(receipt.state,'rejected');
    assert.equal(backend.sheets.SupplyHistory,undefined);assert.equal(backend.sheets.SupplyCatalog,undefined);
  }
});

test('a failed generated-view update can retry without duplicating the accepted supply ledger',()=>{
  const backend=websiteBackend(),render=backend.ctx.renderSupplyWarehouse_;let fail=true;
  backend.ctx.renderSupplyWarehouse_=ss=>{if(fail){fail=false;throw new Error('temporary view failure');}render(ss);};
  const requestId=randomUUID(),data={supplyId:'supply-toner-yellow',quantity:2,recorder:'小陳'};
  assert.throws(()=>backend.send('supply-arrival',data,requestId),/temporary/);
  assert.equal(backend.send('supply-arrival',data,requestId).state,'accepted');
  assert.equal(backend.sheets.SupplyHistory.rows.length,2);assert.equal(backend.sheets.SupplyCatalog.rows.length,10);
});

test('an unrelated coinciding view name is preserved while the supply ledger remains usable',()=>{
  const backend=websiteBackend();backend.sheets.SupplyWarehouse=memorySheet([['私人備註'],['原有內容']]);
  assert.equal(backend.send('supply-arrival',{supplyId:'supply-toner-red',quantity:2,recorder:'小王'}).state,'accepted');
  assert.deepEqual(backend.sheets.SupplyWarehouse.rows,[['私人備註'],['原有內容']]);
  assert.equal(backend.sheets.SupplyHistory.rows.length,2);
});

test('noodle expiry is required, calendar-valid and current in Taiwan; toner remains quantity-only',()=>{
  for(const expiresOn of [undefined,'','not-a-date','2099-02-30','2000-01-01']){
    const backend=websiteBackend();
    assert.equal(backend.send('supply-arrival',{supplyId:'supply-noodle-01',quantity:2,recorder:'小王',expiresOn}).state,'rejected');
    assert.equal(backend.sheets.SupplyHistory,undefined);
  }
  assert.equal(validSupplyExpiry('2028-02-29'),true);assert.equal(validSupplyExpiry('2027-02-29'),false);
  const now=new Date('2026-11-01T17:00:00Z');assert.equal(supplyToday(now),'2026-11-02');
  assert.equal(supplyExpiryStatus('2026-11-01',now).kind,'expired');assert.equal(supplyExpiryStatus('2026-11-02',now).label,'今天到期');
  assert.equal(supplyExpiryStatus('2026-12-02',now).kind,'near');assert.equal(supplyExpiryStatus('2026-12-03',now).kind,'fresh');
});

test('noodle batches retain separate expiry dates; closing removes only a reminder and zero counts finish older batches',()=>{
  const backend=websiteBackend(),id='supply-noodle-01';
  backend.send('supply-stocktake',{entries:[{supplyId:id,quantity:0}],recorder:'小王'});
  const first=randomUUID(),second=randomUUID();
  backend.send('supply-arrival',{supplyId:id,quantity:3,recorder:'小王',expiresOn:'2099-12-31'},first);
  backend.send('supply-arrival',{supplyId:id,quantity:2,recorder:'小王',expiresOn:'2099-11-30'},second);
  let data=plain(backend.ctx.warehouseData_()),batches=supplyBatches(id,data.supplyEvents);
  assert.deepEqual(batches.map(batch=>batch.expiresOn),['2099-11-30','2099-12-31']);assert.equal(data.supplies.find(item=>item.id===id).stock,5);
  const near=batches[0];
  backend.send('supply-expiry-close',{batchId:near.id,recorder:'小李',note:'已用完'});
  data=plain(backend.ctx.warehouseData_());assert.equal(data.supplies.find(item=>item.id===id).stock,5,'no guessed stock deduction');
  assert.deepEqual(supplyBatches(id,data.supplyEvents).map(batch=>batch.expiresOn),['2099-12-31']);
  const before=data.supplyEvents.length;
  assert.equal(backend.send('supply-expiry-close',{batchId:near.id,recorder:'小李'}).result.alreadyClosed,true);
  assert.equal(plain(backend.ctx.warehouseData_()).supplyEvents.length,before);
  backend.send('supply-stocktake',{entries:[{supplyId:id,quantity:0}],recorder:'小王'});
  data=plain(backend.ctx.warehouseData_());assert.equal(supplyBatches(id,data.supplyEvents).length,0);assert.equal(data.supplies.find(item=>item.id===id).stock,0);
  assert.ok(data.supplyEvents.some(event=>event.id.includes(first)),'arrival history is retained');
});

test('Google store capability gates old deployments and refreshes accepted supply commands across readers',async()=>{
  const backend=websiteBackend();
  const options={pendingStorage:storage(),readPublicData:async(_url,{action})=>plain(action==='warehouse'?backend.ctx.warehouseData_():backend.ctx.publicData_()),submitWebsiteCommand:async(_url,command)=>{
    const receipt=backend.send(command.operation,command.data,command.requestId);if(receipt.state!=='accepted')throw new Error(receipt.message);return receipt.result;
  }};
  const first=new GoogleInventoryStore({googleScriptUrl:endpoint},options);await first.init();assert.equal(first.supportsSupplies,false);
  await assert.rejects(first.submitSupplyArrival({}),/更新/);await first.readWarehouse();assert.equal(first.supportsSupplies,true);
  await first.submitSupplyStocktake([{supplyId:'supply-noodle-02',quantity:0}],'小王');
  await first.submitSupplyArrival({supplyId:'supply-noodle-02',quantity:6,recorder:'小王',expiresOn:'2099-12-31'});
  const second=new GoogleInventoryStore({googleScriptUrl:endpoint},options);await second.init();await second.readWarehouse();
  assert.equal(second.supplies.find(item=>item.id==='supply-noodle-02').stock,6);assert.equal(second.supplyEvents.length,2);
});

test('local preview preserves its original drinks and saves pending supply counts between store instances',async t=>{
  const original=globalThis.localStorage;globalThis.localStorage=storage();t.after(()=>{if(original===undefined)delete globalThis.localStorage;else globalThis.localStorage=original;});
  const first=new InventoryStore();await first.init();const drinks=structuredClone(first.data.drinks);
  assert.equal(first.supplies.length,9);assert.ok(first.supplies.every(item=>item.stock===null));
  await first.submitSupplyStocktake([{supplyId:'supply-toner-blue',quantity:0}],'小王');await first.submitSupplyArrival({supplyId:'supply-toner-blue',quantity:2,recorder:'小李'});
  const next=new InventoryStore();await next.init();assert.equal(next.supplies.find(item=>item.id==='supply-toner-blue').stock,2);
  assert.deepEqual(next.data.drinks,drinks);assert.equal(next.supplyEvents.length,2);
});


test('new dated arrivals never conceal an untracked positive baseline or adjustment',()=>{
 const id='supply-noodle-01',event=(type,quantity,day)=>({id:day,supplyId:id,type,quantity,createdAt:`2026-11-${day}T00:00:00Z`});
 assert.equal(supplyHasUntrackedExpiry(id,[event('count',5,'01'),event('restock',3,'02')]),true);
 assert.equal(supplyHasUntrackedExpiry(id,[event('count',0,'01'),event('restock',3,'02'),event('count',2,'03')]),false);
 assert.equal(supplyHasUntrackedExpiry(id,[event('count',0,'01'),event('restock',3,'02'),event('count',6,'03')]),true);
 assert.equal(supplyHasUntrackedExpiry(id,[event('count',5,'01'),event('count',0,'02')]),false);
});
