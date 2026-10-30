/**
 * 宏穩茶水間：Google Forms + private Sheets backend, public catalog JSONP.
 * Paste this complete file into a standalone Google Apps Script project.
 * The initial catalog is generated from js/catalog.js; it contains NO counts.
 */
var ADMIN_EMAILS = []; // 填入實際 Google 管理帳號；可先只填自己，之後再加入其他管理者。
var PRIVATE_FORMS_VERIFIED_AND_RESTRICTED = false;
// 上一行只有在兩張管理表單已「驗證」收集 Email、且僅允許名單中的管理帳號填寫後，才改為 true。

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
    "name": "立頓巧克力牛奶",
    "category": "牛奶／豆漿",
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
  }
] /* GENERATED_CATALOG_END */;
var SHEETS = { catalog: 'Catalog', warehouse: 'Warehouse', archive: 'Archive', history: 'History', wishes: 'WishReview', setup: 'Setup' };

function setupConfig() {
  var emails = ADMIN_EMAILS.map(function (email) { return String(email).trim().toLowerCase(); });
  if (!emails.length || new Set(emails).size !== emails.length || emails.some(function (email) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); })) {
    throw new Error('請先在 ADMIN_EMAILS 填入至少一個實際 Google 管理帳號，不可重複。');
  }
  PropertiesService.getScriptProperties().setProperty('HOLDWIN_ADMINS', JSON.stringify(emails));
  return '管理帳號設定已保存；尚未開放任何管理表單。';
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
    ensureSheet_(ss, SHEETS.history, ['事件 ID', 'Google 收件時間', '類型', '品項 ID', '飲料名稱', '數量', '備註', '管理帳號', '採計狀態']);
    ensureSheet_(ss, SHEETS.wishes, ['願望 ID', '飲料名稱', '購買連結', '備註', '狀態', 'Google 收件時間']);
    ensureSheet_(ss, SHEETS.warehouse);
    ensureSheet_(ss, SHEETS.archive);
    ensureSheet_(ss, SHEETS.setup);
    configureForms_(ss);
    ensureTriggers_(ss);
    writeSetup_(ss);
    refreshWarehouse_();
    if (!props.getProperty('HOLDWIN_PUBLIC_UPDATED_AT')) props.setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
    console.log('私人倉庫已建立：' + ss.getUrl());
    console.log('管理表單預設關閉。請依 GOOGLE-SETUP.md 設定 Google 權限後再啟用。');
    return ss.getUrl();
  });
}

function enablePrivateForms() {
  return locked_(function () {
    adminEmails_();
    if (PRIVATE_FORMS_VERIFIED_AND_RESTRICTED !== true) {
      throw new Error('尚未確認：兩張管理表單必須以已驗證 Google Email 收集身分，且回覆者只限名單中的管理帳號。完成後才可將確認常數改為 true。');
    }
    var forms = forms_();
    if (!forms.stocktake.collectsEmail() || !forms.arrival.collectsEmail()) throw new Error('管理表單必須開啟收集 Email。');
    // Apps Script cannot establish which email-collection mode or responder
    // sharing policy the owner selected. The explicit confirmation above is
    // required; no self-entered email question is ever used as identity.
    var props = PropertiesService.getScriptProperties();
    if (!props.getProperty('HOLDWIN_ADMIN_INTAKE_SINCE')) props.setProperty('HOLDWIN_ADMIN_INTAKE_SINCE', new Date().toISOString());
    props.setProperty('HOLDWIN_PRIVATE_FORMS_READY', 'true');
    forms.stocktake.setAcceptingResponses(true);
    forms.arrival.setAcceptingResponses(true);
    refreshWarehouse_();
    return '管理表單已啟用。請用指定帳號與未授權帳號實測。';
  });
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
    if (parameters.action && parameters.action !== 'public') data = { ok: false, error: 'unsupported_action' };
    else data = publicData_();
  } catch (error) {
    // Never expose a stack, email, raw response, private count or service error.
    data = { ok: false, error: 'public_data_unavailable' };
  }
  var json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(callback ? callback + '(' + json + ');' : json)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function publicData_() {
  var ss = requiredSpreadsheet_();
  var props = PropertiesService.getScriptProperties();
  var sheet = ss.getSheetByName(SHEETS.wishes);
  var wishes = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues().map(function (row) {
    return { id: String(row[0]), name: text_(row[1], 80), url: safeUrl_(row[2]), note: text_(row[3], 500), status: ['pending', 'purchased', 'declined'].indexOf(row[4]) >= 0 ? row[4] : 'pending', createdAt: iso_(row[5]) };
  }).filter(function (wish) { return wish.id && wish.name; });
  // This whitelist is the privacy boundary. Never return warehouse rows,
  // stocktake/arrival responses, emails, stock, quantities or history here.
  var drinks = catalog_(ss).map(function (drink) {
    return { id: drink.id, name: drink.name, category: drink.category, packaging: drink.packaging, unit: drink.unit, perCase: drink.perCase, threshold: drink.threshold, active: drink.active };
  });
  return { ok: true, provider: 'google', drinks: drinks, wishes: wishes, formUrls: { wish: FormApp.openById(props.getProperty('HOLDWIN_WISH_FORM_ID')).getPublishedUrl() }, adminUrl: ss.getUrl() + '#gid=' + ss.getSheetByName(SHEETS.warehouse).getSheetId(), updatedAt: props.getProperty('HOLDWIN_PUBLIC_UPDATED_AT') || null };
}

