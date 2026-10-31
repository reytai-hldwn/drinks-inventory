import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryStore } from '../js/store.js';
import { blankData } from '../js/domain.js';
import { createCompanyData } from '../js/catalog.js';

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
  assert.equal(first.data.drinks.length, 40);
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
  assert.deepEqual(Object.keys(wish).sort(), ['id', 'kind', 'name', 'url', 'note', 'status', 'createdAt', 'votes', 'voterIds'].sort());
  assert.equal(wish.votes, 0);
  assert.deepEqual(wish.voterIds, []);
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


test('stored version-one catalog is upgraded once without resetting user stock or history', async (t) => {
  setup(t);
  const data = createCompanyData();
  data.catalogVersion = 1;
  data.drinks = data.drinks.slice(0, 29);
  data.drinks[0].stock = 35;
  data.drinks[0].active = false;
  data.events = [{ id: 'manual-count', drinkId: data.drinks[0].id, type: 'count', quantity: 35, createdAt: TIMESTAMP }];
  data.wishes = [{ id: 'manual-wish', name: '既有願望', status: 'pending', createdAt: TIMESTAMP }];
  localStorage.setItem(DATA_KEY, JSON.stringify({ data, revision: 5, updatedAt: TIMESTAMP }));
  const first = new InventoryStore();
  await first.init();
  assert.equal(first.data.drinks.length, 40);
  assert.equal(first.data.catalogVersion, 4);
  assert.equal(first.data.drinks[0].stock, 35);
  assert.equal(first.data.drinks[0].active, false);
  assert.deepEqual(first.data.events, data.events);
  assert.deepEqual(first.data.wishes, data.wishes);
  assert.equal(first.revision, 6);
  const second = new InventoryStore();
  await second.init();
  assert.equal(second.revision, 6);
  assert.deepEqual(second.data, first.data);
});

test('stored version-two catalog adds historical products once without changing existing user records', async (t) => {
  setup(t);
  const data = createCompanyData();
  data.catalogVersion = 2;
  data.drinks = data.drinks.slice(0, 32);
  data.drinks[0].stock = 18;
  data.drinks[0].lastCountAt = TIMESTAMP;
  data.events = [{ id: 'existing-count', type: 'count', drinkId: data.drinks[0].id, quantity: 18, createdAt: TIMESTAMP }];
  data.wishes = [{ id: 'existing-wish', name: '既有願望', votes: 2, voterIds: ['visitor-1', 'visitor-2'], status: 'pending', createdAt: TIMESTAMP }];
  localStorage.setItem(DATA_KEY, JSON.stringify({ data, revision: 9, updatedAt: TIMESTAMP }));
  const first = new InventoryStore();
  await first.init();
  assert.equal(first.revision, 10);
  assert.equal(first.data.catalogVersion, 4);
  assert.deepEqual(first.data.drinks.slice(0, 32), data.drinks);
  assert.deepEqual(first.data.drinks.slice(32).map((drink) => [drink.name, drink.active]), [
    ['愛之味純濃燕麥', false], ['光泉燕麥奶', false], ['雪碧', false],
    ['紅牌蜂蜜奶茶', false], ['立頓蜂蜜紅茶', false], ['蘋果西打', false], ['克寧草莓優酪乳', false], ['愛之味麥仔茶', false],
  ]);
  assert.deepEqual(first.data.events, data.events);
  assert.deepEqual(first.data.wishes, data.wishes);
  const second = new InventoryStore();
  await second.init();
  assert.equal(second.revision, 10);
  assert.deepEqual(second.data, first.data);
});

