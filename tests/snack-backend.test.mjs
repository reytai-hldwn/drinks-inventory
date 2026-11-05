import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {websiteBackend,memorySheet} from './helpers/google-website.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));
const categories=['太空包','巧克力','甜/鹹餅乾','健康零食','其他鹹食','其他甜食'];
const units=['包','盒','條','個','顆'];
const arrival=(overrides={})=>({kind:'snack',name:'虛構零食新品',category:'其他鹹食',unit:'包',quantity:3,recorder:'測試同事',note:'測試資料',...overrides});
const inventory=b=>plain(b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss)));
const events=b=>plain(b.ctx.supplyEvents_(b.ss));

test('read-only snack upgrade exposes four categorized pending products without changing legacy source rows or public drinks',()=>{
  const b=websiteBackend(),legacy=b.ctx.INITIAL_SUPPLIES.filter(item=>item.kind!=='snack').map(item=>[item.id,item.name,item.kind,item.unit,item.active]);
  b.sheets.SupplyCatalog=memorySheet([['id','name','kind','unit','active'],...plain(legacy)]);
  const before=plain(b.sheets.SupplyCatalog.rows),drinks=plain(b.ctx.publicData_().drinks),view=plain(b.ctx.warehouseData_());
  assert.equal(view.supplyEntry.snackVersion,1);assert.equal(view.supplyEntry.snackPolicyVersion,2);assert.equal(view.restockPreferenceEntry.snackManualVersion,1);
  assert.deepEqual(view.supplies.filter(item=>item.kind==='snack').map(item=>[item.id,item.name,item.unit,item.category,item.stock,item.lastCountAt]),[
    ['supply-snack-01','多力多滋','包','太空包',null,null],
    ['supply-snack-02','多力多滋','包','太空包',null,null],
    ['supply-snack-03','樂事','包','太空包',null,null],
    ['supply-snack-04','華元洋芋片','包','太空包',null,null],
  ]);
  assert.deepEqual(b.sheets.SupplyCatalog.rows,before);assert.equal(b.sheets.SupplyHistory,undefined);assert.equal(b.sheets.SupplyWarehouse,undefined);
  assert.deepEqual(plain(b.ctx.publicData_().drinks),drinks);
});

test('the first snack write adds the sixth category header and missing seeds without overwriting old quantities/catalog data',()=>{
  const b=websiteBackend(),legacy=plain(b.ctx.INITIAL_SUPPLIES.filter(item=>item.kind!=='snack').map(item=>[item.id,item.name,item.kind,item.unit,item.active]));
  legacy[0][1]='使用者保留的泡麵名稱';b.sheets.SupplyCatalog=memorySheet([['id','name','kind','unit','active'],...legacy]);
  const drinkHistory=plain(b.sheets.History.rows);
  assert.equal(b.send('supply-stocktake',{entries:[{supplyId:'supply-snack-01',quantity:6}],recorder:'測試同事'}).state,'accepted');
  assert.deepEqual(b.sheets.SupplyCatalog.rows[0],['id','name','kind','unit','active','category','flavor']);
  assert.deepEqual(b.sheets.SupplyCatalog.rows.slice(1,legacy.length+1),legacy);
  assert.equal(b.sheets.SupplyCatalog.rows.filter(row=>String(row[0]).startsWith('supply-snack-')).length,4);
  assert.equal(inventory(b).find(item=>item.id==='supply-snack-01').stock,6);
  assert.deepEqual(b.sheets.History.rows,drinkHistory);
});

test('snack new-arrival retains each allowed category/unit, counts only the arrival and reuses its request on retry',()=>{
  for(let index=0;index<categories.length;index++){
    const b=websiteBackend(),id=randomUUID(),data=arrival({category:categories[index],unit:units[index%units.length]});
    const first=b.send('new-arrival',data,id);assert.equal(first.state,'accepted');assert.deepEqual(b.send('new-arrival',data,id),first);
    const item=inventory(b).find(item=>item.id===first.result.id);assert.equal(item.kind,'snack');assert.equal(item.category,data.category);assert.equal(item.unit,data.unit);assert.equal(item.stock,3);assert.equal(item.lastCountAt,null);
    const own=events(b).filter(event=>event.supplyId===item.id);assert.equal(own.length,1);assert.equal(own[0].quantity,3);assert.equal(own[0].expiresOn,data.expiresOn||null);
    assert.equal(b.sheets.SupplyCatalog.rows.filter(row=>row[0]===item.id).length,1);
    assert.equal(b.ctx.publicData_().drinks.some(drink=>drink.id===item.id),false);
  }
});

