import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {websiteBackend} from './helpers/google-website.mjs';
import {InventoryStore} from '../js/store.js';
import {GoogleInventoryStore} from '../js/google-store.js';
const plain=x=>JSON.parse(JSON.stringify(x));
function archived(b){b.sheets.History.rows.push(['old-baseline','2020-01-01T00:00:00Z','count','old','舊飲料',2,'保留','原登記人','採計']);return b.sheets.Catalog.rows.find(row=>row[0]==='old');}
function archivedSnack(b){b.ctx.ensureSupplyStorage_(b.ss);const row=b.sheets.SupplyCatalog.rows.find(row=>row[0]==='supply-snack-04');row[4]=false;return row;}
const command={drinkId:'old',cases:1,loose:2,recorder:'虛構到貨者',restoreArchived:true};

test('archived single arrival retains identity, units, earlier history and stock, then returns to supply',()=>{
 const b=websiteBackend(),before=archived(b).slice(),old=plain(b.sheets.History.rows);let archives=0;b.ctx.renderArchive_=()=>archives++;
 const result=b.send('arrival',command);assert.equal(result.state,'accepted');assert.equal(result.result.restored,true);assert.equal(result.result.quantity,26);
 assert.deepEqual(b.sheets.Catalog.rows.find(row=>row[0]==='old'),[...before.slice(0,7),true]);assert.deepEqual(b.sheets.History.rows.slice(0,old.length),old);assert.equal(b.inventory().find(item=>item.drink.id==='old').stock,28);assert.equal(b.sheets.ProductIntake.rows.length,1);assert.equal(archives,1);
 assert.equal(b.ctx.publicData_().drinks.find(item=>item.id==='old').active,true);
});

test('missing consent flag, empty quantity and overflow reject without reactivating or writing stock',()=>{
 for(const changes of [{restoreArchived:false},{loose:0,cases:0},{loose:999999,cases:0}]){const b=websiteBackend();archived(b);const before=plain(b.sheets.History.rows);assert.equal(b.send('arrival',{...command,...changes}).state,'rejected');assert.equal(b.sheets.Catalog.rows.find(row=>row[0]==='old')[7],false);assert.deepEqual(b.sheets.History.rows,before);}
});

test('retry after history append but before activation completes never doubles the arrival',()=>{
 const b=websiteBackend();archived(b);let fail=true;const apply=b.ctx.applyArrivalRestores_;b.ctx.applyArrivalRestores_=updates=>{if(fail){fail=false;throw Error('temporary activation failure');}apply(updates);};const id=randomUUID();
 assert.throws(()=>b.send('arrival',command,id),/activation/);assert.equal(b.sheets.Catalog.rows.find(row=>row[0]==='old')[7],false);const history=plain(b.sheets.History.rows);
 assert.equal(b.send('arrival',command,id).state,'accepted');assert.equal(b.send('arrival',command,id).state,'accepted');assert.deepEqual(b.sheets.History.rows,history);assert.equal(b.inventory().find(item=>item.drink.id==='old').stock,28);assert.equal(b.sheets.Catalog.rows.find(row=>row[0]==='old')[7],true);
});

test('mixed batch restores archived drinks and supplies once, while invalid later rows keep both archived',()=>{
 for(const invalid of [false,true]){const b=websiteBackend();archived(b);archivedSnack(b);let archives=0;b.ctx.renderArchive_=()=>archives++;
 const entries=[{kind:'drink',drinkId:'old',quantity:3,restoreArchived:true},{kind:'snack',supplyId:'supply-snack-04',quantity:4,restoreArchived:true},...(invalid?[{kind:'drink',drinkId:'tea',quantity:0}]:[])],id=randomUUID(),before=plain(b.sheets.History.rows),result=b.send('batch-arrival',{entries,recorder:'虛構'},id);
 assert.equal(result.state,invalid?'rejected':'accepted');assert.equal(b.sheets.Catalog.rows.find(row=>row[0]==='old')[7],!invalid);assert.equal(b.sheets.SupplyCatalog.rows.find(row=>row[0]==='supply-snack-04')[4],!invalid);
 if(invalid)assert.deepEqual(b.sheets.History.rows,before);else{assert.equal(b.inventory().find(item=>item.drink.id==='old').stock,5);assert.equal(archives,1);const snapshot=plain(b.sheets.SupplyHistory.rows);assert.equal(b.send('batch-arrival',{entries,recorder:'虛構'},id).state,'accepted');assert.deepEqual(b.sheets.SupplyHistory.rows,snapshot);}
 }
});

