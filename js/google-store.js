import { CATEGORIES_ORDER, canonicalDrinkCategory, canonicalDrinkPackaging } from './catalog.js';
import { blankData, getWeeklyPopularity, safeUrl } from './domain.js';
import { submitGoogleWebsiteCommand } from './google-write.js';
import { normalizeSupplyWarehouse, SNACK_CATEGORIES, SNACK_UNITS, supplyNeedsExpiry, validSupplyExpiry } from './supplies.js';
import { isLowStockItem, isOutOfStockItem, inventoryLowThreshold, matchesInventoryStockFilter, normalizeRestockPreferences, restockThreshold } from './restock-preferences.js';

let googleCallbackSequence = 0;

export function validateGoogleScriptUrl(value) {
  let url;
  try { url = new URL(typeof value === 'string' ? value.trim() : ''); } catch { /* handled below */ }
  if (!url || url.protocol !== 'https:' || url.hostname !== 'script.google.com' ||
      url.username || url.password || url.port || url.search || url.hash ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) {
    throw new Error('請在 config.js 設定已發布的 Google Apps Script HTTPS 網址（結尾為 /exec）。');
  }
  return url.href;
}

/** Read-only JSONP: catalogs, warehouse observations and write receipts. */
export function fetchGooglePublicData(endpoint, options = {}) {
  const url = new URL(validateGoogleScriptUrl(endpoint));
  const action = options.action ?? 'public';
  if (!['public', 'warehouse', 'receipt', 'popularity', 'admin', 'gacha'].includes(action)) throw new Error('不支援的 Google 資料讀取方式。');
  if (action === 'receipt' && !/^[A-Za-z0-9_-]{20,100}$/.test(options.requestId || '')) throw new Error('儲存回條代號不正確。');
  const pageWindow = options.window || globalThis.window;
  const pageDocument = options.document || globalThis.document;
  const schedule = options.setTimeout || globalThis.setTimeout;
  const cancel = options.clearTimeout || globalThis.clearTimeout;
  const timeout = options.timeout ?? 15000;
  if (!pageWindow || !pageDocument?.createElement || !pageDocument.head?.appendChild) {
    return Promise.reject(new Error('目前的瀏覽器無法載入 Google 共用資料。'));
  }
  const callback = `__holdwin_${Date.now().toString(36)}_${(++googleCallbackSequence).toString(36)}_${Math.random().toString(36).slice(2)}`;
  url.searchParams.set('action', action);
  url.searchParams.set('callback', callback);
  if (action === 'receipt') url.searchParams.set('requestId', options.requestId);
  return new Promise((resolve, reject) => {
    const script = pageDocument.createElement('script');
    let timer;
    let settled = false;
    const cleanup = () => {
      if (timer !== undefined) cancel(timer);
      script.onerror = null;
      script.onload = null;
      script.remove();
      delete pageWindow[callback];
    };
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(result);
    };
    pageWindow[callback] = (result) => finish(null, result);
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = url.href;
    script.onerror = () => finish(new Error('無法讀取 Google 共用資料。請確認網路，以及 Apps Script 是否已發布為任何人可讀取。'));
    script.onload = () => {
      if (!settled) finish(new Error('Google 端點未回傳預期資料。請確認部署的是提供的 Apps Script，並重新發布最新版本。'));
    };
    timer = schedule(() => finish(new Error('Google 共用資料讀取逾時，請稍後重新整理。')), timeout);
    try { pageDocument.head.appendChild(script); }
    catch { finish(new Error('無法載入 Google 共用資料，請稍後重新整理。')); }
  });
}

function textField(value, label, max, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw new Error(`Google 共用資料中的${label}格式不正確。`);
  }
  return value.trim();
}

function googleLink(value, kind, required = true) {
  if (!value && !required) return '';
  const normalized = safeUrl(value);
  if (!normalized) throw new Error('Google 表單或倉庫網址設定不正確。');
  const url = new URL(normalized);
  const allowed = url.protocol === 'https:' && !url.port && (
    kind === 'sheet'
      ? url.hostname === 'docs.google.com' && /^\/spreadsheets\/d\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname)
      : (url.hostname === 'docs.google.com' && /^\/forms\/(?:d\/|u\/\d+\/d\/)/.test(url.pathname)) || url.hostname === 'forms.gle'
  );
  if (!allowed) throw new Error('Google 表單或倉庫網址設定不正確。');
  return url.href;
}

function googleDateField(value, label, optional = false) {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Google 共用資料中的${label}格式不正確。`);
  }
  return value;
}

function googleQuantityField(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Google 共用資料中的${label}格式不正確。`);
  return value;
}

function googleVoteForm(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object') throw new Error('Google 贊同表單設定不正確。');
  const url = googleLink(value.url, 'form');
  const parsed = new URL(url);
  if (parsed.hostname !== 'docs.google.com' ||
      !/^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform\/?$/.test(parsed.pathname) ||
      typeof value.wishEntryId !== 'string' || !/^\d{1,20}$/.test(value.wishEntryId) ||
      typeof value.voterEntryId !== 'string' || !/^\d{1,20}$/.test(value.voterEntryId) ||
      value.wishEntryId === value.voterEntryId) {
    throw new Error('Google 贊同表單設定不正確。');
  }
  // Older deployments remain readable, but cannot accept unnamed new votes.
  if (value.voterNameEntryId === undefined || value.voterNameEntryId === '') return null;
  if (typeof value.voterNameEntryId !== 'string' || !/^\d{1,20}$/.test(value.voterNameEntryId) ||
      [value.wishEntryId, value.voterEntryId].includes(value.voterNameEntryId)) {
    throw new Error('Google 贊同表單姓名欄位設定不正確。');
  }
  return { url, wishEntryId: value.wishEntryId, voterEntryId: value.voterEntryId, voterNameEntryId: value.voterNameEntryId };
}

function googleWishForm(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object') throw new Error('Google 許願表單設定不正確。');
  const url = googleLink(value.url, 'form');
  const parsed = new URL(url);
  if (parsed.hostname !== 'docs.google.com' ||
      !/^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform\/?$/.test(parsed.pathname) ||
      typeof value.kindEntryId !== 'string' || !/^\d{1,20}$/.test(value.kindEntryId)) {
    throw new Error('Google 許願表單分類欄位設定不正確。');
  }
  return { url, kindEntryId: value.kindEntryId };
}

function googleProductForm(value) {
  if (!value) return '';
  const url = googleLink(value, 'form');
  const parsed = new URL(url);
  if (parsed.hostname !== 'docs.google.com' || !/^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform\/?$/.test(parsed.pathname)) throw new Error('Google 快速新增飲料表單網址不正確。');
  return url;
}

function normalizeGoogleWish(row) {
  if (!row || typeof row !== 'object') throw new Error('Google 許願清單格式不正確。');
  const url = row.url ? safeUrl(row.url) : '';
  if ((row.url && !url) || url.length > 2000) throw new Error('Google 許願連結格式不正確。');
  if (!['pending', 'purchased', 'declined'].includes(row.status)) throw new Error('Google 願望狀態格式不正確。');
  if (typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))) throw new Error('Google 願望日期格式不正確。');
  const id = textField(row.id, '願望代號', 160);
  const kind = row.kind === undefined ? 'drink' : row.kind;
  if (!['drink', 'snack'].includes(kind)) throw new Error('Google 願望分類格式不正確。');
  const votes = row.votes === undefined ? 0 : googleQuantityField(row.votes, '贊同人數');
  const supporters = row.supporters === undefined ? [] : row.supporters;
  if (!Array.isArray(supporters) || supporters.length > 5000 || supporters.length > votes) throw new Error('Google 贊同名單格式不正確。');
  return {
    id,
    kind,
    name: textField(row.name, '願望名稱', 80),
    url,
    note: row.note === undefined ? '' : textField(row.note, '願望備註', 500, false),
    status: row.status,
    createdAt: row.createdAt,
    votes,
    supporters: supporters.map((name) => textField(name, '贊同姓名', 80)),
    ...(row.sourceDrinkId ? {sourceDrinkId:textField(row.sourceDrinkId,'歷史品項代號',160)} : {}),
  };
}

