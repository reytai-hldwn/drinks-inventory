import { escapeHtml as h, stockStatus } from './domain.js';
import { CATEGORIES_ORDER } from './catalog.js';
import { findProductPhoto } from './product-photos.js';

const FRIDGE_DOOR_TIMERS = new WeakMap();
const FRIDGE_CONTENT_ID = 'pantry-fridge-content';
const PANTRY_SCENE_ASSET = './assets/pantry-scene-approved.png';
const FRIDGE_OPEN_DURATION = 850;

// Browser viewBoxes crop the approved illustration without regenerating its
// furniture, lettering or logos. The controls and product photos remain HTML.
function sceneCrop(viewBox, className = '') {
  return `<svg class="${className}" viewBox="${viewBox}" aria-hidden="true" focusable="false"><image href="${h(PANTRY_SCENE_ASSET)}" width="1774" height="887"/></svg>`;
}

function renderPantryScene() {
  return `<div class="pantry-room" aria-hidden="true"><div class="pantry-office-scene">${sceneCrop('276 310 1074 560', 'pantry-scene-art')}<span class="pantry-door-recess"></span><span class="pantry-painted-door pantry-painted-door-upper-left">${sceneCrop('496 333 161 295')}</span><span class="pantry-painted-door pantry-painted-door-upper-right">${sceneCrop('658 368 132 249')}</span><span class="pantry-painted-door pantry-painted-door-lower-left">${sceneCrop('497 620 160 211')}</span><span class="pantry-painted-door pantry-painted-door-lower-right">${sceneCrop('658 613 132 191')}</span></div><div class="pantry-mobile-scene">${sceneCrop('1388 388 347 475', 'pantry-scene-art')}<span class="pantry-door-recess"></span><span class="pantry-painted-door pantry-painted-door-mobile">${sceneCrop('1473 485 176 304')}</span></div></div>`;
}
const FRIDGE_SHELF_LABELS = {
  '牛奶／豆漿': 'MILK & SOY', '大瓶飲料': 'BIG BOTTLE CORNER', 茶飲: 'TEA & INFUSIONS', 咖啡: 'COFFEE BREAK',
  果汁: 'A LITTLE FRUITY', 汽水: 'BUBBLES & JOY', 其他: 'EVERYDAY FAVORITES',
};

// Label artwork is separate from the full product name and inventory identity.
const FRIDGE_PACK_LABELS = new Map([
  ['光泉牛乳', ['光泉', '牛乳']],
  ['光泉巧克力牛乳', ['光泉', '巧克力', '牛乳']],
  ['立頓原味奶茶', ['立頓', '原味奶茶']],
  ['立頓巧克力奶茶', ['立頓', '巧克力奶茶']],
  ['立頓沁香奶綠', ['立頓', '沁香奶綠']],
  ['日月潭紅茶', ['日月潭', '紅茶']],
  ['tree top瓶果汁', ['蘋果汁']],
  ['光泉柳橙汁', ['光泉', '柳橙汁']],
  ['波利芭樂汁', ['波蜜', '芭樂汁']],
  ['波蜜芭樂汁', ['波蜜', '芭樂汁']],
  ['波蜜一日蔬果', ['波蜜', '一日蔬果']],
  ['一日蔬果100%蘋果柳橙蔬果汁', ['波蜜', '蘋果柳橙蔬果汁']],
  ['荔枝氣泡水', ['荔枝', '氣泡水']],
  ['零卡可口可樂', ['零卡', '可口可樂']],
  ['零卡百事可樂', ['零卡', '百事可樂']],
  ['Vida氣泡飲', ['Vida', '氣泡飲']],
  ['Milkiis水蜜桃', ['Milkis', '水蜜桃']],
  ['Milkis水蜜桃', ['Milkis', '水蜜桃']],
  ['Miilkis', ['Milkis']],
  ['Miiki', ['Milkis']],
  ['Milkis', ['Milkis']],
]);

