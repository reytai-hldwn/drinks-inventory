import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {websiteBackend,memorySheet} from './helpers/google-website.mjs';
import {canonicalSnackCategory,normalizeSupplyWarehouse,prepareSupplyCatalog,snackPackHint} from '../js/supplies.js';
import {GoogleInventoryStore} from '../js/google-store.js';

const plain=value=>JSON.parse(JSON.stringify(value));
const state=item=>({id:item.id,name:item.name,flavor:item.flavor||'',category:canonicalSnackCategory(item.category),unit:item.unit,active:item.active});
const fresh=(flavor='原味')=>({name:'虛構量販零食（量販包）',flavor,category:'健康零食',unit:'包'});
const command=entries=>({recorder:'虛構管理者',entries});
const stock=b=>plain(b.ctx.supplyInventory_(b.ctx.supplyCatalog_(b.ss),b.ctx.supplyEvents_(b.ss)));
const snapshot=b=>plain(Object.fromEntries(['SupplyCatalog','SupplyHistory','History','RestockPreferences'].map(key=>[key,b.sheets[key]?.rows??null])));

test('catalog-only batch preserves stock, history, ids, units and flags; new flavors are pending',()=>{
  const b=websiteBackend();
  const created=b.send('new-arrival',{kind:'snack',name:'虛構原品項',category:'其他甜食',flavor:'舊口味',unit:'條',quantity:17,recorder:'虛構'}).result.id;
  b.send('supply-stocktake',{entries:[{supplyId:created,quantity:11}],recorder:'虛構'});
  b.send('restock-preference',{kind:'snack',itemId:created,mode:'consider',expectedMode:'normal'});
  const old=stock(b).find(item=>item.id===created),before=snapshot(b),unlisted=stock(b).filter(item=>item.id!==created);
  const result=b.send('snack-catalog-batch',command([
    {supplyId:created,expected:state(old),name:old.name,flavor:'確認口味',category:'健康零食',unit:'條'},fresh(),fresh('香草')
  ]));
  assert.equal(result.state,'accepted');assert.equal(result.result.created,2);assert.equal(result.result.updated,1);
  const updated=stock(b).find(item=>item.id===created);
  assert.deepEqual({...updated,flavor:old.flavor,category:old.category},old);
  assert.equal(updated.flavor,'確認口味');assert.equal(updated.category,'健康零食');
  assert.deepEqual(stock(b).filter(item=>unlisted.some(old=>old.id===item.id)),unlisted);
  for(const id of result.result.ids.slice(1)){
    const item=stock(b).find(item=>item.id===id);assert.equal(item.stock,null);assert.equal(item.lastCountAt,null);
    assert.equal(item.lastArrivalAt,null);assert.equal(item.unit,'包');
    assert.equal(b.ctx.supplyEvents_(b.ss).filter(event=>event.supplyId===id).length,0);
  }
  for(const key of ['SupplyHistory','History','RestockPreferences'])assert.deepEqual(b.sheets[key]?.rows??null,before[key]);
  assert.equal(b.ctx.warehouseData_().supplyEntry.snackCatalogVersion,1);
  const receipt=b.ctx.websiteReceipt_(result.requestId);assert.equal(JSON.stringify(receipt).includes('虛構管理者'),false);
  assert.equal(snackPackHint(fresh()),'量販包以整個大包為 1 包，不換算內袋數量。');assert.equal(snackPackHint({name:'單包棒類'}),'');
});

test('whole catalog batch validates every row before edits, including duplicates and accidental quantities',()=>{
  for(const bad of [{...fresh(),category:'不正確'}, {...fresh(),quantity:0}, {...fresh(),stock:null}, {...fresh(),unit:'杯'}, fresh()]){
    const b=websiteBackend(),before=snapshot(b);
    assert.equal(b.send('snack-catalog-batch',command([fresh(),bad])).state,'rejected');assert.deepEqual(snapshot(b),before);
  }
  for(const entries of [[],Array.from({length:101},(_,i)=>fresh(String(i)))]){
    const b=websiteBackend();assert.equal(b.send('snack-catalog-batch',command(entries)).state,'rejected');assert.equal(b.sheets.SupplyCatalog,undefined);
  }
});

test('catalog batch checks expected metadata and existing units before changing any rows',()=>{
  for(const mutate of [entry=>{entry.expected.name='過時名稱';},entry=>{entry.unit='條';}]){
    const b=websiteBackend(),item=stock(b)[0],entry={supplyId:item.id,expected:state(item),name:'虛構更新',flavor:'',category:'其他鹹食',unit:item.unit};
    mutate(entry);const before=snapshot(b);
    assert.equal(b.send('snack-catalog-batch',command([fresh(),entry])).state,'rejected');assert.deepEqual(snapshot(b),before);
  }
  const b=websiteBackend(),item=stock(b).find(item=>item.kind==='snack');
  assert.equal(b.send('snack-catalog-batch',command([{name:item.name,flavor:item.flavor,category:item.category,unit:item.unit}])).state,'rejected');
});

