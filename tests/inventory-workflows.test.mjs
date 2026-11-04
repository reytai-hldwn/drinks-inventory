import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {websiteBackend,memorySheet} from './helpers/google-website.mjs';
import {InventoryStore} from '../js/store.js';
import {GoogleInventoryStore} from '../js/google-store.js';
import {recordedBalances,inventoryActivity,snackFlavorStatistics,recentArrivalEvents} from '../js/inventory-activity.js';
import {hasRecordedStock,sortInventoryItems} from '../js/restock-preferences.js';
const plain=value=>JSON.parse(JSON.stringify(value));
const snack=(quantity=7)=>({kind:'snack',supplyId:'supply-snack-01',quantity});
const drink=(quantity=3)=>({kind:'drink',drinkId:'tea',quantity});
const fresh=(flavor='原味')=>({kind:'snack',isNew:true,name:'虛構脆片',flavor,category:'太空包',unit:'包',quantity:5});
const balance=(b,id)=>b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss)).find(item=>item.id===id);
function demo(t){const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});t.after(()=>old?Object.defineProperty(globalThis,'localStorage',old):delete globalThis.localStorage);return new InventoryStore();}

test('first and historical arrivals establish recorded stock without fabricating an actual count',()=>{
 const b=websiteBackend();b.send('supply-arrival',{supplyId:'supply-snack-01',quantity:7,recorder:'虛構'});b.send('supply-arrival',{supplyId:'supply-snack-01',quantity:2,recorder:'虛構'});
 const item=balance(b,'supply-snack-01');assert.equal(item.stock,9);assert.equal(item.lastCountAt,null);assert.ok(item.lastArrivalAt);assert.equal(hasRecordedStock(item),true);
 b.send('supply-stocktake',{entries:[{supplyId:item.id,quantity:4}],recorder:'虛構'});b.send('supply-arrival',{supplyId:item.id,quantity:3,recorder:'虛構'});assert.equal(balance(b,item.id).stock,7);
 const untouched=balance(b,'supply-snack-02');assert.equal(untouched.stock,null);assert.equal(hasRecordedStock(untouched),false);
});

test('mixed batch saves each source once, initializes new products and renders both inventories once',()=>{
 const b=websiteBackend();let renderedDrinks=0,renderedSupplies=0;b.ctx.renderWarehouse_=()=>renderedDrinks++;b.ctx.renderSupplyWarehouse_=()=>renderedSupplies++;
 const result=b.send('batch-arrival',{recorder:'虛構',entries:[snack(),drink(),fresh(),{kind:'noodle',supplyId:'supply-noodle-01',quantity:2,expiresOn:'2099-01-01'},{kind:'toner',supplyId:'supply-toner-black',quantity:1}]});
 assert.equal(result.state,'accepted');assert.equal(result.result.count,5);assert.equal(balance(b,'supply-snack-01').stock,7);assert.equal(b.inventory().find(item=>item.drink.id==='tea').stock,23);assert.equal(balance(b,result.result.items[2].id).stock,5);assert.equal(renderedDrinks,1);assert.equal(renderedSupplies,1);
});

test('whole-batch validation rejects a bad later row, expired noodles, wrong kind and duplicate new flavor before source writes',()=>{
 for(const entries of [[snack(),drink(0)],[snack(),{kind:'noodle',supplyId:'supply-noodle-01',quantity:2,expiresOn:'2000-01-01'}],[snack(),{kind:'toner',supplyId:'supply-snack-02',quantity:1}],[fresh(),fresh()],[snack(),{kind:'toner',isNew:true,name:'第五色',quantity:1,unit:'盒'}]]){
  const b=websiteBackend(),before=plain(b.sheets.History.rows);assert.equal(b.send('batch-arrival',{recorder:'虛構',entries}).state,'rejected');assert.deepEqual(b.sheets.History.rows,before);assert.equal(b.sheets.SupplyHistory,undefined);assert.equal(b.sheets.SupplyCatalog,undefined);
 }
});

test('batch cumulative overflow and maximum row count are validated before writes',()=>{
 for(const entries of [[snack(600000),snack(600000)],Array.from({length:31},()=>snack(1))]){const b=websiteBackend();assert.equal(b.send('batch-arrival',{recorder:'虛構',entries}).state,'rejected');assert.equal(b.sheets.SupplyHistory,undefined);}
});

test('batch retry after a generated-view failure never duplicates arrivals or products',()=>{
 const b=websiteBackend(),request=randomUUID(),data={recorder:'虛構',entries:[snack(),drink(),fresh()]};let fail=true;b.ctx.renderSupplyWarehouse_=()=>{if(fail){fail=false;throw Error('view unavailable');}};
 assert.throws(()=>b.send('batch-arrival',data,request),/unavailable/);const rows=plain({history:b.sheets.History.rows,supply:b.sheets.SupplyHistory.rows,catalog:b.sheets.SupplyCatalog.rows});
 assert.equal(b.send('batch-arrival',data,request).state,'accepted');assert.deepEqual(plain({history:b.sheets.History.rows,supply:b.sheets.SupplyHistory.rows,catalog:b.sheets.SupplyCatalog.rows}),rows);assert.equal(b.send('batch-arrival',data,request).state,'accepted');
});

