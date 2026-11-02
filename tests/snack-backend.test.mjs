import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {websiteBackend,memorySheet} from './helpers/google-website.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));
const categories=['太空包','巧克力','甜/鹹餅乾','燕麥棒/餅','其他鹹食','其他甜食'];
const units=['包','盒','條','個','顆'];
const arrival=(overrides={})=>({kind:'snack',name:'虛構零食新品',category:'其他鹹食',unit:'包',quantity:3,recorder:'測試同事',expiresOn:'2099-12-31',note:'測試資料',...overrides});
const inventory=b=>plain(b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss)));
const events=b=>plain(b.ctx.supplyEvents_(b.ss));

test('read-only snack upgrade exposes four categorized pending products without changing legacy source rows or public drinks',()=>{
  const b=websiteBackend(),legacy=b.ctx.INITIAL_SUPPLIES.filter(item=>item.kind!=='snack').map(item=>[item.id,item.name,item.kind,item.unit,item.active]);
  b.sheets.SupplyCatalog=memorySheet([['id','name','kind','unit','active'],...plain(legacy)]);
  const before=plain(b.sheets.SupplyCatalog.rows),drinks=plain(b.ctx.publicData_().drinks),view=plain(b.ctx.warehouseData_());
  assert.equal(view.supplyEntry.snackVersion,1);
  assert.deepEqual(view.supplies.filter(item=>item.kind==='snack').map(item=>[item.id,item.name,item.unit,item.category,item.stock,item.lastCountAt]),[
    ['supply-snack-01','多力多滋雙倍起司口味','包','太空包',null,null],
    ['supply-snack-02','多力多滋香菜口味','包','太空包',null,null],
    ['supply-snack-03','樂事海苔口味','包','太空包',null,null],
    ['supply-snack-04','華元蚵仔煎','包','太空包',null,null],
  ]);
  assert.deepEqual(b.sheets.SupplyCatalog.rows,before);assert.equal(b.sheets.SupplyHistory,undefined);assert.equal(b.sheets.SupplyWarehouse,undefined);
  assert.deepEqual(plain(b.ctx.publicData_().drinks),drinks);
});

test('the first snack write adds the sixth category header and missing seeds without overwriting old quantities/catalog data',()=>{
  const b=websiteBackend(),legacy=plain(b.ctx.INITIAL_SUPPLIES.filter(item=>item.kind!=='snack').map(item=>[item.id,item.name,item.kind,item.unit,item.active]));
  legacy[0][1]='使用者保留的泡麵名稱';b.sheets.SupplyCatalog=memorySheet([['id','name','kind','unit','active'],...legacy]);
  const drinkHistory=plain(b.sheets.History.rows);
  assert.equal(b.send('supply-stocktake',{entries:[{supplyId:'supply-snack-01',quantity:6}],recorder:'測試同事'}).state,'accepted');
  assert.deepEqual(b.sheets.SupplyCatalog.rows[0],['id','name','kind','unit','active','category']);
  assert.deepEqual(b.sheets.SupplyCatalog.rows.slice(1,legacy.length+1),legacy);
  assert.equal(b.sheets.SupplyCatalog.rows.filter(row=>String(row[0]).startsWith('supply-snack-')).length,4);
  assert.equal(inventory(b).find(item=>item.id==='supply-snack-01').stock,6);
  assert.deepEqual(b.sheets.History.rows,drinkHistory);
});

test('snack new-arrival retains each allowed category/unit, counts only the arrival and reuses its request on retry',()=>{
  for(let index=0;index<categories.length;index++){
    const b=websiteBackend(),id=randomUUID(),data=arrival({category:categories[index],unit:units[index%units.length]});
    const first=b.send('new-arrival',data,id);assert.equal(first.state,'accepted');assert.deepEqual(b.send('new-arrival',data,id),first);
    const item=inventory(b).find(item=>item.id===first.result.id);assert.equal(item.kind,'snack');assert.equal(item.category,data.category);assert.equal(item.unit,data.unit);assert.equal(item.stock,null);assert.equal(item.lastCountAt,null);
    const own=events(b).filter(event=>event.supplyId===item.id);assert.equal(own.length,1);assert.equal(own[0].quantity,3);assert.equal(own[0].expiresOn,data.expiresOn);
    assert.equal(b.sheets.SupplyCatalog.rows.filter(row=>row[0]===item.id).length,1);
    assert.equal(b.ctx.publicData_().drinks.some(drink=>drink.id===item.id),false);
  }
});

test('invalid snack category, units, dates, quantities and duplicate names never create inventory source rows',()=>{
  for(const change of [{category:undefined},{category:''},{category:'其他'},{unit:'杯'},{unit:'瓶'},{expiresOn:''},{expiresOn:'2026-02-30'},{expiresOn:'2000-01-01'},{quantity:0},{quantity:1.5},{quantity:1000000},{cases:1},{recorder:''},{name:' 多力多滋雙倍起司口味 '}]){
    const b=websiteBackend(),before=plain({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows});
    assert.equal(b.send('new-arrival',arrival(change)).state,'rejected',JSON.stringify(change));
    assert.equal(b.sheets.SupplyCatalog,undefined);assert.equal(b.sheets.SupplyHistory,undefined);assert.deepEqual({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows},before);
  }
});