test('invalid snack category, units, dates, quantities and duplicate names never create inventory source rows',()=>{
  for(const change of [{category:undefined},{category:''},{category:'其他'},{unit:'杯'},{unit:'瓶'},{expiresOn:'2026-02-30'},{expiresOn:0},{quantity:0},{quantity:1.5},{quantity:1000000},{cases:1},{recorder:''},{name:' 多力多滋雙倍起司口味 '}]){
    const b=websiteBackend(),before=plain({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows});
    assert.equal(b.send('new-arrival',arrival(change)).state,'rejected',JSON.stringify(change));
    assert.equal(b.sheets.SupplyCatalog,undefined);assert.equal(b.sheets.SupplyHistory,undefined);assert.deepEqual({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows},before);
  }
});

test('snack duplicate detection is category-independent within snacks and does not merge identically named noodles',()=>{
  const b=websiteBackend(),data=arrival({name:'Ｎｅｗ 零食'}),one=b.send('new-arrival',data);
  assert.equal(one.state,'accepted');assert.equal(b.send('new-arrival',arrival({name:'  New 零食 ',category:'巧克力'})).state,'rejected');
  const noodle=b.send('new-arrival',{...data,kind:'noodle',unit:'杯',expiresOn:'2099-12-31'});assert.equal(noodle.state,'accepted');assert.notEqual(noodle.result.id,one.result.id);
});

test('snack partial saves recover once and a pending same-name creation loses cleanly to a completed registration',()=>{
  const b=websiteBackend(),id=randomUUID(),render=b.ctx.renderSupplyWarehouse_;let fail=true;
  b.ctx.renderSupplyWarehouse_=(...args)=>{if(fail){fail=false;throw new Error('temporary view');}return render(...args);};
  assert.throws(()=>b.send('new-arrival',arrival(),id),/temporary view/);assert.equal(b.send('new-arrival',arrival(),id).state,'accepted');
  assert.equal(events(b).filter(event=>event.id.includes(id)).length,1);assert.equal(b.sheets.SupplyCatalog.rows.filter(row=>row[1]===arrival().name).length,1);
  const collision=websiteBackend(),apply=collision.ctx.applyWebsiteRequest_,pending=randomUUID();let hold=true;
  collision.ctx.applyWebsiteRequest_=(...args)=>{if(hold){hold=false;throw new Error('before apply');}return apply(...args);};
  assert.throws(()=>collision.send('new-arrival',arrival(),pending),/before apply/);assert.equal(collision.send('new-arrival',arrival({category:'巧克力'})).state,'accepted');
  assert.equal(collision.send('new-arrival',arrival(),pending).state,'rejected');assert.equal(events(collision).filter(event=>event.id.includes(pending)).length,0);
});

test('dated snack arrivals, expiry completion, closing and zero counts preserve exact quantities and separate batches',()=>{
  const b=websiteBackend(),supplyId='supply-snack-03';
  b.send('supply-stocktake',{entries:[{supplyId,quantity:5}],recorder:'測試盤點'});
  const last=events(b).filter(event=>event.supplyId===supplyId).at(-1),counted=inventory(b).find(item=>item.id===supplyId).lastCountAt;
  const expiry=b.send('supply-expiry-set',{supplyId,expectedStock:5,expectedEventId:last.id,recorder:'測試效期',batches:[{quantity:2,expiresOn:'2098-06-01'},{quantity:3,expiresOn:'2099-06-01'}]});assert.equal(expiry.state,'accepted');
  assert.equal(inventory(b).find(item=>item.id===supplyId).stock,5);assert.equal(inventory(b).find(item=>item.id===supplyId).lastCountAt,counted);
  for(const expiresOn of ['not-a-date','2099-02-30'])assert.equal(b.send('supply-arrival',{supplyId,quantity:2,expiresOn,recorder:'測試同事'}).state,'rejected');
  assert.equal(b.send('supply-arrival',{supplyId,quantity:2,expiresOn:'2099-12-31',recorder:'測試同事'}).state,'accepted');
  assert.equal(inventory(b).find(item=>item.id===supplyId).stock,7);assert.equal(b.ctx.openSupplyBatches_(supplyId,b.ctx.supplyEvents_(b.ss)).length,3);
  const batch=events(b).find(event=>event.supplyId===supplyId&&event.type==='expiry-set');b.send('supply-expiry-close',{batchId:batch.id,recorder:'測試同事'});
  assert.equal(inventory(b).find(item=>item.id===supplyId).stock,7);assert.equal(b.ctx.openSupplyBatches_(supplyId,b.ctx.supplyEvents_(b.ss)).length,2);
  b.send('supply-stocktake',{entries:[{supplyId,quantity:0}],recorder:'測試盤點'});assert.equal(b.ctx.openSupplyBatches_(supplyId,b.ctx.supplyEvents_(b.ss)).length,0);
});

