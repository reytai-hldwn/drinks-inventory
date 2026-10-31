import { blankData, safeUrl, uid } from './domain.js';
import { createCompanyData, prepareCompanyCatalog } from './catalog.js';

const DATA_KEY = 'office-pantry-demo-v1';
const SESSION_KEY = 'office-pantry-session-v1';
const INV_LOCAL_WISH_VOTER_KEY = 'holdwin-wish-voter-v1';

function inventoryLocalWishVoterId(create = false) {
  try {
    let voterId = localStorage.getItem(INV_LOCAL_WISH_VOTER_KEY);
    if (voterId && /^[A-Za-z0-9_-]{10,160}$/.test(voterId)) return voterId;
    if (!create) return null;
    voterId = uid();
    localStorage.setItem(INV_LOCAL_WISH_VOTER_KEY, voterId);
    return voterId;
  } catch {
    throw new Error('無法儲存此瀏覽器的贊同紀錄。請允許網站儲存資料後再試。');
  }
}

function validData(data) {
  return data && Array.isArray(data.drinks) && Array.isArray(data.events) && Array.isArray(data.wishes);
}

export class InventoryStore {
  constructor(config = {}) {
    this.url = (config.supabaseUrl || '').trim().replace(/\/$/, '');
    this.key = (config.supabaseAnonKey || '').trim();
    this.mode = this.url || this.key ? 'shared' : 'demo';
    this.data = blankData();
    this.revision = 0;
    this.user = null;
    this.session = null;
    this.isEditor = this.mode === 'demo';
    this.preview = false;
    this.updatedAt = null;
  }

  get canEdit() { return this.isEditor && !this.preview; }
  get canManage() { return this.mode === 'demo' || this.canEdit; }

