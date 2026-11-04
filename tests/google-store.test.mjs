import test from 'node:test';
import assert from 'node:assert/strict';
import { blankData } from '../js/domain.js';
import { GoogleInventoryStore, fetchGooglePublicData, normalizeGooglePublicData, validateGoogleScriptUrl } from '../js/google-store.js';

const ENDPOINT = 'https://script.google.com/macros/s/COMPANY_SCRIPT_123/exec';
const WISH_URL = 'https://docs.google.com/forms/d/e/FORM_ID/viewform';
const ADMIN_URL = 'https://docs.google.com/spreadsheets/d/COMPANY_SHEET/edit#gid=0';
const VOTE_URL = 'https://docs.google.com/forms/d/e/VOTE_FORM/viewform';

function payload() {
  return {
    ok: true,
    provider: 'google',
    drinks: [{ id: 'company-drink-01', name: '光泉牛乳', category: '牛乳／植物奶', packaging: '窄瓶鋁箔包', unit: '包', perCase: null, threshold: 10, active: true }],
    wishes: [{ id: 'wish-01', name: '無糖氣泡水', url: 'https://example.com/drink', note: '想要清爽的選擇', status: 'pending', createdAt: '2026-10-30T00:00:00.000Z' }],
    formUrls: { wish: WISH_URL },
    adminUrl: ADMIN_URL,
    updatedAt: '2026-10-30T00:00:00.000Z',
  };
}

function warehousePayload() {
  const value = payload();
  Object.assign(value.drinks[0], { stock: 20, lastCountAt: '2026-10-30T00:00:00.000Z' });
  value.events = [{ id: 'count-01', drinkId: value.drinks[0].id, type: 'count', quantity: 20,
    createdAt: '2026-10-30T00:00:00.000Z', recorder: '小王', note: '第一次盤點' }];
  value.lastInventoryAt = '2026-10-30T00:00:00.000Z';
  value.formUrls.stocktake = 'https://docs.google.com/forms/d/e/COUNT_FORM/viewform';
  value.formUrls.arrival = 'https://docs.google.com/forms/d/e/ARRIVAL_FORM/viewform';
  return value;
}

test('arrival-only drink quantities remain known without inventing a stocktake date',()=>{
 const value=warehousePayload(),drink=value.drinks[0];
 Object.assign(drink,{stock:48,lastCountAt:null,lastArrivalAt:'2026-11-03T08:59:30.001Z'});
 value.events=[{id:'first-arrival',drinkId:drink.id,type:'restock',quantity:48,createdAt:drink.lastArrivalAt}];
 const result=normalizeGooglePublicData(value,{warehouse:true});
 assert.equal(result.data.drinks[0].stock,48);
 assert.equal(result.data.drinks[0].lastCountAt,null);
 assert.equal(result.data.drinks[0].lastArrivalAt,drink.lastArrivalAt);
 assert.equal(result.data.events[0].type,'restock');
});

test('a validated public cache opens immediately, expires, isolates endpoints and never retains warehouse observations', async () => {
  const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  let stamp=Date.parse('2026-11-02T00:00:00Z'),reads=0;
  const options={publicStorage:storage,now:()=>stamp,readPublicData:async(_url,{action})=>{reads++;return action==='warehouse'?warehousePayload():payload();}};
  const first=new GoogleInventoryStore({googleScriptUrl:ENDPOINT},options);await first.init();assert.equal(reads,1);
  await first.readWarehouse();
  const cached=JSON.parse(values.get(`holdwin-public-cache-v1:${ENDPOINT}`));
  assert.equal(cached.payload.drinks[0].stock,0);assert.equal(cached.payload.drinks[0].lastCountAt,null);assert.equal(cached.payload.events,undefined);
  const warm=new GoogleInventoryStore({googleScriptUrl:ENDPOINT},options);await warm.init();
  assert.equal(reads,2,'warm startup does not wait for another read');assert.equal(warm.revalidateOnStart,true);assert.equal(warm.inWarehouse,false);
  assert.equal(warm.data.drinks[0].name,'光泉牛乳');await warm.read();assert.equal(warm.revalidateOnStart,false);
  stamp+=86400001;const expired=new GoogleInventoryStore({googleScriptUrl:ENDPOINT},options);await expired.init();assert.equal(reads,4);
  const other=new GoogleInventoryStore({googleScriptUrl:ENDPOINT.replace('/exec','_OTHER/exec')},options);await other.init();assert.equal(reads,5);
  values.set(`holdwin-public-cache-v1:${ENDPOINT}`,'broken');await new GoogleInventoryStore({googleScriptUrl:ENDPOINT},options).init();assert.equal(reads,6);
});

