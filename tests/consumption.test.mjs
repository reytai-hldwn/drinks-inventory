import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSUMPTION_KINDS, buildConsumptionRecords, consumptionPeriod, selectConsumption } from '../js/consumption.js';
import { renderConsumptionControls, renderConsumptionResults } from '../js/consumption-view.js';
const day=86400000,now=Date.parse('2026-11-03T12:00:00Z');
const item=(id,unit='包',extra={})=>({id,name:id,category:'茶飲',unit,active:true,...extra});
const event=(id,type,quantity,days,extra={})=>({id:`${id}-${type}-${days}`,drinkId:id,type,quantity,createdAt:new Date(now-days*day).toISOString(),...extra});
const metrics=(data,days=90)=>consumptionPeriod(buildConsumptionRecords(data,now),{days,now});

test('weighted completed intervals include arrivals and ignore current stock and later deliveries',()=>{
 const data={drinks:[item('a','包',{stock:999})],events:[event('a','count',20,24),event('a','restock',10,20),event('a','count',10,17),event('a','count',3,3),event('a','restock',100,1)]},before=structuredClone(data),[row]=metrics(data);
 assert.equal(row.consumed,27);assert.equal(row.observedDays,15);assert.equal(row.weekly,9);assert.equal(row.measured.length,2);assert.deepEqual(data,before);
 assert.equal(row.measured[0].arrivals,10);assert.equal(row.measured[1].arrivals,0);
});

test('arrival-only and one-count records never create usage, and empty intervals do not rank as unpopular',()=>{
 const data={drinks:[item('arrival'),item('once'),item('empty'),item('unused')],events:[event('arrival','restock',50,5),event('once','count',30,10),event('once','restock',40,5),event('empty','count',0,10),event('empty','count',0,3),event('unused','count',5,10),event('unused','count',5,3)]};
 const rows=metrics(data),selection=selectConsumption(rows,{kind:'drink'});
 assert.equal(selection.ranked.length,0);assert.equal(selection.zero.length,1);assert.equal(selection.zero[0].id,'unused');assert.equal(selection.pending.length,3);assert.equal(rows.find(row=>row.id==='empty').reason,'區間內沒有庫存');
 assert.ok(renderConsumptionResults(selection).includes('這段期間尚未觀察到消耗'));
});

test('only complete intervals in the window are counted; future, rejected and expiry events cannot create counts',()=>{
 const data={drinks:[item('a')],events:[event('a','count',100,40),event('a','count',20,20),event('a','count',10,10),event('a','count',0,5,{accepted:false}),event('a','expiry-set',0,4),event('a','count',0,-1)]};
 const [row]=metrics(data,30);assert.equal(row.counts,3);assert.equal(row.consumed,10);assert.ok(Math.abs(row.observedDays-43/6)<1e-10);assert.ok(Math.abs(row.weekly-300/43)<1e-10);
 assert.equal(metrics(data,0)[0].consumed,90);assert.equal(row.latestCountAt,event('a','count',10,10).createdAt);
});

test('adjustments, invalid quantities and short intervals stay separate while valid later observations remain usable',()=>{
 const data={drinks:[item('a'),item('bad'),item('short')],events:[event('a','count',10,20),event('a','count',20,10),event('a','count',13,3),event('bad','count',10,20),event('bad','restock',-3,15),event('bad','count',3,10),event('short','count',5,1),event('short','count',2,.5)]};
 const rows=metrics(data),a=rows.find(row=>row.id==='a');assert.equal(a.issue,true);assert.equal(a.consumed,7);assert.equal(a.weekly,7);assert.equal(rows.find(row=>row.id==='bad').weekly,null);assert.equal(rows.find(row=>row.id==='short').weekly,null);
 const invalidCount=metrics({drinks:[item('x')],events:[event('x','count',10,20),event('x','count',NaN,15),event('x','count',3,10)]})[0];assert.equal(invalidCount.weekly,null);
});

