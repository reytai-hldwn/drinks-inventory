import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANY_CATALOG, CATEGORIES_ORDER, createCompanyData, prepareCompanyCatalog } from '../js/catalog.js';
import { sampleData } from '../js/domain.js';

const expectedNames = [
  '光泉牛乳', '光泉巧克力牛乳', '光泉薏仁糙米漿', 'tree top瓶果汁', '光泉柳橙汁',
  '統一豆漿', '波利芭樂汁', '立頓原味奶茶', '立頓巧克力牛奶', '立頓沁香奶綠', '日月潭紅茶', '十六茶', 'Fin', '波蜜一日蔬果',
  '荔枝氣泡水', '零卡可口可樂', '零卡百事可樂', '八寶粥', '可口可樂', '百事可樂', '黑松沙士',
  'Milkiis水蜜桃', 'Miilkis', 'Redbull能量飲', 'Vida氣泡飲', '蜂蜜燕麥', '麥萃麥茶', '原萃綠茶', '十全果醋',
];

test('company catalog preserves all 29 supplied names with stable IDs', () => {
  assert.deepEqual(COMPANY_CATALOG.map((drink) => drink.name), expectedNames);
  assert.deepEqual(COMPANY_CATALOG.map((drink) => drink.id), expectedNames.map((_, index) => `company-drink-${String(index + 1).padStart(2, '0')}`));
});

test('semantic milk category is first while tea and rice drink stay distinct', () => {
  assert.deepEqual(CATEGORIES_ORDER, ['牛奶／豆漿', '茶飲', '咖啡', '果汁', '汽水', '其他']);
  assert.deepEqual(COMPANY_CATALOG.filter((drink) => drink.category === '牛奶／豆漿').map((drink) => drink.name), [
    '光泉牛乳', '光泉巧克力牛乳', '統一豆漿', '立頓巧克力牛奶',
  ]);
  const category = (name) => COMPANY_CATALOG.find((drink) => drink.name === name).category;
  assert.equal(category('立頓原味奶茶'), '茶飲');
  assert.equal(category('立頓沁香奶綠'), '茶飲');
  assert.equal(category('光泉薏仁糙米漿'), '其他');
  assert.equal(category('蜂蜜燕麥'), '其他');
  assert.deepEqual(Object.fromEntries(CATEGORIES_ORDER.map((name) => [name, COMPANY_CATALOG.filter((drink) => drink.category === name).length])), {
    '牛奶／豆漿': 4, '茶飲': 6, '咖啡': 0, '果汁': 4, '汽水': 9, '其他': 6,
  });
});

test('packaging affects drawing independently of semantic categories and container units', () => {
  assert.deepEqual(Object.fromEntries(['窄瓶鋁箔包', '鋁箔包', '鐵罐', '小型鐵罐', '長鐵罐', '寶特瓶', '其他'].map((packaging) => [packaging, COMPANY_CATALOG.filter((drink) => drink.packaging === packaging).length])), {
    '窄瓶鋁箔包': 5, '鋁箔包': 9, '鐵罐': 4, '小型鐵罐': 3, '長鐵罐': 4, '寶特瓶': 3, '其他': 1,
  });
  for (const drink of COMPANY_CATALOG) {
    assert.equal(drink.unit, drink.packaging === '寶特瓶' ? '瓶' : drink.packaging.includes('鐵罐') ? '罐' : '包');
  }
});

test('company data starts unknown with no invented stocktake, box size, target or history', () => {
  const data = createCompanyData();
  assert.equal(data.catalogVersion, 1);
  assert.equal(data.lastInventoryAt, null);
  assert.deepEqual(data.events, []);
  assert.deepEqual(data.wishes, []);
  for (const drink of data.drinks) {
    assert.equal(drink.stock, 0);
    assert.equal(drink.lastCountAt, null);
    assert.equal(drink.perCase, null);
    assert.equal(drink.target, null);
    assert.equal(drink.threshold, 10);
  }
  data.drinks[0].stock = 10;
  assert.equal(createCompanyData().drinks[0].stock, 0);
  assert.equal(COMPANY_CATALOG[0].stock, 0);
});

