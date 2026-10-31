import { escapeHtml as h, safeUrl } from './domain.js';

// These are transcriptions of the supplied package fronts, not inferred recipes
// or a substitute for a complete current nutrition label. Unknowns stay null.
export const DRINK_INFORMATION = Object.freeze([
  { names: ['立頓原味奶茶'], container: '300 毫升', basis: '每份（包裝正面標示；每份容量待核對）', energyKcal: 131.4 },
  { names: ['立頓巧克力奶茶'], container: '300 毫升', basis: '每份（包裝正面標示；每份容量待核對）', energyKcal: 134.1 },
  { names: ['立頓沁香奶綠'], container: '300 毫升', basis: '每份（包裝正面標示；每份容量待核對）', energyKcal: 118.5 },
  { names: ['Fin', 'FIN'], container: '300 毫升', basis: '每份 300 毫升（包裝正面標示）', energyKcal: 52.5 },
].map((row) => Object.freeze({
  names: Object.freeze(row.names), packaging: '鋁箔包', container: row.container,
  ingredients: null, allergens: null,
  nutrition: Object.freeze({ basis: row.basis, energyKcal: row.energyKcal, proteinG: null, fatG: null, saturatedFatG: null, transFatG: null, carbohydrateG: null, sugarG: null, sodiumMg: null }),
  source: Object.freeze({ type: 'provided-package', label: '所提供的商品包裝正面', checkedAt: '2026-10-31', scope: '僅確認正面的容量與每份熱量；成分與完整營養表尚待核對。' }),
})));

const drinkInformationByName = new Map(DRINK_INFORMATION.flatMap((row) => row.names.map((name) => [name, row])));

export function findDrinkInformation(drink) {
  const info = drinkInformationByName.get(typeof drink === 'string' ? drink : drink?.name) || null;
  return info && typeof drink === 'object' && drink?.packaging && drink.packaging !== info.packaging ? null : info;
}

const NUTRIENT_ROWS = [
  ['energyKcal', '熱量', '大卡'], ['proteinG', '蛋白質', '公克'], ['fatG', '脂肪', '公克'],
  ['saturatedFatG', '飽和脂肪', '公克'], ['transFatG', '反式脂肪', '公克'],
  ['carbohydrateG', '碳水化合物', '公克'], ['sugarG', '糖', '公克'], ['sodiumMg', '鈉', '毫克'],
];

export function renderDrinkInformation(drink) {
  const info = findDrinkInformation(drink);
  const pending = '<p class="subtle">尚待核對完整包裝標示。</p>';
  const nutrition = info?.nutrition;
  const table = nutrition ? `<p class="nutrition-basis">${h(nutrition.basis)}</p><div class="nutrition-table-wrap"><table class="nutrition-table"><tbody>${NUTRIENT_ROWS.map(([key, label, unit]) => `<tr><th scope="row">${label}</th><td>${typeof nutrition[key] === 'number' && Number.isFinite(nutrition[key]) ? `${nutrition[key]} ${unit}` : '<span class="subtle">待補</span>'}</td></tr>`).join('')}</tbody></table></div>` : pending;
  const source = info?.source;
  const sourceUrl = source?.url ? safeUrl(source.url) : '';
  const reference = !source ? '' : `<section class="drink-information-source"><h3>資料來源</h3><p>${h(source.label)} · 核對日期 ${h(source.checkedAt)}</p><p>${h(source.scope)}</p>${source.type === 'provided-package' ? `<button type="button" class="cell-action" data-action="view-drink-label" data-id="${h(drink.id)}">查看包裝原圖 ↗</button>` : sourceUrl ? `<a href="${h(sourceUrl)}" target="_blank" rel="noopener noreferrer">查看來源 ↗</a>` : ''}</section>`;
  return `<div class="drink-information">${info?.container ? `<p class="nutrition-basis">本圖包裝容量：${h(info.container)}</p>` : ''}<section><h3>成分</h3>${info?.ingredients ? `<p>${h(info.ingredients)}</p>` : pending}</section><section><h3>過敏原標示</h3>${info?.allergens ? `<p>${h(info.allergens)}</p>` : pending}</section><section><h3>營養標示</h3>${table}</section>${reference}<p class="nutrition-note">尚未確認的欄位不視為 0；實際成分與營養數值請以手上包裝為準。</p></div>`;
}