test('popularity reads are lazy and deduplicated, preserve the public view, and cache only aggregate rates', async () => {
  let reads=0,release;
  const pending=new Promise(resolve=>{release=resolve;});
  const store=new GoogleInventoryStore({googleScriptUrl:ENDPOINT},{readPublicData:async(_url,{action})=>{
    if(action==='public')return payload();reads++;await pending;
    const value=warehousePayload();value.events.push({id:'count-02',drinkId:value.drinks[0].id,type:'count',quantity:6,createdAt:'2026-11-06T00:00:00Z'});return value;
  },now:()=>Date.parse('2026-11-07T00:00:00Z')});
  await store.init();assert.equal(reads,0);const data=store.data,revision=store.revision;
  const one=store.readPopularity(),two=store.readPopularity();assert.equal(reads,1);release();await Promise.all([one,two]);
  assert.equal(store.data,data);assert.equal(store.revision,revision);assert.equal(store.inWarehouse,false);
  assert.equal(store.popularity.rows[0].weeklyRate,14);assert.equal(store.popularity.events,undefined);
  await store.readPopularity();assert.equal(reads,1);
});

test('older calendar-week deployments use weekday observations without retaining warehouse data',async()=>{
 const calls=[],value=warehousePayload();
 Object.assign(value.drinks[0],{stock:15,lastCountAt:'2026-11-09T01:00:00Z'});
 value.events=[{id:'fri',drinkId:value.drinks[0].id,type:'count',quantity:20,createdAt:'2026-11-06T01:00:00Z'},
  {id:'mon',drinkId:value.drinks[0].id,type:'count',quantity:15,createdAt:'2026-11-09T01:00:00Z'}];
 const store=new GoogleInventoryStore({googleScriptUrl:ENDPOINT},{now:()=>Date.parse('2026-11-10T01:00:00Z'),readPublicData:async(_url,{action})=>{calls.push(action);return action==='warehouse'?value:{...payload(),websiteEntry:{version:1,popularityVersion:1}};}});
 await store.init();const publicData=store.data;
 await store.readPopularity();
 assert.deepEqual(calls,['public','warehouse']);
 assert.equal(store.popularity.rows[0].weeklyRate,25);
 assert.equal(store.popularity.rows[0].days,1);
 assert.equal(store.data,publicData);
 assert.equal(store.inWarehouse,false);
 assert.equal(store.data.events.length,0);
 assert.equal(store.popularity.events,undefined);
});

