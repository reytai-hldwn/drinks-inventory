import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { COMPANY_CATALOG, CATEGORIES_ORDER } from '../js/catalog.js';
import test from 'node:test';
import { createHash } from 'node:crypto';
function backend() {
  const props = new Map();
  const properties = { getProperty: key => props.get(key) ?? null, setProperty(key, value) { props.set(key, value); return this; } };
  const ctx = vm.createContext({ console, Date, JSON, Number, PropertiesService: { getScriptProperties: () => properties }, Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (algorithm, value, charset) => [...createHash(algorithm).update(value, charset).digest()],
  } });
  return readFile(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8').then(code => { vm.runInContext(code, ctx); return { ctx, props }; });
}
const plain = value => JSON.parse(JSON.stringify(value));
const expectedArchiveNames = ['愛之味純濃燕麥', '光泉燕麥奶', '雪碧', '紅牌蜂蜜奶茶', '立頓蜂蜜紅茶', '蘋果西打', '克寧草莓優酪乳', '愛之味麥仔茶'];
function response(id, answers, time = '2026-10-03T00:00:00Z') {
  return { getId: () => id, getTimestamp: () => new Date(time), getItemResponses: () => Object.entries(answers).map(([key, value]) => ({ getItem: () => ({ getId: () => Number(key) }), getResponse: () => value })) };
}
function memorySheet(rows = []) {
  return { rows, getLastRow: () => rows.length, getSheetId: () => 7, setFrozenRows() {}, setColumnWidth() {},
    getRange(row, column, count = 1, columns = 1) {
      const range = new Proxy({
        getValues: () => Array.from({ length: count }, (_, offset) => Array.from({ length: columns }, (_, col) => rows[row - 1 + offset]?.[column - 1 + col] ?? '')),
        setValues(values) { values.forEach((valuesRow, offset) => { rows[row - 1 + offset] ||= []; valuesRow.forEach((value, col) => { rows[row - 1 + offset][column - 1 + col] = value; }); }); return range; },
        setValue(value) { rows[row - 1] ||= []; rows[row - 1][column - 1] = value; return range; },
      }, { get: (target, property) => property in target ? target[property] : () => range });
      return range;
    },
  };
}

test('anonymous stocktake and arrival require recorder and validate whole counts before intake', async () => {
  const { ctx, props } = await backend();
  const catalog = [{ id: 'tea', name: '茶', active: true }, { id: 'water', name: '水', active: true }, { id: 'old-tea', name: '舊茶', active: false }];
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ count: { 1: 'tea', 2: 'water' }, countRecorder: '3', arrivalRecorder: '4', arrivalDrink: '5', arrivalQuantity: '6', arrivalNote: '7' }));
  ctx.forms_ = () => ({ stocktake: { getResponses: () => [
    response('count1', { 1: '20', 2: '0', 3: '小王' }, '2026-10-02T00:00:00Z'),
    response('missing-name', { 1: '99', 2: '1' }),
    response('invalid-count', { 1: '99', 2: '1.5', 3: '小陳' }),
    response('bad-name', { 1: '99', 2: '1', 3: 'a'.repeat(81) }),
  ] }, arrival: { getResponses: () => [
    response('arrival1', { 4: '小李', 5: 'tea｜茶', 6: '12', 7: '今天到貨' }),
    response('missing-arrival-name', { 5: 'tea｜茶', 6: '99' }),
    response('unknown-drink', { 4: '小李', 5: 'unknown｜未知', 6: '3' }),
    response('zero-arrival', { 4: '小李', 5: 'tea｜茶', 6: '0' }),
    response('archived-arrival', { 4: '小李', 5: 'old-tea｜舊茶', 6: '3' }),
  ] } });
  const events = ctx.intakeEvents_(catalog);
  const accepted = events.filter(event => event.accepted);
  assert.equal(accepted.length, 3);
  assert.equal(events.filter(event => !event.accepted).length, 7);
  assert.ok(accepted.every(event => event.drinkId !== 'old-tea'));
  assert.deepEqual(plain(accepted.map(event => event.recorder)), ['小王', '小王', '小李']);
  assert.equal(ctx.computeInventory_(catalog, events)[0].stock, 32);
  assert.equal(ctx.computeInventory_(catalog, events)[1].stock, 0);
  assert.equal(ctx.computeInventory_(catalog, [{ id: 'a', drinkId: 'tea', type: 'restock', quantity: 5, accepted: true, createdAt: '2026-10-04T00:00:00Z' }])[0].stock, 5);
  const seen = Object.fromEntries(events.map(event => [event.id.slice(0, event.id.lastIndexOf(':')), true]));
  assert.deepEqual(plain(ctx.intakeEvents_(catalog, seen)), []);
  ctx.ADMIN_EMAILS = []; assert.doesNotThrow(() => ctx.setupConfig());
  ctx.ADMIN_EMAILS = ['owner@example.com', 'OWNER@example.com']; assert.throws(() => ctx.setupConfig(), /不可重複/);
});