function fridgePackName(name) {
  const lines = FRIDGE_PACK_LABELS.get(name);
  if (!lines) return `<strong>${h(name)}</strong>`;
  return `<strong class="pack-name-lines">${lines.map((line) => {
    const units = Array.from(line).reduce((total, char) => total + (char.charCodeAt(0) > 255 ? 1 : 0.62), 0) + 0.15;
    return `<span class="pack-name-line" style="--pack-line-units:${units.toFixed(2)}">${h(line)}</span>`;
  }).join('')}</strong>`;
}

function fridgeIconFor(category) {
  return ({ '牛奶／豆漿': '🥛', 茶飲: '🍵', 咖啡: '☕', 果汁: '🍊', 汽水: '🫧', 其他: '🌾' })[category] || '🧃';
}

/** Packaging is visual: a drawing never represents a number of containers. */
export function drinkPack(drink) {
  const photo = findProductPhoto(drink.name);
  const photoScale = drink.packaging === '小型鐵罐' ? 0.8 : 1;
  if (photo?.crop && photo.originalSize) {
    const [x, y, width, height] = photo.crop;
    const [originalWidth, originalHeight] = photo.originalSize;
    const scale = Math.min(84 / width, photo.height / height) * photoScale;
    const px = (value) => `${(value * scale).toFixed(3)}px`;
    const clip = photo.outline ? `;clip-path:polygon(${photo.outline.map(([pointX, pointY]) => `${((pointX - x) / width * 100).toFixed(4)}% ${((pointY - y) / height * 100).toFixed(4)}%`).join(',')})` : '';
    // The silhouette removes the background while the original pixels retain
    // white labels, silver cans and every printed detail inside the product.
    return `<div class="drink-pack-group drink-pack-group-photo"><span class="drink-photo-viewport" style="width:${px(width)};height:${px(height)}${clip}"><img class="drink-product-photo drink-product-photo-original" style="width:${px(originalWidth)};height:${px(originalHeight)};left:-${px(x)};top:-${px(y)}" src="${h(photo.src)}" alt="" aria-hidden="true" width="${originalWidth}" height="${originalHeight}" loading="lazy" decoding="async"></span></div>`;
  }
  if (photo) return `<div class="drink-pack-group drink-pack-group-photo"><img class="drink-product-photo${photo.height === 113 ? ' drink-product-photo-carton' : ''}" style="width:${84 * photoScale}px;height:${photo.height * photoScale}px" src="${h(photo.src)}" alt="" aria-hidden="true" width="${Math.round(84 * photoScale)}" height="${Math.round(photo.height * photoScale)}" loading="lazy" decoding="async"></div>`;
  let colors = ['#749b75', '#f2eedb', '#35513c'];
  if (/紅茶|蜜茶|烏龍/.test(drink.name)) colors = ['#a96740', '#f1e1bb', '#6b382c'];
  if (/奶|乳|豆|米漿/.test(drink.name)) colors = ['#dfc79e', '#fff6dc', '#7f5d3e'];
  if (drink.category === '咖啡') colors = ['#785541', '#f2debc', '#5a3c29'];
  if (drink.category === '果汁') colors = ['#e8ab45', '#fff0c1', '#96712b'];
  if (/可樂|沙士/.test(drink.name)) colors = ['#b35e4a', '#f5e6d7', '#813e32'];
  if (/雪碧|檸檬|氣泡/.test(drink.name)) colors = ['#92ac7a', '#f6f3ce', '#526d40'];
  if (/水|舒跑/.test(drink.name) && !/氣泡/.test(drink.name)) colors = ['#b7d5d5', '#f1f8ed', '#557b7f'];
  if (/^(?:Milkiis|Miilkis|Milkis)水蜜桃$/i.test(drink.name)) colors = ['#e4a4b8', '#fff0f3', '#8d435e'];

  const packagingClass = {
    '窄瓶鋁箔包': 'drink-pack-carton drink-pack-carton-narrow',
    '鋁箔包': 'drink-pack-carton',
    '鐵罐': 'drink-pack-can',
    '小型鐵罐': 'drink-pack-can drink-pack-can-small',
    '長鐵罐': 'drink-pack-can drink-pack-can-tall',
    '寶特瓶': 'drink-pack-bottle',
    '大瓶裝': 'drink-pack-bottle drink-pack-bottle-large',
    '其他': 'drink-pack-sachet',
  }[drink.packaging] || (drink.unit === '瓶' ? 'drink-pack-bottle' : drink.unit === '罐' ? 'drink-pack-can' : 'drink-pack-carton');

  return `<div class="drink-pack-group" style="--pack-color:${colors[0]};--pack-label:${colors[1]};--pack-ink:${colors[2]}"><div class="drink-pack ${packagingClass}" aria-hidden="true"><span class="pack-cap"></span><span class="pack-fold"></span><span class="pack-label">${fridgePackName(drink.name)}<b>${h(drink.icon || fridgeIconFor(drink.category))}</b></span></div></div>`;
}

