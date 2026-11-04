/**
 * 宏穩茶水間：native website commands + private Sheets, legacy Google Forms, JSONP reads.
 * Paste this complete file into a standalone Google Apps Script project.
 * The initial catalog is generated from js/catalog.js; it contains NO counts.
 */
var ADMIN_EMAILS = []; // 選填：僅供專案擁有人執行私人盤點匯入；日常盤點、入庫不需登入。

var INITIAL_CATALOG = /* GENERATED_CATALOG_START */ [
  {
    "id": "company-drink-01",
    "name": "光泉牛乳",
    "category": "牛乳／植物奶",
    "packaging": "窄瓶鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-02",
    "name": "光泉巧克力牛乳",
    "category": "牛乳／植物奶",
    "packaging": "窄瓶鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-03",
    "name": "光泉薏仁糙米漿",
    "category": "其他",
    "packaging": "窄瓶鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-04",
    "name": "tree top瓶果汁",
    "category": "果汁",
    "packaging": "窄瓶鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-05",
    "name": "光泉柳橙汁",
    "category": "果汁",
    "packaging": "窄瓶鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-06",
    "name": "統一豆漿",
    "category": "牛乳／植物奶",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-07",
    "name": "波蜜芭樂汁",
    "category": "果汁",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-08",
    "name": "立頓原味奶茶",
    "category": "茶飲",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-09",
    "name": "立頓巧克力奶茶",
    "category": "茶飲",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-10",
    "name": "立頓沁香奶綠",
    "category": "茶飲",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-11",
    "name": "日月潭紅茶",
    "category": "茶飲",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-12",
    "name": "十六茶",
    "category": "茶飲",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-13",
    "name": "Fin",
    "category": "其他",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-14",
    "name": "一日蔬果100%蘋果柳橙蔬果汁",
    "category": "果汁",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-15",
    "name": "荔枝氣泡水",
    "category": "汽水",
    "packaging": "鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-16",
    "name": "零卡可口可樂",
    "category": "汽水",
    "packaging": "鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-17",
    "name": "零卡百事可樂",
    "category": "汽水",
    "packaging": "鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-18",
    "name": "八寶粥",
    "category": "其他",
    "packaging": "鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-19",
    "name": "可口可樂",
    "category": "汽水",
    "packaging": "小型鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-20",
    "name": "百事可樂",
    "category": "汽水",
    "packaging": "小型鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-21",
    "name": "黑松沙士",
    "category": "汽水",
    "packaging": "小型鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-22",
    "name": "Milkis水蜜桃",
    "category": "汽水",
    "packaging": "長鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-23",
    "name": "Milkis",
    "category": "汽水",
    "packaging": "長鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-24",
    "name": "Redbull能量飲",
    "category": "其他",
    "packaging": "長鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-25",
    "name": "Vida氣泡飲",
    "category": "汽水",
    "packaging": "長鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-26",
    "name": "蜂蜜燕麥",
    "category": "其他",
    "packaging": "寶特瓶",
    "unit": "瓶"
  },
  {
    "id": "company-drink-27",
    "name": "麥萃麥茶",
    "category": "茶飲",
    "packaging": "寶特瓶",
    "unit": "瓶"
  },
  {
    "id": "company-drink-28",
    "name": "原萃綠茶",
    "category": "茶飲",
    "packaging": "寶特瓶",
    "unit": "瓶"
  },
  {
    "id": "company-drink-29",
    "name": "十全果醋",
    "category": "其他",
    "packaging": "其他",
    "unit": "包"
  },
  {
    "id": "company-drink-30",
    "name": "冷萃金萱烏龍",
    "category": "大瓶飲料",
    "packaging": "大瓶裝",
    "unit": "瓶"
  },
  {
    "id": "company-drink-31",
    "name": "Moriyama紅茶",
    "category": "大瓶飲料",
    "packaging": "大瓶裝",
    "unit": "瓶"
  },
  {
    "id": "company-drink-32",
    "name": "Moriyama奶茶",
    "category": "大瓶飲料",
    "packaging": "大瓶裝",
    "unit": "瓶"
  },
  {
    "id": "company-drink-33",
    "name": "愛之味純濃燕麥",
    "category": "其他",
    "packaging": "寶特瓶",
    "unit": "瓶",
    "active": false
  },
  {
    "id": "company-drink-34",
    "name": "光泉燕麥奶",
    "category": "牛乳／植物奶",
    "packaging": "窄瓶鋁箔包",
    "unit": "包",
    "active": false
  },
  {
    "id": "company-drink-35",
    "name": "雪碧",
    "category": "汽水",
    "packaging": "小型鐵罐",
    "unit": "罐",
    "active": false
  },
  {
    "id": "company-drink-36",
    "name": "紅牌蜂蜜奶茶",
    "category": "茶飲",
    "packaging": "鋁箔包",
    "unit": "包",
    "active": false
  },
  {
    "id": "company-drink-37",
    "name": "立頓蜂蜜紅茶",
    "category": "茶飲",
    "packaging": "寶特瓶",
    "unit": "瓶",
    "active": false
  },
  {
    "id": "company-drink-38",
    "name": "蘋果西打",
    "category": "汽水",
    "packaging": "小型鐵罐",
    "unit": "罐",
    "active": false
  },
  {
    "id": "company-drink-39",
    "name": "克寧草莓優酪乳",
    "category": "牛乳／植物奶",
    "packaging": "窄瓶鋁箔包",
    "unit": "包",
    "active": false
  },
  {
    "id": "company-drink-40",
    "name": "愛之味麥仔茶",
    "category": "茶飲",
    "packaging": "鋁箔包",
    "unit": "包",
    "active": false
  }
] /* GENERATED_CATALOG_END */;
var SHEETS = { catalog: 'Catalog', warehouse: 'Warehouse', archive: 'Archive', history: 'History', wishes: 'WishReview', votes: 'WishVotes', products: 'ProductIntake', setup: 'Setup', website: 'WebsiteRequests', supplyCatalog: 'SupplyCatalog', supplyHistory: 'SupplyHistory', supplyWarehouse: 'SupplyWarehouse', restockPreferences: 'RestockPreferences', recorderCorrections:'HistoryRecorderCorrections' };
var RESTOCK_PREFERENCE_HEADERS = ['事件 ID','Google 收件時間','分類','品項 ID','補貨狀態','操作來源','採計狀態'];
var SNACK_CATEGORIES = ['太空包','巧克力','甜/鹹餅乾','燕麥棒/餅','蛋白質零食','其他鹹食','其他甜食'];
var SNACK_UNITS = ['包','盒','條','個','顆'];
var INITIAL_SUPPLIES = [
  { id:'supply-snack-01',name:'多力多滋',flavor:'雙倍起司',kind:'snack',unit:'包',active:true,category:'太空包' },
  { id:'supply-snack-02',name:'多力多滋',flavor:'香菜',kind:'snack',unit:'包',active:true,category:'太空包' },
  { id:'supply-snack-03',name:'樂事',flavor:'海苔',kind:'snack',unit:'包',active:true,category:'太空包' },
  { id:'supply-snack-04',name:'華元洋芋片',flavor:'蚵仔煎',kind:'snack',unit:'包',active:true,category:'太空包' },
  { id: 'supply-noodle-01', name: '來一客海鮮', kind: 'noodle', unit: '杯', active: true },
  { id: 'supply-noodle-02', name: '滿漢大餐牛肉麵', kind: 'noodle', unit: '碗', active: true },
  { id: 'supply-noodle-03', name: '拉麵道味噌拉麵', kind: 'noodle', unit: '杯', active: true },
  { id: 'supply-noodle-04', name: '拉麵道豚骨拉麵', kind: 'noodle', unit: '杯', active: true },
  { id: 'supply-noodle-05', name: '奶油白醬辣火雞麵', kind: 'noodle', unit: '杯', active: true },
  { id: 'supply-noodle-06', name: '辛拉麵', kind: 'noodle', unit: '杯', active: true },
  { id: 'supply-toner-black', name: '黑色碳粉', kind: 'toner', unit: '盒', active: true },
  { id: 'supply-toner-yellow', name: '黃色碳粉', kind: 'toner', unit: '盒', active: true },
  { id: 'supply-toner-red', name: '紅色碳粉', kind: 'toner', unit: '盒', active: true },
  { id: 'supply-toner-blue', name: '藍色碳粉', kind: 'toner', unit: '盒', active: true }
];
var SUPPLY_CATALOG_HEADERS = ['id', 'name', 'kind', 'unit', 'active', 'category','flavor'];
var SUPPLY_HISTORY_HEADERS = ['事件 ID', 'Google 收件時間', '類型', '品項 ID', '品項名稱', '數量', '備註', '登記人', '採計狀態', '保存期限', '批次／效期核對 ID'];
var WEBSITE_REQUEST_HEADERS = ['請求代號', '收件時間', '操作', '資料指紋', '處理狀態', '結果', '處理內容 1', '處理內容 2', '處理內容 3', '處理內容 4', '處理內容 5', '處理內容 6', '處理內容 7', '處理內容 8'];
var PRODUCT_CATEGORIES = ['牛乳／植物奶', '茶飲', '咖啡', '果汁', '汽水', '其他', '大瓶飲料'];
var PRODUCT_PACKAGING = ['窄瓶鋁箔包', '鋁箔包', '鐵罐', '小型鐵罐', '長鐵罐', '寶特瓶', '大瓶裝', '其他'];
var DEFAULT_CASE_SIZE = 24;
var PRODUCT_INTAKE_HEADERS = ['回應 ID', 'Google 收件時間', '品項 ID', '飲料名稱', '分類', '包裝', '登記人', '採計狀態'];

function setupConfig() {
  var emails = ADMIN_EMAILS.map(function (email) { return String(email).trim().toLowerCase(); });
  if (new Set(emails).size !== emails.length || emails.some(function (email) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); })) {
    throw new Error('ADMIN_EMAILS 如有填寫，必須為有效且不可重複的 Google 帳號。');
  }
  PropertiesService.getScriptProperties().setProperty('HOLDWIN_ADMINS', JSON.stringify(emails));
  return '私人匯入帳號設定已保存；日常表單免登入，以登記人留存紀錄。';
}

function setupOnce() {
  return locked_(function () {
    setupConfig();
    var props = PropertiesService.getScriptProperties();
    var ss = spreadsheet_();
    if (!ss) {
      ss = SpreadsheetApp.create('宏穩茶水間｜私人倉庫與表單紀錄');
      ss.setSpreadsheetTimeZone('Asia/Taipei');
      props.setProperty('HOLDWIN_SHEET_ID', ss.getId());
    }
    initializeCatalog_(ss);
    migrateCaseSizes_(ss);
    ensureSheet_(ss, SHEETS.history, ['事件 ID', 'Google 收件時間', '類型', '品項 ID', '飲料名稱', '數量', '備註', '登記人', '採計狀態']);
    ss.getSheetByName(SHEETS.history).getRange(1, 8).setValue('登記人');
    var wishes = ensureSheet_(ss, SHEETS.wishes, ['願望 ID', '品項名稱', '購買連結', '備註', '狀態', 'Google 收件時間', '許願分類']);
    wishes.getRange(1, 2).setValue('品項名稱');
    wishes.getRange(1, 7).setValue('許願分類');
    var votes = ensureSheet_(ss, SHEETS.votes, ['回應 ID', '願望 ID', '匿名識別碼', 'Google 收件時間', '採計狀態', '姓名']);
    votes.getRange(1, 6).setValue('姓名');
    ensureSheet_(ss, SHEETS.products, PRODUCT_INTAKE_HEADERS);
    ensureSheet_(ss, SHEETS.warehouse);
    ensureSheet_(ss, SHEETS.archive);
    ensureSheet_(ss, SHEETS.setup);
    configureForms_(ss);
    ensureTriggers_(ss);
    writeSetup_(ss);
    refreshWarehouse_();
    if (!props.getProperty('HOLDWIN_PUBLIC_UPDATED_AT')) props.setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
    console.log('私人倉庫已建立：' + ss.getUrl());
    console.log('盤點、入庫、許願、贊同及新增飲料五張表單已開放收件；請在 Google 表單發布設定允許任何人填寫。');
    return ss.getUrl();
  });
}

/**
 * Private, owner-run import for a previously reported stocktake. This function
 * is never routed by doGet and never accepts requests from the public website.
 * Keep actual quantities in a separate private script, not in this source file.
 */
function importPrivateStocktake(batchId, rows, countedAt, sourceNote) {
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (adminEmails_().indexOf(email) < 0) throw new Error('只有設定中的管理者可匯入盤點。');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(String(batchId || ''))) throw new Error('請提供有效且固定的匯入批次 ID。');
  if (!Array.isArray(rows) || !rows.length) throw new Error('盤點清單不可空白。');
  if (typeof countedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(countedAt) || !iso_(countedAt)) {
    throw new Error('請先確認實際盤點時間，使用含時區的日期時間；不能只提供日期。');
  }
  var timestamp = iso_(countedAt);
  if (Date.parse(timestamp) > Date.now() + 300000) throw new Error('盤點時間不可在未來。');
  return locked_(function () {
    var ss = requiredSpreadsheet_();
    var catalog = catalog_(ss);
    var known = {}; catalog.forEach(function (drink) { known[drink.id] = true; });
    var recorded = {}; historyEvents_(ss).forEach(function (event) { recorded[event.id] = event; });
    var seen = {};
    var events = rows.map(function (row) {
      var id = String(row.drinkId || row.id || '');
      var quantity = quantity_(row.quantity, true);
      if (!known[id] || seen[id] || quantity === null) throw new Error('盤點包含未知、重複品項或無效數量。');
      seen[id] = true;
      return { id: 'import:' + batchId + ':' + id, drinkId: id, type: 'count', quantity: quantity,
        createdAt: timestamp, email: email, accepted: true, note: text_(sourceNote || '私人盤點匯入', 500) };
    });
    var batchPrefix = 'import:' + batchId + ':';
    var previousBatchIds = Object.keys(recorded).filter(function (id) { return id.indexOf(batchPrefix) === 0; });
    if (previousBatchIds.length && (previousBatchIds.length !== events.length || events.some(function (event) { return !recorded[event.id]; }))) {
      throw new Error('此批次已使用不同的品項清單；請使用新的批次 ID，不可更改原盤點範圍。');
    }
    events.forEach(function (event) {
      var existing = recorded[event.id];
      if (existing && (existing.quantity !== event.quantity || existing.createdAt !== event.createdAt || existing.type !== 'count' || !existing.accepted || existing.note !== event.note)) {
        throw new Error('此批次已存在不同資料；請核對紀錄並使用新的批次 ID，不可覆寫原盤點。');
      }
    });
    var added = events.filter(function (event) { return !recorded[event.id]; });
    if (added.length) appendHistory_(ss, added);
    refreshWarehouse_();
    return '本次新增 ' + added.length + ' 筆盤點；重複執行不會重複計入。';
  });
}

// Kept as a compatibility alias for older setup instructions.
function enablePrivateForms() {
  return syncCatalogForms();
}

function refreshWarehouse() {
  return locked_(function () { refreshWarehouse_(); return '倉庫與歷史檢視已更新。'; });
}

function syncCatalogForms() {
  return locked_(function () {
    var ss = requiredSpreadsheet_();
    configureForms_(ss);
    PropertiesService.getScriptProperties().setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
    refreshWarehouse_();
    return '品項與表單已同步；既有題目與回應不會刪除。';
  });
}

function handleFormSubmit(e) {
  refreshWarehouse();
}

function handleSheetEdit(e) {
  if (!e || !e.range) return;
  var name = e.range.getSheet().getName();
  if (name === SHEETS.catalog) syncCatalogForms();
  else if (name === SHEETS.history) refreshWarehouse();
  else if (name === SHEETS.wishes) PropertiesService.getScriptProperties().setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
}