test('unchanged fictional catalog and its synthetic history and wishes are replaced', () => {
  const old = sampleData();
  const before = structuredClone(old);
  const result = prepareCompanyCatalog(old);
  assert.equal(result.drinks.length, 29);
  assert.deepEqual(result.drinks.map((drink) => drink.name), expectedNames);
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.wishes, []);
  assert.equal(result.lastInventoryAt, null);
  assert.deepEqual(old, before, 'migration must not mutate its input');
});

test('changed seed drinks, manual events, genuine wishes and custom metadata survive', () => {
  const old = sampleData();
  old.drinks[0].stock = 42;
  old.drinks[1].name = '員工自訂豆奶';
  old.drinks[2].category = '管理員自訂分類';
  old.drinks[3].threshold = 12;
  old.drinks[4].perCase = 12;
  old.drinks.push({ id: 'real-water', name: '公司純水', stock: 20, perCase: 24, category: '飲水', lastCountAt: '2026-10-30T00:00:00Z' });
  const manual = { id: 'real-count', type: 'count', drinkId: 'demo-drink-6', quantity: 0, previousStock: 0, createdAt: '2026-10-30T00:00:00Z', note: '定期盤點' };
  old.events.push(manual);
  const actualWish = { id: 'real-wish', name: '真的想喝的', url: 'https://example.com', note: '同事許願', status: 'pending', createdAt: '2026-10-30T00:00:00Z' };
  old.wishes.push(actualWish);
  old.wishes[0].status = 'purchased';
  old.customMetadata = { warehouse: 'A' };
  const before = structuredClone(old);
  const result = prepareCompanyCatalog(old);
  for (const id of ['demo-drink-1', 'demo-drink-2', 'demo-drink-3', 'demo-drink-4', 'demo-drink-5', 'demo-drink-6', 'real-water']) {
    assert.deepEqual(result.drinks.find((drink) => drink.id === id), old.drinks.find((drink) => drink.id === id));
    assert.deepEqual(result.events.filter((event) => event.drinkId === id), old.events.filter((event) => event.drinkId === id));
  }
  assert.deepEqual(result.wishes, [old.wishes[0], actualWish]);
  assert.deepEqual(result.customMetadata, old.customMetadata);
  assert.equal(result.lastInventoryAt, old.lastInventoryAt);
  assert.deepEqual(old, before);
  assert.equal(result.drinks.length, 36);
});

test('user-created events with demonstration-like notes are never mistaken for seeded events', () => {
  const old = sampleData();
  const event = { id: 'human-added', type: 'restock', drinkId: 'demo-drink-1', quantity: 24, createdAt: '2026-10-30T00:00:00Z', note: '示範到貨' };
  old.events.push(event);
  const result = prepareCompanyCatalog(old);
  assert.ok(result.drinks.some((drink) => drink.id === 'demo-drink-1'));
  assert.ok(result.events.some((record) => record.id === event.id));
});

test('already prepared company data is idempotent and existing company IDs are not duplicated', () => {
  const data = createCompanyData();
  data.drinks[0].stock = 18;
  data.drinks[0].category = '管理員自訂分類';
  const prepared = prepareCompanyCatalog(data);
  assert.equal(prepared, data);
  assert.equal(prepareCompanyCatalog(prepared), prepared);
  const legacy = { drinks: [{ ...data.drinks[0] }], events: [], wishes: [], lastInventoryAt: null };
  const result = prepareCompanyCatalog(legacy);
  assert.equal(result.drinks.length, 29);
  assert.equal(result.drinks[0].stock, 18);
  assert.equal(result.drinks[0].category, '管理員自訂分類');
});

test('blank data can be prepared without fixtures or side effects', () => {
  assert.deepEqual(prepareCompanyCatalog({ drinks: [], events: [], wishes: [], lastInventoryAt: null }), createCompanyData());
  assert.deepEqual(prepareCompanyCatalog(null), createCompanyData());
  assert.throws(() => prepareCompanyCatalog({ drinks: [] }), /格式不正確/);
});
