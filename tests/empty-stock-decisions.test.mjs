import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { websiteBackend } from './helpers/google-website.mjs';
import { GoogleInventoryStore } from '../js/google-store.js';
import { InventoryStore } from '../js/store.js';
import { canonicalDrinkCategory, fridgeDisplayName, createCompanyData } from '../js/catalog.js';
import { initialSupplies } from '../js/supplies.js';
import { groupEmptyStock } from '../js/empty-stock.js';

const plain=value=>JSON.parse(JSON.stringify(value));
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const zero=b=>{assert.equal(b.send('stocktake',{entries:[{drinkId:'tea',quantity:0}],recorder:'測試'}).state,'accepted');};
const decide=(b,decision,expectedMode='normal',requestId=randomUUID())=>b.send('zero-stock-decision',{kind:'drink',itemId:'tea',decision,expectedMode},requestId);

test('zero-stock decisions are shared, idempotent and preserve all inventory facts',()=>{
 const b=websiteBackend();zero(b);const history=plain(b.sheets.History.rows),catalog=plain(b.sheets.Catalog.rows),id=randomUUID();
 const pending=decide(b,'pending','normal',id);assert.equal(pending.state,'accepted');assert.equal(decide(b,'pending','normal',id).state,'accepted');
 assert.deepEqual(b.sheets.History.rows,history);assert.deepEqual(b.sheets.Catalog.rows,catalog);
 const summary=plain(b.ctx.adminSummaryData_()),row=summary.outOfStockItems.find(item=>item.id==='tea');
 assert.equal(row.zeroStockPending,true);assert.equal(row.mode,'consider');assert.equal(groupEmptyStock([row]).pending.length,1);
 assert.equal(decide(b,'archive').state,'rejected','stale expected preference cannot archive');
 assert.equal(decide(b,'undecided','consider').state,'accepted');
 assert.equal(plain(b.ctx.adminSummaryData_()).outOfStockItems.find(item=>item.id==='tea').zeroStockPending,undefined);
 assert.equal(decide(b,'pending').state,'accepted');
 const arrivalId=randomUUID(),arrival={drinkId:'tea',cases:0,loose:8,recorder:'測試',note:''};
 assert.equal(b.send('arrival',arrival,arrivalId).state,'accepted');assert.equal(b.send('arrival',arrival,arrivalId).state,'accepted');
 assert.equal(b.inventory().find(item=>item.drink.id==='tea').stock,8);
 assert.equal(b.ctx.restockMode_(b.ctx.restockPreferences_(b.ss),'drink','tea'),'normal');
 assert.equal(b.sheets.History.rows.length,history.length+1);assert.ok(!b.ctx.adminSummaryData_().outOfStockItems.some(item=>item.id==='tea'));
});

test('archiving only changes the active cell and keeps the original item reusable for arrivals',()=>{
 const b=websiteBackend();zero(b);const before=plain(b.sheets.Catalog.rows.find(row=>row[0]==='tea')),history=plain(b.sheets.History.rows);
 assert.equal(decide(b,'archive').state,'accepted');
 const after=plain(b.sheets.Catalog.rows.find(row=>row[0]==='tea'));assert.deepEqual(after,[...before.slice(0,7),false]);
 assert.deepEqual(b.sheets.History.rows,history);assert.equal(b.ctx.publicData_(b.ss).drinks.find(item=>item.id==='tea').active,false);
 assert.equal(b.send('arrival',{drinkId:'tea',restoreArchived:true,cases:0,loose:3,recorder:'測試',note:''}).state,'accepted');
 assert.equal(b.inventory().find(item=>item.drink.id==='tea').stock,3);assert.equal(b.sheets.Catalog.rows.filter(row=>row[0]==='tea').length,1);assert.equal(b.sheets.Catalog.rows.find(row=>row[0]==='tea')[7],true);
});

