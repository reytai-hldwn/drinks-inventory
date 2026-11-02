import test from 'node:test';
import assert from 'node:assert/strict';
import {websiteBackend} from './helpers/google-website.mjs';
import {GoogleInventoryStore} from '../js/google-store.js';
import {getWeeklyPopularity} from '../js/domain.js';

const endpoint='https://script.google.com/macros/s/TEST_PERFORMANCE/exec';
const plain=value=>JSON.parse(JSON.stringify(value));
const storage=()=>{const values=new Map();return{values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const wishData={kind:'snack',name:'測試願望',note:'',url:''};
const stamp='2026-11-02T01:00:00.000Z';
const requestId='performance-request-00000001';

test('wish/vote commits avoid all inventory/form work and return canonical public fields without browser tokens',()=>{
  const b=websiteBackend();
  for(const name of ['catalog_','historyEvents_','computeInventory_','renderWarehouse_','renderArchive_','forms_','renderSupplyWarehouse_'])b.ctx[name]=()=>{throw new Error(`unnecessary ${name}`);};
  const one=b.send('wish',wishData,requestId);
  assert.equal(one.state,'accepted');assert.equal(one.result.wish.name,wishData.name);assert.equal(one.result.wish.votes,0);
  const data={wishId:one.result.id,voterName:'小王',voterId:'browser-performance-00000001'};
  const vote=b.send('vote',data);assert.equal(vote.result.wish.votes,1);assert.deepEqual(vote.result.wish.supporters,['小王']);
  assert.equal(b.send('vote',data).result.alreadyVoted,true);assert.equal(b.sheets.WishVotes.rows.length,2);
  assert.equal(b.send('vote',{...data,voterId:'browser-performance-00000002'}).result.wish.votes,2);
  assert.doesNotMatch(JSON.stringify(vote),/browser-performance|voterId|recorder|prepared/);
  assert.deepEqual(b.send('wish',wishData,requestId),one,'replayed receipts remain immutable');
});

test('receipt caching is optional, excludes pending states and requires final commit; receipt misses read only six columns',()=>{
  const b=websiteBackend(),cached=new Map();let writes=0,flushes=0;
  b.ctx.CacheService={getScriptCache:()=>({get:key=>cached.get(key)||null,put:(key,value)=>{assert.ok(flushes>=3);writes++;cached.set(key,value);}})};
  b.ctx.SpreadsheetApp.flush=()=>{flushes++;};
  assert.equal(b.ctx.websiteReceipt_(requestId).state,'pending');assert.equal(writes,0);
  const accepted=b.send('wish',wishData,requestId);assert.equal(writes,1);
  b.ctx.requiredSpreadsheet_=()=>{throw new Error('cache hit needs no sheet');};
  assert.deepEqual(plain(b.ctx.websiteReceipt_(requestId)),accepted);
  const broken=websiteBackend();let phase=0;
  broken.ctx.CacheService=b.ctx.CacheService;
  broken.ctx.SpreadsheetApp.flush=()=>{if(++phase===3)throw new Error('final flush failed');};
  const before=cached.size;assert.throws(()=>broken.send('wish',wishData,'performance-request-00000002'),/final flush/);assert.equal(cached.size,before);
  const fallback=websiteBackend();fallback.send('wish',wishData,requestId);
  const sheet=fallback.sheets.WebsiteRequests,range=sheet.getRange;let columns;
  sheet.getRange=(row,column,count,width)=>{if(row===2&&column===1&&width>1)columns=width;return range(row,column,count,width);};
  assert.equal(fallback.ctx.websiteReceipt_(requestId).state,'accepted');assert.equal(columns,6);
});

test('stable form links are cached by form IDs while live public/warehouse data is always read fresh',()=>{
  const b=websiteBackend(),cache=new Map();let opens=0,catalogReads=0;
  b.ctx.CacheService={getScriptCache:()=>({get:key=>cache.get(key)||null,put:(key,value)=>cache.set(key,value)})};
  const forms=b.ctx.forms_,catalog=b.ctx.catalog_;
  b.ctx.forms_=()=>{opens++;return forms();};b.ctx.catalog_=ss=>{catalogReads++;return catalog(ss);};
  b.ctx.publicData_();b.ctx.publicData_();assert.equal(opens,1);assert.equal(catalogReads,2);
  b.props.set('HOLDWIN_WISH_FORM_ID','changed-form-id');b.ctx.publicData_();assert.equal(opens,2);
  catalogReads=0;b.ctx.warehouseData_();assert.equal(catalogReads,1,'warehouse reuses its one catalog read');
});

test('aggregate popularity matches browser calculation for arrivals, corrections, short and invalid intervals without source histories',()=>{
  const b=websiteBackend(),at=day=>new Date(Date.parse(stamp)+day*86400000).toISOString();
  for(const quantities of [[20,5,12],[20,0,25],[20,0,20]]){
    const events=[{id:'1',drinkId:'tea',type:'count',quantity:quantities[0],createdAt:at(-7)},
      {id:'2',drinkId:'tea',type:'restock',quantity:quantities[1],createdAt:at(-5)},
      {id:'3',drinkId:'tea',type:'count',quantity:quantities[2],createdAt:at(0)}];
    const drinks=[{id:'tea',name:'茶',unit:'瓶',active:true}];
    for(const now of [at(-6),at(1)])assert.deepEqual(plain(b.ctx.websiteWeeklyPopularity_(drinks,events,new Date(now))),getWeeklyPopularity(drinks,events,new Date(now)));
  }
  b.ctx.forms_=()=>{throw new Error('stats do not need Forms');};b.ctx.supplyEvents_=()=>{throw new Error('stats do not need supplies');};
  const result=plain(b.ctx.popularityData_());assert.equal(result.version,1);assert.doesNotMatch(JSON.stringify(result),/quantity|recorder|events|stock|history/);
});

function client(b,overrides={}){
  const pendingStorage=storage(),publicStorage=storage();let reads=0;
  const store=new GoogleInventoryStore({googleScriptUrl:endpoint},{pendingStorage,publicStorage,voteStorage:storage(),createRequestId:()=>requestId,createVoterId:()=> 'browser-performance-00000001',
    readPublicData:async(_url,{action})=>{reads++;return plain(action==='warehouse'?b.ctx.warehouseData_():action==='popularity'?b.ctx.popularityData_():b.ctx.publicData_());},
    submitWebsiteCommand:async(_url,command)=>b.send(command.operation,command.data,command.requestId).result,...overrides});
  return {store,publicStorage,reads:()=>reads};
}

test('confirmed wish/vote snapshots skip the extra full read and update cache without extending its original freshness',async()=>{
  const b=websiteBackend(),c=client(b);await c.store.init();const oldSaved=JSON.parse([...c.publicStorage.values.values()][0]);
  await c.store.submitWish(wishData);assert.equal(c.reads(),1);assert.equal(c.store.data.wishes.length,1);
  const saved=JSON.parse([...c.publicStorage.values.values()][0]);assert.equal(saved.savedAt,oldSaved.savedAt);assert.equal(saved.payload.wishes[0].name,wishData.name);assert.equal(saved.payload.events,undefined);
  const v=client(b,{createRequestId:()=> 'performance-request-00000002'});await v.store.init();await v.store.voteWish(c.store.data.wishes[0].id,'小王');
  assert.equal(v.reads(),1);assert.equal(v.store.data.wishes[0].votes,1);assert.equal(v.store.hasVoted(c.store.data.wishes[0].id),true);
});

test('legacy or mismatched receipts use the confirmed full-read fallback',async()=>{
  for(const patch of [undefined,{operation:'wish',id:'wrong',snapshotAt:stamp,wish:{id:'wrong'}}]){
    const b=websiteBackend(),c=client(b,{submitWebsiteCommand:async(_url,command)=>patch||{operation:'wish',id:'legacy'}});
    await c.store.init();await c.store.submitWish(wishData);assert.equal(c.reads(),2);assert.equal(c.store.data.wishes.length,0);
  }
});

test('an older pending read or accepted receipt cannot erase a confirmed new wish or newer votes',async()=>{
  const b=websiteBackend(),c=client(b);await c.store.init();let release;
  const old=plain(b.ctx.publicData_());
  c.store.readPublicData=()=>new Promise(resolve=>{release=()=>resolve(old);});
  const pending=c.store.read();await c.store.submitWish(wishData);release();await pending;assert.equal(c.store.data.wishes.length,1);
  const current=c.store.data.wishes[0];current.votes=3;current.supporters=['甲','乙','丙'];
  const result={operation:'vote',snapshotAt:stamp,wish:{...current,votes:1,supporters:['甲']}};
  assert.equal(c.store.applyWishReceipt('vote',{wishId:current.id},result,requestId),true);assert.equal(c.store.data.wishes[0].votes,3);
});

test('overlapping reads share one request, return from warehouse renders immediately with no private observations',async()=>{
  const b=websiteBackend(),c=client(b);await c.store.init();let release,requests=0;
  c.store.readPublicData=async()=>{requests++;await new Promise(resolve=>{release=resolve;});return plain(b.ctx.warehouseData_());};
  const first=c.store.readWarehouse(),second=c.store.readWarehouse();assert.equal(requests,1);release();await Promise.all([first,second]);
  assert.ok(c.store.data.events.length>0);await c.store.openPublic();assert.equal(requests,1);assert.equal(c.store.inWarehouse,false);assert.equal(c.store.data.events.length,0);assert.equal(c.store.data.drinks[0].stock,0);assert.equal(c.store.revalidateOnStart,true);
});

test('new statistics endpoint reads only validated aggregates and keeps the current view unchanged',async()=>{
  const b=websiteBackend(),c=client(b);await c.store.init();const data=c.store.data;
  await c.store.readPopularity();assert.equal(c.reads(),2);assert.equal(c.store.data,data);assert.equal(c.store.popularity.rows.length,0);
  c.store.popularityReadAt=0;c.store.readPublicData=async()=>({ok:true,version:1,popularity:{rows:[],countedProducts:0,observedProducts:8,calculatedAt:stamp}});
  await assert.rejects(c.store.readPopularity(),/熱門品項格式/);
});

test('active inventory saves skip unchanged archive rendering but recovery updates a product archived meanwhile',()=>{
  const b=websiteBackend();let archiveWrites=0;
  b.ctx.renderArchive_=()=>{archiveWrites++;};
  b.send('stocktake',{entries:[{drinkId:'tea',quantity:2}],recorder:'測試'});assert.equal(archiveWrites,0);
  b.ctx.renderWarehouse_=()=>{throw new Error('view failed');};
  const id='performance-archived-00000001',data={entries:[{drinkId:'tea',quantity:3}],recorder:'測試'};
  assert.throws(()=>b.send('stocktake',data,id),/view failed/);
  b.sheets.Catalog.rows[1][7]=false;b.ctx.renderWarehouse_=()=>{};
  b.send('stocktake',data,id);assert.equal(archiveWrites,1);
});

test('admin summary avoids Forms/votes and full histories in response, includes paused low supplies without treating unknown as zero',()=>{
  const b=websiteBackend();b.ctx.forms_=()=>{throw new Error('no Forms in summary');};b.ctx.voteSummary_=()=>{throw new Error('no votes in summary');};
  const result=plain(b.ctx.adminSummaryData_());assert.deepEqual(result.lowItems.map(item=>item.id),['milk']);
  assert.equal(result.lowItems[0].stock,9);assert.doesNotMatch(JSON.stringify(result),/events|recorder|lastCountAt|voter|supplies/);
  b.send('restock-preference',{kind:'drink',itemId:'milk',mode:'hold',expectedMode:'normal'});
  assert.equal(b.ctx.adminSummaryData_().lowItems[0].mode,'hold');
});

test('admin summary is independent of full view and a cold admin can still load the public catalog',async()=>{
  const b=websiteBackend();let reads=[];
  const {store}=client(b,{readPublicData:async(_url,{action})=>{reads.push(action);return plain(action==='admin'?b.ctx.adminSummaryData_():b.ctx.publicData_());}});
  await store.readAdminSummary();assert.equal(store.googleViewLoaded,false);assert.equal(store.adminSummary.lowItems[0].id,'milk');
  await store.readAdminSummary();assert.deepEqual(reads,['admin']);await store.openPublic();assert.equal(store.googleViewLoaded,true);assert.equal(store.data.drinks.length,3);
});

test('archive return wishes share one item and voter ledger, deduplicate retries, reject active products and preserve inventory',()=>{
  const b=websiteBackend(),inventory=b.inventory();
  const data={drinkId:'old',voterName:'Rey',voterId:'archive-browser-00000001'};
  const one=b.send('archive-wish',data,requestId);assert.equal(one.state,'accepted');assert.equal(one.result.wish.sourceDrinkId,'old');assert.equal(one.result.wish.votes,1);
  assert.deepEqual(b.send('archive-wish',data,requestId),one);assert.equal(b.send('archive-wish',data).result.alreadyVoted,true);
  const second=b.send('archive-wish',{...data,voterName:'同事',voterId:'archive-browser-00000002'});assert.equal(second.result.id,one.result.id);assert.equal(second.result.wish.votes,2);
  assert.equal(b.sheets.WishReview.rows.length,2);assert.equal(b.sheets.WishVotes.rows.length,3);assert.deepEqual(b.inventory(),inventory);
  assert.equal(b.send('archive-wish',{...data,drinkId:'tea'}).state,'rejected');assert.equal(b.send('archive-wish',{...data,voterName:''}).state,'rejected');
  const publicWish=plain(b.ctx.publicData_().wishes[0]);assert.equal(publicWish.sourceDrinkId,'old');assert.equal(publicWish.votes,2);assert.doesNotMatch(JSON.stringify(publicWish),/browser|voterId/);
});

test('archive wish client patches the confirmed card without a full read and keeps named voting state',async()=>{
  const b=websiteBackend(),c=client(b);await c.store.init();await c.store.supportArchivedDrink('old','Rey');
  assert.equal(c.reads(),1);assert.equal(c.store.data.wishes[0].sourceDrinkId,'old');assert.equal(c.store.hasVoted(c.store.data.wishes[0].id),true);
});

test('expiry recorder corrections change only display attribution, preserve original source/audit and quantities and retry once',()=>{
  const b=websiteBackend();b.send('supply-stocktake',{entries:[{supplyId:'supply-noodle-03',quantity:6}],recorder:'原盤點'});
  const events=b.ctx.supplyEvents_(b.ss),last=events[events.length-1];
  const expiry=b.send('supply-expiry-set',{supplyId:last.supplyId,expectedStock:6,expectedEventId:last.id,recorder:'Codex 代補',batches:[{quantity:6,expiresOn:'2030-06-01'}]});
  assert.equal(expiry.state,'accepted');const before=plain(b.ctx.supplyEvents_(b.ss)),target=before.find(e=>e.type==='expiry-set');
  const source=plain(b.sheets.SupplyHistory.rows),inventory=plain(b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss)));
  const data={eventIds:[target.id],expectedRecorder:'Codex 代補',recorder:'Rey'},id='performance-correction-0000001';
  assert.equal(b.send('supply-recorder-correction',data,id).state,'accepted');assert.equal(b.send('supply-recorder-correction',data,id).state,'accepted');
  const after=plain(b.ctx.supplyEvents_(b.ss));assert.equal(after.find(e=>e.id===target.id).recorder,'Rey');
  assert.deepEqual(after.map(e=>({...e,recorder:before.find(old=>old.id===e.id).recorder})),before);assert.deepEqual(b.sheets.SupplyHistory.rows,source);assert.equal(b.sheets.HistoryRecorderCorrections.rows.length,2);
  assert.deepEqual(plain(b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss))),inventory);
  assert.equal(b.send('supply-recorder-correction',data).state,'rejected');
});