function doGet(e) {
  var parameters = e && e.parameter ? e.parameter : {};
  var callback = parameters.callback || '';
  var data;
  if (callback && !/^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/.test(callback)) {
    return ContentService.createTextOutput('{"ok":false,"error":"invalid_callback"}').setMimeType(ContentService.MimeType.JSON);
  }
  try {
    if (parameters.action === 'receipt') data = websiteReceipt_(parameters.requestId);
    else if (parameters.action === 'warehouse') data = warehouseData_();
    else if (parameters.action === 'popularity') data = popularityData_();
    else if (parameters.action === 'admin') data = adminSummaryData_();
    else if (parameters.action === 'gacha') data = gachaOptions_();
    else if (!parameters.action || parameters.action === 'public') data = publicData_();
    else data = { ok: false, error: 'unsupported_action' };
  } catch (error) {
    // Never expose a stack, email, raw response, private count or service error.
    data = { ok: false, error: 'public_data_unavailable' };
  }
  var json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(callback ? callback + '(' + json + ');' : json)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

/** The website posts commands, never a replacement of the whole spreadsheet.
 *  Replies are confirmed through doGet(action=receipt), not iframe navigation. */
function doPost(e) {
  try {
    var raw = e && e.parameter && e.parameter.payload;
    if (typeof raw !== 'string' || raw.length > 262144) throw new Error('invalid_request');
    submitWebsiteRequest_(JSON.parse(raw));
  } catch (error) {
    // Validation receipts carry safe messages. Unexpected failures stay pending
    // so the exact same request can be retried without duplicating a delivery.
    console.warn('Website request did not finish. Inspect WebsiteRequests for its status.');
  }
  return HtmlService.createHtmlOutput('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>宏穩茶水間</title><p>請回網站查看儲存結果。</p></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function websiteInputError_(message) {
  var error = new Error(message);
  error.websiteInput = true;
  return error;
}

function websiteText_(value, label, max, required) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw websiteInputError_('請填寫有效的' + label + '。');
  var cleaned = text_(value, max);
  if (required && !cleaned) throw websiteInputError_('請填寫有效的' + label + '。');
  return cleaned;
}

function websiteCanonical_(value) {
  if (Array.isArray(value)) return '[' + value.map(websiteCanonical_).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + websiteCanonical_(value[key]); }).join(',') + '}';
  return JSON.stringify(value);
}

function websiteFingerprint_(request) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, websiteCanonical_({ operation: request.operation, data: request.data }), Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function websiteRequestRecord_(sheet, requestId, columns) {
  if (!sheet || sheet.getLastRow() < 2) return null;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i += 1) {
    if (String(ids[i][0]) === requestId) return { index: i + 2, row: sheet.getRange(i + 2, 1, 1, columns || WEBSITE_REQUEST_HEADERS.length).getValues()[0] };
  }
  return null;
}

function websiteReceipt_(requestId) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(String(requestId || ''))) return { ok: false, error: 'invalid_request' };
  var cached = readWebsiteCache_('receipt:' + requestId);
  if (cached && cached.ok === true && cached.requestId === requestId && cached.state === 'accepted') return cached;
  var ss = requiredSpreadsheet_();
  var record = websiteRequestRecord_(ss.getSheetByName(SHEETS.website), requestId, 6);
  if (!record || record.row[4] === 'pending') return { ok: true, requestId: requestId, state: 'pending' };
  var result = JSON.parse(record.row[5] || '{}');
  // No prepared rows, recorder, browser token or original payload is exposed.
  return record.row[4] === 'accepted'
    ? { ok: true, requestId: requestId, state: 'accepted', result: result }
    : { ok: false, requestId: requestId, state: 'rejected', message: text_(result.message || '資料未儲存，請檢查輸入。', 300) };
}

function submitWebsiteRequest_(request) {
  if (!request || !/^[A-Za-z0-9_-]{20,100}$/.test(String(request.requestId || ''))) throw new Error('invalid_request');
  var fingerprint = websiteFingerprint_(request);
  return locked_(function () {
    var ss = requiredSpreadsheet_();
    var sheet = ss.getSheetByName(SHEETS.website);
    if (!sheet || sheet.getLastRow() === 0) sheet = ensureSheet_(ss, SHEETS.website, WEBSITE_REQUEST_HEADERS);
    var record = websiteRequestRecord_(sheet, request.requestId);
    if (record && record.row[3] !== fingerprint) throw new Error('request_conflict');
    if (record && record.row[4] !== 'pending') return websiteReceipt_(request.requestId);
    if (!record) {
      var stamp = new Date().toISOString(), prepared, validationError;
      try { prepared = prepareWebsiteRequest_(ss, request, stamp); }
      catch (error) { if (!error.websiteInput) throw error; validationError = error; }
      var row = [request.requestId, stamp, sheetText_(String(request.operation || '').slice(0, 30)), fingerprint, validationError ? 'rejected' : 'pending', validationError ? JSON.stringify({ message: validationError.message }) : ''];
      var json = prepared ? JSON.stringify(prepared) : '';
      while (json.length) {
        var end = Math.min(40000, json.length);
        if (end < json.length && /[\uD800-\uDBFF]/.test(json.charAt(end - 1))) end -= 1;
        row.push(json.slice(0, end)); json = json.slice(end);
      }
      if (row.length > WEBSITE_REQUEST_HEADERS.length) throw websiteInputError_('這次資料較多，請分批送出。');
      while (row.length < WEBSITE_REQUEST_HEADERS.length) row.push('');
      var index = sheet.getLastRow() + 1;
      sheet.getRange(index, 1, 1, row.length).setNumberFormat('@').setValues([row]);
      SpreadsheetApp.flush();
      record = { index: index, row: row };
      if (validationError) return websiteReceipt_(request.requestId);
    }
    var effects = JSON.parse(record.row.slice(6).join(''));
    try { applyWebsiteRequest_(ss, effects); }
    catch (error) {
      // Permanent conflicts are checked before any domain rows are applied.
      if (!error.websiteInput) throw error;
      sheet.getRange(record.index, 5, 1, 2).setValues([['rejected', JSON.stringify({message:error.message})]]);
      SpreadsheetApp.flush();
      return websiteReceipt_(request.requestId);
    }
    if(effects.history || (effects.batch&&effects.batch.some(function(child){return !!child.history;})))PropertiesService.getScriptProperties().setProperty('HOLDWIN_ZERO_DRINK_IDS','');
    if (['wish','vote','archive-wish'].indexOf(effects.operation) >= 0) {
      PropertiesService.getScriptProperties().setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
    } else if (effects.zeroStockDecision) {
      if (effects.zeroStockDecision.kind === 'drink') {
        var inventory=computeInventory_(catalog_(ss),historyEvents_(ss));renderWarehouse_(ss,inventory);
        if(effects.zeroStockDecision.decision==='archive'){renderArchive_(ss,inventory);PropertiesService.getScriptProperties().setProperty('HOLDWIN_PUBLIC_UPDATED_AT',new Date().toISOString());}
      } else renderSupplyWarehouse_(ss);
    } else if (effects.recorderCorrections) {
      // Recorder corrections have no stock or generated inventory changes.
    } else if (effects.batch) {
      if(effects.batch.some(function(child){return !!child.supplyHistory;}))renderSupplyWarehouse_(ss);
      if(effects.batch.some(function(child){return !!child.history;})){var inventory=computeInventory_(catalog_(ss),historyEvents_(ss));renderWarehouse_(ss,inventory);if(effects.batch.some(function(child){return child.restore&&child.restore.some(function(item){return item.kind==='drink';});}))renderArchive_(ss,inventory);PropertiesService.getScriptProperties().setProperty('HOLDWIN_PUBLIC_UPDATED_AT',new Date().toISOString());}
    } else if (effects.supplyDetails) { renderSupplyWarehouse_(ss);
    } else if (effects.supplyHistory || (effects.restockPreference && effects.restockPreference[2] !== 'drink')) renderSupplyWarehouse_(ss);
    else {
      var catalog = catalog_(ss), inventory = computeInventory_(catalog, historyEvents_(ss));
      renderWarehouse_(ss, inventory);
      // Normal website writes affect active products only. A recovered pending
      // write can still touch a product archived since validation.
      if ((effects.restore||[]).some(function(item){return item.kind==='drink';}) || (effects.history || []).some(function (event) { return catalog.some(function (drink) { return drink.id === event[3] && !drink.active; }); })) renderArchive_(ss, inventory);
      if (effects.operation !== 'restock-preference') PropertiesService.getScriptProperties().setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
    }
    // Large supporter lists use the ordinary full-read fallback rather than
    // exceeding the single-cell receipt limit after the vote was written.
    if (JSON.stringify(effects.result).length > 40000) { delete effects.result.wish; delete effects.result.snapshotAt; }
    SpreadsheetApp.flush();
    // Commit state and result together, only after data and views are saved.
    sheet.getRange(record.index, 5, 1, 2).setValues([['accepted', JSON.stringify(effects.result)]]);
    SpreadsheetApp.flush();
    var receipt = { ok: true, requestId: request.requestId, state: 'accepted', result: effects.result };
    // Immutable receipts enter the optional cache only after the final flush.
    writeWebsiteCache_('receipt:' + request.requestId, receipt, 21600);
    return receipt;
  });
}

