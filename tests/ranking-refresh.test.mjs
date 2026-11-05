import test from 'node:test';import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
import {getConsumption,getWeeklyPopularity} from '../js/domain.js';
import {buildConsumptionRecords,consumptionPeriod,selectConsumption} from '../js/consumption.js';
import {GoogleInventoryStore} from '../js/google-store.js';
const plain=x=>JSON.parse(JSON.stringify(x)),now=new Date('2026-11-05T10:30:00+08:00'),drinks=[{id:'tea',name:'虛構茶',unit:'瓶',active:true}];
const at=(id,type,quantity,createdAt,extra={})=>({id,drinkId:'tea',type,quantity,createdAt,...extra});
const count=(id,quantity,stamp)=>at(id,'count',quantity,stamp);
const daily=[count('mon',39,'2026-11-02T09:31:06+08:00'),count('wed',19,'2026-11-04T10:40:24+08:00'),count('thu',16,'2026-11-05T08:08:47+08:00')];
function compare(events,until=now){const backend=websiteBackend(),local=getConsumption('tea',events,until),server=plain(backend.ctx.websiteConsumption_('tea',events,until));assert.deepEqual(server,local);assert.deepEqual(plain(backend.ctx.websiteWeeklyPopularity_(drinks,events,until)),getWeeklyPopularity(drinks,events,until));return consumptionPeriod(buildConsumptionRecords({drinks,events},until),{now:until})[0];}

test('an earlier morning count extends the last complete interval and updates both rankings',()=>{
 const before=structuredClone(daily),row=compare(daily);assert.equal(row.consumed,23);assert.equal(row.measured.length,1);assert.equal(row.measured[0].endQuantity,16);assert.equal(row.measured[0].endAt,daily.at(-1).createdAt);assert.equal(row.measured[0].startQuantity,39);assert.ok(row.weekly<40&&row.weekly>39);assert.equal(getWeeklyPopularity(drinks,daily,now).rows[0].weeklyRate,row.weekly);assert.deepEqual(daily,before);
});

test('adjacent short counts accumulate into real observations, while minutes alone never get extrapolated',()=>{
 const short=[count('a',10,'2026-11-03T10:00:00+08:00'),count('b',8,'2026-11-03T11:00:00+08:00')];assert.equal(compare(short).weekly,null);
 short.push(count('c',5,'2026-11-04T11:00:00+08:00'));const row=compare(short);assert.equal(row.consumed,5);assert.equal(row.measured.length,1);assert.ok(row.observedDays>=1);
 const repeated=[count('a',20,'2026-11-02T09:00:00+08:00'),count('b',15,'2026-11-03T08:00:00+08:00'),count('c',10,'2026-11-04T07:00:00+08:00'),count('d',9,'2026-11-05T06:00:00+08:00')];assert.equal(compare(repeated).consumed,11);
});

test('short tails preserve intervening arrivals and do not divide same-time recounts by zero',()=>{
 const events=[...daily.slice(0,2),at('delivery','restock',8,'2026-11-04T15:00:00+08:00'),count('thu',20,daily[2].createdAt),count('recount',19,daily[2].createdAt)];
 const row=compare(events);assert.equal(row.consumed,28);assert.equal(row.measured[0].arrivals,8);assert.equal(row.measured[0].endQuantity,19);assert.ok(Number.isFinite(row.weekly));
});

