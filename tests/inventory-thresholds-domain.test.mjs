import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryStore } from '../js/store.js';
import { GoogleInventoryStore, normalizeGooglePublicData } from '../js/google-store.js';
import { SNACK_CATEGORIES, initialSupplies, normalizeSupplyWarehouse } from '../js/supplies.js';
import { inventoryLowThreshold, isLowStockItem, isOutOfStockItem, matchesInventoryStockFilter, restockPreferenceMode, restockThreshold, sortInventoryItems } from '../js/restock-preferences.js';

const countedAt='2026-11-03T00:00:00Z';
const endpoint='https://script.google.com/macros/s/INVENTORY_THRESHOLDS/exec';
const storage=()=>{
  const values=new Map();
  return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
};

async function demoStore(t) {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage()});
  t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;});
  const store=new InventoryStore();
  await store.init();
  return store;
}

function warehousePayload() {
  return {
    ok:true,provider:'google',drinks:[],wishes:[],events:[],lastInventoryAt:null,
    formUrls:{wish:'https://docs.google.com/forms/d/e/THRESHOLD_WISH/viewform'},
    adminUrl:'https://docs.google.com/spreadsheets/d/THRESHOLD_SHEET/edit',
    websiteEntry:{version:1,newArrivalVersion:1},
    supplyEntry:{version:1,snackVersion:1,snackPolicyVersion:2,expiryVersion:1,expirySetVersion:1},
    restockPreferenceEntry:{version:1,snackManualVersion:1},
    supplies:initialSupplies(),supplyEvents:[],restockPreferences:[],
  };
}

function summaryRow(kind,id,stock,mode='normal') {
  return {kind,id,name:id,stock,mode,unit:kind==='drink'?'瓶':kind==='noodle'?'杯':kind==='toner'?'盒':'包'};
}

async function setStock(store,kind,id,stock,lastCountAt=countedAt) {
  const next=structuredClone(store.data);
  Object.assign((kind==='drink'?next.drinks:next.supplies).find(item=>item.id===id),{stock,lastCountAt});
  await store.save(next);
}

test('typed thresholds include zero and exclude unknown counts, invalid quantities and manual snacks',()=>{
  assert.deepEqual(['drink','noodle','toner','snack'].map(restockThreshold),[10,1,0,null]);
  assert.equal(restockThreshold('unrecognized'),null);
  for(const [kind,threshold] of [['drink',10],['noodle',1],['toner',0]]) {
    for(const stock of [0,threshold])assert.equal(isLowStockItem({kind,stock,lastCountAt:countedAt}),true,`${kind} at ${stock}`);
    for(const stock of [threshold+1,null,undefined,-1,0.5,NaN,'0'])assert.equal(isLowStockItem({kind,stock,lastCountAt:countedAt}),false,`${kind} rejects ${stock}`);
    assert.equal(isLowStockItem({kind,stock:0,lastCountAt:null}),false);
  }
  assert.equal(isLowStockItem({stock:10,lastCountAt:countedAt}),true,'drink catalog rows omit kind');
  assert.equal(isLowStockItem({stock:11,lastCountAt:countedAt}),false);
  for(const kind of ['snack','unrecognized',null])for(const stock of [0,1,10])assert.equal(isLowStockItem({kind,stock,lastCountAt:countedAt}),false);
});

