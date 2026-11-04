import test from 'node:test';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
import {supplyAvailability,normalizeSupplyWarehouse,matchesSupplyInventoryFilter} from '../js/supplies.js';
import {InventoryStore} from '../js/store.js';
import {GoogleInventoryStore} from '../js/google-store.js';
const plain=value=>JSON.parse(JSON.stringify(value));
const date='2026-11-04T01:00:00Z';

test('recorded snack and noodle zeros become historical, while unknown and toner remain available',()=>{
  for(const kind of ['snack','noodle']){
    const item={id:'sample',kind,active:true,stock:0,lastCountAt:date,unit:kind==='snack'?'包':'碗',flavor:'虛構口味'};
    const zero=supplyAvailability(item);assert.equal(zero.active,false);assert.equal(zero.autoArchived,true);assert.equal(item.active,true);
    assert.equal(matchesSupplyInventoryFilter(zero,'all'),false);assert.equal(matchesSupplyInventoryFilter(zero,'low'),false);assert.equal(matchesSupplyInventoryFilter(zero,'archived'),true);
    const restocked=supplyAvailability({...zero,stock:2,lastArrivalAt:date});assert.equal(restocked.active,true);assert.equal(restocked.id,item.id);assert.equal(restocked.flavor,item.flavor);
    assert.equal(supplyAvailability({...item,stock:null,lastCountAt:null}).active,true);
    assert.equal(supplyAvailability({...item,lastCountAt:null}).active,true,'unobserved defaults are not real zeros');
    assert.equal(supplyAvailability({...item,stock:1}).active,true);
    assert.equal(supplyAvailability({...item,lastCountAt:null,lastArrivalAt:date}).active,false);
    const manual={...item,active:false,stock:3};assert.equal(supplyAvailability(manual),manual);
  }
  const toner={kind:'toner',active:true,stock:0,lastCountAt:date};assert.equal(supplyAvailability(toner),toner);
});

test('existing Google deployment zero balances normalize without a backend migration or data writes',async()=>{
  const b=websiteBackend();
  for(const id of ['supply-snack-01','supply-noodle-01','supply-toner-black'])assert.equal(b.send('supply-stocktake',{recorder:'虛構',entries:[{supplyId:id,quantity:0}]}).state,'accepted');
  const payload=plain(b.ctx.warehouseData_()),before=JSON.stringify(payload),rows=plain(b.sheets.SupplyHistory.rows),catalog=plain(b.sheets.SupplyCatalog.rows);
  const store=new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/SUPPLY_ZERO_TEST/exec'},{readPublicData:async()=>payload});await store.readWarehouse();
  for(const kind of ['snack','noodle']){const item=store.supplies.find(item=>item.kind===kind&&item.stock===0);assert.equal(item.active,false);assert.equal(item.autoArchived,true);}
  assert.equal(store.supplies.find(item=>item.kind==='toner'&&item.stock===0).active,true);
  assert.equal(store.supplies.find(item=>item.id==='supply-snack-02').active,true);
  assert.equal(JSON.stringify(payload),before);assert.deepEqual(b.sheets.SupplyHistory.rows,rows);assert.deepEqual(b.sheets.SupplyCatalog.rows,catalog);
});

test('same-id single and batch replenishment restores availability and retains the complete ledger',()=>{
  for(const batch of [false,true]){
    const b=websiteBackend();
    const ids=['supply-snack-01','supply-noodle-01'];b.send('supply-stocktake',{recorder:'虛構',entries:ids.map(supplyId=>({supplyId,quantity:0}))});
    const history=plain(b.sheets.SupplyHistory.rows),catalog=plain(b.sheets.SupplyCatalog.rows);
    const entries=ids.map((supplyId,i)=>({kind:i?'noodle':'snack',supplyId,quantity:3,restoreArchived:true,...(i?{expiresOn:'2099-01-01'}:{})}));
    if(batch)assert.equal(b.send('batch-arrival',{recorder:'虛構',entries}).state,'accepted');
    else for(const entry of entries)assert.equal(b.send('supply-arrival',{...entry,recorder:'虛構'}).state,'accepted');
    const normalized=normalizeSupplyWarehouse(plain(b.ctx.warehouseData_()));
    for(const id of ids){const item=normalized.supplies.find(item=>item.id===id);assert.equal(item.active,true);assert.equal(item.stock,3);assert.equal(item.autoArchived,undefined);}
    assert.deepEqual(b.sheets.SupplyHistory.rows.slice(0,history.length),history);assert.deepEqual(b.sheets.SupplyCatalog.rows,catalog);
    assert.equal(normalized.supplyEvents.findLast(event=>event.supplyId===ids[1]).expiresOn,'2099-01-01');
  }
});

test('historical zero items retain manual restock choices on the current backend',()=>{
  const b=websiteBackend();
  for(const [kind,itemId] of [['snack','supply-snack-01'],['noodle','supply-noodle-01']]){
    b.send('supply-stocktake',{recorder:'虛構',entries:[{supplyId:itemId,quantity:0}]});
    assert.equal(b.send('restock-preference',{kind,itemId,mode:'consider',expectedMode:'normal'}).state,'accepted');
    assert.ok(b.ctx.adminSummaryData_().restockItems.some(item=>item.id===itemId));
    assert.equal(b.send('restock-preference',{kind,itemId,mode:'normal',expectedMode:'consider'}).state,'accepted');
  }
});

test('local balances archive zeros on reload and restore after a real arrival or corrected count',async t=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});
  t.after(()=>descriptor?Object.defineProperty(globalThis,'localStorage',descriptor):delete globalThis.localStorage);
  const store=new InventoryStore();await store.init();
  for(const id of ['supply-snack-01','supply-noodle-01'])await store.submitSupplyStocktake([{supplyId:id,quantity:0}],'虛構');
  const next=new InventoryStore();await next.init();for(const id of ['supply-snack-01','supply-noodle-01'])assert.equal(next.supplies.find(item=>item.id===id).active,false);
  const before=plain(next.supplyEvents);
  await next.setRestockPreference({kind:'snack',itemId:'supply-snack-01',mode:'consider',expectedMode:'normal'});
  await next.submitSupplyArrival({supplyId:'supply-snack-01',quantity:2,recorder:'虛構'});
  assert.equal(next.supplies.find(item=>item.id==='supply-snack-01').active,true);assert.equal(next.supplies.find(item=>item.id==='supply-snack-01').stock,2);
  await next.submitSupplyStocktake([{supplyId:'supply-noodle-01',quantity:1}],'虛構');assert.equal(next.supplies.find(item=>item.id==='supply-noodle-01').active,true);
  assert.deepEqual(next.supplyEvents.slice(0,before.length),before);
});