test('public fridge omits stocks while anonymous warehouse exposes only accepted events and recorder names', async () => {
  const { ctx, props } = await backend();
  assert.equal(ctx.INITIAL_CATALOG.length, 40);
  assert.deepEqual(plain(ctx.INITIAL_CATALOG.map(drink => drink.name)), COMPANY_CATALOG.map(drink => drink.name));
  assert.equal(ctx.INITIAL_CATALOG.filter(drink => drink.active !== false).length, 32);
  assert.deepEqual(plain(ctx.INITIAL_CATALOG.filter(drink => drink.active === false).map(drink => drink.name)), expectedArchiveNames);
  assert.ok(ctx.INITIAL_CATALOG.every(drink => !('stock' in drink)));
  const sheets = {
    Catalog: memorySheet([['id', 'name', 'category', 'packaging', 'unit', 'perCase', 'threshold', 'active'], ['tea', '茶', '茶飲', '鋁箔包', '包', '', 10, true],
      ...COMPANY_CATALOG.filter(drink => drink.active === false).map(drink => [drink.id, drink.name, drink.category, drink.packaging, drink.unit, '', 10, false])]),
    WishReview: memorySheet([['id', 'name', 'url', 'note', 'status', 'createdAt'], ['wish-one', '新飲料', 'https://example.com', '', 'pending', '2026-10-01T00:00:00Z']]),
    WishVotes: memorySheet([['id', 'wish', 'voter', 'date', 'status', 'name'], ['vote1', 'wish-one', 'browser-1234567890123456', '2026-10-02T00:00:00Z', '採計', 'private-voter-name']]),
    ProductIntake: memorySheet([['response', 'time', 'product', 'name', 'category', 'packaging', 'recorder', 'status'], ['private-response-id', '2026-10-02T00:00:00Z', 'tea', '茶', '茶飲', '鋁箔包', 'private-product-recorder', '採計']]),
    History: memorySheet([['id', 'time', 'type', 'drink', 'name', 'quantity', 'note', 'recorder', 'status'],
      ['c1', '2026-10-02T00:00:00Z', 'count', 'tea', '茶', 10, '實盤', 'private@example.com', '採計'],
      ['a1', '2026-10-03T00:00:00Z', 'restock', 'tea', '茶', 2, '實收', '小王', '採計'],
      ['bad', '2026-10-04T00:00:00Z', 'rejected', '', '', '', 'bad', 'private@example.com', '未採計']]),
    Warehouse: memorySheet(),
  };
  const ss = { getSheetByName: name => sheets[name], getUrl: () => 'https://docs.google.com/spreadsheets/d/privateSheet/edit' };
  ctx.requiredSpreadsheet_ = () => ss;
  ctx.forms_ = () => Object.fromEntries(['wish', 'stocktake', 'arrival', 'vote', 'product'].map(kind => [kind, { getPublishedUrl: () => `https://docs.google.com/forms/d/e/${kind}/viewform` }]));
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ voteWishEntry: '123', voteVoterEntry: '456', voteNameEntry: '789', wishKindEntry: '987' }));
  const front = ctx.publicData_();
  assert.equal(front.wishes[0].votes, 1);
  assert.equal(front.wishes[0].kind, 'drink');
  assert.equal(front.drinks[0].stock, undefined);
  assert.equal(front.events, undefined);
  assert.deepEqual(plain(front.drinks.filter(drink => !drink.active).map(drink => drink.name)), expectedArchiveNames);
  assert.equal(JSON.stringify(front).includes('browser-1234567890123456'), false);
  assert.deepEqual(plain(front.wishes[0].supporters), ['private-voter-name']);
  assert.equal(JSON.stringify(front).includes('private-product-recorder'), false);
  assert.equal(JSON.stringify(front).includes('private-response-id'), false);
  assert.equal(front.formUrls.product, 'https://docs.google.com/forms/d/e/product/viewform');
  assert.deepEqual(plain(front.wishForm), { url: 'https://docs.google.com/forms/d/e/wish/viewform', kindEntryId: '987' });
  const warehouse = ctx.warehouseData_();
  assert.equal(warehouse.drinks[0].stock, 12);
  assert.equal(warehouse.drinks[0].lastCountAt, '2026-10-02T00:00:00.000Z');
  assert.equal(warehouse.events.length, 2);
  assert.deepEqual(plain(warehouse.events.map(event => event.recorder)), ['先前管理者', '小王']);
  assert.equal(warehouse.lastInventoryAt, '2026-10-02T00:00:00.000Z');
  assert.equal(JSON.stringify(warehouse).includes('private@example.com'), false);
  assert.equal(warehouse.events[0].email, undefined);
  assert.deepEqual(plain(front.voteForm), { url: 'https://docs.google.com/forms/d/e/vote/viewform', wishEntryId: '123', voterEntryId: '456', voterNameEntryId: '789' });
  ctx.ContentService = { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: body => ({ body, setMimeType(type) { this.type = type; return this; } }) };
  assert.equal(JSON.parse(ctx.doGet({ parameter: { action: 'warehouse' } }).body).drinks[0].stock, 12);
  assert.deepEqual(JSON.parse(ctx.doGet({ parameter: { action: 'write' } }).body), { ok: false, error: 'unsupported_action' });
  assert.deepEqual(JSON.parse(ctx.doGet({ parameter: { callback: 'alert(1)//' } }).body), { ok: false, error: 'invalid_callback' });
  assert.match(ctx.doGet({ parameter: { callback: 'safeCallback' } }).body, /^safeCallback\(/);
});