test('browse low and zero filters use distinct stock ranges without changing reminder thresholds',()=>{
  assert.deepEqual(['drink','snack','noodle','toner'].map(inventoryLowThreshold),[10,10,3,0]);
  assert.equal(inventoryLowThreshold('unrecognized'),null);
  for(const [kind,threshold] of [['drink',10],['snack',10],['noodle',3]]) {
    for(const stock of [1,threshold])assert.equal(matchesInventoryStockFilter({kind,stock,lastCountAt:countedAt},'low'),true,`${kind} browse ${stock}`);
    for(const stock of [0,threshold+1,null,-1,0.5,'1'])assert.equal(matchesInventoryStockFilter({kind,stock,lastCountAt:countedAt},'low'),false,`${kind} excludes ${stock}`);
    assert.equal(isOutOfStockItem({kind,stock:0,lastCountAt:countedAt}),true);
    assert.equal(matchesInventoryStockFilter({kind,stock:0,lastCountAt:countedAt},'empty'),true);
    for(const stock of [1,null,-1,'0'])assert.equal(matchesInventoryStockFilter({kind,stock,lastCountAt:countedAt},'empty'),false);
  }
  for(const kind of ['drink','snack','noodle','toner'])for(const filter of ['low','empty'])assert.equal(matchesInventoryStockFilter({kind,stock:0,lastCountAt:null},filter),false);
  assert.equal(matchesInventoryStockFilter({stock:10,lastCountAt:countedAt},'low'),true);
  assert.equal(matchesInventoryStockFilter({stock:0,lastCountAt:countedAt},'empty'),true);
  assert.equal(matchesInventoryStockFilter({kind:'toner',stock:0,lastCountAt:countedAt},'low'),true);
  assert.equal(matchesInventoryStockFilter({kind:'toner',stock:1,lastCountAt:countedAt},'low'),false);
  assert.equal(matchesInventoryStockFilter({kind:'toner',stock:0,lastCountAt:countedAt},'empty'),false);
  assert.equal(isOutOfStockItem({kind:'toner',stock:0,lastCountAt:countedAt}),false);
  for(const kind of ['unrecognized',null])for(const filter of ['low','empty'])assert.equal(matchesInventoryStockFilter({kind,stock:0,lastCountAt:countedAt},filter),false);
  assert.equal(matchesInventoryStockFilter({kind:'noodle',stock:null,lastCountAt:null},'all'),true);
  assert.equal(matchesInventoryStockFilter({kind:'noodle',stock:3,lastCountAt:countedAt,active:false},'low'),true,'activity is filtered separately by the UI');
  assert.equal(matchesInventoryStockFilter({kind:'noodle',stock:3,lastCountAt:countedAt},'low'),true);
  assert.equal(isLowStockItem({kind:'noodle',stock:3,lastCountAt:countedAt}),false);
  assert.equal(isLowStockItem({kind:'noodle',stock:1,lastCountAt:countedAt}),true);
  assert.equal(isLowStockItem({kind:'snack',stock:1,lastCountAt:countedAt}),false);
});

test('inventory sorting stays numeric and stable across types without changing the input',()=>{
  const items=[
    {id:'unknown',kind:'toner',stock:0,lastCountAt:null},
    {id:'drink',stock:10,lastCountAt:countedAt},
    {id:'noodle',kind:'noodle',stock:5,lastCountAt:countedAt},
    {id:'snack',kind:'snack',stock:0,lastCountAt:countedAt},
    {id:'toner',kind:'toner',stock:0,lastCountAt:countedAt},
  ],before=structuredClone(items);
  assert.deepEqual(sortInventoryItems(items).map(item=>item.id),['snack','toner','noodle','drink','unknown']);
  assert.deepEqual(items,before);
});

test('protein snacks normalize as a category and new local/Google items use existing capabilities',async t=>{
  assert.deepEqual(SNACK_CATEGORIES,['太空包','巧克力','甜/鹹餅乾','燕麥棒/餅','蛋白質零食','其他鹹食','其他甜食']);
  const payload=warehousePayload();
  payload.supplies.push({id:'supply-snack-protein',name:'蛋白棒',kind:'snack',unit:'條',category:'蛋白質零食',active:true,stock:null,lastCountAt:null});
  assert.equal(normalizeSupplyWarehouse(payload).supplies.at(-1).category,'蛋白質零食');
  const publicView=normalizeGooglePublicData(payload);
  assert.deepEqual(publicView.supplies,[]);
  assert.deepEqual(publicView.restockPreferences,[]);
  assert.equal(publicView.supplyEntryVersion,0);
  const store=await demoStore(t),arrival={kind:'snack',name:'新品蛋白棒',unit:'條',category:'蛋白質零食',quantity:3,recorder:'同事'};
  const created=await store.submitNewArrival(arrival),item=store.supplies.find(item=>item.id===created.id);
  assert.equal(item.category,'蛋白質零食');
  assert.equal(item.stock,null);
  assert.equal(item.lastCountAt,null);
  assert.equal(store.supplyEvents.at(-1).expiresOn,null);
  const google=new GoogleInventoryStore({googleScriptUrl:endpoint},{readPublicData:async()=>structuredClone(payload)}),writes=[];
  google.sendWebsiteCommand=async(operation,data)=>{writes.push({operation,data});return {id:'created',quantity:data.quantity};};
  await google.readWarehouse();
  await google.submitNewArrival(arrival);
  assert.deepEqual(writes,[{operation:'new-arrival',data:arrival}]);
  google.supplySnackPolicyVersion=0;
  await assert.rejects(google.submitNewArrival(arrival),/免填效期/);
  assert.equal(writes.length,1);
});

