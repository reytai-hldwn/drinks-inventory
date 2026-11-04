import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInitialStocktake, blankData, escapeHtml, getConsumption, getWeeklyPopularity, number, restockQuantity, stocktakeQuantities, safeUrl, sampleData, stockStatus, uid,
} from '../js/domain.js';

const event = (type, quantity, day, drinkId = 'tea') => ({
  id: uid(), type, quantity, drinkId, createdAt: `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`,
});
const now = new Date('2026-10-30T00:00:00Z');

test('weekly popularity ranks measured consumption including arrivals and excludes unmeasured or invalid intervals', () => {
  const drinks = ['tea','milk','new','short','bad','old','zero'].map(id=>({id,name:id,unit:id==='milk'?'包':'瓶',active:id!=='old'}));
  const events = [event('count',20,1),event('restock',24,3),event('count',12,8),
    event('count',40,1,'milk'),event('count',30,8,'milk'),event('count',40,15,'milk'),
    event('count',20,1,'new'),event('count',10,1,'short'),{...event('count',0,1,'short'),createdAt:'2026-10-01T01:00:00Z'},
    event('count',10,1,'bad'),event('count',20,8,'bad'),event('count',100,1,'old'),event('count',0,8,'old'),
    event('count',5,1,'zero'),event('count',5,8,'zero'),{...event('count',0,9),accepted:false}];
  const result=getWeeklyPopularity(drinks,events,now);
  assert.deepEqual(result.rows.map(row=>[row.id,row.weeklyRate]),[['tea',32]]);
  assert.equal(result.observedProducts,2); // tea and zero; milk has an unrecorded increase.
  assert.equal(result.countedProducts,6);
  const measured=getWeeklyPopularity(drinks,[event('count',20,1,'milk'),event('restock',24,3,'milk'),event('count',16,8,'milk')],now);
  assert.equal(measured.rows[0].weeklyRate,28);assert.equal(measured.rows[0].unit,'包');
  assert.deepEqual(getWeeklyPopularity(drinks,[],now).rows,[]);
});

test('counts arrivals between stocktakes when estimating consumption', () => {
  const result = getConsumption('tea', [
    event('count', 20, 1), event('restock', 24, 3), event('count', 12, 8),
  ], now);
  assert.equal(result.consumed, 32);
  assert.equal(result.days, 5);
  assert.equal(result.dailyRate, 32 / 5);
  assert.equal(result.samples, 1);
  assert.equal(result.anomaly, false);
});

test('does not infer consumption from a single stocktake or later arrivals', () => {
  const result = getConsumption('tea', [event('count', 20, 1), event('restock', 24, 3)], now);
  assert.equal(result.dailyRate, null);
  assert.equal(result.samples, 0);
  assert.equal(getConsumption('tea', [], now).dailyRate, null);
});

test('uses interval duration rather than averaging interval rates', () => {
  const result = getConsumption('tea', [
    event('count', 30, 1), event('count', 28, 2), event('count', 10, 8),
  ], now);
  assert.equal(result.dailyRate, 20 / 5);
  assert.equal(result.samples, 2);
});

test('negative stocktake adjustments are flagged and excluded', () => {
  const result = getConsumption('tea', [
    event('count', 10, 1), event('count', 20, 4), event('count', 14, 7),
  ], now);
  assert.equal(result.anomaly, true);
  assert.equal(result.consumed, 6);
  assert.ok(Math.abs(result.days - 7 / 3) < 1e-10);
  assert.ok(Math.abs(result.dailyRate - 18 / 7) < 1e-10);
});

test('sorts events and isolates drink histories and completed intervals', () => {
  const result = getConsumption('tea', [
    event('count', 12, 8), event('restock', 50, 9), event('count', 20, 1),
    event('restock', 24, 3), event('restock', 100, 4, 'coffee'),
    { ...event('count', 0, 10), createdAt: '2026-11-10T00:00:00Z' },
  ], now);
  assert.equal(result.consumed, 32);
  assert.equal(result.samples, 1);
});

test('zero usage is valid and same-time counts do not divide by zero', () => {
  const result = getConsumption('tea', [
    event('count', 10, 1), event('count', 10, 1), event('count', 10, 8),
  ], now);
  assert.equal(result.dailyRate, 0);
  assert.equal(result.samples, 1);
});

test('invalid quantities do not produce fabricated consumption', () => {
  const result = getConsumption('tea', [
    event('count', 10, 1), event('restock', -2, 2), event('count', 8, 8),
  ], now);
  assert.equal(result.dailyRate, null);
  assert.equal(result.anomaly, true);
});

test('quantities accept whole nonnegative numbers only', () => {
  for (const [input, expected] of [[0, 0], ['24', 24], [' 3 ', 3], [10, 10]]) {
    assert.equal(number(input), expected);
  }
  for (const invalid of ['', ' ', -1, '1.5', 1.5, Infinity, NaN, null, true, {}, 'abc', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => number(invalid), /整數/);
  }
});

test('ten or fewer is low when the threshold is ten', () => {
  assert.equal(stockStatus({ stock: 9, threshold: 10 }), 'low');
  assert.equal(stockStatus({ stock: 10, threshold: 10 }), 'low');
  assert.equal(stockStatus({ stock: 0, threshold: 0 }), 'low');
  assert.equal(stockStatus({ stock: 0, threshold: 10, lastCountAt: null }), 'unknown');
});