test('short intervals never bridge adjustments, rejected counts or the rolling window boundary',()=>{
 const adjusted=[...daily.slice(0,2),count('increase',30,'2026-11-04T11:00:00+08:00'),count('tail',27,daily[2].createdAt)];const row=compare(adjusted);assert.equal(row.consumed,20);assert.equal(row.issue,true);assert.equal(row.measured[0].endAt,daily[1].createdAt);
 const rejected=[...daily,at('ignored','count',0,'2026-11-05T09:00:00+08:00',{accepted:false})];assert.equal(compare(rejected).consumed,23);
 const data=[count('old',40,'2026-10-04T08:00:00+08:00'),count('start',20,'2026-11-04T10:00:00+08:00'),count('end',17,daily[2].createdAt)];assert.equal(compare(data).weekly,null,'the old interval cannot support a short interval inside the window');
});

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
function client(b,extra={}){let stamp=+now;const calls=[];const store=new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/RANK_REFRESH_TEST/exec'},{now:()=>stamp,pendingStorage:storage(),publicStorage:storage(),readPublicData:async(_url,options)=>{calls.push(options);return plain(options.action==='warehouse'?b.ctx.warehouseData_(options.force):options.action==='popularity'?b.ctx.popularityData_():b.ctx.publicData_());},submitWebsiteCommand:async(_url,command)=>b.send(command.operation,command.data,command.requestId).result,...extra});return {store,calls,setNow:value=>{stamp=value;}};}

test('popularity expires after one minute, force bypasses cache, and failed refreshes preserve valid rates',async()=>{
 const b=websiteBackend(),c=client(b);await c.store.init();const first=await c.store.readPopularity();const count=()=>c.calls.filter(o=>o.action==='popularity').length;assert.equal(count(),1);c.setNow(+now+59000);await c.store.readPopularity();assert.equal(count(),1);c.setNow(+now+60000);await c.store.readPopularity();assert.equal(count(),2);await c.store.readPopularity({force:true});assert.equal(count(),3);
 const latest=c.store.popularity;c.store.readPublicData=async()=>{throw Error('offline');};await assert.rejects(c.store.readPopularity({force:true}),/offline/);assert.deepEqual(c.store.popularity,latest);
});

test('a confirmed stocktake invalidates aggregate cache even if its following warehouse read fails',async()=>{
 const b=websiteBackend(),c=client(b);await c.store.readWarehouse();await c.store.readPopularity();let aggregates=0;
 const read=c.store.readPublicData;c.store.readPublicData=async(url,opts)=>{if(opts.action==='warehouse')throw Error('refresh failed');aggregates++;return read(url,opts);};await c.store.submitStocktake([{drinkId:'tea',quantity:15}],'虛構');assert.equal(c.store.lastWriteNeedsRefresh,true);await c.store.readPopularity();assert.equal(aggregates,1);
});

test('late pre-stocktake responses and errors cannot restore an old aggregate or clear a newer request',async()=>{
 for(const rejectOld of [false,true]){
  const b=websiteBackend(),c=client(b);await c.store.readWarehouse();const old=plain(b.ctx.popularityData_()),original=c.store.readPublicData;let release;const gate=new Promise(resolve=>{release=resolve;});let counts=0;
  c.store.readPublicData=async(url,opts)=>{if(opts.action!=='popularity')return original(url,opts);if(++counts===1){await gate;if(rejectOld)throw Error('old failed');return old;}const payload=plain(b.ctx.popularityData_());payload.popularity.countedProducts=1;payload.popularity.observedProducts=0;payload.popularity.rows=[];return payload;};
  const pending=c.store.readPopularity();await c.store.submitStocktake([{drinkId:'tea',quantity:17}],'虛構');const newer=await c.store.readPopularity();release();assert.deepEqual(await pending,newer);assert.deepEqual(c.store.popularity,newer);assert.equal(counts,2);assert.equal(c.store.popularityRequest,null);
 }
});

test('external inventory changes invalidate an open tab aggregate, even without changed public metadata',async()=>{
 const b=websiteBackend(),c=client(b);await c.store.readWarehouse();await c.store.readPopularity();const stamp=b.props.get('HOLDWIN_PUBLIC_UPDATED_AT');b.sheets.History.rows.push(['external','2026-11-05T00:00:00Z','count','tea','茶',4,'','虛構','採計']);if(stamp===undefined)b.props.delete('HOLDWIN_PUBLIC_UPDATED_AT');else b.props.set('HOLDWIN_PUBLIC_UPDATED_AT',stamp);
 const read=c.store.popularityReadAt;await c.store.readWarehouse();assert.ok(c.store.popularityReadAt<read);await c.store.readPopularity();assert.equal(c.calls.filter(o=>o.action==='popularity').length,2);
});
