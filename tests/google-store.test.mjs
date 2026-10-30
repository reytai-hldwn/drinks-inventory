import test from 'node:test';
import assert from 'node:assert/strict';
import { blankData } from '../js/domain.js';
import { GoogleInventoryStore, fetchGooglePublicData, normalizeGooglePublicData, validateGoogleScriptUrl } from '../js/google-store.js';

const ENDPOINT = 'https://script.google.com/macros/s/COMPANY_SCRIPT_123/exec';
const WISH_URL = 'https://docs.google.com/forms/d/e/FORM_ID/viewform';
const ADMIN_URL = 'https://docs.google.com/spreadsheets/d/COMPANY_SHEET/edit#gid=0';

function payload() {
  return {
    ok: true,
    provider: 'google',
    drinks: [{ id: 'company-drink-01', name: '光泉牛乳', category: '牛奶／豆漿', packaging: '窄瓶鋁箔包', unit: '包', perCase: null, threshold: 10, active: true }],
    wishes: [{ id: 'wish-01', name: '無糖氣泡水', url: 'https://example.com/drink', note: '想要清爽的選擇', status: 'pending', createdAt: '2026-10-30T00:00:00.000Z' }],
    formUrls: { wish: WISH_URL },
    adminUrl: ADMIN_URL,
    updatedAt: '2026-10-30T00:00:00.000Z',
  };
}

function browser() {
  const pageWindow = {};
  const children = [];
  const timers = new Map();
  let sequence = 0;
  const document = {
    head: { appendChild(script) { children.push(script); } },
    createElement(name) {
      assert.equal(name, 'script');
      return { remove() { const index = children.indexOf(this); if (index !== -1) children.splice(index, 1); } };
    },
  };
  return {
    window: pageWindow,
    document,
    children,
    timers,
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    callback(script) { return new URL(script.src).searchParams.get('callback'); },
  };
}

test('only a published Google Apps Script HTTPS endpoint is accepted', () => {
  assert.equal(validateGoogleScriptUrl(` ${ENDPOINT} `), ENDPOINT);
  for (const invalid of ['', 'https://example.com/macros/s/ID/exec', 'http://script.google.com/macros/s/ID/exec',
    'https://script.google.com/macros/s/ID/dev', `${ENDPOINT}?key=secret`, `${ENDPOINT}#hash`,
    'https://user:pass@script.google.com/macros/s/ID/exec', 'https://script.google.com.evil.example/macros/s/ID/exec']) {
    assert.throws(() => validateGoogleScriptUrl(invalid), /Apps Script/);
  }
});

test('JSONP sends only a safe callback and public action, then removes all resources', async () => {
  const page = browser();
  const pending = fetchGooglePublicData(ENDPOINT, page);
  assert.equal(page.children.length, 1);
  const script = page.children[0];
  const callback = page.callback(script);
  assert.match(callback, /^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/);
  assert.equal(new URL(script.src).searchParams.get('action'), 'public');
  assert.deepEqual([...new URL(script.src).searchParams.keys()].sort(), ['action', 'callback']);
  assert.equal(script.referrerPolicy, 'no-referrer');
  const result = payload();
  page.window[callback](result);
  assert.deepEqual(await pending, result);
  assert.equal(page.children.length, 0);
  assert.equal(page.timers.size, 0);
  assert.equal(Object.hasOwn(page.window, callback), false);
});

test('concurrent JSONP reads have separate callbacks and clean up independently', async () => {
  const page = browser();
  const first = fetchGooglePublicData(ENDPOINT, page);
  const second = fetchGooglePublicData(ENDPOINT, page);
  const firstCallback = page.callback(page.children[0]);
  const secondCallback = page.callback(page.children[1]);
  assert.notEqual(firstCallback, secondCallback);
  page.window[secondCallback]({ provider: 'google', second: true });
  page.window[firstCallback]({ provider: 'google', first: true });
  assert.equal((await first).first, true);
  assert.equal((await second).second, true);
  assert.equal(page.children.length, 0);
  assert.equal(page.timers.size, 0);
});

test('network failure, timeout, and non-JSONP response all reject and clean up', async () => {
  for (const kind of ['network', 'timeout', 'wrong-response']) {
    const page = browser();
    const pending = fetchGooglePublicData(ENDPOINT, { ...page, timeout: 7 });
    const script = page.children[0];
    const callback = page.callback(script);
    if (kind === 'network') script.onerror();
    else if (kind === 'wrong-response') script.onload();
    else {
      const timer = [...page.timers.values()][0];
      assert.equal(timer.delay, 7);
      timer.callback();
    }
    await assert.rejects(pending, /Google|端點/);
    assert.equal(page.children.length, 0, kind);
    assert.equal(page.timers.size, 0, kind);
    assert.equal(Object.hasOwn(page.window, callback), false, kind);
  }
});