function prepareWebsiteRequest_(ss, request, stamp) {
  var data = request.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw websiteInputError_('送出資料格式不正確。');
  var operation = request.operation, effects = { operation: operation, result: { operation: operation } };
  var catalog = ['wish', 'vote','batch-arrival'].indexOf(operation) >= 0 || String(operation).indexOf('supply-') === 0 ? [] : catalog_(ss);
  function activeDrink(id,restore) {
    var found = catalog.filter(function(drink){return drink.id===id&&(drink.active||restore===true);})[0];
    if (!found) throw websiteInputError_('這個品項目前不在供應清單，請重新讀取品項。');
    return found;
  }
  if (operation === 'batch-arrival') {
    var recorder = websiteText_(data.recorder,'登記人',80,true);
    if (!Array.isArray(data.entries) || !data.entries.length || data.entries.length > 30) throw websiteInputError_('請填寫 1 到 30 列入庫品項。');
    var snapshot = arrivalReadSnapshot_(ss), newKeys = Object.create(null), totals = Object.create(null);
    effects.batch = data.entries.map(function(entry,index) {
      if (!entry || ['drink','snack','noodle','toner'].indexOf(entry.kind) < 0) throw websiteInputError_('請選擇有效的入庫分類。');
      if(!entry.isNew){var existing=entry.kind==='drink'?catalog_(snapshot).filter(function(item){return item.id===entry.drinkId;})[0]:supplyCatalog_(snapshot).filter(function(item){return item.id===entry.supplyId;})[0];if(!existing||(entry.kind!=='drink'&&existing.kind!==entry.kind))throw websiteInputError_('品項與入庫分類不符。');}
      var rowData = Object.assign({},entry,{recorder:recorder});
      var op = entry.isNew ? 'new-arrival' : entry.kind === 'drink' ? 'arrival' : 'supply-arrival';
      if (entry.kind === 'toner' && entry.isNew) throw websiteInputError_('碳粉限既有四色。');
      if (op === 'arrival') { rowData.cases = 0; rowData.loose = entry.quantity; }
      var child = prepareWebsiteRequest_(snapshot,{operation:op,data:rowData,requestId:request.requestId+'-'+index},stamp);
      var row = (child.history || child.supplyHistory)[0], key=entry.kind+':'+row[3];
      if (child.newArrival) { var nk=entry.kind+':'+child.newArrivalNameKey; if(newKeys[nk])throw websiteInputError_('同一批內有重複新品，請合併數量。');newKeys[nk]=true; }
      totals[key]=(totals[key]||0)+row[5];
      var current = entry.kind==='drink' ? computeInventory_(catalog_(snapshot),historyEvents_(snapshot)).filter(function(item){return item.drink.id===row[3];})[0] : supplyInventory_(supplyCatalog_(snapshot),supplyEvents_(snapshot)).filter(function(item){return item.id===row[3];})[0];
      if (totals[key]>999999 || (current && current.stock!==null && current.stock+totals[key]>999999))throw websiteInputError_('批次累計庫存不可超過 999999。');
      child.result.kind=entry.kind;
      return child;
    });
    var addedDrinks=effects.batch.filter(function(child){return !!child.catalog;}).length,addedSupplies=effects.batch.filter(function(child){return !!child.supplyCatalog;}).length;
    if(catalog_(snapshot).length+addedDrinks>1000 || supplyCatalog_(snapshot).length+addedSupplies>1000)throw websiteInputError_('品項數量已達上限。');
    effects.result.items=effects.batch.map(function(child){return child.result;});effects.result.count=effects.batch.length;
  } else if (operation === 'supply-details') {
    var item=supplyCatalog_(ss).filter(function(item){return item.id===data.supplyId&&item.kind==='snack'&&item.active;})[0];
    if(!item)throw websiteInputError_('找不到這個零食品項。');
    if(data.expectedName!==item.name || (data.expectedFlavor||'')!==(item.flavor||''))throw websiteInputError_('品名或口味已更新，請重新整理。');
    var name=websiteText_(data.name,'品項名稱',80,true),flavor=websiteText_(data.flavor||'','口味',80,false);
    if(supplyCatalog_(ss).some(function(other){return other.id!==item.id&&other.kind==='snack'&&supplyProductKey_(other.name,other.flavor)===supplyProductKey_(name,flavor);}))throw websiteInputError_('已有相同品名與口味，請沿用既有品項。');
    effects.supplyDetails={id:item.id,name:name,flavor:flavor,expectedName:item.name,expectedFlavor:item.flavor||''};effects.result.id=item.id;
  } else if (operation === 'supply-recorder-correction') {
    var recorder = websiteText_(data.recorder, '登記人', 80, true), previous = websiteText_(data.expectedRecorder, '原登記人', 80, true);
    if (!Array.isArray(data.eventIds) || !data.eventIds.length || data.eventIds.length > 100) throw websiteInputError_('請選擇需要更正的效期紀錄。');
    var events = supplyEvents_(ss), seen = Object.create(null);
    effects.recorderCorrections = data.eventIds.map(function (id,index) {
      var event = events.filter(function (entry) { return entry.id === id; })[0];
      if (!event || event.type !== 'expiry-set' || event.recorder !== previous || seen[id]) throw websiteInputError_('效期登記人已變動，請重新讀取後確認。');
      seen[id] = true;
      return ['website:' + request.requestId + ':' + index,stamp,id,sheetText_(previous),sheetText_(recorder),'採計'];
    });
    effects.result.count = effects.recorderCorrections.length;
  } else if (operation === 'zero-stock-decision') {
    if (['drink','snack','noodle'].indexOf(data.kind)<0 || ['pending','undecided','archive'].indexOf(data.decision)<0) throw websiteInputError_('請選擇有效的無庫存處理方式。');
    var kind=data.kind,items=kind==='drink'?catalog:supplyCatalog_(ss).filter(function(item){return item.kind===kind;}),item=items.filter(function(item){return item.id===data.itemId;})[0];
    var stockEvents=kind==='drink'?historyEvents_(ss):supplyEvents_(ss);
    var current=kind==='drink'?computeInventory_(catalog,stockEvents).filter(function(entry){return entry.drink.id===data.itemId;})[0]:supplyInventory_(supplyCatalog_(ss),stockEvents).filter(function(entry){return entry.id===data.itemId;})[0];
    if(!item||!item.active||!current||current.stock!==0)throw websiteInputError_('這個品項已不在無庫存清單，請重新整理。');
    var preferences=restockPreferences_(ss),mode=restockMode_(preferences,kind,item.id);
    if(data.expectedMode!==mode)throw websiteInputError_('其他裝置已更新處理狀態，請重新整理。');
    var desired=data.decision==='pending'?'consider':'normal';
    effects.zeroStockDecision={kind:kind,id:item.id,decision:data.decision,expectedMode:mode,expectedEventId:zeroStockLatestEventId_(stockEvents,item.id)};
    effects.restockPreference=['website:'+request.requestId,stamp,kind,item.id,desired,data.decision==='pending'?'zero-stock:pending':'zero-stock:'+data.decision,'採計'];
    Object.assign(effects.result,{kind:kind,itemId:item.id,decision:data.decision,mode:desired,active:data.decision!=='archive',stock:0,snapshotAt:stamp});
  } else if (operation === 'restock-preference') {
    var kind = data.kind, mode = data.mode;
    if (['drink','snack','noodle','toner'].indexOf(kind) < 0 || (kind==='snack'?['normal','consider']:['normal','consider','hold','replace']).indexOf(mode) < 0) throw websiteInputError_('補貨提醒設定不正確。');
    var item = (kind === 'drink' ? catalog : supplyCatalog_(ss).filter(function (entry) { return entry.kind === kind; })).filter(function (entry) { return entry.id === data.itemId; })[0];
    if (!item || (!item.active && mode !== 'normal')) throw websiteInputError_('找不到可設定的品項。');
    var preferences = restockPreferences_(ss), currentMode = restockMode_(preferences,kind,item.id);
    if (data.expectedMode !== currentMode) throw websiteInputError_('其他裝置已更新這個品項的補貨設定，請重新整理。');
    if (kind !== 'snack' && mode !== 'normal' && mode !== 'consider' && currentMode === 'normal') {
      var current = kind === 'drink' ? computeInventory_(catalog,historyEvents_(ss)).filter(function (entry) { return entry.drink.id === item.id; })[0] : supplyInventory_(supplyCatalog_(ss),supplyEvents_(ss)).filter(function (entry) { return entry.id === item.id; })[0];
      if (!inventoryIsLow_(kind,current)) throw websiteInputError_('目前庫存未達這類品項的補貨提醒門檻，請重新整理後確認。');
    }
    if (mode !== currentMode) effects.restockPreference = ['website:' + request.requestId,stamp,kind,item.id,mode,'網站管理後台','採計'];
    effects.result.kind = kind; effects.result.itemId = item.id; effects.result.mode = mode;
    var previous = preferences.filter(function (entry) { return entry.kind === kind && entry.itemId === item.id; })[0];
    effects.result.updatedAt = mode !== currentMode ? stamp : previous ? previous.updatedAt : stamp;
  } else if (operation === 'new-arrival') {
    var kind = data.kind;
    if (['drink','snack','noodle'].indexOf(kind) < 0) throw websiteInputError_('新品到貨僅支援飲料、零食與泡麵。');
    var name = websiteText_(data.name, '新品名稱', 80, true);
    var recorder = websiteText_(data.recorder, '登記人', 80, true);
    var note = websiteText_(data.note || '', '入庫備註', 500, false);
    var quantity = quantity_(data.quantity, false);
    if (quantity === null || (data.cases !== undefined && String(data.cases).trim() !== '' && Number(data.cases) !== 0)) throw websiteInputError_('新品請依單位填寫 1 到 999999 的整數數量，不使用整箱換算。');
    if ((kind === 'drink' ? ['包','瓶','罐'] : kind === 'snack' ? SNACK_UNITS : ['杯','碗']).indexOf(data.unit) < 0) throw websiteInputError_('請選擇有效的新品單位。');
    var category = kind === 'snack' ? websiteText_(data.category, '零食分類', 80, true) : kind === 'drink' ? canonicalDrinkCategory_(data.category === undefined ? '其他' : websiteText_(data.category, '飲料分類', 80, true)) : '';
    if (kind === 'drink' && PRODUCT_CATEGORIES.indexOf(category) < 0) throw websiteInputError_('請選擇有效的飲料分類。');
    if (kind === 'snack' && SNACK_CATEGORIES.indexOf(category) < 0) throw websiteInputError_('請選擇有效的零食分類。');
    var id = productResponseId_('website:' + request.requestId);
    effects.newArrival = true;
    var flavor = kind === 'snack' ? websiteText_(data.flavor || '', '口味',80,false) : '';
    effects.newArrivalNameKey = supplyProductKey_(name,flavor);
    if (kind === 'drink') {
      if (catalog.length >= 1000) throw websiteInputError_('品項數量已達上限。');
      if (catalog.some(function (item) { return productNameKey_(item.name) === productNameKey_(name); })) throw websiteInputError_('已經有同名飲料，請沿用原品項；停買品項請查看歷史清單。');
      effects.catalog = [id, sheetText_(name), category, '其他', data.unit, '', 10, true];
      effects.productKey = productNameKey_(name);
      effects.product = ['website:' + request.requestId, stamp, id, sheetText_(name), category, '其他', sheetText_(recorder), '採計'];
      effects.history = [['website:' + request.requestId + ':' + id, stamp, 'restock', id, sheetText_(name), quantity, sheetText_(note || '新品到貨入庫'), sheetText_(recorder), '採計']];
    } else {
      var supplies = supplyCatalog_(ss);
      if (supplies.length >= 1000) throw websiteInputError_('品項數量已達上限。');
      if (supplies.some(function (item) { return item.kind === kind && supplyProductKey_(item.name,item.flavor) === supplyProductKey_(name,flavor); })) throw websiteInputError_('已經有同名品項，請沿用原品項或查看庫存清單。');
      var expiresOn = websiteSupplyExpiry_(kind,data.expiresOn,stamp);
      id = id.replace('custom-drink-', 'supply-' + kind + '-');
      effects.supplyCatalog = [id, sheetText_(name), kind, data.unit, true, category, sheetText_(flavor)];
      effects.supplyHistory = [['website:' + request.requestId + ':' + id, stamp, 'restock', id, sheetText_(name), quantity, sheetText_(note || '新品到貨入庫'), sheetText_(recorder), '採計', expiresOn, '']];
    }
    effects.result.id = id;
    effects.result.quantity = quantity;
  } else if (operation === 'supply-stocktake' || operation === 'supply-arrival' || operation === 'supply-expiry-close' || operation === 'supply-expiry-set') {
    var recorder = websiteText_(data.recorder, '登記人', 80, true);
    var supplies = supplyCatalog_(ss);
    effects.supplyHistory = [];
    function activeSupply(id,restore) {
      var item = supplies.filter(function(entry){return entry.id===id&&(entry.active||restore===true);})[0];
      if (!item) throw websiteInputError_('這個零食、泡麵或碳粉品項目前不可登記，請重新整理。');
      return item;
    }
    if (operation === 'supply-expiry-set') {
      var item = activeSupply(data.supplyId), events = supplyEvents_(ss);
      var current = supplyInventory_(supplies, events).filter(function (entry) { return entry.id === item.id; })[0];
      if (!supplyTracksExpiry_(item.kind) || !current.lastCountAt || !(current.stock > 0)) throw websiteInputError_('請先完成實際盤點，再補登現有零食或泡麵的保存期限。');
      var ownEvents = events.filter(function (event) { return event.supplyId === item.id; });
      if (data.expectedStock !== current.stock || data.expectedEventId !== ownEvents[ownEvents.length - 1].id) throw websiteInputError_('這個品項已有新紀錄，請重新整理後核對數量與效期。');
      if (!Array.isArray(data.batches) || !data.batches.length || data.batches.length > 20) throw websiteInputError_('請填寫 1 到 20 批現有庫存的保存期限。');
      var note = websiteText_(data.note || '', '效期備註', 500, false), total = 0;
      data.batches.forEach(function (batch,index) {
        if (!batch || typeof batch !== 'object') throw websiteInputError_('效期批次資料格式不正確。');
        var quantity = quantity_(batch.quantity, false), expiresOn = validSupplyExpiry_(batch.expiresOn);
        if (quantity === null || !expiresOn) throw websiteInputError_('請填寫有效日期與正整數數量。');
        total += quantity;
        effects.supplyHistory.push(['website:' + request.requestId + ':' + item.id + ':' + index, stamp, 'expiry-set', item.id, sheetText_(item.name), quantity, sheetText_(note || '既有庫存效期補登，不異動數量'), sheetText_(recorder), '採計', expiresOn, 'expiry-set:' + request.requestId]);
      });
      if (total !== current.stock) throw websiteInputError_('各批數量合計須等於目前庫存；數量不同請先重新盤點。');
      effects.result.quantity = current.stock;
      effects.result.batchCount = data.batches.length;
    } else if (operation === 'supply-expiry-close') {
      var events = supplyEvents_(ss);
      var batch = events.filter(function (event) { return event.id === data.batchId && ['restock','expiry-set'].indexOf(event.type) >= 0; })[0];
      if (!batch || !supplyTracksExpiry_(activeSupply(batch.supplyId).kind)) throw websiteInputError_('找不到可標記的食品入庫批次。');
      var open = openSupplyBatches_(batch.supplyId, events).some(function (event) { return event.id === batch.id; });
      effects.result.alreadyClosed = !open;
      if (open) {
        var item = activeSupply(batch.supplyId);
        var note = websiteText_(data.note || '', '批次備註', 500, false);
        effects.supplyHistory.push(['website:' + request.requestId + ':' + item.id, stamp, 'expiry-close', item.id, sheetText_(item.name), 0, sheetText_(note || '此批已用完或移除；總庫存請另行盤點'), sheetText_(recorder), '採計', '', batch.id]);
      }
    } else if (operation === 'supply-stocktake') {
      if (!Array.isArray(data.entries) || !data.entries.length || data.entries.length > 1000) throw websiteInputError_('請至少填寫一個品項的實際數量。');
      var seen = Object.create(null);
      data.entries.forEach(function (entry) {
        if (!entry || typeof entry.supplyId !== 'string' || seen[entry.supplyId]) throw websiteInputError_('盤點品項無效或重複。');
        seen[entry.supplyId] = true;
        var item = activeSupply(entry.supplyId), quantity = quantity_(entry.quantity, true);
        if (quantity === null) throw websiteInputError_('盤點數量請填 0 到 999999 的整數。');
        effects.supplyHistory.push(['website:' + request.requestId + ':' + item.id, stamp, 'count', item.id, sheetText_(item.name), quantity, '網站實際盤點', sheetText_(recorder), '採計', '', '']);
      });
      effects.result.count = effects.supplyHistory.length;
    } else {
      var item = activeSupply(data.supplyId,data.restoreArchived===true), quantity = quantity_(data.quantity, false);
      if(!item.active){effects.restore=[{kind:item.kind,id:item.id}];effects.result.restored=true;}
      if (quantity === null || (data.cases !== undefined && String(data.cases).trim() !== '' && Number(data.cases) !== 0)) throw websiteInputError_('請填寫大於 0 的整數數量；零食、泡麵與碳粉不支援整箱換算。');
      var current = supplyInventory_(supplies, supplyEvents_(ss)).filter(function (entry) { return entry.id === item.id; })[0];
      if (current.stock !== null && current.stock + quantity > 999999) throw websiteInputError_('累計庫存不可超過 999999，請確認數量。');
      var note = websiteText_(data.note || '', '入庫備註', 500, false);
      var expiresOn = supplyTracksExpiry_(item.kind) ? websiteSupplyExpiry_(item.kind,data.expiresOn,stamp) : '';
      effects.supplyHistory.push(['website:' + request.requestId + ':' + item.id, stamp, 'restock', item.id, sheetText_(item.name), quantity, sheetText_(note || (effects.restore?'歷史品項重新入庫':'網站快速入庫')), sheetText_(recorder), '採計', expiresOn, '']);
      effects.result.quantity = quantity;
    }
  } else if (operation === 'archive-wish') {
    var drink = visibleDrinkCatalog_(ss,catalog,true).filter(function (item) { return item.id === data.drinkId && !item.active; })[0];
    if (!drink) throw websiteInputError_('這個品項目前不在歷史清單，請重新整理。');
    var voterName = websiteText_(data.voterName, '姓名', 80, true);
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(String(data.voterId || ''))) throw websiteInputError_('瀏覽器識別資料無效，請重新開啟網站。');
    var existing = wishRows_(ss).filter(function (wish) { return wish.sourceDrinkId === drink.id; })[0];
    var wishId = existing ? existing.id : 'wish-return-' + websiteFingerprint_({operation:'archive-wish',data:{drinkId:drink.id}}).slice(0,32);
    if (!existing) effects.wish = [wishId,sheetText_(drink.name),'','我還想喝，希望有機會可以再買','pending',stamp,'drink',drink.id];
    effects.vote = ['website:' + request.requestId,wishId,sheetText_(data.voterId),stamp,'採計',sheetText_(voterName)];
    effects.result.id = wishId;
  } else if (operation === 'wish') {
    if (['drink', 'snack'].indexOf(data.kind) < 0) throw websiteInputError_('請選擇飲料許願或零食許願。');
    var name = websiteText_(data.name, '品項名稱', 80, true);
    var note = websiteText_(data.note || '', '許願備註', 500, false);
    var inputUrl = websiteText_(data.url || '', '產品連結', 2000, false);
    var link = inputUrl ? safeUrl_(inputUrl) : '';
    if (inputUrl && !link) throw websiteInputError_('請填寫有效的 http 或 https 產品連結。');
    if (link) {
      var address = /^https?:\/\/([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?(?:[/?#]|$)/i.exec(link);
      if (!address || (address[2] && (Number(address[2]) < 1 || Number(address[2]) > 65535))) throw websiteInputError_('請填寫有效的 http 或 https 產品連結。');
    }
    var wishId = 'wish-web-' + request.requestId;
    effects.wish = [wishId, sheetText_(name), sheetText_(link), sheetText_(note), 'pending', stamp, data.kind];
    effects.result.id = wishId;
    effects.result.wish = {id:wishId,kind:data.kind,name:name,url:link,note:note,status:'pending',createdAt:stamp,votes:0,supporters:[]};
  } else if (operation === 'vote') {
    var voterName = websiteText_(data.voterName, '姓名', 80, true);
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(String(data.voterId || ''))) throw websiteInputError_('瀏覽器識別資料無效，請重新開啟網站。');
    var targetWish = wishRows_(ss).filter(function (wish) { return wish.id === data.wishId; })[0];
    if (!targetWish) throw websiteInputError_('找不到這個願望，請重新讀取。');
    effects.vote = ['website:' + request.requestId, data.wishId, sheetText_(data.voterId), stamp, '採計', sheetText_(voterName)];
    effects.result.wish = targetWish;
  } else if (operation === 'stocktake' || operation === 'arrival') {
    var recorder = websiteText_(data.recorder, '登記人', 80, true);
    effects.history = [];
    if (operation === 'stocktake') {
      if (!Array.isArray(data.entries) || !data.entries.length || data.entries.length > 1000) throw websiteInputError_('請至少填寫一個品項的實際數量。');
      var seen = Object.create(null);
      data.entries.forEach(function (entry) {
        if (!entry || typeof entry.drinkId !== 'string' || seen[entry.drinkId]) throw websiteInputError_('盤點品項無效或重複。');
        seen[entry.drinkId] = true;
        var drink = activeDrink(entry.drinkId), quantity = quantity_(entry.quantity, true);
        if (quantity === null) throw websiteInputError_('盤點數量請填 0 到 999999 的整數。');
        effects.history.push(['website:' + request.requestId + ':' + drink.id, stamp, 'count', drink.id, sheetText_(drink.name), quantity, '網站實際盤點', sheetText_(recorder), '採計']);
      });
      effects.result.count = effects.history.length;
    } else {
      var drink = activeDrink(data.drinkId,data.restoreArchived===true);
      if(!drink.active){effects.restore=[{kind:'drink',id:drink.id}];effects.result.restored=true;}
      var quantity = arrivalQuantity_(data.cases, data.loose, drink.perCase);
      if (quantity === null) throw websiteInputError_('整箱或零散數量至少填一項，且合計須大於 0。');
      var current = computeInventory_(catalog, historyEvents_(ss)).filter(function (entry) { return entry.drink.id === drink.id; })[0];
      if (current.stock !== null && current.stock + quantity > 999999) throw websiteInputError_('累計庫存不可超過 999999，請確認數量。');
      var note = websiteText_(data.note || '', '入庫備註', 500, false);
      effects.history.push(['website:' + request.requestId + ':' + drink.id, stamp, 'restock', drink.id, sheetText_(drink.name), quantity, sheetText_(note || (effects.restore?'歷史品項重新入庫':'網站到貨入庫')), sheetText_(recorder), '採計']);
      effects.result.quantity = quantity;
    }
  } else if (operation === 'product') {
    var name = websiteText_(data.name, '飲料名稱', 80, true);
    var recorder = websiteText_(data.recorder, '登記人', 80, true);
    var category = canonicalDrinkCategory_(data.category);
    if (PRODUCT_CATEGORIES.indexOf(category) < 0 || PRODUCT_PACKAGING.indexOf(data.packaging) < 0) throw websiteInputError_('請選擇有效的飲料分類與包裝。');
    if (catalog.some(function (drink) { return productNameKey_(drink.name) === productNameKey_(name); })) throw websiteInputError_('已經有同名品項，請沿用原品項或查看歷史清單。');
    if (catalog.length >= 1000) throw websiteInputError_('品項數量已達上限。');
    var unit = ['寶特瓶', '大瓶裝'].indexOf(data.packaging) >= 0 ? '瓶' : data.packaging.indexOf('鐵罐') >= 0 ? '罐' : '包';
    var id = productResponseId_('website:' + request.requestId);
    effects.catalog = [id, sheetText_(name), category, data.packaging, unit, DEFAULT_CASE_SIZE, 10, true];
    effects.productKey = productNameKey_(name);
    effects.product = ['website:' + request.requestId, stamp, id, sheetText_(name), category, data.packaging, sheetText_(recorder), '採計'];
    effects.result.id = id;
  } else throw websiteInputError_('不支援的網站操作。');
  if(operation==='arrival'||operation==='supply-arrival')prepareZeroRestockFulfilments_(ss,effects,request.requestId,stamp);
  return effects;
}

function websiteAppendMissing_(sheet, rows) {
  if (!rows || !rows.length) return;
  var known = Object.create(null);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (row) { known[String(row[0])] = true; });
  var additions = rows.filter(function (row) { return !known[String(row[0])]; });
  if (additions.length) sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, additions[0].length).setValues(additions);
}

