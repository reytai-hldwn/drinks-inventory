import { escapeHtml as h, safeUrl, uid, number, restockQuantity, stocktakeQuantities, getConsumption, getWeeklyPopularity } from './domain.js';
import { InventoryStore } from './store.js';
import { CATEGORIES_ORDER, DEFAULT_CASE_SIZE } from './catalog.js';
import { drinkPack, renderFridge, renderFridgePopularity, syncFridgeDoor, syncFridgeScene } from './fridge.js';
import { GoogleInventoryStore } from './google-store.js';
import { wishSupportDetails, wishSupportPreview } from './wish-support.js';
import { renderDrinkInformation } from './drink-information.js';
import { findProductPhoto } from './product-photos.js';
import { initialSupplies, SUPPLY_KINDS, supplyBatches, supplyHasUntrackedExpiry, supplyExpiryStatus, supplyToday, validSupplyExpiry } from './supplies.js';
import { RESTOCK_MODES, isLowStockItem, sortInventoryItems, restockPreferenceMode } from './restock-preferences.js';

const store = window.DRINKS_CONFIG?.provider === 'google' ? new GoogleInventoryStore(window.DRINKS_CONFIG) : new InventoryStore(window.DRINKS_CONFIG);
const $ = (selector) => document.querySelector(selector);
const main = $('#main');
const modal = $('#modal');
const categories = CATEGORIES_ORDER;
const categoryNames = () => [...new Set([...categories, ...store.data.drinks.map((drink) => drink.category)])];
const activeDrinks = () => store.data.drinks.filter((drink) => drink.active !== false);
const packagingTypes = ['窄瓶鋁箔包', '鋁箔包', '鐵罐', '小型鐵罐', '長鐵罐', '寶特瓶', '大瓶裝', '其他'];
const restockViews = { restock: 'drink', 'restock-noodle': 'noodle', 'restock-toner': 'toner' };
const NEW_ARRIVAL_VALUE = '__new__';
const viewNames = { overview: '飲料冰箱', wishes: '採買許願池', archive: '歷史品項', admin: '管理後台', products: '倉庫庫存', count: '快速盤點', restock: '到貨入庫 · 飲料', 'restock-noodle': '到貨入庫 · 泡麵', 'restock-toner': '到貨入庫 · 碳粉', 'manage-wishes': '願望管理', history: '異動紀錄' };
const adminViews = new Set(['admin', 'products', 'count', ...Object.keys(restockViews), 'manage-wishes', 'history']);
let view = 'overview';
let wishFilter = 'all';
const wishKind = (wish) => wish?.kind === 'snack' ? 'snack' : 'drink';
const wishKindLabel = (kind) => kind === 'snack' ? '零食' : '飲料';
const wishKindOptions = (kind = '') => `<option value=""${kind ? '' : ' selected'} disabled>請選擇許願類型</option>${[['drink', '飲料許願'], ['snack', '零食許願']].map(([value, label]) => `<option value="${value}"${kind === value ? ' selected' : ''}>${label}</option>`).join('')}`;
let filter = 'low';
let query = '';
let category = '';
let display = 'fridge';
let fridgeOpen = false;
try { if (localStorage.getItem('holdwin-display') === 'list') display = 'list'; } catch { /* optional display preference */ }
let dirty = false;
let modalDirty = false;
let busy = false;
let refreshing = false;
let routeLoading = false;
let inputSequence = 0;
let ready = false;
let toastTimer;
let routeSequence = 0;
let warehouseKind = 'drink';
let supplyQuery = '';
let supplyFilter = 'low';
let popularityLoading = false;
let popularityError = false;

const formatDate = (value, time = false) => value ? new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', ...(time ? { year: 'numeric' } : {}), month: '2-digit', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
}).format(new Date(value)) : '尚未盤點';
const daysAgo = (date) => date ? Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 86400000)) : null;
const total = (items, field) => items.reduce((sum, item) => sum + item[field], 0);
const stockEvents = () => [...store.data.events,...(store.supplyEvents || [])].filter((event) => ['count', 'restock','expiry-close','expiry-set'].includes(event.type));
const supplyItems = () => store.supportsSupplies ? store.supplies : initialSupplies();
const supplyById = id => supplyItems().find(item=>item.id===id);
const preferenceMode = (kind,id) => restockPreferenceMode(store.restockPreferences||[],kind,id);
const restockPaused = (kind,id) => preferenceMode(kind,id)!=='normal';
const needsRestock = (item,kind='drink') => isLowStockItem(item)&&!restockPaused(kind,item.id);
const eventItem = event => event.supplyId ? supplyById(event.supplyId) : drinkById(event.drinkId);
const eventExpiry = event => event.expiresOn || (event.batchId ? (store.supplyEvents||[]).find(batch=>batch.id===event.batchId)?.expiresOn : null);
const clone = () => structuredClone(store.data);
const iconFor = (cat) => ({ '牛奶／豆漿': '🥛', 茶飲: '🍵', 咖啡: '☕', 果汁: '🍊', 汽水: '🥤', 其他: '🧃' })[cat] || '🧃';
const drinkById = (id) => store.data.drinks.find((drink) => drink.id === id);
const button = (label, action, extra = '', classes = '') => `<button class="button ${classes}" data-action="${action}" ${extra}>${label}</button>`;
const drinkCell = (drink) => `<div class="drink-cell"><span class="drink-avatar cat-${h(drink.category)}" aria-hidden="true">${h(drink.icon || iconFor(drink.category))}</span><div><strong>${h(drink.name)}</strong><small>${drink.perCase ? `每箱 ${drink.perCase} ${h(drink.unit)}` : '每箱數量待設定'}${drink.lastCountAt ? '' : ' · 尚未盤點'}</small></div></div>`;
const heading = (eyebrow, title, description, actions = '') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-description">${description}</p></div><div class="heading-actions">${actions}</div></div>`;
const empty = (title, description, action = '') => `<div class="empty-state"><span class="empty-icon" aria-hidden="true">🧃</span><h2>${title}</h2><div>${description}</div>${action}</div>`;
const recorderField = () => '<label class="field recorder-field">登記人<input name="recorder" required maxlength="80" autocomplete="name" placeholder="請填姓名或大家認得的稱呼"></label>';

function toast(message, error = false) {
  const element = $('#toast');
  clearTimeout(toastTimer);
  element.textContent = message;
  element.className = error ? 'error' : '';
  element.hidden = false;
  toastTimer = setTimeout(() => { element.hidden = true; }, error ? 14000 : 4500);
}

function updateChrome() {
  $('#breadcrumb-current').textContent = viewNames[view];
  document.title = `${viewNames[view]} · 宏穩茶水間`;
  const inAdmin = adminViews.has(view) && (store.canManage || store.canEdit);
  document.body.dataset.area = inAdmin ? 'admin' : 'front';
  document.body.dataset.view = view;
  document.querySelectorAll('[data-editor]').forEach((element) => { element.hidden = !inAdmin; });
  document.querySelectorAll('[data-front]').forEach((element) => { element.hidden = inAdmin; });
  document.querySelectorAll('nav [data-view]').forEach((element) => {
    const active = element.dataset.view === view || (element.dataset.view === 'restock' && Object.hasOwn(restockViews, view));
    element.classList.toggle('active', active);
    if (active) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  });
  $('#connection-status').textContent = store.revalidateOnStart ? `上次讀取的資料${refreshing ? ' · 更新中…' : ''}` : `${store.mode === 'demo' ? '本機示範' : store.mode === 'google' ? 'Google 共用資料' : '共用資料'} · ${inAdmin ? '管理後台' : '前台瀏覽'}`;
  $('#auth-button').textContent = inAdmin ? '返回前台' : '管理後台';
  $('#logout-button').hidden = !store.user;
  const banner = $('#mode-banner');
  banner.hidden = store.mode !== 'demo';
  if (store.mode === 'demo') banner.innerHTML = inAdmin
    ? '<strong>本機管理示範</strong>　免登入；盤點及入庫請填登記人。資料只存在此瀏覽器。'
    : '<strong>本機示範</strong>　目前是本機示範；飲料依公司清單建立，實際數量待盤點，不會跨裝置同步。';
}

function stockPill(drink) {
  if (!drink.lastCountAt) return '<span class="pill pill-muted">待首次盤點</span>';
  if(restockPaused('drink',drink.id))return `<span class="pill pill-muted">${RESTOCK_MODES[preferenceMode('drink',drink.id)]}</span>`;
  return isLowStockItem(drink) ? '<span class="pill pill-low">10 以內，準備補貨</span>' : '<span class="pill pill-ok">庫存充足</span>';
}

function restockPreferenceNotice() {
  return store.mode==='google'&&!store.supportsRestockPreferences?'<div class="info-box restock-preference-upgrade">勾選「暫不需要補貨」需先更新 Apps Script 部署，之後會在不同裝置共用。<a href="https://github.com/reytai-hldwn/pantry/blob/main/docs/SUPPLIES-SETUP.md" target="_blank" rel="noopener noreferrer">查看更新步驟 ↗</a></div>':'';
}

function restockControls(item,kind='drink') {
  const mode=preferenceMode(kind,item.id),paused=mode!=='normal';
  if(item.active===false||(!isLowStockItem(item)&&!paused))return '';
  const nextMode=mode==='replace'?'hold':'replace';
  return `<div class="restock-control" data-restock-control data-restock-kind="${kind}" data-restock-id="${h(item.id)}"><label class="restock-toggle${paused?' is-paused':''}"><input type="checkbox" data-restock-toggle data-restock-kind="${kind}" data-restock-id="${h(item.id)}"${paused?' checked':''}${store.supportsRestockPreferences?'':' disabled'}><span>${paused?RESTOCK_MODES[mode]:'暫不需要補貨'}</span></label>${paused?`<button type="button" class="restock-reason-button" data-restock-mode="${nextMode}" data-restock-kind="${kind}" data-restock-id="${h(item.id)}"${store.supportsRestockPreferences?'':' disabled'}>${nextMode==='replace'?'非長青品項，可以換成新品試試看！':'改標為暫不需要補貨'}</button>`:''}<span class="restock-save-status" data-restock-progress role="status"></span></div>`;
}

function restockState(item,kind='drink') {
  if(item.active===false)return '<span class="pill pill-muted">已停買，可重新上架</span>';
  return (restockPaused(kind,item.id)?'':kind==='drink'?stockPill(item):'')+restockControls(item,kind);
}

async function saveRestockPreference(control,mode) {
  const kind=control.dataset.restockKind,itemId=control.dataset.restockId;
  if(busy){if(control.matches('[data-restock-toggle]'))control.checked=restockPaused(kind,itemId);return;}
  const container=control.closest('[data-restock-control]'),controls=[...document.querySelectorAll('[data-restock-control] input,[data-restock-control] button')],disabled=controls.map(input=>input.disabled);
  const expectedMode=preferenceMode(kind,itemId);
  controls.forEach(input=>{input.disabled=true;});container.setAttribute('aria-busy','true');container.querySelector('[data-restock-progress]').textContent='儲存中…';
  try{
    await withBusy(async()=>{
      await store.setRestockPreference({kind,itemId,mode,expectedMode});
      render();googleWriteToast(mode==='normal'?'已恢復一般補貨提醒。':`已標示「${RESTOCK_MODES[mode]}」，數量不變。`);
    },control);
  }finally{
    if(container.isConnected){
      controls.forEach((input,index)=>{input.disabled=disabled[index];});
      container.querySelector('[data-restock-toggle]').checked=restockPaused(kind,itemId);
      container.removeAttribute('aria-busy');container.querySelector('[data-restock-progress]').textContent='';
    }
  }
}

function forecast(drink) {
  if(restockPaused('drink',drink.id))return `<span class="cell-note">${RESTOCK_MODES[preferenceMode('drink',drink.id)]}</span>`;
  const result = getConsumption(drink.id, store.data.events);
  if (result.anomaly) return '<span class="cell-note" title="盤點出現未登記的庫存增加，請確認補貨紀錄">紀錄待確認</span>';
  if (result.dailyRate === null || !drink.lastCountAt) return '<span class="cell-note">累積盤點中</span>';
  if (result.dailyRate === 0) return '<span class="cell-note">暫無消耗</span>';
  const elapsed = Math.max(0, (Date.now() - Date.parse(drink.lastCountAt)) / 86400000);
  const remaining = Math.max(0, drink.stock - elapsed * result.dailyRate);
  const days = Math.max(0, Math.ceil((remaining - drink.threshold) / result.dailyRate));
  return `<span class="cell-note${days < 3 ? ' stale-indicator' : ''}">${days === 0 ? '建議近期確認' : `約 ${days} 天後補貨`}</span><br><span class="cell-note">平均 ${result.dailyRate.toFixed(1)}／天</span>`;
}