function refreshWarehouse_() {
  var ss = requiredSpreadsheet_();
  var catalog = catalog_(ss);
  var recorded = historyEvents_(ss);
  var seenResponses = {};
  recorded.forEach(function (event) { seenResponses[event.id.slice(0, event.id.lastIndexOf(':'))] = true; });
  var fresh = intakeEvents_(catalog, seenResponses);
  appendHistory_(ss, fresh);
  syncWishes_(ss);
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
    return { id: String(row[0]), createdAt: iso_(row[1]), type: String(row[2]), drinkId: String(row[3]), quantity: quantity_(row[5], row[2] === 'count'), note: String(row[6] || ''), email: String(row[7] || ''), accepted: row[8] === '採計' };
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
  if (props.getProperty('HOLDWIN_PRIVATE_FORMS_READY') !== 'true') return [];
  var since = Date.parse(props.getProperty('HOLDWIN_ADMIN_INTAKE_SINCE'));
  var admins = adminEmails_();
  var forms = forms_();
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  var events = [];
  ['stocktake', 'arrival'].forEach(function (kind) {
    forms[kind].getResponses().forEach(function (response) {
      var email = String(response.getRespondentEmail() || '').trim().toLowerCase();
      var stamp = response.getTimestamp().toISOString();
      var responseId = response.getId();
      if (seenResponses && seenResponses[responseId]) return;
      if (admins.indexOf(email) < 0 || !Number.isFinite(since) || Date.parse(stamp) < since) {
        events.push({ id: responseId + ':rejected', type: 'rejected', createdAt: stamp, email: email, accepted: false, note: '非指定已驗證帳號，或管理驗證啟用前的回應；未計入庫存' });
        return;
      }
      var answers = {};
      response.getItemResponses().forEach(function (item) { answers[String(item.getItem().getId())] = item.getResponse(); });
      if (kind === 'stocktake') {
        Object.keys(fields.count || {}).forEach(function (itemId) {
          var quantity = quantity_(answers[itemId], true);
          if (quantity === null) return;
          var drinkId = fields.count[itemId];
          events.push({ id: responseId + ':' + itemId, type: 'count', drinkId: drinkId, quantity: quantity, createdAt: stamp, email: email, accepted: true, note: 'Google 表單實際盤點' });
        });
      } else {
        var drinkId = String(answers[fields.arrivalDrink] || '').split('｜')[0].trim();
        var quantity = quantity_(answers[fields.arrivalQuantity], false);
        if (!catalog.some(function (drink) { return drink.id === drinkId; }) || quantity === null) {
          events.push({ id: responseId + ':rejected', type: 'rejected', createdAt: stamp, email: email, accepted: false, note: '到貨品項或數量無效；未計入庫存' });
          return;
        }
        events.push({ id: responseId + ':arrival', type: 'restock', drinkId: drinkId, quantity: quantity, createdAt: stamp, email: email, accepted: true, note: text_(answers[fields.arrivalNote], 500) });
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
    var rows = INITIAL_CATALOG.map(function (drink) { return [drink.id, drink.name, drink.category, drink.packaging, drink.unit, '', 10, true]; });
    sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    sheet.getRange(2, 8, rows.length, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
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

function configureForms_(ss) {
  var props = PropertiesService.getScriptProperties();
  var catalog = catalog_(ss);
  var stocktake = ensureForm_('HOLDWIN_COUNT_FORM_ID', '宏穩茶水間｜管理者完整盤點', ss);
  var arrival = ensureForm_('HOLDWIN_ARRIVAL_FORM_ID', '宏穩茶水間｜管理者到貨入庫', ss);
  var wish = ensureForm_('HOLDWIN_WISH_FORM_ID', '宏穩茶水間｜飲料許願', ss);
  var fields = JSON.parse(props.getProperty('HOLDWIN_FORM_FIELDS') || '{}');
  fields.count = fields.count || {};
  stocktake.setDescription('僅限指定管理者。啟用品項全部填寫實際單包／瓶／罐數量，沒有就是 0。Google 自動記錄收到表單的時間。').setCollectEmail(true);
  arrival.setDescription('僅限指定管理者。實際收到飲料才登記，以單包／瓶／罐計數；分批收到就分次填寫。Google 自動記錄時間。').setCollectEmail(true);
  wish.setDescription('留下你想喝的飲料，可附購買連結與備註。請勿填入個人資料或公司機密。').setCollectEmail(false);
  [stocktake, arrival, wish].forEach(function (form) { form.setLimitOneResponsePerUser(false).setShowLinkToRespondAgain(false).setAllowResponseEdits(false); });
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
  var wishName = findItem_(wish, '想喝的飲料', 'text').setRequired(true).setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).build());
  var wishUrl = findItem_(wish, '購買或產品連結（選填）', 'text').setRequired(false).setValidation(FormApp.createTextValidation().requireTextIsUrl().build());
  var wishNote = findItem_(wish, '許願備註（選填）', 'paragraph').setRequired(false).setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(500).build());
  fields.arrivalDrink = String(arrivalDrink.getId()); fields.arrivalQuantity = String(arrivalQuantity.getId()); fields.arrivalNote = String(arrivalNote.getId());
  fields.wishName = String(wishName.getId()); fields.wishUrl = String(wishUrl.getId()); fields.wishNote = String(wishNote.getId());
  props.setProperty('HOLDWIN_FORM_FIELDS', JSON.stringify(fields));
  if (props.getProperty('HOLDWIN_PRIVATE_FORMS_READY') !== 'true') { stocktake.setAcceptingResponses(false); arrival.setAcceptingResponses(false); }
  wish.setAcceptingResponses(true);
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
    if (!name) return;
    rows.push([id, sheetText_(name), sheetText_(safeUrl_(answers[fields.wishUrl])), sheetText_(text_(answers[fields.wishNote], 500)), 'pending', response.getTimestamp().toISOString()]);
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setNumberFormat('@').setValues(rows);
    props.setProperty('HOLDWIN_PUBLIC_UPDATED_AT', new Date().toISOString());
  }
  if (sheet.getLastRow() > 1) sheet.getRange(2, 5, sheet.getLastRow() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['pending', 'purchased', 'declined'], true).setAllowInvalid(false).build());
}

function appendHistory_(ss, events) {
  var sheet = ss.getSheetByName(SHEETS.history);
  var known = {};
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (row) { known[row[0]] = true; });
  var catalog = catalog_(ss);
  var rows = events.filter(function (event) { return !known[event.id]; }).map(function (event) {
    var drink = catalog.filter(function (item) { return item.id === event.drinkId; })[0];
    return [event.id, event.createdAt, event.type, event.drinkId || '', sheetText_(drink ? drink.name : ''), event.quantity === undefined ? '' : event.quantity, sheetText_(event.note || ''), sheetText_(event.email || ''), event.accepted ? '採計' : '未採計'];
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
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 7, 2).setValues([
      ['宏穩茶水間｜設定與入口', '網址／說明'],
      ['私人倉庫庫存', ss.getUrl() + '#gid=' + ss.getSheetByName(SHEETS.warehouse).getSheetId()],
      ['封存品項與數量紀錄', ss.getUrl() + '#gid=' + ss.getSheetByName(SHEETS.archive).getSheetId()],
      ['完整盤點表單（只限管理者）', forms.stocktake.getPublishedUrl()],
      ['到貨入庫表單（只限管理者）', forms.arrival.getPublishedUrl()],
      ['同事許願表單（公開）', forms.wish.getPublishedUrl()],
      ['公開資料網址', '完成「部署 → 網頁應用程式」後，將 /exec 網址填入網站 googleScriptUrl。']
    ]);
    styleHeader_(sheet, 1, 2); sheet.setColumnWidth(1, 260); sheet.setColumnWidth(2, 520);
  }
}

function ensureTriggers_(ss) {
  var existing = ScriptApp.getProjectTriggers();
  var forms = forms_();
  [forms.stocktake, forms.arrival, forms.wish].forEach(function (form) {
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
  return { stocktake: FormApp.openById(props.getProperty('HOLDWIN_COUNT_FORM_ID')), arrival: FormApp.openById(props.getProperty('HOLDWIN_ARRIVAL_FORM_ID')), wish: FormApp.openById(props.getProperty('HOLDWIN_WISH_FORM_ID')) };
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