function renderFridgeProduct(drink, showQuantities, dateLabel) {
  const status = showQuantities ? stockStatus(drink) : null;
  const classes = showQuantities
    ? `${status === 'low' ? ' is-low' : ''}${status === 'unknown' ? ' is-unknown' : ''}${status !== 'unknown' && drink.stock === 0 ? ' is-empty' : ''}`
    : '';
  const quantity = !showQuantities ? '' : `<span class="fridge-stock-badge">${status === 'unknown' ? '—' : drink.stock}<small>${h(drink.unit)}</small></span>`;
  const inventory = !showQuantities ? '' : `<span class="fridge-product-status">${status === 'unknown' ? '等待首次盤點' : status === 'low' ? '需要補貨' : '庫存充足'}</span><p>盤點 ${h(dateLabel(drink.lastCountAt))}</p>`;
  return `<article class="fridge-product${classes}" data-drink-id="${h(drink.id)}"><div class="fridge-product-stage">${drinkPack(drink)}${quantity}</div><div class="fridge-product-info"><h4>${h(drink.name)}</h4><p class="fridge-product-packaging">${h(drink.packaging || '飲料包裝')}</p>${inventory}</div><button type="button" class="fridge-product-edit" data-action="view-drink" data-id="${h(drink.id)}" aria-label="查看${h(drink.name)}飲料資訊"><span class="fridge-detail-arrow" aria-hidden="true"></span></button></article>`;
}

/** A bounded public display; inventory quantities are deliberately opt-in. */
export function renderFridge(drinks, { isOpen = false, lastInventoryAt = null, showQuantities = false, formatDate } = {}) {
  const dateLabel = typeof formatDate === 'function' ? formatDate : (value) => value || '尚未盤點';
  const shelfCategories = [...new Set([...CATEGORIES_ORDER, ...drinks.map((drink) => drink.category)])];
  const shelves = shelfCategories.map((name) => ({ name, drinks: drinks.filter((drink) => drink.category === name) })).filter((shelf) => shelf.drinks.length);
  const logoSrc = typeof document === 'undefined' ? '' : (document.querySelector('.brand-mark')?.getAttribute('src') || '');
  const logo = (className, size) => logoSrc ? `<img class="${className}" src="${h(logoSrc)}" alt="Holdwin Capital H 標誌" width="${size}" height="${size}">` : '';

  return `<div class="pantry-stage${isOpen ? ' is-open' : ''}">${renderPantryScene()}<div class="fridge${isOpen ? ' is-open is-ready' : ''}" data-door-state="${isOpen ? 'open' : 'closed'}" aria-label="飲料冰箱">
    <header class="fridge-crown"><div class="fridge-maker">${logo('fridge-maker-logo', 30)}<span>Holdwin Capital</span></div><button type="button" class="fridge-close" data-action="toggle-door" aria-controls="${FRIDGE_CONTENT_ID}" aria-expanded="${isOpen}"${isOpen ? '' : ' hidden'}>關上冰箱 <span aria-hidden="true">↶</span></button></header>
    <div class="fridge-window"><div class="fridge-interior" id="${FRIDGE_CONTENT_ID}" role="region" aria-label="飲料展示層架，可向下捲動" aria-hidden="${!isOpen}" tabindex="${isOpen ? '0' : '-1'}"${isOpen ? '' : ' inert'}><div class="fridge-light" aria-hidden="true"></div>${shelves.map((shelf, index) => `<section class="fridge-shelf" aria-label="${h(shelf.name)}飲料架"><div class="fridge-shelf-heading"><span class="shelf-index">0${index + 1}</span><h3>${h(shelf.name)}</h3>${showQuantities ? `<span class="shelf-count">${shelf.drinks.length} 種飲料</span>` : ''}</div><div class="fridge-products">${shelf.drinks.map((drink) => renderFridgeProduct(drink, showQuantities, dateLabel)).join('')}</div><div class="fridge-shelf-rail"><span>${h(FRIDGE_SHELF_LABELS[shelf.name] || 'PANTRY FAVORITES')}</span><i aria-hidden="true"></i><span class="shelf-rail-note">喜歡的，留一瓶給同事。</span></div></section>`).join('') || '<div class="empty-state"><h2>這一格還沒有飲料</h2><p>換個分類或關鍵字看看。</p></div>'}</div>
    <button type="button" class="fridge-door" data-action="toggle-door" aria-label="點擊打開冰箱門" aria-controls="${FRIDGE_CONTENT_ID}" aria-expanded="${isOpen}" aria-hidden="${isOpen}" tabindex="${isOpen ? '-1' : '0'}"${isOpen ? ' inert' : ''}><span class="sr-only">點我打開冰箱，看看今天，想喝哪一瓶。</span></button></div>
    </div></div><p class="fridge-scroll-cue"${isOpen ? '' : ' hidden'}>↓ 在冰箱裡往下滑，看更多飲料</p><p class="fridge-caption"${isOpen ? '' : ' hidden'}>點飲料可查看品項介紹。${showQuantities ? ` 最近完整盤點：${h(dateLabel(lastInventoryAt))}。` : ''}</p>`;
}