function inventoryToolbar(warehouse = false) {
  return `<div class="toolbar">${warehouse ? `<div class="filter-tabs" role="group" aria-label="倉庫篩選">${[['low', '10 以內'], ['all', '供應中'], ['archived', '歷史品項']].map(([value, label]) => `<button class="filter-tab ${filter === value ? 'selected' : ''}" data-filter="${value}" aria-pressed="${filter === value}">${label}</button>`).join('')}</div>` : `<span class="fridge-browse-label">${activeDrinks().length} 款辦公室小補給</span>`}<div class="search-controls"><label class="search-field"><span aria-hidden="true">⌕</span><input id="search" type="search" maxlength="80" placeholder="找找喜歡的飲料…" aria-label="搜尋飲料" value="${h(query)}"></label><select id="category-filter" aria-label="篩選飲料分類"><option value="">所有分類</option>${categoryNames().map((name) => `<option value="${h(name)}"${category === name ? ' selected' : ''}>${h(name)}</option>`).join('')}</select></div></div>`;
}

function renderOverview() {
  main.innerHTML = `<div class="pantry-heading">${heading('OPEN A LITTLE HAPPINESS', '今天，喝點什麼？', '果汁、茶品與各項飲料，為你補充工作所需的燃料')}</div>` +
    `<section class="pantry-overview" aria-label="飲料冰箱"><div class="inventory-panel fridge-panel${fridgeOpen ? ' is-browsing' : ''}">${inventoryToolbar()}<div id="inventory-table"></div></div></section>`;
  $('.fridge-panel > .toolbar').hidden = !fridgeOpen;
  renderInventoryTable();
}

function renderWarehouse() {
  const low = activeDrinks().filter((drink) => needsRestock(drink)).length;
  const tabs=`<div class="warehouse-kind-tabs" role="group" aria-label="庫存類型">${[['drink','飲料'],['noodle','泡麵'],['toner','碳粉']].map(([kind,label])=>`<button type="button" class="filter-tab${warehouseKind===kind?' selected':''}" data-action="warehouse-kind" data-id="${kind}" aria-pressed="${warehouseKind===kind}">${label}</button>`).join('')}</div>`;
  const actions=button('↓ 匯出庫存','export','','button-outline')+(warehouseKind==='drink'?button('＋ 快速新增飲料','quick-add-drink'):button('盤點這一類','supply-count-kind',`data-id="${warehouseKind}"${store.supportsSupplies?'':' disabled'}`));
  main.innerHTML=heading('WAREHOUSE INVENTORY','倉庫庫存，補貨有依據','依庫存由少到多排列；待盤點放在最後，數量來自實際盤點與後續入庫。',actions)+tabs+restockPreferenceNotice();
  if(warehouseKind==='drink'){
    main.innerHTML+=`<div class="admin-summary"><span>${activeDrinks().length} 種供應中</span><span class="warehouse-alert">${low} 種需要確認補貨</span><span>${activeDrinks().filter(drink=>isLowStockItem(drink)&&restockPaused('drink',drink.id)).length} 種暫不補貨</span><span>最近完整盤點 ${formatDate(store.data.lastInventoryAt)}</span></div><div class="inventory-panel">${inventoryToolbar(true)}<div id="inventory-table"></div></div>`;
    renderInventoryTable();
  }else{
    main.innerHTML+=supplyUpgradeNotice(warehouseKind)+(warehouseKind==='noodle'?supplyExpirySetNotice():'')+`<div class="supply-intro"><p>${warehouseKind==='toner'?'固定黑、黃、紅、藍四色，單位為盒。':'依品項使用杯或碗。入庫必填保存期限，分批保留；30 天內到期會提醒。'}直接填寫數量，不做整箱換算；未盤點不當作 0。</p><label class="search-field">搜尋品項<input id="supply-search" type="search" maxlength="80" value="${h(supplyQuery)}" placeholder="搜尋${SUPPLY_KINDS[warehouseKind]}…"></label></div><div class="supply-stock-filters filter-tabs" role="group" aria-label="庫存範圍">${[['low','10 以內'],['all','供應中']].map(([value,label])=>`<button type="button" class="filter-tab${supplyFilter===value?' selected':''}" data-action="supply-stock-filter" data-id="${value}" aria-pressed="${supplyFilter===value}">${label}</button>`).join('')}</div><div class="inventory-panel" id="supply-inventory"></div>`;
    renderSupplyInventory();
  }
}

function renderSupplyInventory(){
  const target=$('#supply-inventory');if(!target)return;
  const items=sortInventoryItems(supplyItems().filter(item=>item.kind===warehouseKind&&item.active!==false&&(supplyFilter!=='low'||isLowStockItem(item))&&(!supplyQuery||item.name.toLocaleLowerCase().includes(supplyQuery.toLocaleLowerCase()))));
  target.innerHTML=items.length?`<div class="table-scroll"><table><thead><tr><th>品項</th><th>庫存數量</th>${warehouseKind==='noodle'?'<th>保存期限／入庫批次</th>':''}<th>最近盤點</th><th>最近入庫</th><th>登記</th></tr></thead><tbody>${items.map(item=>{
    const arrival=(store.supplyEvents||[]).filter(event=>event.supplyId===item.id&&event.type==='restock').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
    const color=item.kind==='toner'?item.id.split('-').pop():'';
    const canArrive=store.supportsSupplies&&(item.kind!=='noodle'||store.supportsSupplyExpiry);
    return `<tr data-supply-id="${h(item.id)}"><td class="supply-col-name"><div class="supply-name">${color?`<span class="toner-swatch toner-${h(color)}" aria-hidden="true"></span>`:'<span class="noodle-mark" aria-hidden="true">♨</span>'}<strong>${h(item.name)}</strong></div><span class="cell-note">單位：${h(item.unit)}</span></td><td class="supply-col-stock" data-label="庫存數量"><div class="stock-value">${item.stock===null?'待盤點':item.stock}<small>${item.stock===null?'':h(item.unit)}</small></div>${restockState(item,item.kind)}</td>${item.kind==='noodle'?`<td class="supply-col-expiry" data-label="保存期限／入庫批次">${renderSupplyBatches(item)}</td>`:''}<td class="cell-note supply-col-count" data-label="最近盤點">${formatDate(item.lastCountAt,true)}</td><td class="cell-note supply-col-arrival" data-label="最近入庫">${arrival?`${formatDate(arrival.createdAt,true)} · ＋${arrival.quantity} ${h(item.unit)}`:'尚無紀錄'}</td><td class="supply-col-actions"><div class="inline-actions">${button('＋ 快速入庫','supply-arrival',`data-id="${h(item.id)}"${canArrive?'':' disabled'}`,'button-small button-outline')}${item.kind==='noodle'?button('補登效期','supply-expiry-set',`data-id="${h(item.id)}"${store.supportsSupplyExpirySet&&item.lastCountAt&&item.stock>0?'':' disabled'}`,'button-small button-outline'):''}${button('盤點','supply-count',`data-id="${h(item.id)}"${store.supportsSupplies?'':' disabled'}`,'button-small button-plain')}</div></td></tr>`;
  }).join('')}</tbody></table></div><div class="table-bottom">顯示 ${items.length} 種${SUPPLY_KINDS[warehouseKind]} · 每次登記保留時間與登記人</div>`:empty('找不到這個品項','換個關鍵字看看。');
}

function renderSupplyBatches(item){
  const batches=supplyBatches(item.id,store.supplyEvents||[]);
  if(!batches.length)return `<span class="cell-note">${item.stock>0?'既有庫存效期待補':item.stock===0?'目前無待處理批次':'首次入庫時登記'}</span>`;
  const first=batches[0],status=supplyExpiryStatus(first.expiresOn);
  return `<details class="supply-batches"><summary><span class="expiry-badge expiry-${status.kind}">${h(first.expiresOn||'未登記日期')} · ${status.label}</span><small>${batches.length} 個批次</small></summary><ul>${batches.map(batch=>{
    const state=supplyExpiryStatus(batch.expiresOn);
    return `<li data-batch-id="${h(batch.id)}"><span class="expiry-badge expiry-${state.kind}">${h(batch.expiresOn||'未登記日期')} · ${state.label}</span><span>${batch.type==='expiry-set'?'效期核對':'入庫'} ${batch.quantity} ${h(item.unit)} · ${formatDate(batch.createdAt,true)}</span>${button('此批已用完','supply-expiry-close',`data-id="${h(batch.id)}"${store.supportsSupplyExpiry?'':' disabled'}`,'button-small button-plain')}</li>`;
  }).join('')}</ul><p>數量為入庫或效期核對時的記錄，剩餘請實際確認。標記用完可解除提醒；盤點為 0 會結束之前批次。</p></details>${supplyHasUntrackedExpiry(item.id,store.supplyEvents||[])?'<p class="cell-note">既有或調整的庫存尚未附效期，請核對現場。</p>':''}`;
}

function supplyExpirySetNotice() {
  return store.supportsSupplyExpiry&&!store.supportsSupplyExpirySet?'<div class="info-box">補登既有庫存保存期限需先更新 Apps Script 部署；原盤點與入庫可繼續使用。<a href="https://github.com/reytai-hldwn/pantry/blob/main/docs/SUPPLIES-SETUP.md" target="_blank" rel="noopener noreferrer">查看更新步驟 ↗</a></div>':'';
}

function expiryEditorRow(unit, quantity='') {
  const id=uid();
  return `<div class="expiry-edit-row" data-expiry-row="${id}"><label class="field">這批數量（${h(unit)}）<input name="batchQuantity" data-expiry-quantity type="number" min="1" max="999999" step="1" inputmode="numeric" required value="${quantity}"></label><label class="field">保存期限<input name="batchExpiresOn" data-expiry-date type="date" required></label>${button('移除','supply-expiry-remove',`type="button" data-id="${id}"`,'button-small button-plain')}</div>`;
}

function updateExpiryEditorSummary() {
  const form=$('#supply-expiry-set-form');if(!form||!modal.open)return;
  const inputs=[...form.querySelectorAll('[data-expiry-quantity]')],total=inputs.reduce((sum,input)=>sum+(Number(input.value)||0),0),expected=Number(form.dataset.expectedStock);
  inputs[0]?.setCustomValidity(total===expected?'':'各批數量合計須等於目前庫存；數量不同請先重新盤點。');
  form.querySelector('[data-expiry-total]').textContent=`各批合計 ${total} ${form.dataset.unit} ／ 目前庫存 ${expected} ${form.dataset.unit}${total===expected?'':'，請調整至一致'}`;
}

function openSupplyExpiryEditor(id) {
  const item=supplyById(id);
  if(!store.supportsSupplyExpirySet||!item||item.kind!=='noodle'||item.active===false||!item.lastCountAt||!(item.stock>0))throw new Error('請先更新 Google 部署並完成實際盤點，再補登保存期限。');
  const last=(store.supplyEvents||[]).filter(event=>event.supplyId===id).at(-1);
  showModal('補登保存期限',`${h(item.name)} · 目前庫存 ${item.stock} ${h(item.unit)}`,`<form id="supply-expiry-set-form" data-id="${h(id)}" data-unit="${h(item.unit)}" data-expected-stock="${item.stock}" data-expected-event-id="${h(last?.id||'')}"><p class="subtle">依現場各批次填寫，合計須等於目前庫存。這次只補登效期，不增減數量；會依本次核對結果更新全部效期提醒，原紀錄仍保留。若現場數量不同，請先重新盤點。</p>${recorderField()}<div class="expiry-edit-rows">${expiryEditorRow(item.unit,item.stock)}</div>${button('＋ 新增一批','supply-expiry-add','type="button"','button-small button-outline')}<p class="subtle">不同期限請分批填寫。既有庫存可如實填入已過期日期，系統會顯示到期狀態。</p><div class="order-summary" data-expiry-total aria-live="polite"></div><label class="field">備註<input name="note" maxlength="500" placeholder="選填，例如初次盤點補登"></label><div class="form-actions"><button type="submit" class="button">儲存保存期限</button>${button('取消','close-modal','type="button"','button-outline')}</div></form>`);
  updateExpiryEditorSummary();
}