function applyWebsiteRequest_(ss, effects) {
  var snapshotAt = new Date().toISOString();
  var fulfilments=effects.batch?effects.batch.reduce(function(rows,child){return rows.concat(child.restockFulfilments||[]);},[]):effects.restockFulfilments||[];
  var preferenceSheet=ss.getSheetByName(SHEETS.restockPreferences);
  if(fulfilments.length&&preferenceSheet&&preferenceSheet.getLastRow()>0&&!restockPreferenceSheetMatches_(preferenceSheet))throw websiteInputError_('補貨設定工作表格式已變更，請先確認。');
  if(effects.zeroStockDecision){applyZeroStockDecision_(ss,effects);return;}
  var restoreUpdates=prepareArrivalRestores_(ss,effects);
  if (effects.batch) {
    var drinks=catalog_(ss),supplies=supplyCatalog_(ss);
    effects.batch.forEach(function(child){if(child.newArrival){var row=child.supplyCatalog||child.catalog,items=child.supplyCatalog?supplies.filter(function(item){return item.kind===row[2];}):drinks;
      if(items.some(function(item){return item.id!==row[0]&&supplyProductKey_(item.name,item.flavor)===child.newArrivalNameKey;}))throw websiteInputError_('同名品項已建立，請重新整理後沿用原品項。');}});
    var collect=function(key){return effects.batch.reduce(function(rows,child){return rows.concat(child[key]||[]);},[]);};
    var supplyRows=effects.batch.filter(function(child){return child.supplyCatalog;}).map(function(child){return child.supplyCatalog;});
    if(effects.batch.some(function(child){return child.supplyHistory;}))ensureSupplyStorage_(ss);
    websiteAppendMissing_(ss.getSheetByName(SHEETS.supplyCatalog),supplyRows);
    websiteAppendMissing_(ss.getSheetByName(SHEETS.supplyHistory),collect('supplyHistory'));
    websiteAppendMissing_(ss.getSheetByName(SHEETS.catalog),effects.batch.filter(function(child){return child.catalog;}).map(function(child){return child.catalog;}));
    var products=effects.batch.filter(function(child){return child.product;}).map(function(child){return child.product;});
    if(products.length){websiteAppendMissing_(ensureSheet_(ss,SHEETS.products,PRODUCT_INTAKE_HEADERS),products);PropertiesService.getScriptProperties().setProperty('HOLDWIN_CATALOG_FORMS_DIRTY','true');}
    websiteAppendMissing_(ss.getSheetByName(SHEETS.history),collect('history'));
    applyArrivalRestores_(restoreUpdates);
    applyZeroRestockFulfilments_(ss,effects.batch.reduce(function(rows,child){return rows.concat(child.restockFulfilments||[]);},[]));
    return;
  }
  if(effects.supplyDetails){
    var detail=effects.supplyDetails,current=supplyCatalog_(ss).filter(function(item){return item.id===detail.id;})[0];
    if(!current||!((current.name===detail.expectedName&&(current.flavor||'')===detail.expectedFlavor)||(current.name===detail.name&&(current.flavor||'')===detail.flavor)))throw websiteInputError_('品名或口味已更新，請重新整理。');
    if(supplyCatalog_(ss).some(function(other){return other.id!==detail.id&&other.kind==='snack'&&supplyProductKey_(other.name,other.flavor)===supplyProductKey_(detail.name,detail.flavor);}))throw websiteInputError_('已有相同品名與口味。');
    ensureSupplyStorage_(ss);var sheet=ss.getSheetByName(SHEETS.supplyCatalog),rows=sheet.getRange(2,1,sheet.getLastRow()-1,7).getValues();
    var index=rows.map(function(row){return String(row[0]);}).indexOf(detail.id);var values=rows[index].slice(1,7);values[0]=sheetText_(detail.name);values[5]=sheetText_(detail.flavor);sheet.getRange(index+2,2,1,6).setValues([values]);return;
  }
  if (effects.recorderCorrections) {
    var currentEvents = supplyEvents_(ss);
    effects.recorderCorrections.forEach(function (row) {
      var event = currentEvents.filter(function (entry) { return entry.id === row[2]; })[0];
      if (!event || event.type !== 'expiry-set' || (event.recorder !== row[3] && event.recorder !== row[4])) throw websiteInputError_('效期登記人已變動，請重新讀取後確認。');
    });
    var headers = ['更正 ID','更正時間','效期紀錄 ID','原登記人','新登記人','採計狀態'];
    var sheet = ss.getSheetByName(SHEETS.recorderCorrections);
    if (sheet && sheet.getLastRow() > 0 && sheet.getRange(1,1,1,headers.length).getValues()[0].some(function (label,index) { return label !== headers[index]; })) throw websiteInputError_('登記人更正表已有其他用途，請先確認。');
    websiteAppendMissing_(sheet && sheet.getLastRow() > 0 ? sheet : ensureSheet_(ss,SHEETS.recorderCorrections,headers), effects.recorderCorrections);
  }
  if (effects.wish && effects.wish.length === 8) {
    var wishSheet = ss.getSheetByName(SHEETS.wishes), heading = wishSheet.getRange(1,8).getValues()[0][0];
    if (heading && heading !== '來源歷史品項 ID') throw websiteInputError_('WishReview 第八欄已有其他用途，請先確認。');
    if (!heading) wishSheet.getRange(1,8,1,1).setValues([['來源歷史品項 ID']]);
  }
  if (effects.restockPreference) {
    if (['normal','consider','hold','replace'].indexOf(effects.restockPreference[4]) < 0) throw websiteInputError_('補貨提醒設定不正確。');
    var sheet = ss.getSheetByName(SHEETS.restockPreferences);
    if (sheet && sheet.getLastRow() > 0 && !restockPreferenceSheetMatches_(sheet)) throw websiteInputError_('RestockPreferences 已有其他用途，請先確認工作表。');
    websiteAppendMissing_(ensureSheet_(ss,SHEETS.restockPreferences,RESTOCK_PREFERENCE_HEADERS),[effects.restockPreference]);
  }
  if (effects.newArrival) {
    var row = effects.supplyCatalog || effects.catalog;
    var items = effects.supplyCatalog ? supplyCatalog_(ss).filter(function (item) { return item.kind === row[2]; }) : catalog_(ss);
    if (items.some(function (item) { return item.id !== row[0] && (effects.supplyCatalog ? supplyProductKey_(item.name,item.flavor) : supplyProductKey_(item.name,'')) === effects.newArrivalNameKey; })) throw websiteInputError_('同名品項已由另一筆登記建立，請重新整理後沿用原品項入庫。');
  }
  if (effects.supplyHistory) {
    ensureSupplyStorage_(ss);
    if (effects.supplyCatalog) websiteAppendMissing_(ss.getSheetByName(SHEETS.supplyCatalog), [effects.supplyCatalog]);
    var history = ss.getSheetByName(SHEETS.supplyHistory);
    history.getRange(1, 10, Math.max(1, history.getLastRow() + effects.supplyHistory.length), 2).setNumberFormat('@');
    websiteAppendMissing_(history, effects.supplyHistory);
  }
  if (effects.catalog) {
    var catalog = catalog_(ss);
    var duplicate = catalog.filter(function (drink) { return drink.id !== effects.catalog[0] && productNameKey_(drink.name) === (effects.productKey || productNameKey_(effects.catalog[1])); })[0];
    if (duplicate) {
      effects.result.id = duplicate.id;
      effects.result.alreadyExists = true;
      effects.product[2] = duplicate.id;
      effects.product[7] = '未新增：品項已存在';
    } else {
      websiteAppendMissing_(ss.getSheetByName(SHEETS.catalog), [effects.catalog]);
      PropertiesService.getScriptProperties().setProperty('HOLDWIN_CATALOG_FORMS_DIRTY', 'true');
    }
    websiteAppendMissing_(ensureSheet_(ss, SHEETS.products, PRODUCT_INTAKE_HEADERS), [effects.product]);
  }
  websiteAppendMissing_(ss.getSheetByName(SHEETS.history), effects.history);
  applyArrivalRestores_(restoreUpdates);
  applyZeroRestockFulfilments_(ss,effects.restockFulfilments||[]);
  websiteAppendMissing_(ss.getSheetByName(SHEETS.wishes), effects.wish ? [effects.wish] : []);
  if (effects.vote) {
    var voteSheet = ss.getSheetByName(SHEETS.votes);
    var votes = voteSheet.getLastRow() > 1 ? voteSheet.getRange(2, 1, voteSheet.getLastRow() - 1, 6).getValues() : [];
    var duplicateVote = votes.filter(function (row) { return row[1] === effects.vote[1] && row[2] === effects.vote[2] && row[4] === '採計'; })[0];
    if (duplicateVote) effects.result.alreadyVoted = duplicateVote[0] !== effects.vote[0];
    else { effects.result.alreadyVoted = false; voteSheet.getRange(voteSheet.getLastRow() + 1, 1, 1, effects.vote.length).setValues([effects.vote]); votes.push(effects.vote); }
    // Re-read the current wish on recovery; a pending command may be retried later.
    var wish = wishRows_(ss).filter(function (entry) { return entry.id === effects.vote[1]; })[0];
    var support = voteSummaryRows_(votes);
    if (wish) { wish.votes = support.counts[wish.id] || 0; wish.supporters = support.names[wish.id] || []; effects.result.wish = wish; }
  }
  if (effects.operation === 'wish') {
    var wish = wishRows_(ss).filter(function (entry) { return entry.id === effects.result.id; })[0];
    if (wish) { var support = voteSummary_(ss); wish.votes = support.counts[wish.id] || 0; wish.supporters = support.names[wish.id] || []; effects.result.wish = wish; }
  }
  if (['wish','vote','archive-wish'].indexOf(effects.operation) >= 0) {
    effects.result.snapshotAt = snapshotAt;
  }
}

function wishRows_(ss) {
  var sheet = ss.getSheetByName(SHEETS.wishes);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues().map(function (row) {
    return { id: String(row[0]), name: text_(row[1], 80), url: safeUrl_(row[2]), note: text_(row[3], 500), status: ['pending', 'purchased', 'declined'].indexOf(row[4]) >= 0 ? row[4] : 'pending', createdAt: iso_(row[5]), kind: wishKind_(row[6]), ...(row[7] ? {sourceDrinkId:text_(row[7],160)} : {}) };
  }).filter(function (wish) { return wish.id && wish.name && wish.createdAt && wish.kind; });
}

function wishKind_(value) {
  var kind = String(value || '').trim();
  if (!kind || kind === 'drink' || kind === '飲料') return 'drink';
  return kind === 'snack' || kind === '零食' || kind === '點心' ? 'snack' : null;
}

// Availability is derived from recorded balances. Catalog IDs and all stock events stay intact.
// Persist during locked writes/bootstrap, never from an older concurrent read snapshot.
function cacheZeroDrinkIds_(inventory) {
  var ids=inventory.filter(function(entry){return entry.stock===0;}).map(function(entry){return entry.drink.id;}).sort();
  var props=PropertiesService.getScriptProperties(),value=JSON.stringify(ids);
  if(props.getProperty('HOLDWIN_ZERO_DRINK_IDS')!==value)props.setProperty('HOLDWIN_ZERO_DRINK_IDS',value);
  return ids;
}
function visibleDrinkCatalog_(ss,catalog,alreadyLocked) {
  var ids;
  try { ids=JSON.parse(PropertiesService.getScriptProperties().getProperty('HOLDWIN_ZERO_DRINK_IDS')||'null'); } catch(error) {}
  if(!Array.isArray(ids)){
    var bootstrap=function(){
      var cached;
      try { cached=JSON.parse(PropertiesService.getScriptProperties().getProperty('HOLDWIN_ZERO_DRINK_IDS')||'null'); } catch(error) {}
      return Array.isArray(cached)?cached:cacheZeroDrinkIds_(computeInventory_(catalog,historyEvents_(ss)));
    };
    ids=alreadyLocked?bootstrap():locked_(bootstrap);
  }
  return catalog.map(function(drink){return drink.active&&ids.indexOf(drink.id)>=0?Object.assign({},drink,{active:false,autoArchived:true}):drink;});
}
function visibleDrinkInventory_(inventory) {
  return inventory.map(function(entry){return entry.drink.active&&entry.stock===0?Object.assign({},entry,{drink:Object.assign({},entry.drink,{active:false,autoArchived:true})}):entry;});
}

function publicData_(spreadsheet, catalog) {
  // Timestamp precedes all reads so a later confirmed write always wins.
  var snapshotAt = new Date().toISOString();
  var ss = spreadsheet || requiredSpreadsheet_();
  var props = PropertiesService.getScriptProperties();
  var support = voteSummary_(ss);
  var wishes = wishRows_(ss).map(function (wish) { wish.votes = support.counts[wish.id] || 0; wish.supporters = support.names[wish.id] || []; return wish; });
  // Fridge responses never carry warehouse quantities or registration histories.
  var drinks = visibleDrinkCatalog_(ss,catalog || catalog_(ss)).map(function (drink) {
    return { id: drink.id, name: drink.name, category: drink.category, packaging: drink.packaging, unit: drink.unit, perCase: drink.perCase, threshold: drink.threshold, active: drink.active };
  });
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  var formUrls = websiteFormUrls_();
  return { ok: true, provider: 'google', websiteEntry: { version: 1, newArrivalVersion: 1, drinkCategoryVersion: 1, batchArrivalVersion: 1, archivedArrivalVersion: 1, wishReceiptVersion: 1, popularityVersion: 3, archiveWishVersion: 1, zeroStockVersion: 1, gachaVersion: 1, autoArchiveVersion: 1 }, snapshotAt: snapshotAt, drinks: drinks, wishes: wishes, formUrls: formUrls,
    wishForm: fields.wishKindEntry ? { url: formUrls.wish, kindEntryId: fields.wishKindEntry } : null,
    voteForm: { url: formUrls.vote, wishEntryId: fields.voteWishEntry || '', voterEntryId: fields.voteVoterEntry || '', voterNameEntryId: fields.voteNameEntry || '' },
    adminUrl: ss.getUrl() + '#gid=' + ss.getSheetByName(SHEETS.warehouse).getSheetId(),
    updatedAt: props.getProperty('HOLDWIN_PUBLIC_UPDATED_AT') || null };
}

function adminSummaryData_() {
  var ss=requiredSpreadsheet_(),preferences=restockPreferences_(ss),catalog=catalog_(ss),events=historyEvents_(ss),supplyEvents=supplyEvents_(ss);
  var rawInventory=computeInventory_(catalog,events);
  var drinks=visibleDrinkInventory_(rawInventory).map(function(entry){return Object.assign({},entry.drink,{kind:'drink',stock:entry.stock,lastCountAt:entry.lastCountAt,lastArrivalAt:entry.lastArrivalAt});});
  var supplies=supplyInventory_(supplyCatalog_(ss),supplyEvents),items=drinks.concat(supplies);
  function summary(item){var row={kind:item.kind,id:item.id,name:item.name,flavor:item.flavor||'',unit:item.unit,stock:item.stock,mode:restockMode_(preferences,item.kind,item.id)};if(preferences.some(function(entry){return entry.kind===item.kind&&entry.itemId===item.id&&entry.zeroStockPending===true;}))row.zeroStockPending=true;return row;}
  var active=items.filter(function(item){return item.active;});
  var restockItems=items.filter(function(item){return (item.active||item.autoArchived===true)&&restockMode_(preferences,item.kind,item.id)==='consider';}).map(summary).sort(function(a,b){return (a.stock===null?Infinity:a.stock)-(b.stock===null?Infinity:b.stock);});
  var lowItems=active.filter(function(item){return item.stock!==null&&(['snack','noodle'].indexOf(item.kind)<0||restockMode_(preferences,item.kind,item.id)==='consider')&&(item.kind==='toner'?item.stock===0:item.stock>0&&item.stock<=(item.kind==='noodle'?3:10));}).map(summary).sort(function(a,b){return a.stock-b.stock;});
  var outOfStockItems=active.filter(function(item){return item.kind!=='toner'&&item.stock===0;}).map(summary);
  var manualSnackItems=restockItems.filter(function(item){return item.kind==='snack';}).map(function(item){var preference=preferences.filter(function(entry){return entry.kind==='snack'&&entry.itemId===item.id;})[0];return Object.assign({},item,{markedAt:preference.updatedAt});});
  var rows=events.concat(supplyEvents).filter(function(event){return event.accepted!==false&&['count','restock'].indexOf(event.type)>=0;}).map(function(event){var item=items.filter(function(item){return item.id===(event.drinkId||event.supplyId);})[0];return item?{id:event.id,itemId:item.id,kind:item.kind,name:item.name,flavor:item.flavor||'',unit:item.unit,quantity:event.quantity,createdAt:event.createdAt,type:event.type}:null;}).filter(Boolean).sort(function(a,b){return Date.parse(b.createdAt)-Date.parse(a.createdAt);});
  var recentCounts=['drink','snack','noodle','toner'].map(function(kind){var counts=rows.filter(function(event){return event.kind===kind&&event.type==='count';}),stamp=counts.length?counts[0].createdAt:null;return {kind:kind,countedAt:stamp,items:counts.filter(function(event){return event.createdAt===stamp;}).slice(0,1000)};});
  return {ok:true,version:1,zeroStockVersion:1,snapshotAt:new Date().toISOString(),activityVersion:1,totalDrinks:catalog.length,pendingWishes:wishRows_(ss).filter(function(wish){return wish.status==='pending';}).length,restockItems:restockItems,lowItems:lowItems,outOfStockItems:outOfStockItems,manualSnackItems:manualSnackItems,recentArrivals:rows.filter(function(event){return event.type==='restock';}).slice(0,12),recentCounts:recentCounts};
}