/** Select display fields, including observed stock only for the warehouse view. */
export function normalizeGooglePublicData(payload, { warehouse = false } = {}) {
  if (!payload || payload.error || payload.ok === false ||
      !(payload.provider === 'google' || payload.ok === true) ||
      !Array.isArray(payload.drinks) || !Array.isArray(payload.wishes) ||
      payload.drinks.length > 1000 || payload.wishes.length > 5000) {
    throw new Error('Google 共用資料格式不正確，請檢查 Apps Script 的部署版本。');
  }
  const ids = new Set();
  const drinks = payload.drinks.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('Google 飲料清單格式不正確。');
    const id = textField(row.id, '品項代號', 160);
    if (ids.has(id)) throw new Error('Google 飲料清單出現重複品項代號。');
    ids.add(id);
    const perCase = row.perCase === null || row.perCase === undefined || row.perCase === '' ? null : row.perCase;
    if (perCase !== null && (!Number.isSafeInteger(perCase) || perCase <= 0 || perCase > 999999)) {
      throw new Error('Google 共用資料中的每箱數量格式不正確。');
    }
    if (!['包', '瓶', '罐'].includes(row.unit)) throw new Error('Google 飲料包裝單位格式不正確。');
    const threshold = row.threshold === undefined ? 10 : row.threshold;
    if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 999999) throw new Error('Google 提醒門檻格式不正確。');
    if (row.active !== undefined && typeof row.active !== 'boolean') throw new Error('Google 品項供應狀態格式不正確。');
    return {
      id,
      name: textField(row.name, '飲料名稱', 80),
      category: canonicalDrinkCategory(textField(row.category, '飲料分類', 80), row.name),
      packaging: canonicalDrinkPackaging(textField(row.packaging, '包裝形式', 80), row.name),
      unit: row.unit,
      perCase,
      threshold,
      active: row.active !== false,
      // The fridge ignores even accidentally supplied stock observations.
      stock: warehouse ? (row.stock === null ? null : googleQuantityField(row.stock, '庫存數量')) : 0,
      target: null,
      lastCountAt: warehouse ? googleDateField(row.lastCountAt, '盤點時間', true) : null,
      ...(warehouse&&row.lastArrivalAt?{lastArrivalAt:googleDateField(row.lastArrivalAt,'入庫時間')}:{}),
    };
  });
  const wishIds = new Set();
  const wishes = payload.wishes.map((row) => {
    const wish = normalizeGoogleWish(row);
    if (wishIds.has(wish.id)) throw new Error('Google 許願清單出現重複願望代號。');
    wishIds.add(wish.id);
    return wish;
  });
  const eventIds = new Set();
  const events = warehouse ? (() => {
    if (!Array.isArray(payload.events) || payload.events.length > 100000) throw new Error('Google 異動紀錄格式不正確。');
    return payload.events.map((row) => {
      if (!row || typeof row !== 'object' || !['count', 'restock'].includes(row.type) || row.accepted === false) {
        throw new Error('Google 異動紀錄格式不正確。');
      }
      const id = textField(row.id, '異動代號', 240);
      if (eventIds.has(id)) throw new Error('Google 異動紀錄出現重複代號。');
      eventIds.add(id);
      return {
        id,
        drinkId: textField(row.drinkId, '異動品項代號', 160),
        type: row.type,
        quantity: googleQuantityField(row.quantity, '異動數量'),
        createdAt: googleDateField(row.createdAt, '異動時間'),
        note: row.note === undefined ? '' : textField(row.note, '異動備註', 500, false),
        recorder: row.recorder === undefined ? '' : textField(row.recorder, '登記人', 80, false),
      };
    });
  })() : [];
  const forms = payload.formUrls || payload.forms || {};
  const formUrls = {
    wish: googleLink(forms.wish, 'form'),
    stocktake: googleLink(forms.stocktake, 'form', false),
    arrival: googleLink(forms.arrival, 'form', false),
    vote: googleLink(forms.vote, 'form', false),
    product: googleProductForm(forms.product),
  };
  const voteForm = googleVoteForm(payload.voteForm);
  const wishForm = googleWishForm(payload.wishForm);
  const adminUrl = googleLink(payload.adminUrl || payload.warehouseUrl, 'sheet');
  const updatedAt = typeof payload.updatedAt === 'string' && Number.isFinite(Date.parse(payload.updatedAt)) ? payload.updatedAt : null;
  return {
    data: { drinks, events, wishes, lastInventoryAt: warehouse ? googleDateField(payload.lastInventoryAt, '最近完整盤點', true) : null },
    formUrls,
    voteForm,
    wishForm,
    adminUrl,
    updatedAt,
    snapshotAt: googleDateField(payload.snapshotAt, '資料讀取時間', true),
    archiveWishVersion: payload.websiteEntry?.archiveWishVersion === 1 ? 1 : 0,
    gachaVersion: payload.websiteEntry?.gachaVersion === 1 ? 1 : 0,
    popularityVersion: payload.websiteEntry?.popularityVersion === 1 ? 1 : 0,
    websiteEntryVersion: payload.websiteEntry?.version === 1 ? 1 : 0,
    archivedArrivalVersion:warehouse&&payload.websiteEntry?.archivedArrivalVersion===1?1:0,
    batchArrivalVersion:warehouse&&payload.websiteEntry?.batchArrivalVersion===1?1:0,
    newArrivalVersion: warehouse && payload.websiteEntry?.newArrivalVersion === 1 ? 1 : 0,
    drinkCategoryVersion: warehouse && payload.websiteEntry?.drinkCategoryVersion === 1 ? 1 : 0,
    zeroStockVersion: warehouse && payload.websiteEntry?.zeroStockVersion === 1 ? 1 : 0,
    ...(warehouse ? normalizeSupplyWarehouse(payload) : {supplies:[],supplyEvents:[],supplyEntryVersion:0,supplyExpiryVersion:0,supplyExpirySetVersion:0}),
    ...(warehouse ? normalizeRestockPreferences(payload) : {restockPreferences:[],restockPreferenceVersion:0}),
  };
}

function normalizeGooglePopularity(payload) {
  const value = payload?.popularity;
  if (payload?.ok !== true || payload.version !== 1 || !value || !Array.isArray(value.rows) || value.rows.length > 3 ||
      !Number.isSafeInteger(value.countedProducts) || value.countedProducts < 0 || value.countedProducts > 1000 ||
      !Number.isSafeInteger(value.observedProducts) || value.observedProducts < 0 || value.observedProducts > value.countedProducts ||
      value.rows.length > value.observedProducts) throw new Error('Google 熱門品項格式不正確。');
  const ids = new Set();
  return {countedProducts:value.countedProducts,observedProducts:value.observedProducts,calculatedAt:googleDateField(value.calculatedAt,'統計時間'),rows:value.rows.map(row=>{
    const id = textField(row?.id,'品項代號',160);
    if (ids.has(id) || !['包','瓶','罐'].includes(row.unit) || !Number.isFinite(row.weeklyRate) || row.weeklyRate <= 0 ||
        !Number.isFinite(row.days) || row.days < 1 || !Number.isSafeInteger(row.samples) || row.samples < 1) throw new Error('Google 熱門品項格式不正確。');
    ids.add(id);
    return {id,name:textField(row.name,'飲料名稱',80),unit:row.unit,weeklyRate:row.weeklyRate,days:row.days,samples:row.samples};
  })};
}