function supplyUpgradeNotice(kind) {
  if (store.supportsSupplies && (kind !== 'noodle' || store.supportsSupplyExpiry)) return '';
  return `<div class="info-box supply-upgrade">品項已列好，Google 端尚未啟用${store.supportsSupplies?'泡麵保存期限':'泡麵與碳粉的儲存'}功能。請先更新 Apps Script 部署，再重新整理。<a href="https://github.com/reytai-hldwn/pantry/blob/main/docs/SUPPLIES-SETUP.md" target="_blank" rel="noopener noreferrer">查看逐步更新說明 ↗</a></div>`;
}

function supplyArrivalFields(item) {
  return `${recorderField()}<label class="field"><span data-supply-quantity-label>本次入庫數量（${h(item.unit)}）</span><input name="quantity" type="number" required min="1" max="999999" step="1" inputmode="numeric"></label>${item.kind==='noodle'?`<label class="field">保存期限（必填）<input name="expiresOn" type="date" required min="${supplyToday()}"></label><p class="subtle">以包裝標示的有效日期為準。不同期限請分次入庫，各批次分開提醒。</p>`:''}<label class="field">備註<input name="note" maxlength="500" placeholder="選填，例如到貨批次"></label><div class="order-summary" data-supply-arrival-summary></div>`;
}

function newArrivalOption() {
  return `<option value="${NEW_ARRIVAL_VALUE}"${store.supportsNewArrivals?'':' disabled'}>其他／新品${store.supportsNewArrivals?'':'（請先更新 Google 部署）'}</option>`;
}

function arrivalOptionLabel(item) {
  return `${h(item.name)}（${item.lastCountAt&&item.stock!==null?`${item.stock} ${h(item.unit)}`:`待盤點 · ${h(item.unit)}`}）`;
}

function newArrivalFields(kind) {
  const units=kind==='drink'?['包','瓶','罐']:['杯','碗'];
  return `<fieldset class="new-arrival-fields" hidden disabled><legend>登記新品</legend><label class="field">品項名稱<input name="newName" required maxlength="80" placeholder="請填寫完整品名與口味"></label><label class="field">單位<select name="newUnit" required><option value="" disabled selected>請選擇單位</option>${units.map(unit=>`<option value="${unit}">${unit}</option>`).join('')}</select></label><p class="subtle">新品與本次到貨會一起保存，之後可直接從選單選取。總庫存待首次盤點確認${kind==='drink'?'；先使用包裝示意圖，圖片與營養資訊可之後補齊':''}。</p></fieldset>`;
}

function toggleNewArrivalFields(form, visible) {
  const fields=form.querySelector('.new-arrival-fields');
  if (fields) { fields.hidden=!visible;fields.disabled=!visible; }
}

function newArrivalUpgradeNotice() {
  return store.supportsNewArrivals?'':'<p class="subtle new-arrival-upgrade">使用「其他／新品」前，請先<a href="https://github.com/reytai-hldwn/pantry/blob/main/docs/SUPPLIES-SETUP.md" target="_blank" rel="noopener noreferrer">更新 Apps Script 部署 ↗</a>。</p>';
}

function updateSupplyArrivalSummary(form = modal.open ? $('#supply-arrival-form') : $('#supply-restock-form')) {
  if (!form) return;
  const selected=form.elements.supplyId?.value||form.dataset.id,isNew=selected===NEW_ARRIVAL_VALUE;
  toggleNewArrivalFields(form,isNew);
  const item=isNew?{unit:form.elements.newUnit.value||'杯／碗',stock:null}:supplyById(selected);
  if (!item) return;
  form.querySelector('[data-supply-quantity-label]').textContent = `本次入庫數量（${item.unit}）`;
  const quantity = Math.max(0, Number(form.elements.quantity.value) || 0);
  form.querySelector('[data-supply-arrival-summary]').innerHTML = `目前帳面庫存：<strong>${item.stock===null?'待盤點':`${item.stock} ${h(item.unit)}`}</strong><br>本次入庫：<strong>${quantity} ${h(item.unit)}</strong><br>入庫後帳面庫存：<strong>${item.stock===null?'先保存入庫紀錄，待首次盤點確認數量':`${item.stock+quantity} ${h(item.unit)}`}</strong>`;
}

function openSupplyForm(action,id){
  if(view!=='products'||!store.canManage||!store.supportsSupplies)throw new Error('請先從管理後台更新 Google 部署，再登記泡麵與碳粉庫存。');
  if(action==='supply-arrival'){
    const item=supplyById(id);if(!item||item.active===false)throw new Error('找不到可登記的品項。');
    if(item.kind==='noodle'&&!store.supportsSupplyExpiry)throw new Error('請先更新 Google 部署，啟用泡麵保存期限。');
    showModal(`${h(item.name)}｜快速入庫`,`單位為${item.unit}，請填寫本次實際到貨數量。`,`<form id="supply-arrival-form" data-id="${h(item.id)}">${supplyArrivalFields(item)}<div class="form-actions"><button class="button" type="submit">確認入庫</button>${button('取消','close-modal','type="button"','button-outline')}</div></form>`);
    updateSupplyArrivalSummary();
  }else if(action==='supply-expiry-close'){
    const batch=(store.supplyEvents||[]).find(event=>event.id===id&&['restock','expiry-set'].includes(event.type)),item=batch&&supplyById(batch.supplyId);
    if(!store.supportsSupplyExpiry||!item||item.kind!=='noodle')throw new Error('找不到可標記的泡麵批次。');
    showModal('確認此批已用完',`${h(item.name)} · 保存期限 ${h(batch.expiresOn||'未登記')}`,`<form id="supply-expiry-close-form" data-batch-id="${h(batch.id)}"><p class="subtle">確認這一批已全部用完或移除後，可解除該批效期提醒。總庫存仍需以實際盤點校正。</p>${recorderField()}<label class="field">備註<input name="note" maxlength="500" placeholder="選填，例如已用完或過期移除"></label><div class="form-actions"><button class="button" type="submit">確認此批已用完</button>${button('取消','close-modal','type="button"','button-outline')}</div></form>`);
  }else{
    const items=action==='supply-count'?supplyItems().filter(item=>item.id===id&&item.active!==false):supplyItems().filter(item=>item.kind===id&&item.active!==false);
    if(!items.length)throw new Error('找不到可盤點的品項。');
    showModal('登記實際盤點','至少填一個品項即可；空白保留原紀錄，實際為零請填 0。',`<form id="supply-count-form">${recorderField()}${items.map(item=>`<label class="field">${h(item.name)}（${h(item.unit)}）<input type="number" name="${h(item.id)}" data-supply-count min="0" max="999999" step="1" inputmode="numeric" placeholder="這次未盤點可留白"></label>`).join('')}<div class="form-actions"><button class="button" type="submit">儲存盤點</button>${button('取消','close-modal','type="button"','button-outline')}</div></form>`);
  }
}

