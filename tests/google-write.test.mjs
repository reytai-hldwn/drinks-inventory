import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleInventoryStore } from '../js/google-store.js';
import { submitGoogleWebsiteCommand } from '../js/google-write.js';
import {websiteBackend} from './helpers/google-website.mjs';

const endpoint = 'https://script.google.com/macros/s/TEST_WEBSITE/exec';
const plain = (value) => JSON.parse(JSON.stringify(value));
let requestSequence = 0;
const id = () => `website-request-${String(++requestSequence).padStart(10, '0')}`;

test('native partial stocktakes preserve blanks and prior history, accept zero and reject the entire invalid request', () => {
  const b = websiteBackend();
  const before = plain(b.sheets.History.rows);
  const receipt = b.send('stocktake',{entries:[{drinkId:'tea',quantity:0}],recorder:'盤點者'});
  assert.equal(receipt.state,'accepted');
  assert.equal(b.inventory().find(row=>row.drink.id==='tea').stock,0);
  assert.equal(b.inventory().find(row=>row.drink.id==='milk').stock,9);
  assert.deepEqual(b.sheets.History.rows.slice(0,3),before);
  for(const entries of [[],[{drinkId:'tea',quantity:2},{drinkId:'milk',quantity:-1}],[{drinkId:'old',quantity:2}],[{drinkId:'tea',quantity:1},{drinkId:'tea',quantity:2}]]){
    const count=b.sheets.History.rows.length;
    assert.equal(b.send('stocktake',{entries,recorder:'小王'}).state,'rejected');assert.equal(b.sheets.History.rows.length,count);
  }
  assert.equal(b.send('stocktake',{entries:[{drinkId:'tea',quantity:3}],recorder:''}).state,'rejected');
});

test('native arrivals support cases, loose, or both with server case sizes and reject invalid totals', () => {
  for(const [cases,loose,quantity] of [['1','',24],['','3',3],['1','3',27]]){
    const b=websiteBackend();const receipt=b.send('arrival',{drinkId:'tea',cases,loose,recorder:'小王',note:''});
    assert.equal(receipt.result.quantity,quantity);assert.equal(b.inventory()[0].stock,20+quantity);
  }
  for(const data of [{cases:'',loose:''},{cases:'0',loose:'0'},{cases:'-1',loose:'2'},{cases:'1.5',loose:''},{cases:'1',loose:'' ,drinkId:'old'}]){
    const b=websiteBackend();assert.equal(b.send('arrival',{drinkId:'tea',recorder:'小王',note:'',...data}).state,'rejected');assert.equal(b.sheets.History.rows.length,3);
  }
});

test('receipts confirm saved data only, reuse request ids, and recover a partially saved arrival without a second addition', () => {
  const b=websiteBackend();const requestId=id();const data={drinkId:'tea',cases:'1',loose:'',recorder:'小王',note:''};
  b.ctx.renderWarehouse_=()=>{throw new Error('temporary sheet failure');};
  assert.throws(()=>b.send('arrival',data,requestId),/temporary/);
  assert.equal(b.ctx.websiteReceipt_(requestId).state,'pending');assert.equal(b.inventory()[0].stock,44);
  b.ctx.renderWarehouse_=()=>{};
  assert.equal(b.send('arrival',data,requestId).state,'accepted');
  assert.equal(b.send('arrival',data,requestId).state,'accepted');assert.equal(b.inventory()[0].stock,44);
  assert.throws(()=>b.send('arrival',{...data,loose:'1'},requestId),/request_conflict/);
  assert.equal(b.inventory()[0].stock,44);
  const receipt=plain(b.ctx.websiteReceipt_(requestId));assert.doesNotMatch(JSON.stringify(receipt),/recorder|小王|資料指紋|history/);
});

test('anonymous drink/snack wishes and named votes share the original sheets and one browser keeps one vote', () => {
  const b=websiteBackend();
  const wish=b.send('wish',{kind:'snack',name:'餅乾',url:'https://example.com/item',note:'想吃'});
  assert.equal(b.sheets.WishReview.rows[1][6],'snack');
  assert.equal(b.send('wish',{kind:'',name:'餅乾',url:'',note:''}).state,'rejected');
  assert.equal(b.send('wish',{kind:'drink',name:'果汁',url:'https://example.com:invalid/item',note:''}).state,'rejected');
  const data={wishId:wish.result.id,voterId:'browser-1234567890123456',voterName:'小王'};
  assert.equal(b.send('vote',{...data,voterName:''}).state,'rejected');
  assert.equal(b.send('vote',data).result.alreadyVoted,false);
  assert.equal(b.send('vote',data).result.alreadyVoted,true);
  assert.equal(b.sheets.WishVotes.rows.length,2);
  assert.deepEqual(plain(b.ctx.voteSummary_(b.ss)).names[wish.result.id],['小王']);
});

