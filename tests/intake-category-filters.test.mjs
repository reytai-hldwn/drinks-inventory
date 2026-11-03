import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { canonicalDrinkCategory, prepareCompanyCatalog, createCompanyData } from '../js/catalog.js';
import { GoogleInventoryStore, normalizeGooglePublicData } from '../js/google-store.js';
import { InventoryStore } from '../js/store.js';
import { matchesInventoryStockFilter } from '../js/restock-preferences.js';
import { websiteBackend } from './helpers/google-website.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const endpoint = 'https://script.google.com/macros/s/CATEGORY_TEST/exec';
const corrections = [['午后時光重乳奶茶','茶飲'],['義美寶吉葡萄汁','果汁'],['波蜜蜂蜜檸檬','果汁']];

test('existing drink category aliases and the three confirmed arrivals normalize without changing stock or identity', () => {
  const b = websiteBackend();
  b.sheets.Catalog.rows[2][2] = '牛奶／豆漿';
  for (const [i,[name]] of corrections.entries()) b.sheets.Catalog.rows.push(['new-' + i, name, '其他', '其他', '包', '', 10, true]);
  const before = plain(b.sheets.Catalog.rows), history = plain(b.sheets.History.rows);
  const drinks = plain(b.ctx.catalog_(b.ss));
  assert.equal(drinks.find(item => item.id === 'milk').category, '牛乳／植物奶');
  for (const [name,category] of corrections) assert.equal(drinks.find(item => item.name === name).category, category);
  assert.deepEqual(b.sheets.Catalog.rows, before, 'read normalization does not rewrite source rows');
  assert.deepEqual(b.sheets.History.rows, history);
  const normalized = normalizeGooglePublicData(plain(b.ctx.warehouseData_()), { warehouse: true });
  assert.equal(normalized.data.drinks.find(item => item.id === 'milk').category, '牛乳／植物奶');
  assert.equal(canonicalDrinkCategory('牛乳/豆漿'), '牛乳／植物奶');
  assert.equal(canonicalDrinkCategory('茶飲', '義美寶吉葡萄汁'), '茶飲', 'explicit custom classifications are retained');
  assert.equal(canonicalDrinkCategory('其他', '義美寶吉葡萄汁另一口味'), '其他');
  const local = createCompanyData();
  local.drinks.push({ ...local.drinks[0], id:'confirmed-new', name:corrections[0][0], category:'其他', stock:7 });
  const prepared = prepareCompanyCatalog(local);
  assert.equal(prepared.drinks.find(item => item.id === 'confirmed-new').category, '茶飲');
  assert.equal(prepared.drinks.find(item => item.id === 'confirmed-new').stock, 7);
  assert.equal(local.drinks.at(-1).category, '其他');
});

test('single and mixed batch arrivals store the selected drink category and reject an invalid later row before writing', () => {
  const b = websiteBackend();
  const first = b.send('new-arrival', { kind:'drink', name:'虛構新紅茶', category:'茶飲', unit:'包', quantity:4, recorder:'測試' });
  assert.equal(first.state, 'accepted');
  assert.equal(b.sheets.Catalog.rows.find(row => row[0] === first.result.id)[2], '茶飲');
  assert.equal(b.sheets.ProductIntake.rows.find(row => row[2] === first.result.id)[4], '茶飲');
  assert.equal(b.inventory().find(row => row.drink.id === first.result.id).stock, 4);
  const rows = plain(b.sheets.Catalog.rows), events = plain(b.sheets.History.rows);
  const invalid = b.send('batch-arrival', { recorder:'測試', entries:[
    { kind:'drink', drinkId:'tea', quantity:5 },
    { kind:'drink', isNew:true, name:'虛構錯誤分類', category:'不存在分類', unit:'瓶', quantity:2 },
  ] });
  assert.equal(invalid.state, 'rejected');
  assert.deepEqual(b.sheets.Catalog.rows, rows); assert.deepEqual(b.sheets.History.rows, events);
  const result = b.send('batch-arrival', { recorder:'測試', entries:[
    { kind:'drink', isNew:true, name:'虛構新果汁', category:'果汁', unit:'包', quantity:3 },
    { kind:'snack', supplyId:'supply-snack-01', quantity:2 },
  ] });
  assert.equal(result.state, 'accepted');
  assert.equal(b.sheets.Catalog.rows.find(row => row[0] === result.result.items[0].id)[2], '果汁');
  const legacy = b.send('new-arrival', { kind:'drink', name:'虛構舊用戶端', unit:'瓶', quantity:1, recorder:'測試' });
  assert.equal(legacy.state, 'accepted', 'already prepared older requests remain compatible');
  const olderProduct = b.send('product', {name:'虛構舊版植物奶',category:'牛奶／豆漿',packaging:'鋁箔包',recorder:'測試'});
  assert.equal(olderProduct.state, 'accepted');
  assert.equal(b.sheets.Catalog.rows.find(row=>row[0]===olderProduct.result.id)[2], '牛乳／植物奶');
});

