import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {parse} from 'acorn';
import {websiteBackend,memorySheet} from './helpers/google-website.mjs';

const source=await readFile(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const inventory=b=>plain(b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss)));
const sources=b=>plain({catalog:b.sheets.Catalog.rows,history:b.sheets.History.rows,supplyCatalog:b.sheets.SupplyCatalog?.rows,supplyHistory:b.sheets.SupplyHistory?.rows});
const targets=[
  {kind:'drink',id:'milk',threshold:10},
  {kind:'noodle',id:'supply-noodle-01',threshold:1,unit:'杯'},
  {kind:'noodle',id:'supply-noodle-02',threshold:1,unit:'碗'},
  {kind:'toner',id:'supply-toner-black',threshold:0},
];
function count(b,target,quantity) {
  const operation=target.kind==='drink'?'stocktake':'supply-stocktake';
  const entry=target.kind==='drink'?{drinkId:target.id,quantity}:{supplyId:target.id,quantity};
  assert.equal(b.send(operation,{entries:[entry],recorder:'門檻測試盤點'}).state,'accepted');
}
function preference(b,target,mode,expectedMode='normal',requestId) {
  return b.send('restock-preference',{kind:target.kind,itemId:target.id,mode,expectedMode},requestId);
}
function restoreDrinkRenderer(b) {
  const start=source.indexOf('function renderWarehouse_('),end=source.indexOf('\nfunction renderArchive_(',start);
  assert.ok(start>=0&&end>start);
  vm.runInContext(source.slice(start,end),b.ctx);
  b.sheets.Warehouse.setConditionalFormatRules=()=>{};
  b.sheets.Warehouse.setColumnWidth=()=>{};
  b.ctx.SpreadsheetApp.newConditionalFormatRule=()=>{
    const rule={whenFormulaSatisfied(){return rule;},setBackground(){return rule;},setFontColor(){return rule;},setRanges(){return rule;},build(){return rule;}};
    return rule;
  };
}

test('protein snacks create, persist and read through the seventh ordered category without an expiry requirement',()=>{
  const b=websiteBackend(),requestId=randomUUID();
  assert.deepEqual(plain(b.ctx.SNACK_CATEGORIES),['太空包','巧克力','甜/鹹餅乾','燕麥棒/餅','蛋白質零食','其他鹹食','其他甜食']);
  const data={kind:'snack',name:'蛋白質零食新品測試',category:'蛋白質零食',unit:'條',quantity:7,recorder:'零食測試'};
  const accepted=b.send('new-arrival',data,requestId);
  assert.equal(accepted.state,'accepted');assert.deepEqual(b.send('new-arrival',data,requestId),accepted);
  const id=accepted.result.id,row=b.sheets.SupplyCatalog.rows.find(entry=>entry[0]===id);
  assert.deepEqual(row,[id,data.name,'snack','條',true,'蛋白質零食','']);
  assert.equal(b.sheets.SupplyCatalog.rows.filter(entry=>entry[0]===id).length,1);
  const events=plain(b.ctx.supplyEvents_(b.ss)).filter(entry=>entry.supplyId===id);
  assert.equal(events.length,1);assert.equal(events[0].quantity,7);assert.equal(events[0].expiresOn,null);
  assert.equal(b.sheets.SupplyHistory.rows.find(entry=>entry[3]===id).length,11);
  const reloaded=websiteBackend();
  for(const name of ['SupplyCatalog','SupplyHistory'])reloaded.sheets[name]=memorySheet(plain(b.sheets[name].rows));
  const saved=plain(reloaded.ctx.warehouseData_()).supplies.find(entry=>entry.id===id);
  assert.equal(saved.category,'蛋白質零食');assert.equal(saved.unit,'條');assert.equal(saved.stock,7);assert.equal(saved.lastCountAt,null);
  assert.equal(preference(reloaded,{kind:'snack',id},'consider').state,'accepted');
  const summary=plain(reloaded.ctx.adminSummaryData_());
  assert.equal(summary.manualSnackItems.find(entry=>entry.id===id).stock,7);assert.equal(summary.lowItems.some(entry=>entry.id===id),true);
  const rendered=reloaded.sheets.SupplyWarehouse.rows.find(entry=>entry[0]===id);
  assert.equal(rendered[6],'');assert.equal(rendered[7],'需要補貨');assert.equal(rendered[8],'蛋白質零食');
});