test('a partially saved archive return resumes without duplicate wish/vote rows and respects the source column',()=>{
  const b=websiteBackend(),data={drinkId:'old',voterName:'Rey',voterId:'archive-browser-00000001'},original=b.ctx.voteSummaryRows_;
  b.ctx.voteSummaryRows_=()=>{throw new Error('temporary summary failure');};assert.throws(()=>b.send('archive-wish',data,requestId),/temporary/);assert.equal(b.ctx.websiteReceipt_(requestId).state,'pending');
  b.ctx.voteSummaryRows_=original;assert.equal(b.send('archive-wish',data,requestId).state,'accepted');assert.equal(b.sheets.WishReview.rows.length,2);assert.equal(b.sheets.WishVotes.rows.length,2);
  const conflict=websiteBackend();conflict.sheets.WishReview.rows[0][7]='原有其他欄位';assert.equal(conflict.send('archive-wish',data).state,'rejected');assert.equal(conflict.sheets.WishReview.rows.length,1);assert.equal(conflict.sheets.WishVotes.rows.length,1);
});

test('large supporter receipts fall back to the full read without failing a saved vote or overflowing a sheet cell',()=>{
  const b=websiteBackend(),wish=b.send('wish',wishData,requestId),name='王'.repeat(80);
  for(let i=0;i<600;i++)b.sheets.WishVotes.rows.push([`vote-${i}`,wish.result.id,`browser-large-${String(i).padStart(16,'0')}`,stamp,'採計',name]);
  const result=b.send('vote',{wishId:wish.result.id,voterName:'Rey',voterId:'browser-large-0000000000600'});assert.equal(result.state,'accepted');assert.equal(result.result.wish,undefined);assert.ok(JSON.stringify(result.result).length<40000);assert.equal(b.ctx.voteSummary_(b.ss).counts[wish.result.id],601);
});

test('returning to an already loaded public page cancels an older warehouse response before it changes store mode',async()=>{
  const b=websiteBackend(),c=client(b);await c.store.init();let release;
  c.store.readPublicData=()=>new Promise(resolve=>{release=()=>resolve(plain(b.ctx.warehouseData_()));});
  const pending=c.store.readWarehouse();c.store.cancelOtherViewReads(false);release();await pending;
  assert.equal(c.store.inWarehouse,false);assert.equal(c.store.data.events.length,0);assert.equal(c.store.data.drinks[0].stock,0);
});
