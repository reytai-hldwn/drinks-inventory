import { escapeHtml as h, stockStatus } from './domain.js';
import { CATEGORIES_ORDER } from './catalog.js';
import { findProductPhoto } from './product-photos.js';

const FRIDGE_DOOR_TIMERS = new WeakMap();
const FRIDGE_CONTENT_ID = 'pantry-fridge-content';
const PANTRY_SCENE_ASSET = './assets/pantry-mobile.webp';
const FRIDGE_OPEN_DURATION = 850;
const OFFICE_OPEN_DURATION = 650;
const OFFICE_SCENES = {
  wide: {
    src: './assets/pantry-office-wide.png', width: 1672, height: 941,
    hit: [443, 188, 210, 506], guide: [225, 250, 330, 140], guideTip: [505, 335],
    recess: [[452, 199], [641, 210], [641, 663], [452, 687]],
    doors: [
      [[464, 212], [550, 218], [550, 472], [464, 474]],
      [[554, 218], [636, 224], [636, 467], [554, 472]],
      [[464, 485], [550, 482], [550, 670], [464, 679]],
      [[554, 482], [636, 477], [636, 654], [554, 669]],
    ],
  },
  portrait: {
    src: './assets/pantry-office-portrait.png', width: 1122, height: 1402,
    hit: [286, 438, 177, 490], guide: [65, 495, 300, 140], guideTip: [340, 580],
    recess: [[298, 454], [449, 464], [449, 897], [298, 919]],
    doors: [
      [[302, 466], [372, 470], [372, 726], [302, 727]],
      [[376, 471], [445, 477], [445, 718], [376, 725]],
      [[302, 737], [372, 734], [372, 905], [302, 915]],
      [[376, 733], [445, 726], [445, 892], [376, 905]],
    ],
  },
};
let fridgeSceneObserver;

/** Keep the illustration and its door hit area in the same coordinate system
 *  when the available height changes, including after fonts load or a resize. */
export function syncFridgeScene(stage) {
  fridgeSceneObserver?.disconnect();
  fridgeSceneObserver = null;
  if (!stage) return;
  const fit = () => {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!stage.isConnected || !width || !height) return;
    const mobile = globalThis.matchMedia?.('(max-width: 900px)').matches;
    // Opening must keep the same doors even if layout changes during the zoom.
    const variant = mobile ? 'mobile' : stage.classList.contains('is-opening') && OFFICE_SCENES[stage.dataset.scene]
      ? stage.dataset.scene : width / height < 1.45 ? 'portrait' : 'wide';
    stage.dataset.scene = variant;
    if (mobile) return;
    const scene = OFFICE_SCENES[variant];
    // Attach only the selected source. Phones keep the original illustration.
    for (const image of stage.querySelectorAll(`.pantry-office-${variant} image[data-scene-src]`)) {
      if (!image.hasAttribute('href')) image.setAttribute('href', image.dataset.sceneSrc);
    }
    const scale = Math.max(width / scene.width, height / scene.height);
    const sceneWidth = scene.width * scale, sceneHeight = scene.height * scale;
    const left = (width - sceneWidth) / 2, top = (height - sceneHeight) / 2;
    for (const [name, value] of Object.entries({ width: sceneWidth, height: sceneHeight, left, top })) {
      stage.style.setProperty(`--scene-${name}`, `${value}px`);
    }
    for (const [name, bounds] of Object.entries({ hit: scene.hit, guide: scene.guide })) {
      const values = [left + bounds[0] * scale, top + bounds[1] * scale, bounds[2] * scale, bounds[3] * scale];
      if (name === 'guide') {
        // Cover cropping can trim the hallway. Keep the bubble in view, then
        // redraw the arrow to the actual door rather than shifting its target.
        values[0] = Math.max(12, Math.min(values[0], width - values[2] - 12));
        values[1] = Math.max(12, Math.min(values[1], height - values[3] - 12));
        syncGuideArrow(stage.querySelector(`.fridge-guide-${variant}`),
          (left + scene.guideTip[0] * scale - values[0]) / scale,
          (top + scene.guideTip[1] * scale - values[1]) / scale);
      }
      ['left', 'top', 'width', 'height'].forEach((axis, index) => stage.style.setProperty(`--${name}-${axis}`, `${values[index]}px`));
    }
  };
  fit();
  if (typeof ResizeObserver === 'function') {
    fridgeSceneObserver = new ResizeObserver(fit);
    fridgeSceneObserver.observe(stage);
  }
}