test('snack duplicate detection is category-independent within snacks and does not merge identically named noodles',()=>{
  const b=websiteBackend(),data=arrival({name:'Ｎｅｗ 零食'}),one=b.send('new-arrival',data);
  assert.equal(one.state,'accepted');assert.equal(b.send('new-arrival',arrival({name:'  New 零食 ',category:'巧克力'})).state,'rejected');
  const noodle=b.send('new-arrival',{...data,kind:'noodle',unit:'杯'});assert.equal(noodle.state,'accepted');assert.notEqual(noodle.result.id,one.result.id);
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
  for(const expiresOn of ['', '2000-01-01','2099-02-30'])assert.equal(b.send('supply-arrival',{supplyId,quantity:2,expiresOn,recorder:'測試同事'}).state,'rejected');
  assert.equal(b.send('supply-arrival',{supplyId,quantity:2,expiresOn:'2099-12-31',recorder:'測試同事'}).state,'accepted');
  assert.equal(inventory(b).find(item=>item.id===supplyId).stock,7);assert.equal(b.ctx.openSupplyBatches_(supplyId,b.ctx.supplyEvents_(b.ss)).length,3);
  const batch=events(b).find(event=>event.supplyId===supplyId&&event.type==='expiry-set');b.send('supply-expiry-close',{batchId:batch.id,recorder:'測試同事'});
  assert.equal(inventory(b).find(item=>item.id===supplyId).stock,7);assert.equal(b.ctx.openSupplyBatches_(supplyId,b.ctx.supplyEvents_(b.ss)).length,2);
  b.send('supply-stocktake',{entries:[{supplyId,quantity:0}],recorder:'測試盤點'});assert.equal(b.ctx.openSupplyBatches_(supplyId,b.ctx.supplyEvents_(b.ss)).length,0);
});

test('snacks sort by observed stock without low-stock reminders while legacy preference audit and other supply kinds remain usable',()=>{
  const b=websiteBackend(),supplyId='supply-snack-02';b.send('supply-stocktake',{entries:[{supplyId,quantity:4},{supplyId:'supply-snack-01',quantity:9}],recorder:'測試盤點'});
  const sorted=plain(b.ctx.sortInventoryEntries_(b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss)))).filter(item=>item.kind==='snack');
  assert.deepEqual(sorted.map(item=>item.id),['supply-snack-02','supply-snack-01','supply-snack-03','supply-snack-04']);
  for(const mode of ['hold','replace'])assert.equal(b.send('restock-preference',{kind:'snack',itemId:supplyId,expectedMode:'normal',mode}).state,'rejected');
  assert.equal(plain(b.ctx.adminSummaryData_().lowItems).some(item=>item.kind==='snack'),false);
  const sheet=memorySheet([plain(b.ctx.RESTOCK_PREFERENCE_HEADERS),['legacy-snack-hold','2020-01-01T00:00:00Z','snack',supplyId,'hold','先前設定','採計']]);
  b.sheets.RestockPreferences=sheet;
  assert.equal(plain(b.ctx.restockPreferences_(b.ss))[0].mode,'hold');
  b.ctx.renderSupplyWarehouse_(b.ss);const generated=b.sheets.SupplyWarehouse.rows.find(row=>row[0]===supplyId);assert.equal(generated[7],'');
  assert.equal(b.send('restock-preference',{kind:'snack',itemId:supplyId,expectedMode:'hold',mode:'normal'}).state,'accepted');
  assert.equal(sheet.rows[1][4],'hold','original audit row is retained');assert.equal(sheet.rows.at(-1)[4],'normal');
  assert.equal(b.send('restock-preference',{kind:'drink',itemId:'milk',expectedMode:'normal',mode:'hold'}).state,'accepted');
  assert.equal(b.send('new-arrival',arrival({kind:'toner',unit:'盒'})).state,'rejected');
  assert.equal(b.send('supply-arrival',{supplyId:'supply-toner-purple',quantity:2,recorder:'測試同事'}).state,'rejected');
  const toner=b.send('supply-arrival',{supplyId:'supply-toner-black',quantity:2,recorder:'測試同事'});assert.equal(toner.state,'accepted');
  assert.equal(events(b).find(event=>event.supplyId==='supply-toner-black').expiresOn,null);
});

test('an unrelated occupied sixth catalog column is preserved and the entire snack arrival is rejected',()=>{
  const b=websiteBackend(),row=['supply-noodle-01','保留名稱','noodle','杯',true,'保留內容'];b.sheets.SupplyCatalog=memorySheet([['id','name','kind','unit','active','備註'],row]);const before=plain(b.sheets.SupplyCatalog.rows);
  const result=b.send('new-arrival',arrival());assert.equal(result.state,'rejected');assert.deepEqual(b.sheets.SupplyCatalog.rows,before);assert.equal(b.sheets.SupplyHistory,undefined);
});