test('rankings isolate kinds, units, history and flavors, with stable ties and no mutations',()=>{
 const supplies=[item('s1','包',{kind:'snack',name:'洋芋片',flavor:'起司',category:'太空包'}),item('s2','包',{kind:'snack',name:'洋芋片',flavor:'海苔',category:'太空包'}),item('toner','盒',{kind:'toner'})],supplyEvents=supplies.flatMap(row=>[event(row.id,'count',20,10),event(row.id,'count',13,3)].map(({drinkId,...e})=>({...e,supplyId:drinkId})));
 const rows=metrics({drinks:[item('包裝甲'),item('包裝乙'),item('罐裝','罐'),item('history','包',{active:false})],events:['包裝甲','包裝乙','罐裝','history'].flatMap(id=>[event(id,'count',10,10),event(id,'count',3,3)]),supplies,supplyEvents}),before=structuredClone(rows);
 assert.deepEqual(Object.keys(CONSUMPTION_KINDS),['drink','snack']);assert.equal(selectConsumption(rows,{kind:'drink'}).ranked.length,3);assert.equal(selectConsumption(rows,{kind:'drink'}).unit,'*');assert.ok(!rows.some(row=>row.kind==='toner'));
 const drinks=selectConsumption(rows,{kind:'drink',unit:'包'});assert.equal(drinks.ranked.length,2);assert.deepEqual(drinks.ranked.map(row=>row.id),['包裝乙','包裝甲'].sort((a,b)=>a.localeCompare(b,'zh-TW')));
 assert.equal(selectConsumption(rows,{kind:'drink',unit:'罐'}).ranked.length,1);assert.equal(selectConsumption(rows,{kind:'drink',unit:'包',archived:true}).ranked.length,3);
 const snack=selectConsumption(rows,{kind:'snack',query:'起司',category:'太空包'});assert.equal(snack.ranked.length,1);assert.equal(snack.ranked[0].id,'s1');const html=renderConsumptionResults(snack);assert.match(html,/同品項的其他口味/);assert.match(html,/海苔/);assert.match(html,/盤點 20 ＋入庫 0 −盤點 13 ＝ 7 包/);assert.deepEqual(rows,before);
 const controls=renderConsumptionControls(snack,{days:90,archived:false});assert.match(controls,/比較單位/);assert.match(controls,/所有分類/);
});

test('new catalog items render honest readiness, escaped labels and a stocktaking link',()=>{
 const rows=metrics({drinks:[item('x','包',{name:'<script>unsafe</script>'})],events:[]}),selection=selectConsumption(rows,{kind:'drink'}),html=renderConsumptionResults(selection);
 assert.match(html,/排行榜準備中/);assert.match(html,/等待更多紀錄/);assert.match(html,/href="#count"/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.equal(selection.ranked.length,0);
});

test('short working-day observations show usage beside the five-day extrapolation',()=>{
 const until=Date.parse('2026-11-04T09:00:00+08:00');
 const data=days=>({drinks:[item('tea')],events:[{id:'a',drinkId:'tea',type:'count',quantity:39,createdAt:new Date(until-days*day).toISOString()},{id:'b',drinkId:'tea',type:'count',quantity:19,createdAt:new Date(until).toISOString()}]});
 const rows=consumptionPeriod(buildConsumptionRecords(data(2),until),{now:until});
 assert.equal(rows[0].weekly,50);
 const html=renderConsumptionResults(selectConsumption(rows,{kind:'drink'}));
 assert.match(html,/換算每工作週/);
 assert.match(html,/觀察 2 個工作日 · 消耗 20 包/);
 assert.match(html,/未滿5個工作日，先看趨勢/);
 assert.match(html,/並非最近5個工作日實際用量/);
 const weekly=consumptionPeriod(buildConsumptionRecords(data(7),until),{now:until});
 assert.equal(weekly[0].observedDays,5);
 assert.doesNotMatch(renderConsumptionResults(selectConsumption(weekly,{kind:'drink'})),/未滿5個工作日，先看趨勢/);
});
