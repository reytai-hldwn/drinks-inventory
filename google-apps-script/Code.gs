/**
 * 宏穩茶水間：Google Forms + private Sheets backend, public catalog JSONP.
 * Paste this complete file into a standalone Google Apps Script project.
 * The initial catalog is generated from js/catalog.js; it contains NO counts.
 */
var ADMIN_EMAILS = []; // 選填：僅供專案擁有人執行私人盤點匯入；日常盤點、入庫不需登入。

var INITIAL_CATALOG = /* GENERATED_CATALOG_START */ [
  {
    "id": "company-drink-01",
    "name": "光泉牛乳",
    "category": "牛奶／豆漿",
    "packaging": "窄瓶鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-02",
    "name": "光泉巧克力牛乳",
    "category": "牛奶／豆漿",
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
    "category": "牛奶／豆漿",
    "packaging": "鋁箔包",
    "unit": "包"
  },
  {
    "id": "company-drink-07",
    "name": "波利芭樂汁",
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
    "name": "波蜜一日蔬果",
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
    "name": "Milkiis水蜜桃",
    "category": "汽水",
    "packaging": "長鐵罐",
    "unit": "罐"
  },
  {
    "id": "company-drink-23",
    "name": "Miilkis",
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
    "category": "牛奶／豆漿",
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
    "category": "牛奶／豆漿",
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
var SHEETS = { catalog: 'Catalog', warehouse: 'Warehouse', archive: 'Archive', history: 'History', wishes: 'WishReview', votes: 'WishVotes', products: 'ProductIntake', setup: 'Setup' };
var PRODUCT_CATEGORIES = ['牛奶／豆漿', '茶飲', '咖啡', '果汁', '汽水', '其他', '大瓶飲料'];
var PRODUCT_PACKAGING = ['窄瓶鋁箔包', '鋁箔包', '鐵罐', '小型鐵罐', '長鐵罐', '寶特瓶', '大瓶裝', '其他'];
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
    if (parameters.action === 'warehouse') data = warehouseData_();
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

function wishRows_(ss) {
  var sheet = ss.getSheetByName(SHEETS.wishes);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues().map(function (row) {
    return { id: String(row[0]), name: text_(row[1], 80), url: safeUrl_(row[2]), note: text_(row[3], 500), status: ['pending', 'purchased', 'declined'].indexOf(row[4]) >= 0 ? row[4] : 'pending', createdAt: iso_(row[5]), kind: wishKind_(row[6]) };
  }).filter(function (wish) { return wish.id && wish.name && wish.createdAt && wish.kind; });
}

function wishKind_(value) {
  var kind = String(value || '').trim();
  if (!kind || kind === 'drink' || kind === '飲料') return 'drink';
  return kind === 'snack' || kind === '零食' || kind === '點心' ? 'snack' : null;
}

function publicData_() {
  var ss = requiredSpreadsheet_();
  var props = PropertiesService.getScriptProperties();
  var support = voteSummary_(ss);
  var wishes = wishRows_(ss).map(function (wish) { wish.votes = support.counts[wish.id] || 0; wish.supporters = support.names[wish.id] || []; return wish; });
  // Fridge responses never carry warehouse quantities or registration histories.
  var drinks = catalog_(ss).map(function (drink) {
    return { id: drink.id, name: drink.name, category: drink.category, packaging: drink.packaging, unit: drink.unit, perCase: drink.perCase, threshold: drink.threshold, active: drink.active };
  });
  var forms = forms_();
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  var formUrls = { wish: forms.wish.getPublishedUrl(), stocktake: forms.stocktake.getPublishedUrl(), arrival: forms.arrival.getPublishedUrl(), vote: forms.vote.getPublishedUrl(), product: forms.product ? forms.product.getPublishedUrl() : '' };
  return { ok: true, provider: 'google', drinks: drinks, wishes: wishes, formUrls: formUrls,
    wishForm: fields.wishKindEntry ? { url: formUrls.wish, kindEntryId: fields.wishKindEntry } : null,
    voteForm: { url: formUrls.vote, wishEntryId: fields.voteWishEntry || '', voterEntryId: fields.voteVoterEntry || '', voterNameEntryId: fields.voteNameEntry || '' },
    adminUrl: ss.getUrl() + '#gid=' + ss.getSheetByName(SHEETS.warehouse).getSheetId(),
    updatedAt: props.getProperty('HOLDWIN_PUBLIC_UPDATED_AT') || null };
}

function warehouseData_() {
  var ss = requiredSpreadsheet_();
  var result = publicData_();
  var events = historyEvents_(ss).filter(function (event) { return event.accepted; });
  result.drinks = computeInventory_(catalog_(ss), events).map(function (entry) {
    var drink = entry.drink;
    return { id: drink.id, name: drink.name, category: drink.category, packaging: drink.packaging, unit: drink.unit,
      perCase: drink.perCase, threshold: drink.threshold, active: drink.active,
      stock: entry.stock, target: null, lastCountAt: entry.lastCountAt };
  });
  result.events = events.map(function (event) {
    return { id: event.id, drinkId: event.drinkId, type: event.type, quantity: event.quantity,
      createdAt: event.createdAt, note: event.note, recorder: event.recorder || publicRecorder_(event.email) };
  });
  var active = result.drinks.filter(function (drink) { return drink.active; });
  result.lastInventoryAt = active.length && active.every(function (drink) { return drink.lastCountAt; })
    ? active.map(function (drink) { return drink.lastCountAt; }).sort()[0] : null;
  return result;
}

function publicRecorder_(value) {
  var name = text_(value, 80);
  return name.indexOf('@') >= 0 ? '先前管理者' : name;
}

function refreshWarehouse_() {
  var ss = requiredSpreadsheet_();
  // Add actual submitted products before reading stock responses, then update
  // form choices in the same locked refresh. No count or arrival is invented.
  var added = syncNewProducts_(ss);
  var props = PropertiesService.getScriptProperties();
  if (added || props.getProperty('HOLDWIN_CATALOG_FORMS_DIRTY') === 'true') {
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
  return catalog.map(function (drink) {
    var records = events.filter(function (event) { return event.accepted && event.drinkId === drink.id; });
    var counts = records.filter(function (event) { return event.type === 'count'; }).sort(function (a, b) { return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id); });
    var latest = counts[0];
    var received = latest ? records.filter(function (event) { return event.type === 'restock' && Date.parse(event.createdAt) > Date.parse(latest.createdAt); }).reduce(function (sum, event) { return sum + event.quantity; }, 0) : null;
    return { drink: drink, stock: latest ? latest.quantity + received : null, lastCountAt: latest ? latest.createdAt : null, receivedAfterCount: received };
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
        var valid = active.length > 0 && active.every(function (drink) {
          var itemId = Object.keys(fields.count || {}).filter(function (id) { return fields.count[id] === drink.id; })[0];
          var quantity = quantity_(answers[itemId], true);
          if (!itemId || quantity === null) return false;
          pending.push({ id: responseId + ':' + itemId, type: 'count', drinkId: drink.id, quantity: quantity, createdAt: stamp, recorder: recorder, email: recorder, accepted: true, note: 'Google 表單實際盤點' });
          return true;
        });
        if (!valid) reject('完整盤點有品項未填或數量無效；整份未計入庫存');
        else events = events.concat(pending);
      } else {
        var drinkId = String(answers[fields.arrivalDrink] || '').split('｜')[0].trim();
        var quantity = quantity_(answers[fields.arrivalQuantity], false);
        if (!catalog.some(function (drink) { return drink.id === drinkId && drink.active !== false; }) || quantity === null) {
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
    // Apply only the owner's exact typo correction, retaining the product ID,
    // custom category, stock, history and all other administrator changes.
    if (row[0] === 'company-drink-09' && row[1] === '立頓巧克力牛奶') {
      sheet.getRange(index + 2, 2).setValue('立頓巧克力奶茶');
      if (row[2] === '牛奶／豆漿') sheet.getRange(index + 2, 3).setValue('茶飲');
    }
  });
  var additions = INITIAL_CATALOG.filter(function (drink) { return !knownIds[drink.id]; }).map(function (drink) {
    return [drink.id, drink.name, drink.category, drink.packaging, drink.unit, '', 10, drink.active !== false];
  });
  if (additions.length) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, additions.length, 8).setValues(additions);
    sheet.getRange(startRow, 8, additions.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  }
  styleHeader_(sheet, 1, 8);
  sheet.setFrozenRows(1);
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
    return { id: id, name: name, category: text_(row[2], 30), packaging: text_(row[3], 30), unit: ['包', '瓶', '罐'].indexOf(row[4]) >= 0 ? row[4] : '包', perCase: perCase, threshold: threshold === null ? 10 : threshold, active: row[7] !== false && String(row[7]).toLowerCase() !== 'false' };
  });
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
    var category = String(answers[fields.productCategory] || '').trim();
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
      additions.push([id, sheetText_(name), category, packaging, unit, '', 10, true]);
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
  var stocktake = ensureForm_('HOLDWIN_COUNT_FORM_ID', '宏穩茶水間｜完整盤點', ss);
  var arrival = ensureForm_('HOLDWIN_ARRIVAL_FORM_ID', '宏穩茶水間｜到貨入庫', ss);
  var wish = ensureForm_('HOLDWIN_WISH_FORM_ID', '宏穩茶水間｜採買許願池', ss);
  var vote = ensureForm_('HOLDWIN_VOTE_FORM_ID', '宏穩茶水間｜我也喜歡', ss);
  var product = ensureForm_('HOLDWIN_PRODUCT_FORM_ID', '宏穩茶水間｜快速新增飲料', ss);
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  fields.count = fields.count || {};
  stocktake.setTitle('宏穩茶水間｜完整盤點').setDescription('不用登入，請填寫登記人。啟用品項全部填寫實際單包／瓶／罐數量，沒有就是 0。Google 自動記錄收到表單的時間。').setCollectEmail(false);
  arrival.setTitle('宏穩茶水間｜到貨入庫').setDescription('不用登入，請填寫登記人。實際收到飲料才登記，以單包／瓶／罐計數；分批收到就分次填寫。Google 自動記錄時間。').setCollectEmail(false);
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
    item.setTitle(drink.id + '｜' + drink.name + '（現存' + drink.unit + '）').setRequired(true).setValidation(countValidator);
    fields.count[String(item.getId())] = drink.id;
  });
  var arrivalDrink = findItem_(arrival, '飲料品項', 'list');
  var active = catalog.filter(function (drink) { return drink.active; });
  if (active.length) arrivalDrink.setChoiceValues(active.map(function (drink) { return drink.id + '｜' + drink.name + '（' + drink.unit + '）'; }));
  arrivalDrink.setRequired(true);
  var arrivalQuantity = findItem_(arrival, '實際到貨數量（單包／瓶／罐）', 'text').setRequired(true).setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[1-9][0-9]{0,5}$').setHelpText('請填 1 到 999999 的整數，不是箱數。').build());
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
  fields.arrivalDrink = String(arrivalDrink.getId()); fields.arrivalQuantity = String(arrivalQuantity.getId()); fields.arrivalNote = String(arrivalNote.getId());
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
  var counts = Object.create(null), names = Object.create(null), pairs = Object.create(null);
  if (!sheet || sheet.getLastRow() < 2) return { counts: counts, names: names };
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues().forEach(function (row) {
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
  var sheet = ss.getSheetByName(SHEETS.warehouse);
  var forms = forms_();
  var rows = inventory.filter(function (entry) { return entry.drink.active; }).map(function (entry) {
    var drink = entry.drink;
    return [drink.id, sheetText_(drink.name), drink.category, drink.packaging, drink.unit, drink.perCase === null ? '待確認' : drink.perCase, entry.stock === null ? '待盤點' : entry.stock, entry.lastCountAt ? new Date(entry.lastCountAt) : '', entry.receivedAfterCount === null ? '' : entry.receivedAfterCount, entry.stock === null ? '待盤點' : entry.stock <= drink.threshold ? '需要補貨' : '庫存充足', drink.threshold];
  });
  // This is a generated view only. Source form responses, History, Catalog and
  // WishReview are retained and never cleared or recreated during refresh.
  sheet.clearContents();
  sheet.getRange(1, 1).setValue('宏穩茶水間｜私人倉庫庫存');
  sheet.getRange(2, 1).setValue('數量＝最近一次實際盤點＋之後實際到貨；尚未盤點顯示待盤點。日常取用不會自動扣除。');
  sheet.getRange(3, 1).setFormula('=HYPERLINK("' + forms.stocktake.getPublishedUrl() + '","開啟完整盤點表單")');
  sheet.getRange(3, 4).setFormula('=HYPERLINK("' + forms.arrival.getPublishedUrl() + '","開啟實際到貨表單")');
  sheet.getRange(4, 1).setValue('檢視更新時間'); sheet.getRange(4, 2).setValue(new Date()).setNumberFormat('yyyy/MM/dd HH:mm');
  var headers = ['品項 ID', '飲料名稱', '分類', '包裝', '單位', '每箱數量', '目前庫存', '最近實際盤點', '盤點後到貨', '狀態', '提醒門檻'];
  sheet.getRange(6, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(7, 1, rows.length, 11).setValues(rows);
    sheet.getRange(7, 8, rows.length, 1).setNumberFormat('yyyy/MM/dd HH:mm');
    var range = sheet.getRange(7, 1, rows.length, 11);
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($G7),$G7<=$K7)').setBackground('#fff0e9').setFontColor('#b14b3d').setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$G7="待盤點"').setBackground('#f5f2ea').setFontColor('#a28f70').setRanges([range]).build()
    ]);
  }
  styleHeader_(sheet, 6, 11); sheet.setFrozenRows(6); sheet.setColumnWidth(2, 185); sheet.setColumnWidth(8, 160); sheet.setColumnWidth(7, 95);
}

function renderArchive_(ss, inventory) {
  var sheet = ss.getSheetByName(SHEETS.archive) || ss.insertSheet(SHEETS.archive);
  var rows = inventory.filter(function (entry) { return !entry.drink.active; }).map(function (entry) {
    var drink = entry.drink;
    return [drink.id, sheetText_(drink.name), drink.category, drink.packaging, drink.unit, drink.perCase === null ? '待確認' : drink.perCase, entry.stock === null ? '待盤點' : entry.stock, entry.lastCountAt ? new Date(entry.lastCountAt) : '', entry.receivedAfterCount === null ? '' : entry.receivedAfterCount, '已封存', drink.threshold];
  });
  sheet.clearContents();
  sheet.getRange(1, 1).setValue('宏穩茶水間｜封存品項與數量紀錄');
  sheet.getRange(2, 1).setValue('封存保留原有盤點、入庫與數量紀錄；在 Catalog 將 active 改回 TRUE 可恢復。請勿刪除歷史列。');
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
      ['完整盤點表單（免登入、必填登記人）', forms.stocktake.getPublishedUrl()],
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