function popularityData_() {
  var ss = requiredSpreadsheet_();
  return {ok:true,version:3,popularity:websiteWeeklyPopularity_(visibleDrinkCatalog_(ss,catalog_(ss)),historyEvents_(ss),new Date())};
}

// Monday–Friday elapsed days in Asia/Taipei; keep aligned with js/workdays.js.
function websiteWorkingDaysBetween_(start, end) {
  const from = +new Date(start), until = +new Date(end);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) return 0;
  const day = 86400000, week = 7 * day;
  const clock = stamp => {
    const shifted = stamp + 8 * 3600000 - 4 * day;
    const weeks = Math.floor(shifted / week);
    return weeks * 5 * day + Math.min(shifted - weeks * week, 5 * day);
  };
  return (clock(until) - clock(from)) / day;
}

// Keep this calculation aligned with js/domain.js; parity tests cover edge cases.
function websiteConsumption_(drinkId, events, now = new Date(), since = -Infinity) {
  const result = { dailyRate: null, days: 0, consumed: 0, samples: 0, anomaly: false };
  const cutoff = new Date(now).getTime();
  const timeline = (Array.isArray(events) ? events : [])
    .filter((event) => event.drinkId === drinkId && ['count', 'restock'].includes(event.type))
    .map((event) => ({ ...event, timestamp: Date.parse(event.createdAt) }))
    .filter((event) => Number.isFinite(event.timestamp) && event.timestamp >= since && event.timestamp <= cutoff)
    .sort((left, right) => left.timestamp - right.timestamp);

  let previousCount = null;
  let received = 0;
  let invalidInterval = false;
  for (const event of timeline) {
    const valid = Number.isSafeInteger(event.quantity) && event.quantity >= 0;
    if (event.type === 'restock') {
      if (previousCount) {
        if (valid) received += event.quantity;
        else invalidInterval = result.anomaly = true;
      }
      continue;
    }

    if (!valid) {
      previousCount = null;
      received = 0;
      invalidInterval = false;
      result.anomaly = true;
      continue;
    }

    if (previousCount) {
      const days = websiteWorkingDaysBetween_(previousCount.timestamp, event.timestamp);
      const consumed = previousCount.quantity + received - event.quantity;
      if (days >= 1 && consumed >= 0 && Number.isSafeInteger(consumed) && !invalidInterval) {
        result.days += days;
        result.consumed += consumed;
        result.samples += 1;
      } else if (consumed < 0 || invalidInterval || !Number.isSafeInteger(consumed)) {
        result.anomaly = true;
      }
    }
    previousCount = event;
    received = 0;
    invalidInterval = false;
  }

  if (result.samples > 0) result.dailyRate = result.consumed / result.days;
  return result;
}

/** Rank observed weekly container consumption, never stock levels or clicks. */
function websiteWeeklyPopularity_(drinks, events, now = new Date()) {
  const until = +new Date(now), since = until - 30 * 86400000;
  const grouped = new Map();
  for (const event of events || []) {
    if (event.accepted === false) continue;
    if (!grouped.has(event.drinkId)) grouped.set(event.drinkId, []);
    grouped.get(event.drinkId).push(event);
  }
  let countedProducts = 0, observedProducts = 0;
  const rows = [];
  for (const drink of drinks.filter(item => item.active !== false)) {
    const timeline = grouped.get(drink.id) || [];
    if (timeline.some(event => event.type === 'count' && Number.isSafeInteger(event.quantity) && event.quantity >= 0 && Date.parse(event.createdAt) <= +new Date(now))) countedProducts += 1;
    const result = websiteConsumption_(drink.id, timeline, now, since);
    // A few minutes between counts cannot support a useful weekly estimate.
    if (result.anomaly || result.dailyRate === null || result.days < 1) continue;
    observedProducts += 1;
    if (result.dailyRate > 0) rows.push({ id: drink.id, name: drink.name, unit: drink.unit, weeklyRate: result.dailyRate * 5, days: result.days, samples: result.samples });
  }
  rows.sort((left, right) => right.weeklyRate - left.weeklyRate || left.name.localeCompare(right.name, 'zh-Hant'));
  return { rows: rows.slice(0, 3), countedProducts, observedProducts, workweekDays: 5, windowDays:30, windowStartAt:new Date(since).toISOString(), windowEndAt:new Date(until).toISOString(), calculatedAt: new Date(now).toISOString() };
}

function warehouseData_() {
  var ss = requiredSpreadsheet_();
  var catalog = catalog_(ss);
  var events = historyEvents_(ss).filter(function (event) { return event.accepted; });
  var inventory=computeInventory_(catalog,events);
  var result = publicData_(ss, catalog);
  result.drinks = visibleDrinkInventory_(inventory).map(function (entry) {
    var drink = entry.drink;
    return { id: drink.id, name: drink.name, category: drink.category, packaging: drink.packaging, unit: drink.unit,
      perCase: drink.perCase, threshold: drink.threshold, active: drink.active,
      stock: entry.stock, target: null, lastCountAt: entry.lastCountAt, lastArrivalAt:entry.lastArrivalAt||null,autoArchived:drink.autoArchived===true };
  });
  result.events = events.map(function (event) {
    return { id: event.id, drinkId: event.drinkId, type: event.type, quantity: event.quantity,
      createdAt: event.createdAt, note: event.note, recorder: event.recorder || publicRecorder_(event.email) };
  });
  var active = result.drinks.filter(function (drink) { return drink.active; });
  result.lastInventoryAt = active.length && active.every(function (drink) { return drink.lastCountAt; })
    ? active.map(function (drink) { return drink.lastCountAt; }).sort()[0] : null;
  result.supplyEntry = { version: 1, expiryVersion: 1, expirySetVersion: 1, recorderCorrectionVersion: 1, snackVersion: 1, snackPolicyVersion: 2, snackFlavorVersion: 1 };
  result.supplyEvents = supplyEvents_(ss);
  result.supplies = supplyInventory_(supplyCatalog_(ss), result.supplyEvents);
  result.restockPreferenceEntry = {version:1,snackManualVersion:1,manualAllVersion:1};
  result.restockPreferences = restockPreferences_(ss);
  return result;
}

function restockPreferenceSheetMatches_(sheet) {
  var first = sheet.getRange(1,1,1,RESTOCK_PREFERENCE_HEADERS.length).getValues()[0];
  return RESTOCK_PREFERENCE_HEADERS.every(function (label,index) { return first[index] === label; });
}

function restockPreferences_(ss) {
  var sheet = ss.getSheetByName(SHEETS.restockPreferences), latest = Object.create(null);
  if (!sheet || sheet.getLastRow() < 2 || !restockPreferenceSheetMatches_(sheet)) return [];
  sheet.getRange(2,1,sheet.getLastRow()-1,7).getValues().forEach(function (row) {
    if (row[6] !== '採計') return;
    var kind=String(row[2]),itemId=String(row[3]),mode=String(row[4]),updatedAt=iso_(row[1]);
    if (['drink','snack','noodle','toner'].indexOf(kind)<0 || !/^[A-Za-z0-9_-]{1,160}$/.test(itemId) || ['normal','hold','replace','consider'].indexOf(mode)<0 || !updatedAt) throw new Error('Invalid restock preference');
    var key=kind+':'+itemId;
    if (!latest[key] || Date.parse(updatedAt)>=Date.parse(latest[key].updatedAt)) { latest[key]={kind:kind,itemId:itemId,mode:mode,updatedAt:updatedAt};if(row[5]==='zero-stock:pending'&&mode==='consider')latest[key].zeroStockPending=true; }
  });
  return Object.keys(latest).map(function (key) { return latest[key]; });
}

function restockMode_(preferences, kind, itemId) {
  var found=preferences.filter(function (entry) { return entry.kind===kind && entry.itemId===itemId; })[0];
  return found ? found.mode : 'normal';
}

function restockModeLabel_(mode) { return mode==='consider'?'需要補貨':mode==='hold'?'暫不需要補貨':mode==='replace'?'可以準備替換新品項':''; }

function restockThreshold_(kind) { return kind === 'drink' ? 10 : kind === 'noodle' ? 1 : kind === 'toner' ? 0 : null; }

function inventoryIsLow_(kind, entry) {
  var threshold = restockThreshold_(kind);
  return threshold !== null && !!entry.lastCountAt && Number.isSafeInteger(entry.stock) && entry.stock >= 0 && entry.stock <= threshold;
}

function inventoryRestockStatus_(kind, entry, mode) { return restockModeLabel_(mode); }

function sortInventoryEntries_(entries,preferences) {
  function stock(entry) { return entry.stock!==null ? entry.stock : Infinity; }
  function marked(entry){return restockMode_(preferences||[],entry.drink?'drink':entry.kind,entry.drink?entry.drink.id:entry.id)==='consider';}
  return entries.slice().sort(function(a,b){return Number(marked(b))-Number(marked(a))||(stock(a)===stock(b)?0:stock(a)-stock(b));});
}

// Reading a newly upgraded deployment needs no setupOnce or sheet mutation.
// The first explicit supply write creates the new tables inside the same lock.
function supplyNeedsExpiry_(kind) { return kind === 'noodle'; }
// Retain old dated snack batches for history and idempotent command recovery.
function supplyTracksExpiry_(kind) { return kind === 'snack' || kind === 'noodle'; }

function websiteSupplyExpiry_(kind, value, stamp) {
  if (!supplyNeedsExpiry_(kind) && (value === undefined || value === null || value === '')) return '';
  var expiry = validSupplyExpiry_(value);
  if (!expiry || (supplyNeedsExpiry_(kind) && expiry < supplyToday_(stamp))) throw websiteInputError_(supplyNeedsExpiry_(kind) ? '泡麵入庫請填寫有效的保存期限，不能早於今天。' : '保存期限格式不正確。');
  return expiry;
}

function supplyProductKey_(name,flavor) { var aliases={'多力多滋雙倍起司口味':['多力多滋','雙倍起司'],'多力多滋香菜口味':['多力多滋','香菜'],'樂事海苔口味':['樂事','海苔'],'華元蚵仔煎':['華元洋芋片','蚵仔煎'],'華元辣蚵仔煎':['華元洋芋片','辣蚵仔煎']},key=productNameKey_(name);if(!flavor&&Object.prototype.hasOwnProperty.call(aliases,key)){name=aliases[key][0];flavor=aliases[key][1];}return productNameKey_(name)+'\u0000'+productNameKey_(flavor||''); }

function supplyCatalog_(ss) {
  var sheet = ss.getSheetByName(SHEETS.supplyCatalog), seen = Object.create(null);
  var rows = sheet && sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues() : [];
  var supplies = rows.filter(function (row) { return row[0] || row[1]; }).map(function (row) {
    var id = String(row[0]), kind = String(row[2]), name = text_(row[1], 80), unit = String(row[3]);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || seen[id] || !name || ['snack','noodle','toner'].indexOf(kind) < 0 || (kind === 'noodle' ? ['杯','碗'] : kind === 'snack' ? SNACK_UNITS : ['盒']).indexOf(unit) < 0) throw new Error('Invalid supply catalog');
    var known = INITIAL_SUPPLIES.filter(function (item) { return item.id === id; })[0];
    if (known && (known.kind !== kind || known.unit !== unit)) throw new Error('Invalid confirmed supply unit');
    if (kind === 'toner' && !INITIAL_SUPPLIES.some(function (item) { return item.kind === 'toner' && item.id === id && item.unit === unit; })) throw new Error('Invalid toner color');
    var category = kind === 'snack' ? text_(row[5],80) || (known ? known.category : '') : '';
    var flavor = kind === 'snack' ? text_(row[6],80) : '';
    var legacy = {'supply-snack-01':'多力多滋雙倍起司口味','supply-snack-02':'多力多滋香菜口味','supply-snack-03':'樂事海苔口味','supply-snack-04':'華元蚵仔煎'};
    if (known && legacy[id] === name && !flavor) { name = known.name; flavor = known.flavor || ''; }
    if (kind === 'snack' && SNACK_CATEGORIES.indexOf(category) < 0) throw new Error('Invalid snack category');
    seen[id] = true;
    return { id: id, name: name, kind: kind, unit: unit, active: row[4] !== false && String(row[4]).toLowerCase() !== 'false', ...(kind === 'snack' ? {category:category,flavor:flavor} : {}) };
  });
  INITIAL_SUPPLIES.forEach(function (item) { if (!seen[item.id]) supplies.push({ id: item.id, name: item.name, kind: item.kind, unit: item.unit, active: item.active, ...(item.kind === 'snack' ? {category:item.category,flavor:item.flavor||''} : {}) }); });
  return supplies;
}

function ensureSupplyStorage_(ss) {
  var catalog = ss.getSheetByName(SHEETS.supplyCatalog), categoryMissing = false;
  if (catalog && catalog.getLastRow() > 0) {
    var header = catalog.getRange(1,1,1,7).getValues()[0];
    if (!SUPPLY_CATALOG_HEADERS.slice(0,5).every(function (label,index) { return header[index] === label; }) || (header[5] && header[5] !== 'category') || (header[6] && header[6] !== 'flavor')) throw websiteInputError_('SupplyCatalog 已有其他用途，請先確認品項與分類欄位。');
    categoryMissing = !header[5];
  }
  catalog = ensureSheet_(ss, SHEETS.supplyCatalog, SUPPLY_CATALOG_HEADERS);
  if (categoryMissing) catalog.getRange(1,6,1,1).setValues([['category']]);
  catalog.getRange(1,7,1,1).setValues([['flavor']]);
  websiteAppendMissing_(catalog, INITIAL_SUPPLIES.map(function (item) { return [item.id, item.name, item.kind, item.unit, true, item.category || '', sheetText_(item.flavor || '')]; }));
  var history = ss.getSheetByName(SHEETS.supplyHistory);
  if (history && history.getLastRow() > 0) {
    var first = history.getRange(1, 1, 1, 9).getValues()[0];
    if (!SUPPLY_HISTORY_HEADERS.slice(0,9).every(function (label,index) { return first[index] === label; })) throw new Error('SupplyHistory schema conflict');
  }
  history = ensureSheet_(ss, SHEETS.supplyHistory, SUPPLY_HISTORY_HEADERS);
  history.getRange(1, 10, 1, 2).setValues([SUPPLY_HISTORY_HEADERS.slice(9)]);
}

function supplyToday_(stamp) { return new Date(Date.parse(stamp) + 8 * 3600000).toISOString().slice(0, 10); }
function validSupplyExpiry_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  var time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}

function supplyEvents_(ss) {
  var sheet = ss.getSheetByName(SHEETS.supplyHistory);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var corrections = supplyRecorderCorrections_(ss);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues().filter(function (row) { return row[8] === '採計'; }).map(function (row) {
    var type = String(row[2]), quantity = quantity_(row[5], ['restock','expiry-set'].indexOf(type) < 0), stamp = iso_(row[1]);
    var expiry = row[9] instanceof Date ? supplyToday_(row[9].toISOString()) : String(row[9] || '');
    if (['count','restock','expiry-close','expiry-set'].indexOf(type) < 0 || quantity === null || !stamp || (expiry && !validSupplyExpiry_(expiry)) || (type === 'expiry-close' && (!row[10] || quantity !== 0)) || (type === 'expiry-set' && (!expiry || !row[10]))) throw new Error('Invalid supply history');
    return { id: String(row[0]), supplyId: String(row[3]), type: type, quantity: quantity, createdAt: stamp, note: text_(row[6], 500), recorder: correctedSupplyRecorder_(String(row[0]),text_(row[7],80),corrections), expiresOn: expiry || null, batchId: String(row[10] || '') || null };
  });
}