test('batch schema collision rejects before any drink history mutation',()=>{
 const b=websiteBackend();b.sheets.SupplyCatalog=memorySheet([['id','name','kind','unit','active','category','私人用途']]);const before=plain(b.sheets.History.rows);assert.equal(b.send('batch-arrival',{recorder:'虛構',entries:[drink(),snack()]}).state,'rejected');assert.deepEqual(b.sheets.History.rows,before);
});

test('batch preparation reads each spreadsheet source at most once',()=>{
 const b=websiteBackend(),reads=new Map();for(const [name,sheet] of Object.entries(b.sheets)){const original=sheet.getRange;sheet.getRange=(...args)=>{const range=original(...args),get=range.getValues;range.getValues=()=>{reads.set(name,(reads.get(name)||0)+1);return get();};return range;};}
 b.ctx.prepareWebsiteRequest_(b.ss,{requestId:randomUUID(),operation:'batch-arrival',data:{recorder:'虛構',entries:[snack(1),drink(1),drink(2),fresh('辣味'),fresh('原味')]}},new Date().toISOString());
 assert.ok([...reads.values()].every(n=>n<=1),JSON.stringify([...reads]));
});

test('flavors share a product name but retain distinct ids, quantities and duplicate protection',()=>{
 const b=websiteBackend(),one=b.send('new-arrival',{...fresh('辣味'),recorder:'虛構'}),two=b.send('new-arrival',{...fresh('原味'),recorder:'虛構'});assert.equal(one.state,'accepted');assert.equal(two.state,'accepted');assert.notEqual(one.result.id,two.result.id);
 assert.equal(b.send('new-arrival',{...fresh(' 辣味 '),recorder:'虛構'}).state,'rejected');assert.equal(b.send('new-arrival',{...fresh(''),recorder:'虛構'}).state,'accepted');
 const id=one.result.id,item=balance(b,id),history=plain(b.sheets.SupplyHistory.rows);assert.equal(b.send('supply-details',{supplyId:id,name:item.name,flavor:'原味',expectedName:item.name,expectedFlavor:'辣味'}).state,'rejected');
 const request=randomUUID(),data={supplyId:id,name:'虛構脆片新版',flavor:'甜辣',expectedName:item.name,expectedFlavor:'辣味'};assert.equal(b.send('supply-details',data,request).state,'accepted');assert.equal(b.send('supply-details',data,request).state,'accepted');assert.deepEqual(b.sheets.SupplyHistory.rows,history);assert.equal(balance(b,id).stock,5);assert.equal(balance(b,id).flavor,'甜辣');
});

test('legacy seed names normalize read-only into name and flavor without rewriting source history',()=>{
 const b=websiteBackend();b.sheets.SupplyCatalog=memorySheet([['id','name','kind','unit','active','category'],['supply-snack-01','多力多滋雙倍起司口味','snack','包',true,'太空包']]);const before=plain(b.sheets.SupplyCatalog.rows),item=b.ctx.supplyCatalog_(b.ss)[0];assert.equal(item.name,'多力多滋');assert.equal(item.flavor,'超濃起司');assert.deepEqual(b.sheets.SupplyCatalog.rows,before);
 assert.equal(b.send('new-arrival',{kind:'snack',name:' 多力多滋雙倍起司口味 ',unit:'包',category:'太空包',quantity:1,recorder:'虛構'}).state,'rejected');
});

test('all categories allow explicit manual flags at high, zero and unknown stock, retaining flags across arrivals',()=>{
 const b=websiteBackend(),before=plain(b.sheets.History.rows);
 for(const [kind,itemId] of [['drink','tea'],['snack','supply-snack-01'],['noodle','supply-noodle-01'],['toner','supply-toner-black']])assert.equal(b.send('restock-preference',{kind,itemId,mode:'consider',expectedMode:'normal'}).state,'accepted');
 assert.equal(b.ctx.adminSummaryData_().restockItems.length,4);assert.deepEqual(b.sheets.History.rows,before);b.send('supply-arrival',{supplyId:'supply-snack-01',quantity:30,recorder:'虛構'});assert.equal(b.ctx.adminSummaryData_().restockItems.find(item=>item.id==='supply-snack-01').stock,30);
 assert.equal(b.send('restock-preference',{kind:'drink',itemId:'tea',mode:'normal',expectedMode:'consider'}).state,'accepted');assert.equal(b.ctx.adminSummaryData_().restockItems.length,3);
});