test('new local pauses use each threshold while existing pauses can switch and clear after stock rises',async t=>{
  const store=await demoStore(t);
  for(const [kind,id,threshold] of [['drink',store.data.drinks[0].id,10],['noodle','supply-noodle-01',1],['toner','supply-toner-black',0]]) {
    const command={kind,itemId:id,mode:'hold',expectedMode:'normal'};
    await setStock(store,kind,id,threshold+1);
    const before=structuredClone(store.data);
    await assert.rejects(store.setRestockPreference(command),/提醒門檻/);
    assert.deepEqual(store.data,before);
    await setStock(store,kind,id,0,null);
    await assert.rejects(store.setRestockPreference(command),/提醒門檻/);
    await setStock(store,kind,id,threshold);
    const inventory=structuredClone({drinks:store.data.drinks,supplies:store.supplies,events:store.data.events,supplyEvents:store.supplyEvents});
    await store.setRestockPreference(command);
    assert.deepEqual({drinks:store.data.drinks,supplies:store.supplies,events:store.data.events,supplyEvents:store.supplyEvents},inventory);
    await setStock(store,kind,id,threshold+20);
    await store.setRestockPreference({...command,mode:'replace',expectedMode:'hold'});
    await store.setRestockPreference({...command,mode:'normal',expectedMode:'replace'});
    assert.equal(restockPreferenceMode(store.restockPreferences,kind,id),'normal');
    await assert.rejects(store.setRestockPreference(command),/提醒門檻/);
    if(kind==='noodle') {
      await setStock(store,kind,id,0);
      await store.setRestockPreference(command);
      assert.equal(restockPreferenceMode(store.restockPreferences,kind,id),'hold');
    }
  }
});

test('snack consideration remains manual at zero, high stock and unknown stock without quantity changes',async t=>{
  const store=await demoStore(t),id='supply-snack-01';
  for(const [stock,lastCountAt] of [[0,countedAt],[100,countedAt],[null,null]]) {
    await setStock(store,'snack',id,stock,lastCountAt);
    const before=structuredClone({supplies:store.supplies,events:store.supplyEvents});
    await store.setRestockPreference({kind:'snack',itemId:id,mode:'consider',expectedMode:'normal'});
    assert.equal(restockPreferenceMode(store.restockPreferences,'snack',id),'consider');
    assert.equal(isLowStockItem(store.supplies.find(item=>item.id===id)),false);
    assert.deepEqual({supplies:store.supplies,events:store.supplyEvents},before);
    await store.setRestockPreference({kind:'snack',itemId:id,mode:'normal',expectedMode:'consider'});
  }
});

test('old admin summaries accept the ten-item envelope then display only typed low stock and separate manual snacks',async()=>{
  const value={ok:true,version:1,totalDrinks:2,pendingWishes:0,lowItems:[
    summaryRow('drink','drink-ten',10),summaryRow('noodle','noodle-two',2,'hold'),summaryRow('toner','toner-one',1,'replace'),
    summaryRow('drink','drink-zero',0,'hold'),summaryRow('noodle','noodle-zero',0,'replace'),summaryRow('noodle','noodle-one',1),
    summaryRow('toner','toner-zero',0),summaryRow('noodle','noodle-ten',10),summaryRow('toner','toner-ten',10),summaryRow('snack','snack-zero',0),
  ],manualSnackItems:[{...summaryRow('snack','manual-unknown',null,'consider'),markedAt:countedAt},{...summaryRow('snack','manual-high',100,'consider'),markedAt:countedAt}]};
  const before=structuredClone(value),reads=[],store=new GoogleInventoryStore({googleScriptUrl:endpoint},{readPublicData:async(_url,{action})=>{reads.push(action);return structuredClone(value);}});
  const summary=await store.readAdminSummary();
  assert.deepEqual(summary.lowItems.map(item=>item.id),['toner-zero','noodle-one','drink-ten']);
  assert.deepEqual(summary.outOfStockItems.map(item=>item.id),['drink-zero','noodle-zero','snack-zero']);
  assert.deepEqual(summary.manualSnackItems.map(item=>item.stock),[null,100]);
  assert.equal(summary.outOfStockItems[0].mode,'hold');
  assert.equal(summary.outOfStockItems[1].mode,'replace');
  assert.deepEqual(reads,['admin'],'supported summaries do not fetch the warehouse for zero stock');
  assert.deepEqual(value,before);
  for(const row of [summaryRow('noodle','malformed',11),summaryRow('toner','malformed',-1)]) {
    store.adminSummaryReadAt=-Infinity;
    store.readPublicData=async()=>({...value,lowItems:[row]});
    await assert.rejects(store.readAdminSummary(),/低庫存摘要/);
  }
});