export class GoogleInventoryStore {
  constructor(config = {}, options = {}) {
    this.url = config.googleScriptUrl || '';
    this.mode = 'google';
    this.isEditor = false;
    this.user = null;
    this.preview = true;
    this.inWarehouse = false;
    this.data = blankData();
    this.formUrls = { wish: '', stocktake: '', arrival: '', vote: '', product: '' };
    this.voteForm = null;
    this.wishForm = null;
    this.forms = this.formUrls;
    this.adminUrl = '';
    this.warehouseUrl = '';
    this.updatedAt = null;
    this.revision = '';
    this.googleReadSequence = 0;
    this.confirmedWriteSequence = 0;
    this.pendingGoogleReads = new Map();
    this.wishSnapshotTimes = new Map();
    this.snapshotAt = null;
    this.popularityVersion = 0;
    this.archiveWishVersion = 0;
    this.googleViewLoaded = false;
    this.adminSummary = null;
    this.adminSummaryReadAt = -Infinity;
    this.adminSummaryRequest = null;
    this.websiteEntryVersion = 0;
    this.newArrivalVersion = 0;
    this.drinkCategoryVersion = 0;
    this.zeroStockVersion = 0;
    this.gachaVersion = 0;
    this.gachaRequest = null;
    this.lastWriteNeedsRefresh = false;
    this.completedWrites = new Set();
    this.readPublicData = options.readPublicData || fetchGooglePublicData;
    this.voteStorage = options.voteStorage;
    this.createVoterId = options.createVoterId || (() => globalThis.crypto.randomUUID());
    this.createRequestId = options.createRequestId || (() => globalThis.crypto.randomUUID());
    this.pendingStorage = options.pendingStorage;
    this.submitWebsiteCommand = options.submitWebsiteCommand || submitGoogleWebsiteCommand;
    this.readReceipt = options.readReceipt || ((requestId) => fetchGooglePublicData(this.url, { action: 'receipt', requestId }));
    this.publicStorage = options.publicStorage;
    this.now = options.now || Date.now;
    this.revalidateOnStart = false;
    this.popularity = null;
    this.popularityReadAt = 0;
    this.popularityRequest = null;
    this.supplies = [];
    this.supplyEvents = [];
    this.supplyEntryVersion = 0;
    this.supplySnackVersion = 0;
    this.supplySnackPolicyVersion = 0;
    this.snackManualVersion = 0;
    this.supplyExpiryVersion = 0;
    this.supplyExpirySetVersion = 0;
    this.restockPreferences = [];
    this.restockPreferenceVersion = 0;
  }

  get canEdit() { return false; }
  get canManage() { return true; }
  get supportsArchivedArrivals() { return this.supportsWebsiteEntry&&this.archivedArrivalVersion===1; }
  get supportsZeroStockDecisions() { return this.zeroStockVersion===1; }
  get supportsGacha() { return this.gachaVersion===1; }
  get supportsBatchArrival() { return this.supportsWebsiteEntry&&this.batchArrivalVersion===1; }
  get supportsSnackFlavors() { return this.supportsSupplies&&this.snackFlavorVersion===1; }
  get supportsManualRestock() { return this.supportsRestockPreferences&&this.manualAllVersion===1; }
  get supportsWebsiteEntry() { return this.websiteEntryVersion === 1; }
  get supportsArchiveWishes() { return this.supportsWebsiteEntry && this.archiveWishVersion === 1; }
  get supportsDrinkArrivalCategories() { return this.supportsNewArrivals && this.drinkCategoryVersion === 1; }
  get supportsNewArrivals() { return this.supportsWebsiteEntry && this.newArrivalVersion === 1; }
  get supportsSupplies() { return this.supportsWebsiteEntry && this.supplyEntryVersion === 1; }
  get supportsSnacks() { return this.supportsSupplies && this.supplySnackVersion===1; }
  get supportsSnackNoExpiry() { return this.supportsSnacks && this.supplySnackPolicyVersion===2; }
  get supportsSnackRestockFlags() { return this.supportsSnacks && this.supportsRestockPreferences && this.snackManualVersion===1; }
  get supportsSupplyExpiry() { return this.supportsSupplies && this.supplyExpiryVersion===1; }
  get supportsSupplyExpirySet() { return this.supportsSupplyExpiry && this.supplyExpirySetVersion===1; }
  get supportsRestockPreferences() { return this.supportsWebsiteEntry && this.restockPreferenceVersion===1; }

  async init() {
    // Reuse only a validated public display. Warehouse counts are never cached.
    try {
      const endpoint = validateGoogleScriptUrl(this.url);
      const saved = (this.publicStorage || globalThis.localStorage)?.getItem(`holdwin-public-cache-v1:${endpoint}`);
      if (saved && saved.length < 750000) {
        const cached = JSON.parse(saved), age = this.now() - cached.savedAt;
        if (cached.version === 1 && age >= 0 && age < 86400000) {
          const result = normalizeGooglePublicData(cached.payload);
          this.applyGoogleView(result, false);
          this.revalidateOnStart = true;
          return;
        }
      }
    } catch { /* A missing, expired, or invalid cache falls back to Google. */ }
    await this.read();
  }

  async read() { return this.readGoogleView(this.inWarehouse); }

  async readWarehouse() { return this.readGoogleView(true); }

  async openPublic() {
    if (!this.googleViewLoaded) return this.readPublic();
    if (!this.inWarehouse) return this.data;
    // Reuse already validated display fields when returning from administration.
    // Quantities and private histories are discarded before rendering or caching.
    const result = normalizeGooglePublicData({ok:true,drinks:this.data.drinks,wishes:this.data.wishes,
      formUrls:this.formUrls,voteForm:this.voteForm,wishForm:this.wishForm,adminUrl:this.adminUrl,
      updatedAt:this.updatedAt,snapshotAt:this.snapshotAt,
      websiteEntry:{version:this.websiteEntryVersion,popularityVersion:this.popularityVersion,archiveWishVersion:this.archiveWishVersion,gachaVersion:this.gachaVersion}});
    ++this.googleReadSequence;
    this.pendingGoogleReads.delete('public');
    this.applyGoogleView(result, false);
    this.revalidateOnStart = true;
    return this.data;
  }

  cancelOtherViewReads(warehouse) {
    const other=warehouse?'public':'warehouse';
    if(this.pendingGoogleReads.has(other)){++this.googleReadSequence;this.pendingGoogleReads.delete(other);}
  }

  async readPublic() { return this.readGoogleView(false); }

