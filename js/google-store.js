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

/** Read the owner's public, catalog-only Apps Script endpoint without CORS. */
export function fetchGooglePublicData(endpoint, options = {}) {
  const url = new URL(validateGoogleScriptUrl(endpoint));
  const pageWindow = options.window || globalThis.window;
  const pageDocument = options.document || globalThis.document;
  const schedule = options.setTimeout || globalThis.setTimeout;
  const cancel = options.clearTimeout || globalThis.clearTimeout;
  const timeout = options.timeout ?? 15000;
  if (!pageWindow || !pageDocument?.createElement || !pageDocument.head?.appendChild) {
    return Promise.reject(new Error('目前的瀏覽器無法載入 Google 共用資料。'));
  }
  const callback = `__holdwin_${Date.now().toString(36)}_${(++googleCallbackSequence).toString(36)}_${Math.random().toString(36).slice(2)}`;
  url.searchParams.set('action', 'public');
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

/** Pick public display fields only. Stock and input access remain in Google. */
export function normalizeGooglePublicData(payload) {
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
      // These are not real counts. No stock observation is exposed publicly.
      stock: 0,
      target: null,
      lastCountAt: null,
    };
  });
  const wishes = payload.wishes.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('Google 許願清單格式不正確。');
    const url = row.url ? safeUrl(row.url) : '';
    if ((row.url && !url) || url.length > 2000) throw new Error('Google 許願連結格式不正確。');
    if (!['pending', 'purchased', 'declined'].includes(row.status)) throw new Error('Google 願望狀態格式不正確。');
    if (typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))) throw new Error('Google 願望日期格式不正確。');
    return {
      id: textField(row.id, '願望代號', 160),
      name: textField(row.name, '願望名稱', 80),
      url,
      note: row.note === undefined ? '' : textField(row.note, '願望備註', 500, false),
      status: row.status,
      createdAt: row.createdAt,
    };
  });
  const forms = payload.formUrls || payload.forms || {};
  const formUrls = {
    wish: googleLink(forms.wish, 'form'),
    stocktake: googleLink(forms.stocktake, 'form', false),
    arrival: googleLink(forms.arrival, 'form', false),
  };
  const adminUrl = googleLink(payload.adminUrl || payload.warehouseUrl, 'sheet');
  const updatedAt = typeof payload.updatedAt === 'string' && Number.isFinite(Date.parse(payload.updatedAt)) ? payload.updatedAt : null;
  return {
    data: { drinks, events: [], wishes, lastInventoryAt: null },
    formUrls,
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
    this.data = blankData();
    this.formUrls = { wish: '', stocktake: '', arrival: '' };
    this.forms = this.formUrls;
    this.adminUrl = '';
    this.warehouseUrl = '';
    this.updatedAt = null;
    this.revision = '';
    this.readPublicData = options.readPublicData || fetchGooglePublicData;
  }

  get canEdit() { return false; }

  async init() { await this.read(); }

  async read() {
    const endpoint = validateGoogleScriptUrl(this.url);
    const result = normalizeGooglePublicData(await this.readPublicData(endpoint));
    // Assign only after the full response validates; preserve the last valid
    // view on errors and never seed demo data or accept remote role flags.
    this.data = result.data;
    this.formUrls = result.formUrls;
    this.forms = this.formUrls;
    this.adminUrl = result.adminUrl;
    this.warehouseUrl = this.adminUrl;
    this.updatedAt = result.updatedAt;
    this.revision = JSON.stringify({ data: result.data, formUrls: result.formUrls, adminUrl: result.adminUrl });
    return this.data;
  }

  async login() { throw new Error('請使用 Google 帳號開啟私人倉庫試算表，網站不收取管理者密碼。'); }
  async logout() { /* Google owns the account session; no credentials are stored here. */ }
  async save() { throw new Error('庫存請由獲授權的管理者使用 Google 表單或私人倉庫試算表更新。'); }
  async submitWish() { throw new Error('請使用飲料許願 Google 表單送出願望。'); }
}