function renderInventoryTable() {
  const warehouse = view === 'products';
  let drinks = store.data.drinks.filter((drink) =>
    (warehouse && filter === 'archived' ? drink.active === false : drink.active !== false) &&
    (!warehouse || filter !== 'low' || isLowStockItem(drink)) &&
    (!category || drink.category === category) && (!query || drink.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const target = $('#inventory-table');
  if(warehouse)drinks=sortInventoryItems(drinks);
  if (!drinks.length && warehouse) { target.innerHTML = empty('這一格還沒有飲料', '換個分類或關鍵字看看。'); return; }
  if (!warehouse) {
    target.innerHTML = renderFridge(drinks, { isOpen: fridgeOpen, lastInventoryAt: store.data.lastInventoryAt, formatDate, showQuantities: false,
      popularity: store.mode === 'google' ? store.popularity : getWeeklyPopularity(store.data.drinks, store.data.events), popularityLoading, popularityError });
    syncFridgeScene(target.querySelector('.pantry-stage'));
    if (fridgeOpen) loadFridgePopularity();
    return;
  }
  const copyBar = filter === 'low' ? `<div class="refill-copy-bar"><span>只複製待補貨品項，已暫停提醒的品項不列入。</span>${button('⧉ 複製補貨清單', 'copy-low', '', 'button-small button-outline')}</div>` : '';
  target.innerHTML = copyBar + `<div class="table-scroll"><table class="inventory-drinks-table"><thead><tr><th>飲料品項</th><th>分類／包裝</th><th>庫存餘量</th><th>補貨狀態</th><th>最近盤點</th><th>管理</th></tr></thead><tbody>${drinks.map((drink) => `<tr data-stock-drink-id="${h(drink.id)}"><td class="inventory-name-cell">${drinkCell(drink)}</td><td data-label="分類／包裝"><span class="category-label">${h(drink.category)}</span><p class="cell-note">${h(drink.packaging || drink.unit)}</p></td><td data-label="庫存餘量"><div class="stock-value ${isLowStockItem(drink) && !restockPaused('drink',drink.id) && drink.active !== false ? 'low warehouse-low' : ''}">${drink.lastCountAt ? drink.stock : '—'}<small>${h(drink.unit)}</small></div></td><td class="inventory-status-cell" data-label="補貨狀態">${restockState(drink)}</td><td data-label="最近盤點"><span class="cell-note">${formatDate(drink.lastCountAt)}</span></td><td class="inventory-actions-cell">${store.canEdit ? `<button class="cell-action" data-action="edit-drink" data-id="${h(drink.id)}" aria-label="編輯${h(drink.name)}">編輯 ↗</button>` : '<a class="text-link" href="#restock">登記入庫 ↗</a>'}</td></tr>`).join('')}</tbody></table></div><div class="table-bottom"><span>顯示 ${drinks.length} 種飲料</span><span>歷史品項保留原本數量與紀錄</span></div>`;
}

async function loadFridgePopularity() {
  if (store.mode !== 'google' || popularityLoading) return;
  popularityLoading = true; popularityError = false;
  const update = () => {
    const target = document.querySelector('.fridge-popularity');
    if (view === 'overview' && target) target.innerHTML = renderFridgePopularity(store.popularity, { loading: popularityLoading, error: popularityError });
  };
  update();
  try { await store.readPopularity(); }
  catch { popularityError = true; }
  finally { popularityLoading = false; update(); }
}

function renderArchive() {
  const archived = store.data.drinks.filter((drink) => drink.active === false);
  main.innerHTML = heading('ONCE IN OUR PANTRY', '那些曾經喝過的', '曾經買過、目前暫停供應的飲料。還想喝的話，留下你的回購願望。') +
    `<div class="archive-grid">${archived.length ? archived.map((drink) => {
      const wish=store.data.wishes.find(item=>item.sourceDrinkId===drink.id),voted=wish&&store.hasVoted(wish.id);
      return `<article class="panel archive-card" data-archived-drink-id="${h(drink.id)}">${drinkPack(drink)}<h2>${h(drink.name)}</h2><p>${h(drink.category)} · ${h(drink.packaging || drink.unit)}</p><span class="pill pill-muted">歷史品項</span><div class="form-actions">${button('查看飲料資訊', 'view-drink', `type="button" data-id="${h(drink.id)}"`, 'button-small button-outline')}</div><div class="archive-wish-actions"><button type="button" class="wish-vote-button${voted?' is-voted':''}" data-action="archive-wish" data-id="${h(drink.id)}" aria-pressed="${!!voted}"${voted||!store.supportsArchiveWishes?' disabled':''}>${voted?'♥ 已記下你的回購願望':'♡ 我還想喝，希望有機會可以再買'}</button>${wish?`<button type="button" class="wish-vote-count" data-action="view-wish-supporters" data-id="${h(wish.id)}">${wish.votes||0} 人還想喝</button>`:''}${!store.supportsArchiveWishes?'<small class="subtle">更新 Google 部署後即可登記回購願望。</small>':''}</div></article>`;
    }).join('') : `<div class="panel">${empty('每一款喜歡，都值得被記得', '品項停買後會收進這裡，不會刪掉以前的紀錄。')}</div>`}</div>`;
}

function renderGoogleLink(url, label) {
  const safe = safeUrl(url);
  return safe ? `<a class="button" href="${h(safe)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>` : '<p class="subtle">連結尚未設定，請由管理者完成 Google 串接。</p>';
}

function renderGoogleEntry(tabs = '') {
  const count = view === 'count';
  main.innerHTML = heading('KEEP THE PANTRY READY', count ? '幫飲料架點個名' : '到貨了，記一筆就好', '免登入，填寫登記人與實際數量，送出後就會留下時間與紀錄。') + tabs +
    `<section class="panel form-panel"><h2>${count ? '登記實際盤點' : '登記到貨入庫'}</h2><p class="page-description">${count ? '至少填一個品項即可，未盤點的品項留白，實際為零請填 0。' : '整箱或零散數量至少填一項，兩項都填會加總；每箱預設 24 包／瓶／罐。'}Google 表單內的「登記人」為必填。送出後回來重新整理，即可查看更新的庫存。</p><div class="form-actions">${renderGoogleLink(count ? store.formUrls.stocktake : store.formUrls.arrival, count ? '填寫盤點表單' : '填寫入庫表單')}<a href="#products" class="button button-outline">查看倉庫庫存</a></div></section>`;
}

function googleWriteToast(message) {
  toast(store.mode === 'google' && store.lastWriteNeedsRefresh
    ? '資料已存入共用試算表；畫面更新稍有延遲，請稍後重新整理。'
    : message);
}

function openDrinkDetails(id) {
  const drink = drinkById(id);
  if (!drink) return;
  if (!store.canEdit) {
    showModal(h(drink.name), '查看成分、過敏原與營養標示，資料來源與核對日期列於下方。', `<div class="drink-detail-hero">${drinkPack(drink, { fullSize: true })}<div><span class="category-label">${h(drink.category)}</span><p class="subtle">${h(drink.packaging || drink.unit)}</p></div></div>${renderDrinkInformation(drink)}<div class="form-actions">${button('關閉', 'close-modal', 'type="button"', 'button-outline')}</div>`);
    return;
  }
  const arrival = store.data.events.filter((event) => event.type === 'restock' && event.drinkId === id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  showModal(h(drink.name), '庫存以最近一次盤點與後續入庫為準，日常取用尚未扣除。', `<div class="drink-detail-hero">${drinkPack(drink, { fullSize: true })}<div><span class="subtle">目前紀錄庫存</span><div class="stat-number">${drink.lastCountAt ? drink.stock : '待盤點'}<small>${h(drink.unit)}</small></div>${stockPill(drink)}</div></div><dl class="drink-facts"><div><dt>最近實際盤點</dt><dd>${formatDate(drink.lastCountAt, true)}</dd></div><div><dt>最近到貨入庫</dt><dd>${arrival ? `${formatDate(arrival.createdAt, true)} · ＋${arrival.quantity} ${h(drink.unit)}` : '尚無紀錄'}</dd></div><div><dt>包裝換算</dt><dd>每箱 ${drink.perCase} ${h(drink.unit)}</dd></div><div><dt>補貨提醒</dt><dd>低於 ${drink.threshold} ${h(drink.unit)}</dd></div><div><dt>消耗與補貨估算</dt><dd>${forecast(drink)}</dd></div></dl>${renderDrinkInformation(drink)}<div class="form-actions">${button('關閉', 'close-modal', 'type="button"', 'button-outline')}${store.canEdit ? button('編輯品項', 'edit-drink', `data-id="${h(drink.id)}" type="button"`) : ''}</div>`);
}

async function copyLowStock() {
  const drinks = sortInventoryItems(activeDrinks().filter((drink) => needsRestock(drink) && (!category || drink.category === category) && (!query || drink.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))));
  if (!drinks.length) { toast('目前沒有需要列入補貨清單的品項。'); return; }
  const message = [
    '宏穩茶水間｜補貨參考清單',
    `整理日期：${formatDate(new Date().toISOString(), true)}`,
    '以下依最近盤點與後續入庫紀錄，採購前請先確認現場數量。',
    '',
    ...drinks.map((drink) => `・${drink.name}：剩 ${drink.stock} ${drink.unit}（盤點 ${formatDate(drink.lastCountAt, true)}）`),
  ].join('\n');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(message);
    toast('補貨清單已複製，可以貼給老闆娘了。');
  } catch {
    showModal('補貨清單整理好了', '這個瀏覽器無法直接複製，請長按或全選下方文字後複製。', `<label class="field">需要補給的飲料<textarea id="copy-list-text" readonly rows="10">${h(message)}</textarea></label><div class="form-actions">${button('關閉', 'close-modal', 'type="button"', 'button-outline')}</div>`);
    $('#copy-list-text').select();
  }
}

function renderCount() {
  const drinks = sortInventoryItems(activeDrinks());
  main.innerHTML = heading('A FRESH COUNT', '幫飲料架點個名', '每三天或一週盤點一次，就很夠用了。請填實際剩餘的單瓶／單罐數量。') +
    '<div class="info-box">至少填寫一個品項即可送出。空白代表這次未盤點，保留原紀錄；填 0 代表實際剩餘 0。已填數量即使沒變，也會留下新的盤點紀錄。</div>' +
    (drinks.length ? `<form id="count-form">${recorderField()}<div class="panel table-scroll"><table class="count-table"><thead><tr><th>飲料品項</th><th>上次帳面庫存</th><th>這次實際盤點</th></tr></thead><tbody>${drinks.map((drink) => `<tr><td>${drinkCell(drink)}</td><td><span class="muted">${drink.lastCountAt ? `${drink.stock} ${h(drink.unit)}` : '尚未盤點'}</span></td><td><input class="count-input" type="number" inputmode="numeric" min="0" max="999999" step="1" name="${h(drink.id)}" placeholder="未盤點請留白" aria-label="${h(drink.name)}實際剩餘數量"><span class="count-unit">${h(drink.unit)}</span></td></tr>`).join('')}</tbody></table></div><div class="sticky-actions"><span>可選填 ${drinks.length} 種飲料，至少一項</span><button type="submit" class="button">✓ 儲存本次盤點</button></div></form>` : `<div class="panel">${empty('還沒有飲料品項', '先新增品項，下一步就可以盤點了。', button('＋ 新增品項', 'new-drink'))}</div>`);
}

function renderRestock() {
  const kind = restockViews[view];
  const tabs = `<nav class="warehouse-kind-tabs restock-kind-tabs" aria-label="到貨入庫分類">${Object.entries(restockViews).map(([route, value])=>`<a class="filter-tab${kind===value?' selected':''}" href="#${route}"${kind===value?' aria-current="page"':''}>${value==='drink'?'飲料':SUPPLY_KINDS[value]}</a>`).join('')}</nav>`;
  if (kind !== 'drink') { renderSupplyRestock(kind, tabs); return; }
  if (store.mode === 'google' && !store.supportsWebsiteEntry) { renderGoogleEntry(tabs); return; }
  const drinks = activeDrinks();
  const arrivals = store.data.events.filter((event) => event.type === 'restock')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);
  const options = sortInventoryItems(drinks);
  main.innerHTML = heading('A LITTLE REFILL', '到貨了，記一筆就好', '飲料、泡麵與碳粉分頁登記，各自保留入庫紀錄。') + tabs +
    '<div class="info-box">只登記已實際收到的飲料。整箱或零散數量至少填一項，兩項都填會加總。每箱預設 24 包／瓶／罐；分批到貨就分次登記。</div>' +
    ((drinks.length || store.supportsNewArrivals) ? `<div class="restock-layout"><section class="panel form-panel"><h2>飲料到貨入庫</h2>${newArrivalUpgradeNotice()}<form id="restock-form">${recorderField()}<label class="field">飲料品項<select name="drinkId" id="restock-drink">${options.map((drink) => `<option value="${h(drink.id)}">${arrivalOptionLabel(drink)}</option>`).join('')}${newArrivalOption()}</select></label>${newArrivalFields('drink')}<div class="form-grid"><label class="field" data-arrival-cases>整箱數量<input name="cases" type="number" inputmode="numeric" min="0" max="9999" step="1" placeholder="0"></label><label class="field"><span id="loose-label">另外的單包／瓶／罐</span><input name="loose" type="number" inputmode="numeric" min="0" max="999999" step="1" placeholder="0"><small id="loose-hint">不足整箱也可登記</small></label></div><label class="field">備註（選填）<input name="note" maxlength="200" placeholder="例如：下午到貨、分批入庫"></label><div id="restock-summary" class="order-summary"></div><div class="form-actions"><button type="submit" class="button" id="restock-submit">確認到貨入庫</button></div><p class="subtle">儲存時會自動記錄本次入庫時間。</p></form></section><section><div class="section-heading"><h2>最近入庫紀錄</h2><a href="#history" class="text-link">完整紀錄 ↗</a></div><div class="panel">${arrivals.length ? arrivals.map((event) => {
      const drink = eventItem(event);
      return `<article class="order-card"><div class="order-card-top"><div><h3>${h(drink?.name || '已封存品項')}</h3><span class="cell-note">${formatDate(event.createdAt, true)} · ${h(event.recorder || '未記錄登記人')}</span></div><span class="pill pill-ok">＋${event.quantity} ${h(drink?.unit || '個')}</span></div>${event.note ? `<p>${h(event.note)}</p>` : ''}</article>`;
    }).join('') : empty('還沒有入庫紀錄', '第一次到貨登記後，時間與數量會自動記在這裡。')}</div></section></div>` : `<div class="panel">${empty('先把飲料加入清單', '每個品項設定好每箱數量後，就可以快速登記入庫。', button('＋ 新增品項', 'new-drink'))}</div>`);
  updateRestockSummary();
}

function renderSupplyRestock(kind, tabs) {
  const label = SUPPLY_KINDS[kind];
  const items = sortInventoryItems(supplyItems().filter(item=>item.kind===kind&&item.active!==false));
  const enabled = store.supportsSupplies && (kind!=='noodle'||store.supportsSupplyExpiry);
  const arrivals = (store.supplyEvents||[]).filter(event=>event.type==='restock'&&supplyById(event.supplyId)?.kind===kind)
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,5);
  main.innerHTML = heading('A LITTLE REFILL', '到貨了，記一筆就好', '飲料、泡麵與碳粉分頁登記，各自保留入庫紀錄。') + tabs + supplyUpgradeNotice(kind) +
    `<div class="info-box">${kind==='noodle'?'依品項以杯或碗登記，保存期限必填；不同期限請分次入庫。':'固定黑、黃、紅、藍四色，以盒登記。'}只記錄實際到貨數量，不做整箱換算。</div>` +
    `<div class="restock-layout"><section class="panel form-panel"><h2>${label}到貨入庫</h2>${kind==='noodle'?newArrivalUpgradeNotice():''}${items.length?`<form id="supply-restock-form"><fieldset class="arrival-fields" aria-label="${label}入庫資料"${enabled?'':' disabled'}><label class="field">${label}品項<select name="supplyId" id="restock-supply">${items.map(item=>`<option value="${h(item.id)}">${arrivalOptionLabel(item)}</option>`).join('')}${kind==='noodle'?newArrivalOption():''}</select></label>${kind==='noodle'?newArrivalFields(kind):''}${supplyArrivalFields(items[0])}<div class="form-actions"><button type="submit" class="button">確認到貨入庫</button></div><p class="subtle">每次入庫保留登記人與時間${kind==='noodle'?'，保存期限可在倉庫庫存查看':''}。</p></fieldset></form>`:empty('目前沒有可入庫的品項','請先確認庫存品項設定。')}</section><section aria-label="${label}最近入庫紀錄"><div class="section-heading"><h2>${label}最近入庫紀錄</h2><a href="#history" class="text-link">完整紀錄 ↗</a></div><div class="panel">${arrivals.length?arrivals.map(event=>{
      const item=supplyById(event.supplyId);
      return `<article class="order-card"><div class="order-card-top"><div><h3>${h(item.name)}</h3><span class="cell-note">${formatDate(event.createdAt,true)} · ${h(event.recorder)}</span></div><span class="pill pill-ok">＋${event.quantity} ${h(item.unit)}</span></div>${kind==='noodle'?`<p>保存期限：${h(event.expiresOn||'未登記')}</p>`:''}${event.note?`<p>${h(event.note)}</p>`:''}</article>`;
    }).join(''):empty(`還沒有${label}入庫紀錄`,'到貨登記後，時間與數量會自動記在這裡。')}</div></section></div>`;
  updateSupplyArrivalSummary();
}

