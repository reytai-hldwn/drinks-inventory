import { escapeHtml as h, safeUrl } from './domain.js';
import { CHECKED_DRINK_LABELS } from './drink-labels.js';

const productionLine = '該產線亦生產含芒果、花生、芝麻、牛奶、蛋、堅果類、含麩質之穀物及大豆製品。';
const officialInformation = [
  {
    names: ['光泉牛乳'], productId: '202411412032', labelPath: 'Long-Life-Milk/ingr/02032.jpg',
    ingredients: '100%生乳', allergens: '本產品含牛奶，對其過敏者不宜食用。' + productionLine,
    values: [132.2, 6.6, 7.4, 5, 0, 9.8, 9.6, 90], per100: [66.1, 3.3, 3.7, 2.5, 0, 4.9, 4.8, 45], extra: { calciumMg: 200 },
  },
  {
    names: ['光泉巧克力牛乳'], productId: '202411112034', labelPath: 'Long-Life-FlavoredMilk/ingr/02034.jpg',
    ingredients: '水、奶粉、蔗糖、生乳、可可粉、脂肪酸甘油酯、海藻酸鈉', allergens: '本產品含牛奶，對其過敏者不宜食用。' + productionLine,
    values: [119.2, 3.6, 4, 2.4, 0, 17.2, 16.4, 86], per100: [59.6, 1.8, 2, 1.2, 0, 8.6, 8.2, 43], extra: { calciumMg: 104 },
  },
  {
    names: ['光泉薏仁糙米漿'], productId: '202411422134', labelPath: 'RiceMilk/ingr/02134.jpg',
    ingredients: '水、蔗糖、烤花生、薏仁粉、糙米粉、玉米糖膠、脂肪酸甘油酯（含檸檬酸）、脂肪酸蔗糖酯、碳酸氫鈉、維生素E（抗氧化劑）', allergens: '本產品含花生，對其過敏者不宜食用。' + productionLine,
    values: [113.8, 2, 3.4, 1, 0, 18.8, 16.8, 66], per100: [56.9, 1, 1.7, 0.5, 0, 9.4, 8.4, 33], extra: { cholesterolMg: 0 },
  },
  {
    names: ['光泉柳橙汁'], productId: '202411822137', labelPath: 'JuiceTime/ingr/02137.jpg',
    ingredients: '水、柳橙濃縮汁、蘋果濃縮汁、檸檬濃縮汁', allergens: productionLine,
    values: [103.2, 0.8, 0, 0, 0, 25, 20.6, 30], per100: [51.6, 0.4, 0, 0, 0, 12.5, 10.3, 15],
  },
  {
    names: ['光泉燕麥奶'], productId: '202411532128', labelPath: 'OATMilk/ingr/02128.jpg',
    ingredients: '水、燕麥粉', allergens: '本產品含麩質之穀物，對其過敏者不宜食用。' + productionLine,
    values: [105.4, 2.6, 2.6, 0.6, 0, 18.4, 9, 80], per100: [52.7, 1.3, 1.3, 0.3, 0, 9.2, 4.5, 40], extra: { cholesterolMg: 0, betaGlucanG: 1, lactoseG: 0, dietaryFiberG: 4 },
  },
].map((row) => {
  const keys = ['energyKcal', 'proteinG', 'fatG', 'saturatedFatG', 'transFatG', 'carbohydrateG', 'sugarG', 'sodiumMg'];
  return Object.freeze({
    names: Object.freeze(row.names), packaging: '窄瓶鋁箔包', container: '200 毫升',
    ingredients: row.ingredients, allergens: row.allergens,
    nutrition: Object.freeze({ basis: '每份 200 毫升，本包裝含 1 份', ...Object.fromEntries(keys.map((key, index) => [key, row.values[index]])), ...row.extra, per100: Object.freeze(Object.fromEntries(keys.map((key, index) => [key, row.per100[index]]))) }),
    source: Object.freeze({ type: 'official', label: '光泉官方商城商品規格及營養標籤', url: 'https://www.kuangchuan.com/KCGO/Item/' + row.productId, labelUrl: 'https://www.kuangchuan.com/Content/Images/product/' + row.labelPath, checkedAt: '2026-10-31', scope: '已核對官網現行 200 毫升常溫版的成分、過敏原與營養標示；不同容量或舊版配方可能不同。' }),
  });
});