// The original mobile illustration keeps its approved crop; desktop artwork
// has its own native image and coordinates. Controls and product photos are HTML.
function sceneCrop(viewBox, className = '') {
  return `<svg class="${className}" viewBox="${viewBox}" aria-hidden="true" focusable="false"><image href="${h(PANTRY_SCENE_ASSET)}" width="347" height="475"/></svg>`;
}

function officePart(scene, points) {
  const x = Math.min(...points.map(point => point[0])), y = Math.min(...points.map(point => point[1]));
  const width = Math.max(...points.map(point => point[0])) - x, height = Math.max(...points.map(point => point[1])) - y;
  const clip = points.map(point => `${(point[0] - x) / width * 100}% ${(point[1] - y) / height * 100}%`).join(',');
  return { viewBox: `${x} ${y} ${width} ${height}`, style: `--part-left:${x / scene.width * 100}%;--part-top:${y / scene.height * 100}%;--part-width:${width / scene.width * 100}%;--part-height:${height / scene.height * 100}%;--part-clip:polygon(${clip})` };
}

// A small view of the actual drinks sits behind the moving doors. It prevents
// the old blank white recess flashing before the full shelf view takes over.
function renderOfficeRecess(variant, drinks) {
  const rows = Array.from({ length: 4 }, (_, row) => {
    const products = drinks.slice(row * 3, row * 3 + 3).map((drink, index) => {
      const photo = findProductPhoto(drink.name);
      if (!photo) return '';
      const [x, y, width, height] = photo.crop || [0, 0, 84, photo.height];
      const [originalWidth, originalHeight] = photo.originalSize || [84, photo.height];
      const clipId = `pantry-recess-${variant}-${row}-${index}`;
      const clip = photo.outline ? `<defs><clipPath id="${clipId}"><polygon points="${photo.outline.map(point => point.join(',')).join(' ')}"/></clipPath></defs>` : '';
      return `<svg x="${24 + index * 41}" y="${31 + row * 84}" width="30" height="61" viewBox="${x} ${y} ${width} ${height}" preserveAspectRatio="xMidYMax meet">${clip}<image data-scene-src="${h(photo.displaySrc || photo.src)}" width="${originalWidth}" height="${originalHeight}"${clip ? ` clip-path="url(#${clipId})"` : ''}/></svg>`;
    }).join('');
    return `${products}<path class="pantry-recess-shelf" d="M13 ${94 + row * 84} H148" stroke="#bca67e" stroke-width="6"/><path d="M15 ${91 + row * 84} H146" stroke="#fffdf1" stroke-width="2"/>`;
  }).join('');
  return `<svg class="pantry-recess-interior" viewBox="0 0 160 420" preserveAspectRatio="none"><rect width="160" height="420" rx="6" fill="#9d927d"/><rect x="8" y="6" width="144" height="408" rx="7" fill="#e7e5d9" stroke="#b7ad95" stroke-width="3"/><path d="M21 18 H139" stroke="#ffffed" stroke-width="5" stroke-linecap="round"/>${rows}<rect x="15" y="363" width="131" height="36" rx="4" fill="#dad8cb" stroke="#b7ad95" stroke-width="2"/><path d="M66 371 H96" stroke="#a49c89" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function renderOfficeScene(variant, scene, drinks) {
  const id = `pantry-office-${variant}-art`;
  const crop = viewBox => `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
  const recess = officePart(scene, scene.recess), parts = ['upper-left', 'upper-right', 'lower-left', 'lower-right'];
  return `<div class="pantry-office-scene pantry-office-${variant}"><svg class="pantry-scene-art" viewBox="0 0 ${scene.width} ${scene.height}" aria-hidden="true" focusable="false"><defs><image id="${id}" data-scene-src="${h(scene.src)}" width="${scene.width}" height="${scene.height}"/></defs><use href="#${id}"/></svg><span class="pantry-door-recess" style="${recess.style}">${renderOfficeRecess(variant, drinks)}</span>${scene.doors.map((points, index) => {
    const part = officePart(scene, points);
    return `<span class="pantry-painted-door pantry-painted-door-${parts[index]}" style="${part.style}">${crop(part.viewBox)}</span>`;
  }).join('')}</div>`;
}

function renderPantryScene(drinks) {
  return `<div class="pantry-room" aria-hidden="true">${Object.entries(OFFICE_SCENES).map(([variant, scene]) => renderOfficeScene(variant, scene, drinks)).join('')}<div class="pantry-mobile-scene">${sceneCrop('0 0 347 475', 'pantry-scene-art')}<span class="pantry-door-recess"></span><span class="pantry-painted-door pantry-painted-door-mobile">${sceneCrop('85 97 176 304')}</span></div></div>`;
}