function updateRestockSummary() {
  const form = $('#restock-form');
  if (!form) return;
  const isNew=form.elements.drinkId.value===NEW_ARRIVAL_VALUE;
  toggleNewArrivalFields(form,isNew);
  form.elements.cases.disabled=isNew;
  form.querySelector('[data-arrival-cases]').hidden=isNew;
  form.elements.loose.required=isNew;
  form.elements.loose.min=isNew?'1':'0';
  if(isNew){
    const unit=form.elements.newUnit.value||'包／瓶／罐',quantity=Math.max(0,Number(form.elements.loose.value)||0);
    $('#loose-label').textContent=`本次入庫數量（${unit}）`;
    $('#loose-hint').textContent='新品依單位登記實際數量，每箱數量可之後設定。';
    $('#restock-summary').innerHTML=`本次入庫：<strong>${quantity} ${h(unit)}</strong><br>新品與到貨紀錄一起保存；總庫存待首次盤點確認。`;
    return;
  }
  const drink = drinkById(form.elements.drinkId.value);
  if (!drink) return;
  const quantity = Math.max(0, Number(form.elements.cases.value) || 0) * drink.perCase + Math.max(0, Number(form.elements.loose.value) || 0);
  $('#loose-label').textContent = `另外的單${drink.unit}數量`;
  $('#loose-hint').textContent = `以${drink.unit}為單位，不足整箱也可登記`;
  const observed = drink.stock !== null && !!drink.lastCountAt;
  $('#restock-summary').innerHTML = `${drink.perCase ? `每箱 <strong>${drink.perCase} ${h(drink.unit)}</strong>` : '每箱數量待設定，請先登記單包／瓶／罐'} · 目前帳面庫存 <strong>${observed ? `${drink.stock} ${h(drink.unit)}` : '待首次盤點'}</strong><br>本次入庫：<strong>${quantity} ${h(drink.unit)}</strong><br>入庫後帳面庫存：<strong>${observed ? `${drink.stock + quantity} ${h(drink.unit)}` : '先保存入庫紀錄，待盤點確認數量'}</strong>`;
}

const wishStatus = (status) => ({ pending: ['待評估', 'pill-low'], purchased: ['已採購', 'pill-ok'], declined: ['暫不採購', 'pill-muted'] })[status] || ['待評估', 'pill-low'];
function renderWishes() {
  const wishes = store.data.wishes.filter((wish) => wishFilter === 'all' || wishKind(wish) === wishFilter).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const tabs = `<div class="wish-pool-tabs" role="group" aria-label="篩選採買願望">${[['all', '全部'], ['drink', '飲料'], ['snack', '零食']].map(([value, label]) => `<button type="button" class="filter-tab${wishFilter === value ? ' selected' : ''}" data-action="wish-pool" data-id="${value}" aria-pressed="${wishFilter === value}">${label}</button>`).join('')}</div>`;
  main.innerHTML = heading('SOMETHING TO LOOK FORWARD TO', '採買許願池', '留下想喝的飲料、想吃的零食，讓下一次採購多一點期待。', button('♡ 新增願望', 'new-wish')) + tabs +
    '<div class="info-box">歡迎許願，或是按「我也喜歡」贊同別人的提案。同一個瀏覽器對每個願望可贊同一次。</div>' +
    (wishes.length ? `<div class="wish-grid">${wishes.map((wish) => {
      const [label, style] = wishStatus(wish.status);
      const kindLabel = wishKindLabel(wishKind(wish));
      const url = safeUrl(wish.url);
      const voted = (store.mode === 'demo' || store.supportsWebsiteEntry) && store.hasVoted(wish.id);
      const votes = Number.isSafeInteger(wish.votes) && wish.votes >= 0 ? wish.votes : 0;
      const unavailable = store.mode === 'google' && !store.supportsWebsiteEntry && (!store.voteForm?.url || !store.voteForm?.voterNameEntryId);
      return `<article class="panel wish-card" data-wish-id="${h(wish.id)}"><div class="wish-top"><div class="wish-type"><span class="wish-icon" aria-hidden="true">♡</span><span class="category-label">${kindLabel}</span></div><span class="pill ${style}">${label}</span></div><h2>${h(wish.name)}</h2><p>${h(wish.note || '一個值得試試的新選擇。')}</p>${url ? `<a href="${h(url)}" target="_blank" rel="noopener noreferrer" class="text-link">看看這款${kindLabel} ↗</a>` : '<span class="subtle">尚未附上購買連結</span>'}<div class="wish-vote-row"><button class="wish-vote-button${voted ? ' is-voted' : ''}" data-action="vote-wish" data-id="${h(wish.id)}" aria-pressed="${voted}"${voted || unavailable ? ' disabled' : ''}${unavailable ? ' title="請先更新 Google 贊同表單，加入必填姓名欄位"' : ''}>${voted ? '♥ 已贊同' : '♡ 我也喜歡'}</button><button type="button" class="wish-vote-count" data-action="view-wish-supporters" data-id="${h(wish.id)}" title="${h(wishSupportPreview(wish))}" aria-label="${votes} 人喜歡，查看贊同名單" aria-haspopup="dialog" aria-live="polite">${votes} 人喜歡</button></div><div class="wish-bottom"><span class="wish-date">${formatDate(wish.createdAt)} 加入許願池</span>${store.canEdit ? `<button class="cell-action" data-action="edit-wish" data-id="${h(wish.id)}">管理願望 ↗</button>` : ''}</div></article>`;
    }).join('')}</div>` : `<div class="panel">${empty('第一個採買願望，會是什麼？', '選擇飲料或零食，附上想買的品項與連結。', button('♡ 新增願望', 'new-wish'))}</div>`);
}

function renderHistory() {
  const events = stockEvents().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  main.innerHTML = heading('EVERY LITTLE CHANGE', '每一次補給，都有跡可循', '保留飲料、泡麵與碳粉的實際盤點及入庫紀錄。', button('↓ 匯出紀錄', 'export-history', '', 'button-outline')) +
    `<div class="panel">${events.length ? `<div class="table-scroll"><table><thead><tr><th>時間</th><th>品項</th><th>異動</th><th>數量</th><th>登記人</th><th>備註</th></tr></thead><tbody>${events.slice(0, 200).map((event) => {
      const drink = eventItem(event);
      const type = event.type === 'count' ? '盤點' : event.type==='expiry-close'?'批次用完':event.type==='expiry-set'?'效期補登':'入庫';
      return `<tr><td class="cell-note">${formatDate(event.createdAt, true)}</td><td>${h(drink?.name || '已封存品項')}</td><td><span class="history-type history-${h(event.type)}">${type}</span></td><td class="history-number">${event.type==='expiry-close'?'—':`${event.type === 'restock' ? '＋' : ''}${event.quantity} ${h(drink?.unit || '個')}`}</td><td class="subtle">${h(event.recorder || '未記錄')}</td><td class="subtle">${h(event.note || '—')}${eventExpiry(event)?`<br>保存期限 ${h(eventExpiry(event))}`:''}</td></tr>`;
    }).join('')}</tbody></table></div><div class="table-bottom"><span>顯示最近 ${Math.min(events.length, 200)} 筆，共 ${events.length} 筆</span><span>匯出可取得完整紀錄</span></div>` : empty('還沒有異動紀錄', '第一次盤點或補貨之後，紀錄會自動留在這裡。')}</div>`;
}

let adminSummaryLoading = false;
async function loadAdminSummary() {
  if (adminSummaryLoading) return;
  adminSummaryLoading=true;
  try {
    const summary = store.mode==='google' ? await store.readAdminSummary() : {
      totalDrinks:store.data.drinks.length,pendingWishes:store.data.wishes.filter(wish=>wish.status==='pending').length,
      lowItems:sortInventoryItems([...store.data.drinks.map(item=>({...item,kind:'drink'})),...supplyItems()].filter(item=>item.active!==false&&isLowStockItem(item))).map(item=>({...item,mode:preferenceMode(item.kind,item.id)}))};
    if (view!=='admin')return;
    const target=$('#admin-low-stock');if(!target)return;
    const needs=summary.lowItems.filter(item=>item.mode==='normal');
    target.innerHTML=`<div class="admin-low-heading"><div><span class="eyebrow">LOW STOCK</span><h2>10 以內，先看看這些</h2><p class="subtle">${needs.length} 種可確認補貨 · ${summary.totalDrinks} 種飲料 · ${summary.pendingWishes} 個願望待評估</p></div><a class="text-link" href="#products">查看庫存與補貨設定 ↗</a></div>${summary.lowItems.length?`<ul class="admin-low-list">${summary.lowItems.map(item=>`<li class="${item.mode==='normal'?'needs-restock':'is-paused'}"><span><small>${item.kind==='drink'?'飲料':SUPPLY_KINDS[item.kind]}</small><strong>${h(item.name)}</strong>${item.mode!=='normal'?`<small>${h(RESTOCK_MODES[item.mode])}</small>`:''}</span><b>${item.stock}<small>${h(item.unit)}</small></b></li>`).join('')}</ul>`:'<p class="subtle">目前沒有已盤點、庫存在 10 以內的品項。</p>'}`;
  } catch (error) {
    if(view==='admin'&&$('#admin-low-stock'))$('#admin-low-stock').innerHTML=`<p class="subtle">${h(error.message)}</p>${button('重新讀取摘要','retry-admin-summary','type="button"','button-small button-outline')}`;
  } finally { adminSummaryLoading=false; }
}

function renderAdmin() {
  main.innerHTML = heading('PANTRY MANAGEMENT', '把補給的小事，整理好', '免登入管理。每次盤點或登記到貨，請填寫登記人，方便之後核對。', button('＋ 快速新增飲料', 'quick-add-drink')) +
    `<section id="admin-low-stock" class="panel admin-low-stock" aria-live="polite"><p class="subtle">正在整理 10 以內的庫存…</p></section><div class="admin-grid">${[
      ['count', '☷', '快速盤點', '可只盤一個品項；未盤點留白，實際為零填 0。', '開始盤點'],
      ['restock', '↗', '到貨入庫', '飲料、泡麵與碳粉分頁登記，保存到貨時間與數量。', '登記入庫'],
      ['products', '▦', '倉庫庫存與歷史品項', '查看實際庫存，確認哪些品項需要補貨。', '查看庫存'],
      ['manage-wishes', '♡', '大家的願望', '看看同事想喝的飲料、想吃的零食，以及大家的贊同。', '查看願望'],
      ['history', '◷', '異動紀錄', '查看實際盤點、入庫時間與數量，並匯出備份。', '查看紀錄'],
    ].map(([href, icon, title, description, cta]) => `<a href="#${href}" class="admin-card"><span class="admin-card-icon" aria-hidden="true">${icon}</span><h2>${title}</h2><p>${description}</p><span class="admin-card-cta">${cta} ↗</span></a>`).join('')}</div>`;
  loadAdminSummary();
}

function render() {
  syncFridgeScene(null);
  main.removeAttribute('aria-busy');
  store.preview = !adminViews.has(view);
  dirty = false;
  updateChrome();
  if (adminViews.has(view) && !store.canManage && !store.canEdit) {
    main.innerHTML = heading('EDITOR ACCESS', '這裡留給庫存管理者', '同事可以直接查看庫存與許願清單，修改資料需要登入。') + `<div class="panel">${empty('登入後繼續', '只有獲授權的帳號可以修改庫存。', button('管理員登入', 'login'))}</div>`;
    return;
  }
  if (store.mode === 'google' && !store.supportsWebsiteEntry && view === 'count') { renderGoogleEntry(); return; }
  if (Object.hasOwn(restockViews, view)) renderRestock();
  else ({ overview: renderOverview, products: renderWarehouse, archive: renderArchive, admin: renderAdmin, count: renderCount, wishes: renderWishes, 'manage-wishes': renderWishes, history: renderHistory })[view]();
}

async function route() {
  if (!ready) return;
  let next = location.hash.slice(1) || 'overview';
  // Keep previously shared snack links working after merging the navigation.
  if (next === 'snack-wishes') {
    wishFilter = 'snack';
    next = 'wishes';
    history.replaceState(null, '', '#wishes');
  }
  const nextView = Object.hasOwn(viewNames, next) ? next : 'overview';
  if (dirty && nextView !== view && !confirm('這一頁還有未儲存的輸入，確定要離開嗎？')) {
    history.replaceState(null, '', `#${view}`);
    return;
  }
  if(nextView==='products'&&view!=='products'){filter='low';supplyFilter='low';query='';category='';}
  view = nextView;
  const sequence = ++routeSequence;
  if(store.mode==='google'&&view!=='admin')store.cancelOtherViewReads(adminViews.has(view));
  const needsGoogleRead = store.mode === 'google' && view !== 'admin' && (!store.googleViewLoaded || store.inWarehouse !== adminViews.has(view));
  routeLoading = needsGoogleRead;
  if (needsGoogleRead) {
    syncFridgeScene(null);
    updateChrome();
    main.setAttribute('aria-busy', 'true');
    main.innerHTML = `<div class="loading-state"><span class="loader"></span><p>正在開啟${viewNames[view]}，讀取共用資料…</p></div>`;
    try { await (adminViews.has(view) ? store.readWarehouse() : store.openPublic()); }
    catch (error) {
      if (sequence !== routeSequence) return;
      routeLoading = false;
      main.removeAttribute('aria-busy');
      main.innerHTML = `<div class="panel">${empty('暫時無法讀取資料', h(error.message), button('重新讀取', 'retry-route'))}</div>`;
      return;
    }
  }
  if (sequence !== routeSequence) return;
  routeLoading = false;
  render();
  if (store.revalidateOnStart && !store.inWarehouse) refreshCurrentView();
}