function supplyRecorderCorrections_(ss) {
  var sheet = ss.getSheetByName(SHEETS.recorderCorrections);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues().filter(function (row) { return row[5] === '採計'; });
}

function correctedSupplyRecorder_(id, recorder, corrections) {
  corrections.forEach(function (row) { if (row[2] === id && row[3] === recorder) recorder = text_(row[4],80); });
  return recorder;
}

function openSupplyBatches_(supplyId, events) {
  var batches = [], expiryGroup = null;
  events.map(function (event,index) { return {event:event,index:index}; }).filter(function (entry) { return entry.event.supplyId === supplyId; })
    .sort(function (a,b) { return Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt) || a.index - b.index; }).forEach(function (entry) {
      var event = entry.event;
      if (event.type === 'count' && event.quantity === 0) batches = [];
      else if (event.type === 'restock') batches.push(event);
      else if (event.type === 'expiry-set') {
        if (event.batchId !== expiryGroup) { batches = []; expiryGroup = event.batchId; }
        batches.push(event);
      }
      else if (event.type === 'expiry-close') batches = batches.filter(function (batch) { return batch.id !== event.batchId; });
    });
  return batches;
}

function supplyInventory_(supplies, events) {
  return supplies.map(function (item) {
    var stock = null, lastCountAt = null, lastArrivalAt = null;
    events.map(function (event, index) { return { event: event, index: index }; }).filter(function (entry) { return entry.event.supplyId === item.id; })
      .sort(function (a,b) { return Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt) || a.index - b.index; })
      .forEach(function (entry) { var event = entry.event; if (event.type === 'count') { stock = event.quantity; lastCountAt = event.createdAt; } else if (event.type === 'restock') { stock = (stock === null ? 0 : stock) + event.quantity; lastArrivalAt = event.createdAt; } });
    if (stock !== null && (!Number.isSafeInteger(stock) || stock > 999999)) throw new Error('Invalid supply balance');
    return { id: item.id, name: item.name, kind: item.kind, unit: item.unit, active: item.active, stock: stock, lastCountAt: lastCountAt, lastArrivalAt:lastArrivalAt, ...(item.kind === 'snack' ? {category:item.category,flavor:item.flavor||''} : {}) };
  });
}

function renderSupplyWarehouse_(ss) {
  var sheet = ensureSheet_(ss, SHEETS.supplyWarehouse);
  var events = supplyEvents_(ss), inventory = sortInventoryEntries_(supplyInventory_(supplyCatalog_(ss), events)), preferences=restockPreferences_(ss);
  inventory = sortInventoryEntries_(inventory,preferences);
  var headers = ['品項 ID','品項名稱','分類','單位','目前庫存','最近實際盤點','入庫批次保存期限','補貨標示','零食分類','零食口味'];
  // Do not replace an unrelated existing sheet with a coinciding name.
  if (sheet.getLastRow() > 0) {
    var first = sheet.getRange(1, 1, 1, 6).getValues()[0];
    if (!headers.slice(0,6).every(function (label,index) { return first[index] === label; })) return;
  }
  // Generated view only; the source catalog and history are never cleared.
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (inventory.length) sheet.getRange(2, 1, inventory.length, headers.length).setValues(inventory.map(function (item) {
    return [item.id, sheetText_(item.name), item.kind === 'snack' ? '零食' : item.kind === 'noodle' ? '泡麵' : '碳粉', item.unit, item.stock === null ? '待盤點' : item.stock, item.lastCountAt || '', supplyNeedsExpiry_(item.kind) ? openSupplyBatches_(item.id,events).map(function (event) { return (event.expiresOn || '效期待補') + (event.type === 'expiry-set' ? '｜效期核對 ' : '｜入庫 ') + event.quantity + ' ' + item.unit; }).join('\n') : '', inventoryRestockStatus_(item.kind,item,restockMode_(preferences,item.kind,item.id)), item.category || '', sheetText_(item.flavor || '')];
  }));
  styleHeader_(sheet, 1, headers.length); sheet.setFrozenRows(1);
}

function publicRecorder_(value) {
  var name = text_(value, 80);
  return name.indexOf('@') >= 0 ? '先前管理者' : name;
}

function refreshWarehouse_() {
  var ss = requiredSpreadsheet_();
  var caseSizesUpdated = migrateCaseSizes_(ss);
  // Add actual submitted products before reading stock responses, then update
  // form choices in the same locked refresh. No count or arrival is invented.
  var added = syncNewProducts_(ss);
  var props = PropertiesService.getScriptProperties();
  if (caseSizesUpdated || added || props.getProperty('HOLDWIN_CATALOG_FORMS_DIRTY') === 'true') {
    configureForms_(ss);
    props.setProperty('HOLDWIN_CATALOG_FORMS_DIRTY', 'false');
  }
  var catalog = catalog_(ss);
  var recorded = historyEvents_(ss);
  var seenResponses = {};
  recorded.forEach(function (event) { seenResponses[event.id.slice(0, event.id.lastIndexOf(':'))] = true; });
  var fresh = intakeEvents_(catalog, seenResponses);
  appendHistory_(ss, fresh);
  syncWishes_(ss);
  syncVotes_(ss);
  // Accepted historical facts stay accepted if a manager changes later.
  // Each response's intake decision is recorded once, never re-authorized
  // retroactively against a newer account allowlist.
  var inventory = computeInventory_(catalog, recorded.concat(fresh));
  renderWarehouse_(ss, inventory);
  renderArchive_(ss, inventory);
}

function historyEvents_(ss) {
  var sheet = ss.getSheetByName(SHEETS.history);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues().map(function (row) {
    return { id: String(row[0]), createdAt: iso_(row[1]), type: String(row[2]), drinkId: String(row[3]), quantity: quantity_(row[5], row[2] === 'count'), note: String(row[6] || ''), email: String(row[7] || ''), recorder: publicRecorder_(row[7]), accepted: row[8] === '採計' };
  }).filter(function (event) { return event.id && event.createdAt && (!event.accepted || (['count', 'restock'].indexOf(event.type) >= 0 && event.quantity !== null)); });
}

function computeInventory_(catalog, events) {
  return catalog.map(function(drink){
    var stock=null,lastCountAt=null,lastArrivalAt=null,received=0;
    events.map(function(event,index){return {event:event,index:index};}).filter(function(row){return row.event.accepted&&row.event.drinkId===drink.id;}).sort(function(a,b){return Date.parse(a.event.createdAt)-Date.parse(b.event.createdAt)||a.index-b.index;}).forEach(function(row){var event=row.event;
      if(event.type==='count'){stock=event.quantity;lastCountAt=event.createdAt;received=0;}else if(event.type==='restock'){stock=(stock===null?0:stock)+event.quantity;received+=event.quantity;lastArrivalAt=event.createdAt;}
    });
    if(stock!==null&&(!Number.isSafeInteger(stock)||stock>999999||stock<0))throw new Error('Invalid drink balance');
    return {drink:drink,stock:stock,lastCountAt:lastCountAt,lastArrivalAt:lastArrivalAt,receivedAfterCount:stock===null?null:received};
  });
}

function intakeEvents_(catalog, seenResponses) {
  var props = PropertiesService.getScriptProperties();
  var forms = forms_();
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  var events = [];
  ['stocktake', 'arrival'].forEach(function (kind) {
    forms[kind].getResponses().forEach(function (response) {
      var stamp = iso_(response.getTimestamp());
      var responseId = response.getId();
      if (seenResponses && seenResponses[responseId]) return;
      var answers = {};
      response.getItemResponses().forEach(function (item) { answers[String(item.getItem().getId())] = item.getResponse(); });
      var rawRecorder = String(answers[kind === 'stocktake' ? fields.countRecorder : fields.arrivalRecorder] || '').trim();
      var recorder = text_(rawRecorder, 80);
      function reject(note) {
        events.push({ id: responseId + ':rejected', type: 'rejected', createdAt: stamp, recorder: recorder, email: recorder, accepted: false, note: note });
      }
      if (!stamp || !recorder || rawRecorder.length > 80 || rawRecorder !== recorder) {
        reject('登記人或收件時間無效；未計入庫存');
        return;
      }
      if (kind === 'stocktake') {
        var active = catalog.filter(function (drink) { return drink.active !== false; });
        var pending = [];
        var valid = active.every(function (drink) {
          var itemId = Object.keys(fields.count || {}).filter(function (id) { return fields.count[id] === drink.id; })[0];
          if (!itemId || answers[itemId] == null || String(answers[itemId]).trim() === '') return true;
          var quantity = quantity_(answers[itemId], true);
          if (quantity === null) return false;
          pending.push({ id: responseId + ':' + itemId, type: 'count', drinkId: drink.id, quantity: quantity, createdAt: stamp, recorder: recorder, email: recorder, accepted: true, note: 'Google 表單實際盤點' });
          return true;
        });
        if (!valid || !pending.length) reject('請至少填寫一個品項，且已填數量須為有效整數；整份未計入庫存');
        else events = events.concat(pending);
      } else {
        var drinkId = String(answers[fields.arrivalDrink] || '').split('｜')[0].trim();
        var drink = catalog.filter(function (entry) { return entry.id === drinkId && entry.active !== false; })[0];
        var quantity = arrivalQuantity_(answers[fields.arrivalCases], answers[fields.arrivalQuantity], drink && drink.perCase);
        if (!drink || quantity === null) {
          reject('到貨品項或數量無效；未計入庫存');
          return;
        }
        events.push({ id: responseId + ':arrival', type: 'restock', drinkId: drinkId, quantity: quantity, createdAt: stamp, recorder: recorder, email: recorder, accepted: true, note: text_(answers[fields.arrivalNote], 500) });
      }
    });
  });
  return events;
}

function initializeCatalog_(ss) {
  var sheet = ss.getSheetByName(SHEETS.catalog);
  if (!sheet) {
    var first = ss.getSheets()[0];
    sheet = ss.getSheets().length === 1 && first.getLastRow() === 0 ? first.setName(SHEETS.catalog) : ss.insertSheet(SHEETS.catalog);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 8).setValues([['id', 'name', 'category', 'packaging', 'unit', 'perCase', 'threshold', 'active']]);
  }
  var lastRow = sheet.getLastRow();
  var existingRows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 8).getValues() : [];
  var knownIds = {};
  existingRows.forEach(function (row, index) {
    knownIds[String(row[0])] = true;
    // Apply only the owner's exact name corrections, retaining the product ID,
    // custom category, stock, history and all other administrator changes.
    if (row[0] === 'company-drink-09' && row[1] === '立頓巧克力牛奶') {
      sheet.getRange(index + 2, 2).setValue('立頓巧克力奶茶');
      if (['牛奶／豆漿','牛乳／豆漿','牛乳／植物奶'].indexOf(row[2]) >= 0) sheet.getRange(index + 2, 3).setValue('茶飲');
    }
    if (row[0] === 'company-drink-07' && row[1] === '波利芭樂汁') sheet.getRange(index + 2, 2).setValue('波蜜芭樂汁');
    if (row[0] === 'company-drink-14' && row[1] === '波蜜一日蔬果') sheet.getRange(index + 2, 2).setValue('一日蔬果100%蘋果柳橙蔬果汁');
    if (row[0] === 'company-drink-22' && ['Milkiis水蜜桃', 'Miilkis水蜜桃'].indexOf(row[1]) >= 0) sheet.getRange(index + 2, 2).setValue('Milkis水蜜桃');
    if (row[0] === 'company-drink-23' && ['Miilkis', 'Milkiis'].indexOf(row[1]) >= 0) sheet.getRange(index + 2, 2).setValue('Milkis');
  });
  var additions = INITIAL_CATALOG.filter(function (drink) { return !knownIds[drink.id]; }).map(function (drink) {
    return [drink.id, drink.name, drink.category, drink.packaging, drink.unit, DEFAULT_CASE_SIZE, 10, drink.active !== false];
  });
  if (additions.length) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, additions.length, 8).setValues(additions);
    sheet.getRange(startRow, 8, additions.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  }
  styleHeader_(sheet, 1, 8);
  sheet.setFrozenRows(1);
}

function canonicalDrinkCategory_(category, name) {
  if(name==='可爾必思開心成長160ml'&&['牛乳／植物奶','牛奶／豆漿'].indexOf(category)>=0)return '其他';
  if (['牛奶／豆漿','牛乳／豆漿','牛奶/豆漿','牛乳/豆漿'].indexOf(category) >= 0) return '牛乳／植物奶';
  var corrections = {'午后時光重乳奶茶':'茶飲','義美寶吉葡萄汁':'果汁','波蜜蜂蜜檸檬':'果汁','光泉薏仁糙米漿':'牛乳／植物奶'};
  return category === '其他' && Object.prototype.hasOwnProperty.call(corrections,name) ? corrections[name] : category;
}

function catalog_(ss) {
  var sheet = ss.getSheetByName(SHEETS.catalog);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var seen = {};
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues().filter(function (row) { return row[0] || row[1]; }).map(function (row) {
    var id = String(row[0]).trim();
    var name = text_(row[1], 80);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || seen[id] || !name) throw new Error('Catalog ID 不可空白或重複，飲料名稱不可空白。');
    seen[id] = true;
    var perCase = quantity_(row[5], false);
    var threshold = quantity_(row[6], true);
    return { id: id, name: name, category: canonicalDrinkCategory_(text_(row[2], 30),name), packaging: text_(row[3], 30), unit: ['包', '瓶', '罐'].indexOf(row[4]) >= 0 ? row[4] : '包', perCase: perCase, threshold: threshold === null ? 10 : threshold, active: row[7] !== false && String(row[7]).toLowerCase() !== 'false' };
  });
}

function migrateCaseSizes_(ss) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('HOLDWIN_CASE_SIZE_VERSION') === '1') return false;
  var sheet = ss.getSheetByName(SHEETS.catalog);
  if (!sheet) return false;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    sheet.getRange(2, 6, rows.length, 1).setValues(rows.map(function (row) { return [row[0] || row[1] ? DEFAULT_CASE_SIZE : row[5]]; }));
  }
  props.setProperty('HOLDWIN_CASE_SIZE_VERSION', '1');
  props.setProperty('HOLDWIN_CATALOG_FORMS_DIRTY', 'true');
  props.setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
  return true;
}

function productNameKey_(value) {
  return String(value || '').trim().normalize('NFKC').toLowerCase();
}

function productResponseId_(responseId) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(responseId), Utilities.Charset.UTF_8);
  return 'custom-drink-' + digest.map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function syncNewProducts_(ss) {
  var props = PropertiesService.getScriptProperties();
  var formId = props.getProperty('HOLDWIN_PRODUCT_FORM_ID');
  if (!formId) return 0; // Older deployments keep their existing read paths.
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  var sheet = ensureSheet_(ss, SHEETS.products, PRODUCT_INTAKE_HEADERS);
  var catalogSheet = ss.getSheetByName(SHEETS.catalog);
  var catalog = catalog_(ss);
  var knownResponses = Object.create(null), knownIds = Object.create(null), names = Object.create(null);
  catalog.forEach(function (drink) { knownIds[drink.id] = drink; names[productNameKey_(drink.name)] = drink.id; });
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (row) { knownResponses[String(row[0])] = true; });
  var additions = [], intake = [];
  FormApp.openById(formId).getResponses().forEach(function (response) {
    var responseId = String(response.getId() || '');
    if (!responseId || knownResponses[responseId]) return;
    knownResponses[responseId] = true;
    var answers = {};
    response.getItemResponses().forEach(function (item) { answers[String(item.getItem().getId())] = item.getResponse(); });
    var name = String(answers[fields.productName] || '').trim();
    var category = canonicalDrinkCategory_(String(answers[fields.productCategory] || '').trim());
    var packaging = String(answers[fields.productPackaging] || '').trim();
    var recorder = String(answers[fields.productRecorder] || '').trim();
    var stamp = iso_(response.getTimestamp());
    var id = productResponseId_(responseId);
    var key = productNameKey_(name);
    var status = !stamp || !name || name.length > 80 || !recorder || recorder.length > 80 ? '未採計：請填有效品名與登記人'
      : PRODUCT_CATEGORIES.indexOf(category) < 0 || PRODUCT_PACKAGING.indexOf(packaging) < 0 ? '未採計：分類或包裝無效'
      : names[key] && names[key] !== id ? '未採計：品項已存在，請沿用原品項'
      : !knownIds[id] && catalog.length + additions.length >= 1000 ? '未採計：品項數量已達上限' : '採計';
    if (status === '採計' && !knownIds[id]) {
      var unit = ['寶特瓶', '大瓶裝'].indexOf(packaging) >= 0 ? '瓶' : packaging.indexOf('鐵罐') >= 0 ? '罐' : '包';
      additions.push([id, sheetText_(name), category, packaging, unit, DEFAULT_CASE_SIZE, 10, true]);
      knownIds[id] = { id: id }; names[key] = id;
    }
    intake.push([sheetText_(responseId), stamp || '', status === '採計' ? id : '', sheetText_(text_(name, 80)), sheetText_(text_(category, 30)), sheetText_(text_(packaging, 30)), sheetText_(text_(recorder, 80)), status]);
  });
  // Catalog first makes a partial-write retry safe: stable response-derived IDs
  // never add the same product twice, and existing rows are never overwritten.
  if (additions.length) {
    props.setProperty('HOLDWIN_CATALOG_FORMS_DIRTY', 'true');
    catalogSheet.getRange(catalogSheet.getLastRow() + 1, 1, additions.length, 8).setValues(additions);
  }
  if (intake.length) sheet.getRange(sheet.getLastRow() + 1, 1, intake.length, 8).setNumberFormat('@').setValues(intake);
  if (additions.length) props.setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
  return additions.length;
}