test('summary separates empty drinks, snacks and noodles from low stock while retaining toner zero and manual snacks',()=>{
  for(const quantity of [0,1,2,10,11,99]){
    const b=websiteBackend();
    for(const target of targets)count(b,target,quantity);
    count(b,{kind:'snack',id:'supply-snack-01'},quantity);
    assert.equal(preference(b,{kind:'snack',id:'supply-snack-01'},'consider').state,'accepted');
    const summary=plain(b.ctx.adminSummaryData_());
    for(const target of targets){
      const low=summary.lowItems.find(entry=>entry.kind===target.kind&&entry.id===target.id);
      assert.equal(Boolean(low),target.kind!=='noodle'&&quantity<=target.threshold&&(quantity>0||target.kind==='toner'),`${target.kind} ${target.unit||''} at ${quantity}`);
      if(low){assert.equal(low.stock,quantity);assert.equal(low.mode,'normal');if(target.unit)assert.equal(low.unit,target.unit);}
      const empty=summary.outOfStockItems.find(entry=>entry.kind===target.kind&&entry.id===target.id);
      assert.equal(Boolean(empty),quantity===0&&target.kind!=='toner',`${target.kind} ${target.unit||''} empty at ${quantity}`);
      if(empty){assert.equal(empty.stock,0);assert.equal(empty.mode,'normal');if(target.unit)assert.equal(empty.unit,target.unit);}
    }
    assert.equal(summary.lowItems.some(entry=>entry.kind==='snack'),quantity>0&&quantity<=10);
    assert.equal(summary.lowItems.some(entry=>entry.id==='supply-noodle-03'||entry.id==='supply-toner-red'),false);
    assert.equal(summary.manualSnackItems.length,1);assert.equal(summary.manualSnackItems[0].stock,quantity);
    assert.equal(summary.outOfStockItems.some(entry=>entry.id==='supply-snack-01'),quantity===0);
    assert.deepEqual(summary.lowItems.map(entry=>entry.stock),summary.lowItems.map(entry=>entry.stock).sort((a,b)=>a-b));
    assert.deepEqual(summary.outOfStockItems.map(entry=>entry.stock),summary.outOfStockItems.map(entry=>entry.stock).sort((a,b)=>a-b));
  }
});

test('zero-stock summary rows preserve preference modes, overlap manual snack flags and exclude unknown or inactive items',()=>{
  const b=websiteBackend();
  for(const target of targets)count(b,target,0);
  count(b,targets[2],1);
  for(const id of ['supply-snack-01','supply-snack-02','supply-snack-03'])count(b,{kind:'snack',id},0);
  b.sheets.SupplyCatalog.rows.find(row=>row[0]==='supply-snack-03')[4]=false;
  assert.equal(preference(b,targets[0],'hold').state,'accepted');
  assert.equal(preference(b,targets[1],'replace').state,'accepted');
  assert.equal(preference(b,targets[3],'hold').state,'accepted');
  for(const id of ['supply-snack-01','supply-snack-04'])assert.equal(preference(b,{kind:'snack',id},'consider').state,'accepted');
  const before=sources(b),summary=plain(b.ctx.adminSummaryData_());
  assert.deepEqual(summary.lowItems.map(item=>[item.kind,item.id,item.stock,item.mode]),[
    ['toner','supply-toner-black',0,'hold'],
  ]);
  assert.deepEqual(summary.outOfStockItems,[
    {kind:'drink',id:'milk',name:'牛乳',flavor:'',unit:'包',stock:0,mode:'hold'},
    {kind:'snack',id:'supply-snack-01',name:'多力多滋',flavor:'雙倍起司',unit:'包',stock:0,mode:'consider'},
    {kind:'snack',id:'supply-snack-02',name:'多力多滋',flavor:'香菜',unit:'包',stock:0,mode:'normal'},
    {kind:'noodle',id:'supply-noodle-01',name:'來一客海鮮',flavor:'',unit:'杯',stock:0,mode:'replace'},
  ]);
  assert.deepEqual(summary.manualSnackItems.map(item=>[item.id,item.stock]),[['supply-snack-01',0],['supply-snack-04',null]]);
  assert.equal(b.sheets.SupplyWarehouse.rows.find(row=>row[0]==='supply-snack-02')[7],'');
  const again=plain(b.ctx.adminSummaryData_());assert.ok(Date.parse(again.snapshotAt)>=Date.parse(summary.snapshotAt));assert.deepEqual({...again,snapshotAt:summary.snapshotAt},summary);assert.deepEqual(sources(b),before);
  assert.doesNotMatch(JSON.stringify(summary),/events|recorder|lastCountAt|expiresOn/);
});

