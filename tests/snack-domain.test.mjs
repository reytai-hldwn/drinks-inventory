import test from 'node:test';
import assert from 'node:assert/strict';
import {InventoryStore} from '../js/store.js';
import {GoogleInventoryStore,normalizeGooglePublicData} from '../js/google-store.js';
import {SNACK_CATEGORIES,SNACK_UNITS,SUPPLY_CATALOG,initialSupplies,normalizeSupplyWarehouse,prepareSupplyCatalog,supplyBatches,supplyHasUntrackedExpiry,supplyNeedsExpiry,supplySupportsExpiryHistory} from '../js/supplies.js';
import {normalizeRestockPreferences} from '../js/restock-preferences.js';
import {createCompanyData} from '../js/catalog.js';
import {websiteBackend} from './helpers/google-website.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));
const storage=()=>{const values=new Map();return{values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const endpoint='https://script.google.com/macros/s/SNACK_DOMAIN/exec';

function demo(t,data){
 const local=storage(),session=storage();
 for(const [key,value] of [['localStorage',local],['sessionStorage',session]]){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 }
 if(data)local.setItem('office-pantry-demo-v1',JSON.stringify({data,revision:8,updatedAt:'2026-01-01T00:00:00Z'}));
 return local;
}

function payload(){return{ok:true,provider:'google',drinks:[],wishes:[],events:[],lastInventoryAt:null,formUrls:{wish:'https://docs.google.com/forms/d/e/TEST_WISH/viewform'},adminUrl:'https://docs.google.com/spreadsheets/d/TEST_SHEET/edit',websiteEntry:{version:1,newArrivalVersion:1},supplyEntry:{version:1,snackVersion:1,snackPolicyVersion:2,expiryVersion:1,expirySetVersion:1},restockPreferenceEntry:{version:1,snackManualVersion:1},restockPreferences:[],supplies:initialSupplies(),supplyEvents:[]};}

test('snack seeds retain the requested names, explicit categories/units and unknown balances without altering other supplies',()=>{
 assert.deepEqual(SNACK_CATEGORIES,['太空包','巧克力','甜/鹹餅乾','燕麥棒/餅','蛋白質零食','其他鹹食','其他甜食']);assert.deepEqual(SNACK_UNITS,['包','盒','條','個','顆']);
 const snacks=SUPPLY_CATALOG.filter(item=>item.kind==='snack');assert.deepEqual(snacks.map(item=>item.name),['多力多滋','多力多滋','樂事','華元洋芋片']);assert.ok(snacks.every(item=>item.unit==='包'&&SNACK_CATEGORIES.includes(item.category)));
 assert.ok(initialSupplies().filter(item=>item.kind==='snack').every(item=>item.stock===null&&item.lastCountAt===null));assert.equal(SUPPLY_CATALOG.filter(item=>item.kind==='noodle').length,6);assert.equal(SUPPLY_CATALOG.filter(item=>item.kind==='toner').length,4);
 assert.equal(supplyNeedsExpiry('snack'),false);assert.equal(supplySupportsExpiryHistory('snack'),true);assert.equal(supplyNeedsExpiry('noodle'),true);assert.equal(supplyNeedsExpiry('toner'),false);
});

test('warehouse normalization selects snack display fields and validates category, unit, capability and dated events',()=>{
 const data=payload(),snack=data.supplies.find(item=>item.kind==='snack');const normalized=normalizeSupplyWarehouse(data);assert.equal(normalized.supplySnackVersion,1);assert.equal(normalized.supplies.find(item=>item.id===snack.id).category,snack.category);
 for(const change of [item=>{item.category='自創類別';},item=>{item.unit='杯';},item=>{item.kind='toner';}]){const bad=structuredClone(data);change(bad.supplies[0]);assert.throws(()=>normalizeSupplyWarehouse(bad));}
 const legacy=structuredClone(data);delete legacy.supplyEntry.snackVersion;assert.throws(()=>normalizeSupplyWarehouse(legacy),/零食/);
 const event={id:'snack-arrival',supplyId:snack.id,type:'restock',quantity:2,createdAt:'2026-01-01T00:00:00Z',recorder:'同事',note:'',expiresOn:'2099-12-31',batchId:null};
 data.supplyEvents=[event];assert.equal(normalizeSupplyWarehouse(data).supplyEvents.length,1);data.supplyEvents[0].expiresOn=null;assert.equal(normalizeSupplyWarehouse(data).supplyEvents[0].expiresOn,null);
 data.supplyEvents.push({...event,id:'old-snack-expiry',type:'expiry-set',expiresOn:'2000-01-01',batchId:'old-group'},{...event,id:'old-snack-expiry-closed',type:'expiry-close',quantity:0,expiresOn:null,batchId:'old-snack-expiry'});assert.equal(normalizeSupplyWarehouse(data).supplyEvents.length,3);
 const publicData=normalizeGooglePublicData(payload());assert.deepEqual(publicData.supplies,[]);assert.deepEqual(publicData.supplyEvents,[]);
});

test('local upgrade adds pending snack rows once and preserves existing observations, custom items and event IDs',async t=>{
 const data=createCompanyData();data.supplies=initialSupplies().filter(item=>item.kind!=='snack');data.supplies[0].stock=6;data.supplies[0].lastCountAt='2026-01-01T00:00:00Z';data.supplies.push({id:'custom-supply',name:'自建品項',kind:'noodle',unit:'杯',active:true,stock:3,lastCountAt:'2026-01-01T00:00:00Z'});data.supplyEvents=[{id:'retained-observation',supplyId:data.supplies[0].id,type:'count',quantity:6,createdAt:'2026-01-01T00:00:00Z',recorder:'同事',note:''}];
 const before=structuredClone(data),local=demo(t,data),one=new InventoryStore();await one.init();assert.equal(one.revision,9);assert.deepEqual(one.data.supplies.filter(item=>item.kind!=='snack'),before.supplies);assert.deepEqual(one.data.supplyEvents,before.supplyEvents);assert.deepEqual(one.data.drinks,before.drinks);assert.equal(one.supplies.filter(item=>item.kind==='snack').length,4);
 const snapshot=local.getItem('office-pantry-demo-v1'),two=new InventoryStore();await two.init();assert.equal(two.revision,9);assert.equal(local.getItem('office-pantry-demo-v1'),snapshot);assert.equal(prepareSupplyCatalog(two.data),two.data);
});

test('local snack arrivals/new products need no date, preserve optional old dates and recorded balances, and retain history',async t=>{
 demo(t);const store=new InventoryStore();await store.init();const snack=store.supplies.find(item=>item.kind==='snack'),drinks=structuredClone(store.data.drinks);
 for(const data of [{category:'',unit:'包',expiresOn:'2099-12-31'},{category:'巧克力',unit:'杯',expiresOn:'2099-12-31'},{category:'巧克力',unit:'條',expiresOn:'2026-02-30'}])await assert.rejects(store.submitNewArrival({kind:'snack',name:'新品巧克力',quantity:3,recorder:'同事',...data}));
 await store.submitSupplyArrival({supplyId:snack.id,quantity:2,recorder:'同事'});assert.equal(store.supplyEvents.at(-1).expiresOn,null);
 await store.submitSupplyArrival({supplyId:snack.id,quantity:2,recorder:'同事',expiresOn:'2000-01-01'});assert.equal(store.supplyEvents.at(-1).expiresOn,'2000-01-01');assert.equal(store.supplies.find(item=>item.id===snack.id).stock,4);
 await store.submitSupplyStocktake([{supplyId:snack.id,quantity:3}],'同事');const count=store.supplyEvents.at(-1);assert.equal(supplyHasUntrackedExpiry(snack.id,store.supplyEvents),true);
 await store.setSupplyExpiry({supplyId:snack.id,expectedStock:3,expectedEventId:count.id,batches:[{quantity:3,expiresOn:'2099-11-30'}],recorder:'同事'});assert.equal(supplyBatches(snack.id,store.supplyEvents).length,1);
 const batch=supplyBatches(snack.id,store.supplyEvents)[0];await store.closeSupplyBatch({batchId:batch.id,recorder:'同事'});assert.equal(supplyBatches(snack.id,store.supplyEvents).length,0);assert.equal(store.supplies.find(item=>item.id===snack.id).stock,3);
 const created=await store.submitNewArrival({kind:'snack',name:'新品巧克力',unit:'條',quantity:4,category:'巧克力',recorder:'同事'});assert.equal(store.supplyEvents.at(-1).expiresOn,null);assert.equal(store.supplies.find(item=>item.id===created.id).stock,4);assert.equal(store.supplies.find(item=>item.id===created.id).category,'巧克力');await assert.rejects(store.submitNewArrival({kind:'snack',name:' 新品巧克力 ',unit:'包',quantity:1,category:'其他甜食',expiresOn:'2099-12-31',recorder:'同事'}),/同名/);assert.deepEqual(store.data.drinks,drinks);
 await assert.rejects(store.setRestockPreference({kind:'snack',itemId:snack.id,mode:'hold',expectedMode:'normal'}),/零食請使用/);
 const withLegacy=structuredClone(store.data);withLegacy.restockPreferences=[{kind:'snack',itemId:snack.id,mode:'hold',updatedAt:'2026-01-01T00:00:00Z'}];await store.save(withLegacy);
 await store.setRestockPreference({kind:'snack',itemId:snack.id,mode:'normal',expectedMode:'hold'});assert.equal(store.restockPreferences[0].mode,'normal');
 await store.setRestockPreference({kind:'snack',itemId:created.id,mode:'consider',expectedMode:'normal'});assert.equal(store.restockPreferences.find(pref=>pref.itemId===created.id).mode,'consider');
 await store.submitSupplyStocktake([{supplyId:created.id,quantity:42}],'同事');await store.submitSupplyArrival({supplyId:created.id,quantity:3,recorder:'同事'});assert.equal(store.supplies.find(item=>item.id===created.id).stock,45);assert.equal(store.restockPreferences.find(pref=>pref.itemId===created.id).mode,'consider');
 await store.setRestockPreference({kind:'snack',itemId:created.id,mode:'normal',expectedMode:'consider'});assert.equal(store.restockPreferences.find(pref=>pref.itemId===created.id).mode,'normal');
 assert.equal((await store.setRestockPreference({kind:'noodle',itemId:'supply-noodle-01',mode:'consider',expectedMode:'normal'})).mode,'consider');
});

test('ordinary supply capability on older Google deployments cannot send any snack mutation',async()=>{
 let writes=0;const store=new GoogleInventoryStore({googleScriptUrl:endpoint},{submitWebsiteCommand:async()=>{writes++;return{};}});store.websiteEntryVersion=store.supplyEntryVersion=store.supplyExpiryVersion=store.supplyExpirySetVersion=store.newArrivalVersion=store.restockPreferenceVersion=1;
 store.supplies=[{id:'supply-snack-01',kind:'snack'}];store.supplyEvents=[{id:'snack-batch',supplyId:'supply-snack-01'}];
 const calls=[()=>store.submitNewArrival({kind:'snack',category:'太空包',unit:'包',expiresOn:'2099-12-31'}),()=>store.submitSupplyArrival({supplyId:'supply-snack-01',quantity:2,expiresOn:'2099-12-31'}),()=>store.submitSupplyStocktake([{supplyId:'supply-snack-01',quantity:2}],'同事'),()=>store.closeSupplyBatch({batchId:'snack-batch'}),()=>store.setSupplyExpiry({supplyId:'supply-snack-01'}),()=>store.setRestockPreference({kind:'snack',itemId:'supply-snack-01'})];
 for(const call of calls)await assert.rejects(call(),/零食/);assert.equal(writes,0);assert.equal(store.supportsSnacks,false);
});

test('Google snack reads expose explicit capability and validated dated writes without caching warehouse observations',async()=>{
 const b=websiteBackend(),publicStorage=storage(),store=new GoogleInventoryStore({googleScriptUrl:endpoint},{publicStorage,pendingStorage:storage(),createRequestId:()=>crypto.randomUUID(),readPublicData:async(_url,{action})=>plain(action==='warehouse'?b.ctx.warehouseData_():b.ctx.publicData_()),submitWebsiteCommand:async(_url,request)=>b.send(request.operation,request.data,request.requestId).result});
 await store.init();await store.readWarehouse();assert.equal(store.supportsSnacks,true);
 const before=b.sheets.SupplyHistory?.rows.length||0;await assert.rejects(store.submitNewArrival({kind:'snack',name:'新零食',category:'不正確',unit:'包',quantity:2,expiresOn:'2099-12-31',recorder:'同事'}),/分類/);assert.equal(b.sheets.SupplyHistory?.rows.length||0,before);
 const created=await store.submitNewArrival({kind:'snack',name:'新零食',category:'其他鹹食',unit:'包',quantity:2,recorder:'同事'});assert.equal(store.supplies.find(item=>item.id===created.id).category,'其他鹹食');
 const cached=JSON.parse([...publicStorage.values.values()][0]);assert.equal(cached.payload.supplies,undefined);assert.equal(cached.payload.supplyEvents,undefined);assert.ok(cached.payload.drinks.every(drink=>drink.lastCountAt===null&&drink.stock===0));
 const preference=normalizeRestockPreferences({restockPreferenceEntry:{version:1},restockPreferences:[{kind:'snack',itemId:created.id,mode:'hold',updatedAt:'2026-01-01T00:00:00Z'}]});assert.equal(preference.restockPreferences[0].kind,'snack');
});


test('snacks have a quantity browsing list while manual consideration remains explicit',async()=>{
 const data=payload(),snack=data.supplies.find(item=>item.kind==='snack');snack.stock=2;snack.lastCountAt='2026-01-01T00:00:00Z';
 let action='admin',writes=0;
 const store=new GoogleInventoryStore({googleScriptUrl:endpoint},{pendingStorage:storage(),createRequestId:()=>crypto.randomUUID(),readPublicData:async(_url,parameters)=>{
  if(parameters.action==='admin')return action==='legacy'?{ok:false,error:'unsupported_action'}:{ok:true,version:1,totalDrinks:0,pendingWishes:0,manualSnackItems:[{id:snack.id,name:snack.name,kind:'snack',unit:'包',stock:null,mode:'consider',markedAt:'2026-01-01T00:00:00Z'}],lowItems:[{id:snack.id,name:snack.name,kind:'snack',unit:'包',stock:2,mode:'normal'},{id:'tea',name:'茶',kind:'drink',unit:'瓶',stock:3,mode:'normal'}]};
  return structuredClone(data);
 },submitWebsiteCommand:async()=>{writes++;return{};}});
 await store.readWarehouse();let summary=await store.readAdminSummary();assert.deepEqual(summary.lowItems.map(item=>item.id),['supply-snack-01','tea']);assert.equal(summary.manualSnackItems[0].stock,null);
 action='legacy';data.restockPreferences=[{kind:'snack',itemId:snack.id,mode:'consider',updatedAt:'2026-01-01T00:00:00Z'}];store.adminSummaryReadAt=-Infinity;summary=await store.readAdminSummary();assert.deepEqual(summary.lowItems,[]);assert.equal(summary.manualSnackItems[0].stock,2);
 for(const mode of ['hold','replace'])await assert.rejects(store.setRestockPreference({kind:'snack',itemId:snack.id,mode,expectedMode:'normal'}),/零食請使用/);assert.equal(writes,0);
});


test('policy and manual capabilities independently gate date-less snack writes while old stock counts remain available',async()=>{
 const data=payload();delete data.supplyEntry.snackPolicyVersion;delete data.restockPreferenceEntry.snackManualVersion;let writes=0;
 const store=new GoogleInventoryStore({googleScriptUrl:endpoint},{pendingStorage:storage(),createRequestId:()=>crypto.randomUUID(),readPublicData:async()=>structuredClone(data),submitWebsiteCommand:async()=>{writes++;return{};}});
 await store.readWarehouse();assert.equal(store.supportsSnacks,true);assert.equal(store.supportsSnackNoExpiry,false);assert.equal(store.supportsSnackRestockFlags,false);
 await store.submitSupplyStocktake([{supplyId:'supply-snack-01',quantity:3}],'同事');assert.equal(writes,1);
 await assert.rejects(store.submitSupplyArrival({supplyId:'supply-snack-01',quantity:2,recorder:'同事'}),/免填效期/);await assert.rejects(store.submitNewArrival({kind:'snack',name:'新點心',category:'其他甜食',unit:'包',quantity:2,recorder:'同事'}),/免填效期/);await assert.rejects(store.setRestockPreference({kind:'snack',itemId:'supply-snack-01',mode:'consider',expectedMode:'normal'}),/手動補貨/);assert.equal(writes,1);
 data.supplyEntry.snackPolicyVersion=2;data.restockPreferenceEntry.snackManualVersion=1;await store.readWarehouse();assert.equal(store.supportsSnackNoExpiry,true);assert.equal(store.supportsSnackRestockFlags,true);
 await store.submitSupplyArrival({supplyId:'supply-snack-01',quantity:2,recorder:'同事'});await store.setRestockPreference({kind:'snack',itemId:'supply-snack-01',mode:'consider',expectedMode:'normal'});assert.equal(writes,3);
 const before=writes;await assert.rejects(store.submitSupplyArrival({supplyId:'supply-snack-01',quantity:2,recorder:'同事',expiresOn:'2026-02-30'}),/格式/);assert.equal(writes,before);
 for(const kind of ['drink','noodle','toner'])assert.equal(normalizeRestockPreferences({restockPreferenceEntry:{version:1},restockPreferences:[{kind,itemId:'test',mode:'consider',updatedAt:'2026-01-01T00:00:00Z'}]}).restockPreferences[0].mode,'consider');
});

test('manual snack summaries default empty for old deployments and reject malformed or duplicate rows',async()=>{
 const valid={kind:'snack',id:'supply-snack-01',name:'測試零食',unit:'包',stock:null,mode:'consider',markedAt:'2026-01-01T00:00:00Z'},base={ok:true,version:1,totalDrinks:0,pendingWishes:0,lowItems:[]};
 const store=new GoogleInventoryStore({googleScriptUrl:endpoint},{readPublicData:async()=>structuredClone(base)});assert.deepEqual((await store.readAdminSummary()).manualSnackItems,[]);
 for(const change of [{kind:'noodle'},{mode:'hold'},{stock:-1},{stock:1.5},{unit:'杯'},{markedAt:'bad-date'}]){store.adminSummaryReadAt=-Infinity;store.readPublicData=async()=>({...base,manualSnackItems:[{...valid,...change}]});await assert.rejects(store.readAdminSummary(),/手動補貨摘要/);}
 store.readPublicData=async()=>({...base,manualSnackItems:[valid,valid]});await assert.rejects(store.readAdminSummary(),/重複/);
});
