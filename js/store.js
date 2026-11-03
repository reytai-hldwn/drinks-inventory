import { applyInitialStocktake, blankData, safeUrl, uid } from './domain.js';
import { CATEGORIES_ORDER, DEFAULT_CASE_SIZE, createCompanyData, prepareCompanyCatalog } from './catalog.js';
import { initialSupplies, prepareSupplyCatalog, SNACK_CATEGORIES, SNACK_UNITS, supplyBatches, supplyNeedsExpiry, supplySupportsExpiryHistory, supplyToday, validSupplyExpiry } from './supplies.js';
import { recordedBalances } from './inventory-activity.js';
import { supplyNameKey, supplyLabel } from './supplies.js';
import { RESTOCK_MODES, isLowStockItem, restockPreferenceMode } from './restock-preferences.js';

const DATA_KEY = 'office-pantry-demo-v1';
const SESSION_KEY = 'office-pantry-session-v1';
const INV_LOCAL_WISH_VOTER_KEY = 'holdwin-wish-voter-v1';
const QUICK_DRINK_PACKAGING = ['窄瓶鋁箔包', '鋁箔包', '鐵罐', '小型鐵罐', '長鐵罐', '寶特瓶', '大瓶裝', '其他'];

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
    this.initialStocktake = this.mode === 'demo' ? config.initialStocktake : null;
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
  get supportsArchiveWishes() { return this.mode === 'demo'; }
  get supportsSnacks() { return this.mode === 'demo'; }
  get supportsSnackNoExpiry() { return this.supportsSnacks; }
  get supportsSnackRestockFlags() { return this.supportsSnacks && this.supportsRestockPreferences; }
  get supportsSupplies() { return this.mode === 'demo'; }
  get supportsSupplyExpiry() { return this.supportsSupplies; }
  get supportsSupplyExpirySet() { return this.supportsSupplyExpiry; }
  get supportsDrinkArrivalCategories() { return this.supportsNewArrivals; }
  get supportsNewArrivals() { return this.mode === 'demo'; }
  get supportsArchivedArrivals() { return this.mode==='demo'; }
  get supportsBatchArrival() { return this.mode==='demo'; }
  get supportsSnackFlavors() { return this.mode==='demo'; }
  get supportsManualRestock() { return this.mode==='demo'; }
  get supportsRestockPreferences() { return this.mode === 'demo'; }
  get restockPreferences() { return this.data.restockPreferences || []; }
  get supplies() { return this.data.supplies || initialSupplies(); }
  get supplyEvents() { return this.data.supplyEvents || []; }

  async init() {
    if (this.mode === 'demo') {
      if (!localStorage.getItem(DATA_KEY)) {
        localStorage.setItem(DATA_KEY, JSON.stringify({ data: prepareSupplyCatalog(createCompanyData()), revision: 0, updatedAt: new Date().toISOString() }));
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
        const prepared = prepareSupplyCatalog(applyInitialStocktake(prepareCompanyCatalog(local?.data), this.initialStocktake));
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
    if(this.mode==='demo'){this.data={...this.data,drinks:recordedBalances(this.data.drinks,this.data.events,'drinkId'),supplies:recordedBalances(this.data.supplies||[],this.data.supplyEvents||[],'supplyId')};}
    this.revision = result.revision;
    this.updatedAt = result.updated_at || result.updatedAt;
    return this.data;
  }

  async save(data) {
    if (!this.canEdit) throw new Error('請先以獲授權的編輯者帳號登入。');
    if (!validData(data)) throw new Error('庫存資料格式不正確。');
    if(this.mode==='demo')data={...data,drinks:recordedBalances(data.drinks,data.events,'drinkId'),supplies:recordedBalances(data.supplies||[],data.supplyEvents||[],'supplyId')};
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

  async addDrink({ name, category, packaging, recorder } = {}) {
    if (!this.canEdit) throw new Error('請從管理入口新增飲料。');
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('請填寫飲料名稱，最多 80 字。');
    if (typeof recorder !== 'string' || !recorder.trim() || recorder.trim().length > 80) throw new Error('請填寫登記人，最多 80 字。');
    if (!CATEGORIES_ORDER.includes(category) || !QUICK_DRINK_PACKAGING.includes(packaging)) throw new Error('請選擇有效的飲料分類與包裝。');
    const normalizedName = name.trim().normalize('NFKC').toLowerCase();
    if (this.data.drinks.some((drink) => drink.name.trim().normalize('NFKC').toLowerCase() === normalizedName)) throw new Error('已經有同名的飲料品項了，請先查看倉庫或歷史品項。');
    const drink = {
      id: `custom-drink-${uid()}`, name: name.trim(), category, packaging,
      unit: ['寶特瓶', '大瓶裝'].includes(packaging) ? '瓶' : packaging.includes('鐵罐') ? '罐' : '包',
      active: true, perCase: DEFAULT_CASE_SIZE, threshold: 10, target: null, stock: 0, lastCountAt: null,
      createdAt: new Date().toISOString(), createdBy: recorder.trim(),
    };
    const next = structuredClone(this.data);
    next.drinks.push(drink);
    await this.save(next);
    return drink;
  }

  async saveSupplyEvents(entries, recorder) {
    if (!this.supportsSupplies || !this.canEdit) throw new Error('請從支援此功能的管理入口登記庫存。');
    if (typeof recorder !== 'string' || !recorder.trim() || recorder.trim().length>80) throw new Error('請填寫登記人，最多 80 字。');
    if (!Array.isArray(entries) || !entries.length) throw new Error('請至少填寫一個品項。');
    const next=structuredClone(this.data),seen=new Set(),stamp=new Date().toISOString();
    next.supplies ||= initialSupplies(); next.supplyEvents ||= [];
    for(const entry of entries){
      const item=next.supplies.find(item=>item.id===entry.supplyId&&(item.active!==false||(entry.type==='restock'&&entry.restoreArchived===true)));
      if(!item||seen.has(entry.supplyId)||!['count','restock','expiry-close'].includes(entry.type)||!Number.isSafeInteger(entry.quantity)||entry.quantity<0||entry.quantity>999999||(entry.type==='restock'&&entry.quantity===0)||(entry.type==='expiry-close'&&entry.quantity!==0))throw new Error('請填寫有效且不重複的品項與整數數量。');
      seen.add(item.id);
      if(entry.type==='restock'&&entry.restoreArchived===true)item.active=true;
      if(entry.type==='restock'&&item.stock!==null&&item.stock+entry.quantity>999999)throw new Error('累計庫存不可超過 999999。');
      if(typeof entry.note!=='string'||entry.note.length>500)throw new Error('入庫備註最多 500 字。');
      if(entry.type==='restock'&&item.kind==='snack'&&entry.expiresOn!=null&&entry.expiresOn!==''&&!validSupplyExpiry(entry.expiresOn))throw new Error('零食保存期限格式不正確。');
      if(entry.type==='restock'&&supplyNeedsExpiry(item.kind)&&(!validSupplyExpiry(entry.expiresOn)||entry.expiresOn<supplyToday()))throw new Error('食品入庫請填寫有效的保存期限，不能早於今天。');
      next.supplyEvents.push({id:uid(),supplyId:item.id,type:entry.type,quantity:entry.quantity,createdAt:stamp,recorder:recorder.trim(),note:entry.note,expiresOn:entry.type==='restock'&&supplySupportsExpiryHistory(item.kind)?entry.expiresOn||null:null,batchId:entry.batchId||null});
      if(entry.type==='count'){item.stock=entry.quantity;item.lastCountAt=stamp;}
      else if(entry.type==='restock'){item.stock=(item.stock??0)+entry.quantity;item.lastArrivalAt=stamp;}
    }
    await this.save(next);
  }

  async submitSupplyStocktake(entries, recorder) {
    return this.saveSupplyEvents(entries.map(entry=>({...entry,type:'count',note:'網站實際盤點'})),recorder);
  }

  async submitSupplyArrival({supplyId,quantity,recorder,note='',expiresOn=null,restoreArchived=false}) {
    await this.saveSupplyEvents([{supplyId,quantity,type:'restock',note,expiresOn,restoreArchived}],recorder);
    return {quantity};
  }

  async submitNewArrival({kind,name,unit,quantity,recorder,note='',expiresOn=null,category,flavor=''}) {
    if (!this.supportsNewArrivals || !this.canEdit) throw new Error('請從支援新品入庫的管理入口登記。');
    if (!['drink','snack','noodle'].includes(kind)) throw new Error('新品到貨僅支援飲料、零食與泡麵。');
    if (typeof name!=='string'||!name.trim()||name.trim().length>80) throw new Error('請填寫新品名稱，最多 80 字。');
    if (typeof recorder!=='string'||!recorder.trim()||recorder.trim().length>80) throw new Error('請填寫登記人，最多 80 字。');
    if (!(kind==='drink'?['包','瓶','罐']:kind==='snack'?SNACK_UNITS:['杯','碗']).includes(unit)||!Number.isSafeInteger(quantity)||quantity<1||quantity>999999) throw new Error('請確認新品單位與整數到貨數量。');
    if (typeof note!=='string'||note.length>500) throw new Error('入庫備註最多 500 字。');
    if(typeof flavor!=='string'||flavor.trim().length>80)throw new Error('口味最多 80 字。');
    if (kind==='drink'&&category!==undefined&&!CATEGORIES_ORDER.includes(category))throw new Error('請選擇有效的飲料分類。');
    if (kind==='snack'&&!SNACK_CATEGORIES.includes(category))throw new Error('請選擇有效的零食分類。');
    if (kind==='snack'&&expiresOn!=null&&expiresOn!==''&&!validSupplyExpiry(expiresOn))throw new Error('零食保存期限格式不正確。');
    if (supplyNeedsExpiry(kind)&&(!validSupplyExpiry(expiresOn)||expiresOn<supplyToday())) throw new Error('食品入庫請填寫有效的保存期限，不能早於今天。');
    const items=kind==='drink'?this.data.drinks:this.supplies.filter(item=>item.kind===kind);
    const key=value=>value.trim().normalize('NFKC').toLowerCase();
    if (items.some(item=>kind==='snack'?supplyNameKey(item)===supplyNameKey({name,flavor}):key(item.name)===key(name))) throw new Error('已經有同名品項，請沿用原品項或查看歷史清單。');
    if ((kind==='drink'?this.data.drinks:this.supplies).length>=1000) throw new Error('品項數量已達上限。');
    const next=structuredClone(this.data),stamp=new Date().toISOString(),id=`${kind==='drink'?'custom-drink':`supply-${kind}`}-${uid()}`;
    if (kind==='drink') {
      next.drinks.push({id,name:name.trim(),category:category || '其他',packaging:'其他',unit,active:true,perCase:null,threshold:10,target:null,stock:null,lastCountAt:null,createdAt:stamp,createdBy:recorder.trim()});
      next.events.push({id:uid(),drinkId:id,type:'restock',quantity,createdAt:stamp,recorder:recorder.trim(),note:note||'新品到貨入庫'});
    } else {
      next.supplies ||= initialSupplies();next.supplyEvents ||= [];
      next.supplies.push({id,name:name.trim(),kind,unit,active:true,stock:null,lastCountAt:null,...(kind==='snack'?{category,flavor:flavor.trim()}: {})});
      next.supplyEvents.push({id:uid(),supplyId:id,type:'restock',quantity,createdAt:stamp,recorder:recorder.trim(),note:note||'新品到貨入庫',expiresOn:expiresOn||null,batchId:null});
    }
    await this.save(next);
    return {id,quantity};
  }

  async submitBatchArrival({entries,recorder}) {
    if(!this.supportsBatchArrival||!this.canEdit)throw new Error('請先啟用批次入庫。');
    if(!Array.isArray(entries)||!entries.length||entries.length>30)throw new Error('請填寫 1 到 30 列入庫品項。');
    // Stage every row in memory; the real local revision is saved exactly once.
    const staged=new InventoryStore();staged.data=structuredClone(this.data);staged.save=async data=>{staged.data={...data,drinks:recordedBalances(data.drinks,data.events,'drinkId'),supplies:recordedBalances(data.supplies||[],data.supplyEvents||[],'supplyId')};};
    const items=[];
    for(const entry of entries){
      if(!['drink','snack','noodle','toner'].includes(entry.kind))throw new Error('請選擇有效的分類。');
      if(entry.isNew){items.push(await staged.submitNewArrival({...entry,recorder}));continue;}
      if(entry.kind==='drink'){
        const item=staged.data.drinks.find(item=>item.id===entry.drinkId&&(item.active!==false||entry.restoreArchived===true));
        if(!item||!Number.isSafeInteger(entry.quantity)||entry.quantity<1||entry.quantity>999999||(item.stock??0)+entry.quantity>999999)throw new Error('請確認飲料與入庫數量。');
        if(typeof recorder!=='string'||!recorder.trim()||recorder.trim().length>80)throw new Error('請填寫登記人，最多 80 字。');
        if(typeof (entry.note||'')!=='string'||(entry.note||'').length>500)throw new Error('備註最多 500 字。');
        const next=structuredClone(staged.data);if(entry.restoreArchived===true)next.drinks.find(drink=>drink.id===item.id).active=true;next.events.push({id:uid(),drinkId:item.id,type:'restock',quantity:entry.quantity,createdAt:new Date().toISOString(),recorder:recorder.trim(),note:entry.note||''});await staged.save(next);items.push({id:item.id,quantity:entry.quantity});
      }else{
        if(!staged.supplies.some(item=>item.id===entry.supplyId&&item.kind===entry.kind))throw new Error('品項與分類不符。');
        items.push(await staged.submitSupplyArrival({...entry,recorder}));
      }
    }
    await this.save(staged.data);return {count:items.length,items};
  }

  async updateSupplyDetails({supplyId,name,flavor='',expectedName,expectedFlavor=''}) {
    const item=this.supplies.find(item=>item.id===supplyId&&item.kind==='snack'&&item.active!==false);
    if(!item||!name?.trim()||name.trim().length>80||typeof flavor!=='string'||flavor.trim().length>80)throw new Error('請確認品名與選填口味。');
    if(item.name!==expectedName||(item.flavor||'')!==expectedFlavor)throw new Error('品名或口味已更新，請重新整理。');
    if(this.supplies.some(other=>other.id!==item.id&&other.kind==='snack'&&supplyNameKey(other)===supplyNameKey({name,flavor})))throw new Error('已有相同品名與口味。');
    const next=structuredClone(this.data),target=next.supplies.find(entry=>entry.id===item.id);target.name=name.trim();target.flavor=flavor.trim();await this.save(next);return {id:item.id};
  }

  async closeSupplyBatch({batchId,recorder,note=''}) {
    const batch=this.supplyEvents.find(event=>event.id===batchId&&['restock','expiry-set'].includes(event.type));
    if(!batch||!this.supplies.some(item=>item.id===batch.supplyId&&supplySupportsExpiryHistory(item.kind)))throw new Error('找不到可標記的食品入庫批次。');
    if(!supplyBatches(batch.supplyId,this.supplyEvents).some(event=>event.id===batchId))return {alreadyClosed:true};
    await this.saveSupplyEvents([{supplyId:batch.supplyId,type:'expiry-close',quantity:0,batchId,note:note||'此批已用完或移除；總庫存請另行盤點'}],recorder);
    return {alreadyClosed:false};
  }

  async setSupplyExpiry({supplyId,batches,expectedStock,expectedEventId,recorder,note=''}) {
    if(!this.supportsSupplyExpirySet||!this.canEdit)throw new Error('請從支援效期補登的管理入口登記。');
    const item=this.supplies.find(item=>item.id===supplyId&&supplySupportsExpiryHistory(item.kind)&&item.active!==false);
    if(!item||!item.lastCountAt||!(item.stock>0))throw new Error('請先完成實際盤點，再補登現有食品的保存期限。');
    const last=this.supplyEvents.filter(event=>event.supplyId===supplyId).at(-1);
    if(expectedStock!==item.stock||expectedEventId!==last?.id)throw new Error('這個品項已有新紀錄，請重新整理後核對數量與效期。');
    if(typeof recorder!=='string'||!recorder.trim()||recorder.trim().length>80)throw new Error('請填寫登記人，最多 80 字。');
    if(typeof note!=='string'||note.length>500)throw new Error('備註最多 500 字。');
    if(!Array.isArray(batches)||!batches.length||batches.length>20||batches.some(batch=>!batch||!Number.isSafeInteger(batch.quantity)||batch.quantity<1||batch.quantity>999999||!validSupplyExpiry(batch.expiresOn))||batches.reduce((sum,batch)=>sum+batch.quantity,0)!==item.stock)throw new Error('請填寫有效日期與正整數數量；各批合計須等於目前庫存。');
    const next=structuredClone(this.data),stamp=new Date().toISOString(),group=uid();
    next.supplyEvents ||= [];
    for(const batch of batches)next.supplyEvents.push({id:uid(),supplyId,type:'expiry-set',quantity:batch.quantity,createdAt:stamp,recorder:recorder.trim(),note:note||'既有庫存效期補登，不異動數量',expiresOn:batch.expiresOn,batchId:group});
    await this.save(next);return{quantity:item.stock,batchCount:batches.length};
  }

  async setRestockPreference({kind,itemId,mode,expectedMode}) {
    if(!this.supportsRestockPreferences||!this.canEdit)throw new Error('請從管理入口設定補貨提醒。');
    if(!['drink','snack','noodle','toner'].includes(kind)||!Object.hasOwn(RESTOCK_MODES,mode))throw new Error('補貨提醒設定不正確。');
    if(kind==='snack'&&!['normal','consider'].includes(mode))throw new Error('零食請使用「可以考慮補貨」標示，其他品項保留原補貨設定。');
    const item=(kind==='drink'?this.data.drinks:this.supplies.filter(item=>item.kind===kind)).find(item=>item.id===itemId);
    if(!item||(item.active===false&&mode!=='normal'))throw new Error('找不到可設定的品項。');
    const current=restockPreferenceMode(this.restockPreferences,kind,itemId);
    if(expectedMode!==current)throw new Error('其他裝置已更新這個品項的補貨設定，請重新整理。');
    if(kind!=='snack'&&mode!=='normal'&&mode!=='consider'&&current==='normal'&&!isLowStockItem(item))throw new Error('目前庫存未達補貨提醒門檻，請重新整理後確認。');
    const entry={kind,itemId,mode,updatedAt:new Date().toISOString()},next=structuredClone(this.data);
    next.restockPreferences=[...this.restockPreferences.filter(entry=>entry.kind!==kind||entry.itemId!==itemId),entry];
    await this.save(next);return entry;
  }

  async submitWish({ name, url = '', note = '', kind = 'drink' } = {}) {
    if (!['drink', 'snack'].includes(kind)) throw new Error('請選擇飲料許願或零食許願。');
    if (this.mode !== 'demo' && kind !== 'drink') throw new Error('此舊版共用介接尚未支援零食許願，請改用 Google 共用模式。');
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

  async supportArchivedDrink(drinkId, voterName) {
    if (!this.supportsArchiveWishes) throw new Error('目前連線尚未啟用回購許願。');
    const drink=this.data.drinks.find(item=>item.id===drinkId&&item.active===false);
    if (!drink) throw new Error('找不到這個歷史品項。');
    if (typeof voterName !== 'string' || !voterName.trim() || voterName.trim().length>80) throw new Error('請填寫姓名，最多 80 字。');
    let wish=this.data.wishes.find(item=>item.sourceDrinkId===drinkId);
    if(!wish){
      const next=structuredClone(this.data);
      wish={id:`wish-return-${uid()}`,kind:'drink',sourceDrinkId:drinkId,name:drink.name,note:'我還想喝，希望有機會可以再買',url:'',status:'pending',createdAt:new Date().toISOString(),votes:0,voterIds:[]};
      next.wishes.push(wish);const saved=this.saveLocal(next);this.data=saved.payload;this.revision=saved.revision;this.updatedAt=saved.updated_at;
    }
    const alreadyVoted=this.hasVoted(wish.id);await this.voteWish(wish.id,voterName);return{id:wish.id,alreadyVoted};
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