test('new holds and replacements require the matching typed threshold and preserve all quantity sources',()=>{
  for(const target of targets)for(const quantity of [null,0,1,2,10,11,99])for(const mode of ['hold','replace']){
    const b=websiteBackend();
    if(quantity===null&&target.kind==='drink')b.sheets.History.rows.splice(1);
    if(quantity!==null)count(b,target,quantity);
    const before=sources(b),response=preference(b,target,mode);
    assert.equal(response.state,quantity!==null&&quantity<=target.threshold?'accepted':'rejected',`${target.kind} ${target.unit||''} ${mode} at ${quantity}`);
    assert.deepEqual(sources(b),before);
    if(response.state==='accepted')assert.equal(b.sheets.RestockPreferences.rows.at(-1)[4],mode);
    else assert.equal(b.sheets.RestockPreferences,undefined);
  }
});

test('arrival-only balances become known without automatically marking them for refill',()=>{
  const b=websiteBackend();b.sheets.History.rows.splice(1);
  assert.equal(b.send('arrival',{drinkId:'milk',loose:1,recorder:'未盤點入庫'}).state,'accepted');
  for(const target of targets.filter(entry=>entry.kind!=='drink')){
    assert.equal(b.send('supply-arrival',{supplyId:target.id,quantity:1,expiresOn:target.kind==='noodle'?'2099-12-31':undefined,recorder:'未盤點入庫'}).state,'accepted');
  }
  assert.deepEqual(plain(b.ctx.adminSummaryData_()).restockItems,[]);
  assert.deepEqual(plain(b.ctx.adminSummaryData_()).outOfStockItems,[]);
  for(const target of targets){
    assert.equal(preference(b,target,'hold').state,'rejected');
    const item=target.kind==='drink'?b.inventory().find(entry=>entry.drink.id===target.id):inventory(b).find(entry=>entry.id===target.id);
    assert.equal(item.stock,1);assert.equal(item.lastCountAt,null);
    for(const stock of [null,undefined,'0',NaN,Infinity,-1,0.5]){
      assert.equal(b.ctx.inventoryIsLow_(target.kind,{stock,lastCountAt:'2026-01-01'}),false);
    }
    assert.equal(b.ctx.inventoryIsLow_(target.kind,{stock:0,lastCountAt:null}),false);
  }
  b.ctx.renderSupplyWarehouse_(b.ss);
  for(const target of targets.filter(entry=>entry.kind!=='drink'))assert.equal(b.sheets.SupplyWarehouse.rows.find(entry=>entry[0]===target.id)[7],'');
  restoreDrinkRenderer(b);b.ctx.renderWarehouse_(b.ss,b.ctx.computeInventory_(b.ctx.catalog_(b.ss),b.ctx.historyEvents_(b.ss)));
  assert.equal(b.sheets.Warehouse.rows.find(entry=>entry?.[0]==='milk')[9],'');
});

test('stored pauses remain visible after replenishment and can transition or clear without quantity events',()=>{
  for(const target of targets){
    const b=websiteBackend();count(b,target,0);
    const requestId=randomUUID(),first=preference(b,target,'hold','normal',requestId);
    assert.equal(first.state,'accepted');assert.deepEqual(preference(b,target,'hold','normal',requestId),first);
    const operation=target.kind==='drink'?'arrival':'supply-arrival';
    const data={recorder:'補足測試',...(target.kind==='drink'?{drinkId:target.id,loose:20}:{supplyId:target.id,quantity:20}),...(target.kind==='noodle'?{expiresOn:'2099-12-31'}:{})};
    assert.equal(b.send(operation,data).state,'accepted');
    assert.equal(plain(b.ctx.adminSummaryData_()).lowItems.some(entry=>entry.id===target.id),false);
    if(target.kind==='drink'){
      restoreDrinkRenderer(b);b.ctx.renderWarehouse_(b.ss,b.ctx.computeInventory_(b.ctx.catalog_(b.ss),b.ctx.historyEvents_(b.ss)));
      assert.equal(b.sheets.Warehouse.rows.find(entry=>entry?.[0]===target.id)[9],'暫不需要補貨');
    }else assert.equal(b.sheets.SupplyWarehouse.rows.find(entry=>entry[0]===target.id)[7],'暫不需要補貨');
    const before=sources(b);
    assert.equal(preference(b,target,'replace','hold').state,'accepted');
    assert.equal(preference(b,target,'normal','replace').state,'accepted');
    assert.equal(preference(b,target,'hold').state,'rejected');
    assert.deepEqual(sources(b),before);assert.equal(b.sheets.RestockPreferences.rows.length,4);
    if(target.kind==='drink')assert.equal(b.sheets.Warehouse.rows.find(entry=>entry?.[0]===target.id)[9],'');
    else assert.equal(b.sheets.SupplyWarehouse.rows.find(entry=>entry[0]===target.id)[7],'');
  }
});