function showModal(title, description, content) {
  modal.classList.remove('modal-product-entry');
  delete modal.dataset.productIds;
  modalDirty = false;
  $('#modal-content').innerHTML = `<div class="modal-heading"><div><h2 id="modal-title">${title}</h2><p>${description}</p></div><button class="close-button" data-action="close-modal" aria-label="關閉視窗">×</button></div>${content}<div id="modal-error" class="modal-error" role="alert" hidden></div>`;
  modal.showModal();
}

function openLogin() {
  if (store.mode === 'demo') { location.hash = 'admin'; if (view === 'admin') render(); return; }
  showModal('歡迎回到茶水間', '使用獲授權的管理者帳號登入。帳號由公司管理者建立，不開放自行註冊。', `<form id="login-form"><div class="form-grid"><label class="field full-width">電子郵件<input type="email" name="email" required autocomplete="username" maxlength="254"></label><label class="field full-width">密碼<input type="password" name="password" required autocomplete="current-password"></label></div><div class="form-actions"><button class="button" type="submit">登入編輯</button></div></form>`);
}

function openQuickDrink() {
  if (!adminViews.has(view) || (!store.canManage && !store.canEdit)) throw new Error('請從管理入口新增飲料。');
  if (store.mode === 'google' && !store.supportsWebsiteEntry) {
    const url = store.getProductFormUrl();
    showModal('快速新增飲料', '直接在下方填寫品名、分類、包裝與登記人。沒有圖片也能上架，之後可再補圖。', `<iframe class="product-entry-frame" title="快速新增飲料表單" src="${h(url)}" loading="lazy" referrerpolicy="no-referrer"></iframe><p class="subtle">表單送出後，按下方按鈕讀取新飲料；同步完成前不會顯示為已上架。新增品項的實際數量仍需盤點或登記到貨。</p><div class="form-actions">${button('關閉', 'close-modal', 'type="button"', 'button-outline')}${button('已送出，更新飲料架', 'refresh-new-drinks', 'type="button"')}</div>`);
    modal.classList.add('modal-product-entry');
    modal.dataset.productIds = JSON.stringify(store.data.drinks.map((drink) => drink.id));
    return;
  }
  showModal('快速新增飲料', '沒有圖片也能先上架，之後補圖會沿用這個品項與紀錄。', `<form id="quick-drink-form"><div class="form-grid"><label class="field full-width">飲料名稱<input name="name" required maxlength="80" placeholder="輸入新飲料的名稱"></label><label class="field">飲料分類<select name="category">${categories.map((name) => `<option value="${h(name)}">${h(name)}</option>`).join('')}</select></label><label class="field">包裝外觀<select name="packaging">${packagingTypes.map((type) => `<option value="${h(type)}">${h(type)}</option>`).join('')}</select></label><label class="field full-width">登記人<input name="recorder" required maxlength="80" autocomplete="name" placeholder="請填姓名或大家認得的稱呼"></label><p class="subtle full-width">先使用包裝示意圖。實際數量請在上架後盤點或登記到貨，每箱數量可稍後設定。</p></div><div class="form-actions">${button('取消', 'close-modal', 'type="button"', 'button-outline')}<button class="button" type="submit">新增並上架</button></div></form>`);
}

function openDrink(id) {
  const drink = drinkById(id);
  showModal(drink ? '編輯飲料與供應狀態' : '讓飲料架多一個選擇', '停買可收進歷史品項，原本庫存與入庫紀錄仍會保留。', `<form id="drink-form" data-id="${h(id || '')}"><div class="form-grid"><label class="field full-width">飲料名稱<input name="name" required maxlength="80" value="${h(drink?.name || '')}"></label><label class="field">飲料分類<select name="category">${categoryNames().map((name) => `<option value="${h(name)}"${drink?.category === name ? ' selected' : ''}>${h(name)}</option>`).join('')}</select></label><label class="field">包裝外觀<select name="packaging">${packagingTypes.map((type) => `<option value="${h(type)}"${drink?.packaging === type ? ' selected' : ''}>${h(type)}</option>`).join('')}</select></label><label class="field">單個計算單位<select name="unit">${['包', '瓶', '罐'].map((unit) => `<option${drink?.unit === unit ? ' selected' : ''}>${unit}</option>`).join('')}</select></label><label class="field">供應狀態<select name="active"><option value="true"${drink?.active !== false ? ' selected' : ''}>目前供應</option><option value="false"${drink?.active === false ? ' selected' : ''}>歷史品項（停買）</option></select></label><label class="field">每箱數量<input type="number" inputmode="numeric" min="1" max="9999" step="1" name="perCase" placeholder="待設定" value="${drink ? drink.perCase ?? '' : DEFAULT_CASE_SIZE}"><small>新飲料預設每箱 24 包／瓶／罐</small></label><label class="field">補貨提醒門檻<input type="number" inputmode="numeric" min="1" max="999999" step="1" name="threshold" required value="${drink?.threshold ?? 10}"><small>剩餘此數量以內標紅，包含此數量</small></label><label class="field full-width">補貨目標庫存（選填）<input type="number" inputmode="numeric" min="1" max="999999" step="1" name="target" placeholder="待設定" value="${drink?.target ?? ''}"></label></div><div class="form-actions">${button('取消', 'close-modal', 'type="button"', 'button-outline')}<button class="button" type="submit">儲存品項</button></div></form>`);
}

function openWish(id) {
  const wish = store.data.wishes.find((item) => item.id === id);
  const kind = wish ? wishKind(wish) : '';
  if (store.mode === 'google' && !store.supportsWebsiteEntry) {
    showModal('新增採買願望', '先選擇是飲料或零食，再到許願表單填寫品項。', `<form id="wish-category-form"><label class="field">許願類型<select name="kind" required>${wishKindOptions()}</select></label><div class="form-actions">${button('取消', 'close-modal', 'type="button"', 'button-outline')}<button class="button" type="submit">繼續填寫願望</button></div></form>`);
    return;
  }
  showModal(wish ? '管理採買願望' : '新增採買願望', '選擇飲料或零食，附上產品連結，下一次採購就能輕鬆找到。', `<form id="wish-form" data-id="${h(id || '')}"><div class="form-grid"><label class="field full-width">許願類型<select name="kind" required>${wishKindOptions(kind)}</select></label><label class="field full-width">品項名稱<input name="name" required maxlength="80" value="${h(wish?.name || '')}" placeholder="例如：無糖氣泡水、海鹽蘇打餅乾"></label><label class="field full-width">購買或產品連結（選填）<input name="url" type="url" maxlength="2000" placeholder="https://…" value="${h(wish?.url || '')}"></label><label class="field full-width">許願備註（選填）<textarea name="note" maxlength="500" placeholder="口味、偏好、想試試的原因…">${h(wish?.note || '')}</textarea></label>${wish ? `<label class="field full-width">採購狀態<select name="status">${[['pending', '待評估'], ['purchased', '已採購'], ['declined', '暫不採購']].map(([value, title]) => `<option value="${value}"${wish?.status === value ? ' selected' : ''}>${title}</option>`).join('')}</select></label>` : '<p class="subtle full-width">新願望會先列為「待評估」，由管理者更新進度。</p>'}</div><div class="form-actions">${wish ? button('刪除願望', 'delete-wish', `type="button" data-id="${h(id)}"`, 'button-danger') : ''}${button('取消', 'close-modal', 'type="button"', 'button-outline')}<button class="button" type="submit">儲存願望</button></div></form>`);
}

function openVote(id) {
  const wish = store.data.wishes.find((item) => item.id === id);
  if (!wish) throw new Error('找不到這個願望，請重新整理後再試。');
  showModal('這個，我也喜歡', `支持「${h(wish.name)}」前，請填寫姓名；送出後會顯示在贊同名單。`, `<form id="vote-form" data-id="${h(id)}"><label class="field">姓名<input name="voterName" required maxlength="80" autocomplete="name" placeholder="請填寫姓名"></label><div class="form-actions">${button('取消', 'close-modal', 'type="button"', 'button-outline')}<button class="button" type="submit">${store.mode === 'google' && !store.supportsWebsiteEntry ? '下一步' : '送出贊同'}</button></div></form>`);
}

function openWishSupporters(id) {
  const wish = store.data.wishes.find((item) => item.id === id);
  if (!wish) throw new Error('找不到這個願望，請重新整理後再試。');
  const { votes, names, unnamed } = wishSupportDetails(wish);
  showModal('贊同名單', `「${h(wish.name)}」共有 ${votes} 人喜歡。`, `${names.length ? `<ul class="wish-supporter-list">${names.map((name) => `<li>${h(name)}</li>`).join('')}</ul>` : !votes ? '<p class="subtle">還沒有人贊同這個提案。</p>' : ''}${unnamed ? `<p class="subtle">另有 ${unnamed} 位未提供姓名資料。</p>` : ''}<div class="form-actions">${button('關閉', 'close-modal', 'type="button"', 'button-outline')}</div>`);
}

function openDrinkLabel(id) {
  const drink = drinkById(id);
  const photo = drink && findProductPhoto(drink.name);
  if (!photo) throw new Error('這個品項還沒有可核對的包裝原圖。');
  showModal(`${h(drink.name)}｜包裝原圖`, '放大查看所提供的包裝版本；只有清楚可辨識的標示才會填入資料。', `<img class="drink-label-source" src="${h(photo.src)}" alt="${h(drink.name)}包裝原圖"><div class="form-actions">${button('查看飲料資訊', 'view-drink', `type="button" data-id="${h(id)}"`, 'button-outline')}${button('關閉', 'close-modal', 'type="button"', 'button-outline')}</div>`);
}

async function save(next, message, close = false) {
  await store.save(next);
  if (close) { modalDirty = false; modal.close(); }
  render();
  toast(message);
}

function addEvent(next, type, drink, quantity, createdAt, note, recorder) {
  next.events.push({ id: uid(), type, drinkId: drink.id, quantity, previousStock: drink.stock, createdAt, note, recorder });
}