function configureForms_(ss) {
  var props = PropertiesService.getScriptProperties();
  var catalog = catalog_(ss);
  var stocktake = ensureForm_('HOLDWIN_COUNT_FORM_ID', '宏穩茶水間｜盤點', ss);
  var arrival = ensureForm_('HOLDWIN_ARRIVAL_FORM_ID', '宏穩茶水間｜到貨入庫', ss);
  var wish = ensureForm_('HOLDWIN_WISH_FORM_ID', '宏穩茶水間｜採買許願池', ss);
  var vote = ensureForm_('HOLDWIN_VOTE_FORM_ID', '宏穩茶水間｜我也喜歡', ss);
  var product = ensureForm_('HOLDWIN_PRODUCT_FORM_ID', '宏穩茶水間｜快速新增飲料', ss);
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  fields.count = fields.count || {};
  stocktake.setTitle('宏穩茶水間｜盤點').setDescription('不用登入，請填寫登記人。至少填一個品項的實際單包／瓶／罐數量即可；空白代表這次未盤點，保留原紀錄，填 0 才代表實際剩餘 0。Google 自動記錄收到表單的時間；全空白不計入盤點。').setCollectEmail(false);
  arrival.setTitle('宏穩茶水間｜到貨入庫').setDescription('不用登入，請填寫登記人。整箱或零散數量至少填一項且大於 0；兩項都填會加總，每箱預設 24 包／瓶／罐。實際收到才登記，分批收到就分次填寫。兩項都留白或為 0 不計入庫存。Google 自動記錄時間。').setCollectEmail(false);
  wish.setTitle('宏穩茶水間｜採買許願池').setDescription('先選擇飲料許願或零食許願，再留下想買的品項、連結與備註。許願不用填姓名。').setCollectEmail(false);
  vote.setTitle('宏穩茶水間｜我也喜歡').setDescription('請填姓名，再送出贊同。姓名會顯示在網站的贊同名單。保留網站預填的願望代號與匿名識別碼；同一瀏覽器的同一個願望只計一票。').setCollectEmail(false);
  product.setTitle('宏穩茶水間｜快速新增飲料').setDescription('填品名、分類、包裝與登記人即可新增。圖片可以之後再補，先以包裝示意圖上架；數量仍須另外實際盤點或入庫，不會自動填入。已有品項請沿用原品項，避免重複。').setCollectEmail(false);
  [stocktake, arrival, wish, vote, product].forEach(function (form) { form.setLimitOneResponsePerUser(false).setShowLinkToRespondAgain(false).setAllowResponseEdits(false); });
  var recorderValidator = FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('請填寫姓名或大家認得的暱稱，最多 80 字。').build();
  var countRecorder = findItem_(stocktake, '登記人', 'text').setRequired(true).setValidation(recorderValidator);
  var arrivalRecorder = findItem_(arrival, '登記人', 'text').setRequired(true).setValidation(recorderValidator);
  var countValidator = FormApp.createTextValidation().requireTextMatchesPattern('^(0|[1-9][0-9]{0,5})$').setHelpText('請填 0 到 999999 的整數。').build();
  Object.keys(fields.count).forEach(function (itemId) {
    var row = catalog.filter(function (drink) { return drink.id === fields.count[itemId]; })[0];
    if (!row || !row.active) {
      var oldItem = stocktake.getItems().filter(function (item) { return String(item.getId()) === itemId; })[0];
      if (oldItem) oldItem.asTextItem().setRequired(false).setTitle('[停用] ' + (row ? row.id + '｜' + row.name : fields.count[itemId]));
    }
  });
  catalog.filter(function (drink) { return drink.active; }).forEach(function (drink) {
    var existingId = Object.keys(fields.count).filter(function (id) { return fields.count[id] === drink.id; })[0];
    var existing = stocktake.getItems().filter(function (item) {
      return (existingId && String(item.getId()) === existingId) || item.getTitle().indexOf(drink.id + '｜') === 0 || item.getTitle().indexOf('[停用] ' + drink.id + '｜') === 0;
    })[0];
    var item = existing ? existing.asTextItem() : stocktake.addTextItem();
    item.setTitle(drink.id + '｜' + drink.name + '（現存' + drink.unit + '）').setRequired(false).setValidation(countValidator);
    fields.count[String(item.getId())] = drink.id;
  });
  var arrivalDrink = findItem_(arrival, '飲料品項', 'list');
  var active = catalog.filter(function (drink) { return drink.active; });
  if (active.length) arrivalDrink.setChoiceValues(active.map(function (drink) { return drink.id + '｜' + drink.name + '（' + drink.unit + '）'; }));
  arrivalDrink.setRequired(true);
  var arrivalCases = findItem_(arrival, '整箱數量', 'text').setRequired(false).setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^(0|[1-9][0-9]{0,3})$').setHelpText('每箱預設 24 包／瓶／罐，請填 0 到 9999 的整數；與零散數量至少填一項。').build());
  // Keep the original loose-quantity question and ID for historical responses.
  var arrivalQuantity = findItem_(arrival, '實際到貨數量（單包／瓶／罐）', 'text').setRequired(false).setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^(0|[1-9][0-9]{0,5})$').setHelpText('填零散的單包／瓶／罐數量，0 到 999999 的整數；與整箱數量至少填一項，兩項都填會加總。').build());
  var arrivalNote = findItem_(arrival, '備註（選填）', 'paragraph').setRequired(false);
  // Rename the original question in place so existing responses retain their ID.
  var oldWishName = wish.getItems().filter(function (item) { return String(item.getId()) === fields.wishName || item.getTitle() === '想喝的飲料' || item.getTitle() === '品項名稱'; })[0];
  var wishName = (oldWishName ? oldWishName.asTextItem() : wish.addTextItem()).setTitle('品項名稱').setRequired(true).setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).build());
  var wishKind = findItem_(wish, '許願分類', 'list').setChoiceValues(['飲料', '零食']).setRequired(true);
  var wishUrl = findItem_(wish, '購買或產品連結（選填）', 'text').setRequired(false).setValidation(FormApp.createTextValidation().requireTextIsUrl().build());
  var wishNote = findItem_(wish, '許願備註（選填）', 'paragraph').setRequired(false).setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(500).build());
  var voteWish = findItem_(vote, '願望代號（網站預填，請勿修改）', 'text').setRequired(true).setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^wish-[A-Za-z0-9_-]{1,155}$').build());
  var voteVoter = findItem_(vote, '匿名識別碼（網站預填，請勿修改）', 'text').setRequired(true).setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[A-Za-z0-9_-]{16,160}$').build());
  var voteName = findItem_(vote, '姓名', 'text').setRequired(true).setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[\\s\\S]*\\S[\\s\\S]*$').requireTextLengthLessThanOrEqualTo(80).setHelpText('請填寫姓名，最多 80 字。').build());
  var productName = findItem_(product, '飲料名稱', 'text').setRequired(true).setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).build());
  var productCategory = findItem_(product, '飲料分類', 'list').setChoiceValues(PRODUCT_CATEGORIES).setRequired(true);
  var productPackaging = findItem_(product, '包裝外觀', 'list').setChoiceValues(PRODUCT_PACKAGING).setRequired(true);
  var productRecorder = findItem_(product, '登記人', 'text').setRequired(true).setValidation(recorderValidator);
  fields.countRecorder = String(countRecorder.getId()); fields.arrivalRecorder = String(arrivalRecorder.getId());
  fields.arrivalDrink = String(arrivalDrink.getId()); fields.arrivalCases = String(arrivalCases.getId()); fields.arrivalQuantity = String(arrivalQuantity.getId()); fields.arrivalNote = String(arrivalNote.getId());
  fields.wishName = String(wishName.getId()); fields.wishUrl = String(wishUrl.getId()); fields.wishNote = String(wishNote.getId());
  fields.wishKind = String(wishKind.getId()); fields.wishKindEntry = formEntryId_(wish, wishKind, '飲料');
  fields.voteWish = String(voteWish.getId()); fields.voteVoter = String(voteVoter.getId()); fields.voteName = String(voteName.getId());
  fields.voteWishEntry = formEntryId_(vote, voteWish, 'wish-sample');
  fields.voteVoterEntry = formEntryId_(vote, voteVoter, 'anonymous-sample-12345678');
  fields.voteNameEntry = formEntryId_(vote, voteName, '姓名範例');
  fields.productName = String(productName.getId()); fields.productCategory = String(productCategory.getId());
  fields.productPackaging = String(productPackaging.getId()); fields.productRecorder = String(productRecorder.getId());
  props.setProperty('HOLDWIN_FORM_FIELDS', JSON.stringify(fields));
  [stocktake, arrival, wish, vote, product].forEach(function (form) { form.setAcceptingResponses(true); });
}

function formEntryId_(form, item, sample) {
  // Form item IDs and the public entry IDs are not interchangeable.
  var url = form.createResponse().withItemResponse(item.createResponse(sample)).toPrefilledUrl();
  var match = String(url).match(/[?&]entry\.(\d+)=/);
  if (!match) throw new Error('無法建立表單預填欄位，請重新執行 setupOnce。');
  return match[1];
}

function syncWishes_(ss) {
  var props = PropertiesService.getScriptProperties();
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  var sheet = ss.getSheetByName(SHEETS.wishes);
  var known = {};
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (row) { known[row[0]] = true; });
  var rows = [];
  FormApp.openById(props.getProperty('HOLDWIN_WISH_FORM_ID')).getResponses().forEach(function (response) {
    var id = 'wish-' + response.getId();
    if (known[id]) return;
    var answers = {};
    response.getItemResponses().forEach(function (item) { answers[String(item.getItem().getId())] = item.getResponse(); });
    var name = text_(answers[fields.wishName], 80);
    var kind = wishKind_(answers[fields.wishKind]);
    if (!name || !kind) return;
    rows.push([id, sheetText_(name), sheetText_(safeUrl_(answers[fields.wishUrl])), sheetText_(text_(answers[fields.wishNote], 500)), 'pending', response.getTimestamp().toISOString(), kind]);
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setNumberFormat('@').setValues(rows);
    props.setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
  }
  if (sheet.getLastRow() > 1) sheet.getRange(2, 5, sheet.getLastRow() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['pending', 'purchased', 'declined'], true).setAllowInvalid(false).build());
}

function voteCounts_(ss) {
  return voteSummary_(ss).counts;
}

function voteSummary_(ss) {
  var sheet = ss.getSheetByName(SHEETS.votes);
  return voteSummaryRows_(sheet && sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues() : []);
}

function voteSummaryRows_(rows) {
  var counts = Object.create(null), names = Object.create(null), pairs = Object.create(null);
  rows.forEach(function (row) {
    var wishId = String(row[1]);
    var voterId = String(row[2]);
    var pair = wishId + ':' + voterId;
    if (row[4] !== '採計' || !/^wish-[A-Za-z0-9_-]{1,155}$/.test(wishId) || !/^[A-Za-z0-9_-]{16,160}$/.test(voterId) || pairs[pair]) return;
    pairs[pair] = true;
    counts[wishId] = (counts[wishId] || 0) + 1;
    var name = String(row[5] || '').trim();
    if (name && name.length <= 80) {
      if (!names[wishId]) names[wishId] = [];
      names[wishId].push(name);
    }
  });
  return { counts: counts, names: names };
}

function syncVotes_(ss) {
  var sheet = ensureSheet_(ss, SHEETS.votes, ['回應 ID', '願望 ID', '匿名識別碼', 'Google 收件時間', '採計狀態', '姓名']);
  var props = PropertiesService.getScriptProperties();
  var formId = props.getProperty('HOLDWIN_VOTE_FORM_ID');
  if (!formId) return;
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  var knownResponses = {};
  var pairs = {};
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues().forEach(function (row) {
    knownResponses[String(row[0])] = true;
    if (row[4] === '採計') pairs[String(row[1]) + ':' + String(row[2])] = true;
  });
  var wishes = {};
  wishRows_(ss).forEach(function (wish) { wishes[wish.id] = true; });
  var rows = [];
  FormApp.openById(formId).getResponses().forEach(function (response) {
    var responseId = String(response.getId());
    if (knownResponses[responseId]) return;
    knownResponses[responseId] = true;
    var answers = {};
    response.getItemResponses().forEach(function (item) { answers[String(item.getItem().getId())] = item.getResponse(); });
    var wishId = String(answers[fields.voteWish] || '').trim();
    var voterId = String(answers[fields.voteVoter] || '').trim();
    var voterName = String(answers[fields.voteName] || '').trim();
    var stamp = iso_(response.getTimestamp());
    var pair = wishId + ':' + voterId;
    var validName = !!voterName && voterName.length <= 80;
    var valid = !!stamp && wishes[wishId] && /^wish-[A-Za-z0-9_-]{1,155}$/.test(wishId) && /^[A-Za-z0-9_-]{16,160}$/.test(voterId);
    var status = !validName ? '未採計：請填有效姓名' : !valid ? '未採計：無效願望或識別碼' : pairs[pair] ? '未採計：重複贊同' : '採計';
    if (status === '採計') pairs[pair] = true;
    rows.push([sheetText_(responseId), sheetText_(text_(wishId, 160)), sheetText_(text_(voterId, 160)), stamp || '', status, sheetText_(text_(voterName, 80))]);
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setNumberFormat('@').setValues(rows);
    props.setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
  }
}

function appendHistory_(ss, events) {
  var sheet = ss.getSheetByName(SHEETS.history);
  var known = {};
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (row) { known[row[0]] = true; });
  var catalog = catalog_(ss);
  var rows = events.filter(function (event) { return !known[event.id]; }).map(function (event) {
    var drink = catalog.filter(function (item) { return item.id === event.drinkId; })[0];
    return [event.id, event.createdAt, event.type, event.drinkId || '', sheetText_(drink ? drink.name : ''), event.quantity === undefined ? '' : event.quantity, sheetText_(event.note || ''), sheetText_(event.recorder || event.email || ''), event.accepted ? '採計' : '未採計'];
  });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
}

function renderWarehouse_(ss, inventory) {
  cacheZeroDrinkIds_(inventory);inventory=visibleDrinkInventory_(inventory);
  var sheet = ss.getSheetByName(SHEETS.warehouse);
  var formUrls = websiteFormUrls_();
  var preferences=restockPreferences_(ss);
  var rows = sortInventoryEntries_(inventory.filter(function (entry) { return entry.drink.active; }),preferences).map(function (entry) {
    var drink = entry.drink;
    return [drink.id, sheetText_(drink.name), drink.category, drink.packaging, drink.unit, drink.perCase === null ? '待確認' : drink.perCase, entry.stock === null ? '待盤點' : entry.stock, entry.lastCountAt ? new Date(entry.lastCountAt) : '', entry.receivedAfterCount === null ? '' : entry.receivedAfterCount, inventoryRestockStatus_('drink',entry,restockMode_(preferences,'drink',drink.id)), restockThreshold_('drink')];
  });
  // This is a generated view only. Source form responses, History, Catalog and
  // WishReview are retained and never cleared or recreated during refresh.
  sheet.clearContents();
  sheet.getRange(1, 1).setValue('宏穩茶水間｜私人倉庫庫存');
  sheet.getRange(2, 1).setValue('數量＝最近實際盤點＋後續入庫；尚未盤點時先累計已登記到貨，尚無紀錄才顯示待盤點。日常取用不會自動扣除。');
  sheet.getRange(3, 1).setFormula('=HYPERLINK("' + formUrls.stocktake + '","開啟盤點表單")');
  sheet.getRange(3, 4).setFormula('=HYPERLINK("' + formUrls.arrival + '","開啟實際到貨表單")');
  sheet.getRange(4, 1).setValue('檢視更新時間'); sheet.getRange(4, 2).setValue(new Date()).setNumberFormat('yyyy/MM/dd HH:mm');
  var headers = ['品項 ID', '飲料名稱', '分類', '包裝', '單位', '每箱數量', '目前庫存', '最近實際盤點', '盤點後到貨', '狀態', '提醒門檻'];
  sheet.getRange(6, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(7, 1, rows.length, 11).setValues(rows);
    sheet.getRange(7, 8, rows.length, 1).setNumberFormat('yyyy/MM/dd HH:mm');
    var range = sheet.getRange(7, 1, rows.length, 11);
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$J7="需要補貨"').setBackground('#fff0e9').setFontColor('#b14b3d').setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$G7="待盤點"').setBackground('#f5f2ea').setFontColor('#a28f70').setRanges([range]).build()
    ]);
  }
  styleHeader_(sheet, 6, 11); sheet.setFrozenRows(6); sheet.setColumnWidth(2, 185); sheet.setColumnWidth(8, 160); sheet.setColumnWidth(7, 95);
}