test('priority sorting puts manually marked items before the numeric order, without mutating the source',()=>{
 const items=[{id:'low',stock:2,lastCountAt:'2026-01-01'},{id:'high',stock:90,lastCountAt:'2026-01-01'},{id:'zero',stock:0,lastCountAt:'2026-01-01'},{id:'unknown',stock:null,lastCountAt:null}],before=structuredClone(items);
 assert.deepEqual(sortInventoryItems(items,[{kind:'drink',itemId:'high',mode:'consider'}]).map(item=>item.id),['high','zero','low','unknown']);assert.deepEqual(items,before);
});

test('activity keeps arrival and count units separate and includes actual zero counts',()=>{
 const d=[{id:'d',name:'虛構飲料',unit:'瓶'}],s=[{id:'s',kind:'snack',name:'虛構零食',flavor:'原味',unit:'包'}],events=[{id:'r',drinkId:'d',type:'restock',quantity:5,createdAt:'2026-01-01T00:00:00Z'}],se=[{id:'c',supplyId:'s',type:'count',quantity:0,createdAt:'2026-01-02T00:00:00Z'}];
 const summary=inventoryActivity(d,s,events,se);assert.equal(summary.recentArrivals[0].unit,'瓶');assert.equal(summary.recentCounts.find(group=>group.kind==='snack').items[0].quantity,0);assert.equal(summary.recentCounts.find(group=>group.kind==='drink').countedAt,null);
 const balances=recordedBalances(d,events,'drinkId');assert.equal(balances[0].stock,5);assert.equal(balances[0].lastCountAt,null);
});

test('flavor consumption requires real counts and includes arrivals, never uses arrival volume as popularity',()=>{
 const supplies=[{id:'s',kind:'snack',name:'虛構',flavor:'原味',unit:'包'}],event=(id,type,quantity,day)=>({id,supplyId:'s',type,quantity,createdAt:`2026-01-${day}T00:00:00Z`});
 assert.equal(snackFlavorStatistics(supplies,[event('r','restock',100,'01')])[0].weekly,null);
 const stat=snackFlavorStatistics(supplies,[event('a','count',10,'01'),event('r','restock',5,'02'),event('b','count',8,'08')])[0];assert.equal(stat.arrivals,5);assert.equal(stat.weekly,7);
 assert.equal(snackFlavorStatistics(supplies,[event('a','count',1,'01'),event('b','count',10,'08')])[0].weekly,null);
});

test('local batch is atomic and persists arrival-only balances and flavors between readers',async t=>{
 const store=demo(t);await store.init();const before=structuredClone(store.data);await assert.rejects(store.submitBatchArrival({recorder:'虛構',entries:[snack(),drink(0)]}));assert.deepEqual(store.data,before);
 await store.submitBatchArrival({recorder:'虛構',entries:[snack(),fresh('原味'),fresh('辣味')]});assert.equal(store.supplies.find(item=>item.id==='supply-snack-01').stock,7);const second=new InventoryStore();await second.init();assert.equal(second.supplies.find(item=>item.id==='supply-snack-01').stock,7);assert.equal(second.supplies.filter(item=>item.name==='虛構脆片').length,2);
});

test('Google capabilities gate new mutations and compact activity DTO normalizes without a warehouse read',async()=>{
 const b=websiteBackend(),calls=[],store=new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/WORKFLOW_TEST/exec'},{readPublicData:async(_url,{action})=>{calls.push(action);return plain(b.ctx.adminSummaryData_());}});await assert.rejects(store.submitBatchArrival({}),/更新/);await assert.rejects(store.updateSupplyDetails({}),/更新/);
 b.send('batch-arrival',{recorder:'虛構',entries:[snack(),drink()]});b.send('supply-stocktake',{recorder:'虛構',entries:[{supplyId:'supply-snack-01',quantity:0}]});const summary=await store.readAdminSummary();assert.equal(summary.activityVersion,1);assert.equal(summary.recentArrivals.length,2);assert.equal(summary.recentCounts.find(group=>group.kind==='snack').items[0].quantity,0);assert.deepEqual(calls,['admin']);assert.equal(store.inWarehouse,false);
});


test('three-day arrival window includes every row beyond five and handles time boundaries without modifying source',()=>{
 const now=Date.parse('2026-11-03T16:00:00Z'),row=(id,age,extra={})=>({id,type:'restock',createdAt:new Date(now-age).toISOString(),...extra});
 const recent=Array.from({length:9},(_,i)=>row('inside-'+i,i*3600000)),boundary=row('boundary',72*3600000),outside=row('old',72*3600000+1),future=row('future',-1),count=row('count',1,{type:'count'}),rejected=row('rejected',1,{accepted:false});
 const events=[outside,...recent,boundary,future,count,rejected],before=structuredClone(events),result=recentArrivalEvents(events,now);
 assert.equal(result.length,10);assert.equal(result[0].id,'inside-0');assert.equal(result.at(-1).id,'boundary');assert.deepEqual(events,before);
});