test('generated warehouse notices require manual flags and preserve columns including flavor',()=>{
  for(const quantity of [0,1,2,10,11]){
    const b=websiteBackend();for(const target of targets)count(b,target,quantity);
    count(b,{kind:'snack',id:'supply-snack-01'},quantity);
    const before=sources(b);b.ctx.renderSupplyWarehouse_(b.ss);
    assert.equal(b.sheets.SupplyWarehouse.rows[0].length,10);
    for(const target of targets.filter(entry=>entry.kind!=='drink')){
      const row=b.sheets.SupplyWarehouse.rows.find(entry=>entry[0]===target.id);
      assert.equal(row.length,10);assert.equal(row[7],'',`${target.kind} ${target.unit||''} notice at ${quantity}`);
    }
    assert.equal(b.sheets.SupplyWarehouse.rows.find(entry=>entry[0]==='supply-snack-01')[7],'');
    restoreDrinkRenderer(b);b.ctx.renderWarehouse_(b.ss,b.ctx.computeInventory_(b.ctx.catalog_(b.ss),b.ctx.historyEvents_(b.ss)));
    const row=b.sheets.Warehouse.rows.find(entry=>entry?.[0]==='milk');
    assert.equal(row.length,11);assert.equal(row[9],'');assert.equal(row[10],10);
    assert.deepEqual(sources(b),before);
  }
});

test('inactive items stay outside automatic reminders and existing snack manual flags remain independent of quantity',()=>{
  const b=websiteBackend();for(const target of targets)count(b,target,0);
  b.sheets.Catalog.rows.find(row=>row[0]==='milk')[7]=false;
  for(const target of targets.filter(entry=>entry.kind!=='drink'))b.sheets.SupplyCatalog.rows.find(row=>row[0]===target.id)[4]=false;
  assert.equal(plain(b.ctx.adminSummaryData_()).lowItems.some(entry=>targets.some(target=>target.id===entry.id)),false);
  assert.equal(plain(b.ctx.adminSummaryData_()).outOfStockItems.some(entry=>targets.some(target=>target.id===entry.id)),false);
  for(const quantity of [null,0,99]){
    const target={kind:'snack',id:'supply-snack-02'};
    if(quantity!==null)count(b,target,quantity);
    if(quantity===null)assert.equal(preference(b,target,'consider').state,'accepted');
    assert.equal(plain(b.ctx.adminSummaryData_()).manualSnackItems[0].stock,quantity);
    assert.equal(b.sheets.SupplyWarehouse.rows.find(row=>row[0]===target.id)[7],'需要補貨');
    assert.equal(plain(b.ctx.adminSummaryData_()).lowItems.some(entry=>entry.kind==='snack'),false);
  }
});

test('legacy noodle expiry batches and their parse-safe separator survive threshold-only generated refreshes',()=>{
  parse(source,{ecmaVersion:2019,sourceType:'script'});
  const b=websiteBackend(),target=targets[1];count(b,target,0);
  for(const expiresOn of ['2098-12-31','2099-12-31'])assert.equal(b.send('supply-arrival',{supplyId:target.id,quantity:1,expiresOn,recorder:'效期保留測試'}).state,'accepted');
  const before=sources(b),events=plain(b.ctx.supplyEvents_(b.ss));b.ctx.renderSupplyWarehouse_(b.ss);
  const row=b.sheets.SupplyWarehouse.rows.find(entry=>entry[0]===target.id);
  assert.deepEqual(row[6].split('\n'),['2098-12-31｜入庫 1 杯','2099-12-31｜入庫 1 杯']);
  assert.equal(row[7],'');assert.deepEqual(sources(b),before);assert.deepEqual(plain(b.ctx.supplyEvents_(b.ss)),events);
});