  async readGoogleView(warehouse) {
    const sequence = ++this.googleReadSequence, writeSequence = this.confirmedWriteSequence;
    const endpoint = validateGoogleScriptUrl(this.url);
    let payload;
    try {
      const action = warehouse ? 'warehouse' : 'public';
      let request = this.pendingGoogleReads.get(action);
      if (!request) {
        request = this.readPublicData(endpoint, { action });
        this.pendingGoogleReads.set(action, request);
      }
      try { payload = await request; }
      finally { if (this.pendingGoogleReads.get(action) === request) this.pendingGoogleReads.delete(action); }
    } catch (error) {
      if (sequence !== this.googleReadSequence || writeSequence !== this.confirmedWriteSequence) return this.data;
      throw error;
    }
    if (sequence !== this.googleReadSequence || writeSequence !== this.confirmedWriteSequence) return this.data;
    if (warehouse && payload?.error === 'unsupported_action') {
      throw new Error('目前 Google 程式還不支援免登入倉庫，請更新 Code.gs 並重新部署。');
    }
    const result = normalizeGooglePublicData(payload, { warehouse });
    // Assign only after the full response validates; preserve the last valid
    // view on errors and never seed demo data or accept remote role flags.
    this.applyGoogleView(result, warehouse);
    this.revalidateOnStart = false;
    if (!warehouse) {
      try {
        const payload = { ok: true, provider: 'google', drinks: result.data.drinks, wishes: result.data.wishes,
          formUrls: result.formUrls, voteForm: result.voteForm, wishForm: result.wishForm,
          adminUrl: result.adminUrl, updatedAt: result.updatedAt, snapshotAt: result.snapshotAt, websiteEntry: { version: result.websiteEntryVersion, popularityVersion: result.popularityVersion, archiveWishVersion:result.archiveWishVersion,gachaVersion:result.gachaVersion } };
        const saved = JSON.stringify({ version: 1, savedAt: this.now(), payload });
        if (saved.length < 750000) (this.publicStorage || globalThis.localStorage)?.setItem(`holdwin-public-cache-v1:${endpoint}`, saved);
      } catch { /* Storage is optional; fresh Google data still works. */ }
    }
    return this.data;
  }

  applyGoogleView(result, warehouse) {
    this.googleViewLoaded = true;
    this.data = result.data;
    this.formUrls = result.formUrls;
    this.forms = this.formUrls;
    this.voteForm = result.voteForm;
    this.wishForm = result.wishForm;
    this.inWarehouse = warehouse;
    this.adminUrl = result.adminUrl;
    this.warehouseUrl = this.adminUrl;
    this.updatedAt = result.updatedAt;
    this.snapshotAt = result.snapshotAt;
    this.popularityVersion = result.popularityVersion;
    this.archiveWishVersion = result.archiveWishVersion;
    this.gachaVersion = result.gachaVersion || 0;
    this.websiteEntryVersion = result.websiteEntryVersion;
    this.newArrivalVersion = result.newArrivalVersion || 0;
    this.drinkCategoryVersion = result.drinkCategoryVersion || 0;
    this.zeroStockVersion = result.zeroStockVersion || 0;
    this.archivedArrivalVersion=result.archivedArrivalVersion||0;this.batchArrivalVersion=result.batchArrivalVersion||0;this.snackFlavorVersion=result.snackFlavorVersion||0;this.manualAllVersion=result.manualAllVersion||0;
    this.supplies = result.supplies || [];
    this.supplyEvents = result.supplyEvents || [];
    this.supplyEntryVersion = result.supplyEntryVersion || 0;
    this.supplySnackVersion = result.supplySnackVersion || 0;
    this.supplySnackPolicyVersion = result.supplySnackPolicyVersion || 0;
    this.snackManualVersion = result.snackManualVersion || 0;
    this.supplyExpiryVersion = result.supplyExpiryVersion || 0;
    this.supplyExpirySetVersion = result.supplyExpirySetVersion || 0;
    this.restockPreferences = result.restockPreferences || [];
    this.restockPreferenceVersion = result.restockPreferenceVersion || 0;
    this.revision = JSON.stringify({ data: result.data, formUrls: result.formUrls, voteForm: result.voteForm, wishForm: result.wishForm, adminUrl: result.adminUrl, websiteEntryVersion: result.websiteEntryVersion, gachaVersion:this.gachaVersion, newArrivalVersion:this.newArrivalVersion,drinkCategoryVersion:this.drinkCategoryVersion,batchArrivalVersion:this.batchArrivalVersion,archivedArrivalVersion:this.archivedArrivalVersion,snackFlavorVersion:this.snackFlavorVersion,manualAllVersion:this.manualAllVersion, supplies:this.supplies,supplyEvents:this.supplyEvents,supplyEntryVersion:this.supplyEntryVersion,supplySnackVersion:this.supplySnackVersion,supplySnackPolicyVersion:this.supplySnackPolicyVersion,snackManualVersion:this.snackManualVersion,supplyExpiryVersion:this.supplyExpiryVersion,supplyExpirySetVersion:this.supplyExpirySetVersion,restockPreferences:this.restockPreferences,restockPreferenceVersion:this.restockPreferenceVersion });
  }

  applyWishReceipt(operation, data, result, requestId) {
    if (!['wish', 'vote', 'archive-wish'].includes(operation) || result?.operation !== operation ||
        typeof result.snapshotAt !== 'string' || !Number.isFinite(Date.parse(result.snapshotAt))) return false;
    try {
      const wish = normalizeGoogleWish(result.wish);
      const expectedId = operation === 'wish' ? `wish-web-${requestId}` : operation === 'archive-wish' ? result.id : data.wishId;
      if (operation === 'archive-wish' && wish.sourceDrinkId !== data.drinkId) return false;
      if (wish.id !== expectedId || (operation === 'wish' && result.id !== wish.id)) return false;
      const stamp = Date.parse(result.snapshotAt);
      const current = this.data.wishes.find(entry => entry.id === wish.id);
      // Replaying an older accepted receipt must not roll back a newer read/vote.
      if (stamp < Math.max(Date.parse(this.snapshotAt) || 0, this.wishSnapshotTimes.get(wish.id) || 0) ||
          (current && current.votes > wish.votes)) return true;
      this.wishSnapshotTimes.set(wish.id, stamp);
      this.data.wishes = [...this.data.wishes.filter(entry => entry.id !== wish.id), wish];
      this.revision = JSON.stringify({data:this.data,wishReceipt:result.snapshotAt});
      // Keep the cache's original freshness: a wish receipt does not refresh drinks.
      try {
        const storage = this.publicStorage || globalThis.localStorage;
        const key = `holdwin-public-cache-v1:${validateGoogleScriptUrl(this.url)}`;
        const raw = storage?.getItem(key);
        if (raw && raw.length < 750000) {
          const saved = JSON.parse(raw);
          if (saved.version === 1) {
            const cached = normalizeGooglePublicData(saved.payload);
            saved.payload.wishes = [...cached.data.wishes.filter(entry => entry.id !== wish.id), wish];
            storage.setItem(key, JSON.stringify(saved));
          }
        }
      } catch { /* Optional cache failures never undo a confirmed write. */ }
      return true;
    } catch { return false; }
  }