function renderArchive_(ss, inventory) {
  inventory=visibleDrinkInventory_(inventory);
  var sheet = ss.getSheetByName(SHEETS.archive) || ss.insertSheet(SHEETS.archive);
  var rows = sortInventoryEntries_(inventory.filter(function (entry) { return !entry.drink.active; })).map(function (entry) {
    var drink = entry.drink;
    return [drink.id, sheetText_(drink.name), drink.category, drink.packaging, drink.unit, drink.perCase === null ? '待確認' : drink.perCase, entry.stock === null ? '待盤點' : entry.stock, entry.lastCountAt ? new Date(entry.lastCountAt) : '', entry.receivedAfterCount === null ? '' : entry.receivedAfterCount, '已封存', drink.threshold];
  });
  sheet.clearContents();
  sheet.getRange(1, 1).setValue('宏穩茶水間｜封存品項與數量紀錄');
  sheet.getRange(2, 1).setValue('已確認為0的飲料自動列入歷史，重新入庫後回到供應中；手動停買品項可選原品項重新入庫。盤點與入庫紀錄保留。');
  sheet.getRange(4, 1, 1, 11).setValues([['品項 ID', '飲料名稱', '分類', '包裝', '單位', '每箱數量', '紀錄庫存', '最近實際盤點', '盤點後到貨', '狀態', '提醒門檻']]);
  if (rows.length) { sheet.getRange(5, 1, rows.length, 11).setValues(rows); sheet.getRange(5, 8, rows.length, 1).setNumberFormat('yyyy/MM/dd HH:mm'); }
  styleHeader_(sheet, 4, 11); sheet.setFrozenRows(4); sheet.setColumnWidth(2, 185); sheet.setColumnWidth(8, 160);
}

function writeSetup_(ss) {
  var forms = forms_();
  var sheet = ss.getSheetByName(SHEETS.setup);
    sheet.getRange(1, 1, 9, 2).setValues([
      ['宏穩茶水間｜設定與入口', '網址／說明'],
      ['私人倉庫庫存', ss.getUrl() + '#gid=' + ss.getSheetByName(SHEETS.warehouse).getSheetId()],
      ['封存品項與數量紀錄', ss.getUrl() + '#gid=' + ss.getSheetByName(SHEETS.archive).getSheetId()],
      ['盤點表單（免登入、必填登記人，可部分盤點）', forms.stocktake.getPublishedUrl()],
      ['到貨入庫表單（免登入、必填登記人）', forms.arrival.getPublishedUrl()],
      ['同事許願表單（公開）', forms.wish.getPublishedUrl()],
      ['我也喜歡贊同表單（必填姓名、網站預填）', forms.vote.getPublishedUrl()],
      ['快速新增飲料（可先不放圖片）', forms.product.getPublishedUrl()],
      ['公開資料網址', '完成「部署 → 網頁應用程式」後，將 /exec 網址填入網站 googleScriptUrl。']
    ]);
    styleHeader_(sheet, 1, 2); sheet.setColumnWidth(1, 260); sheet.setColumnWidth(2, 520);
}

function ensureTriggers_(ss) {
  var existing = ScriptApp.getProjectTriggers();
  var forms = forms_();
  [forms.stocktake, forms.arrival, forms.wish, forms.vote, forms.product].filter(Boolean).forEach(function (form) {
    if (!existing.some(function (trigger) { return trigger.getHandlerFunction() === 'handleFormSubmit' && trigger.getTriggerSourceId() === form.getId(); })) ScriptApp.newTrigger('handleFormSubmit').forForm(form).onFormSubmit().create();
  });
  if (!existing.some(function (trigger) { return trigger.getHandlerFunction() === 'handleSheetEdit' && trigger.getTriggerSourceId() === ss.getId(); })) ScriptApp.newTrigger('handleSheetEdit').forSpreadsheet(ss).onEdit().create();
}

function ensureForm_(property, title, ss) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(property);
  if (id) return FormApp.openById(id);
  var form = FormApp.create(title);
  props.setProperty(property, form.getId());
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  return form;
}

function findItem_(form, title, kind) {
  var item = form.getItems().filter(function (entry) { return entry.getTitle() === title; })[0];
  if (kind === 'list') return item ? item.asListItem() : form.addListItem().setTitle(title);
  if (kind === 'paragraph') return item ? item.asParagraphTextItem() : form.addParagraphTextItem().setTitle(title);
  return item ? item.asTextItem() : form.addTextItem().setTitle(title);
}

function readWebsiteCache_(key) {
  try { var value = CacheService.getScriptCache().get('pantry-v1:' + key); return value ? JSON.parse(value) : null; }
  catch (error) { return null; }
}

function writeWebsiteCache_(key, value, seconds) {
  try { var json = JSON.stringify(value); if (json.length < 30000) CacheService.getScriptCache().put('pantry-v1:' + key, json, seconds); }
  catch (error) { /* Cache eviction or unavailability never affects persistence. */ }
}

function websiteFormUrls_() {
  var props = PropertiesService.getScriptProperties();
  var ids = ['COUNT','ARRIVAL','WISH','VOTE','PRODUCT'].map(function (name) { return props.getProperty('HOLDWIN_' + name + '_FORM_ID') || ''; });
  var key = 'forms:' + websiteFingerprint_({operation:'forms',data:ids});
  var cached = readWebsiteCache_(key);
  if (cached && cached.wish && cached.stocktake && cached.arrival && cached.vote) return cached;
  var forms = forms_();
  var urls = { wish:forms.wish.getPublishedUrl(),stocktake:forms.stocktake.getPublishedUrl(),arrival:forms.arrival.getPublishedUrl(),vote:forms.vote.getPublishedUrl(),product:forms.product ? forms.product.getPublishedUrl() : '' };
  writeWebsiteCache_(key, urls, 21600);
  return urls;
}

function forms_() {
  var props = PropertiesService.getScriptProperties();
  var productId = props.getProperty('HOLDWIN_PRODUCT_FORM_ID');
  return { stocktake: FormApp.openById(props.getProperty('HOLDWIN_COUNT_FORM_ID')), arrival: FormApp.openById(props.getProperty('HOLDWIN_ARRIVAL_FORM_ID')), wish: FormApp.openById(props.getProperty('HOLDWIN_WISH_FORM_ID')), vote: FormApp.openById(props.getProperty('HOLDWIN_VOTE_FORM_ID')), product: productId ? FormApp.openById(productId) : null };
}

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('HOLDWIN_SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : null;
}

function requiredSpreadsheet_() {
  var ss = spreadsheet_();
  if (!ss) throw new Error('請先執行 setupOnce。');
  return ss;
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (headers && sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (headers) { styleHeader_(sheet, 1, headers.length); sheet.setFrozenRows(1); }
  return sheet;
}

function styleHeader_(sheet, row, columns) {
  sheet.getRange(row, 1, 1, columns).setFontWeight('bold').setBackground('#eee3ce').setFontColor('#806744');
}

function adminEmails_() {
  var admins = JSON.parse(PropertiesService.getScriptProperties().getProperty('HOLDWIN_ADMINS') || '[]');
  if (!admins.length) throw new Error('請先設定至少一個實際管理帳號。');
  return admins;
}

function locked_(work) {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { return work(); } finally { lock.releaseLock(); }
}

function quantity_(value, allowZero) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  var text = String(value).trim();
  if (!/^\d{1,6}$/.test(text)) return null;
  var number = Number(text);
  return Number.isSafeInteger(number) && number >= (allowZero ? 0 : 1) && number <= 999999 ? number : null;
}

function arrivalQuantity_(casesInput, looseInput, perCase) {
  function optional(value) { return value == null || String(value).trim() === '' ? 0 : quantity_(value, true); }
  var cases = optional(casesInput), loose = optional(looseInput);
  if (cases === null || loose === null || cases > 9999) return null;
  if (cases > 0 && (!Number.isSafeInteger(perCase) || perCase < 1)) return null;
  var total = cases * (perCase || 0) + loose;
  return Number.isSafeInteger(total) && total > 0 && total <= 999999 ? total : null;
}

function text_(value, max) {
  return String(value === null || value === undefined ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function sheetText_(value) {
  var text = String(value);
  return /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
}

function safeUrl_(value) {
  var text = text_(value, 2000);
  return /^https?:\/\/[^\s/@?#\\<>"']+([/?#][^\s\\<>"']*)?$/i.test(text) ? text : '';
}

function iso_(value) {
  var date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

// One read snapshot per batch; validation of all rows precedes every source write.
function arrivalReadSnapshot_(ss) {
  var sheets=Object.create(null);
  return {getUrl:function(){return ss.getUrl();},getSheetByName:function(name){
    if(Object.prototype.hasOwnProperty.call(sheets,name))return sheets[name];
    var original=ss.getSheetByName(name);if(!original){sheets[name]=null;return null;}
    var count=original.getLastRow(),values=count?original.getRange(1,1,count,11).getValues():[];
    sheets[name]={getLastRow:function(){return count;},getRange:function(row,column,rows,columns){rows=rows||1;columns=columns||1;return {getValues:function(){return Array.from({length:rows},function(_,i){return Array.from({length:columns},function(_,j){return values[row-1+i]&&values[row-1+i][column-1+j]!==undefined?values[row-1+i][column-1+j]:'';});});}};}};return sheets[name];
  }};
}

// Reactivation touches only the existing active cell, never IDs or catalog metadata.
function prepareArrivalRestores_(ss,effects) {
  var entries=effects.batch?effects.batch.reduce(function(all,child){return all.concat(child.restore||[]);},[]):effects.restore||[];
  var tables=Object.create(null),seen=Object.create(null);
  return entries.filter(function(entry){var key=entry.kind+':'+entry.id;if(seen[key])return false;seen[key]=true;return true;}).map(function(entry){
    var name=entry.kind==='drink'?SHEETS.catalog:SHEETS.supplyCatalog,column=entry.kind==='drink'?8:5;
    if(!tables[name]){var sheet=ss.getSheetByName(name);if(!sheet||sheet.getLastRow()<2)throw websiteInputError_('歷史品項已不存在，請重新整理。');tables[name]={sheet:sheet,rows:sheet.getRange(2,1,sheet.getLastRow()-1,column).getValues()};}
    var table=tables[name],index=table.rows.map(function(row){return String(row[0]);}).indexOf(entry.id);
    if(index<0||(entry.kind!=='drink'&&table.rows[index][2]!==entry.kind))throw websiteInputError_('歷史品項已變更，請重新整理。');
    return {kind:entry.kind,sheet:table.sheet,row:index+2,column:column,current:table.rows[index][column-1]};
  });
}
function applyArrivalRestores_(updates) { updates.forEach(function(update){if(update.current!==true)update.sheet.getRange(update.row,update.column,1,1).setValues([[true]]);});if(updates.some(function(update){return update.kind==='drink';}))PropertiesService.getScriptProperties().setProperty('HOLDWIN_CATALOG_FORMS_DIRTY','true'); }

// A zero-stock decision changes availability/preferences, never stock or history.
function applyZeroStockDecision_(ss,effects) {
  var action=effects.zeroStockDecision,kind=action.kind;
  var catalog=kind==='drink'?catalog_(ss):supplyCatalog_(ss),item=catalog.filter(function(item){return item.id===action.id&&(kind==='drink'||item.kind===kind);})[0];
  var stockEvents=kind==='drink'?historyEvents_(ss):supplyEvents_(ss);
  var inventory=kind==='drink'?computeInventory_(catalog,stockEvents).filter(function(entry){return entry.drink.id===action.id;})[0]:supplyInventory_(catalog,stockEvents).filter(function(entry){return entry.id===action.id;})[0];
  var sheet=ss.getSheetByName(SHEETS.restockPreferences),marker=effects.restockPreference[0],own=false;
  if(sheet&&sheet.getLastRow()>0&&!restockPreferenceSheetMatches_(sheet))throw websiteInputError_('補貨設定工作表格式已變更。');
  if(sheet&&sheet.getLastRow()>1)own=sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().some(function(row){return row[0]===marker;});
  if(!item||!inventory||inventory.stock!==0||(!item.active&&!(own&&action.decision==='archive')))throw websiteInputError_('這個品項已不在無庫存清單，請重新整理。');
  if(zeroStockLatestEventId_(stockEvents,action.id)!==action.expectedEventId)throw websiteInputError_('庫存紀錄已更新，請重新整理後再處理。');
  var mode=restockMode_(restockPreferences_(ss),kind,action.id);
  if(mode!==action.expectedMode&&!(own&&mode===effects.restockPreference[4]))throw websiteInputError_('其他裝置已更新處理狀態，請重新整理。');
  var target=ss.getSheetByName(kind==='drink'?SHEETS.catalog:SHEETS.supplyCatalog),column=kind==='drink'?8:5;
  var rows=target.getRange(2,1,target.getLastRow()-1,column).getValues(),index=rows.map(function(row){return String(row[0]);}).indexOf(action.id);
  if(index<0)throw websiteInputError_('品項已變更，請重新整理。');
  websiteAppendMissing_(ensureSheet_(ss,SHEETS.restockPreferences,RESTOCK_PREFERENCE_HEADERS),[effects.restockPreference]);
  if(action.decision==='archive'){
    target.getRange(index+2,column,1,1).setValues([[false]]);
    if(kind==='drink')PropertiesService.getScriptProperties().setProperty('HOLDWIN_CATALOG_FORMS_DIRTY','true');
  }
}

function zeroStockLatestEventId_(events,id) {
  var latest=null;
  events.forEach(function(event){if((event.drinkId||event.supplyId)===id&&event.accepted!==false&&['count','restock'].indexOf(event.type)>=0&&(!latest||Date.parse(event.createdAt)>=Date.parse(latest.createdAt)))latest=event;});
  return latest?latest.id:null;
}

// Read only: reveal eligible IDs, never private quantities or histories.
function gachaOptions_() {
  var ss=requiredSpreadsheet_(),catalog=catalog_(ss),inventory=computeInventory_(catalog,historyEvents_(ss));
  return {ok:true,version:1,snapshotAt:new Date().toISOString(),eligibleIds:inventory.filter(function(entry){return entry.drink.active&&Number.isSafeInteger(entry.stock)&&entry.stock>0;}).map(function(entry){return entry.drink.id;})};
}

function prepareZeroRestockFulfilments_(ss,effects,requestId,stamp) {
  var row=(effects.history||effects.supplyHistory||[]).filter(function(row){return row[2]==='restock';})[0];
  if(!row)return;
  var kind=effects.history?'drink':(supplyCatalog_(ss).filter(function(item){return item.id===row[3];})[0]||{}).kind;
  if(['drink','snack','noodle'].indexOf(kind)<0)return;
  var current=kind==='drink'?computeInventory_(catalog_(ss),historyEvents_(ss)).filter(function(entry){return entry.drink.id===row[3];})[0]:supplyInventory_(supplyCatalog_(ss),supplyEvents_(ss)).filter(function(entry){return entry.id===row[3];})[0];
  if(current&&current.stock===0&&restockPreferences_(ss).some(function(entry){return entry.kind===kind&&entry.itemId===row[3]&&entry.mode==='consider'&&entry.zeroStockPending===true;}))effects.restockFulfilments=[['website:'+requestId+':fulfilled',stamp,kind,row[3],'normal','無庫存品項已到貨','採計']];
}
function applyZeroRestockFulfilments_(ss,rows) {
  if(rows.length)websiteAppendMissing_(ensureSheet_(ss,SHEETS.restockPreferences,RESTOCK_PREFERENCE_HEADERS),rows);
}