test('catalog retries after a view failure or partial source write are idempotent',()=>{
  for(const stage of ['view','append']){
    const b=websiteBackend();b.ctx.ensureSupplyStorage_(b.ss);
    const old=stock(b).find(item=>item.kind==='snack'),beforeHistory=plain(b.sheets.SupplyHistory.rows),requestId=randomUUID();
    const data=command([{supplyId:old.id,expected:state(old),name:'虛構確認名稱',flavor:old.flavor,category:old.category,unit:old.unit},fresh()]);
    let fail=true;
    if(stage==='view')b.ctx.renderSupplyWarehouse_=()=>{if(fail){fail=false;throw Error('interrupted view');}};
    else {const original=b.ctx.websiteAppendMissing_;b.ctx.websiteAppendMissing_=(sheet,rows)=>{if(fail&&sheet===b.sheets.SupplyCatalog&&rows.some(row=>row[1]===fresh().name)){fail=false;throw Error('interrupted append');}return original(sheet,rows);};}
    assert.throws(()=>b.send('snack-catalog-batch',data,requestId),/interrupted/);
    assert.equal(b.send('snack-catalog-batch',data,requestId).state,'accepted');
    const after=snapshot(b);assert.equal(b.send('snack-catalog-batch',data,requestId).state,'accepted');assert.deepEqual(snapshot(b),after);
    assert.equal(stock(b).filter(item=>item.name===fresh().name).length,1);assert.deepEqual(b.sheets.SupplyHistory.rows,beforeHistory);
  }
});

test('schema conflicts and concurrent catalog edits are rejected without partial domain edits',()=>{
  const b=websiteBackend();b.sheets.SupplyCatalog=memorySheet([['id','name','kind','unit','active','category','私人欄']]);
  const before=snapshot(b);assert.equal(b.send('snack-catalog-batch',command([fresh()])).state,'rejected');assert.deepEqual(snapshot(b),before);
  const c=websiteBackend();c.ctx.ensureSupplyStorage_(c.ss);const item=stock(c)[0];
  const effects=c.ctx.prepareWebsiteRequest_(c.ss,{requestId:randomUUID(),operation:'snack-catalog-batch',data:command([{supplyId:item.id,expected:state(item),...fresh()}])},new Date().toISOString());
  c.sheets.SupplyCatalog.rows.find(row=>row[0]===item.id)[1]='另一位管理者更新';
  const concurrent=snapshot(c);assert.throws(()=>c.ctx.applyWebsiteRequest_(c.ss,effects),/已被更新/);assert.deepEqual(snapshot(c),concurrent);
});

test('old health categories normalize in local and Google records without altering history',()=>{
  for(const category of ['燕麥棒/餅','燕麥棒／餅','燕麥棒']){
    const b=websiteBackend();const result=b.send('new-arrival',{kind:'snack',...fresh(),category,quantity:3,recorder:'虛構'});
    assert.equal(result.state,'accepted');assert.equal(stock(b).find(item=>item.id===result.result.id).category,'健康零食');
    const payload=plain(b.ctx.warehouseData_());payload.supplies.find(item=>item.id===result.result.id).category=category;
    const history=plain(payload.supplyEvents),normalized=normalizeSupplyWarehouse(payload);
    assert.equal(normalized.supplies.find(item=>item.id===result.result.id).category,'健康零食');assert.deepEqual(payload.supplyEvents,history);
    const local=prepareSupplyCatalog({supplies:payload.supplies,supplyEvents:history});assert.equal(local.supplies.find(item=>item.id===result.result.id).category,'健康零食');assert.deepEqual(local.supplyEvents,history);
  }
});

test('new health arrivals remain compatible with older deployments, including batches',async()=>{
  const b=websiteBackend(),store=new GoogleInventoryStore({googleScriptUrl:'https://script.google.com/macros/s/SNACK_TEST/exec'},{readPublicData:async()=>plain(b.ctx.warehouseData_())});
  await store.readWarehouse();const writes=[];store.sendWebsiteCommand=async(operation,data)=>{writes.push({operation,data});return {};};
  const data={kind:'snack',...fresh(),quantity:1,recorder:'虛構'};
  await store.submitNewArrival(data);await store.submitBatchArrival({recorder:'虛構',entries:[{...data,isNew:true}]});
  assert.equal(writes[0].data.category,'燕麥棒/餅');assert.equal(writes[1].data.entries[0].category,'燕麥棒/餅');assert.equal(data.category,'健康零食');
});