  async readAdminSummary() {
    if (this.adminSummary && this.now() - this.adminSummaryReadAt < 15000) return this.adminSummary;
    if (this.adminSummaryRequest) return this.adminSummaryRequest;
    this.adminSummaryRequest = (async () => {
      const writeSequence=this.confirmedWriteSequence;
      let value = await this.readPublicData(validateGoogleScriptUrl(this.url), {action:'admin'});
      if (value?.error === 'unsupported_action') {
        const legacy = normalizeGooglePublicData(await this.readPublicData(validateGoogleScriptUrl(this.url), {action:'warehouse'}),{warehouse:true});
        const items = [...legacy.data.drinks.map(item=>({...item,kind:'drink'})),...legacy.supplies];
        value = {ok:true,version:1,totalDrinks:legacy.data.drinks.length,pendingWishes:legacy.data.wishes.filter(wish=>wish.status==='pending').length,
          manualSnackItems:items.filter(item=>item.kind==='snack'&&item.active!==false&&legacy.restockPreferences.some(entry=>entry.kind==='snack'&&entry.itemId===item.id&&entry.mode==='consider')).map(item=>({kind:'snack',id:item.id,name:item.name,unit:item.unit,stock:item.stock,mode:'consider',markedAt:legacy.restockPreferences.find(entry=>entry.kind==='snack'&&entry.itemId===item.id).updatedAt})),
          outOfStockItems:items.filter(item=>item.active!==false&&isOutOfStockItem(item)).map(item=>({kind:item.kind,id:item.id,name:item.name,unit:item.unit,stock:0,mode:legacy.restockPreferences.find(entry=>entry.kind===item.kind&&entry.itemId===item.id)?.mode||'normal'})),
          lowItems:items.filter(item=>item.active!==false&&matchesInventoryStockFilter(item,'low',legacy.restockPreferences)).map(item=>({kind:item.kind,id:item.id,name:item.name,unit:item.unit,stock:item.stock,mode:legacy.restockPreferences.find(entry=>entry.kind===item.kind&&entry.itemId===item.id)?.mode||'normal'}))};
      }
      if (value?.ok !== true || value.version !== 1 || !Number.isSafeInteger(value.totalDrinks) || value.totalDrinks < 0 || value.totalDrinks > 1000 ||
          !Number.isSafeInteger(value.pendingWishes) || value.pendingWishes < 0 || value.pendingWishes > 5000 || !Array.isArray(value.lowItems) || value.lowItems.length > 2000) throw new Error('後台摘要格式不正確，請稍後重新讀取。');
      const ids = new Set();
      const legacyLowItems = value.lowItems.map(row=>{
        // Older deployments report every kind through ten; validate that envelope before applying current thresholds.
        if (!row || !['drink','snack','noodle','toner'].includes(row.kind) || !['normal','hold','replace','consider'].includes(row.mode) ||
            !(row.kind==='drink'?['包','瓶','罐']:row.kind==='snack'?SNACK_UNITS:row.kind==='noodle'?['杯','碗']:['盒']).includes(row.unit) || !Number.isSafeInteger(row.stock) || row.stock < 0 || row.stock > 10) throw new Error('後台低庫存摘要格式不正確。');
        const id=textField(row.id,'品項代號',160),name=textField(row.name,'品項名稱',80),key=`${row.kind}:${id}`;
        if(ids.has(key))throw new Error('後台摘要有重複品項。');ids.add(key);
        return {id,name,kind:row.kind,unit:row.unit,stock:row.stock,mode:row.mode,flavor:row.flavor===undefined?'':textField(row.flavor,'口味',80,false)};
      });
      const lowItems=legacyLowItems.filter(item=>inventoryLowThreshold(item.kind)!==null&&item.stock<=inventoryLowThreshold(item.kind)&&(item.stock>0||item.kind==='toner')&&(!['snack','noodle'].includes(item.kind)||item.mode==='consider')).sort((a,b)=>Number(b.mode==='consider')-Number(a.mode==='consider')||a.stock-b.stock);
      const empty=value.outOfStockItems===undefined?legacyLowItems.filter(item=>['drink','snack','noodle'].includes(item.kind)&&item.stock===0):value.outOfStockItems;
      if(!Array.isArray(empty)||empty.length>2000)throw new Error('後台零庫存摘要格式不正確。');
      const emptyIds=new Set();
      const outOfStockItems=empty.map(row=>{
        if(!row||!['drink','snack','noodle'].includes(row.kind)||!['normal','hold','replace','consider'].includes(row.mode)||
            !(row.kind==='drink'?['包','瓶','罐']:row.kind==='snack'?SNACK_UNITS:['杯','碗']).includes(row.unit)||row.stock!==0)throw new Error('後台零庫存摘要格式不正確。');
        const id=textField(row.id,'品項代號',160),name=textField(row.name,'品項名稱',80),key=`${row.kind}:${id}`;
        if(emptyIds.has(key))throw new Error('後台零庫存摘要有重複品項。');emptyIds.add(key);
        if(row.zeroStockPending!==undefined&&typeof row.zeroStockPending!=='boolean')throw new Error('無庫存處理狀態不正確。');
        return {id,name,kind:row.kind,unit:row.unit,stock:0,mode:row.mode,zeroStockPending:row.zeroStockPending===true,flavor:row.flavor===undefined?'':textField(row.flavor,'口味',80,false)};
      });
      const manual=value.manualSnackItems===undefined?[]:value.manualSnackItems;
      if(!Array.isArray(manual)||manual.length>1000)throw new Error('零食手動補貨摘要格式不正確。');
      const manualIds=new Set();
      const manualSnackItems=manual.map(row=>{
        if(!row||row.kind!=='snack'||row.mode!=='consider'||!SNACK_UNITS.includes(row.unit)||(row.stock!==null&&(!Number.isSafeInteger(row.stock)||row.stock<0||row.stock>999999))||typeof row.markedAt!=='string'||!Number.isFinite(Date.parse(row.markedAt)))throw new Error('零食手動補貨摘要格式不正確。');
        const id=textField(row.id,'品項代號',160),name=textField(row.name,'品項名稱',80);
        if(manualIds.has(id))throw new Error('零食手動補貨摘要有重複品項。');manualIds.add(id);
        return {kind:'snack',id,name,unit:row.unit,stock:row.stock,mode:'consider',markedAt:row.markedAt};
      });
      if(writeSequence!==this.confirmedWriteSequence)throw new Error('庫存剛更新，請重新讀取摘要。');
      const restockItems=(value.restockItems===undefined?manualSnackItems:value.restockItems);
      if(!Array.isArray(restockItems)||restockItems.length>2000)throw new Error('補貨清單格式不正確。');
      const markedIds=new Set();
      const marked=restockItems.map(row=>{
        if(!row||!['drink','snack','noodle','toner'].includes(row.kind)||row.mode!=='consider'||(row.stock!==null&&(!Number.isSafeInteger(row.stock)||row.stock<0||row.stock>999999)))throw new Error('補貨品項格式不正確。');
        const key=row.kind+':'+row.id;if(markedIds.has(key))throw new Error('補貨品項重複。');markedIds.add(key);
        if(!(row.kind==='drink'?['包','瓶','罐']:row.kind==='noodle'?['杯','碗']:row.kind==='toner'?['盒']:SNACK_UNITS).includes(row.unit))throw new Error('補貨單位不正確。');
        return {kind:row.kind,id:textField(row.id,'品項代號',160),name:textField(row.name,'品項名稱',80),flavor:textField(row.flavor||'','口味',80,false),unit:row.unit,stock:row.stock,mode:'consider'};
      });
      const activityRow=row=>{
        if(!row||!['drink','snack','noodle','toner'].includes(row.kind)||!['count','restock'].includes(row.type))throw new Error('近期庫存紀錄格式不正確。');
        if(!(row.kind==='drink'?['包','瓶','罐']:row.kind==='noodle'?['杯','碗']:row.kind==='toner'?['盒']:SNACK_UNITS).includes(row.unit))throw new Error('近期庫存單位不正確。');
        return {id:textField(row.id,'紀錄代號',240),itemId:textField(row.itemId,'品項代號',160),kind:row.kind,name:textField(row.name,'品名',80),flavor:textField(row.flavor||'','口味',80,false),unit:row.unit,quantity:googleQuantityField(row.quantity,'紀錄數量'),createdAt:googleDateField(row.createdAt,'紀錄時間'),type:row.type};
      };
      const arrivals=value.recentArrivals===undefined?[]:value.recentArrivals,counts=value.recentCounts===undefined?[]:value.recentCounts;
      if(!Array.isArray(arrivals)||arrivals.length>12||!Array.isArray(counts)||counts.length>4)throw new Error('近期庫存摘要過多。');
      const recentArrivals=arrivals.map(activityRow);if(recentArrivals.some(row=>row.type!=='restock'))throw new Error('入庫摘要類型不正確。');
      const countKinds=new Set();
      const recentCounts=counts.map(group=>{
        if(!group||!['drink','snack','noodle','toner'].includes(group.kind)||countKinds.has(group.kind)||!Array.isArray(group.items)||group.items.length>1000)throw new Error('盤點摘要不正確。');countKinds.add(group.kind);
        const countedAt=googleDateField(group.countedAt,'盤點時間',true),items=group.items.map(activityRow);
        if(items.some(item=>item.type!=='count'||item.kind!==group.kind||item.createdAt!==countedAt))throw new Error('盤點摘要內容不一致。');return {kind:group.kind,countedAt,items};
      });
      this.zeroStockVersion=value.zeroStockVersion===1?1:0;
      if(this.zeroStockVersion===1)this.websiteEntryVersion=1;
      this.adminSummary={totalDrinks:value.totalDrinks,pendingWishes:value.pendingWishes,lowItems,outOfStockItems,manualSnackItems,restockItems:marked,activityVersion:value.activityVersion===1?1:0,recentArrivals,recentCounts,snapshotAt:googleDateField(value.snapshotAt,'摘要時間',true)};this.adminSummaryReadAt=this.now();
      return this.adminSummary;
    })();
    try { return await this.adminSummaryRequest; } finally { this.adminSummaryRequest=null; }
  }

