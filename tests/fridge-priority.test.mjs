import test from 'node:test';
import assert from 'node:assert/strict';
import { FRIDGE_PACKAGING_ORDER } from '../js/catalog.js';
import { renderFridge, renderFridgePopularity } from '../js/fridge.js';
import { drinkAvailability } from '../js/drink-availability.js';
import { websiteBackend } from './helpers/google-website.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));

test('fridge shelves follow the complete packaging order regardless of beverage categories',()=>{
 const drinks=[...FRIDGE_PACKAGING_ORDER,'其他'].reverse().map((packaging,index)=>({id:'p'+index,name:'測試'+index,packaging,category:index%2?'果汁':'茶飲',unit:'包'})),before=structuredClone(drinks);
 const html=renderFridge(drinks,{isOpen:true});
 assert.deepEqual([...html.matchAll(/class="fridge-shelf-heading"[^>]*>.*?<h3>([^<]+)<\/h3>/g)].map(m=>m[1]),[...FRIDGE_PACKAGING_ORDER,'其他']);
 assert.match(html,/<details class="fridge-popularity">/);
 assert.match(html,/class="popularity-period">每週</);
 assert.doesNotMatch(html,/每5個工作日/);
 assert.deepEqual(drinks,before);
 const content=renderFridgePopularity({rows:[{id:'a',name:'測試',weeklyRate:5,unit:'包'}]});
 assert.match(content,/包／週/);assert.doesNotMatch(content,/工作週|5個工作日|週一至週五/);
});

test('only recorded drink zeros become historical and replenish under the same ID',()=>{
 const unknown={id:'unknown',active:true,stock:null,lastCountAt:null};assert.equal(drinkAvailability(unknown),unknown);
 const zero=drinkAvailability({id:'a',active:true,stock:0,lastCountAt:'2026-11-04'});assert.equal(zero.active,false);assert.equal(zero.autoArchived,true);
 assert.equal(drinkAvailability({...zero,stock:3,lastArrivalAt:'2026-11-05'}).active,true);
 assert.equal(drinkAvailability({id:'manual',active:false,stock:3,lastCountAt:'2026-11-04'}).active,false);
 const b=websiteBackend();
 b.send('stocktake',{recorder:'測試',entries:[{drinkId:'tea',quantity:0}]});
 b.send('restock-preference',{kind:'drink',itemId:'tea',mode:'consider',expectedMode:'normal'});
 const history=plain(b.sheets.History.rows),catalog=plain(b.sheets.Catalog.rows),warehouse=plain(b.ctx.warehouseData_());
 const tea=warehouse.drinks.find(item=>item.id==='tea');assert.equal(tea.stock,0);assert.equal(tea.active,false);assert.equal(tea.autoArchived,true);
 assert.equal(b.ctx.publicData_().drinks.find(item=>item.id==='tea').active,false);
 assert.equal(b.ctx.publicData_().drinks.find(item=>item.id==='tea').stock,undefined);
 const summary=plain(b.ctx.adminSummaryData_());assert.equal(summary.restockItems.find(item=>item.id==='tea').stock,0);assert.ok(!summary.outOfStockItems.some(item=>item.id==='tea'));
 assert.deepEqual(b.sheets.History.rows,history);assert.deepEqual(b.sheets.Catalog.rows,catalog);
 const wish=b.send('archive-wish',{drinkId:'tea',voterName:'測試',voterId:'test-browser-0000000000001'});assert.equal(wish.state,'accepted');
 b.send('arrival',{drinkId:'tea',loose:3,cases:0,recorder:'測試',restoreArchived:true});
 assert.equal(b.ctx.publicData_().drinks.find(item=>item.id==='tea').active,true);
 assert.equal(b.ctx.warehouseData_().drinks.find(item=>item.id==='tea').stock,3);
 assert.deepEqual(b.sheets.History.rows.slice(0,history.length),history);
 assert.equal(b.ctx.publicData_().drinks.find(item=>item.id==='old').active,false);
});

test('a cold archive wish keeps its existing lock and warm fridge reads reuse availability',()=>{
 const b=websiteBackend();let held=false;
 b.ctx.locked_=work=>{assert.equal(held,false,'availability bootstrap must not acquire the write lock twice');held=true;try{return work();}finally{held=false;}};
 assert.equal(b.send('archive-wish',{drinkId:'old',voterName:'測試',voterId:'test-browser-0000000000002'}).state,'accepted');
 const original=b.ctx.historyEvents_;let reads=0;b.ctx.historyEvents_=ss=>{reads++;return original(ss);};
 b.ctx.publicData_();b.ctx.publicData_();assert.equal(reads,0,'warm public reads do not reread the stock ledger');
});
