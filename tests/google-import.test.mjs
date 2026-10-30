import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const code = await readFile(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');
const countedAt = '2020-01-01T15:45:00+08:00';
const rows = [{ drinkId: 'tea', quantity: 20 }, { drinkId: 'water', quantity: 0 }];

function harness(email = 'owner@example.com') {
  const ledger = [];
  let refreshed = 0;
  const context = vm.createContext({ console, Date, JSON, Number });
  vm.runInContext(code, context);
  context.Session = { getActiveUser: () => ({ getEmail: () => email }) };
  context.adminEmails_ = () => ['owner@example.com'];
  context.locked_ = (work) => work();
  context.requiredSpreadsheet_ = () => ({});
  context.catalog_ = () => [{ id: 'tea' }, { id: 'water' }];
  context.historyEvents_ = () => ledger.map((event) => ({ ...event }));
  context.appendHistory_ = (_sheet, events) => ledger.push(...events.map((event) => ({ ...event })));
  context.refreshWarehouse_ = () => { refreshed += 1; };
  return { context, ledger, refreshed: () => refreshed };
}

test('private stocktake import requires a configured Google administrator', () => {
  for (const email of ['', 'outsider@example.com']) {
    const { context, ledger } = harness(email);
    assert.throws(() => context.importPrivateStocktake('batch', rows, countedAt), /管理者/);
    assert.equal(ledger.length, 0);
  }
});

test('private imports require a timezone-aware past stocktake timestamp', () => {
  const { context, ledger } = harness();
  for (const invalid of ['', '2020-01-01', '2020-01-01T15:45:00', 'not-a-date', '2999-01-01T15:45:00+08:00']) {
    assert.throws(() => context.importPrivateStocktake('batch', rows, invalid), /時間|未來/);
  }
  assert.equal(ledger.length, 0);
});

test('all rows are validated before any stocktake is appended', () => {
  for (const invalid of [[], [{ drinkId: 'unknown', quantity: 1 }], [{ drinkId: 'tea', quantity: -1 }], [{ drinkId: 'tea', quantity: 1.5 }], [rows[0], rows[0]]]) {
    const { context, ledger } = harness();
    assert.throws(() => context.importPrivateStocktake('batch', invalid, countedAt));
    assert.equal(ledger.length, 0);
  }
});

test('accepted imports append counts, preserve zero and normalize the supplied time', () => {
  const { context, ledger, refreshed } = harness();
  context.importPrivateStocktake('batch', rows, countedAt, 'Private review');
  assert.equal(ledger.length, 2);
  assert.deepEqual(ledger.map((event) => event.quantity), [20, 0]);
  assert.ok(ledger.every((event) => event.type === 'count' && event.accepted && event.createdAt === '2020-01-01T07:45:00.000Z'));
  assert.equal(refreshed(), 1);
  const before = structuredClone(ledger);
  context.importPrivateStocktake('batch', [...rows].reverse(), countedAt, 'Private review');
  assert.deepEqual(ledger, before);
});

test('a batch cannot be reused with different counts, time, notes or product scope', () => {
  const { context, ledger } = harness();
  context.importPrivateStocktake('batch', rows, countedAt, 'Original');
  const before = structuredClone(ledger);
  for (const [changedRows, changedTime, changedNote] of [
    [[{ ...rows[0], quantity: 21 }, rows[1]], countedAt, 'Original'],
    [rows, '2020-01-02T15:45:00+08:00', 'Original'],
    [rows, countedAt, 'Changed'],
    [[rows[0]], countedAt, 'Original'],
  ]) {
    assert.throws(() => context.importPrivateStocktake('batch', changedRows, changedTime, changedNote), /批次/);
    assert.deepEqual(ledger, before);
  }
  const smaller = harness();
  smaller.context.importPrivateStocktake('batch', [rows[0]], countedAt, 'Original');
  assert.throws(() => smaller.context.importPrivateStocktake('batch', rows, countedAt, 'Original'), /批次/);
  assert.equal(smaller.ledger.length, 1);
});
