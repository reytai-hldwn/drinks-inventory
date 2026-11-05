import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {websiteBackend} from './helpers/google-website.mjs';
import {GoogleInventoryStore} from '../js/google-store.js';
import {InventoryStore} from '../js/store.js';
import {restockPreferenceMode} from '../js/restock-preferences.js';
import {findProductPhoto} from '../js/product-photos.js';
const plain=x=>JSON.parse(JSON.stringify(x));
const storage=()=>{const values=new Map();return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const sources=b=>plain({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows,supplyCatalog:b.sheets.SupplyCatalog?.rows,supplyHistory:b.sheets.SupplyHistory?.rows});
function archivedBackend(){const b=websiteBackend();b.ctx.ensureSupplyStorage_(b.ss);for(const id of ['supply-snack-01','supply-noodle-01','supply-toner-black'])b.sheets.SupplyCatalog.rows.find(row=>row[0]===id)[4]=false;return b;}

test('all historical kinds can mark/cancel restock without changing availability, quantities or ledgers',()=>{
 const b=archivedBackend(),before=sources(b);
 for(const [kind,itemId]of [['drink','old'],['snack','supply-snack-01'],['noodle','supply-noodle-01'],['toner','supply-toner-black']]){
  const data={kind,itemId,mode:'consider',expectedMode:'normal'},id=randomUUID();assert.equal(b.send('restock-preference',data,id).state,'accepted');assert.equal(b.send('restock-preference',data,id).state,'accepted');
  assert.ok(b.ctx.adminSummaryData_().restockItems.some(item=>item.kind===kind&&item.id===itemId));
 }
 assert.equal(b.ctx.adminSummaryData_().restockItems.length,4);assert.deepEqual(sources(b),before);assert.equal(b.sheets.RestockPreferences.rows.length,5);
 assert.equal(b.send('restock-preference',{kind:'drink',itemId:'old',mode:'normal',expectedMode:'normal'}).state,'rejected','a stale client cannot cancel someone else’s flag');
 for(const [kind,itemId]of [['drink','old'],['snack','supply-snack-01'],['noodle','supply-noodle-01'],['toner','supply-toner-black']])assert.equal(b.send('restock-preference',{kind,itemId,mode:'normal',expectedMode:'consider'}).state,'accepted');
 assert.equal(b.ctx.adminSummaryData_().restockItems.length,0);assert.deepEqual(sources(b),before);
 assert.equal(b.send('restock-preference',{kind:'drink',itemId:'old',mode:'replace',expectedMode:'normal'}).state,'rejected');
});

test('historical flags survive a failed view and retry without duplicate rows',()=>{
 const b=archivedBackend(),before=sources(b),id=randomUUID(),data={kind:'drink',itemId:'old',mode:'consider',expectedMode:'normal'};let fail=true;
 b.ctx.renderWarehouse_=()=>{if(fail){fail=false;throw Error('view failed');}};assert.throws(()=>b.send('restock-preference',data,id));assert.equal(b.send('restock-preference',data,id).state,'accepted');assert.equal(b.sheets.RestockPreferences.rows.length,2);assert.deepEqual(sources(b),before);
});

test('client gates manual archives on the new deployment and preserves existing automatic-zero support',async()=>{
 const b=archivedBackend();b.send('stocktake',{entries:[{drinkId:'milk',quantity:0}],recorder:'虛構'});let calls=0,legacy=true;
 const store=new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/ARCHIVED_TEST/exec'},{pendingStorage:storage(),readPublicData:async()=>{const payload=plain(b.ctx.warehouseData_());if(legacy)delete payload.restockPreferenceEntry.archivedVersion;return payload;},submitWebsiteCommand:async(_url,command)=>{calls++;const receipt=b.send(command.operation,command.data,command.requestId);assert.equal(receipt.state,'accepted');return receipt.result;}});
 await store.readWarehouse();assert.equal(store.supportsArchivedRestock,false);await assert.rejects(store.setRestockPreference({kind:'drink',itemId:'old',mode:'consider',expectedMode:'normal'}),/更新/);assert.equal(calls,0);
 await store.setRestockPreference({kind:'drink',itemId:'milk',mode:'consider',expectedMode:'normal'});assert.equal(calls,1);
 legacy=false;await store.readWarehouse();assert.equal(store.supportsArchivedRestock,true);await store.setRestockPreference({kind:'drink',itemId:'old',mode:'consider',expectedMode:'normal'});assert.equal(calls,2);assert.equal(store.data.drinks.find(item=>item.id==='old').active,false);assert.equal(restockPreferenceMode(store.restockPreferences,'drink','old'),'consider');
});

test('local historical flags persist without restoring products or inventing stock events',async t=>{
 const original=globalThis.localStorage;globalThis.localStorage=storage();t.after(()=>{if(original===undefined)delete globalThis.localStorage;else globalThis.localStorage=original;});
 const store=new InventoryStore();await store.init();const next=structuredClone(store.data),item=next.drinks[0];item.active=false;item.stock=4;item.lastCountAt='2026-11-02T00:00:00Z';await store.save(next);const before=plain({drinks:store.data.drinks,events:store.data.events});
 await store.setRestockPreference({kind:'drink',itemId:item.id,mode:'consider',expectedMode:'normal'});assert.deepEqual(plain({drinks:store.data.drinks,events:store.data.events}),before);const reloaded=new InventoryStore();await reloaded.init();assert.equal(reloaded.data.drinks.find(d=>d.id===item.id).active,false);assert.equal(restockPreferenceMode(reloaded.restockPreferences,'drink',item.id),'consider');
});

function honeyBackend(){const b=websiteBackend();b.sheets.Catalog.rows.push(['company-drink-26','蜂蜜燕麥','其他','寶特瓶','瓶',24,10,true]);b.sheets.History.rows.push(['honey-original','2026-11-02T01:31:06.990Z','count','company-drink-26','蜂蜜燕麥',1,'已更正原誤記','Rey','採計'],['honey-zero','2026-11-05T00:13:04.000Z','count','company-drink-26','蜂蜜燕麥',0,'實際無庫存','Rey','採計']);return b;}
const rename={drinkId:'company-drink-26',expectedName:'蜂蜜燕麥',name:'愛之味蜂蜜燕麥',recorder:'Rey'};

test('audited drink rename preserves the corrected zero balance, original ledger, ID and photo',()=>{
 const b=honeyBackend(),before=plain(b.sheets.History.rows),catalog=plain(b.sheets.Catalog.rows),id=randomUUID();assert.equal(b.ctx.publicData_().websiteEntry.drinkNameVersion,1);
 const result=b.send('drink-name',rename,id);assert.equal(result.state,'accepted');assert.equal(result.result.name,rename.name);assert.equal(b.send('drink-name',rename,id).state,'accepted');assert.deepEqual(plain(b.sheets.History.rows),before);
 const after=plain(b.sheets.Catalog.rows);catalog.at(-1)[1]=rename.name;assert.deepEqual(after,catalog);const item=plain(b.ctx.warehouseData_()).drinks.find(item=>item.id===rename.drinkId);assert.equal(item.name,rename.name);assert.equal(item.stock,0);assert.equal(item.active,false);assert.equal(item.autoArchived,true);assert.equal(findProductPhoto(rename.name).src,findProductPhoto(rename.expectedName).src);
 assert.equal(b.sheets.WebsiteRequests.rows.filter(row=>row[0]===id).length,1);assert.equal(b.props.get('HOLDWIN_CATALOG_FORMS_DIRTY'),'true');
});

test('stale, duplicate or extra-field renames are rejected before metadata or inventory changes',()=>{
 for(const data of [{...rename,expectedName:'其他名稱'},{...rename,name:'茶'},{...rename,name:''},{...rename,quantity:3},{...rename,active:true},{...rename,recorder:''}]){const b=honeyBackend(),before=sources(b);assert.equal(b.send('drink-name',data).state,'rejected');assert.deepEqual(sources(b),before);}
 const b=honeyBackend();b.sheets.Catalog.rows.at(-1)[7]=false;assert.equal(b.send('drink-name',rename).state,'accepted');assert.equal(b.sheets.Catalog.rows.at(-1)[7],false);
});

test('a pending rename resumes safely after a view failure and does not overwrite a subsequent rename',()=>{
 const b=honeyBackend(),id=randomUUID(),before=plain(b.sheets.History.rows);let fail=true;b.ctx.renderArchive_=()=>{if(fail){fail=false;throw Error('view failed');}};assert.throws(()=>b.send('drink-name',rename,id));assert.equal(b.send('drink-name',rename,id).state,'accepted');assert.equal(b.sheets.Catalog.rows.at(-1)[1],rename.name);assert.deepEqual(plain(b.sheets.History.rows),before);
 const other=honeyBackend(),pending=randomUUID();other.ctx.renderArchive_=()=>{throw Error('view failed');};assert.throws(()=>other.send('drink-name',rename,pending));other.sheets.Catalog.rows.at(-1)[1]='另一位管理者的新名稱';assert.equal(other.send('drink-name',rename,pending).state,'rejected');assert.equal(other.sheets.Catalog.rows.at(-1)[1],'另一位管理者的新名稱');
});
