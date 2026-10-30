import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankData, escapeHtml, getConsumption, number, safeUrl, sampleData, stockStatus, uid,
} from '../js/domain.js';

const event = (type, quantity, day, drinkId = 'tea') => ({
  id: uid(), type, quantity, drinkId, createdAt: `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`,
});
const now = new Date('2026-10-30T00:00:00Z');

test('counts arrivals between stocktakes when estimating consumption', () => {
  const result = getConsumption('tea', [
    event('count', 20, 1), event('restock', 24, 3), event('count', 12, 8),
  ], now);
  assert.equal(result.consumed, 32);
  assert.equal(result.days, 7);
  assert.equal(result.dailyRate, 32 / 7);
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
  assert.equal(result.dailyRate, 20 / 7);
  assert.equal(result.samples, 2);
});

test('negative stocktake adjustments are flagged and excluded', () => {
  const result = getConsumption('tea', [
    event('count', 10, 1), event('count', 20, 4), event('count', 14, 7),
  ], now);
  assert.equal(result.anomaly, true);
  assert.equal(result.consumed, 6);
  assert.equal(result.days, 3);
  assert.equal(result.dailyRate, 2);
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