test('stored version-three catalog retains prior archives and appends five newly stopped drinks once', async (t) => {
  setup(t);
  const data = createCompanyData();
  data.catalogVersion = 3;
  data.drinks = data.drinks.slice(0, 35);
  Object.assign(data.drinks[32], { active: true, stock: 4, name: '重新採購的純濃燕麥', lastCountAt: TIMESTAMP });
  data.events = [{ id: 'archive-count', type: 'count', drinkId: data.drinks[32].id, quantity: 4, createdAt: TIMESTAMP }];
  data.wishes = [{ id: 'archive-wish', name: '再買燕麥', status: 'purchased', votes: 2 }];
  localStorage.setItem(DATA_KEY, JSON.stringify({ data, revision: 12, updatedAt: TIMESTAMP }));
  const first = new InventoryStore();
  await first.init();
  assert.equal(first.revision, 13);
  assert.equal(first.data.catalogVersion, 4);
  assert.deepEqual(first.data.drinks.slice(0, 35), data.drinks);
  assert.deepEqual(first.data.drinks.slice(35).map((drink) => [drink.name, drink.active]), [
    ['紅牌蜂蜜奶茶', false], ['立頓蜂蜜紅茶', false], ['蘋果西打', false], ['克寧草莓優酪乳', false], ['愛之味麥仔茶', false],
  ]);
  assert.deepEqual(first.data.events, data.events);
  assert.deepEqual(first.data.wishes, data.wishes);
  const second = new InventoryStore();
  await second.init();
  assert.equal(second.revision, 13);
  assert.deepEqual(second.data, first.data);
});

test('named demo votes count once per browser and preserve inventory and wish details', async (t) => {
  const calls = setup(t);
  const store = new InventoryStore();
  await store.init();
  assert.equal(store.canManage, true);
  await store.submitWish({ name: '想喝的茶', note: '下午補給', url: 'https://example.com/tea' });
  await store.submitWish({ name: '想喝的咖啡' });
  store.preview = true;
  const firstId = store.data.wishes[0].id;
  const secondId = store.data.wishes[1].id;
  const before = structuredClone(store.data);
  assert.equal(store.canEdit, false);
  assert.equal(store.hasVoted(firstId), false);
  assert.equal(localStorage.getItem('holdwin-wish-voter-v1'), null, 'rendering vote state does not create an identity');
  await store.voteWish(firstId, '測試同事');
  assert.equal(store.data.wishes[0].votes, 1);
  assert.equal(store.hasVoted(firstId), true);
  assert.equal(store.hasVoted(secondId), false);
  const voterId = localStorage.getItem('holdwin-wish-voter-v1');
  assert.ok(voterId);
  assert.deepEqual(store.data.wishes[0].voterIds, [voterId]);
  assert.deepEqual(store.data.drinks, before.drinks);
  assert.deepEqual(store.data.events, before.events);
  assert.deepEqual(store.data.wishes[0], { ...before.wishes[0], votes: 1, voterIds: [voterId], voterNames: { [voterId]: '測試同事' } });
  const revision = store.revision;
  await store.voteWish(firstId, '測試同事');
  assert.equal(store.revision, revision, 'a repeated click performs no write');
  const reopened = new InventoryStore();
  await reopened.init();
  assert.equal(reopened.hasVoted(firstId), true);
  await reopened.voteWish(firstId, '測試同事');
  assert.equal(reopened.data.wishes[0].votes, 1);
  await reopened.voteWish(secondId, '測試同事');
  assert.equal(reopened.data.wishes[1].votes, 1);
  assert.equal(reopened.data.wishes[0].votes, 1);
  assert.equal(localStorage.getItem('holdwin-wish-voter-v1'), voterId);
  assert.equal(calls.length, 0);
});

test('votes reject missing wishes and stale tabs without overwriting another change', async (t) => {
  setup(t);
  const store = new InventoryStore();
  await store.init();
  await store.submitWish({ name: '氣泡水' });
  const wishId = store.data.wishes[0].id;
  const stale = new InventoryStore();
  await stale.init();
  const before = localStorage.getItem(DATA_KEY);
  await assert.rejects(store.voteWish('missing', '測試同事'), /找不到這個願望/);
  assert.equal(localStorage.getItem(DATA_KEY), before);
  await store.voteWish(wishId, '測試同事');
  await assert.rejects(stale.voteWish(wishId, '測試同事'), /另一個分頁/);
  assert.equal(stale.data.wishes[0].votes, 0);
  assert.equal(JSON.parse(localStorage.getItem(DATA_KEY)).data.wishes[0].votes, 1);
  await stale.read();
  await stale.voteWish(wishId, '測試同事');
  assert.equal(stale.data.wishes[0].votes, 1);
});

test('unsupported shared voting never writes local fallback data', async (t) => {
  setup(t, [{ path: READ_PATH, result: row() }]);
  const store = new InventoryStore(CONFIG);
  await store.init();
  assert.equal(store.canManage, false);
  await assert.rejects(store.voteWish('wish-1', '測試同事'), /尚未啟用贊同/);
  assert.equal(localStorage.getItem(DATA_KEY), null);
  assert.equal(localStorage.getItem('holdwin-wish-voter-v1'), null);
});