test('deleted archived source is caught before any prepared quantity rows are applied',()=>{
 const b=websiteBackend();archived(b);const effects=b.ctx.prepareWebsiteRequest_(b.ss,{requestId:randomUUID(),operation:'arrival',data:command},new Date().toISOString());b.sheets.Catalog.rows.splice(b.sheets.Catalog.rows.findIndex(row=>row[0]==='old'),1);const before=plain(b.sheets.History.rows);assert.throws(()=>b.ctx.applyWebsiteRequest_(b.ss,effects),/歷史品項/);assert.deepEqual(b.sheets.History.rows,before);
});

test('archived food arrival still requires expiry and never permits archived stocktaking',()=>{
 const b=websiteBackend();b.ctx.ensureSupplyStorage_(b.ss);b.sheets.SupplyCatalog.rows.find(row=>row[0]==='supply-noodle-01')[4]=false;
 assert.equal(b.send('supply-arrival',{supplyId:'supply-noodle-01',quantity:2,restoreArchived:true,recorder:'虛構'}).state,'rejected');assert.equal(b.send('supply-stocktake',{entries:[{supplyId:'supply-noodle-01',quantity:2}],restoreArchived:true,recorder:'虛構'}).state,'rejected');
 assert.equal(b.send('supply-arrival',{supplyId:'supply-noodle-01',quantity:2,restoreArchived:true,recorder:'虛構',expiresOn:'2099-12-31'}).state,'accepted');assert.equal(b.ctx.supplyEvents_(b.ss).at(-1).expiresOn,'2099-12-31');
});

test('local preview restores the same ids atomically without creating products or losing metadata',async t=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),map=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}});t.after(()=>descriptor?Object.defineProperty(globalThis,'localStorage',descriptor):delete globalThis.localStorage);
 const store=new InventoryStore();await store.init();const old=store.data.drinks.find(item=>item.active===false),snack=store.supplies.find(item=>item.kind==='snack'),count=store.data.drinks.length;snack.active=false;await store.save(structuredClone(store.data));
 await assert.rejects(store.submitBatchArrival({recorder:'虛構',entries:[{kind:'drink',drinkId:old.id,quantity:4}]}));assert.equal(store.data.drinks.find(item=>item.id===old.id).active,false);
 await store.submitBatchArrival({recorder:'虛構',entries:[{kind:'drink',drinkId:old.id,quantity:4,restoreArchived:true},{kind:'snack',supplyId:snack.id,quantity:3,restoreArchived:true}]});assert.equal(store.data.drinks.length,count);assert.equal(store.data.drinks.find(item=>item.id===old.id).active,true);assert.equal(store.supplies.find(item=>item.id===snack.id).active,true);assert.equal(store.supplies.find(item=>item.id===snack.id).flavor,snack.flavor);
});

test('older Google deployments reject restoration before sending and new capability gates all arrival routes',async()=>{
 const store=new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/ARCHIVED_TEST/exec'});let writes=0;store.sendWebsiteCommand=async(op,data)=>{writes++;return {op,data};};
 await assert.rejects(store.submitArrival(command),/更新/);await assert.rejects(store.submitSupplyArrival({restoreArchived:true}),/更新/);await assert.rejects(store.submitBatchArrival({entries:[{restoreArchived:true}]}),/更新/);assert.equal(writes,0);
 store.websiteEntryVersion=1;store.archivedArrivalVersion=1;const result=await store.submitArrival(command);assert.equal(result.op,'arrival');assert.equal(result.data.drinkId,'old');assert.equal(result.data.restoreArchived,true);
});


test('client retries the same pending arrival when a refreshed active flag changed after partial commit',async()=>{
 for(const batch of [false,true]){
  const b=websiteBackend();archived(b);let fail=true;const original=b.ctx.renderWarehouse_;b.ctx.renderWarehouse_=(...args)=>{if(fail){fail=false;throw Error('view failure');}return original(...args);};
  const saved=new Map(),commands=[],store=new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/ARCHIVE_RETRY/exec'},{pendingStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},createRequestId:()=>randomUUID(),submitWebsiteCommand:async(_url,request)=>{commands.push(request);const receipt=b.send(request.operation,request.data,request.requestId);return receipt.result;},readReceipt:async requestId=>plain(b.ctx.websiteReceipt_(requestId))});
  store.websiteEntryVersion=1;store.archivedArrivalVersion=1;store.batchArrivalVersion=1;store.read=async()=>{};
  const send=flag=>batch?store.submitBatchArrival({recorder:'虛構',entries:[{kind:'drink',drinkId:'old',quantity:3,...(flag?{restoreArchived:true}:{})}]}):store.submitArrival({...command,restoreArchived:flag});
  await assert.rejects(send(true),/view failure/);assert.equal(b.sheets.Catalog.rows.find(row=>row[0]==='old')[7],true);
  const before=plain(b.sheets.History.rows);await send(false);assert.equal(commands[0].requestId,commands[1].requestId);assert.deepEqual(commands[1].data,commands[0].data);assert.deepEqual(b.sheets.History.rows,before);
 }
});