test('wish votes deduplicate browser/wish pairs and reject invalid references without changing wishes or inventory', async () => {
  const { ctx, props } = await backend();
  const wishSheet = memorySheet([['id', 'name', 'url', 'note', 'status', 'createdAt'], ['wish-one', '新飲料', '', '喜歡', 'purchased', '2026-10-01T00:00:00Z']]);
  const voteSheet = memorySheet([['id', 'wish', 'voter', 'date', 'status']]);
  const sheets = { WishReview: wishSheet, WishVotes: voteSheet };
  const ss = { getSheetByName: name => sheets[name] };
  const beforeWish = structuredClone(wishSheet.rows);
  const voters = ['browser-1234567890123456', 'browser-9876543210987654'];
  const answers = (wish, voter, name = '小王') => ({ 11: wish, 12: voter, 13: name });
  const responses = [response('v1', answers('wish-one', voters[0])), response('v2', answers('wish-one', voters[0])), response('v3', answers('wish-one', voters[1])), response('v4', answers('wish-unknown', voters[1])), response('v5', answers('wish-one', 'short'))];
  props.set('HOLDWIN_VOTE_FORM_ID', 'vote');
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ voteWish: '11', voteVoter: '12', voteName: '13' }));
  ctx.FormApp = { openById: () => ({ getResponses: () => responses }) };
  ctx.syncVotes_(ss);
  assert.equal(voteSheet.rows.length, 6);
  assert.equal(ctx.voteCounts_(ss)['wish-one'], 2);
  assert.equal(ctx.voteCounts_(ss)['wish-unknown'], undefined);
  assert.equal(voteSheet.rows.filter(row => row[4] === '採計').length, 2);
  assert.deepEqual(wishSheet.rows, beforeWish);
  ctx.syncVotes_(ss);
  assert.equal(voteSheet.rows.length, 6);
  assert.equal(ctx.voteCounts_(ss)['wish-one'], 2);
  // Counting also ignores duplicate ledger pairs if a row was accidentally copied.
  voteSheet.rows.push([...voteSheet.rows[1]]);
  assert.equal(ctx.voteCounts_(ss)['wish-one'], 2);
});

test('new votes need a valid name while prior accepted anonymous votes remain counted', async () => {
  const { ctx, props } = await backend();
  const original = ['old-vote', 'wish-one', 'legacy-browser-12345678', '2026-10-01T00:00:00Z', '採計'];
  const voteSheet = memorySheet([['id', 'wish', 'voter', 'date', 'status'], [...original]]);
  const wishSheet = memorySheet([['id', 'name', 'url', 'note', 'status', 'createdAt'], ['wish-one', '餅乾', '', '', 'pending', '2026-10-01T00:00:00Z', 'snack']]);
  const ss = { getSheetByName: name => ({ WishReview: wishSheet, WishVotes: voteSheet })[name] };
  props.set('HOLDWIN_VOTE_FORM_ID', 'vote');
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ voteWish: '11', voteVoter: '12', voteName: '13' }));
  const answers = (voter, name) => ({ 11: 'wish-one', 12: voter, 13: name });
  const responses = [
    response('missing', answers('browser-missing-12345678', '')),
    response('spaces', answers('browser-spaces-12345678', '   ')),
    response('long', answers('browser-long-1234567890', 'x'.repeat(81))),
    response('valid', answers('browser-valid-12345678', ' 小王 ')),
    response('duplicate', answers('browser-valid-12345678', '小李')),
  ];
  ctx.FormApp = { openById: () => ({ getResponses: () => responses }) };
  ctx.syncVotes_(ss);
  assert.deepEqual(voteSheet.rows[1], original);
  assert.equal(ctx.voteCounts_(ss)['wish-one'], 2);
  assert.equal(voteSheet.rows.find(row => row[0] === 'valid')[5], '小王');
  assert.ok(voteSheet.rows.filter(row => ['missing', 'spaces', 'long'].includes(row[0])).every(row => row[4] === '未採計：請填有效姓名'));
  assert.equal(voteSheet.rows.find(row => row[0] === 'duplicate')[4], '未採計：重複贊同');
  const before = structuredClone(voteSheet.rows);
  ctx.syncVotes_(ss);
  assert.deepEqual(voteSheet.rows, before);
});