test('new stock records require a recorder while older history remains valid', async (t) => {
  setup(t);
  const data = createCompanyData();
  data.events.push({ id: 'old-count', type: 'count', drinkId: data.drinks[0].id, quantity: 20, createdAt: TIMESTAMP });
  localStorage.setItem(DATA_KEY, JSON.stringify({ data, revision: 0, updatedAt: TIMESTAMP }));
  const store = new InventoryStore();
  await store.init();
  await store.save(structuredClone(store.data));
  const before = localStorage.getItem(DATA_KEY);
  for (const recorder of [undefined, '', '  ', 5, '人'.repeat(81)]) {
    const next = structuredClone(store.data);
    next.events.push({ id: 'new-arrival', type: 'restock', drinkId: data.drinks[0].id, quantity: 12, createdAt: TIMESTAMP, recorder });
    await assert.rejects(store.save(next), /請填寫登記人/);
    assert.equal(localStorage.getItem(DATA_KEY), before);
  }
  const next = structuredClone(store.data);
  next.events.push({ id: 'new-arrival', type: 'restock', drinkId: data.drinks[0].id, quantity: 12, createdAt: TIMESTAMP, recorder: '茶水間同事' });
  await store.save(next);
  assert.equal(store.data.events.at(-1).recorder, '茶水間同事');
  assert.deepEqual(store.data.events[0], data.events[0]);
});

test('blocked voter storage fails clearly without incrementing the vote', async (t) => {
  setup(t);
  const store = new InventoryStore();
  await store.init();
  await store.submitWish({ name: '果汁' });
  const wishId = store.data.wishes[0].id;
  const before = localStorage.getItem(DATA_KEY);
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = (key, value) => {
    if (key === 'holdwin-wish-voter-v1') throw new Error('storage blocked');
    return originalSetItem(key, value);
  };
  await assert.rejects(store.voteWish(wishId, '測試同事'), /無法儲存此瀏覽器的贊同紀錄/);
  assert.equal(localStorage.getItem(DATA_KEY), before);
  assert.equal(store.data.wishes[0].votes, 0);
});


test('drink and snack wishes remain separate and anonymous while legacy wishes stay intact', async (t) => {
  setup(t);
  const data = createCompanyData();
  const legacy = { id: 'legacy-drink', name: '舊飲料願望', status: 'pending', createdAt: TIMESTAMP, votes: 2, voterIds: ['legacy-browser'] };
  data.wishes = [legacy];
  localStorage.setItem(DATA_KEY, JSON.stringify({ data, revision: 0, updatedAt: TIMESTAMP }));
  const store = new InventoryStore();
  await store.init();
  const before = structuredClone(store.data);
  await store.submitWish({ name: '氣泡茶', kind: 'drink', requesterName: '不接受許願者姓名' });
  await store.submitWish({ name: '蘇打餅乾', kind: 'snack', requesterName: '不接受許願者姓名' });
  assert.deepEqual(store.data.wishes[0], legacy);
  assert.equal(store.data.wishes[1].kind, 'drink');
  assert.equal(store.data.wishes[2].kind, 'snack');
  assert.equal(store.data.wishes[1].requesterName, undefined);
  assert.equal(store.data.wishes[2].requesterName, undefined);
  assert.deepEqual(store.data.drinks, before.drinks);
  assert.deepEqual(store.data.events, before.events);
  const saved = localStorage.getItem(DATA_KEY);
  await assert.rejects(store.submitWish({ name: '無效分類', kind: 'other' }), /飲料許願或零食許願/);
  assert.equal(localStorage.getItem(DATA_KEY), saved);
});

test('vote names are required before writing or creating a browser token and are retained for the support list', async (t) => {
  setup(t);
  const store = new InventoryStore();
  await store.init();
  await store.submitWish({ name: '餅乾', kind: 'snack' });
  const wishId = store.data.wishes[0].id;
  const before = localStorage.getItem(DATA_KEY);
  for (const name of [undefined, null, '', '  ', 7, '名'.repeat(81)]) {
    await assert.rejects(store.voteWish(wishId, name), /請填寫姓名/);
    assert.equal(localStorage.getItem(DATA_KEY), before);
    assert.equal(localStorage.getItem('holdwin-wish-voter-v1'), null);
  }
  await store.voteWish(wishId, '  小陳  ');
  const token = localStorage.getItem('holdwin-wish-voter-v1');
  assert.equal(store.data.wishes[0].votes, 1);
  assert.deepEqual(store.data.wishes[0].voterNames, { [token]: '小陳' });
  const revision = store.revision;
  await store.voteWish(wishId, '另一個姓名');
  assert.equal(store.revision, revision);
  assert.equal(store.data.wishes[0].votes, 1);
  assert.deepEqual(store.data.wishes[0].voterNames, { [token]: '小陳' });
});