  async readPopularity() {
    if (this.popularity && this.now() - this.popularityReadAt < 300000) return this.popularity;
    if (this.popularityRequest) return this.popularityRequest;
    this.popularityRequest = (async () => {
      // This separate read never changes the current route or public catalog.
      // It uses the existing deployment and retains only aggregate rates.
      const payload = await this.readPublicData(validateGoogleScriptUrl(this.url), { action: this.popularityVersion === 1 ? 'popularity' : 'warehouse' });
      if (this.popularityVersion === 1) this.popularity = normalizeGooglePopularity(payload);
      else {
        const result = normalizeGooglePublicData(payload, { warehouse: true });
        this.popularity = getWeeklyPopularity(result.data.drinks, result.data.events, new Date(this.now()));
      }
      this.popularityReadAt = this.now();
      return this.popularity;
    })();
    try { return await this.popularityRequest; }
    finally { this.popularityRequest = null; }
  }

  getWishUrl(kind = 'drink') {
    if (!['drink', 'snack'].includes(kind)) throw new Error('請選擇飲料許願或零食許願。');
    if (!this.wishForm) throw new Error('許願表單分類尚未啟用，請更新 Google 設定並重新部署。');
    const url = new URL(this.wishForm.url);
    url.searchParams.set('usp', 'pp_url');
    url.searchParams.set(`entry.${this.wishForm.kindEntryId}`, kind === 'snack' ? '零食' : '飲料');
    return url.href;
  }

  getProductFormUrl() {
    if (!this.formUrls.product) throw new Error('快速新增飲料表單尚未啟用，請更新 Google 設定並重新部署。');
    const url = new URL(googleProductForm(this.formUrls.product));
    url.searchParams.set('embedded', 'true');
    return url.href;
  }

  getVoteUrl(wishId, voterName) {
    if (!this.data.wishes.some((wish) => wish.id === wishId)) throw new Error('找不到這個願望，請重新整理後再試。');
    if (!this.voteForm) throw new Error('贊同表單姓名欄位尚未啟用，請更新 Google 設定並重新部署。');
    if (typeof voterName !== 'string' || !voterName.trim() || voterName.trim().length > 80) throw new Error('請填寫姓名，最多 80 字。');
    const voterId = this.getVoterId();
    const url = new URL(this.voteForm.url);
    url.searchParams.set('usp', 'pp_url');
    url.searchParams.set(`entry.${this.voteForm.wishEntryId}`, wishId);
    url.searchParams.set(`entry.${this.voteForm.voterEntryId}`, voterId);
    url.searchParams.set(`entry.${this.voteForm.voterNameEntryId}`, voterName.trim());
    return url.href;
  }

  getVoterId() {
    let voterId;
    try {
      const storage = this.voteStorage || globalThis.localStorage;
      voterId = storage.getItem('holdwin-wish-voter-v1');
      if (!/^[A-Za-z0-9_-]{16,80}$/.test(voterId || '')) {
        voterId = this.createVoterId();
        if (!/^[A-Za-z0-9_-]{16,80}$/.test(voterId || '')) throw new Error('Invalid browser identifier');
        storage.setItem('holdwin-wish-voter-v1', voterId);
      }
    } catch {
      throw new Error('請允許此網站儲存瀏覽器資料，才能避免重複贊同。');
    }
    return voterId;
  }

  hasVoted(wishId) {
    try { return (this.voteStorage || globalThis.localStorage).getItem(`holdwin-google-voted-v1:${this.url}:${wishId}`) === 'true'; }
    catch { return false; }
  }