function addVoteForm(value = payload()) {
  value.formUrls.vote = VOTE_URL;
  value.voteForm = { url: VOTE_URL, wishEntryId: '12345', voterEntryId: '67890', voterNameEntryId: '13579' };
  value.wishes[0].votes = 3;
  return value;
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

test('JSONP permits the warehouse read and rejects write or unknown actions before loading scripts', async () => {
  const page = browser();
  const pending = fetchGooglePublicData(ENDPOINT, { ...page, action: 'warehouse' });
  const script = page.children[0];
  assert.equal(new URL(script.src).searchParams.get('action'), 'warehouse');
  page.window[page.callback(script)](warehousePayload());
  assert.equal((await pending).drinks[0].stock, 20);
  for (const action of ['vote', 'save', 'delete', '', 'public&quantity=12']) {
    assert.throws(() => fetchGooglePublicData(ENDPOINT, { ...page, action }), /讀取方式/);
  }
  assert.equal(page.children.length, 0);
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
  Object.assign(raw.wishes[0], { email: 'private@example.com', respondentEmail: 'private@example.com', voterName: 'private-voter-name', voterNames: { secret: 'private-voter-name' } });
  const snapshot = structuredClone(raw);
  const result = normalizeGooglePublicData(raw);
  assert.equal(result.data.drinks[0].active, false);
  assert.equal(result.data.drinks[0].perCase, null);
  assert.equal(result.data.drinks[0].stock, 0);
  assert.equal(result.data.drinks[0].lastCountAt, null);
  assert.deepEqual(result.data.events, []);
  assert.equal(result.data.lastInventoryAt, null);
  assert.doesNotMatch(JSON.stringify(result), /private@example|ownerEmail|adminEmails|respondentEmail|private-voter-name/);
  assert.deepEqual(raw, snapshot, 'normalization does not mutate the endpoint response');
});

test('public supporter names are accepted without exposing raw identities and malformed lists are rejected', () => {
  const raw = payload();
  Object.assign(raw.wishes[0], { votes: 3, supporters: [' 小王 ', '小李'], voterIds: ['private-browser'], voterNames: { secret: 'private-name-map' } });
  const result = normalizeGooglePublicData(raw);
  assert.deepEqual(result.data.wishes[0].supporters, ['小王', '小李']);
  assert.equal(result.data.wishes[0].votes, 3);
  assert.doesNotMatch(JSON.stringify(result), /private-browser|private-name-map/);
  assert.deepEqual(normalizeGooglePublicData(payload()).data.wishes[0].supporters, []);
  for (const supporters of [null, '小王', [''], ['x'.repeat(81)], [123], ['一', '二', '三', '四']]) {
    const wrong = structuredClone(raw);
    wrong.wishes[0].supporters = supporters;
    assert.throws(() => normalizeGooglePublicData(wrong), /贊同名單|贊同姓名/);
  }
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
  assert.equal(store.canManage, true);
  assert.equal(store.inWarehouse, false);
  await assert.rejects(store.login(), /不用登入/);
  await assert.rejects(store.save({ drinks: [] }), /登記人/);
  await assert.rejects(store.submitWish({ name: 'new' }), /更新 Google Apps Script/);
});

test('warehouse normalization includes observed stock and accepted history but excludes identity and private fields', () => {
  const value = warehousePayload();
  value.drinks.push({ ...value.drinks[0], id: 'unobserved', stock: null, lastCountAt: null });
  value.events[0].email = 'private@example.com';
  value.events[0].accepted = true;
  value.isEditor = true;
  value.adminEmails = ['private@example.com'];
  const result = normalizeGooglePublicData(value, { warehouse: true });
  assert.equal(result.data.drinks[0].stock, 20);
  assert.equal(result.data.drinks[0].lastCountAt, value.drinks[0].lastCountAt);
  assert.equal(result.data.drinks[1].stock, null);
  assert.equal(result.data.lastInventoryAt, value.lastInventoryAt);
  assert.deepEqual(result.data.events, [{ id: 'count-01', drinkId: 'company-drink-01', type: 'count', quantity: 20,
    createdAt: '2026-10-30T00:00:00.000Z', recorder: '小王', note: '第一次盤點' }]);
  assert.doesNotMatch(JSON.stringify(result), /private@example|isEditor|accepted|adminEmails/);
  assert.equal(normalizeGooglePublicData(value).data.drinks[0].stock, 0);
  assert.deepEqual(normalizeGooglePublicData(value).data.events, []);
});

test('warehouse rejects malformed stock, event types, quantities, dates and duplicate event IDs', () => {
  const mutate = [
    (value) => { value.drinks[0].stock = '20'; },
    (value) => { value.drinks[0].stock = -1; },
    (value) => { delete value.drinks[0].stock; },
    (value) => { value.drinks[0].lastCountAt = 'invalid'; },
    (value) => { value.events[0].type = 'order'; },
    (value) => { value.events[0].quantity = 1.5; },
    (value) => { value.events[0].accepted = false; },
    (value) => { value.events[0].createdAt = 'invalid'; },
    (value) => { value.events[0].recorder = 'x'.repeat(81); },
    (value) => { value.events.push({ ...value.events[0] }); },
    (value) => { value.events = {}; },
    (value) => { value.lastInventoryAt = 'invalid'; },
  ];
  for (const change of mutate) {
    const value = warehousePayload();
    change(value);
    assert.throws(() => normalizeGooglePublicData(value, { warehouse: true }));
  }
});

test('management reads switch views only after valid responses and never fall back to fictional stock', async () => {
  const actions = [];
  let invalid = false;
  const store = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, {
    readPublicData: async (url, options) => {
      actions.push(options.action);
      return options.action === 'warehouse' ? (invalid ? { ok: false, error: 'unsupported_action' } : warehousePayload()) : payload();
    },
  });
  await store.init();
  const publicData = store.data;
  invalid = true;
  await assert.rejects(store.readWarehouse(), /更新 Code.gs/);
  assert.equal(store.data, publicData);
  assert.equal(store.inWarehouse, false);
  invalid = false;
  await store.readWarehouse();
  assert.equal(store.inWarehouse, true);
  assert.equal(store.data.drinks[0].stock, 20);
  await store.read();
  assert.equal(store.data.drinks[0].stock, 20);
  await store.readPublic();
  assert.equal(store.inWarehouse, false);
  assert.equal(store.data.drinks[0].stock, 0);
  assert.deepEqual(store.data.events, []);
  assert.deepEqual(actions, ['public', 'warehouse', 'warehouse', 'warehouse', 'public']);
});