  async init() {
    if (this.mode === 'demo') {
      if (!localStorage.getItem(DATA_KEY)) {
        localStorage.setItem(DATA_KEY, JSON.stringify({ data: createCompanyData(), revision: 0, updatedAt: new Date().toISOString() }));
      }
    } else {
      if (!this.key || !this.url || !/^https:\/\/[^/]+$/.test(this.url)) {
        throw new Error('共用資料庫設定不完整：請檢查 config.js 的 HTTPS 專案網址與公開金鑰。');
      }
      try { this.session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { this.clearSession(); }
      if (this.session) {
        try {
          await this.ensureSession();
          this.user = await this.request('/auth/v1/user');
          await this.checkEditor();
        } catch { this.clearSession(); }
      }
    }
    await this.read();
  }

  async ensureSession() {
    if (!this.session || this.session.expires_at > Date.now() / 1000 + 60) return;
    try {
      const session = await this.request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: this.session.refresh_token }, anonymous: true,
      });
      this.keepSession(session);
    } catch {
      this.clearSession();
      throw new Error('登入已到期，請重新登入後再儲存。');
    }
  }

  keepSession(session) {
    this.session = { ...session, expires_at: session.expires_at || Date.now() / 1000 + session.expires_in };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
    this.user = session.user;
  }

  clearSession() {
    this.session = null;
    this.user = null;
    this.isEditor = this.mode === 'demo';
    sessionStorage.removeItem(SESSION_KEY);
  }

  async request(path, { method = 'GET', body, anonymous = false } = {}) {
    const headers = { apikey: this.key, 'Content-Type': 'application/json' };
    if (this.session?.access_token && !anonymous) headers.Authorization = `Bearer ${this.session.access_token}`;
    let response;
    try {
      response = await fetch(this.url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    } catch {
      throw new Error('無法連接共用資料庫。請確認網路或 Supabase 設定；目前輸入尚未儲存。');
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (result?.code === '40001') {
        const conflict = new Error('資料已被其他人更新。請先記下本次輸入，再按「重新整理」載入最新版本；本次修改尚未儲存。');
        conflict.code = 'CONFLICT';
        throw conflict;
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('登入或資料權限驗證失敗，請檢查帳號、編輯資格與公開金鑰。');
      }
      if (result?.error_code === 'invalid_credentials' || result?.error === 'invalid_grant') throw new Error('電子郵件或密碼不正確。');
      throw new Error('共用資料讀寫失敗。請確認已執行資料庫設定 SQL，稍後再試。');
    }
    return result;
  }

  async checkEditor() {
    const rows = await this.request(`/rest/v1/editors?user_id=eq.${encodeURIComponent(this.user.id)}&select=user_id`);
    this.isEditor = Array.isArray(rows) && rows.length === 1;
  }

  async login(email, password) {
    const session = await this.request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, anonymous: true });
    this.keepSession(session);
    try {
      await this.checkEditor();
      if (!this.isEditor) throw new Error('此帳號尚未被授權編輯。請依設定文件加入 editors 名單。');
      await this.read();
    } catch (error) { this.clearSession(); throw error; }
  }

  async logout() {
    try { if (this.session) await this.request('/auth/v1/logout', { method: 'POST' }); }
    finally { this.clearSession(); }
  }

  async read() {
    let result;
    if (this.mode === 'demo') {
      try {
        const local = JSON.parse(localStorage.getItem(DATA_KEY));
        const prepared = prepareCompanyCatalog(local?.data);
        if (prepared !== local?.data) {
          local.data = prepared;
          local.revision += 1;
          local.updatedAt = new Date().toISOString();
          localStorage.setItem(DATA_KEY, JSON.stringify(local));
        }
        result = { ...local, payload: local?.data };
      } catch { throw new Error('此裝置的示範資料無法讀取。請先保留瀏覽器資料，再檢查儲存空間。'); }
    } else {
      // Public reads remain available when an editor's session expires.
      try { await this.ensureSession(); } catch { /* read with the public key */ }
      const rows = await this.request('/rest/v1/inventory_state?singleton=eq.true&select=revision,payload,updated_at');
      result = rows?.[0];
    }
    if (!result || !validData(result.payload)) throw new Error('找不到有效的庫存資料。請確認資料庫 SQL 已完成設定。');
    this.data = result.payload;
    this.revision = result.revision;
    this.updatedAt = result.updated_at || result.updatedAt;
    return this.data;
  }

  async save(data) {
    if (!this.canEdit) throw new Error('請先以獲授權的編輯者帳號登入。');
    if (!validData(data)) throw new Error('庫存資料格式不正確。');
    const existingEventIds = new Set(this.data.events.map((event) => event.id));
    for (const event of data.events) {
      if (!existingEventIds.has(event.id) && ['count', 'restock'].includes(event.type) &&
          (typeof event.recorder !== 'string' || !event.recorder.trim() || event.recorder.trim().length > 80)) {
        throw new Error('盤點與到貨入庫請填寫登記人，最多 80 字。');
      }
    }
    let saved;
    if (this.mode === 'demo') {
      saved = this.saveLocal(data);
    } else {
      await this.ensureSession();
      if (!this.canEdit) throw new Error('登入已到期，請重新登入。');
      const result = await this.request('/rest/v1/rpc/save_inventory', { method: 'POST', body: { expected_revision: this.revision, payload: data } });
      saved = result?.[0];
      if (!saved || !validData(saved.payload)) throw new Error('未收到有效的儲存結果。請重新讀取資料確認。');
    }
    this.data = saved.payload;
    this.revision = saved.revision;
    this.updatedAt = saved.updated_at;
  }

  saveLocal(data) {
    const previous = JSON.parse(localStorage.getItem(DATA_KEY));
    if (previous?.revision !== this.revision) {
      throw new Error('另一個分頁已更新示範資料。請先記下輸入，再重新整理。');
    }
    const saved = { payload: data, revision: this.revision + 1, updated_at: new Date().toISOString() };
    localStorage.setItem(DATA_KEY, JSON.stringify({ data, revision: saved.revision, updatedAt: saved.updated_at }));
    return saved;
  }

  async submitWish({ name, url = '', note = '', kind = 'drink' } = {}) {
    if (!['drink', 'snack'].includes(kind)) throw new Error('請選擇飲料或點心許願池。');
    if (this.mode !== 'demo' && kind !== 'drink') throw new Error('此舊版共用介接尚未支援點心許願池，請改用 Google 共用模式。');
    if (typeof name !== 'string' || !name.trim()) throw new Error('請填寫品項名稱。');
    if (typeof url !== 'string' || typeof note !== 'string') throw new Error('請填寫有效的連結與備註。');
    const wishName = name.trim();
    const wishNote = note.trim();
    const urlInput = url.trim();
    const wishUrl = safeUrl(urlInput);
    if (wishName.length > 80 || wishNote.length > 500 || urlInput.length > 2000 || wishUrl.length > 2000) {
      throw new Error('名稱最多 80 字、備註最多 500 字、連結最多 2,000 字。');
    }
    if (urlInput && !wishUrl) throw new Error('請填入有效的 http 或 https 連結，且不要包含帳號密碼。');

    let saved;
    if (this.mode === 'demo') {
      const next = structuredClone(this.data);
      // Only these fields are accepted. Public callers cannot choose an ID,
      // approval status, timestamp, or replace stock through wish submission.
      next.wishes.push({ id: uid(), kind, name: wishName, url: wishUrl, note: wishNote, status: 'pending', createdAt: new Date().toISOString(), votes: 0, voterIds: [] });
      saved = this.saveLocal(next);
    } else {
      const result = await this.request('/rest/v1/rpc/submit_wish', {
        method: 'POST', anonymous: true,
        body: { wish_name: wishName, wish_url: wishUrl, wish_note: wishNote },
      });
      saved = result?.[0];
      if (!saved || !validData(saved.payload)) throw new Error('未收到有效的許願結果。請重新讀取資料確認。');
    }
    this.data = saved.payload;
    this.revision = saved.revision;
    this.updatedAt = saved.updated_at;
    return this.data;
  }

  hasVoted(wishId) {
    if (this.mode !== 'demo') return false;
    let voterId;
    try { voterId = inventoryLocalWishVoterId(); } catch { return false; }
    if (!voterId) return false;
    const wish = this.data.wishes.find((item) => item.id === wishId);
    return Array.isArray(wish?.voterIds) && wish.voterIds.includes(voterId);
  }

  async voteWish(wishId, voterName) {
    if (this.mode !== 'demo') throw new Error('目前連線尚未啟用贊同功能。');
    const wish = this.data.wishes.find((item) => item.id === wishId);
    if (!wish) throw new Error('找不到這個願望，請重新整理後再試。');
    if (typeof voterName !== 'string' || !voterName.trim() || voterName.trim().length > 80) throw new Error('請填寫姓名，最多 80 字。');
    const name = voterName.trim();
    const voterId = inventoryLocalWishVoterId(true);
    if (Array.isArray(wish.voterIds) && wish.voterIds.includes(voterId)) return this.data;
    const next = structuredClone(this.data);
    const updatedWish = next.wishes.find((item) => item.id === wishId);
    const voters = new Set(Array.isArray(updatedWish.voterIds) ? updatedWish.voterIds.filter((value) => typeof value === 'string') : []);
    const votes = Number.isSafeInteger(updatedWish.votes) && updatedWish.votes >= 0 ? updatedWish.votes : voters.size;
    const previousVotes = Math.max(votes, voters.size);
    if (!Number.isSafeInteger(previousVotes + 1)) throw new Error('這個願望的贊同人數格式不正確。');
    voters.add(voterId);
    updatedWish.voterIds = [...voters];
    updatedWish.voterNames = { ...(updatedWish.voterNames || {}), [voterId]: name };
    updatedWish.votes = previousVotes + 1;
    const saved = this.saveLocal(next);
    this.data = saved.payload;
    this.revision = saved.revision;
    this.updatedAt = saved.updated_at;
    return this.data;
  }
}