test('public vote summaries show accepted names once per browser pair while keeping unnamed old votes', async () => {
  const { ctx } = await backend();
  const sheet = memorySheet([
    ['id', 'wish', 'voter', 'date', 'status', 'name'],
    ['one', 'wish-one', 'browser-1234567890123456', '2026-10-02T00:00:00Z', '採計', ' 小王 '],
    ['copied', 'wish-one', 'browser-1234567890123456', '2026-10-02T00:00:00Z', '採計', '重複列不可顯示'],
    ['legacy', 'wish-one', 'browser-9876543210987654', '2026-10-02T00:00:00Z', '採計', ''],
    ['rejected', 'wish-one', 'browser-rejected-123456', '2026-10-02T00:00:00Z', '未採計', '不可顯示'],
    ['other', 'wish-other', 'browser-1234567890123456', '2026-10-02T00:00:00Z', '採計', '小王'],
  ]);
  const before = structuredClone(sheet.rows);
  const result = plain(ctx.voteSummary_({ getSheetByName: () => sheet }));
  assert.deepEqual(result, { counts: { 'wish-one': 2, 'wish-other': 1 }, names: { 'wish-one': ['小王'], 'wish-other': ['小王'] } });
  assert.doesNotMatch(JSON.stringify(result), /browser-|rejected|重複列/);
  assert.deepEqual(sheet.rows, before);
});

test('anonymous wishes append a separate kind and keep old wishes and response IDs intact', async () => {
  const { ctx, props } = await backend();
  const old = ['wish-old', '原本飲料', '', '', 'purchased', '2026-10-01T00:00:00Z'];
  const wishSheet = memorySheet([['id', 'name', 'url', 'note', 'status', 'createdAt'], [...old]]);
  const ss = { getSheetByName: () => wishSheet };
  props.set('HOLDWIN_WISH_FORM_ID', 'wish');
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ wishName: '1', wishUrl: '2', wishNote: '3', wishKind: '4' }));
  const responses = [response('snack', { 1: '海苔餅乾', 3: '鹹口味', 4: '點心' }), response('snack-new-label', { 1: '海鹽蘇打餅乾', 4: '零食' }), response('drink', { 1: '無糖茶', 4: '飲料' }), response('legacy', { 1: '舊版飲料回應' }), response('bad', { 1: '無效分類', 4: 'admin' })];
  ctx.FormApp = { openById: () => ({ getResponses: () => responses }) };
  ctx.SpreadsheetApp = { newDataValidation: () => ({ requireValueInList() { return this; }, setAllowInvalid() { return this; }, build() { return {}; } }) };
  ctx.syncWishes_(ss);
  assert.deepEqual(wishSheet.rows[1], old);
  const wishes = plain(ctx.wishRows_(ss));
  assert.deepEqual(wishes.map(wish => wish.kind), ['drink', 'snack', 'snack', 'drink', 'drink']);
  assert.equal(wishes.find(wish => wish.id === 'wish-snack').name, '海苔餅乾');
  assert.equal(wishes.find(wish => wish.id === 'wish-snack-new-label').kind, 'snack');
  assert.ok(wishes.every(wish => !('recorder' in wish) && !('voterName' in wish)));
  const before = structuredClone(wishSheet.rows);
  ctx.syncWishes_(ss);
  assert.deepEqual(wishSheet.rows, before);
});