test('snack/noodle batch arrivals fulfil only explicit zero-stock queues; manual marks retain their meaning',()=>{
 const b=websiteBackend(),snack='supply-snack-01',noodle='supply-noodle-01';
 b.send('supply-stocktake',{entries:[{supplyId:snack,quantity:0},{supplyId:noodle,quantity:0}],recorder:'測試'});
 for(const [kind,itemId] of [['snack',snack],['noodle',noodle]])assert.equal(b.send('zero-stock-decision',{kind,itemId,decision:'pending',expectedMode:'normal'}).state,'accepted');
 const request={recorder:'測試',entries:[{kind:'snack',supplyId:snack,quantity:4},{kind:'noodle',supplyId:noodle,quantity:2,expiresOn:'2099-01-01'}]},id=randomUUID();
 assert.equal(b.send('batch-arrival',request,id).state,'accepted');assert.equal(b.send('batch-arrival',request,id).state,'accepted');
 const preferences=b.ctx.restockPreferences_(b.ss);for(const [kind,itemId] of [['snack',snack],['noodle',noodle]])assert.equal(b.ctx.restockMode_(preferences,kind,itemId),'normal');
 for(const [kind,itemId] of [['snack',snack],['noodle',noodle]]){
  b.send('supply-stocktake',{entries:[{supplyId:itemId,quantity:0}],recorder:'測試'});
  const before=plain(b.sheets.SupplyHistory.rows);assert.equal(b.send('zero-stock-decision',{kind,itemId,decision:'archive',expectedMode:'normal'}).state,'accepted');assert.deepEqual(b.sheets.SupplyHistory.rows,before);
  assert.equal(b.send('supply-arrival',{supplyId:itemId,restoreArchived:true,quantity:1,recorder:'測試',note:'',...(kind==='noodle'?{expiresOn:'2099-01-01'}:{})}).state,'accepted');
 }
 b.send('supply-stocktake',{entries:[{supplyId:snack,quantity:0}],recorder:'測試'});b.send('restock-preference',{kind:'snack',itemId:snack,mode:'consider',expectedMode:'normal'});
 b.send('supply-arrival',{supplyId:snack,quantity:2,recorder:'測試',note:''});assert.equal(b.ctx.restockMode_(b.ctx.restockPreferences_(b.ss),'snack',snack),'consider');
});

test('unknown/positive stock, toner and changed stocks are rejected before availability changes',()=>{
 const b=websiteBackend();
 for(const data of [{kind:'drink',itemId:'tea'},{kind:'snack',itemId:'supply-snack-01'},{kind:'toner',itemId:'supply-toner-black'}])assert.equal(b.send('zero-stock-decision',{...data,decision:'archive',expectedMode:'normal'}).state,'rejected');
 zero(b);const request={operation:'zero-stock-decision',requestId:randomUUID(),data:{kind:'drink',itemId:'tea',decision:'archive',expectedMode:'normal'}};
 const effects=b.ctx.prepareWebsiteRequest_(b.ss,request,new Date().toISOString());b.send('arrival',{drinkId:'tea',cases:0,loose:2,recorder:'測試',note:''});
 assert.throws(()=>b.ctx.applyWebsiteRequest_(b.ss,effects),/無庫存清單/);assert.equal(b.inventory().find(item=>item.drink.id==='tea').stock,2);assert.equal(b.sheets.Catalog.rows.find(row=>row[0]==='tea')[7],true);
 const c=websiteBackend();zero(c);const prepared=c.ctx.prepareWebsiteRequest_(c.ss,{...request,requestId:randomUUID()},new Date().toISOString());zero(c);
 assert.throws(()=>c.ctx.applyWebsiteRequest_(c.ss,prepared),/庫存紀錄已更新/,'even another zero count invalidates the old decision snapshot');assert.equal(c.sheets.Catalog.rows.find(row=>row[0]==='tea')[7],true);
});

test('overview low noodles require a manual mark while warehouse quantity bands remain independent',()=>{
 const b=websiteBackend();b.send('supply-stocktake',{entries:[{supplyId:'supply-noodle-01',quantity:2}],recorder:'測試'});
 assert.ok(!b.ctx.adminSummaryData_().lowItems.some(item=>item.id==='supply-noodle-01'));
 b.send('restock-preference',{kind:'noodle',itemId:'supply-noodle-01',mode:'consider',expectedMode:'normal'});
 assert.ok(b.ctx.adminSummaryData_().lowItems.some(item=>item.id==='supply-noodle-01'));
});

test('a failed generated view can replay an already-applied archive without changing histories or duplicating preferences',()=>{
 const b=websiteBackend();zero(b);const history=plain(b.sheets.History.rows),id=randomUUID();
 b.ctx.renderArchive_=()=>{throw new Error('temporary rendering failure');};assert.throws(()=>decide(b,'archive','normal',id),/temporary/);assert.equal(b.ctx.websiteReceipt_(id).state,'pending');
 b.ctx.renderArchive_=()=>{};assert.equal(decide(b,'archive','normal',id).state,'accepted');assert.deepEqual(b.sheets.History.rows,history);assert.equal(b.sheets.RestockPreferences.rows.filter(row=>row[0]==='website:'+id).length,1);
});