async function submitForm(form) {
  const values = new FormData(form);
  if(form.id==='supply-expiry-set-form'){
    const recorder=String(values.get('recorder')||'').trim();
    if(!store.canManage||!recorder||recorder.length>80)throw new Error('請從管理入口填寫登記人，最多 80 字。');
    const batches=[...form.querySelectorAll('[data-expiry-row]')].map(row=>({quantity:number(row.querySelector('[data-expiry-quantity]').value),expiresOn:row.querySelector('[data-expiry-date]').value}));
    const expectedStock=Number(form.dataset.expectedStock);
    if(!batches.length||batches.length>20||batches.some(batch=>batch.quantity<1||batch.quantity>999999||!validSupplyExpiry(batch.expiresOn))||batches.reduce((sum,batch)=>sum+batch.quantity,0)!==expectedStock)throw new Error('請填寫有效日期與正整數數量；各批合計須等於目前庫存。');
    await store.setSupplyExpiry({supplyId:form.dataset.id,batches,expectedStock,expectedEventId:form.dataset.expectedEventId,recorder,note:String(values.get('note')||'').trim()});
    modalDirty=false;modal.close();render();googleWriteToast('已補登保存期限，庫存數量未變。');return;
  }
  const newKind=form.id==='restock-form'&&values.get('drinkId')===NEW_ARRIVAL_VALUE?'drink':form.id==='supply-restock-form'&&values.get('supplyId')===NEW_ARRIVAL_VALUE?'noodle':null;
  if(newKind){
    if(!store.canManage||!store.supportsNewArrivals)throw new Error('請先更新 Apps Script 部署，才能登記新品到貨。');
    const name=String(values.get('newName')||'').trim(),unit=values.get('newUnit'),recorder=String(values.get('recorder')||'').trim();
    const quantity=number(values.get(newKind==='drink'?'loose':'quantity'));
    if(!name||name.length>80)throw new Error('請填寫新品名稱，最多 80 字。');
    if(!recorder||recorder.length>80)throw new Error('請填寫登記人，最多 80 字。');
    if(!(newKind==='drink'?['包','瓶','罐']:['杯','碗']).includes(unit)||quantity<1||quantity>999999)throw new Error('請選擇新品單位並填寫 1 到 999999 的整數數量。');
    const expiresOn=newKind==='noodle'?String(values.get('expiresOn')||''):null;
    if(newKind==='noodle'&&(!validSupplyExpiry(expiresOn)||expiresOn<supplyToday()))throw new Error('泡麵請填寫有效的保存期限，不能早於今天。');
    await store.submitNewArrival({kind:newKind,name,unit,quantity,recorder,expiresOn,note:String(values.get('note')||'').trim()});
    render();googleWriteToast(`已新增「${name}」並記錄入庫 ${quantity} ${unit}；總庫存待首次盤點。`);return;
  }
  if(['supply-arrival-form','supply-restock-form','supply-count-form','supply-expiry-close-form'].includes(form.id)){
    if(!store.supportsSupplies||!store.canManage)throw new Error('請先更新 Google 部署並從管理入口登記。');
    const recorder=String(values.get('recorder')||'').trim();
    if(!recorder||recorder.length>80)throw new Error('請填寫登記人，最多 80 字。');
    let message;
    if(form.id==='supply-expiry-close-form'){
      await store.closeSupplyBatch({batchId:form.dataset.batchId,recorder,note:String(values.get('note')||'').trim()});message='已結束這個批次的效期提醒；總庫存請以盤點核對。';
    }else if(['supply-arrival-form','supply-restock-form'].includes(form.id)){
      const item=supplyById(values.get('supplyId')||form.dataset.id),quantity=number(values.get('quantity'));
      if(!item||item.active===false||quantity<1||quantity>999999)throw new Error('請填寫 1 到 999999 的整數數量。');
      const expiresOn=item.kind==='noodle'?String(values.get('expiresOn')||''):null;
      if(item.kind==='noodle'&&(!validSupplyExpiry(expiresOn)||expiresOn<supplyToday()))throw new Error('泡麵請填寫有效的保存期限，不能早於今天。');
      await store.submitSupplyArrival({supplyId:item.id,quantity,recorder,note:String(values.get('note')||'').trim(),expiresOn});
      message=`已記錄入庫 ${quantity} ${item.unit}${item.stock===null?'；總庫存待首次盤點。':'。'}`;
    }else{
      const entries=[...form.querySelectorAll('[data-supply-count]')].filter(input=>input.value.trim()!=='').map(input=>({supplyId:input.name,quantity:number(input.value)}));
      if(!entries.length||entries.some(entry=>entry.quantity>999999))throw new Error('請至少填寫一個品項，數量須為 0 到 999999 的整數。');
      await store.submitSupplyStocktake(entries,recorder);message=`已保存 ${entries.length} 個品項的實際盤點。`;
    }
    if(modal.contains(form)){modalDirty=false;modal.close();}
    render();googleWriteToast(message);return;
  }
  if (form.id === 'login-form') {
    await store.login(values.get('email').trim(), values.get('password'));
    modalDirty = false;
    modal.close();
    if (!adminViews.has(view)) { location.hash = 'admin'; }
    else render();
    toast('登入成功，可以開始整理飲料架了。');
    return;
  }
  if (form.id === 'quick-drink-form') {
    await store.addDrink({ name: values.get('name'), category: values.get('category'), packaging: values.get('packaging'), recorder: values.get('recorder') });
    modalDirty = false;
    modal.close();
    filter = 'all'; query = ''; category = ''; fridgeOpen = true;
    location.hash = 'overview';
    googleWriteToast('新飲料已上架，先使用包裝示意圖；記得補登實際數量。');
    return;
  }
  if (form.id === 'archive-wish-form') {
    const result=await store.supportArchivedDrink(form.dataset.id,String(values.get('voterName')||'').trim());
    modalDirty=false;modal.close();renderArchive();googleWriteToast(result?.alreadyVoted?'這個瀏覽器已經登記過，保留原本的一票。':'已記下你的回購願望！');return;
  }
  if (form.id === 'vote-form') {
    const voterName = String(values.get('voterName') || '').trim();
    if (!voterName || voterName.length > 80) throw new Error('請填寫姓名，最多 80 字。');
    if (store.mode === 'google' && !store.supportsWebsiteEntry) {
      const url = store.getVoteUrl(form.dataset.id, voterName);
      showModal('送出這份喜歡', '姓名已預填。請送出 Google 贊同表單，再回來重新整理查看人數；同一瀏覽器重複送出不會多加票。', `<div class="form-actions">${renderGoogleLink(url, '開啟贊同表單')}${button('關閉', 'close-modal', 'type="button"', 'button-outline')}</div>`);
    } else {
      const result = await store.voteWish(form.dataset.id, voterName);
      modalDirty = false;
      modal.close();
      renderWishes();
      googleWriteToast(result?.alreadyVoted ? '這個瀏覽器已經贊同過，保留原本的一票。' : '已記下你的贊同！');
    }
    return;
  }
  if (form.id === 'wish-category-form') {
    const kind = values.get('kind');
    if (!['drink', 'snack'].includes(kind)) throw new Error('請選擇飲料許願或零食許願。');
    const url = store.getWishUrl(kind);
    showModal('填寫採買願望', `已選擇：${wishKindLabel(kind)}許願。許願不需要填姓名，送出後回到這裡重新整理。`, `<div class="form-actions">${renderGoogleLink(url, '開啟許願表單')}${button('關閉', 'close-modal', 'type="button"', 'button-outline')}</div>`);
    return;
  }
  if (form.id === 'wish-form' && !form.dataset.id) {
    await store.submitWish({ kind: values.get('kind'), name: values.get('name').trim(), url: values.get('url').trim(), note: values.get('note').trim() });
    modalDirty = false;
    modal.close();
    if (wishFilter !== 'all') wishFilter = values.get('kind');
    render();
    googleWriteToast('願望已送出，等管理者下次採購時評估。');
    return;
  }
  if (store.mode === 'google' && store.supportsWebsiteEntry && ['count-form', 'restock-form'].includes(form.id)) {
    const recorder = String(values.get('recorder') || '').trim();
    if (!recorder || recorder.length > 80) throw new Error('請填寫登記人，最多 80 字。');
    if (form.id === 'count-form') {
      const entries = stocktakeQuantities(store.data.drinks, Object.fromEntries(values));
      await store.submitStocktake(entries, recorder);
      dirty = false;
      render();
      googleWriteToast(`已完成 ${entries.length} 種飲料的盤點，其他品項保留原紀錄。`);
    } else {
      const drink = drinkById(values.get('drinkId'));
      if (!drink || drink.active === false) throw new Error('請選擇供應中的飲料。');
      const quantity = restockQuantity(values.get('cases'), values.get('loose'), drink.perCase);
      const result = await store.submitArrival({ drinkId: drink.id, cases: values.get('cases'), loose: values.get('loose'), recorder, note: String(values.get('note') || '').trim() });
      dirty = false;
      render();
      googleWriteToast(`已入庫 ${result.quantity ?? quantity} ${drink.unit}，紀錄已保存。`);
    }
    return;
  }
  if (!store.canEdit) throw new Error('請從管理入口使用對應的登記表單。');
  const next = clone();
  const now = new Date().toISOString();
  const recorder = String(values.get('recorder') || '').trim();
  if (['count-form', 'restock-form'].includes(form.id) && (!recorder || recorder.length > 80)) throw new Error('請填寫登記人，最多 80 字。');
  if (form.id === 'count-form') {
    const entries = stocktakeQuantities(next.drinks, Object.fromEntries(values));
    for (const { drinkId, quantity } of entries) {
      const drink = next.drinks.find((item) => item.id === drinkId);
      addEvent(next, 'count', drink, quantity, now, '定期盤點', recorder);
      drink.stock = quantity;
      drink.lastCountAt = now;
    }
    if (entries.length === activeDrinks().length) next.lastInventoryAt = now;
    await save(next, `已完成 ${entries.length} 種飲料的盤點，其他品項保留原紀錄。`);
  } else if (form.id === 'drink-form') {
    const perCase = values.get('perCase').trim() ? number(values.get('perCase')) : null;
    const threshold = number(values.get('threshold'));
    const target = values.get('target').trim() ? number(values.get('target')) : null;
    const name = values.get('name').trim();
    if (!name) throw new Error('請填寫飲料名稱。');
    if (perCase === 0 || !threshold || (target !== null && target < threshold)) throw new Error('每箱數量與提醒門檻須大於 0，目標庫存不可低於提醒門檻。');
    if (next.drinks.some((drink) => drink.name.toLocaleLowerCase() === name.toLocaleLowerCase() && drink.id !== form.dataset.id)) throw new Error('已經有同名的飲料品項了。');
    const updates = { name, category: values.get('category'), packaging: values.get('packaging'), active: values.get('active') !== 'false', unit: values.get('unit'), perCase, threshold, target };
    const existing = next.drinks.find((drink) => drink.id === form.dataset.id);
    if (existing) {
      Object.assign(existing, updates, { icon: iconFor(updates.category) });
    } else next.drinks.push({ id: uid(), ...updates, icon: iconFor(updates.category), stock: 0, lastCountAt: null });
    await save(next, existing ? '品項設定已更新。' : '飲料已新增，記得進行首次盤點。', true);
  } else if (form.id === 'wish-form') {
    const urlInput = values.get('url').trim();
    const url = safeUrl(urlInput);
    if (urlInput && !url) throw new Error('請填入有效的 http 或 https 連結，且不要包含帳號密碼。');
    const name = values.get('name').trim();
    if (!name) throw new Error('請填寫品項名稱。');
    const kind = values.get('kind');
    if (!['drink', 'snack'].includes(kind)) throw new Error('請選擇飲料許願或零食許願。');
    const updates = { kind, name, url, note: values.get('note').trim(), status: values.get('status') };
    const existing = next.wishes.find((wish) => wish.id === form.dataset.id);
    if (existing) Object.assign(existing, updates);
    else next.wishes.push({ id: uid(), ...updates, createdAt: now });
    if (wishFilter !== 'all') wishFilter = kind;
    await save(next, '小願望已經好好記下來了。', true);
  } else if (form.id === 'restock-form') {
    const drink = next.drinks.find((item) => item.id === values.get('drinkId'));
    const quantity = restockQuantity(values.get('cases'), values.get('loose'), drink.perCase);
    if (drink.stock + quantity > 999999) throw new Error('累計數量不可超過 999,999，請確認輸入。');
    const note = values.get('note').trim();
    addEvent(next, 'restock', drink, quantity, now, note || '到貨入庫', recorder);
    drink.stock += quantity;
    await save(next, `已入庫 ${quantity} ${drink.unit}，庫存與入庫時間已記錄。`);
  }
}