test('Google catalog initialization appends missing products without overwriting existing rows', async () => {
  const code = await readFile(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');
  const rows = COMPANY_CATALOG.slice(0, 29).map((drink) => [drink.id, drink.name, drink.category, drink.packaging, drink.unit, '', 10, true]);
  rows[0][2] = '管理者自訂分類';
  rows[0][5] = 12;
  rows[0][7] = false;
  const before = structuredClone(rows);
  const sheet = {
    getLastRow: () => rows.length + 1,
    setFrozenRows() { return this; },
    getRange(row, column, count = 1, columns = 1) {
      const range = new Proxy({
        getValues: () => rows.slice(row - 2, row - 2 + count).map((item) => item.slice(column - 1, column - 1 + columns)),
        setValues(values) {
          values.forEach((value, index) => { rows[row - 2 + index] = [...value]; });
          return range;
        },
      }, { get(target, property) { return property in target ? target[property] : () => range; } });
      return range;
    },
  };
  const validation = { requireCheckbox() { return this; }, build() { return {}; } };
  const ctx = vm.createContext({ console, Date, JSON, Number, SpreadsheetApp: { newDataValidation: () => validation } });
  vm.runInContext(code, ctx);
  const spreadsheet = { getSheetByName(name) { assert.equal(name, 'Catalog'); return sheet; } };
  ctx.initializeCatalog_(spreadsheet);
  assert.equal(rows.length, 40);
  assert.deepEqual(rows.slice(0, 29), before);
  assert.deepEqual(rows.slice(29).map((row) => row.slice(0, 5)), COMPANY_CATALOG.slice(29).map((drink) => [drink.id, drink.name, drink.category, drink.packaging, drink.unit]));
  assert.ok(rows.slice(29).every((row) => row[5] === 24 && row[6] === 10));
  assert.deepEqual(rows.slice(29).map(row => row[7]), [true, true, true, ...Array(8).fill(false)]);
  const firstRun = structuredClone(rows);
  ctx.initializeCatalog_(spreadsheet);
  assert.deepEqual(rows, firstRun, 'running setup again must neither duplicate nor overwrite products');
  Object.assign(rows.find(row => row[0] === 'company-drink-33'), { 1: '已重新採購的燕麥', 2: '自訂分類', 5: 12, 7: true });
  const reopened = structuredClone(rows);
  ctx.initializeCatalog_(spreadsheet);
  assert.deepEqual(rows, reopened, 'existing archived products may be reopened and customized without setup resetting them');
});


test('Google catalog corrects the known chocolate tea typo without changing user fields', async () => {
  const code = await readFile(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');
  const rows = COMPANY_CATALOG.map((drink) => [drink.id, drink.name, drink.category, drink.packaging, drink.unit, '', 10, true]);
  const old = rows.find((row) => row[0] === 'company-drink-09');
  old[1] = '立頓巧克力牛奶'; old[2] = '牛乳／植物奶'; old[5] = 12; old[7] = false;
  const before = structuredClone(rows);
  const sheet = {
    getLastRow: () => rows.length + 1,
    setFrozenRows() { return this; },
    getRange(row, column, count = 1, columns = 1) {
      const range = new Proxy({
        getValues: () => rows.slice(row - 2, row - 2 + count).map((item) => item.slice(column - 1, column - 1 + columns)),
        setValue(value) { rows[row - 2][column - 1] = value; return range; },
        setValues(values) {
          values.forEach((value, index) => {
            if (!rows[row - 2 + index]) rows[row - 2 + index] = [];
            value.forEach((item, offset) => { rows[row - 2 + index][column - 1 + offset] = item; });
          });
          return range;
        },
      }, { get(target, property) { return property in target ? target[property] : () => range; } });
      return range;
    },
  };
  const validation = { requireCheckbox() { return this; }, build() { return {}; } };
  const ctx = vm.createContext({ console, Date, JSON, Number, SpreadsheetApp: { newDataValidation: () => validation } });
  vm.runInContext(code, ctx);
  const spreadsheet = { getSheetByName: () => sheet };
  ctx.initializeCatalog_(spreadsheet);
  const updated = rows.find((row) => row[0] === 'company-drink-09');
  assert.deepEqual(updated, [before[8][0], '立頓巧克力奶茶', '茶飲', ...before[8].slice(3)]);
  updated[1] = '立頓巧克力牛奶'; updated[2] = '公司自訂分類';
  ctx.initializeCatalog_(spreadsheet);
  const custom = rows.find((row) => row[0] === 'company-drink-09');
  assert.equal(custom[1], '立頓巧克力奶茶');
  assert.equal(custom[2], '公司自訂分類');
});

test('form setup removes account checks, requires recorders and exports real prefill entry IDs', async () => {
  const { ctx, props } = await backend();
  let sequence = 100;
  function form(kind) {
    const result = { kind, items: [], collectEmail: true, accepting: false,
      getItems() { return this.items; },
      getPublishedUrl() { return `https://docs.google.com/forms/d/e/${kind}/viewform`; },
      setTitle(value) { this.title = value; return this; },
      setDescription() { return this; },
      setCollectEmail(value) { this.collectEmail = value; return this; },
      setLimitOneResponsePerUser(value) { this.limitOnce = value; return this; },
      setShowLinkToRespondAgain() { return this; }, setAllowResponseEdits() { return this; },
      setAcceptingResponses(value) { this.accepting = value; return this; },
      createResponse() { let answer; return { withItemResponse(value) { answer = value; return this; }, toPrefilledUrl() { return `${result.getPublishedUrl()}?usp=pp_url&entry.${answer.id + 90000}=${encodeURIComponent(answer.value)}`; } }; },
    };
    function addItem() {
      const item = { id: ++sequence, title: '', getId() { return this.id; }, getTitle() { return this.title; }, setTitle(value) { this.title = value; return this; }, setRequired(value) { this.required = value; return this; }, setValidation() { return this; }, setChoiceValues(values) { this.choices = values; return this; }, asTextItem() { return this; }, asParagraphTextItem() { return this; }, asListItem() { return this; }, createResponse(value) { return { id: this.id, value }; } };
      result.items.push(item); return item;
    }
    result.addTextItem = result.addListItem = result.addParagraphTextItem = addItem;
    return result;
  }
  const forms = Object.fromEntries(['stocktake', 'arrival', 'wish', 'vote', 'product'].map(kind => [kind, form(kind)]));
  const legacyWishName = forms.wish.addTextItem().setTitle('想喝的飲料');
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ wishName: String(legacyWishName.getId()) }));
  for (const [kind, property] of Object.entries({ stocktake: 'HOLDWIN_COUNT_FORM_ID', arrival: 'HOLDWIN_ARRIVAL_FORM_ID', wish: 'HOLDWIN_WISH_FORM_ID', vote: 'HOLDWIN_VOTE_FORM_ID', product: 'HOLDWIN_PRODUCT_FORM_ID' })) props.set(property, kind);
  props.set('HOLDWIN_PRIVATE_FORMS_READY', 'false');
  const validation = () => { const builder = new Proxy({ build: () => ({}) }, { get: (target, key) => key in target ? target[key] : () => builder }); return builder; };
  ctx.FormApp = { openById: id => forms[id], createTextValidation: validation, createParagraphTextValidation: validation };
  ctx.catalog_ = () => COMPANY_CATALOG;
  ctx.configureForms_({});
  const fields = JSON.parse(props.get('HOLDWIN_FORM_FIELDS'));
  assert.equal(fields.wishName, String(legacyWishName.getId()));
  assert.equal(legacyWishName.title, '品項名稱');
  assert.ok(Object.values(forms).every(form => form.collectEmail === false && form.limitOnce === false && form.accepting === true));
  assert.equal(forms.stocktake.items.find(item => item.title === '登記人').required, true);
  assert.equal(forms.arrival.items.find(item => item.title === '登記人').required, true);
  assert.equal(forms.arrival.items.find(item => item.title === '整箱數量').required, false);
  assert.equal(forms.arrival.items.find(item => item.title === '實際到貨數量（單包／瓶／罐）').required, false);
  assert.ok(forms.stocktake.items.filter(item => item.title.includes('（現存')).every(item => !item.required));
  assert.equal(Object.keys(fields.count).length, 32);
  assert.deepEqual(Object.values(fields.count), COMPANY_CATALOG.filter(drink => drink.active !== false).map(drink => drink.id));
  const arrivalChoices = forms.arrival.items.find(item => item.title === '飲料品項').choices;
  assert.equal(arrivalChoices.length, 32);
  assert.ok(COMPANY_CATALOG.filter(drink => drink.active === false).every(drink => !arrivalChoices.some(choice => choice.startsWith(drink.id + '｜'))));
  assert.equal(forms.vote.items.find(item => item.title === '姓名').required, true);
  assert.equal(forms.wish.items.some(item => item.title === '姓名'), false);
  assert.deepEqual(plain(forms.wish.items.find(item => item.title === '許願分類').choices), ['飲料', '零食']);
  assert.equal(fields.voteNameEntry, String(Number(fields.voteName) + 90000));
  assert.equal(fields.wishKindEntry, String(Number(fields.wishKind) + 90000));
  assert.equal(fields.voteWishEntry, String(Number(fields.voteWish) + 90000));
  assert.equal(fields.voteVoterEntry, String(Number(fields.voteVoter) + 90000));
  assert.equal(forms.product.items.find(item => item.title === '飲料名稱').required, true);
  assert.equal(forms.product.items.find(item => item.title === '登記人').required, true);
  assert.deepEqual(plain(forms.product.items.find(item => item.title === '飲料分類').choices), CATEGORIES_ORDER);
  assert.deepEqual(plain(forms.product.items.find(item => item.title === '包裝外觀').choices), plain(ctx.PRODUCT_PACKAGING));
  assert.ok(fields.productName && fields.productCategory && fields.productPackaging && fields.productRecorder);
  assert.notEqual(fields.voteWishEntry, fields.voteWish);
  assert.notEqual(fields.voteVoterEntry, fields.voteVoter);
  const ids = Object.values(forms).flatMap(form => form.items.map(item => item.id));
  ctx.configureForms_({});
  assert.deepEqual(Object.values(forms).flatMap(form => form.items.map(item => item.id)), ids, 'setup rerun must preserve existing questions and their response IDs');
  const custom = { id: 'custom-drink-new', name: '新到的飲料', category: '茶飲', packaging: '寶特瓶', unit: '瓶', active: true };
  ctx.catalog_ = () => [...COMPANY_CATALOG, custom];
  ctx.configureForms_({});
  assert.equal(Object.keys(JSON.parse(props.get('HOLDWIN_FORM_FIELDS')).count).length, 33);
  assert.ok(forms.arrival.items.find(item => item.title === '飲料品項').choices.some(choice => choice.startsWith(custom.id + '｜')));
  assert.ok(forms.stocktake.items.some(item => !item.required && item.title.startsWith(custom.id + '｜')));
});

