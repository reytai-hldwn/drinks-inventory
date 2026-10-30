import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryStore } from '../js/store.js';
import { blankData } from '../js/domain.js';

const CONFIG = { supabaseUrl: 'https://pantry.example.supabase.co', supabaseAnonKey: 'public-anon-key' };
const DATA_KEY = 'office-pantry-demo-v1';
const SESSION_KEY = 'office-pantry-session-v1';
const READ_PATH = '/rest/v1/inventory_state?singleton=eq.true&select=revision,payload,updated_at';
const EDITOR_ID = '11111111-1111-4111-8111-111111111111';
const EDITOR_PATH = `/rest/v1/editors?user_id=eq.${EDITOR_ID}&select=user_id`;
const TIMESTAMP = '2026-10-30T00:00:00.000Z';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

function setup(t, steps = []) {
  for (const key of ['localStorage', 'sessionStorage']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value: memoryStorage() });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined });
    const step = steps.shift();
    assert.ok(step, `Unexpected request: ${url}`);
    assert.equal(url, CONFIG.supabaseUrl + step.path);
    if (step.inspect) step.inspect(calls.at(-1));
    if (step.error) throw step.error;
    const status = step.status || 200;
    return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(step.result) };
  });
  t.after(() => assert.equal(steps.length, 0, 'All intended HTTP requests executed'));
  return calls;
}

function row(revision = 7, payload = blankData()) {
  return [{ revision, payload, updated_at: TIMESTAMP }];
}

function session(overrides = {}) {
  return {
    access_token: 'editor-token', refresh_token: 'refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: EDITOR_ID, email: 'editor@example.com' }, ...overrides,
  };
}

function loggedInSteps(readRevision = 7) {
  return [
    { path: READ_PATH, result: row(readRevision) },
    { path: '/auth/v1/token?grant_type=password', result: session() },
    { path: EDITOR_PATH, result: [{ user_id: EDITOR_ID }] },
    { path: READ_PATH, result: row(readRevision) },
  ];
}

test('partial or insecure shared configuration fails without seeding demo data', async (t) => {
  setup(t);
  for (const config of [
    { supabaseUrl: CONFIG.supabaseUrl },
    { supabaseAnonKey: CONFIG.supabaseAnonKey },
    { ...CONFIG, supabaseUrl: 'http://pantry.example.supabase.co' },
  ]) {
    const store = new InventoryStore(config);
    await assert.rejects(store.init(), /設定不完整/);
    assert.equal(store.mode, 'shared');
    assert.equal(store.canEdit, false);
    assert.deepEqual(store.data, blankData());
    assert.equal(localStorage.getItem(DATA_KEY), null);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('configured connection failure never falls back to local sample stock', async (t) => {
  setup(t, [{ path: READ_PATH, error: new TypeError('offline') }]);
  const store = new InventoryStore(CONFIG);
  await assert.rejects(store.init(), /無法連接共用資料庫/);
  assert.equal(store.mode, 'shared');
  assert.deepEqual(store.data, blankData());
  assert.equal(localStorage.getItem(DATA_KEY), null);
});

test('permission and missing-database errors never create demo data', async (t) => {
  setup(t, [
    { path: READ_PATH, status: 401, result: { message: 'invalid API key' } },
    { path: READ_PATH, result: [] },
  ]);
  const denied = new InventoryStore(CONFIG);
  await assert.rejects(denied.init(), /驗證失敗/);
  const missing = new InventoryStore(CONFIG);
  await assert.rejects(missing.init(), /找不到有效的庫存資料/);
  assert.equal(localStorage.getItem(DATA_KEY), null);
  assert.deepEqual(missing.data, blankData());
});

test('anonymous shared reads send the public API key and remain read-only', async (t) => {
  const calls = setup(t, [{ path: READ_PATH, result: row() }]);
  const store = new InventoryStore({ ...CONFIG, supabaseUrl: CONFIG.supabaseUrl + '/' });
  await store.init();
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].headers.apikey, CONFIG.supabaseAnonKey);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[0].body, undefined);
  assert.equal(store.revision, 7);
  assert.equal(store.updatedAt, TIMESTAMP);
  assert.equal(store.canEdit, false);
  await assert.rejects(store.save(blankData()), /獲授權/);
  assert.equal(calls.length, 1);
});