test('older deployments cannot silently discard a selected drink category in single or batch arrivals', async () => {
  const b = websiteBackend(), payload = plain(b.ctx.warehouseData_());
  assert.equal(normalizeGooglePublicData(payload, { warehouse:true }).drinkCategoryVersion, 1);
  delete payload.websiteEntry.drinkCategoryVersion;
  assert.equal(normalizeGooglePublicData(payload, { warehouse:true }).drinkCategoryVersion, 0);
  const store = new GoogleInventoryStore({ googleScriptUrl:endpoint });
  store.websiteEntryVersion=1; store.newArrivalVersion=1; store.batchArrivalVersion=1;
  const calls=[]; store.sendWebsiteCommand=async (op,data)=>{calls.push({op,data});return {ok:true};};
  const data={kind:'drink',name:'虛構飲料',category:'果汁',unit:'包',quantity:2,recorder:'測試'};
  await assert.rejects(store.submitNewArrival(data), /更新原 Apps Script/);
  await assert.rejects(store.submitBatchArrival({entries:[{...data,isNew:true}],recorder:'測試'}), /更新原 Apps Script/);
  assert.deepEqual(calls, []);
  await store.addDrink({name:'虛構植物奶',category:'牛乳／植物奶',packaging:'鋁箔包',recorder:'測試'});
  assert.equal(calls.pop().data.category, '牛奶／豆漿', 'existing product creation stays compatible with older category choices');
  store.drinkCategoryVersion=1;
  await store.submitNewArrival(data);
  assert.equal(calls[0].data.category, '果汁');
  await assert.rejects(store.submitNewArrival({...data,category:''}), /選擇飲料分類/);
});

test('snack low-stock views require a recorded quantity from one to ten and an explicit restock mark', () => {
  for (const stock of [null,0,1,10,11,100]) for (const marked of [false,true]) {
    const item={id:'snack',kind:'snack',stock,lastCountAt:stock===null?null:'2026-11-03T00:00:00Z'};
    const preferences=marked?[{kind:'snack',itemId:'snack',mode:'consider'}]:[];
    assert.equal(matchesInventoryStockFilter(item,'low',preferences), marked && stock>=1 && stock<=10, `${stock}/${marked}`);
    assert.equal(matchesInventoryStockFilter(item,'empty',preferences), stock===0);
  }
  const b=websiteBackend();
  b.send('supply-stocktake',{recorder:'測試',entries:[{supplyId:'supply-snack-01',quantity:5},{supplyId:'supply-snack-02',quantity:5}]});
  b.send('restock-preference',{kind:'snack',itemId:'supply-snack-01',mode:'consider',expectedMode:'normal'});
  assert.deepEqual(plain(b.ctx.adminSummaryData_()).lowItems.filter(item=>item.kind==='snack').map(item=>item.id), ['supply-snack-01']);
});

test('local previews also retain a chosen category for a new drink arrival', async t => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});
  t.after(()=>previous?Object.defineProperty(globalThis,'localStorage',previous):delete globalThis.localStorage);
  const store=new InventoryStore();await store.init();
  const result=await store.submitNewArrival({kind:'drink',name:'虛構植物奶'+randomUUID(),category:'牛乳／植物奶',unit:'包',quantity:3,recorder:'測試'});
  assert.equal(store.data.drinks.find(item=>item.id===result.id).category, '牛乳／植物奶');
  assert.equal(store.data.drinks.find(item=>item.id===result.id).stock, 3);
});
