import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {RESTOCK_MODES,isLowStockItem,sortInventoryItems,restockPreferenceMode,normalizeRestockPreferences} from '../js/restock-preferences.js';
import {GoogleInventoryStore,normalizeGooglePublicData} from '../js/google-store.js';
import {InventoryStore} from '../js/store.js';
import {websiteBackend,memorySheet} from './helpers/google-website.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));
const storage=()=>{const data=new Map();return{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};

test('inventory sorting puts zero first and pending last without moving equal stock or changing inputs',()=>{
 const items=[{id:'unknown',stock:0,lastCountAt:null},{id:'ten',stock:10,lastCountAt:'2020-01-01'},{id:'zero',stock:0,lastCountAt:'2020-01-01'},{id:'same',stock:10,lastCountAt:'2020-01-01'},{id:'high',stock:20,lastCountAt:'2020-01-01'}];
 const before=structuredClone(items);assert.deepEqual(sortInventoryItems(items).map(item=>item.id),['zero','ten','same','high','unknown']);assert.deepEqual(items,before);
 assert.equal(isLowStockItem(items[0]),false);assert.equal(isLowStockItem(items[1]),true);assert.equal(isLowStockItem(items[2]),true);assert.equal(isLowStockItem(items[4]),false);
});

test('restock preference reads expose only a warehouse capability and never create source tables',()=>{
 const backend=websiteBackend(),before=Object.keys(backend.sheets),view=plain(backend.ctx.warehouseData_());
 assert.deepEqual(view.restockPreferenceEntry,{version:1,snackManualVersion:1});assert.deepEqual(view.restockPreferences,[]);assert.deepEqual(Object.keys(backend.sheets),before);
 const front=plain(backend.ctx.publicData_());assert.equal(front.restockPreferences,undefined);assert.equal(front.restockPreferenceEntry,undefined);
 assert.deepEqual(normalizeRestockPreferences({}),{restockPreferences:[],restockPreferenceVersion:0});
 assert.deepEqual(normalizeGooglePublicData(view).restockPreferences,[]);
});

test('hold/replace/restore persists across categories and preserves quantities, counts, expiry and drink catalogs',()=>{
 const backend=websiteBackend(),id='supply-noodle-03';
 backend.send('supply-stocktake',{entries:[{supplyId:id,quantity:0},{supplyId:'supply-toner-blue',quantity:0}],recorder:'盤點'});
 backend.send('supply-arrival',{supplyId:id,quantity:1,expiresOn:'2099-01-01',recorder:'到貨'});
 const sources=()=>plain({catalog:backend.sheets.Catalog.rows,history:backend.sheets.History.rows,supplyCatalog:backend.sheets.SupplyCatalog.rows,supplyHistory:backend.sheets.SupplyHistory.rows});
 const before=sources(),publicStamp=backend.props.get('HOLDWIN_PUBLIC_UPDATED_AT');
 for(const [kind,itemId] of [['drink','milk'],['noodle',id],['toner','supply-toner-blue']]){
  const request=randomUUID(),data={kind,itemId,mode:'hold',expectedMode:'normal'};
  assert.equal(backend.send('restock-preference',data,request).state,'accepted');assert.equal(backend.send('restock-preference',data,request).state,'accepted');
  assert.equal(backend.send('restock-preference',{kind,itemId,mode:'replace',expectedMode:'hold'}).state,'accepted');
  const view=normalizeGooglePublicData(plain(backend.ctx.warehouseData_()),{warehouse:true});
  assert.equal(restockPreferenceMode(view.restockPreferences,kind,itemId),'replace');assert.equal(view.restockPreferenceVersion,1);
  assert.equal(backend.send('restock-preference',{kind,itemId,mode:'normal',expectedMode:'replace'}).state,'accepted');
 }
 assert.deepEqual(sources(),before);assert.equal(backend.props.get('HOLDWIN_PUBLIC_UPDATED_AT'),publicStamp);
 assert.equal(backend.sheets.RestockPreferences.rows.length,10,'one audit row per actual change, not retry');
 const front=normalizeGooglePublicData(plain(backend.ctx.warehouseData_()));assert.deepEqual(front.restockPreferences,[]);assert.equal(front.restockPreferenceVersion,0);
});

test('invalid, high/unknown, stale and cross-kind preferences are rejected without source mutation',()=>{
 for(const data of [{kind:'drink',itemId:'tea',mode:'hold',expectedMode:'normal'},{kind:'noodle',itemId:'supply-noodle-01',mode:'hold',expectedMode:'normal'},{kind:'toner',itemId:'supply-noodle-01',mode:'hold',expectedMode:'normal'},{kind:'drink',itemId:'old',mode:'replace',expectedMode:'normal'},{kind:'drink',itemId:'milk',mode:'bad',expectedMode:'normal'},{kind:'drink',itemId:'milk',mode:'hold',expectedMode:'replace'}]){
  const backend=websiteBackend(),before=plain({catalog:backend.sheets.Catalog.rows,history:backend.sheets.History.rows});
  assert.equal(backend.send('restock-preference',data).state,'rejected');assert.equal(backend.sheets.RestockPreferences,undefined);assert.deepEqual(plain({catalog:backend.sheets.Catalog.rows,history:backend.sheets.History.rows}),before);
 }
 const backend=websiteBackend();backend.sheets.RestockPreferences=memorySheet([['私人備註'],['保留原內容']]);
 assert.equal(backend.send('restock-preference',{kind:'drink',itemId:'milk',mode:'hold',expectedMode:'normal'}).state,'rejected');assert.deepEqual(backend.sheets.RestockPreferences.rows,[['私人備註'],['保留原內容']]);
});

test('a retry after a view failure does not duplicate preferences and a pause can be restored above ten',()=>{
 const backend=websiteBackend(),request=randomUUID(),data={kind:'drink',itemId:'milk',mode:'hold',expectedMode:'normal'};let fail=true;
 backend.ctx.renderWarehouse_=()=>{if(fail){fail=false;throw new Error('view unavailable');}};
 assert.throws(()=>backend.send('restock-preference',data,request),/unavailable/);assert.equal(backend.send('restock-preference',data,request).state,'accepted');assert.equal(backend.sheets.RestockPreferences.rows.length,2);
 backend.send('stocktake',{entries:[{drinkId:'milk',quantity:30}],recorder:'盤點'});
 assert.equal(restockPreferenceMode(plain(backend.ctx.warehouseData_()).restockPreferences,'drink','milk'),'hold');
 assert.equal(backend.send('restock-preference',{...data,mode:'replace',expectedMode:'hold'}).state,'accepted');
 assert.equal(backend.send('restock-preference',{...data,mode:'normal',expectedMode:'replace'}).state,'accepted');
 assert.equal(backend.send('restock-preference',data).state,'rejected','high stock cannot start a new pause');
});

test('Google preference commands require capabilities, confirm receipts and preserve confirmed state on a failed refresh',async()=>{
 const backend=websiteBackend();let failRead=false,writes=0;
 const store=new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/PREF_TEST/exec'},{pendingStorage:storage(),readPublicData:async(_url,{action})=>{if(failRead)throw new Error('offline');return plain(action==='warehouse'?backend.ctx.warehouseData_():backend.ctx.publicData_());},submitWebsiteCommand:async(_url,command)=>{writes++;return backend.send(command.operation,command.data,command.requestId).result;}});
 await store.readWarehouse();assert.equal(store.supportsRestockPreferences,true);failRead=true;
 await store.setRestockPreference({kind:'drink',itemId:'milk',mode:'hold',expectedMode:'normal'});assert.equal(store.lastWriteNeedsRefresh,true);assert.equal(restockPreferenceMode(store.restockPreferences,'drink','milk'),'hold');assert.equal(writes,1);
 failRead=false;const legacy=plain(backend.ctx.warehouseData_());delete legacy.restockPreferenceEntry;store.applyGoogleView(normalizeGooglePublicData(legacy,{warehouse:true}),true);
 await assert.rejects(store.setRestockPreference({kind:'drink',itemId:'milk',mode:'normal',expectedMode:'hold'}),/更新/);assert.equal(writes,1);
});

test('demo preferences persist after reload and do not generate quantity events',async t=>{
 const original=globalThis.localStorage;globalThis.localStorage=storage();t.after(()=>{if(original===undefined)delete globalThis.localStorage;else globalThis.localStorage=original;});
 const store=new InventoryStore();await store.init();const id=store.data.drinks[0].id,next=structuredClone(store.data);next.drinks[0].stock=3;next.drinks[0].lastCountAt='2020-01-01T00:00:00Z';await store.save(next);
 const before=structuredClone({drinks:store.data.drinks,events:store.data.events});await store.setRestockPreference({kind:'drink',itemId:id,mode:'replace',expectedMode:'normal'});
 assert.deepEqual({drinks:store.data.drinks,events:store.data.events},before);const reader=new InventoryStore();await reader.init();assert.equal(restockPreferenceMode(reader.restockPreferences,'drink',id),'replace');
 await reader.setRestockPreference({kind:'drink',itemId:id,mode:'normal',expectedMode:'replace'});assert.equal(restockPreferenceMode(reader.restockPreferences,'drink',id),'normal');
 assert.equal(RESTOCK_MODES.replace,'可以準備替換新品項');
});