test('quick drink creation uses a stable new identity and leaves stock history and wishes unchanged', async (t) => {
  setup(t);
  const store = new InventoryStore();
  await store.init();
  await store.submitWish({ name: '想吃的點心', kind: 'snack' });
  const before = structuredClone(store.data);
  const started = Date.now();
  const drink = await store.addDrink({ name: ' 新口味無糖茶 ', category: '茶飲', packaging: '寶特瓶', recorder: ' 小王 ', id: 'injected', stock: 99, lastCountAt: TIMESTAMP, active: false, perCase: 24 });
  assert.match(drink.id, /^custom-drink-/);
  assert.notEqual(drink.id, 'injected');
  assert.equal(drink.name, '新口味無糖茶');
  assert.equal(drink.createdBy, '小王');
  assert.ok(Date.parse(drink.createdAt) >= started && Date.parse(drink.createdAt) <= Date.now());
  assert.deepEqual({ unit: drink.unit, active: drink.active, stock: drink.stock, perCase: drink.perCase, threshold: drink.threshold, target: drink.target, lastCountAt: drink.lastCountAt }, { unit: '瓶', active: true, stock: 0, perCase: null, threshold: 10, target: null, lastCountAt: null });
  assert.deepEqual(store.data.drinks.slice(0, -1), before.drinks);
  assert.deepEqual(store.data.events, before.events);
  assert.deepEqual(store.data.wishes, before.wishes);
  assert.equal(store.data.lastInventoryAt, before.lastInventoryAt);
  const reopened = new InventoryStore();
  await reopened.init();
  assert.deepEqual(reopened.data.drinks.at(-1), drink);
  for (const [packaging, unit] of [['鐵罐', '罐'], ['長鐵罐', '罐'], ['大瓶裝', '瓶'], ['窄瓶鋁箔包', '包'], ['其他', '包']]) {
    assert.equal((await reopened.addDrink({ name: `新增${packaging}`, category: '其他', packaging, recorder: '小王' })).unit, unit);
  }
});

test('quick drink validation blocks duplicates, invalid fields, and public writes before changing storage', async (t) => {
  setup(t);
  const store = new InventoryStore();
  await store.init();
  const value = { name: '新飲料', category: '茶飲', packaging: '鋁箔包', recorder: '小王' };
  await store.addDrink({ ...value, name: 'ＴＥＡ' });
  const before = localStorage.getItem(DATA_KEY);
  const revision = store.revision;
  for (const invalid of [
    { name: '' }, { name: ' ' }, { name: 'a'.repeat(81) }, { recorder: '' }, { recorder: ' ' }, { recorder: 'a'.repeat(81) },
    { category: 'admin' }, { packaging: 'free-form' }, { name: ' tea ' }, { name: '光泉牛乳' }, { name: '愛之味純濃燕麥' },
  ]) await assert.rejects(store.addDrink({ ...value, ...invalid }));
  assert.equal(localStorage.getItem(DATA_KEY), before);
  assert.equal(store.revision, revision);
  store.preview = true;
  await assert.rejects(store.addDrink(value), /管理入口/);
  assert.equal(localStorage.getItem(DATA_KEY), before);
});

test('quick drink creation cannot overwrite a concurrent product or older inventory changes', async (t) => {
  setup(t);
  const first = new InventoryStore(); await first.init();
  const stale = new InventoryStore(); await stale.init();
  const value = { category: '茶飲', packaging: '鋁箔包', recorder: '小王' };
  await first.addDrink({ ...value, name: '先新增的茶' });
  const before = localStorage.getItem(DATA_KEY);
  await assert.rejects(stale.addDrink({ ...value, name: '過期分頁的茶' }), /另一個分頁/);
  assert.equal(localStorage.getItem(DATA_KEY), before);
  assert.equal(stale.data.drinks.length, 40);
});
