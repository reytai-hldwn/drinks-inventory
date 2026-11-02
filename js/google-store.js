import { blankData, getWeeklyPopularity, safeUrl } from './domain.js';
import { submitGoogleWebsiteCommand } from './google-write.js';
import { normalizeSupplyWarehouse } from './supplies.js';

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
  if (!['public', 'warehouse', 'receipt'].includes(action)) throw new Error('不支援的 Google 資料讀取方式。');
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
      category: textField(row.category, '飲料分類', 80),
      packaging: textField(row.packaging, '包裝形式', 80),
      unit: row.unit,
      perCase,
      threshold,
      active: row.active !== false,
      // The fridge ignores even accidentally supplied stock observations.
      stock: warehouse ? (row.stock === null ? null : googleQuantityField(row.stock, '庫存數量')) : 0,
      target: null,
      lastCountAt: warehouse ? googleDateField(row.lastCountAt, '盤點時間', true) : null,
    };
  });
  const wishIds = new Set();
  const wishes = payload.wishes.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('Google 許願清單格式不正確。');
    const url = row.url ? safeUrl(row.url) : '';
    if ((row.url && !url) || url.length > 2000) throw new Error('Google 許願連結格式不正確。');
    if (!['pending', 'purchased', 'declined'].includes(row.status)) throw new Error('Google 願望狀態格式不正確。');
    if (typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))) throw new Error('Google 願望日期格式不正確。');
    const id = textField(row.id, '願望代號', 160);
    if (wishIds.has(id)) throw new Error('Google 許願清單出現重複願望代號。');
    wishIds.add(id);
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
    };
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
    websiteEntryVersion: payload.websiteEntry?.version === 1 ? 1 : 0,
    newArrivalVersion: warehouse && payload.websiteEntry?.newArrivalVersion === 1 ? 1 : 0,
    ...(warehouse ? normalizeSupplyWarehouse(payload) : {supplies:[],supplyEvents:[],supplyEntryVersion:0,supplyExpiryVersion:0,supplyExpirySetVersion:0}),
  };
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
    this.websiteEntryVersion = 0;
    this.newArrivalVersion = 0;
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
    this.supplyExpiryVersion = 0;
    this.supplyExpirySetVersion = 0;
  }

  get canEdit() { return false; }
  get canManage() { return true; }
  get supportsWebsiteEntry() { return this.websiteEntryVersion === 1; }
  get supportsNewArrivals() { return this.supportsWebsiteEntry && this.newArrivalVersion === 1; }
  get supportsSupplies() { return this.supportsWebsiteEntry && this.supplyEntryVersion === 1; }
  get supportsSupplyExpiry() { return this.supportsSupplies && this.supplyExpiryVersion===1; }
  get supportsSupplyExpirySet() { return this.supportsSupplyExpiry && this.supplyExpirySetVersion===1; }

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

  async readPublic() { return this.readGoogleView(false); }

  async readGoogleView(warehouse) {
    const sequence = ++this.googleReadSequence;
    const endpoint = validateGoogleScriptUrl(this.url);
    let payload;
    try {
      payload = await this.readPublicData(endpoint, { action: warehouse ? 'warehouse' : 'public' });
    } catch (error) {
      if (sequence !== this.googleReadSequence) return this.data;
      throw error;
    }
    if (sequence !== this.googleReadSequence) return this.data;
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
          adminUrl: result.adminUrl, updatedAt: result.updatedAt, websiteEntry: { version: result.websiteEntryVersion } };
        const saved = JSON.stringify({ version: 1, savedAt: this.now(), payload });
        if (saved.length < 750000) (this.publicStorage || globalThis.localStorage)?.setItem(`holdwin-public-cache-v1:${endpoint}`, saved);
      } catch { /* Storage is optional; fresh Google data still works. */ }
    }
    return this.data;
  }

  applyGoogleView(result, warehouse) {
    this.data = result.data;
    this.formUrls = result.formUrls;
    this.forms = this.formUrls;
    this.voteForm = result.voteForm;
    this.wishForm = result.wishForm;
    this.inWarehouse = warehouse;
    this.adminUrl = result.adminUrl;
    this.warehouseUrl = this.adminUrl;
    this.updatedAt = result.updatedAt;
    this.websiteEntryVersion = result.websiteEntryVersion;
    this.newArrivalVersion = result.newArrivalVersion || 0;
    this.supplies = result.supplies || [];
    this.supplyEvents = result.supplyEvents || [];
    this.supplyEntryVersion = result.supplyEntryVersion || 0;
    this.supplyExpiryVersion = result.supplyExpiryVersion || 0;
    this.supplyExpirySetVersion = result.supplyExpirySetVersion || 0;
    this.revision = JSON.stringify({ data: result.data, formUrls: result.formUrls, voteForm: result.voteForm, wishForm: result.wishForm, adminUrl: result.adminUrl, websiteEntryVersion: result.websiteEntryVersion, newArrivalVersion:this.newArrivalVersion, supplies:this.supplies,supplyEvents:this.supplyEvents,supplyEntryVersion:this.supplyEntryVersion,supplyExpiryVersion:this.supplyExpiryVersion,supplyExpirySetVersion:this.supplyExpirySetVersion });
  }

  async readPopularity() {
    if (this.popularity && this.now() - this.popularityReadAt < 300000) return this.popularity;
    if (this.popularityRequest) return this.popularityRequest;
    this.popularityRequest = (async () => {
      // This separate read never changes the current route or public catalog.
      // It uses the existing deployment and retains only aggregate rates.
      const payload = await this.readPublicData(validateGoogleScriptUrl(this.url), { action: 'warehouse' });
      const result = normalizeGooglePublicData(payload, { warehouse: true });
      this.popularity = getWeeklyPopularity(result.data.drinks, result.data.events, new Date(this.now()));
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
    const signature = JSON.stringify(data);
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
    if (['stocktake', 'arrival', 'product', 'new-arrival'].includes(operation)) this.popularityReadAt = -Infinity;
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

  async submitArrival({ drinkId, cases, loose, recorder, note = '' }) {
    return this.sendWebsiteCommand('arrival', { drinkId, cases, loose, recorder, note });
  }

  async submitNewArrival(data) {
    if (!this.supportsNewArrivals) throw new Error('請先更新 Apps Script 部署，才能在入庫時登記新品。');
    if (data.kind === 'noodle' && !this.supportsSupplyExpiry) throw new Error('請更新 Apps Script 部署，啟用泡麵保存期限。');
    return this.sendWebsiteCommand('new-arrival', data);
  }

  async submitSupplyArrival(data) {
    if (!this.supportsSupplies) throw new Error('請先更新 Apps Script 部署，才能儲存泡麵與碳粉庫存。');
    if (this.supplies.find(item=>item.id===data.supplyId)?.kind==='noodle'&&!this.supportsSupplyExpiry)throw new Error('請更新 Apps Script 部署，啟用泡麵保存期限登記。');
    return this.sendWebsiteCommand('supply-arrival', data);
  }

  async submitSupplyStocktake(entries, recorder) {
    if (!this.supportsSupplies) throw new Error('請先更新 Apps Script 部署，才能儲存泡麵與碳粉庫存。');
    return this.sendWebsiteCommand('supply-stocktake', {entries,recorder});
  }

  async closeSupplyBatch(data) {
    if(!this.supportsSupplyExpiry)throw new Error('請先更新 Apps Script 部署，才能標記效期批次。');
    return this.sendWebsiteCommand('supply-expiry-close',data);
  }

  async setSupplyExpiry(data) {
    if(!this.supportsSupplyExpirySet)throw new Error('請先更新 Apps Script 部署，才能補登既有庫存的保存期限。');
    return this.sendWebsiteCommand('supply-expiry-set',data);
  }

  async addDrink({ name, category, packaging, recorder }) {
    return this.sendWebsiteCommand('product', { name: name.trim(), category, packaging, recorder: recorder.trim() });
  }

  async login() { throw new Error('管理入口不用登入，請直接開啟倉庫或使用盤點、入庫表單。'); }
  async logout() { /* Google owns the account session; no credentials are stored here. */ }
  async save() { throw new Error('請使用盤點或到貨表單登記庫存，並填寫登記人。'); }
}
