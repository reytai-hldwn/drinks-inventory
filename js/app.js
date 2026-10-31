import { escapeHtml as h, safeUrl, uid, number, getConsumption, stockStatus } from './domain.js';
import { InventoryStore } from './store.js';
import { CATEGORIES_ORDER } from './catalog.js';
import { drinkPack, renderFridge, syncFridgeDoor } from './fridge.js';
import { GoogleInventoryStore } from './google-store.js';

const store = window.DRINKS_CONFIG?.provider === 'google' ? new GoogleInventoryStore(window.DRINKS_CONFIG) : new InventoryStore(window.DRINKS_CONFIG);
const $ = (selector) => document.querySelector(selector);
const main = $('#main');
const modal = $('#modal');
const categories = CATEGORIES_ORDER;
const categoryNames = () => [...new Set([...categories, ...store.data.drinks.map((drink) => drink.category)])];
const activeDrinks = () => store.data.drinks.filter((drink) => drink.active !== false);
const packagingTypes = ['窄瓶鋁箔包', '鋁箔包', '鐵罐', '小型鐵罐', '長鐵罐', '寶特瓶', '大瓶裝', '其他'];
const viewNames = { overview: '飲料冰箱', wishes: '飲料許願池', 'snack-wishes': '點心許願池', archive: '歷史品項', admin: '管理後台', products: '倉庫庫存', count: '快速盤點', restock: '到貨入庫', 'manage-wishes': '願望管理', history: '異動紀錄' };
const adminViews = new Set(['admin', 'products', 'count', 'restock', 'manage-wishes', 'history']);
let view = 'overview';
let managedWishKind = 'drink';
const wishKind = (wish) => wish?.kind === 'snack' ? 'snack' : 'drink';
const currentWishKind = () => view === 'snack-wishes' ? 'snack' : view === 'manage-wishes' ? managedWishKind : 'drink';
let filter = 'all';
let query = '';
let category = '';
let display = 'fridge';
let fridgeOpen = false;
try { if (localStorage.getItem('holdwin-display') === 'list') display = 'list'; } catch { /* optional display preference */ }
let dirty = false;
let modalDirty = false;
let busy = false;
let ready = false;
let toastTimer;
let routeSequence = 0;

const formatDate = (value, time = false) => value ? new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', ...(time ? { year: 'numeric' } : {}), month: '2-digit', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
}).format(new Date(value)) : '尚未盤點';
const daysAgo = (date) => date ? Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 86400000)) : null;
const total = (items, field) => items.reduce((sum, item) => sum + item[field], 0);
const stockEvents = () => store.data.events.filter((event) => ['count', 'restock'].includes(event.type));
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
  document.querySelectorAll('[data-editor]').forEach((element) => { element.hidden = !inAdmin; });
  document.querySelectorAll('[data-front]').forEach((element) => { element.hidden = inAdmin; });
  document.querySelectorAll('nav [data-view]').forEach((element) => {
    element.classList.toggle('active', element.dataset.view === view);
    if (element.dataset.view === view) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  });
  $('#connection-status').textContent = `${store.mode === 'demo' ? '本機示範' : store.mode === 'google' ? 'Google 共用資料' : '共用資料'} · ${inAdmin ? '管理後台' : '前台瀏覽'}`;
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
  return stockStatus(drink) === 'low' ? '<span class="pill pill-low">10 以內，準備補貨</span>' : '<span class="pill pill-ok">庫存充足</span>';
}

function forecast(drink) {
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
  return `<div class="toolbar">${warehouse ? `<div class="filter-tabs" role="group" aria-label="倉庫篩選">${[['all', '供應中'], ['low', '10 以內'], ['archived', '歷史品項']].map(([value, label]) => `<button class="filter-tab ${filter === value ? 'selected' : ''}" data-filter="${value}" aria-pressed="${filter === value}">${label}</button>`).join('')}</div>` : `<span class="fridge-browse-label">${activeDrinks().length} 款辦公室小補給</span>`}<div class="search-controls"><label class="search-field"><span aria-hidden="true">⌕</span><input id="search" type="search" maxlength="80" placeholder="找找喜歡的飲料…" aria-label="搜尋飲料" value="${h(query)}"></label><select id="category-filter" aria-label="篩選飲料分類"><option value="">所有分類</option>${categoryNames().map((name) => `<option value="${h(name)}"${category === name ? ' selected' : ''}>${h(name)}</option>`).join('')}</select></div></div>`;
}

function renderOverview() {
  main.innerHTML = heading('OPEN A LITTLE HAPPINESS', '今天，喝點什麼？', '茶飲、咖啡，那些好喝的都在這') +
    `<section aria-labelledby="inventory-title"><div class="section-heading"><div><h2 id="inventory-title">點開冰箱，看看今天的小補給</h2><p>飲料展示不顯示餘量，許願與歷史品項都在下方選單。</p></div></div><div class="inventory-panel fridge-panel">${inventoryToolbar()}<div id="inventory-table"></div></div></section>`;
  renderInventoryTable();
}