test('quick product intake is idempotent, validates actual submissions and preserves all inventory history', async () => {
  const { ctx, props } = await backend();
  const oldRow = ['company-drink-old', 'Existing Tea', '茶飲', '鋁箔包', '包', 24, 10, true];
  const catalog = memorySheet([['id', 'name', 'category', 'packaging', 'unit', 'perCase', 'threshold', 'active'], [...oldRow]]);
  const intake = memorySheet([plain(ctx.PRODUCT_INTAKE_HEADERS)]);
  const history = memorySheet([['id', 'date', 'type', 'drink', 'name', 'quantity', 'note', 'recorder', 'status'], ['count-old', '2026-10-01T00:00:00Z', 'count', oldRow[0], oldRow[1], 19, '', '小王', '採計']]);
  const beforeHistory = structuredClone(history.rows);
  const ss = { getSheetByName: name => ({ Catalog: catalog, ProductIntake: intake, History: history })[name] };
  props.set('HOLDWIN_PRODUCT_FORM_ID', 'product');
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ productName: '1', productCategory: '2', productPackaging: '3', productRecorder: '4' }));
  const answers = (name, category = '茶飲', packaging = '寶特瓶', recorder = '小王') => ({ 1: name, 2: category, 3: packaging, 4: recorder });
  const responses = [
    response('new-bottle', answers(' 新飲料 ')), response('duplicate-new', answers('新飲料')),
    response('duplicate-old', answers(' ＥＸＩＳＴＩＮＧ　ＴＥＡ ')),
    response('empty-name', answers('  ')), response('long-name', answers('x'.repeat(81))),
    response('no-recorder', answers('不採計飲料', '茶飲', '寶特瓶', ' ')),
    response('bad-category', answers('不採計分類', '=bad()')), response('bad-packaging', answers('不採計包裝', '茶飲', '=bad()')),
    response('new-can', answers('新汽水', '汽水', '小型鐵罐')), response('new-carton', answers('新牛乳', '牛奶／豆漿', '窄瓶鋁箔包')),
  ];
  ctx.FormApp = { openById: () => ({ getResponses: () => responses }) };
  assert.equal(ctx.syncNewProducts_(ss), 3);
  assert.deepEqual(catalog.rows[1], oldRow);
  assert.equal(catalog.rows.length, 5);
  assert.equal(intake.rows.length, 11);
  const added = plain(ctx.catalog_(ss)).slice(1);
  assert.deepEqual(added.map(drink => drink.unit), ['瓶', '罐', '包']);
  assert.ok(added.every(drink => drink.active && drink.perCase === 24 && drink.threshold === 10));
  assert.ok(added.every(drink => /^custom-drink-[a-f0-9]{64}$/.test(drink.id) && drink.id.length <= 80));
  assert.equal(added[0].name, '新飲料');
  assert.equal(added[2].category, '牛乳／植物奶', 'older product-form category choices normalize before validation');
  assert.equal(catalog.rows[4][2], '牛乳／植物奶');
  assert.equal(intake.rows.filter(row => row[7] === '採計').length, 3);
  assert.equal(intake.rows.find(row => row[0] === 'bad-category')[4], "'=bad()");
  assert.equal(intake.rows.find(row => row[0] === 'bad-packaging')[5], "'=bad()");
  assert.deepEqual(history.rows, beforeHistory);
  const before = structuredClone({ catalog: catalog.rows, intake: intake.rows });
  assert.equal(ctx.syncNewProducts_(ss), 0);
  assert.deepEqual({ catalog: catalog.rows, intake: intake.rows }, before);
  assert.ok(ctx.computeInventory_(plain(ctx.catalog_(ss)), []).slice(1).every(entry => entry.stock === null && entry.lastCountAt === null));
  assert.equal(props.get('HOLDWIN_CATALOG_FORMS_DIRTY'), 'true');
});