async function runAction(action, id) {
  if(action==='supply-stock-filter'){if(view==='products'&&['all','low'].includes(id)){supplyFilter=id;renderWarehouse();}return;}
  if(action==='supply-expiry-set'){if(view==='products'&&store.canManage)openSupplyExpiryEditor(id);return;}
  if(['supply-expiry-add','supply-expiry-remove'].includes(action)){
    const form=$('#supply-expiry-set-form');if(!modal.open||!form)return;
    const rows=form.querySelectorAll('[data-expiry-row]');
    if(action==='supply-expiry-add'){
      if(rows.length>=20)throw new Error('一次最多填寫 20 個效期批次。');
      form.querySelector('.expiry-edit-rows').insertAdjacentHTML('beforeend',expiryEditorRow(form.dataset.unit));
    }else{
      if(rows.length<=1)throw new Error('請保留至少一個效期批次。');
      [...rows].find(row=>row.dataset.expiryRow===id)?.remove();
    }
    modalDirty=true;inputSequence++;updateExpiryEditorSummary();return;
  }
  if(action==='warehouse-kind'){
    if(view!=='products'||!['drink','noodle','toner'].includes(id))return;
    warehouseKind=id;supplyQuery='';supplyFilter='all';renderWarehouse();return;
  }
  if(['supply-arrival','supply-count','supply-count-kind','supply-expiry-close'].includes(action)){openSupplyForm(action,id);return;}
  if (action === 'close-modal') {
    if (modalDirty && !confirm('視窗內還有未儲存的輸入，確定關閉嗎？')) return;
    modalDirty = false;
    modal.close();
    return;
  }
  if (action === 'quick-add-drink') { if(store.mode==='google'&&!store.googleViewLoaded)await store.readPublic(); if(view!=='admin'&&view!=='products')return;openQuickDrink(); return; }
  if (action === 'retry-admin-summary') { store.adminSummaryReadAt=-Infinity;loadAdminSummary();return; }
  if (action === 'archive-wish') {
    const drink=store.data.drinks.find(item=>item.id===id&&item.active===false);if(!drink)throw new Error('找不到這個歷史品項。');
    showModal('這款，我還想喝',`留下姓名，讓採買時知道大家還想喝「${h(drink.name)}」。`, `<form id="archive-wish-form" data-id="${h(id)}"><label class="field">姓名<input name="voterName" required maxlength="80" autocomplete="name"></label><div class="form-actions">${button('取消','close-modal','type="button"','button-outline')}<button type="submit" class="button">送出回購願望</button></div></form>`);return;
  }
  if (action === 'refresh-new-drinks') {
    if (store.mode !== 'google' || !adminViews.has(view)) throw new Error('請從管理入口更新飲料架。');
    const previous = new Set(JSON.parse(modal.dataset.productIds || '[]'));
    await store.read();
    const added = store.data.drinks.filter((drink) => !previous.has(drink.id));
    if (!added.length) {
      toast('尚未讀到新飲料；請確認表單已送出，稍後再更新。同名品項不會重複上架，可先查看倉庫或歷史品項。');
      return;
    }
    modalDirty = false;
    modal.close();
    filter = 'all'; query = ''; category = ''; fridgeOpen = true;
    location.hash = 'overview';
    toast(`已同步 ${added.length} 款新飲料，飲料架已更新。`);
    return;
  }
  if (action === 'login') { openLogin(); return; }
  if (action === 'retry-route') { await route(); return; }
  if (action === 'wish-pool') { wishFilter = ['drink', 'snack'].includes(id) ? id : 'all'; renderWishes(); return; }
  if (action === 'vote-wish') { openVote(id); return; }
  if (action === 'view-wish-supporters') { openWishSupporters(id); return; }
  if (action === 'view-drink-label') { openDrinkLabel(id); return; }
  if (action === 'view-drink') { openDrinkDetails(id); return; }
  if (action === 'toggle-mobile-menu') {
    const expanded = document.body.classList.toggle('mobile-menu-open');
    $('.mobile-menu-toggle').setAttribute('aria-expanded', String(expanded));
    return;
  }
  if (action === 'copy-low') { if (!store.canManage && !store.canEdit) throw new Error('請從倉庫管理產生補貨清單。'); await copyLowStock(); return; }
  if (action === 'toggle-door') { fridgeOpen = !fridgeOpen; syncFridgeDoor($('.fridge'), fridgeOpen); if (fridgeOpen) loadFridgePopularity(); return; }
  if (action === 'retry-popularity') { loadFridgePopularity(); return; }
  if (action === 'new-wish') { openWish(); return; }
  if (action === 'export' || action === 'export-history') {
    if (!store.canManage && !store.canEdit) throw new Error('請從管理入口匯出紀錄。');
    exportCSV(action === 'export-history'); return;
  }
  if (!store.canEdit) throw new Error('這項操作需要編輯權限。');
  if (action === 'new-drink' || action === 'edit-drink') { openDrink(id); return; }
  if (action === 'edit-wish') { openWish(id); return; }
  const next = clone();
  if (action === 'delete-wish') {
    if (!confirm('確定刪除這個願望嗎？')) return;
    next.wishes = next.wishes.filter((wish) => wish.id !== id);
    await save(next, '願望已刪除。', true);
  }
}

function exportCSV(historyExport = false) {
  const rows = historyExport ? [
    ['時間（台北）', '品項', '類型', '數量', '原帳面庫存', '單位', '登記人', '備註', '保存期限'],
    ...stockEvents().map((event) => [formatDate(event.createdAt, true), eventItem(event)?.name || event.supplyId || event.drinkId,
      event.type === 'count' ? '盤點' : event.type === 'expiry-close' ? '批次用完' : event.type === 'expiry-set' ? '效期補登' : '入庫',
      event.type === 'expiry-close' ? '' : event.quantity, event.previousStock, eventItem(event)?.unit || '', event.recorder || '未記錄', event.note, eventExpiry(event) || '']),
  ] : view==='products'&&warehouseKind!=='drink' ? [
    ['品項','分類','庫存數量','單位','最近盤點（台北）','補貨標示'],
    ...sortInventoryItems(supplyItems().filter(item=>item.kind===warehouseKind)).map(item=>[item.name,SUPPLY_KINDS[item.kind],item.stock===null?'待盤點':item.stock,item.unit,formatDate(item.lastCountAt,true),RESTOCK_MODES[preferenceMode(item.kind,item.id)]]),
  ] : [
    ['飲料名稱', '分類', '帳面庫存', '單位', '每箱數量', '提醒門檻', '目標庫存', '最近盤點（台北）', '補貨標示'],
    ...sortInventoryItems(store.data.drinks).map((drink) => [drink.name, drink.category, drink.stock, drink.unit, drink.perCase, drink.threshold, drink.target, formatDate(drink.lastCountAt, true),RESTOCK_MODES[preferenceMode('drink',drink.id)]]),
  ];
  const csv = rows.map((row) => row.map((value) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `宏穩茶水間-${store.mode === 'demo' ? '示範-' : ''}${historyExport ? '異動紀錄' : '庫存'}-${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function withBusy(task, element) {
  if (busy) return;
  busy = true;
  const buttons = element?.matches('form') ? [...element.querySelectorAll('button')] : element ? [element] : [];
  let saveStatus;
  if (element?.matches('form') && store.mode === 'google' && store.supportsWebsiteEntry) {
    element.setAttribute('aria-busy', 'true');
    saveStatus = document.createElement('p');
    saveStatus.className = 'form-save-status';
    saveStatus.setAttribute('role', 'status');
    saveStatus.textContent = '正在儲存至共用試算表，請稍候…';
    element.appendChild(saveStatus);
  }
  buttons.forEach((item) => { item.disabled = true; });
  try { await task(); }
  catch (error) {
    if (modal.open && $('#modal-error')) {
      $('#modal-error').textContent = error.message;
      $('#modal-error').hidden = false;
    } else toast(error.message || '操作失敗，請稍後再試。', true);
    updateChrome();
  } finally {
    saveStatus?.remove();
    element?.removeAttribute('aria-busy');
    buttons.forEach((item) => { item.disabled = false; }); busy = false;
  }
}

document.addEventListener('click', (event) => {
  const restockMark=event.target.closest('[data-restock-mode]');
  if(restockMark){event.preventDefault();saveRestockPreference(restockMark,restockMark.dataset.restockMode);return;}
  if (busy && event.target.closest('a[href^="#"]')) { event.preventDefault(); return; }
  const action = event.target.closest('[data-action]');
  if (action) {
    event.preventDefault();
    if (['retry-admin-summary','archive-wish','supply-stock-filter','supply-expiry-set','supply-expiry-add','supply-expiry-remove','warehouse-kind','supply-arrival','supply-count','supply-count-kind','supply-expiry-close','close-modal', 'quick-add-drink', 'new-drink', 'new-wish', 'edit-drink', 'edit-wish', 'vote-wish', 'view-wish-supporters', 'view-drink-label', 'login', 'view-drink', 'toggle-door', 'retry-popularity', 'retry-route'].includes(action.dataset.action)) {
      if (!busy) runAction(action.dataset.action, action.dataset.id).catch((error) => toast(error.message, true));
    } else withBusy(() => runAction(action.dataset.action, action.dataset.id), action);
  }
  const displayButton = event.target.closest('[data-display]');
  if (displayButton && !busy) {
    display = displayButton.dataset.display;
    try { localStorage.setItem('holdwin-display', display); } catch { /* optional display preference */ }
    document.querySelectorAll('[data-display]').forEach((element) => {
      element.classList.toggle('selected', element === displayButton);
      element.setAttribute('aria-pressed', element === displayButton ? 'true' : 'false');
    });
    renderInventoryTable();
  }
  const tab = event.target.closest('[data-filter]');
  if (tab && !busy) {
    filter = tab.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((element) => {
      element.classList.toggle('selected', element === tab);
      element.setAttribute('aria-pressed', element === tab ? 'true' : 'false');
    });
    renderInventoryTable();
  }
});

document.addEventListener('input', (event) => {
  inputSequence += 1;
  if (event.target.closest('dialog form')) modalDirty = true;
  if (event.target.closest('#supply-expiry-set-form')) updateExpiryEditorSummary();
  if(event.target.id==='supply-search'){supplyQuery=event.target.value.trim();renderSupplyInventory();}
  else if (event.target.id === 'search') { query = event.target.value.trim(); renderInventoryTable(); }
  else if (event.target.closest('main form')) { dirty = true; }
  if (event.target.closest('#restock-form')) updateRestockSummary();
  const supplyForm = event.target.closest('#supply-arrival-form,#supply-restock-form');
  if (supplyForm) updateSupplyArrivalSummary(supplyForm);
});
document.addEventListener('change', (event) => {
  inputSequence += 1;
  if(event.target.matches('[data-restock-toggle]')){saveRestockPreference(event.target,event.target.checked?'hold':'normal');return;}
  if (event.target.closest('dialog form')) modalDirty = true;
  if (event.target.id === 'category-filter') { category = event.target.value; renderInventoryTable(); }
  else if (event.target.closest('#restock-form')) { dirty = true; updateRestockSummary(); }
  else if (event.target.closest('#supply-arrival-form,#supply-restock-form')) {
    if (event.target.closest('main')) dirty = true;
    updateSupplyArrivalSummary(event.target.closest('form'));
  }
});
document.addEventListener('submit', (event) => {
  if (!event.target.matches('form')) return;
  event.preventDefault();
  withBusy(() => submitForm(event.target), event.target);
});
modal.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (!busy) runAction('close-modal');
});
$('#auth-button').addEventListener('click', () => {
  if (!ready || busy) return;
  if (dirty && !confirm('切換頁面會捨棄未儲存的輸入，確定繼續嗎？')) return;
  dirty = false;
  if (adminViews.has(view) && (store.canManage || store.canEdit)) { location.hash = 'overview'; return; }
  if (store.mode === 'demo' || store.mode === 'google' || store.isEditor) { location.hash = 'admin'; return; }
  openLogin();
});
$('#logout-button').addEventListener('click', () => {
  if (!ready || busy) return;
  if (dirty && !confirm('登出會捨棄未儲存的輸入，確定登出嗎？')) return;
  withBusy(async () => {
    try { await store.logout(); }
    finally { dirty = false; location.hash = 'overview'; if (view === 'overview') render(); }
    toast('已登出管理者帳號。');
  }, $('#logout-button'));
});
async function refreshCurrentView(manual = false) {
  if (!ready || busy || refreshing || routeLoading) return;
  if (!manual && (dirty || modal.open || !['overview', 'wishes', 'history', 'archive'].includes(view) || document.hidden)) return;
  if (manual && dirty && !confirm('重新讀取會捨棄未儲存的輸入，確定繼續嗎？')) return;
  const sequence = routeSequence, inputs = inputSequence, currentView = view, revision = store.revision;
  const button = $('#refresh-button');
  refreshing = true;
  if (store.revalidateOnStart) updateChrome();
  if (manual) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  try {
    if(view==='admin'&&store.mode==='google'){store.adminSummaryReadAt=-Infinity;await loadAdminSummary();return;}
    await store.read();
    // A read must never replace a newer page, an open dialog, or fresh input.
    if (sequence !== routeSequence || inputs !== inputSequence || currentView !== view || busy || modal.open || (!manual && dirty)) return;
    if (manual || revision !== store.revision) render();
    else updateChrome();
    if (manual) toast('已讀取最新庫存。');
  } catch (error) {
    if (sequence !== routeSequence || currentView !== view || busy) return;
    if (manual) toast(error.message || '暫時無法更新資料，請稍後再試。', true);
    else $('#connection-status').textContent = '連線暫時中斷 · 資料可能較舊';
  } finally {
    refreshing = false;
    if (manual) { button.disabled = false; button.removeAttribute('aria-busy'); }
  }
}

$('#refresh-button').addEventListener('click', () => {
  if (!ready) { location.reload(); return; }
  refreshCurrentView(true);
});
window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (event) => {
  if (dirty || modalDirty || busy) { event.preventDefault(); event.returnValue = ''; }
});

// Read-only refreshes keep navigation available and preserve unfinished input.
setInterval(() => refreshCurrentView(), 60000);

try {
  if (store.mode === 'google' && location.hash === '#admin') { /* The entry and summary do not wait for full histories. */ }
  else if (store.mode === 'google' && adminViews.has(location.hash.slice(1))) await store.readWarehouse();
  else await store.init();
  ready = true;
  await route();
  if (store.revalidateOnStart && !store.inWarehouse) refreshCurrentView();
} catch (error) {
  $('#connection-status').textContent = '資料尚未載入';
  $('#auth-button').hidden = true;
  main.innerHTML = `<div class="panel">${empty('暫時打不開飲料架', h(error.message), '<button class="button" onclick="location.reload()">重試</button>')}</div>`;
}