test('normalization includes archives but discards warehouse numbers, histories, emails, and roles', () => {
  const raw = payload();
  Object.assign(raw.drinks[0], { stock: 42, lastCountAt: '2026-10-30T00:00:00Z', ownerEmail: 'private@example.com', active: false });
  Object.assign(raw, { events: [{ quantity: 99 }], isEditor: true, adminEmails: ['private@example.com'], user: { id: 'admin' } });
  Object.assign(raw.wishes[0], { email: 'private@example.com', respondentEmail: 'private@example.com' });
  const snapshot = structuredClone(raw);
  const result = normalizeGooglePublicData(raw);
  assert.equal(result.data.drinks[0].active, false);
  assert.equal(result.data.drinks[0].perCase, null);
  assert.equal(result.data.drinks[0].stock, 0);
  assert.equal(result.data.drinks[0].lastCountAt, null);
  assert.deepEqual(result.data.events, []);
  assert.equal(result.data.lastInventoryAt, null);
  assert.doesNotMatch(JSON.stringify(result), /private@example|ownerEmail|adminEmails|respondentEmail/);
  assert.deepEqual(raw, snapshot, 'normalization does not mutate the endpoint response');
});

test('public links are limited to HTTPS Google Forms and private Google Sheets', () => {
  const valid = payload();
  valid.formUrls.wish = 'https://forms.gle/SHORT_ID';
  assert.equal(normalizeGooglePublicData(valid).formUrls.wish, valid.formUrls.wish);
  for (const [field, invalid] of [
    ['form', 'javascript:alert(1)'], ['form', 'https://evil.example/form'],
    ['form', 'https://user:pass@docs.google.com/forms/d/e/ID/viewform'], ['form', 'http://forms.gle/ID'],
    ['sheet', 'https://evil.example/sheet'], ['sheet', 'https://docs.google.com/document/d/ID/edit'],
  ]) {
    const value = payload();
    if (field === 'form') value.formUrls.wish = invalid;
    else value.adminUrl = invalid;
    assert.throws(() => normalizeGooglePublicData(value), /網址/);
  }
});

test('malformed rows, duplicate IDs, executable wish URLs, and error responses are rejected', () => {
  const mutate = [
    (value) => { value.error = 'failed'; },
    (value) => { value.ok = false; },
    (value) => { value.drinks.push({ ...value.drinks[0] }); },
    (value) => { value.drinks[0].perCase = -1; },
    (value) => { value.drinks[0].threshold = '10'; },
    (value) => { value.drinks[0].active = 'false'; },
    (value) => { value.wishes[0].url = 'javascript:alert(1)'; },
    (value) => { value.wishes[0].status = 'admin'; },
    (value) => { value.wishes[0].createdAt = 'not-a-date'; },
    (value) => { value.formUrls = {}; },
    (value) => { value.adminUrl = ''; },
  ];
  for (const change of mutate) {
    const value = payload();
    change(value);
    assert.throws(() => normalizeGooglePublicData(value));
  }
});

test('Google store initializes read-only without local storage, credentials, or demo fallback', async () => {
  let calls = 0;
  const store = new GoogleInventoryStore({ provider: 'google', googleScriptUrl: ENDPOINT }, {
    readPublicData: async (url) => { assert.equal(url, ENDPOINT); calls += 1; return payload(); },
  });
  await store.init();
  assert.equal(calls, 1);
  assert.equal(store.mode, 'google');
  assert.equal(store.isEditor, false);
  assert.equal(store.canEdit, false);
  assert.equal(store.user, null);
  store.preview = false;
  assert.equal(store.canEdit, false, 'changing UI area does not grant editor privileges');
  assert.equal(store.data.drinks.length, 1);
  assert.equal(store.formUrls.wish, WISH_URL);
  assert.equal(store.forms, store.formUrls);
  assert.equal(store.adminUrl, ADMIN_URL);
  assert.equal(store.warehouseUrl, ADMIN_URL);
  await assert.rejects(store.login(), /Google 帳號/);
  await assert.rejects(store.save({ drinks: [] }), /獲授權/);
  await assert.rejects(store.submitWish({ name: 'new' }), /Google 表單/);
});

test('failed or malformed reads preserve the previous data and never create samples', async () => {
  let next = payload();
  const store = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, {
    readPublicData: async () => { if (next instanceof Error) throw next; return next; },
  });
  await store.init();
  const data = store.data;
  const revision = store.revision;
  for (const invalid of [new Error('offline'), { ok: false, error: 'unavailable' }, { ...payload(), adminUrl: '' }]) {
    next = invalid;
    await assert.rejects(store.read());
    assert.equal(store.data, data);
    assert.equal(store.revision, revision);
  }
  const missing = new GoogleInventoryStore({}, { readPublicData: async () => { assert.fail('must not request without a configured endpoint'); } });
  await assert.rejects(missing.init(), /Apps Script/);
  assert.deepEqual(missing.data, blankData());
});

test('polling timestamps alone do not replace the fridge view, but catalog changes do', async () => {
  const next = payload();
  const store = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, { readPublicData: async () => structuredClone(next) });
  await store.init();
  const revision = store.revision;
  next.updatedAt = '2026-10-30T02:00:00.000Z';
  await store.read();
  assert.equal(store.revision, revision);
  assert.equal(store.updatedAt, next.updatedAt);
  next.drinks[0].active = false;
  await store.read();
  assert.notEqual(store.revision, revision);
});