test('editor login checks membership and saves using the loaded revision atomically', async (t) => {
  const data = { ...blankData(), wishes: [{ id: 'wish-1', name: '氣泡水' }] };
  const calls = setup(t, [
    ...loggedInSteps(),
    { path: '/rest/v1/rpc/save_inventory', result: row(8, data) },
  ]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  await store.login('editor@example.com', 'test-password');
  assert.equal(store.canEdit, true);
  assert.deepEqual(calls[1].body, { email: 'editor@example.com', password: 'test-password' });
  assert.equal(calls[1].headers.Authorization, undefined);
  assert.equal(calls[2].headers.Authorization, 'Bearer editor-token');
  await store.save(data);
  assert.equal(calls[4].method, 'POST');
  assert.equal(calls[4].headers.Authorization, 'Bearer editor-token');
  assert.deepEqual(calls[4].body, { expected_revision: 7, payload: data });
  assert.equal(store.revision, 8);
  assert.deepEqual(store.data, data);
  assert.equal(localStorage.getItem(DATA_KEY), null);
  assert.ok(sessionStorage.getItem(SESSION_KEY));
});

test('an authenticated account without editor membership cannot save', async (t) => {
  const calls = setup(t, [
    { path: READ_PATH, result: row() },
    { path: '/auth/v1/token?grant_type=password', result: session() },
    { path: EDITOR_PATH, result: [] },
  ]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  await assert.rejects(store.login('reader@example.com', 'test-password'), /尚未被授權/);
  assert.equal(store.session, null);
  assert.equal(store.user, null);
  assert.equal(store.canEdit, false);
  assert.equal(sessionStorage.getItem(SESSION_KEY), null);
  await assert.rejects(store.save(blankData()), /獲授權/);
  assert.equal(calls.length, 3);
});

test('a concurrent-write conflict preserves last read data and does not retry blindly', async (t) => {
  const calls = setup(t, [
    ...loggedInSteps(),
    { path: '/rest/v1/rpc/save_inventory', status: 409, result: { code: '40001', message: 'inventory_conflict' } },
  ]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  await store.login('editor@example.com', 'test-password');
  const original = structuredClone(store.data);
  await assert.rejects(
    store.save({ ...blankData(), wishes: [{ id: 'unsaved', name: '尚未儲存' }] }),
    (error) => error.code === 'CONFLICT' && /尚未儲存/.test(error.message),
  );
  assert.equal(calls.length, 5);
  assert.equal(store.revision, 7);
  assert.deepEqual(store.data, original);
  assert.equal(store.updatedAt, TIMESTAMP);
});

test('revoked database privileges reject save without modifying loaded data', async (t) => {
  setup(t, [
    ...loggedInSteps(),
    { path: '/rest/v1/rpc/save_inventory', status: 403, result: { code: '42501', message: 'editor_required' } },
  ]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  await store.login('editor@example.com', 'test-password');
  await assert.rejects(store.save({ ...blankData(), wishes: [{ id: 'unsaved' }] }), /驗證失敗/);
  assert.equal(store.revision, 7);
  assert.deepEqual(store.data, blankData());
});

test('expired editor session refreshes before a write and uses the new bearer token', async (t) => {
  const calls = setup(t, [
    ...loggedInSteps(),
    { path: '/auth/v1/token?grant_type=refresh_token', result: session({ access_token: 'new-editor-token' }) },
    { path: '/rest/v1/rpc/save_inventory', result: row(8) },
  ]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  await store.login('editor@example.com', 'test-password');
  store.session.expires_at = 1;
  await store.save(blankData());
  assert.deepEqual(calls[4].body, { refresh_token: 'refresh-token' });
  assert.equal(calls[4].headers.Authorization, undefined);
  assert.equal(calls[5].headers.Authorization, 'Bearer new-editor-token');
  assert.equal(store.revision, 8);
});

test('failed session refresh clears editing privileges and never sends the write', async (t) => {
  const calls = setup(t, [
    ...loggedInSteps(),
    { path: '/auth/v1/token?grant_type=refresh_token', status: 400, result: { error: 'invalid_grant' } },
  ]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  await store.login('editor@example.com', 'test-password');
  store.session.expires_at = 1;
  await assert.rejects(store.save(blankData()), /登入已到期/);
  assert.equal(store.canEdit, false);
  assert.equal(store.session, null);
  assert.equal(calls.length, 5);
  assert.equal(store.revision, 7);
});

test('local demo edits persist across store instances without network calls', async (t) => {
  const calls = setup(t);
  const first = new InventoryStore();
  await first.init();
  assert.equal(first.mode, 'demo');
  assert.equal(first.data.drinks.length, 29);
  assert.equal(first.canEdit, true);
  const changed = structuredClone(first.data);
  changed.drinks[0].stock = 123;
  await first.save(changed);
  const second = new InventoryStore();
  await second.init();
  assert.equal(second.data.drinks[0].stock, 123);
  assert.equal(second.revision, 1);
  assert.equal(calls.length, 0);
});

test('local demo rejects stale writes from another tab and respects read-only preview', async (t) => {
  setup(t);
  const first = new InventoryStore();
  const second = new InventoryStore();
  await first.init();
  await second.init();
  const changed = structuredClone(first.data);
  changed.drinks[0].stock = 88;
  await first.save(changed);
  await assert.rejects(second.save(second.data), /另一個分頁/);
  assert.equal(JSON.parse(localStorage.getItem(DATA_KEY)).data.drinks[0].stock, 88);
  first.preview = true;
  assert.equal(first.canEdit, false);
  await assert.rejects(first.save(changed), /獲授權/);
});

test('public demo wish submission appends pending fields without changing stock or accepting injected approval', async (t) => {
  setup(t);
  const store = new InventoryStore();
  await store.init();
  store.preview = true;
  assert.equal(store.canEdit, false);
  const before = structuredClone(store.data);
  const started = Date.now();
  await store.submitWish({
    name: '  無糖氣泡水  ', url: ' https://example.com/drink ', note: '  下午想喝  ',
    id: 'chosen-id', status: 'purchased', createdAt: '1999-01-01', drinks: [],
  });
  const wish = store.data.wishes.at(-1);
  assert.equal(wish.name, '無糖氣泡水');
  assert.equal(wish.url, 'https://example.com/drink');
  assert.equal(wish.note, '下午想喝');
  assert.equal(wish.status, 'pending');
  assert.notEqual(wish.id, 'chosen-id');
  assert.ok(Date.parse(wish.createdAt) >= started);
  assert.ok(Date.parse(wish.createdAt) <= Date.now());
  assert.deepEqual(Object.keys(wish).sort(), ['id', 'name', 'url', 'note', 'status', 'createdAt'].sort());
  assert.deepEqual(store.data.drinks, before.drinks);
  assert.deepEqual(store.data.events, before.events);
  assert.deepEqual(store.data.wishes.slice(0, -1), before.wishes);
  assert.equal(store.revision, 1);
  assert.equal(store.canEdit, false);
  assert.deepEqual(JSON.parse(localStorage.getItem(DATA_KEY)).data, store.data);
  await assert.rejects(store.save(store.data), /獲授權/);
});

test('public wishes validate names, link protocols, credentials and field lengths before writing', async (t) => {
  setup(t);
  const store = new InventoryStore();
  await store.init();
  const original = localStorage.getItem(DATA_KEY);
  for (const wish of [
    { name: '  ' }, { name: '茶'.repeat(81) }, { name: '茶', note: '字'.repeat(501) },
    { name: '茶', url: 'javascript:alert(1)' }, { name: '茶', url: 'https://user:pass@example.com' },
    { name: '茶', url: 'https://example.com/' + 'x'.repeat(2000) }, { name: '茶', note: {} },
  ]) await assert.rejects(store.submitWish(wish));
  assert.equal(localStorage.getItem(DATA_KEY), original);
  assert.equal(store.revision, 0);
  assert.equal(fetch.mock.callCount(), 0);
});

test('public wish submission uses its own anonymous RPC with only the three allowed fields', async (t) => {
  const received = { ...blankData(), wishes: [{ id: 'server-id', name: '茶', url: 'https://example.com/', note: '', status: 'pending', createdAt: TIMESTAMP }] };
  const calls = setup(t, [
    { path: READ_PATH, result: row() },
    { path: '/rest/v1/rpc/submit_wish', result: row(9, received) },
  ]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  // Even an existing editor session is unnecessary for the public operation.
  store.session = session({ expires_at: 1 });
  assert.equal(store.canEdit, false);
  await store.submitWish({ name: ' 茶 ', url: 'https://example.com', status: 'purchased', id: 'injected' });
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].headers.apikey, CONFIG.supabaseAnonKey);
  assert.equal(calls[1].headers.Authorization, undefined);
  assert.deepEqual(calls[1].body, { wish_name: '茶', wish_url: 'https://example.com/', wish_note: '' });
  assert.deepEqual(store.data, received);
  assert.equal(store.revision, 9);
  assert.equal(localStorage.getItem(DATA_KEY), null);
  await assert.rejects(store.save(store.data), /獲授權/);
});

test('failed public wish RPC preserves existing data and never falls back to demo storage', async (t) => {
  setup(t, [
    { path: READ_PATH, result: row() },
    { path: '/rest/v1/rpc/submit_wish', status: 403, result: { code: '42501' } },
    { path: '/rest/v1/rpc/submit_wish', error: new TypeError('offline') },
  ]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  await assert.rejects(store.submitWish({ name: '茶' }), /驗證失敗/);
  await assert.rejects(store.submitWish({ name: '茶' }), /無法連接/);
  assert.deepEqual(store.data, blankData());
  assert.equal(store.revision, 7);
  assert.equal(store.mode, 'shared');
  assert.equal(localStorage.getItem(DATA_KEY), null);
});

test('malformed public wish response does not replace loaded data', async (t) => {
  setup(t, [
    { path: READ_PATH, result: row() },
    { path: '/rest/v1/rpc/submit_wish', result: [{ revision: 8, payload: { wishes: [] } }] },
  ]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  await assert.rejects(store.submitWish({ name: '茶' }), /未收到有效的許願結果/);
  assert.equal(store.revision, 7);
  assert.deepEqual(store.data, blankData());
});

test('local public submissions reject stale revisions and cannot overwrite another tab’s wish', async (t) => {
  setup(t);
  const first = new InventoryStore();
  const second = new InventoryStore();
  await first.init();
  await second.init();
  first.preview = second.preview = true;
  await first.submitWish({ name: '先收到的願望' });
  await assert.rejects(second.submitWish({ name: '過期分頁的願望' }), /另一個分頁/);
  const persisted = JSON.parse(localStorage.getItem(DATA_KEY)).data;
  assert.equal(persisted.wishes.at(-1).name, '先收到的願望');
  assert.equal(second.revision, 0);
});

test('an older admin stock save cannot erase a newly submitted public wish', async (t) => {
  setup(t);
  const admin = new InventoryStore();
  const visitor = new InventoryStore();
  await admin.init();
  await visitor.init();
  visitor.preview = true;
  const staleAdminData = structuredClone(admin.data);
  await visitor.submitWish({ name: '保留這個願望' });
  staleAdminData.drinks[0].stock = 777;
  await assert.rejects(admin.save(staleAdminData), /另一個分頁/);
  const persisted = JSON.parse(localStorage.getItem(DATA_KEY)).data;
  assert.equal(persisted.wishes.at(-1).name, '保留這個願望');
  assert.notEqual(persisted.drinks[0].stock, 777);
});