test('an older warehouse response cannot overwrite a newer public view', async () => {
  let finishWarehouse;
  const store = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, {
    readPublicData: async (url, options) => options.action === 'warehouse'
      ? new Promise(resolve => { finishWarehouse = resolve; }) : payload(),
  });
  await store.init();
  const older = store.readWarehouse();
  await store.readPublic();
  const publicData = store.data;
  finishWarehouse(warehousePayload());
  await older;
  assert.equal(store.data, publicData);
  assert.equal(store.inWarehouse, false);
  assert.deepEqual(store.data.events, []);
});

test('vote metadata accepts only valid counts, distinct numeric entry IDs and a published Google form', () => {
  const value = addVoteForm();
  const result = normalizeGooglePublicData(value);
  assert.equal(result.data.wishes[0].votes, 3);
  assert.deepEqual(result.voteForm, value.voteForm);
  assert.equal(result.formUrls.vote, VOTE_URL);
  assert.equal(normalizeGooglePublicData(payload()).data.wishes[0].votes, 0);
  assert.equal(normalizeGooglePublicData(payload()).voteForm, null);
  for (const invalid of [-1, 1.1, '3', null, Infinity]) {
    const wrong = addVoteForm();
    wrong.wishes[0].votes = invalid;
    assert.throws(() => normalizeGooglePublicData(wrong), /贊同人數/);
  }
  for (const change of [
    (wrong) => { wrong.voteForm.wishEntryId = 'x&entry.other'; },
    (wrong) => { wrong.voteForm.voterEntryId = '12345'; },
    (wrong) => { wrong.voteForm.wishEntryId = 12345; },
    (wrong) => { wrong.voteForm.url = 'https://evil.example/viewform'; },
    (wrong) => { wrong.voteForm.url = 'https://forms.gle/SHORT'; },
    (wrong) => { wrong.voteForm.url = 'https://docs.google.com/forms/d/PRIVATE_FORM/edit'; },
    (wrong) => { wrong.wishes.push({ ...wrong.wishes[0] }); },
  ]) {
    const wrong = addVoteForm();
    change(wrong);
    assert.throws(() => normalizeGooglePublicData(wrong));
  }
});

test('prefilled vote links reuse a browser token and never optimistically increment shared votes', async () => {
  const values = new Map();
  const voteStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let created = 0;
  const options = { voteStorage, createVoterId: () => { created += 1; return 'browser-token-123456789'; }, readPublicData: async () => addVoteForm() };
  const store = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, options);
  await store.init();
  assert.equal(values.size, 0, 'plain reads do not access or create a voting identity');
  for (const name of [undefined, null, '', '  ', 'x'.repeat(81)]) {
    assert.throws(() => store.getVoteUrl('wish-01', name), /姓名/);
  }
  assert.equal(values.size, 0, 'invalid names do not create browser identities');
  const before = structuredClone(store.data);
  const url = new URL(store.getVoteUrl('wish-01', ' 小王 '));
  assert.equal(url.origin, 'https://docs.google.com');
  assert.equal(url.searchParams.get('entry.12345'), 'wish-01');
  assert.equal(url.searchParams.get('entry.67890'), 'browser-token-123456789');
  assert.equal(url.searchParams.get('entry.13579'), '小王');
  assert.equal(url.searchParams.get('usp'), 'pp_url');
  assert.equal(store.getVoteUrl('wish-01', ' 小王 '), url.href);
  const second = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, options);
  await second.init();
  assert.equal(second.getVoteUrl('wish-01', '小王'), url.href);
  assert.equal(created, 1);
  assert.deepEqual(store.data, before);
  assert.throws(() => store.getVoteUrl('unknown'), /找不到/);
  const old = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, { readPublicData: async () => payload() });
  await old.init();
  assert.throws(() => old.getVoteUrl('wish-01', '小王'), /尚未啟用/);
  const blocked = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, {
    readPublicData: async () => addVoteForm(), voteStorage: { getItem() { throw new Error('blocked'); } },
  });
  await blocked.init();
  assert.throws(() => blocked.getVoteUrl('wish-01', '小王'), /儲存瀏覽器資料/);
});