function syncGuideArrow(svg, endX, endY) {
  if (!svg) return;
  const startX = 177, startY = 77;
  const gap = Math.max(60, endX - startX), radius = Math.min(14, gap * .13);
  const cx = startX + gap * .48, cy = endY - 12;
  const curve = `M${startX} ${startY} C${startX + gap * .08} ${startY + 11} ${cx + radius + 1} ${cy + 12} ${cx + radius} ${cy - 5} C${cx + radius + 1} ${cy - 24} ${cx - radius + 2} ${cy - 26} ${cx - radius} ${cy - 8} C${cx - radius - 2} ${cy + 9} ${cx + radius} ${endY + 2} ${endX} ${endY}`;
  for (const path of svg.querySelectorAll('.guide-arrow')) path.setAttribute('d', curve);
  svg.querySelector('.guide-arrowhead').setAttribute('d', `M${endX - 15} ${endY - 9} Q${endX - 5} ${endY - 4} ${endX + 2} ${endY} Q${endX - 5} ${endY + 5} ${endX - 16} ${endY + 10} L${endX - 12} ${endY + 1} Z`);
}

function renderFridgeGuide(isOpen) {
  const artwork = (variant, width) => `<svg class="fridge-guide-${variant}" viewBox="0 0 ${width} 140" aria-hidden="true" focusable="false"><g class="guide-hand-arrow"><path class="guide-arrow"/><path class="guide-arrow guide-arrow-echo" transform="translate(.6 .8)"/><path class="guide-arrowhead"/></g><path class="guide-bubble" d="M20 72 C3 77 -4 57 8 47 C-1 32 11 18 25 20 C27 3 48 -1 59 13 C70 1 92 2 100 15 C113 4 133 12 136 26 C154 21 169 34 163 49 C179 61 169 82 153 82 C151 98 130 105 117 94 C105 108 83 106 75 95 C59 106 40 99 38 87 C22 92 10 86 20 72 Z"/><text x="85" y="60" text-anchor="middle">點擊打開冰箱</text></svg>`;
  return `<button type="button" class="fridge-open-guide" data-action="toggle-door" aria-label="點擊打開冰箱" aria-controls="${FRIDGE_CONTENT_ID}" aria-expanded="${isOpen}"${isOpen ? ' hidden inert' : ''}>${artwork('wide', 330)}${artwork('portrait', 300)}</button>`;
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
export function drinkPack(drink, { defer = false, fullSize = false } = {}) {
  const photo = findProductPhoto(drink.name);
  const source = photo ? h(fullSize ? photo.src : photo.displaySrc || photo.src) : '';
  const sourceAttribute = `${defer ? 'data-product-src' : 'src'}="${source}"`;
  const photoScale = drink.packaging === '小型鐵罐' ? 0.8 : 1;
  if (photo?.crop && photo.originalSize) {
    const [x, y, width, height] = photo.crop;
    const [originalWidth, originalHeight] = photo.originalSize;
    const scale = Math.min(84 / width, photo.height / height) * photoScale;
    const px = (value) => `${(value * scale).toFixed(3)}px`;
    const clip = photo.outline ? `;clip-path:polygon(${photo.outline.map(([pointX, pointY]) => `${((pointX - x) / width * 100).toFixed(4)}% ${((pointY - y) / height * 100).toFixed(4)}%`).join(',')})` : '';
    // The silhouette removes the background while the original pixels retain
    // white labels, silver cans and every printed detail inside the product.
    return `<div class="drink-pack-group drink-pack-group-photo"><span class="drink-photo-viewport" style="width:${px(width)};height:${px(height)}${clip}"><img class="drink-product-photo drink-product-photo-original" style="width:${px(originalWidth)};height:${px(originalHeight)};left:-${px(x)};top:-${px(y)}" ${sourceAttribute} alt="" aria-hidden="true" width="${originalWidth}" height="${originalHeight}" loading="lazy" decoding="async"></span></div>`;
  }
  if (photo) return `<div class="drink-pack-group drink-pack-group-photo"><img class="drink-product-photo${photo.height === 113 ? ' drink-product-photo-carton' : ''}" style="width:${84 * photoScale}px;height:${photo.height * photoScale}px" ${sourceAttribute} alt="" aria-hidden="true" width="${Math.round(84 * photoScale)}" height="${Math.round(photo.height * photoScale)}" loading="lazy" decoding="async"></div>`;
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

function renderFridgeProduct(drink, showQuantities, dateLabel, defer) {
  const status = showQuantities ? stockStatus(drink) : null;
  const classes = showQuantities
    ? `${status === 'low' ? ' is-low' : ''}${status === 'unknown' ? ' is-unknown' : ''}${status !== 'unknown' && drink.stock === 0 ? ' is-empty' : ''}`
    : '';
  const quantity = !showQuantities ? '' : `<span class="fridge-stock-badge">${status === 'unknown' ? '—' : drink.stock}<small>${h(drink.unit)}</small></span>`;
  const inventory = !showQuantities ? '' : `<span class="fridge-product-status">${status === 'unknown' ? '等待首次盤點' : status === 'low' ? '需要補貨' : '庫存充足'}</span><p>盤點 ${h(dateLabel(drink.lastCountAt))}</p>`;
  return `<article class="fridge-product${classes}" data-drink-id="${h(drink.id)}"><div class="fridge-product-stage">${drinkPack(drink, { defer })}${quantity}</div><div class="fridge-product-info"><h4>${h(drink.name)}</h4><p class="fridge-product-packaging">${h(drink.packaging || '飲料包裝')}</p>${inventory}</div><button type="button" class="fridge-product-edit" data-action="view-drink" data-id="${h(drink.id)}" aria-label="查看${h(drink.name)}飲料資訊"><span class="fridge-detail-arrow" aria-hidden="true"></span></button></article>`;
}

export function renderFridgePopularity(summary, { loading = false, error = false } = {}) {
  const header = '<div class="popularity-heading"><div><span class="popularity-eyebrow">PANTRY FAVORITES</span><h2>大家最近愛喝什麼？</h2></div><span class="popularity-period">平均每週</span></div>';
  if (!summary) return header + `<p class="popularity-status" role="status">${error ? '人氣統計暫時讀取不到。<button type="button" data-action="retry-popularity" class="text-link">再試一次</button>' : '正在整理飲用紀錄…'}</p>`;
  if (!summary.rows.length) return header + `<p class="popularity-status">${summary.observedProducts ? '這段期間尚未觀察到飲用量，下次盤點後再來看看。' : '累積盤點中：同品項至少兩次盤點、間隔一天，就能開始估算。'}</p>`;
  const maximum = summary.rows[0].weeklyRate;
  const formatter = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 });
  return header + `<div class="popularity-cards">${summary.rows.map((row, index) => `<button type="button" class="popular-drink" data-action="view-drink" data-id="${h(row.id)}"><span class="popularity-rank">${index + 1}</span><span class="popularity-name">${h(row.name)}</span><span class="popularity-amount">約 <strong>${row.weeklyRate < .1 ? '少於 0.1' : formatter.format(row.weeklyRate)}</strong> ${h(row.unit)}／週</span><span class="popularity-bar" aria-hidden="true"><i style="width:${(row.weeklyRate / maximum * 100).toFixed(1)}%"></i></span></button>`).join('')}</div><p class="popularity-note">依實際盤點與入庫紀錄估算${loading ? ' · 更新中' : error ? ' · 更新暫時中斷' : ''}，不是即時取用數量。</p>`;
}