function renderWarehouse() {
  const low = activeDrinks().filter((drink) => stockStatus(drink) === 'low').length;
  main.innerHTML = heading('WAREHOUSE INVENTORY', '倉庫庫存，補貨有依據', '數量來自實際盤點與後續入庫；10 包／瓶／罐以內標紅，未盤點的品項不當作缺貨。', `${button('↓ 匯出庫存', 'export', '', 'button-outline')}${store.canEdit ? button('＋ 新增品項', 'new-drink') : ''}`) +
    `<div class="admin-summary"><span>${activeDrinks().length} 種供應中</span><span class="warehouse-alert">${low} 種需要確認補貨</span><span>最近完整盤點 ${formatDate(store.data.lastInventoryAt)}</span></div><div class="inventory-panel">${inventoryToolbar(true)}<div id="inventory-table"></div></div>`;
  renderInventoryTable();
}

function renderInventoryTable() {
  const warehouse = view === 'products';
  const drinks = store.data.drinks.filter((drink) =>
    (warehouse && filter === 'archived' ? drink.active === false : drink.active !== false) &&
    (!warehouse || filter !== 'low' || stockStatus(drink) === 'low') &&
    (!category || drink.category === category) && (!query || drink.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  const target = $('#inventory-table');
  if (!drinks.length) { target.innerHTML = empty('這一格還沒有飲料', '換個分類或關鍵字看看。'); return; }
  if (!warehouse) {
    target.innerHTML = renderFridge(drinks, { isOpen: fridgeOpen, lastInventoryAt: store.data.lastInventoryAt, formatDate, showQuantities: false });
    return;
  }
  const copyBar = filter === 'low' ? `<div class="refill-copy-bar"><span>把需要補給的品項，整理給老闆娘。</span>${button('⧉ 複製補貨清單', 'copy-low', '', 'button-small button-outline')}</div>` : '';
  target.innerHTML = copyBar + `<div class="table-scroll"><table><thead><tr><th>飲料品項</th><th>分類／包裝</th><th>庫存餘量</th><th>補貨狀態</th><th>最近盤點</th><th>管理</th></tr></thead><tbody>${drinks.map((drink) => `<tr><td>${drinkCell(drink)}</td><td><span class="category-label">${h(drink.category)}</span><p class="cell-note">${h(drink.packaging || drink.unit)}</p></td><td><div class="stock-value ${stockStatus(drink) === 'low' && drink.active !== false ? 'low warehouse-low' : ''}">${drink.lastCountAt ? drink.stock : '—'}<small>${h(drink.unit)}</small></div></td><td>${drink.active === false ? '<span class="pill pill-muted">已停買，可重新上架</span>' : stockPill(drink)}</td><td><span class="cell-note">${formatDate(drink.lastCountAt)}</span></td><td>${store.canEdit ? `<button class="cell-action" data-action="edit-drink" data-id="${h(drink.id)}" aria-label="編輯${h(drink.name)}">編輯 ↗</button>` : '<a class="text-link" href="#restock">登記入庫 ↗</a>'}</td></tr>`).join('')}</tbody></table></div><div class="table-bottom"><span>顯示 ${drinks.length} 種飲料</span><span>歷史品項保留原本數量與紀錄</span></div>`;
}

function renderArchive() {
  const archived = store.data.drinks.filter((drink) => drink.active === false);
  main.innerHTML = heading('ONCE IN OUR PANTRY', '那些曾經喝過的', '曾經買過、目前暫停供應的飲料。想再喝到，可以到許願池留個願望。', '<a href="#wishes" class="button button-outline">♡ 我想許願</a>') +
    `<div class="archive-grid">${archived.length ? archived.map((drink) => `<article class="panel archive-card">${drinkPack(drink)}<h2>${h(drink.name)}</h2><p>${h(drink.category)} · ${h(drink.packaging || drink.unit)}</p><span class="pill pill-muted">歷史品項</span></article>`).join('') : `<div class="panel">${empty('每一款喜歡，都值得被記得', '品項停買後會收進這裡，不會刪掉以前的紀錄。')}</div>`}</div>`;
}

function renderGoogleLink(url, label) {
  const safe = safeUrl(url);
  return safe ? `<a class="button" href="${h(safe)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>` : '<p class="subtle">連結尚未設定，請由管理者完成 Google 串接。</p>';
}

function renderGoogleEntry() {
  const count = view === 'count';
  main.innerHTML = heading('KEEP THE PANTRY READY', count ? '幫飲料架點個名' : '到貨了，記一筆就好', '免登入，填寫登記人與實際數量，送出後就會留下時間與紀錄。') +
    `<section class="panel form-panel"><h2>${count ? '登記實際盤點' : '登記到貨入庫'}</h2><p class="page-description">${count ? '一次確認目前供應品項的實際剩餘數量。' : '只登記這次實際收到的單包／瓶／罐數量。'}Google 表單內的「登記人」為必填。送出後回來重新整理，即可查看更新的庫存。</p><div class="form-actions">${renderGoogleLink(count ? store.formUrls.stocktake : store.formUrls.arrival, count ? '填寫盤點表單' : '填寫入庫表單')}<a href="#products" class="button button-outline">查看倉庫庫存</a></div></section>`;
}

function openDrinkDetails(id) {
  const drink = drinkById(id);
  if (!drink) return;
  if (!store.canEdit) {
    showModal(h(drink.name), '公司的飲料小補給。想喝其他口味，也可以到許願池告訴我們。', `<div class="drink-detail-hero">${drinkPack(drink)}<div><span class="category-label">${h(drink.category)}</span><p class="subtle">${h(drink.packaging || drink.unit)}</p></div></div><div class="form-actions">${button('關閉', 'close-modal', 'type="button"', 'button-outline')}</div>`);
    return;
  }
  const arrival = store.data.events.filter((event) => event.type === 'restock' && event.drinkId === id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  showModal(h(drink.name), '庫存以最近一次盤點與後續入庫為準，日常取用尚未扣除。', `<div class="drink-detail-hero">${drinkPack(drink)}<div><span class="subtle">目前紀錄庫存</span><div class="stat-number">${drink.lastCountAt ? drink.stock : '待盤點'}<small>${h(drink.unit)}</small></div>${stockPill(drink)}</div></div><dl class="drink-facts"><div><dt>最近實際盤點</dt><dd>${formatDate(drink.lastCountAt, true)}</dd></div><div><dt>最近到貨入庫</dt><dd>${arrival ? `${formatDate(arrival.createdAt, true)} · ＋${arrival.quantity} ${h(drink.unit)}` : '尚無紀錄'}</dd></div><div><dt>包裝換算</dt><dd>每箱 ${drink.perCase} ${h(drink.unit)}</dd></div><div><dt>補貨提醒</dt><dd>低於 ${drink.threshold} ${h(drink.unit)}</dd></div><div><dt>消耗與補貨估算</dt><dd>${forecast(drink)}</dd></div></dl><div class="form-actions">${button('關閉', 'close-modal', 'type="button"', 'button-outline')}${store.canEdit ? button('編輯品項', 'edit-drink', `data-id="${h(drink.id)}" type="button"`) : ''}</div>`);
}

async function copyLowStock() {
  const drinks = activeDrinks().filter((drink) => stockStatus(drink) === 'low' && (!category || drink.category === category) && (!query || drink.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).sort((a, b) => a.stock - b.stock);
  if (!drinks.length) { toast('目前沒有低於提醒門檻的飲料。'); return; }
  const message = [
    '宏穩茶水間｜補貨參考清單',
    `整理日期：${formatDate(new Date().toISOString(), true)}`,
    '以下依最近盤點與後續入庫紀錄，採購前請先確認現場數量。',
    '',
    ...drinks.map((drink) => `・${drink.name}：剩 ${drink.stock} ${drink.unit}（提醒門檻 ${drink.threshold} 以內 ${drink.unit}；盤點 ${formatDate(drink.lastCountAt, true)}）`),
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
  const drinks = activeDrinks();
  main.innerHTML = heading('A FRESH COUNT', '幫飲料架點個名', '每三天或一週盤點一次，就很夠用了。請填實際剩餘的單瓶／單罐數量。') +
    '<div class="info-box">請實際清點每一項。按下儲存表示已確認全部品項，即使數量沒變，也會留下新的盤點紀錄。只計算現場實際剩餘的飲料。</div>' +
    (drinks.length ? `<form id="count-form">${recorderField()}<div class="panel table-scroll"><table class="count-table"><thead><tr><th>飲料品項</th><th>上次帳面庫存</th><th>這次實際盤點</th></tr></thead><tbody>${drinks.map((drink) => `<tr><td>${drinkCell(drink)}</td><td><span class="muted">${drink.lastCountAt ? `${drink.stock} ${h(drink.unit)}` : '尚未盤點'}</span></td><td><input class="count-input" type="number" inputmode="numeric" min="0" max="999999" step="1" required name="${h(drink.id)}" value="${drink.lastCountAt ? drink.stock : ''}" aria-label="${h(drink.name)}實際剩餘數量"><span class="count-unit">${h(drink.unit)}</span></td></tr>`).join('')}</tbody></table></div><div class="sticky-actions"><span>本次確認全部 ${drinks.length} 種飲料</span><button type="submit" class="button">✓ 儲存本次盤點</button></div></form>` : `<div class="panel">${empty('還沒有飲料品項', '先新增品項，下一步就可以盤點了。', button('＋ 新增品項', 'new-drink'))}</div>`);
}

function renderRestock() {
  const drinks = activeDrinks();
  const arrivals = store.data.events.filter((event) => event.type === 'restock')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);
  const options = [...drinks].sort((a, b) => (stockStatus(a) === 'low' ? -1 : 1) - (stockStatus(b) === 'low' ? -1 : 1));
  main.innerHTML = heading('A LITTLE REFILL', '到貨了，記一筆就好', '收到多少就記多少，入庫後立即加到帳面庫存，並自動留下時間與數量。') +
    '<div class="info-box">只登記已實際收到的飲料。可輸入整箱或單包／瓶／罐，每個品項依自己的箱裝數量換算；分批到貨就分次登記。</div>' +
    (drinks.length ? `<div class="restock-layout"><section class="panel form-panel"><h2>登記到貨入庫</h2><form id="restock-form">${recorderField()}<label class="field">飲料品項<select name="drinkId" id="restock-drink">${options.map((drink) => `<option value="${h(drink.id)}">${h(drink.name)}${stockStatus(drink) === 'low' ? ' · 需要補貨' : ''}</option>`).join('')}</select></label><div class="form-grid"><label class="field">整箱數量<input name="cases" type="number" inputmode="numeric" min="0" max="9999" step="1" value="0" required></label><label class="field"><span id="loose-label">另外的單包／瓶／罐</span><input name="loose" type="number" inputmode="numeric" min="0" max="999999" step="1" value="0" required><small id="loose-hint">不足整箱也可登記</small></label></div><label class="field">備註（選填）<input name="note" maxlength="200" placeholder="例如：下午到貨、分批入庫"></label><div id="restock-summary" class="order-summary"></div><div class="form-actions"><button type="submit" class="button" id="restock-submit">確認到貨入庫</button></div><p class="subtle">儲存時會自動記錄本次入庫時間。</p></form></section><section><div class="section-heading"><h2>最近入庫紀錄</h2><a href="#history" class="text-link">完整紀錄 ↗</a></div><div class="panel">${arrivals.length ? arrivals.map((event) => {
      const drink = drinkById(event.drinkId);
      return `<article class="order-card"><div class="order-card-top"><div><h3>${h(drink?.name || '已封存品項')}</h3><span class="cell-note">${formatDate(event.createdAt, true)} · ${h(event.recorder || '未記錄登記人')}</span></div><span class="pill pill-ok">＋${event.quantity} ${h(drink?.unit || '個')}</span></div>${event.note ? `<p>${h(event.note)}</p>` : ''}</article>`;
    }).join('') : empty('還沒有入庫紀錄', '第一次到貨登記後，時間與數量會自動記在這裡。')}</div></section></div>` : `<div class="panel">${empty('先把飲料加入清單', '每個品項設定好每箱數量後，就可以快速登記入庫。', button('＋ 新增品項', 'new-drink'))}</div>`);
  if (drinks.length) updateRestockSummary();
}

function updateRestockSummary() {
  const form = $('#restock-form');
  if (!form) return;
  const drink = drinkById(form.elements.drinkId.value);
  const quantity = Math.max(0, Number(form.elements.cases.value) || 0) * drink.perCase + Math.max(0, Number(form.elements.loose.value) || 0);
  $('#loose-label').textContent = `另外的單${drink.unit}數量`;
  $('#loose-hint').textContent = `以${drink.unit}為單位，不足整箱也可登記`;
  $('#restock-summary').innerHTML = `${drink.perCase ? `每箱 <strong>${drink.perCase} ${h(drink.unit)}</strong>` : '每箱數量待設定，請先登記單包／瓶／罐'} · 目前帳面庫存 <strong>${drink.stock} ${h(drink.unit)}</strong>${drink.lastCountAt ? '' : '（尚未首次盤點）'}<br>本次入庫：<strong>${quantity} ${h(drink.unit)}</strong><br>入庫後帳面庫存：<strong>${drink.stock + quantity} ${h(drink.unit)}</strong>`;
}

const wishStatus = (status) => ({ pending: ['待評估', 'pill-low'], purchased: ['已採購', 'pill-ok'], declined: ['暫不採購', 'pill-muted'] })[status] || ['待評估', 'pill-low'];
function renderWishes() {
  const kind = currentWishKind();
  const label = kind === 'snack' ? '點心' : '飲料';
  const wishes = store.data.wishes.filter((wish) => wishKind(wish) === kind).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const tabs = `<div class="wish-pool-tabs" role="group" aria-label="選擇許願池">${[['drink', '飲料許願池'], ['snack', '點心許願池']].map(([value, title]) => view === 'manage-wishes' ? `<button type="button" class="filter-tab${kind === value ? ' selected' : ''}" data-action="wish-pool" data-id="${value}" aria-pressed="${kind === value}">${title}</button>` : `<a href="#${value === 'snack' ? 'snack-wishes' : 'wishes'}"${kind === value ? ' aria-current="page"' : ''}>${title}</a>`).join('')}</div>`;
  main.innerHTML = heading('SOMETHING TO LOOK FORWARD TO', `${label}許願池`, `留下想${kind === 'snack' ? '吃' : '喝'}的好選擇，讓下一次採購多一點期待。`, button('♡ 新增願望', 'new-wish')) + tabs +
    '<div class="info-box">許願不用填姓名；按「我也喜歡」時請填寫姓名。' + (store.mode === 'google' ? '贊同表單送出後，回來重新整理就能看到人數。' : '同一個瀏覽器對每個願望可贊同一次。') + '</div>' +
    (wishes.length ? `<div class="wish-grid">${wishes.map((wish) => {
      const [label, style] = wishStatus(wish.status);
      const url = safeUrl(wish.url);
      const voted = store.mode === 'demo' && store.hasVoted(wish.id);
      const votes = Number.isSafeInteger(wish.votes) && wish.votes >= 0 ? wish.votes : 0;
      const unavailable = store.mode === 'google' && (!store.voteForm?.url || !store.voteForm?.voterNameEntryId);
      return `<article class="panel wish-card" data-wish-id="${h(wish.id)}"><div class="wish-top"><span class="wish-icon" aria-hidden="true">♡</span><span class="pill ${style}">${label}</span></div><h2>${h(wish.name)}</h2><p>${h(wish.note || '一個值得試試的新選擇。')}</p>${url ? `<a href="${h(url)}" target="_blank" rel="noopener noreferrer" class="text-link">看看這款${kind === 'snack' ? '點心' : '飲料'} ↗</a>` : '<span class="subtle">尚未附上購買連結</span>'}<div class="wish-vote-row"><button class="wish-vote-button${voted ? ' is-voted' : ''}" data-action="vote-wish" data-id="${h(wish.id)}" aria-pressed="${voted}"${voted || unavailable ? ' disabled' : ''}${unavailable ? ' title="請先更新 Google 贊同表單，加入必填姓名欄位"' : ''}>${voted ? '♥ 已贊同' : '♡ 我也喜歡'}</button><span class="wish-vote-count" aria-live="polite">${votes} 人喜歡</span></div><div class="wish-bottom"><span class="wish-date">${formatDate(wish.createdAt)} 加入許願池</span>${store.canEdit ? `<button class="cell-action" data-action="edit-wish" data-id="${h(wish.id)}">管理願望 ↗</button>` : ''}</div></article>`;
    }).join('')}</div>` : `<div class="panel">${empty(`第一個${label}願望，會是什麼？`, '匿名許願，可附上購買連結和備註。', button('♡ 新增願望', 'new-wish'))}</div>`);
}

function renderHistory() {
  const events = stockEvents().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  main.innerHTML = heading('EVERY LITTLE CHANGE', '每一次補給，都有跡可循', '保留實際盤點與到貨入庫紀錄，慢慢累積屬於公司的飲料喜好。', button('↓ 匯出紀錄', 'export-history', '', 'button-outline')) +
    `<div class="panel">${events.length ? `<div class="table-scroll"><table><thead><tr><th>時間</th><th>飲料品項</th><th>異動</th><th>數量</th><th>登記人</th><th>備註</th></tr></thead><tbody>${events.slice(0, 200).map((event) => {
      const drink = drinkById(event.drinkId);
      const type = event.type === 'count' ? '盤點' : '入庫';
      return `<tr><td class="cell-note">${formatDate(event.createdAt, true)}</td><td>${h(drink?.name || '已封存品項')}</td><td><span class="history-type history-${h(event.type)}">${type}</span></td><td class="history-number">${event.type === 'restock' ? '＋' : ''}${event.quantity} ${h(drink?.unit || '個')}</td><td class="subtle">${h(event.recorder || '未記錄')}</td><td class="subtle">${h(event.note || '—')}</td></tr>`;
    }).join('')}</tbody></table></div><div class="table-bottom"><span>顯示最近 ${Math.min(events.length, 200)} 筆，共 ${events.length} 筆</span><span>匯出可取得完整紀錄</span></div>` : empty('還沒有異動紀錄', '第一次盤點或補貨之後，紀錄會自動留在這裡。')}</div>`;
}

function renderAdmin() {
  const low = activeDrinks().filter((drink) => stockStatus(drink) === 'low').length;
  const pending = store.data.wishes.filter((wish) => wish.status === 'pending').length;
  main.innerHTML = heading('PANTRY MANAGEMENT', '把補給的小事，整理好', '免登入管理。每次盤點或登記到貨，請填寫登記人，方便之後核對。') +
    `<div class="admin-summary"><span>目前 ${store.data.drinks.length} 種飲料</span><span>${low} 種在 10 以內</span><span>${pending} 個願望待評估</span></div><div class="admin-grid">${[
      ['count', '☷', '快速盤點', '每三天或一週，輸入所有品項的實際剩餘數量。', '開始盤點'],
      ['restock', '↗', '到貨入庫', '收到飲料再登記，時間、數量與庫存一併保存。', '登記入庫'],
      ['products', '▦', '倉庫庫存與歷史品項', '查看實際庫存，確認哪些品項需要補貨。', '查看庫存'],
      ['manage-wishes', '♡', '大家的願望', '看看同事想喝的飲料、想吃的點心，以及大家的贊同。', '查看願望'],
      ['history', '◷', '異動紀錄', '查看實際盤點、入庫時間與數量，並匯出備份。', '查看紀錄'],
    ].map(([href, icon, title, description, cta]) => `<a href="#${href}" class="admin-card"><span class="admin-card-icon" aria-hidden="true">${icon}</span><h2>${title}</h2><p>${description}</p><span class="admin-card-cta">${cta} ↗</span></a>`).join('')}</div>`;
}

function render() {
  store.preview = !adminViews.has(view);
  dirty = false;
  updateChrome();
  if (adminViews.has(view) && !store.canManage && !store.canEdit) {
    main.innerHTML = heading('EDITOR ACCESS', '這裡留給庫存管理者', '同事可以直接查看庫存與許願清單，修改資料需要登入。') + `<div class="panel">${empty('登入後繼續', '只有獲授權的帳號可以修改庫存。', button('管理員登入', 'login'))}</div>`;
    return;
  }
  if (store.mode === 'google' && ['count', 'restock'].includes(view)) { renderGoogleEntry(); return; }
  ({ overview: renderOverview, products: renderWarehouse, archive: renderArchive, admin: renderAdmin, count: renderCount, restock: renderRestock, wishes: renderWishes, 'snack-wishes': renderWishes, 'manage-wishes': renderWishes, history: renderHistory })[view]();
}

async function route() {
  if (!ready) return;
  const next = location.hash.slice(1) || 'overview';
  const nextView = Object.hasOwn(viewNames, next) ? next : 'overview';
  if (dirty && nextView !== view && !confirm('這一頁還有未儲存的輸入，確定要離開嗎？')) {
    history.replaceState(null, '', `#${view}`);
    return;
  }
  view = nextView;
  const sequence = ++routeSequence;
  if (store.mode === 'google') {
    updateChrome();
    main.innerHTML = '<div class="loading-state"><span class="loader"></span><p>正在讀取共用資料…</p></div>';
    try { await (adminViews.has(view) ? store.readWarehouse() : store.readPublic()); }
    catch (error) {
      if (sequence !== routeSequence) return;
      main.innerHTML = `<div class="panel">${empty('暫時無法讀取資料', h(error.message), button('重新讀取', 'retry-route'))}</div>`;
      return;
    }
  }
  if (sequence !== routeSequence) return;
  render();
}

function showModal(title, description, content) {
  modalDirty = false;
  $('#modal-content').innerHTML = `<div class="modal-heading"><div><h2 id="modal-title">${title}</h2><p>${description}</p></div><button class="close-button" data-action="close-modal" aria-label="關閉視窗">×</button></div>${content}<div id="modal-error" class="modal-error" role="alert" hidden></div>`;
  modal.showModal();
}

function openLogin() {
  if (store.mode === 'demo') { location.hash = 'admin'; if (view === 'admin') render(); return; }
  showModal('歡迎回到茶水間', '使用獲授權的管理者帳號登入。帳號由公司管理者建立，不開放自行註冊。', `<form id="login-form"><div class="form-grid"><label class="field full-width">電子郵件<input type="email" name="email" required autocomplete="username" maxlength="254"></label><label class="field full-width">密碼<input type="password" name="password" required autocomplete="current-password"></label></div><div class="form-actions"><button class="button" type="submit">登入編輯</button></div></form>`);
}

function openDrink(id) {
  const drink = drinkById(id);
  showModal(drink ? '編輯飲料與供應狀態' : '讓飲料架多一個選擇', '停買可收進歷史品項，原本庫存與入庫紀錄仍會保留。', `<form id="drink-form" data-id="${h(id || '')}"><div class="form-grid"><label class="field full-width">飲料名稱<input name="name" required maxlength="80" value="${h(drink?.name || '')}"></label><label class="field">飲料分類<select name="category">${categoryNames().map((name) => `<option value="${h(name)}"${drink?.category === name ? ' selected' : ''}>${h(name)}</option>`).join('')}</select></label><label class="field">包裝外觀<select name="packaging">${packagingTypes.map((type) => `<option value="${h(type)}"${drink?.packaging === type ? ' selected' : ''}>${h(type)}</option>`).join('')}</select></label><label class="field">單個計算單位<select name="unit">${['包', '瓶', '罐'].map((unit) => `<option${drink?.unit === unit ? ' selected' : ''}>${unit}</option>`).join('')}</select></label><label class="field">供應狀態<select name="active"><option value="true"${drink?.active !== false ? ' selected' : ''}>目前供應</option><option value="false"${drink?.active === false ? ' selected' : ''}>歷史品項（停買）</option></select></label><label class="field">每箱數量（可稍後填）<input type="number" inputmode="numeric" min="1" max="9999" step="1" name="perCase" placeholder="待設定" value="${drink?.perCase ?? ''}"><small>未設定時，只登記單包／瓶／罐入庫</small></label><label class="field">補貨提醒門檻<input type="number" inputmode="numeric" min="1" max="999999" step="1" name="threshold" required value="${drink?.threshold ?? 10}"><small>剩餘此數量以內標紅，包含此數量</small></label><label class="field full-width">補貨目標庫存（選填）<input type="number" inputmode="numeric" min="1" max="999999" step="1" name="target" placeholder="待設定" value="${drink?.target ?? ''}"></label></div><div class="form-actions">${button('取消', 'close-modal', 'type="button"', 'button-outline')}<button class="button" type="submit">儲存品項</button></div></form>`);
}

function openWish(id) {
  const wish = store.data.wishes.find((item) => item.id === id);
  const kind = wish ? wishKind(wish) : currentWishKind();
  const label = kind === 'snack' ? '點心' : '飲料';
  if (store.mode === 'google') {
    showModal(`到 Google 表單許個${label}願望`, '許願不需要填姓名。送出後回到這裡重新整理，即可看到更新。', `<div class="form-actions">${renderGoogleLink(store.getWishUrl(kind), `開啟${label}許願表單`)}${button('關閉', 'close-modal', 'type="button"', 'button-outline')}</div>`);
    return;
  }
  showModal(wish ? '管理這個小願望' : `下一次，想要什麼${label}？`, '匿名許願，附上產品連結，下一次採購就能輕鬆找到。', `<form id="wish-form" data-id="${h(id || '')}"><input type="hidden" name="kind" value="${kind}"><div class="form-grid"><label class="field full-width">${label}名稱<input name="name" required maxlength="80" value="${h(wish?.name || '')}" placeholder="${kind === 'snack' ? '例如：海鹽蘇打餅乾' : '例如：無糖氣泡水'}"></label><label class="field full-width">購買或產品連結（選填）<input name="url" type="url" maxlength="2000" placeholder="https://…" value="${h(wish?.url || '')}"></label><label class="field full-width">許願備註（選填）<textarea name="note" maxlength="500" placeholder="口味、偏好、想試試的原因…">${h(wish?.note || '')}</textarea></label>${wish ? `<label class="field full-width">採購狀態<select name="status">${[['pending', '待評估'], ['purchased', '已採購'], ['declined', '暫不採購']].map(([value, title]) => `<option value="${value}"${wish?.status === value ? ' selected' : ''}>${title}</option>`).join('')}</select></label>` : '<p class="subtle full-width">新願望會先列為「待評估」，由管理者更新進度。</p>'}</div><div class="form-actions">${wish ? button('刪除願望', 'delete-wish', `type="button" data-id="${h(id)}"`, 'button-danger') : ''}${button('取消', 'close-modal', 'type="button"', 'button-outline')}<button class="button" type="submit">儲存願望</button></div></form>`);
}

function openVote(id) {
  const wish = store.data.wishes.find((item) => item.id === id);
  if (!wish) throw new Error('找不到這個願望，請重新整理後再試。');
  showModal('這個，我也喜歡', `支持「${h(wish.name)}」前，請填寫姓名。姓名不會顯示在公開願望卡片。`, `<form id="vote-form" data-id="${h(id)}"><label class="field">姓名<input name="voterName" required maxlength="80" autocomplete="name" placeholder="請填寫姓名"></label><div class="form-actions">${button('取消', 'close-modal', 'type="button"', 'button-outline')}<button class="button" type="submit">${store.mode === 'google' ? '繼續到贊同表單' : '送出贊同'}</button></div></form>`);
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
  if (form.id === 'login-form') {
    await store.login(values.get('email').trim(), values.get('password'));
    modalDirty = false;
    modal.close();
    if (!adminViews.has(view)) { location.hash = 'admin'; }
    else render();
    toast('登入成功，可以開始整理飲料架了。');
    return;
  }
  if (form.id === 'vote-form') {
    const voterName = String(values.get('voterName') || '').trim();
    if (!voterName || voterName.length > 80) throw new Error('請填寫姓名，最多 80 字。');
    if (store.mode === 'google') {
      const url = store.getVoteUrl(form.dataset.id, voterName);
      showModal('送出這份喜歡', '姓名已預填。請送出 Google 贊同表單，再回來重新整理查看人數；同一瀏覽器重複送出不會多加票。', `<div class="form-actions">${renderGoogleLink(url, '開啟贊同表單')}${button('關閉', 'close-modal', 'type="button"', 'button-outline')}</div>`);
    } else {
      await store.voteWish(form.dataset.id, voterName);
      modalDirty = false;
      modal.close();
      renderWishes();
      toast('已記下你的贊同！');
    }
    return;
  }
  if (form.id === 'wish-form' && !form.dataset.id) {
    await store.submitWish({ kind: values.get('kind'), name: values.get('name').trim(), url: values.get('url').trim(), note: values.get('note').trim() });
    modalDirty = false;
    modal.close();
    render();
    toast('願望已送出，等管理者下次採購時評估。');
    return;
  }
  if (!store.canEdit) throw new Error('請從管理入口使用對應的登記表單。');
  const next = clone();
  const now = new Date().toISOString();
  const recorder = String(values.get('recorder') || '').trim();
  if (['count-form', 'restock-form'].includes(form.id) && (!recorder || recorder.length > 80)) throw new Error('請填寫登記人，最多 80 字。');
  if (form.id === 'count-form') {
    for (const drink of next.drinks.filter((item) => item.active !== false)) {
      const quantity = number(values.get(drink.id));
      addEvent(next, 'count', drink, quantity, now, '定期盤點', recorder);
      drink.stock = quantity;
      drink.lastCountAt = now;
    }
    next.lastInventoryAt = now;
    await save(next, `已完成 ${activeDrinks().length} 種飲料的盤點，辛苦了！`);
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
    if (!name) throw new Error('請填寫飲料名稱。');
    const kind = values.get('kind');
    if (!['drink', 'snack'].includes(kind)) throw new Error('請選擇飲料或點心許願池。');
    const updates = { kind, name, url, note: values.get('note').trim(), status: values.get('status') };
    const existing = next.wishes.find((wish) => wish.id === form.dataset.id);
    if (existing) Object.assign(existing, updates);
    else next.wishes.push({ id: uid(), ...updates, createdAt: now });
    await save(next, '小願望已經好好記下來了。', true);
  } else if (form.id === 'restock-form') {
    const drink = next.drinks.find((item) => item.id === values.get('drinkId'));
    const cases = number(values.get('cases'));
    const loose = number(values.get('loose'));
    if (cases > 0 && !drink.perCase) throw new Error('此品項尚未設定每箱數量，請先設定，或改以單包／瓶／罐數量入庫。');
    const quantity = cases * (drink.perCase || 0) + loose;
    if (!quantity) throw new Error('請輸入大於 0 的數量。');
    if (quantity > 999999 || drink.stock + quantity > 999999) throw new Error('單次或累計數量不可超過 999,999，請確認輸入。');
    const note = values.get('note').trim();
    addEvent(next, 'restock', drink, quantity, now, note || '到貨入庫', recorder);
    drink.stock += quantity;
    await save(next, `已入庫 ${quantity} ${drink.unit}，庫存與入庫時間已記錄。`);
  }
}

async function runAction(action, id) {
  if (action === 'close-modal') {
    if (modalDirty && !confirm('視窗內還有未儲存的輸入，確定關閉嗎？')) return;
    modalDirty = false;
    modal.close();
    return;
  }
  if (action === 'login') { openLogin(); return; }
  if (action === 'retry-route') { await route(); return; }
  if (action === 'wish-pool') { managedWishKind = id === 'snack' ? 'snack' : 'drink'; renderWishes(); return; }
  if (action === 'vote-wish') { openVote(id); return; }
  if (action === 'view-drink') { openDrinkDetails(id); return; }
  if (action === 'copy-low') { if (!store.canManage && !store.canEdit) throw new Error('請從倉庫管理產生補貨清單。'); await copyLowStock(); return; }
  if (action === 'toggle-door') { fridgeOpen = !fridgeOpen; syncFridgeDoor($('.fridge'), fridgeOpen); return; }
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
    ['時間（台北）', '飲料品項', '類型', '數量', '原帳面庫存', '單位', '登記人', '備註'],
    ...stockEvents().map((event) => [formatDate(event.createdAt, true), drinkById(event.drinkId)?.name || event.drinkId,
      event.type === 'count' ? '盤點' : '入庫',
      event.quantity, event.previousStock, drinkById(event.drinkId)?.unit || '', event.recorder || '未記錄', event.note]),
  ] : [
    ['飲料名稱', '分類', '帳面庫存', '單位', '每箱數量', '提醒門檻', '目標庫存', '最近盤點（台北）'],
    ...store.data.drinks.map((drink) => [drink.name, drink.category, drink.stock, drink.unit, drink.perCase, drink.threshold, drink.target, formatDate(drink.lastCountAt, true)]),
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
  buttons.forEach((item) => { item.disabled = true; });
  try { await task(); }
  catch (error) {
    if (modal.open && $('#modal-error')) {
      $('#modal-error').textContent = error.message;
      $('#modal-error').hidden = false;
    } else toast(error.message || '操作失敗，請稍後再試。', true);
    updateChrome();
  } finally { buttons.forEach((item) => { item.disabled = false; }); busy = false; }
}

document.addEventListener('click', (event) => {
  if (busy && event.target.closest('a[href^="#"]')) { event.preventDefault(); return; }
  const action = event.target.closest('[data-action]');
  if (action) {
    event.preventDefault();
    if (['close-modal', 'new-drink', 'edit-drink', 'new-wish', 'edit-wish', 'vote-wish', 'login', 'view-drink', 'toggle-door'].includes(action.dataset.action)) {
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
  if (event.target.closest('dialog form')) modalDirty = true;
  if (event.target.id === 'search') { query = event.target.value.trim(); renderInventoryTable(); }
  else if (event.target.closest('main form')) { dirty = true; }
  if (event.target.closest('#restock-form')) updateRestockSummary();
});
document.addEventListener('change', (event) => {
  if (event.target.closest('dialog form')) modalDirty = true;
  if (event.target.id === 'category-filter') { category = event.target.value; renderInventoryTable(); }
  else if (event.target.closest('#restock-form')) { dirty = true; updateRestockSummary(); }
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
$('#refresh-button').addEventListener('click', () => {
  if (!ready) { location.reload(); return; }
  if (dirty && !confirm('重新讀取會捨棄未儲存的輸入，確定繼續嗎？')) return;
  withBusy(async () => { await store.read(); render(); toast('已讀取最新庫存。'); }, $('#refresh-button'));
});
window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (event) => {
  if (dirty || modalDirty || busy) { event.preventDefault(); event.returnValue = ''; }
});

// Refresh public views only; never replace an editor's unfinished form.
setInterval(async () => {
  if (!ready || busy || dirty || modal.open || !['overview', 'wishes', 'snack-wishes', 'history'].includes(view) || document.hidden) return;
  busy = true;
  try {
    const revision = store.revision;
    await store.read();
    if (revision !== store.revision) render();
    else updateChrome();
  } catch { $('#connection-status').textContent = '連線暫時中斷 · 資料可能較舊'; }
  finally { busy = false; }
}, 60000);

try {
  await store.init();
  ready = true;
  route();
} catch (error) {
  $('#connection-status').textContent = '資料尚未載入';
  $('#auth-button').hidden = true;
  main.innerHTML = `<div class="panel">${empty('暫時打不開飲料架', h(error.message), '<button class="button" onclick="location.reload()">重試</button>')}</div>`;
}