test('snack manual consideration flags allow unknown, zero and high stock and survive all quantity updates until unchecked',()=>{
  for(const quantity of [null,0,27]){
    const b=websiteBackend(),supplyId='supply-snack-02';
    if(quantity!==null)b.send('supply-stocktake',{entries:[{supplyId,quantity}],recorder:'測試盤點'});
    const request=randomUUID(),data={kind:'snack',itemId:supplyId,expectedMode:'normal',mode:'consider'},first=b.send('restock-preference',data,request);
    assert.equal(first.state,'accepted');assert.deepEqual(b.send('restock-preference',data,request),first);assert.equal(first.result.mode,'consider');
    let summary=plain(b.ctx.adminSummaryData_());assert.equal(summary.lowItems.some(item=>item.kind==='snack'),quantity!==null&&quantity>0&&quantity<=10);assert.equal(summary.manualSnackItems.length,1);
    assert.deepEqual(summary.manualSnackItems[0],{kind:'snack',id:supplyId,name:'多力多滋',flavor:'香菜',unit:'包',stock:quantity,mode:'consider',markedAt:first.result.updatedAt});
    b.send('supply-arrival',{supplyId,quantity:2,recorder:'測試同事'});
    for(const stock of [50,0]){
      b.send('supply-stocktake',{entries:[{supplyId,quantity:stock}],recorder:'測試盤點'});
      summary=plain(b.ctx.adminSummaryData_());assert.equal(summary.manualSnackItems[0].stock,stock);assert.equal(summary.manualSnackItems[0].markedAt,first.result.updatedAt);
    }
    assert.equal(b.send('restock-preference',{...data,mode:'normal'}).state,'rejected','stale mode cannot erase a manual mark');
    assert.equal(b.send('restock-preference',{...data,expectedMode:'consider',mode:'normal'}).state,'accepted');
    assert.equal(plain(b.ctx.adminSummaryData_()).manualSnackItems.length,0);
  }
});

test('legacy snack preference audit remains readable while new snack pauses reject and all kinds accept explicit refill requests',()=>{
  const b=websiteBackend(),supplyId='supply-snack-02';
  const sheet=memorySheet([plain(b.ctx.RESTOCK_PREFERENCE_HEADERS),['legacy-snack-hold','2020-01-01T00:00:00Z','snack',supplyId,'hold','先前設定','採計']]);b.sheets.RestockPreferences=sheet;
  assert.equal(plain(b.ctx.restockPreferences_(b.ss))[0].mode,'hold');
  for(const mode of ['hold','replace'])assert.equal(b.send('restock-preference',{kind:'snack',itemId:supplyId,expectedMode:'hold',mode}).state,'rejected');
  b.ctx.renderSupplyWarehouse_(b.ss);assert.equal(b.sheets.SupplyWarehouse.rows.find(row=>row[0]===supplyId)[7],'暫不需要補貨');
  assert.equal(b.send('restock-preference',{kind:'snack',itemId:supplyId,expectedMode:'hold',mode:'consider'}).state,'accepted');
  assert.equal(sheet.rows[1][4],'hold','the original audit row is preserved');assert.equal(sheet.rows.at(-1)[4],'consider');
  assert.equal(b.sheets.SupplyWarehouse.rows.find(row=>row[0]===supplyId)[7],'需要補貨');
  for(const [kind,itemId] of [['drink','milk'],['noodle','supply-noodle-01'],['toner','supply-toner-black']])assert.equal(b.send('restock-preference',{kind,itemId,expectedMode:'normal',mode:'consider'}).state,'accepted');
  assert.equal(b.send('restock-preference',{kind:'drink',itemId:'milk',expectedMode:'consider',mode:'hold'}).state,'accepted');
  assert.equal(b.send('restock-preference',{kind:'noodle',itemId:'supply-noodle-01',expectedMode:'consider',mode:'normal'}).state,'accepted');
  assert.equal(b.send('restock-preference',{kind:'noodle',itemId:'supply-noodle-01',expectedMode:'normal',mode:'hold'}).state,'rejected','noodle unknown stock retains its guard');
  b.send('supply-stocktake',{entries:[{supplyId:'supply-noodle-01',quantity:27}],recorder:'測試盤點'});
  assert.equal(b.send('restock-preference',{kind:'noodle',itemId:'supply-noodle-01',expectedMode:'normal',mode:'hold'}).state,'rejected','high noodle stock retains its guard');
});

test('an unrelated occupied sixth catalog column is preserved and the entire snack arrival is rejected',()=>{
  const b=websiteBackend(),row=['supply-noodle-01','保留名稱','noodle','杯',true,'保留內容'];b.sheets.SupplyCatalog=memorySheet([['id','name','kind','unit','active','備註'],row]);const before=plain(b.sheets.SupplyCatalog.rows);
  const result=b.send('new-arrival',arrival());assert.equal(result.state,'rejected');assert.deepEqual(b.sheets.SupplyCatalog.rows,before);assert.equal(b.sheets.SupplyHistory,undefined);
});