test('legacy warehouse summary fallback uses typed counts, excludes uncounted stock and retains manual snacks',async()=>{
  const payload=warehousePayload();
  payload.drinks=[{id:'drink-ten',name:'茶',category:'茶',packaging:'瓶',unit:'瓶',active:true,stock:10,lastCountAt:countedAt},{id:'drink-zero',name:'零庫存',category:'茶',packaging:'瓶',unit:'瓶',active:true,stock:0,lastCountAt:countedAt},{id:'drink-unknown',name:'待盤點',category:'茶',packaging:'瓶',unit:'瓶',active:true,stock:0,lastCountAt:null}];
  for(const [id,stock,lastCountAt] of [['supply-noodle-01',1,countedAt],['supply-noodle-02',0,countedAt],['supply-noodle-03',2,countedAt],['supply-noodle-04',0,null],['supply-toner-black',0,countedAt],['supply-toner-blue',1,countedAt],['supply-snack-01',0,countedAt]])Object.assign(payload.supplies.find(item=>item.id===id),{stock,lastCountAt});
  payload.restockPreferences=[{kind:'noodle',itemId:'supply-noodle-01',mode:'hold',updatedAt:countedAt},{kind:'snack',itemId:'supply-snack-01',mode:'consider',updatedAt:countedAt},{kind:'snack',itemId:'supply-snack-02',mode:'consider',updatedAt:countedAt}];
  const reads=[],publicStorage=storage(),store=new GoogleInventoryStore({googleScriptUrl:endpoint},{publicStorage,readPublicData:async(_url,{action})=>{reads.push(action);return action==='admin'?{ok:false,error:'unsupported_action'}:structuredClone(payload);}});
  const summary=await store.readAdminSummary();
  assert.deepEqual(reads,['admin','warehouse']);
  assert.deepEqual(summary.lowItems.map(item=>item.id),['supply-toner-black','supply-noodle-01','drink-ten']);
  assert.equal(summary.lowItems[1].mode,'hold');
  assert.deepEqual(summary.outOfStockItems.map(item=>item.id),['drink-zero','supply-snack-01','supply-noodle-02']);
  assert.equal(summary.outOfStockItems[1].mode,'consider');
  assert.deepEqual(summary.manualSnackItems.map(item=>item.stock),[0,null]);
  assert.equal(publicStorage.values.size,0);
  assert.deepEqual(store.supplies,[]);
  assert.equal(store.inWarehouse,false);
});

test('explicit out-of-stock summaries support manual snacks and override legacy zero derivation without exposing private fields',async()=>{
  const snack={...summaryRow('snack','zero-snack',0,'consider'),recorder:'私人姓名',note:'私人備註'},value={ok:true,version:1,totalDrinks:1,pendingWishes:0,
    lowItems:[summaryRow('drink','legacy-zero',0),summaryRow('toner','toner-zero',0)],
    outOfStockItems:[summaryRow('drink','zero-drink',0,'hold'),summaryRow('noodle','zero-noodle',0,'replace'),snack],
    manualSnackItems:[{...snack,markedAt:countedAt}]};
  const reads=[],publicStorage=storage(),store=new GoogleInventoryStore({googleScriptUrl:endpoint},{publicStorage,readPublicData:async(_url,{action})=>{reads.push(action);return structuredClone(value);}});
  let summary=await store.readAdminSummary();
  assert.deepEqual(summary.lowItems.map(item=>item.id),['toner-zero']);
  assert.deepEqual(summary.outOfStockItems.map(item=>item.id),['zero-drink','zero-noodle','zero-snack']);
  assert.equal(summary.outOfStockItems[2].mode,'consider');
  assert.equal(summary.manualSnackItems[0].id,'zero-snack');
  assert.equal(summary.outOfStockItems[2].recorder,undefined);
  assert.equal(summary.outOfStockItems[2].note,undefined);
  assert.equal(publicStorage.values.size,0);
  assert.deepEqual(store.supplies,[]);
  assert.deepEqual(reads,['admin']);
  value.outOfStockItems=[];
  store.adminSummaryReadAt=-Infinity;
  summary=await store.readAdminSummary();
  assert.deepEqual(summary.outOfStockItems,[],'an explicit empty list is authoritative');
});

test('out-of-stock summaries reject malformed, duplicate and non-snack manual modes',async()=>{
  const valid=summaryRow('snack','zero-snack',0,'consider'),base={ok:true,version:1,totalDrinks:0,pendingWishes:0,lowItems:[]};
  const store=new GoogleInventoryStore({googleScriptUrl:endpoint});
  for(const change of [{kind:'toner',unit:'盒',mode:'normal'},{stock:1},{stock:null},{stock:'0'},{unit:'杯'},{mode:'bad'},{kind:'drink',unit:'瓶'},{kind:'noodle',unit:'杯'}]) {
    store.readPublicData=async()=>({...base,outOfStockItems:[{...valid,...change}]});
    await assert.rejects(store.readAdminSummary(),/零庫存摘要/);
  }
  store.readPublicData=async()=>({...base,outOfStockItems:[valid,valid]});
  await assert.rejects(store.readAdminSummary(),/重複/);
  for(const outOfStockItems of [null,{},Array(2001).fill(valid)]) {
    store.readPublicData=async()=>({...base,outOfStockItems});
    await assert.rejects(store.readAdminSummary(),/零庫存摘要/);
  }
});