test('new products preserve existing rows, use case size 24 and do not invent a stocktake', () => {
  const b=websiteBackend();const before=plain(b.sheets.Catalog.rows);const requestId=id();
  const data={name:'新飲料',category:'茶飲',packaging:'寶特瓶',recorder:'小王'};
  b.send('product',data,requestId);b.send('product',data,requestId);
  assert.deepEqual(b.sheets.Catalog.rows.slice(0,4),before);assert.equal(b.sheets.Catalog.rows.length,5);
  assert.equal(b.sheets.Catalog.rows[4][5],24);assert.equal(b.inventory().at(-1).stock,null);
  assert.equal(b.sheets.ProductIntake.rows.length,2);assert.equal(b.sheets.History.rows.length,3);
  assert.equal(b.send('product',data).state,'rejected');
  assert.equal(b.send('product',{...data,name:'\u0000'}).state,'rejected');
});

test('partially saved products retry once, retain owner edits and escape spreadsheet formulas',()=>{
  const b=websiteBackend(),requestId=id();const data={name:'=SUM(1,2)',category:'茶飲',packaging:'寶特瓶',recorder:'=FORMULA'};
  b.ctx.renderWarehouse_=()=>{throw new Error('temporary view failure');};
  assert.throws(()=>b.send('product',data,requestId),/temporary/);
  const record=b.ctx.websiteRequestRecord_(b.sheets.WebsiteRequests,requestId);
  const prepared=JSON.parse(record.row.slice(6).join(''));
  assert.equal(prepared.catalog[1],"'=SUM(1,2)");assert.equal(prepared.product[6],"'=FORMULA");
  b.sheets.Catalog.rows[4][1]='管理者調整的品名';b.ctx.renderWarehouse_=()=>{};
  assert.equal(b.send('product',data,requestId).state,'accepted');assert.equal(b.sheets.Catalog.rows.length,5);
  assert.equal(b.sheets.Catalog.rows[4][1],'管理者調整的品名');assert.equal(b.sheets.ProductIntake.rows.length,2);
});

test('large stocktakes retain Unicode while durable prepared rows span several cells',()=>{
  const b=websiteBackend();
  const rows=Array.from({length:250},(_,i)=>[`bulk-${i}`,'茶品🧃'.repeat(15),'茶飲','寶特瓶','瓶',24,10,true]);
  b.sheets.Catalog.rows.splice(1,b.sheets.Catalog.rows.length-1,...rows);
  const receipt=b.send('stocktake',{entries:rows.map((row,i)=>({drinkId:row[0],quantity:i})),recorder:'盤點者'});
  assert.equal(receipt.state,'accepted');assert.equal(receipt.result.count,250);
  const record=b.ctx.websiteRequestRecord_(b.sheets.WebsiteRequests,receipt.requestId);
  assert.ok(record.row.slice(6).filter(Boolean).length>1);
  assert.ok(record.row.slice(6).every(value=>value.length<=40000));
  assert.equal(b.inventory().at(-1).stock,249);
});

function storage({removeFails=false}={}) {
  const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem(key){if(removeFails)throw new Error('blocked deletion');values.delete(key);}};
}
function publicPayload() {
  return {ok:true,provider:'google',websiteEntry:{version:1},drinks:[],wishes:[],formUrls:{wish:'https://docs.google.com/forms/d/e/FORM/viewform'},adminUrl:'https://docs.google.com/spreadsheets/d/SHEET/edit'};
}
test('client retries an unresolved request across store instances with the same id and never acknowledges an unconfirmed POST', async()=>{
  const pendingStorage=storage();let first=true;const sent=[];
  const options={pendingStorage,readPublicData:async()=>publicPayload(),createRequestId:id,submitWebsiteCommand:async(_url,command)=>{sent.push(command);if(first){first=false;const error=new Error('unknown');error.code='pending';throw error;}return {quantity:24};}};
  const a=new GoogleInventoryStore({googleScriptUrl:endpoint},options);await a.init();
  const data={drinkId:'tea',cases:'1',loose:'',recorder:'小王',note:''};
  await assert.rejects(a.submitArrival(data),/unknown/);assert.equal(pendingStorage.values.size,1);
  const b=new GoogleInventoryStore({googleScriptUrl:endpoint},options);await b.init();await b.submitArrival(data);
  assert.equal(sent[0].requestId,sent[1].requestId);assert.equal(pendingStorage.values.size,0);
});
test('confirmed saves survive failed refreshes and storage deletion, while legacy deployments cannot receive native writes',async()=>{
  const pendingStorage=storage({removeFails:true});let reads=0;
  const store=new GoogleInventoryStore({googleScriptUrl:endpoint},{pendingStorage,createRequestId:id,readPublicData:async()=>{if(reads++)throw new Error('offline');return publicPayload();},submitWebsiteCommand:async()=>({quantity:24})});
  await store.init();const result=await store.submitArrival({drinkId:'tea',cases:'1',loose:'',recorder:'小王'});
  assert.equal(result.quantity,24);assert.equal(store.lastWriteNeedsRefresh,true);
  assert.equal(JSON.parse([...pendingStorage.values.values()][0]).state,'accepted');
  const old=publicPayload();delete old.websiteEntry;let called=false;
  const legacy=new GoogleInventoryStore({googleScriptUrl:endpoint},{readPublicData:async()=>old,submitWebsiteCommand:async()=>{called=true;}});await legacy.init();
  await assert.rejects(legacy.submitArrival({}),/更新/);assert.equal(called,false);
});