test('snack dates are optional metadata and old dated batches stay readable without generated expiry reminders',()=>{
  const b=websiteBackend(),supplyId='supply-snack-03';b.send('supply-stocktake',{entries:[{supplyId,quantity:5}],recorder:'測試盤點'});
  const legacy=b.send('supply-arrival',{supplyId,quantity:2,expiresOn:'2000-01-01',recorder:'測試同事'});assert.equal(legacy.state,'accepted');
  const stored=plain(b.sheets.SupplyHistory.rows),before=events(b);assert.equal(before.at(-1).expiresOn,'2000-01-01');
  b.ctx.renderSupplyWarehouse_(b.ss);assert.equal(b.sheets.SupplyWarehouse.rows.find(row=>row[0]===supplyId)[6],'');assert.deepEqual(b.sheets.SupplyHistory.rows,stored);
  assert.equal(b.send('supply-arrival',{supplyId,quantity:2,recorder:'測試同事'}).state,'accepted');assert.equal(events(b).at(-1).expiresOn,null);
  for(const expiresOn of [undefined,null,'','2000-01-01']){
    const data=arrival({name:`日期選填 ${String(expiresOn)}`,expiresOn});const result=b.send('new-arrival',data);assert.equal(result.state,'accepted');assert.equal(events(b).find(event=>event.supplyId===result.result.id).expiresOn,expiresOn||null);
  }
  for(const expiresOn of [undefined,'','2000-01-01']){
    assert.equal(b.send('supply-arrival',{supplyId:'supply-noodle-01',quantity:2,recorder:'測試同事',expiresOn}).state,'rejected');
    assert.equal(b.send('new-arrival',{kind:'noodle',name:'效期必填泡麵',unit:'杯',quantity:2,recorder:'測試同事',expiresOn}).state,'rejected');
  }
});

test('manual snack summary keeps pending stock nullable, includes historical flags and never leaks full histories',()=>{
  const b=websiteBackend();b.send('supply-stocktake',{entries:[{supplyId:'supply-snack-01',quantity:30}],recorder:'測試盤點'});
  for(const itemId of ['supply-snack-01','supply-snack-02'])assert.equal(b.send('restock-preference',{kind:'snack',itemId,expectedMode:'normal',mode:'consider'}).state,'accepted');
  const summary=plain(b.ctx.adminSummaryData_());assert.deepEqual(summary.manualSnackItems.map(item=>item.stock),[30,null]);assert.doesNotMatch(JSON.stringify(summary),/expiresOn|batchId|recorder|supplyEvents/);
  b.sheets.SupplyCatalog.rows.find(row=>row[0]==='supply-snack-01')[4]=false;
  assert.deepEqual(plain(b.ctx.adminSummaryData_()).manualSnackItems.map(item=>item.id),['supply-snack-01','supply-snack-02']);
  assert.equal(b.send('restock-preference',{kind:'snack',itemId:'supply-snack-01',expectedMode:'consider',mode:'normal'}).state,'accepted');
});

test('dated snack arrival and manual marker retries preserve their prepared history after a generated-view failure',()=>{
  for(const operation of ['supply-arrival','restock-preference']){
    const b=websiteBackend(),id=randomUUID(),render=b.ctx.renderSupplyWarehouse_;let fail=true;
    b.ctx.renderSupplyWarehouse_=(...args)=>{if(fail){fail=false;throw new Error('temporary view');}return render(...args);};
    const data=operation==='supply-arrival'?{supplyId:'supply-snack-01',quantity:2,expiresOn:'2099-12-31',recorder:'測試同事'}:{kind:'snack',itemId:'supply-snack-01',expectedMode:'normal',mode:'consider'};
    assert.throws(()=>b.send(operation,data,id),/temporary view/);assert.equal(b.ctx.websiteReceipt_(id).state,'pending');
    const before=operation==='supply-arrival'?plain(b.sheets.SupplyHistory.rows):plain(b.sheets.RestockPreferences.rows);
    const accepted=b.send(operation,data,id);assert.equal(accepted.state,'accepted');assert.deepEqual(b.send(operation,data,id),accepted);
    assert.deepEqual(operation==='supply-arrival'?b.sheets.SupplyHistory.rows:b.sheets.RestockPreferences.rows,before);
    const row=b.sheets.SupplyWarehouse.rows.find(row=>row[0]==='supply-snack-01');assert.equal(row[6],'');
    if(operation==='supply-arrival')assert.equal(events(b)[0].expiresOn,'2099-12-31');else assert.equal(row[7],'需要補貨');
  }
});
