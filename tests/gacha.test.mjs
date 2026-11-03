import test from 'node:test';
import assert from 'node:assert/strict';
import {GACHA_ODDS,GACHA_FORTUNES,gachaDay,gachaResetDelay,drawGacha,readDailyGacha,saveDailyGacha,chooseGachaDrink,renderGacha} from '../js/gacha.js';
import {websiteBackend} from './helpers/google-website.mjs';
import {GoogleInventoryStore,normalizeGooglePublicData} from '../js/google-store.js';
const storage=()=>{const m=new Map();return{getItem:key=>m.get(key)||null,setItem:(key,value)=>m.set(key,value)};};
const plain=value=>JSON.parse(JSON.stringify(value));
const config={googleScriptUrl:'https://script.google.com/macros/s/GACHA_TEST/exec'};

test('fortune weights select the documented buckets at their boundaries, with diverse stable positive copy',()=>{
 assert.equal(GACHA_ODDS.lucky+GACHA_ODDS.steady+GACHA_ODDS.pause,1);assert.equal(new Set(GACHA_FORTUNES.map(row=>row.id)).size,GACHA_FORTUNES.length);
 for(const [chance,kind]of [[0,'lucky'],[.97999,'lucky'],[.98,'steady'],[.99499,'steady'],[.995,'pause'],[.99999,'pause']]){
  let first=true;const draw=drawGacha({random:()=>{if(first){first=false;return chance;}return .5;}});assert.equal(GACHA_FORTUNES.find(row=>row.id===draw.fortuneId).kind,kind);
 }
 assert.ok(GACHA_FORTUNES.filter(row=>row.kind==='lucky').length>=20);assert.ok(GACHA_FORTUNES.every(row=>row.text.length>10&&row.text.length<100));
});

test('a Taiwan calendar day persists the fortune and selected ID through reload and expires at midnight',()=>{
 const before=Date.parse('2026-11-03T15:59:59Z'),after=Date.parse('2026-11-03T16:00:00Z'),local=storage(),draw=drawGacha({now:before,random:()=>0});draw.drinkId='real-drink';
 assert.equal(draw.day,'2026-11-03');assert.equal(gachaDay(after),'2026-11-04');assert.equal(saveDailyGacha(local,'daily',draw),true);assert.deepEqual(readDailyGacha(local,'daily',before),draw);assert.equal(readDailyGacha(local,'daily',after),null);
 assert.equal(gachaResetDelay(before),1050);assert.equal(gachaResetDelay(after),86400050);
 for(const bad of [{...draw,fortuneId:'invented'},{...draw,drinkId:'<script>'},{...draw,createdAt:'invalid'},{...draw,version:2}]){local.setItem('daily',JSON.stringify(bad));assert.equal(readDailyGacha(local,'daily',before),null);}
 const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};assert.equal(readDailyGacha(blocked,'daily'),null);assert.equal(saveDailyGacha(blocked,'daily',draw),false);
});

test('drink selection uses only server-confirmed eligible, active IDs and leaves inventory untouched',()=>{
 const drinks=[{id:'known',name:'可爾必思開心成長160ml',active:true,packaging:'鋁箔包'},{id:'zero',name:'無庫存',active:true},{id:'old',name:'歷史',active:false},{id:'unknown',name:'待盤點',active:true}],before=structuredClone(drinks);
 assert.equal(chooseGachaDrink(drinks,['old','known','known'],()=>0).id,'known');assert.equal(chooseGachaDrink(drinks,[],()=>0),null);
 const state={draw:{...drawGacha({random:()=>0}),drinkId:'known'},loading:false,spinning:false},html=renderGacha(state,drinks);
 assert.match(html,/可爾必思/);assert.match(html,/160 毫升/);assert.match(html,/data-action="view-drink"/);assert.doesNotMatch(html,/無庫存|歷史|待盤點/);assert.deepEqual(drinks,before);
});

test('gacha endpoint reveals only eligible IDs and does not create stocktakes, arrivals or sheets',()=>{
 const b=websiteBackend();b.send('stocktake',{entries:[{drinkId:'tea',quantity:0}],recorder:'測試'});
 b.sheets.History.rows.push(['old-count','2026-01-01T00:00:00Z','count','old','舊飲料',9,'','測試','採計']);
 const created=b.send('product',{name:'測試尚未盤點',category:'其他',packaging:'鋁箔包',recorder:'測試'});assert.equal(created.state,'accepted');
 const before=Object.fromEntries(Object.entries(b.sheets).map(([key,sheet])=>[key,plain(sheet.rows)])),result=JSON.parse(b.ctx.doGet({parameter:{action:'gacha'}}).body);
 assert.equal(result.ok,true);assert.deepEqual(result.eligibleIds,['milk']);assert.deepEqual(Object.keys(result).sort(),['ok','version','snapshotAt','eligibleIds'].sort());assert.doesNotMatch(JSON.stringify(result),/recorder|events|stock|email|quantity|測試/);
 assert.deepEqual(Object.fromEntries(Object.entries(b.sheets).map(([key,sheet])=>[key,plain(sheet.rows)])),before);
 assert.equal(normalizeGooglePublicData(plain(b.ctx.publicData_(b.ss))).gachaVersion,1);
});

test('read options are gated on deployment, deduplicate in-flight reads and validate the minimal response',async()=>{
 const reads=[];let release;const gate=new Promise(resolve=>{release=resolve;});
 const store=new GoogleInventoryStore(config,{readPublicData:async(_url,options)=>{reads.push(options.action);await gate;return{ok:true,version:1,eligibleIds:['a','b']};}});
 assert.deepEqual(await store.readGachaOptions(),{supported:false,eligibleIds:[]});assert.deepEqual(reads,[]);
 store.gachaVersion=1;const first=store.readGachaOptions(),second=store.readGachaOptions();assert.deepEqual(reads,['gacha']);release();assert.deepEqual(await first,{supported:true,eligibleIds:['a','b']});assert.deepEqual(await second,await first);
 store.readPublicData=async()=>({ok:true,version:1,eligibleIds:['a','a']});await assert.rejects(store.readGachaOptions(),/暫時無法讀取/);
});