test('admin decisions use a verified receipt without requesting the full warehouse and remain visible on another device',async()=>{
 const b=websiteBackend();zero(b);const reads=[];
 const make=()=>new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/ZERO_STOCK_TEST/exec'},{pendingStorage:storage(),publicStorage:storage(),readPublicData:async(_,options)=>{reads.push(options.action);return plain(b.ctx.adminSummaryData_());},submitWebsiteCommand:async(_,command)=>{const receipt=b.send(command.operation,command.data,command.requestId);assert.equal(receipt.state,'accepted');return receipt.result;}});
 const store=make();await store.readAdminSummary();assert.equal(store.supportsZeroStockDecisions,true);
 await store.setZeroStockDecision({kind:'drink',itemId:'tea',decision:'pending',expectedMode:'normal'});assert.deepEqual(reads,['admin']);assert.equal(store.adminSummary.outOfStockItems.find(item=>item.id==='tea').zeroStockPending,true);
 const other=make();await other.readAdminSummary();assert.equal(other.adminSummary.outOfStockItems.find(item=>item.id==='tea').zeroStockPending,true);
 await store.setZeroStockDecision({kind:'drink',itemId:'tea',decision:'archive',expectedMode:'consider'});assert.ok(!store.adminSummary.outOfStockItems.some(item=>item.id==='tea'));assert.deepEqual(reads,['admin','admin']);
 const older=make();older.readPublicData=async()=>{const summary=plain(b.ctx.adminSummaryData_());delete summary.zeroStockVersion;return summary;};await older.readAdminSummary();await assert.rejects(older.setZeroStockDecision({kind:'drink',itemId:'tea',decision:'pending',expectedMode:'normal'}),/更新原 Apps Script/);
});

test('local queues archive and restore the same IDs and Calpis display remains separate from package identity',async t=>{
 const local=storage(),session=storage();for(const [key,value] of [['localStorage',local],['sessionStorage',session]]){const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});t.after(()=>old?Object.defineProperty(globalThis,key,old):delete globalThis[key]);}
 const data=createCompanyData();data.supplies=initialSupplies();data.supplyEvents=[];data.events=[{id:'initial-zero',drinkId:data.drinks[0].id,type:'count',quantity:0,createdAt:'2026-01-01T00:00:00Z',recorder:'測試'}];data.drinks[0].lastCountAt=data.events[0].createdAt;
 local.setItem('office-pantry-demo-v1',JSON.stringify({data,revision:1,updatedAt:'2026-01-01T00:00:00Z'}));
 const store=new InventoryStore();await store.init();store.preview=false;const itemId=store.data.drinks[0].id;
 await store.setZeroStockDecision({kind:'drink',itemId,decision:'pending',expectedMode:'normal'});assert.equal(store.restockPreferences[0].zeroStockPending,true);
 await store.submitBatchArrival({recorder:'測試',entries:[{kind:'drink',drinkId:itemId,quantity:2}]});assert.equal(store.restockPreferences[0].mode,'normal');
 const counted=structuredClone(store.data);counted.events.push({id:'zero-again',drinkId:itemId,type:'count',quantity:0,createdAt:new Date(Date.now()+1000).toISOString(),recorder:'測試'});await store.save(counted);
 const history=structuredClone(store.data.events);await store.setZeroStockDecision({kind:'drink',itemId,decision:'archive',expectedMode:'normal'});assert.equal(store.data.drinks.find(item=>item.id===itemId).active,false);assert.deepEqual(store.data.events,history);
 await store.submitBatchArrival({recorder:'測試',entries:[{kind:'drink',drinkId:itemId,restoreArchived:true,quantity:3}]});assert.equal(store.data.drinks.filter(item=>item.id===itemId).length,1);assert.equal(store.data.drinks.find(item=>item.id===itemId).active,true);
 assert.equal(fridgeDisplayName('可爾必思開心成長160ml'),'可爾必思');assert.equal(canonicalDrinkCategory('牛乳／植物奶','可爾必思開心成長160ml'),'其他');
});
