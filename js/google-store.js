import { blankData, safeUrl } from './domain.js';

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

/** Read a catalog or warehouse view without CORS. All writes stay in Forms. */
export function fetchGooglePublicData(endpoint, options = {}) {
  const url = new URL(validateGoogleScriptUrl(endpoint));
  const action = options.action ?? 'public';
  if (!['public', 'warehouse'].includes(action)) throw new Error('不支援的 Google 資料讀取方式。');
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
  return { url, wishEntryId: value.wishEntryId, voterEntryId: value.voterEntryId };
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
    return {
      id,
      name: textField(row.name, '願望名稱', 80),
      url,
      note: row.note === undefined ? '' : textField(row.note, '願望備註', 500, false),
      status: row.status,
      createdAt: row.createdAt,
      votes: row.votes === undefined ? 0 : googleQuantityField(row.votes, '贊同人數'),
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
  };
  const voteForm = googleVoteForm(payload.voteForm);
  const adminUrl = googleLink(payload.adminUrl || payload.warehouseUrl, 'sheet');
  const updatedAt = typeof payload.updatedAt === 'string' && Number.isFinite(Date.parse(payload.updatedAt)) ? payload.updatedAt : null;
  return {
    data: { drinks, events, wishes, lastInventoryAt: warehouse ? googleDateField(payload.lastInventoryAt, '最近完整盤點', true) : null },
    formUrls,
    voteForm,
    adminUrl,
    updatedAt,
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
    this.formUrls = { wish: '', stocktake: '', arrival: '', vote: '' };
    this.voteForm = null;
    this.forms = this.formUrls;
    this.adminUrl = '';
    this.warehouseUrl = '';
    this.updatedAt = null;
    this.revision = '';
    this.googleReadSequence = 0;
    this.readPublicData = options.readPublicData || fetchGooglePublicData;
    this.voteStorage = options.voteStorage;
    this.createVoterId = options.createVoterId || (() => globalThis.crypto.randomUUID());
  }

  get canEdit() { return false; }
  get canManage() { return true; }

  async init() { await this.read(); }

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
    this.data = result.data;
    this.formUrls = result.formUrls;
    this.forms = this.formUrls;
    this.voteForm = result.voteForm;
    this.inWarehouse = warehouse;
    this.adminUrl = result.adminUrl;
    this.warehouseUrl = this.adminUrl;
    this.updatedAt = result.updatedAt;
    this.revision = JSON.stringify({ data: result.data, formUrls: result.formUrls, voteForm: result.voteForm, adminUrl: result.adminUrl });
    return this.data;
  }

  getVoteUrl(wishId) {
    if (!this.data.wishes.some((wish) => wish.id === wishId)) throw new Error('找不到這個願望，請重新整理後再試。');
    if (!this.voteForm) throw new Error('贊同表單尚未啟用，請先更新 Google 設定。');
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
    const url = new URL(this.voteForm.url);
    url.searchParams.set('usp', 'pp_url');
    url.searchParams.set(`entry.${this.voteForm.wishEntryId}`, wishId);
    url.searchParams.set(`entry.${this.voteForm.voterEntryId}`, voterId);
    return url.href;
  }

  async login() { throw new Error('管理入口不用登入，請直接開啟倉庫或使用盤點、入庫 Google 表單。'); }
  async logout() { /* Google owns the account session; no credentials are stored here. */ }
  async save() { throw new Error('請使用 Google 表單登記庫存，並填寫登記人。'); }
  async submitWish() { throw new Error('請使用飲料許願 Google 表單送出願望。'); }
}