test('product submission refresh updates form choices and retries safely if form configuration temporarily fails', async () => {
  const { ctx, props } = await backend();
  const catalog = memorySheet([['id', 'name', 'category', 'packaging', 'unit', 'perCase', 'threshold', 'active']]);
  const intake = memorySheet([plain(ctx.PRODUCT_INTAKE_HEADERS)]);
  const ss = { getSheetByName: name => ({ Catalog: catalog, ProductIntake: intake })[name] };
  props.set('HOLDWIN_PRODUCT_FORM_ID', 'product');
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ productName: '1', productCategory: '2', productPackaging: '3', productRecorder: '4' }));
  ctx.FormApp = { openById: () => ({ getResponses: () => [response('submitted-product', { 1: '現在看到的新茶', 2: '茶飲', 3: '寶特瓶', 4: '登記者' })] }) };
  ctx.requiredSpreadsheet_ = () => ss;
  ctx.historyEvents_ = () => [];
  ctx.intakeEvents_ = () => [];
  ctx.appendHistory_ = ctx.syncWishes_ = ctx.syncVotes_ = () => {};
  let rendered;
  ctx.renderWarehouse_ = (_, value) => { rendered = plain(value); };
  ctx.renderArchive_ = () => {};
  ctx.configureForms_ = () => { throw new Error('temporary form failure'); };
  assert.throws(() => ctx.refreshWarehouse_(), /temporary form failure/);
  assert.equal(catalog.rows.length, 2);
  assert.equal(props.get('HOLDWIN_CATALOG_FORMS_DIRTY'), 'true');
  let configuredIds;
  ctx.configureForms_ = () => { configuredIds = plain(ctx.catalog_(ss)).map(drink => drink.id); };
  ctx.refreshWarehouse_();
  assert.equal(catalog.rows.length, 2, 'retry must not duplicate the submitted product');
  assert.deepEqual(configuredIds, [catalog.rows[1][0]]);
  assert.equal(props.get('HOLDWIN_CATALOG_FORMS_DIRTY'), 'false');
  assert.equal(rendered[0].stock, null);
  assert.equal(rendered[0].lastCountAt, null);
  assert.equal(rendered[0].drink.name, '現在看到的新茶');
});