/** A bounded public display; inventory quantities are deliberately opt-in. */
export function renderFridge(drinks, { isOpen = false, lastInventoryAt = null, showQuantities = false, formatDate, popularity = null, popularityLoading = false, popularityError = false } = {}) {
  const dateLabel = typeof formatDate === 'function' ? formatDate : (value) => value || '尚未盤點';
  const shelfCategories = [...new Set([...CATEGORIES_ORDER, ...drinks.map((drink) => drink.category)])];
  const shelves = shelfCategories.map((name) => ({ name, drinks: drinks.filter((drink) => drink.category === name) })).filter((shelf) => shelf.drinks.length);
  const logoSrc = typeof document === 'undefined' ? '' : (document.querySelector('.brand-mark')?.getAttribute('src') || '');
  const logo = (className, size) => logoSrc ? `<img class="${className}" src="${h(logoSrc)}" alt="Holdwin Capital H 標誌" width="${size}" height="${size}">` : '';

  return `<div class="pantry-stage${isOpen ? ' is-open' : ''}">${renderPantryScene(drinks)}<div class="fridge${isOpen ? ' is-open is-ready' : ''}" data-door-state="${isOpen ? 'open' : 'closed'}" aria-label="飲料冰箱">
    <header class="fridge-crown"><div class="fridge-maker">${logo('fridge-maker-logo', 30)}<span>Holdwin Capital</span></div><button type="button" class="fridge-close" data-action="toggle-door" aria-controls="${FRIDGE_CONTENT_ID}" aria-expanded="${isOpen}"${isOpen ? '' : ' hidden'}>關上冰箱 <span aria-hidden="true">↶</span></button></header>
    <div class="fridge-window"><div class="fridge-interior" id="${FRIDGE_CONTENT_ID}" role="region" aria-label="飲料展示層架，可向下捲動" aria-hidden="${!isOpen}" tabindex="${isOpen ? '0' : '-1'}"${isOpen ? '' : ' inert'}><div class="fridge-light" aria-hidden="true"></div><section class="fridge-popularity" aria-label="熱門飲料與每週平均飲用量">${renderFridgePopularity(popularity, { loading: popularityLoading, error: popularityError })}</section>${shelves.map((shelf, index) => `<section class="fridge-shelf" aria-label="${h(shelf.name)}飲料架"><div class="fridge-shelf-heading"><span class="shelf-index">0${index + 1}</span><h3>${h(shelf.name)}</h3>${showQuantities ? `<span class="shelf-count">${shelf.drinks.length} 種飲料</span>` : ''}</div><div class="fridge-products">${shelf.drinks.map((drink) => renderFridgeProduct(drink, showQuantities, dateLabel, !isOpen)).join('')}</div><div class="fridge-shelf-rail"><span>${h(FRIDGE_SHELF_LABELS[shelf.name] || 'PANTRY FAVORITES')}</span><i aria-hidden="true"></i><span class="shelf-rail-note">喜歡的，留一瓶給同事。</span></div></section>`).join('') || '<div class="empty-state"><h2>這一格還沒有飲料</h2><p>換個分類或關鍵字看看。</p></div>'}</div>
    <button type="button" class="fridge-door" data-action="toggle-door" aria-label="點擊打開冰箱門" aria-controls="${FRIDGE_CONTENT_ID}" aria-expanded="${isOpen}" aria-hidden="${isOpen}" tabindex="${isOpen ? '-1' : '0'}"${isOpen ? ' inert' : ''}><span class="sr-only">點我打開冰箱，看看今天，想喝哪一瓶。</span></button>${renderFridgeGuide(isOpen)}</div>
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
  const guide = element.querySelector('.fridge-open-guide');
  if (!interior || !door || !closeButton) return;
  if (isOpen) for (const image of interior.querySelectorAll('img[data-product-src]')) {
    image.src = image.dataset.productSrc;
    image.removeAttribute('data-product-src');
  }
  const cue = (element.closest('.fridge-panel') || element.parentElement)?.querySelector('.fridge-scroll-cue');
  const active = document.activeElement;
  const focusWasInside = interior.contains(active) || active === closeButton || active === door || active === guide;

  const stage = element.closest('.pantry-stage');
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const officeAnimation = stage?.dataset.scene !== 'mobile' && !reducedMotion;
  element.classList.toggle('is-open', isOpen);
  stage?.classList.toggle('is-open', isOpen);
  stage?.classList.toggle('is-opening', isOpen && officeAnimation);
  const panel = element.closest('.fridge-panel');
  const controls = panel?.querySelector(':scope > .toolbar');
  const caption = panel?.querySelector('.fridge-caption');
  const showControls = (show) => {
    panel?.classList.toggle('is-browsing', show);
    for (const item of [controls, caption, cue]) if (item) item.hidden = !show;
  };
  // Keep the scene's height stable while its four doors swing open.
  showControls(isOpen && !officeAnimation);
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
  if (guide) {
    guide.hidden = isOpen;
    guide.inert = isOpen;
    guide.setAttribute('aria-expanded', String(isOpen));
  }
  if (!isOpen) return;

  const finishOpening = () => {
    FRIDGE_DOOR_TIMERS.delete(element);
    if (!element.classList.contains('is-open')) return;
    stage?.classList.remove('is-opening');
    showControls(true);
    element.classList.add('is-ready');
    element.dataset.doorState = 'open';
    interior.inert = false;
    interior.tabIndex = 0;
    interior.setAttribute('aria-hidden', 'false');
    if (document.activeElement === closeButton) interior.focus({ preventScroll: true });
  };
  if (reducedMotion) finishOpening();
  else FRIDGE_DOOR_TIMERS.set(element, setTimeout(finishOpening, officeAnimation ? OFFICE_OPEN_DURATION : FRIDGE_OPEN_DURATION));
}