  async sendWebsiteCommand(operation, data) {
    if (!this.supportsWebsiteEntry) throw new Error('請先更新 Google Apps Script 的 Code.gs，並部署新版本，才能直接在網站送出。');
    const endpoint = validateGoogleScriptUrl(this.url);
    const key = `holdwin-google-pending-v1:${endpoint}:${operation}`;
    let signature = JSON.stringify(data);
    let storage, pending;
    try {
      storage = this.pendingStorage || globalThis.sessionStorage;
      pending = JSON.parse(storage.getItem(key) || 'null');
      if (pending && (!/^[A-Za-z0-9_-]{20,100}$/.test(pending.requestId || '') || typeof pending.signature !== 'string')) throw new Error('Invalid pending request');
    } catch { throw new Error('目前無法保留送出紀錄，請允許網站使用瀏覽器儲存空間，避免重複入庫。'); }
    const clearPending = () => { try { storage.removeItem(key); } catch { /* acknowledgements still prove the write succeeded */ } };
    const acknowledge = (state, result) => {
      this.completedWrites.add(pending.requestId);
      try { storage.setItem(key, JSON.stringify({ ...pending, state, result })); } catch { /* retain the server result in memory */ }
      clearPending();
    };
    if (pending && (pending.state === 'accepted' || pending.state === 'rejected' || this.completedWrites.has(pending.requestId))) { clearPending(); pending = null; }
    // A partial arrival can already have reactivated the item. Preserve the
    // original intent when only its derived archive flag changed on refresh.
    if(pending&&pending.signature!==signature&&['arrival','supply-arrival','batch-arrival'].includes(operation)){
      try{
        const saved=JSON.parse(pending.signature),withoutFlag=value=>{
          const copy=structuredClone(value);delete copy.restoreArchived;
          if(Array.isArray(copy.entries))for(const entry of copy.entries)delete entry.restoreArchived;
          return JSON.stringify(copy);
        };
        if(saved&&typeof saved==='object'&&!Array.isArray(saved)&&withoutFlag(saved)===withoutFlag(data)){data=saved;signature=pending.signature;}
      }catch{/* Malformed or materially changed drafts retain the normal receipt check. */}
    }
    if (pending && pending.signature !== signature) {
      let receipt;
      try { receipt = await this.readReceipt(pending.requestId); } catch { /* keep the unresolved request */ }
      if (receipt?.requestId === pending.requestId && receipt.state === 'accepted' && receipt.ok === true) {
        acknowledge('accepted', receipt.result);
        await this.read().catch(() => {});
        throw new Error('上一筆資料已經儲存。請先確認更新後的紀錄，再送出這筆修改。');
      }
      if (receipt?.requestId === pending.requestId && receipt.state === 'rejected') { acknowledge('rejected'); pending = null; }
      else throw new Error('上一筆送出仍待確認。請先保留原內容重試，避免重複入庫。');
    }
    if (!pending) pending = { requestId: this.createRequestId(), signature };
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(pending.requestId)) throw new Error('無法建立這次送出紀錄，請重新開啟網站。');
    try { storage.setItem(key, JSON.stringify(pending)); }
    catch { throw new Error('目前無法保留送出紀錄，資料尚未送出。'); }
    this.lastWriteNeedsRefresh = false;
    let result;
    try { result = await this.submitWebsiteCommand(endpoint, { requestId: pending.requestId, operation, data }, { readReceipt: this.readReceipt }); }
    catch (error) { if (error.code === 'rejected') acknowledge('rejected'); throw error; }
    // A confirmed write stays a success even if the following read fails.
    acknowledge('accepted', result);
    this.confirmedWriteSequence += 1;
    this.pendingGoogleReads.clear();
    this.adminSummaryReadAt = -Infinity;
    if (this.applyWishReceipt(operation, data, result, pending.requestId)) return result;
    if (operation==='zero-stock-decision' && this.applyZeroStockReceipt(data,result)) return result;
    if (['stocktake', 'arrival', 'product', 'new-arrival','batch-arrival'].includes(operation)) this.popularityReadAt = -Infinity;
    try { await this.read(); } catch { this.lastWriteNeedsRefresh = true; }
    return result;
  }

  async submitWish({ kind, name, url = '', note = '' }) {
    if (!this.supportsWebsiteEntry) throw new Error('請先更新 Google Apps Script 的 Code.gs，並部署新版本，才能直接在網站送出。');
    if (!['drink', 'snack'].includes(kind) || typeof name !== 'string' || !name.trim() || name.trim().length > 80 || typeof note !== 'string' || note.length > 500) throw new Error('請選擇類型並填寫有效的品項名稱與備註。');
    const link = url ? safeUrl(url) : '';
    if (url && !link) throw new Error('請填寫有效的 http 或 https 連結。');
    return this.sendWebsiteCommand('wish', { kind, name: name.trim(), url: link, note: note.trim() });
  }

  async supportArchivedDrink(drinkId, voterName) {
    if (!this.supportsArchiveWishes) throw new Error('請先更新 Google 部署，才能登記歷史品項的回購願望。');
    if (!this.data.drinks.some(drink=>drink.id===drinkId&&drink.active===false)) throw new Error('找不到這個歷史品項。');
    if (typeof voterName !== 'string' || !voterName.trim() || voterName.trim().length > 80) throw new Error('請填寫姓名，最多 80 字。');
    const result=await this.sendWebsiteCommand('archive-wish',{drinkId,voterName:voterName.trim(),voterId:this.getVoterId()});
    if (typeof result.id === 'string') try { (this.voteStorage || globalThis.localStorage).setItem(`holdwin-google-voted-v1:${this.url}:${result.id}`,'true'); } catch { /* Server deduplication still applies. */ }
    return result;
  }

  async voteWish(wishId, voterName) {
    if (!this.supportsWebsiteEntry) throw new Error('請先更新 Google 程式，才能直接在網站贊同。');
    if (!this.data.wishes.some((wish) => wish.id === wishId)) throw new Error('找不到這個願望，請重新整理後再試。');
    if (typeof voterName !== 'string' || !voterName.trim() || voterName.trim().length > 80) throw new Error('請填寫姓名，最多 80 字。');
    const result = await this.sendWebsiteCommand('vote', { wishId, voterName: voterName.trim(), voterId: this.getVoterId() });
    try { (this.voteStorage || globalThis.localStorage).setItem(`holdwin-google-voted-v1:${this.url}:${wishId}`, 'true'); } catch { /* the server still prevents duplicate votes */ }
    return result;
  }

  async submitStocktake(entries, recorder) {
    return this.sendWebsiteCommand('stocktake', { entries, recorder });
  }

  async submitArrival({ drinkId, cases, loose, recorder, note = '', restoreArchived=false }) {
    if(restoreArchived&&!this.supportsArchivedArrivals)throw new Error('請先更新 Google 部署，才能重新入庫歷史品項。');
    return this.sendWebsiteCommand('arrival', { drinkId, cases, loose, recorder, note,...(restoreArchived?{restoreArchived:true}:{}) });
  }

  async submitNewArrival(data) {
    if (data.kind === 'drink') {
      if (!CATEGORIES_ORDER.includes(data.category)) throw new Error('請選擇飲料分類。');
      if (!this.supportsDrinkArrivalCategories) throw new Error('請先更新原 Apps Script 部署，才能保存新品飲料的分類。');
    }
    if (!this.supportsNewArrivals) throw new Error('請先更新 Apps Script 部署，才能在入庫時登記新品。');
    if (data.kind==='snack') {
      if(!this.supportsSnackNoExpiry)throw new Error('請先更新 Apps Script 部署，啟用零食免填效期登記。');
      if(!SNACK_CATEGORIES.includes(data.category)||!SNACK_UNITS.includes(data.unit))throw new Error('請選擇有效的零食分類與單位。');
      if(data.expiresOn!=null&&data.expiresOn!==''&&!validSupplyExpiry(data.expiresOn))throw new Error('零食保存期限格式不正確。');
    }
    if (supplyNeedsExpiry(data.kind) && !this.supportsSupplyExpiry) throw new Error('請更新 Apps Script 部署，啟用食品保存期限。');
    return this.sendWebsiteCommand('new-arrival', data);
  }

  async submitBatchArrival(data) {
    const newDrinks = data.entries?.filter(entry => entry.isNew && entry.kind === 'drink') || [];
    if (newDrinks.some(entry => !CATEGORIES_ORDER.includes(entry.category))) throw new Error('請選擇每款新品飲料的分類。');
    if (newDrinks.length && !this.supportsDrinkArrivalCategories) throw new Error('請先更新原 Apps Script 部署，才能保存新品飲料的分類。');
    if(data.entries?.some(entry=>entry.restoreArchived)&&!this.supportsArchivedArrivals)throw new Error('請先更新 Google 部署，才能重新入庫歷史品項。');
    if(!this.supportsBatchArrival)throw new Error('請先更新原 Apps Script 部署，啟用批次入庫。');
    return this.sendWebsiteCommand('batch-arrival',data);
  }

  async updateSupplyDetails(data) {
    if(!this.supportsSnackFlavors)throw new Error('請先更新原 Apps Script 部署，啟用零食品名與口味欄位。');
    return this.sendWebsiteCommand('supply-details',data);
  }

  async submitSupplyArrival(data) {
    if(data.restoreArchived&&!this.supportsArchivedArrivals)throw new Error('請先更新 Google 部署，才能重新入庫歷史品項。');
    if (!this.supportsSupplies) throw new Error('請先更新 Apps Script 部署，才能儲存零食、泡麵與碳粉庫存。');
    if(this.isSnackSupply(data.supplyId)&&!this.supportsSnackNoExpiry)throw new Error('請先更新 Apps Script 部署，啟用零食免填效期登記。');
    if(this.isSnackSupply(data.supplyId)&&data.expiresOn!=null&&data.expiresOn!==''&&!validSupplyExpiry(data.expiresOn))throw new Error('零食保存期限格式不正確。');
    if (supplyNeedsExpiry(this.supplies.find(item=>item.id===data.supplyId)?.kind)&&!this.supportsSupplyExpiry)throw new Error('請更新 Apps Script 部署，啟用食品保存期限登記。');
    return this.sendWebsiteCommand('supply-arrival', data);
  }

  isSnackSupply(id) { return this.supplies.some(item=>item.id===id&&item.kind==='snack') || (typeof id==='string'&&id.startsWith('supply-snack-')); }

  async submitSupplyStocktake(entries, recorder) {
    if(entries?.some(entry=>this.isSnackSupply(entry.supplyId))&&!this.supportsSnacks)throw new Error('請先更新 Apps Script 部署，才能登記零食庫存。');
    if (!this.supportsSupplies) throw new Error('請先更新 Apps Script 部署，才能儲存零食、泡麵與碳粉庫存。');
    return this.sendWebsiteCommand('supply-stocktake', {entries,recorder});
  }

  async closeSupplyBatch(data) {
    const batch=this.supplyEvents.find(event=>event.id===data.batchId);
    if(this.isSnackSupply(batch?.supplyId)&&!this.supportsSnacks)throw new Error('請先更新 Apps Script 部署，才能登記零食效期。');
    if(!this.supportsSupplyExpiry)throw new Error('請先更新 Apps Script 部署，才能標記效期批次。');
    return this.sendWebsiteCommand('supply-expiry-close',data);
  }

  async setSupplyExpiry(data) {
    if(this.isSnackSupply(data.supplyId)&&!this.supportsSnacks)throw new Error('請先更新 Apps Script 部署，才能登記零食效期。');
    if(!this.supportsSupplyExpirySet)throw new Error('請先更新 Apps Script 部署，才能補登既有庫存的保存期限。');
    return this.sendWebsiteCommand('supply-expiry-set',data);
  }

  async setRestockPreference(data) {
    if(data.kind==='snack'&&!['normal','consider'].includes(data.mode))throw new Error('零食請使用「可以考慮補貨」標示，其他品項保留原補貨設定。');
    if(data.kind==='snack'&&!this.supportsSnackRestockFlags)throw new Error('請先更新 Google 部署，啟用零食手動補貨。');
    if(data.mode==='consider'&&data.kind!=='snack'&&!this.supportsManualRestock)throw new Error('請先更新 Apps Script 部署，啟用零食手動補貨標示。');
    if(!this.supportsRestockPreferences)throw new Error('請先更新 Apps Script 部署，才能儲存暫不補貨設定。');
    const result=await this.sendWebsiteCommand('restock-preference',data);
    if(this.lastWriteNeedsRefresh){
      const normalized=normalizeRestockPreferences({restockPreferenceEntry:{version:1},restockPreferences:[result]}).restockPreferences[0];
      this.restockPreferences=[...this.restockPreferences.filter(entry=>entry.kind!==normalized.kind||entry.itemId!==normalized.itemId),normalized];
    }
    return result;
  }

  async addDrink({ name, category, packaging, recorder }) {
    const storedCategory = category === '牛乳／植物奶' && this.drinkCategoryVersion !== 1 ? '牛奶／豆漿' : category;
    return this.sendWebsiteCommand('product', { name: name.trim(), category: storedCategory, packaging, recorder: recorder.trim() });
  }

  async readGachaOptions() {
    if(!this.supportsGacha)return {supported:false,eligibleIds:[]};
    if(this.gachaRequest)return this.gachaRequest;
    this.gachaRequest=(async()=>{
      const value=await this.readPublicData(validateGoogleScriptUrl(this.url),{action:'gacha'});
      if(value?.ok!==true||value.version!==1||!Array.isArray(value.eligibleIds)||value.eligibleIds.length>1000||value.eligibleIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(id))||new Set(value.eligibleIds).size!==value.eligibleIds.length)throw new Error('暫時無法讀取飲料推薦，請稍後再試。');
      return {supported:true,eligibleIds:[...value.eligibleIds]};
    })();
    try{return await this.gachaRequest;}finally{this.gachaRequest=null;}
  }

  async setZeroStockDecision(data) {
    if(!this.supportsZeroStockDecisions)throw new Error('請先更新原 Apps Script 部署，啟用無庫存處理功能。');
    if(!['drink','snack','noodle'].includes(data.kind)||!['pending','undecided','archive'].includes(data.decision))throw new Error('請選擇有效的處理方式。');
    return this.sendWebsiteCommand('zero-stock-decision',data);
  }

  applyZeroStockReceipt(data,result) {
    const mode=data.decision==='pending'?'consider':'normal';
    if(result?.operation!=='zero-stock-decision'||result.kind!==data.kind||result.itemId!==data.itemId||result.decision!==data.decision||result.mode!==mode||result.active!==(data.decision!=='archive')||result.stock!==0||!Number.isFinite(Date.parse(result.snapshotAt)))return false;
    const summary=this.adminSummary;
    if(!summary)return false;
    if(Date.parse(result.snapshotAt)<Math.max(Date.parse(summary.snapshotAt)||0,Date.parse(this.snapshotAt)||0))return true;
    const matches=entry=>(entry.kind||'drink')===data.kind&&(entry.id||entry.itemId)===data.itemId;
    const row=summary.outOfStockItems.find(matches);
    if(!row)return false;
    const updatedAt=result.snapshotAt,entry={kind:data.kind,itemId:data.itemId,mode,updatedAt,...(data.decision==='pending'?{zeroStockPending:true}:{})};
    this.restockPreferences=[...this.restockPreferences.filter(old=>old.kind!==data.kind||old.itemId!==data.itemId),entry];
    this.data.drinks=this.data.drinks.map(item=>data.kind==='drink'&&item.id===data.itemId?{...item,active:result.active}:item);
    this.supplies=this.supplies.map(item=>matches(item)?{...item,active:result.active}:item);
    this.adminSummary={...summary,snapshotAt:updatedAt,outOfStockItems:summary.outOfStockItems.flatMap(item=>matches(item)?(result.active?[{...item,mode,zeroStockPending:data.decision==='pending'}]:[]):[item]),restockItems:[...summary.restockItems.filter(item=>!matches(item)),...(mode==='consider'?[{...row,mode}]:[])],manualSnackItems:[...summary.manualSnackItems.filter(item=>!matches(item)),...(data.kind==='snack'&&mode==='consider'?[{...row,mode,markedAt:updatedAt}]:[])]};
    this.adminSummaryReadAt=this.now();this.revision=JSON.stringify({data:this.data,zeroStockReceipt:result});
    if(!result.active){this.popularityReadAt=-Infinity;try{(this.publicStorage||globalThis.localStorage)?.removeItem(`holdwin-public-cache-v1:${validateGoogleScriptUrl(this.url)}`);}catch{/* cache is optional */}}
    return true;
  }

  async login() { throw new Error('管理入口不用登入，請直接開啟倉庫或使用盤點、入庫表單。'); }
  async logout() { /* Google owns the account session; no credentials are stored here. */ }
  async save() { throw new Error('請使用盤點或到貨表單登記庫存，並填寫登記人。'); }
}