test('separate wish kinds preserve legacy drinks and prefill anonymous drink or snack forms', async () => {
  const raw = payload();
  raw.wishes.push({ ...raw.wishes[0], id: 'wish-snack', kind: 'snack', name: '海苔餅乾' });
  raw.wishForm = { url: WISH_URL, kindEntryId: '24680' };
  const store = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, { readPublicData: async () => raw });
  await store.init();
  assert.deepEqual(store.data.wishes.map(wish => wish.kind), ['drink', 'snack']);
  const before = structuredClone(store.data);
  for (const [kind, label] of [['drink', '飲料'], ['snack', '零食']]) {
    const url = new URL(store.getWishUrl(kind));
    assert.equal(url.searchParams.get('entry.24680'), label);
    assert.equal(url.searchParams.has('姓名'), false);
    assert.equal(url.searchParams.size, 2);
  }
  assert.deepEqual(store.data, before);
  assert.throws(() => store.getWishUrl('inventory'), /飲料許願或零食許願/);
  const wrong = structuredClone(raw);
  wrong.wishes[0].kind = 'unknown';
  assert.throws(() => normalizeGooglePublicData(wrong), /願望分類/);
  for (const kindEntryId of [1234, '', 'x&entry.123']) {
    assert.throws(() => normalizeGooglePublicData({ ...raw, wishForm: { url: WISH_URL, kindEntryId } }), /分類欄位/);
  }
});

test('legacy Google metadata cannot open an unclassified wish or unnamed vote form', async () => {
  const old = addVoteForm();
  delete old.voteForm.voterNameEntryId;
  const store = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, { readPublicData: async () => old });
  await store.init();
  assert.equal(store.voteForm, null);
  assert.equal(store.wishForm, null);
  assert.throws(() => store.getVoteUrl('wish-01', '小王'), /更新 Google/);
  assert.throws(() => store.getWishUrl('snack'), /更新 Google/);
  for (const voterNameEntryId of ['12345', '67890', 123, 'not-an-entry']) {
    const wrong = addVoteForm();
    wrong.voteForm.voterNameEntryId = voterNameEntryId;
    assert.throws(() => normalizeGooglePublicData(wrong), /姓名欄位/);
  }
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

test('quick product forms embed only a published Google form and older deployments remain readable', async () => {
  const value = payload();
  value.formUrls.product = 'https://docs.google.com/forms/d/e/PRODUCT_FORM/viewform?embedded=false';
  const store = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, { readPublicData: async () => value });
  await store.init();
  const before = structuredClone(store.data);
  const url = new URL(store.getProductFormUrl());
  assert.equal(url.hostname, 'docs.google.com');
  assert.equal(url.pathname, '/forms/d/e/PRODUCT_FORM/viewform');
  assert.equal(url.searchParams.get('embedded'), 'true');
  assert.deepEqual(store.data, before, 'Opening the form never invents a saved product');
  assert.equal(store.canEdit, false, 'New product entry does not grant other edit permissions');
  const old = new GoogleInventoryStore({ googleScriptUrl: ENDPOINT }, { readPublicData: async () => payload() });
  await old.init();
  assert.equal(old.formUrls.product, '');
  assert.throws(() => old.getProductFormUrl(), /更新 Google 設定/);
  for (const invalid of ['https://forms.gle/SHORT', 'https://docs.google.com/forms/d/PRIVATE/edit', 'https://evil.example/viewform', 'javascript:alert(1)', 'http://docs.google.com/forms/d/e/PRODUCT_FORM/viewform']) {
    const wrong = payload(); wrong.formUrls.product = invalid;
    assert.throws(() => normalizeGooglePublicData(wrong));
  }
});