test('a changed form cannot start another delivery while its previous request is unresolved',async()=>{
  const pendingStorage=storage();let calls=0,state='pending';
  const store=new GoogleInventoryStore({googleScriptUrl:endpoint},{pendingStorage,createRequestId:id,readPublicData:async()=>publicPayload(),
    readReceipt:async requestId=>({ok:true,requestId,state}),submitWebsiteCommand:async()=>{calls++;const error=new Error('unknown');error.code='pending';throw error;}});
  await store.init();const data={drinkId:'tea',cases:'1',loose:'',recorder:'小王'};
  await assert.rejects(store.submitArrival(data),/unknown/);
  await assert.rejects(store.submitArrival({...data,cases:'2'}),/待確認/);assert.equal(calls,1);
  state='accepted';await assert.rejects(store.submitArrival({...data,cases:'2'}),/上一筆資料已經儲存/);assert.equal(calls,1);
  assert.equal(pendingStorage.values.size,0);
});

function fakePage() {
  const children=[],timers=new Map();let timerId=0,submitted;
  const document={body:{appendChild(node){children.push(node);}},createElement(type){return {type,children:[],setAttribute(){},appendChild(node){this.children.push(node);},submit(){submitted=this;},remove(){const index=children.indexOf(this);if(index>=0)children.splice(index,1);}};}};
  return {document,children,timers,get submitted(){return submitted;},setTimeout(fn,delay){const key=++timerId;timers.set(key,{fn,delay});return key;},clearTimeout(key){timers.delete(key);},async run(delay){const entry=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(entry);timers.delete(entry[0]);await entry[1].fn();}};
}
test('transport posts offscreen, preserves top navigation and waits for an accepted receipt instead of a frame load',async()=>{
  const page=fakePage();let accepted=false;const command={requestId:id(),operation:'wish',data:{kind:'drink',name:'茶'}};
  let done=false;const pending=submitGoogleWebsiteCommand(endpoint,command,{...page,readReceipt:async()=>({ok:true,requestId:command.requestId,state:accepted?'accepted':'pending',result:{id:'wish-new'}})}).then(result=>{done=true;return result;});
  assert.equal(page.submitted.method,'POST');assert.notEqual(page.submitted.target,'_top');assert.notEqual(page.submitted.target,'_blank');
  assert.deepEqual(JSON.parse(page.submitted.children[0].value),command);assert.equal(done,false);
  await page.run(1200);assert.equal(done,false);accepted=true;await page.run(2500);assert.deepEqual(await pending,{id:'wish-new'});assert.equal(page.children.length,0);assert.equal(page.timers.size,0);
});
test('transport rejects explicit validation errors and reports an unresolved timeout without treating it as a failed write',async()=>{
  const page=fakePage();const command={requestId:id(),operation:'arrival',data:{}};
  const pending=submitGoogleWebsiteCommand(endpoint,command,{...page,readReceipt:async()=>({requestId:command.requestId,state:'rejected',message:'請填登記人'})});
  const rejected=assert.rejects(pending,error=>error.code==='rejected'&&/登記人/.test(error.message));await page.run(1200);await rejected;
  const again=fakePage();const uncertain=submitGoogleWebsiteCommand(endpoint,command,{...again,readReceipt:async()=>({state:'pending'})});
  const timed=assert.rejects(uncertain,error=>error.code==='pending');await again.run(90000);await timed;assert.equal(again.children.length,0);
});