test('Google arrivals accept cases only, loose only or both and reject missing or invalid quantities', async () => {
  const { ctx, props } = await backend();
  const catalog = [{ id: 'tea', name: '茶', active: true, perCase: 24 }];
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ arrivalRecorder: '1', arrivalDrink: '2', arrivalQuantity: '3', arrivalCases: '4' }));
  const quantities = [['cases', '', '2'], ['loose', '5', ''], ['both', '5', '2'], ['empty', '', ''], ['zero', '0', '0'], ['negative', '3', '-1'], ['fraction', '1.5', '1'], ['overflow', '999999', '1'], ['too-many-cases', '', '10000']];
  ctx.forms_ = () => ({ stocktake: { getResponses: () => [] }, arrival: { getResponses: () => quantities.map(([id, loose, cases]) => response(id, { 1: '小王', 2: 'tea｜茶', 3: loose, 4: cases })) } });
  const events = plain(ctx.intakeEvents_(catalog));
  assert.deepEqual(events.filter(event => event.accepted).map(event => event.quantity), [48, 5, 53]);
  assert.equal(events.filter(event => !event.accepted).length, 6);
});

test('Google partial stocktakes record filled products only, accept zero and reject blank or invalid forms', async () => {
  const { ctx, props } = await backend();
  const catalog = [{ id: 'tea', active: true }, { id: 'water', active: true }];
  props.set('HOLDWIN_FORM_FIELDS', JSON.stringify({ count: { 1: 'tea', 2: 'water' }, countRecorder: '3' }));
  ctx.forms_ = () => ({ stocktake: { getResponses: () => [
    response('partial', { 1: '0', 2: '', 3: '小王' }),
    response('other', { 2: '5', 3: '小李' }),
    response('empty', { 3: '小王' }),
    response('invalid', { 1: '8', 2: '1.5', 3: '小王' }),
  ] }, arrival: { getResponses: () => [] } });
  const events = plain(ctx.intakeEvents_(catalog));
  assert.deepEqual(events.filter(event => event.accepted).map(({ drinkId, quantity }) => ({ drinkId, quantity })), [{ drinkId: 'tea', quantity: 0 }, { drinkId: 'water', quantity: 5 }]);
  assert.equal(events.filter(event => !event.accepted).length, 2);
  const previous = { id: 'old', drinkId: 'water', quantity: 9, type: 'count', accepted: true, createdAt: '2026-10-01T00:00:00Z' };
  const partial = events.find(event => event.drinkId === 'tea');
  assert.equal(ctx.computeInventory_(catalog, [previous, partial])[1].stock, 9);
});

test('Google case-size migration updates only case-size cells once and preserves stock history', async () => {
  const { ctx, props } = await backend();
  const rows = [['id', 'name', 'category', 'packaging', 'unit', 'perCase', 'threshold', 'active'], ['tea', '茶', '茶飲', '鋁箔包', '包', '', 10, true], ['water', '水', '其他', '寶特瓶', '瓶', 6, 10, false]];
  const sheet = memorySheet(rows);
  const before = structuredClone(rows);
  assert.equal(ctx.migrateCaseSizes_({ getSheetByName: () => sheet }), true);
  assert.deepEqual(rows, before.map((row, index) => index ? row.map((value, col) => col === 5 ? 24 : value) : row));
  assert.equal(props.get('HOLDWIN_CASE_SIZE_VERSION'), '1');
  rows[1][5] = 12;
  assert.equal(ctx.migrateCaseSizes_({ getSheetByName: () => sheet }), false);
  assert.equal(rows[1][5], 12);
});


test('Google setup applies owner name corrections without changing quantities or custom product names', async () => {
  const { ctx } = await backend();
  const rows = [['id', 'name', 'category', 'packaging', 'unit', 'perCase', 'threshold', 'active'], ...COMPANY_CATALOG.map(drink => [drink.id, drink.name, drink.category, drink.packaging, drink.unit, 12, 8, drink.active])];
  rows[7][1] = '波利芭樂汁';
  rows[14][1] = '波蜜一日蔬果';
  rows[22][1] = 'Milkiis水蜜桃'; rows[23][1] = 'Miilkis';
  rows.push(['custom', 'Milkiis水蜜桃', '汽水', '長鐵罐', '罐', 6, 5, true]);
  const before = structuredClone(rows);
  const sheet = memorySheet(rows);
  ctx.initializeCatalog_({ getSheetByName: () => sheet });
  assert.deepEqual(rows[7], before[7].map((value, column) => column === 1 ? '波蜜芭樂汁' : value));
  assert.deepEqual(rows[14], before[14].map((value, column) => column === 1 ? '一日蔬果100%蘋果柳橙蔬果汁' : value));
  assert.deepEqual(rows[22], before[22].map((value, column) => column === 1 ? 'Milkis水蜜桃' : value));
  assert.deepEqual(rows[23], before[23].map((value, column) => column === 1 ? 'Milkis' : value));
  assert.deepEqual(rows.at(-1), before.at(-1));
  const saved = structuredClone(rows);
  ctx.initializeCatalog_({ getSheetByName: () => sheet });
  assert.deepEqual(rows, saved);
});