test('wish URLs allow web links but reject executable protocols and credentials', () => {
  assert.equal(safeUrl(' https://example.com/drink?q=tea '), 'https://example.com/drink?q=tea');
  assert.equal(safeUrl('http://example.com'), 'http://example.com/');
  for (const invalid of ['', 'example.com', 'javascript:alert(1)', 'data:text/html,hello', 'https://user:pass@example.com', '/relative']) {
    assert.equal(safeUrl(invalid), '');
  }
});

test('escapeHtml prevents markup from inventory and wish names', () => {
  assert.equal(escapeHtml('<img title="x" onerror=\'run\'> &'), '&lt;img title=&quot;x&quot; onerror=&#39;run&#39;&gt; &amp;');
  assert.equal(escapeHtml(null), '');
});

test('demo data contains 30 complete items and internally consistent stocktakes', () => {
  const data = sampleData();
  assert.equal(data.drinks.length, 30);
  assert.equal(new Set(data.drinks.map((drink) => drink.id)).size, 30);
  assert.ok(data.drinks.some((drink) => drink.perCase === 12));
  assert.ok(data.drinks.some((drink) => drink.perCase === 30));
  for (const drink of data.drinks) {
    assert.ok(['包', '瓶', '罐'].includes(drink.unit));
    const counts = data.events.filter((record) => record.drinkId === drink.id && record.type === 'count');
    assert.equal(counts.at(-1).quantity, drink.stock);
    assert.ok(getConsumption(drink.id, data.events).dailyRate > 0);
  }
  assert.deepEqual(blankData(), { drinks: [], events: [], wishes: [], lastInventoryAt: null });
});


test('arrivals accept either case or loose quantity and add both without relaxing stocktakes', () => {
  assert.equal(restockQuantity('2', '', 24), 48);
  assert.equal(restockQuantity('', '5', 24), 5);
  assert.equal(restockQuantity('2', '5', 24), 53);
  assert.equal(restockQuantity('0', '5', null), 5);
  assert.equal(restockQuantity(undefined, '5', 24), 5);
  for (const [cases, loose] of [['', ''], ['0', '0'], [' ', null]]) assert.throws(() => restockQuantity(cases, loose, 24), /至少填一項/);
  for (const [cases, loose] of [['-1', '3'], ['1', '-3'], ['1.5', ''], ['', '2.5'], ['oops', '2'], [true, '2'], ['10000', ''], ['1', '999999']]) assert.throws(() => restockQuantity(cases, loose, 24));
  assert.throws(() => restockQuantity('1', '', null), /每箱數量/);
  assert.throws(() => number(''), /整數/);
});


test('partial stocktakes omit blanks, preserve explicit zero and reject invalid filled quantities', () => {
  const drinks = [{ id: 'tea' }, { id: 'water' }, { id: 'old', active: false }];
  assert.deepEqual(stocktakeQuantities(drinks, { tea: '0', water: '', old: '99' }), [{ drinkId: 'tea', quantity: 0 }]);
  assert.deepEqual(stocktakeQuantities(drinks, { water: '8' }), [{ drinkId: 'water', quantity: 8 }]);
  assert.deepEqual(stocktakeQuantities(drinks, { tea: '7', water: '8' }), [{ drinkId: 'tea', quantity: 7 }, { drinkId: 'water', quantity: 8 }]);
  assert.throws(() => stocktakeQuantities(drinks, { tea: ' ', old: '1' }), /至少填寫一個/);
  for (const value of ['-1', '1.5', '1000000', 'invalid', true]) assert.throws(() => stocktakeQuantities(drinks, { tea: '1', water: value }));
});


test('private preview baselines import once, retain zero and later arrivals, and preserve newer counts', () => {
  const data = { drinks: [{ id: 'tea', stock: 4, lastCountAt: null }, { id: 'water', stock: 9, lastCountAt: '2020-01-03T00:00:00Z' }], events: [{ id: 'arrival', drinkId: 'tea', type: 'restock', quantity: 4, createdAt: '2020-01-02T00:00:00Z' }], wishes: [{ id: 'wish' }], lastInventoryAt: null };
  const snapshot = { snapshotId: 'private-test', countedAt: '2020-01-01T00:00:00Z', countedAtApproximate: true, items: [{ id: 'tea', quantity: 0 }, { id: 'water', quantity: 2 }] };
  const before = structuredClone(data);
  const result = applyInitialStocktake(data, snapshot);
  assert.equal(result.drinks[0].stock, 4);
  assert.equal(result.drinks[0].lastCountAt, '2020-01-01T00:00:00.000Z');
  assert.equal(result.drinks[1].stock, 9);
  assert.equal(result.drinks[1].lastCountAt, data.drinks[1].lastCountAt);
  assert.equal(result.events.length, 3);
  assert.match(result.events[1].note, /約略/);
  assert.deepEqual(result.wishes, data.wishes);
  assert.deepEqual(data, before);
  result.drinks[0].stock = 8;
  assert.equal(applyInitialStocktake(result, snapshot), result);
  assert.equal(applyInitialStocktake(result, null), result);
  assert.throws(() => applyInitialStocktake(data, { ...snapshot, items: [{ id: 'unknown', quantity: 5 }] }), /品項/);
});