/** Changes only presentation and focus; never touches inventory or storage. */
export function syncFridgeDoor(element, isOpen) {
  if (!element) return;
  const previousTimer = FRIDGE_DOOR_TIMERS.get(element);
  if (previousTimer) clearTimeout(previousTimer);
  FRIDGE_DOOR_TIMERS.delete(element);
  const interior = element.querySelector('.fridge-interior');
  const door = element.querySelector('.fridge-door');
  const closeButton = element.querySelector('.fridge-close');
  if (!interior || !door || !closeButton) return;
  const cue = (element.closest('.fridge-panel') || element.parentElement)?.querySelector('.fridge-scroll-cue');
  const active = document.activeElement;
  const focusWasInside = interior.contains(active) || active === closeButton || active === door;

  element.classList.toggle('is-open', isOpen);
  element.closest('.pantry-stage')?.classList.toggle('is-open', isOpen);
  const panel = element.closest('.fridge-panel');
  panel?.classList.toggle('is-browsing', isOpen);
  const controls = panel?.querySelector(':scope > .toolbar');
  if (controls) controls.hidden = !isOpen;
  const caption = panel?.querySelector('.fridge-caption');
  if (caption) caption.hidden = !isOpen;
  element.classList.remove('is-ready');
  element.dataset.doorState = isOpen ? 'opening' : 'closed';
  closeButton.hidden = !isOpen;
  closeButton.setAttribute('aria-expanded', String(isOpen));
  door.setAttribute('aria-expanded', String(isOpen));

  // Move focus out before hiding its old ancestor from assistive technology.
  if (focusWasInside) (isOpen ? closeButton : door).focus({ preventScroll: true });
  interior.inert = true;
  interior.tabIndex = -1;
  interior.setAttribute('aria-hidden', 'true');
  door.inert = isOpen;
  door.tabIndex = isOpen ? -1 : 0;
  door.setAttribute('aria-hidden', String(isOpen));
  if (cue) cue.hidden = !isOpen;
  if (!isOpen) return;

  const finishOpening = () => {
    FRIDGE_DOOR_TIMERS.delete(element);
    if (!element.classList.contains('is-open')) return;
    element.classList.add('is-ready');
    element.dataset.doorState = 'open';
    interior.inert = false;
    interior.tabIndex = 0;
    interior.setAttribute('aria-hidden', 'false');
    if (document.activeElement === closeButton) interior.focus({ preventScroll: true });
  };
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) finishOpening();
  else FRIDGE_DOOR_TIMERS.set(element, setTimeout(finishOpening, FRIDGE_OPEN_DURATION));
}