const checkedInformation = CHECKED_DRINK_LABELS.map((row) => Object.freeze({
  ...row, names: Object.freeze(row.names), source: Object.freeze(row.source),
  nutrition: row.nutrition ? Object.freeze({
    proteinG: null, fatG: null, saturatedFatG: null, transFatG: null,
    carbohydrateG: null, sugarG: null, sodiumMg: null, ...row.nutrition,
  }) : null,
}));
export const DRINK_INFORMATION = Object.freeze([
  ...officialInformation, ...checkedInformation,
]);

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
  const extraRows = [['calciumMg', '鈣', '毫克'], ['cholesterolMg', '膽固醇', '毫克'], ['dietaryFiberG', '膳食纖維', '公克'], ['betaGlucanG', 'β-聚葡萄糖', '公克'], ['lactoseG', '乳糖', '公克'], ['ironMg', '鐵', '毫克'], ['potassiumMg', '鉀', '毫克'], ['saltEquivalentG', '食鹽相當量', '公克']].filter(([key]) => nutrition?.[key] !== undefined);
  const nutrientValue = (value, unit) => {
    if (typeof value === 'number' && Number.isFinite(value)) return `${value} ${unit}`;
    if (value && Number.isFinite(value.min) && Number.isFinite(value.max) && value.min >= 0 && value.max >= value.min) return `${value.min}～${value.max} ${unit}`;
    return '<span class="subtle">待補</span>';
  };
  const table = nutrition ? `<p class="nutrition-basis">${h(nutrition.basis)}</p><div class="nutrition-table-wrap"><table class="nutrition-table"><thead><tr><th scope="col">營養素</th><th scope="col">${h(nutrition.servingLabel || '每份')}</th>${nutrition.per100 ? `<th scope="col">${h(nutrition.per100Basis || '每 100 毫升')}</th>` : ''}</tr></thead><tbody>${[...NUTRIENT_ROWS, ...extraRows].map(([key, label, unit]) => `<tr><th scope="row">${label}</th><td>${nutrientValue(nutrition[key], unit)}</td>${nutrition.per100 ? `<td>${extraRows.some(([extra]) => extra === key) ? '—' : nutrientValue(nutrition.per100[key], unit)}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : pending;
  const source = info?.source;
  const sourceUrl = source?.url ? safeUrl(source.url) : '';
  const labelUrl = source?.labelUrl ? safeUrl(source.labelUrl) : '';
  const reference = !source ? '' : `<section class="drink-information-source"><h3>資料來源</h3><p>${h(source.label)} · 核對日期 ${h(source.checkedAt)}</p><p>${h(source.scope)}</p>${labelUrl ? `<a href="${h(labelUrl)}" target="_blank" rel="noopener noreferrer">${source.type === 'official' ? '查看官方營養標籤' : '查看營養標籤原圖'} ↗</a> · ` : ''}${source.type === 'provided-package' ? `<button type="button" class="cell-action" data-action="view-drink-label" data-id="${h(drink.id)}">查看包裝原圖 ↗</button>` : sourceUrl ? `<a href="${h(sourceUrl)}" target="_blank" rel="noopener noreferrer">查看來源 ↗</a>` : ''}</section>`;
  const facts = info?.facts?.length ? `<section><h3>其他包裝標示</h3><dl class="drink-facts">${info.facts.map((fact) => `<div><dt>${h(fact.label)}</dt><dd>${h(fact.value)}</dd></div>`).join('')}</dl></section>` : '';
  return `<div class="drink-information">${info?.container ? `<p class="nutrition-basis">本次核對包裝容量：${h(info.container)}</p>` : ''}${info?.referenceNote ? `<p class="nutrition-note">${h(info.referenceNote)}</p>` : ''}<section><h3>成分</h3>${info?.ingredients ? `<p>${h(info.ingredients)}</p>` : pending}</section><section><h3>過敏原標示</h3>${info?.allergens ? `<p>${h(info.allergens)}</p>` : pending}</section><section><h3>營養標示</h3>${table}</section>${facts}${reference}<p class="nutrition-note">尚未確認的欄位不視為 0；實際成分與營養數值請以手上包裝為準。</p></div>`;
}
