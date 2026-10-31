/** Company-confirmed products; case size defaults to the owner's requested 24. */
export const DEFAULT_CASE_SIZE = 24;
export const CATEGORIES_ORDER = Object.freeze(['牛奶／豆漿', '茶飲', '咖啡', '果汁', '汽水', '其他', '大瓶飲料']);

const COMPANY_CATALOG_ROWS = [
  ['光泉牛乳', '牛奶／豆漿', '窄瓶鋁箔包'],
  ['光泉巧克力牛乳', '牛奶／豆漿', '窄瓶鋁箔包'],
  ['光泉薏仁糙米漿', '其他', '窄瓶鋁箔包'],
  ['tree top瓶果汁', '果汁', '窄瓶鋁箔包'],
  ['光泉柳橙汁', '果汁', '窄瓶鋁箔包'],
  ['統一豆漿', '牛奶／豆漿', '鋁箔包'],
  ['波蜜芭樂汁', '果汁', '鋁箔包'],
  ['立頓原味奶茶', '茶飲', '鋁箔包'],
  ['立頓巧克力奶茶', '茶飲', '鋁箔包'],
  ['立頓沁香奶綠', '茶飲', '鋁箔包'],
  ['日月潭紅茶', '茶飲', '鋁箔包'],
  ['十六茶', '茶飲', '鋁箔包'],
  ['Fin', '其他', '鋁箔包'],
  ['一日蔬果100%蘋果柳橙蔬果汁', '果汁', '鋁箔包'],
  ['荔枝氣泡水', '汽水', '鐵罐'],
  ['零卡可口可樂', '汽水', '鐵罐'],
  ['零卡百事可樂', '汽水', '鐵罐'],
  ['八寶粥', '其他', '鐵罐'],
  ['可口可樂', '汽水', '小型鐵罐'],
  ['百事可樂', '汽水', '小型鐵罐'],
  ['黑松沙士', '汽水', '小型鐵罐'],
  ['Milkis水蜜桃', '汽水', '長鐵罐'],
  ['Milkis', '汽水', '長鐵罐'],
  ['Redbull能量飲', '其他', '長鐵罐'],
  ['Vida氣泡飲', '汽水', '長鐵罐'],
  ['蜂蜜燕麥', '其他', '寶特瓶'],
  ['麥萃麥茶', '茶飲', '寶特瓶'],
  ['原萃綠茶', '茶飲', '寶特瓶'],
  ['十全果醋', '其他', '其他'],
  ['冷萃金萱烏龍', '大瓶飲料', '大瓶裝'],
  ['Moriyama紅茶', '大瓶飲料', '大瓶裝'],
  ['Moriyama奶茶', '大瓶飲料', '大瓶裝'],
  ['愛之味純濃燕麥', '其他', '寶特瓶', false],
  ['光泉燕麥奶', '牛奶／豆漿', '窄瓶鋁箔包', false],
  ['雪碧', '汽水', '小型鐵罐', false],
  ['紅牌蜂蜜奶茶', '茶飲', '鋁箔包', false],
  ['立頓蜂蜜紅茶', '茶飲', '寶特瓶', false],
  ['蘋果西打', '汽水', '小型鐵罐', false],
  ['克寧草莓優酪乳', '牛奶／豆漿', '窄瓶鋁箔包', false],
  ['愛之味麥仔茶', '茶飲', '鋁箔包', false],
];

export const COMPANY_CATALOG = Object.freeze(COMPANY_CATALOG_ROWS.map(([name, category, packaging, active = true], index) => Object.freeze({
  id: `company-drink-${String(index + 1).padStart(2, '0')}`,
  name,
  category,
  packaging,
  unit: ['寶特瓶', '大瓶裝'].includes(packaging) ? '瓶' : packaging.includes('鐵罐') ? '罐' : '包',
  active,
  perCase: DEFAULT_CASE_SIZE,
  stock: 0,
  threshold: 10,
  target: null,
  lastCountAt: null,
})));

export function createCompanyData() {
  return {
    drinks: COMPANY_CATALOG.map((drink) => ({ ...drink })),
    events: [],
    wishes: [],
    lastInventoryAt: null,
    catalogVersion: 4,
    caseSizeVersion: 1,
  };
}

// Keep the old seed signatures independent of sampleData(): the sample factory
// may change while existing browsers still hold the original fictional records.
const LEGACY_DEMO_ROWS = [
  ['麥香紅茶', '茶飲', '包', 24, 6, '🧋'],
  ['義美無糖豆奶', '其他', '包', 24, 8, '🥛'],
  ['御茶園特撰日式綠茶', '茶飲', '瓶', 24, 5, '🍵'],
  ['可口可樂', '汽水', '罐', 24, 9, '🥤'],
  ['伯朗咖啡', '咖啡', '罐', 24, 3, '☕'],
  ['每日 C 柳橙汁', '果汁', '包', 24, 0, '🍊'],
  ['麥香奶茶', '茶飲', '包', 24, 18, '🧋'],
  ['麥香綠茶', '茶飲', '包', 24, 21, '🍵'],
  ['立頓原味奶茶', '茶飲', '包', 24, 14, '🧋'],
  ['義美紅茶', '茶飲', '包', 24, 28, '🫖'],
  ['光泉茉莉蜜茶', '茶飲', '包', 24, 16, '🌼'],
  ['茶裏王日式無糖綠茶', '茶飲', '瓶', 24, 31, '🍵'],
  ['茶裏王英式紅茶', '茶飲', '瓶', 24, 22, '🫖'],
  ['原萃日式綠茶', '茶飲', '瓶', 24, 25, '🍃'],
  ['原萃烏龍茶', '茶飲', '瓶', 24, 17, '🍃'],
  ['爽健美茶', '茶飲', '瓶', 24, 19, '🌿'],
  ['黑松沙士', '汽水', '罐', 24, 27, '🥤'],
  ['雪碧', '汽水', '罐', 24, 12, '🍋'],
  ['舒跑', '其他', '罐', 24, 20, '🏃'],
  ['寶礦力水得', '其他', '瓶', 24, 15, '💧'],
  ['悅氏礦泉水', '其他', '瓶', 24, 42, '💧'],
  ['統一陽光無糖豆漿', '其他', '包', 24, 23, '🥛'],
  ['光泉米漿', '其他', '包', 24, 11, '🌾'],
  ['保久乳', '其他', '包', 24, 26, '🥛'],
  ['波蜜果菜汁', '果汁', '包', 24, 13, '🥕'],
  ['美粒果白葡萄汁', '果汁', '瓶', 24, 18, '🍇'],
  ['蔓越莓綜合果汁', '果汁', '包', 24, 10, '🫐'],
  ['韋恩特濃咖啡', '咖啡', '罐', 24, 24, '☕'],
  ['UCC 無糖黑咖啡', '咖啡', '罐', 30, 16, '☕'],
  ['台糖檸檬氣泡水', '汽水', '罐', 12, 14, '🫧'],
];

const LEGACY_DEMO_SIGNATURES = new Map(LEGACY_DEMO_ROWS.map(([name, category, unit, perCase, stock, icon], index) => [
  `demo-drink-${index + 1}`, { name, category, unit, perCase, stock, icon, threshold: 10, target: perCase * 2 },
]));

const LEGACY_DEMO_WISHES = new Map([
  ['demo-wish-1', { name: '無糖氣泡水', url: 'https://www.google.com/search?q=無糖氣泡水', note: '想要沒有糖、下午喝起來清爽的選擇。', status: 'pending' }],
  ['demo-wish-2', { name: '燕麥奶', url: '', note: '可以搭配辦公室的咖啡。', status: 'pending' }],
  ['demo-wish-3', { name: '無糖豆漿', url: '', note: '早餐補給，已加入飲料品項。', status: 'purchased' }],
]);

function isSyntheticDemoEvent(event) {
  if (!LEGACY_DEMO_SIGNATURES.has(event.drinkId)) return false;
  return (event.type === 'count' && event.note === '示範盤點' &&
      [event.drinkId + '-count-first', event.drinkId + '-count-last'].includes(event.id)) ||
    (event.type === 'restock' && event.note === '示範到貨' && event.id === event.drinkId + '-arrival');
}

function isUnchangedDemoDrink(drink) {
  const original = LEGACY_DEMO_SIGNATURES.get(drink.id);
  if (!original) return false;
  return Object.entries(original).every(([key, value]) => drink[key] === value);
}

/**
 * One-time, pure preparation of the real product catalog. It never writes a
 * browser store or database. The caller decides when it is safe to persist.
 * Human-entered seed changes remain separate: names do not imply a safe merge.
 */
function prepareCatalogVersion(data) {
  if (data?.catalogVersion >= 4) return data;
  if (!data) return createCompanyData();
  if (!Array.isArray(data.drinks) || !Array.isArray(data.events) || !Array.isArray(data.wishes)) {
    throw new Error('庫存資料格式不正確，無法準備公司飲料清單。');
  }

  if (data.catalogVersion >= 1) {
    const existing = new Set(data.drinks.map((drink) => drink.id));
    const additions = COMPANY_CATALOG.slice(data.catalogVersion >= 3 ? 35 : data.catalogVersion >= 2 ? 32 : 29).filter((drink) => !existing.has(drink.id)).map((drink) => ({ ...drink }));
    const drinks = data.drinks.map((drink) => data.catalogVersion < 2 && drink.id === 'company-drink-09' && drink.name === '立頓巧克力牛奶'
      ? { ...drink, name: '立頓巧克力奶茶', category: drink.category === '牛奶／豆漿' ? '茶飲' : drink.category }
      : drink);
    return { ...data, drinks: [...drinks, ...additions], catalogVersion: 4 };
  }

  const humanEventDrinkIds = new Set(data.events.filter((event) => !isSyntheticDemoEvent(event)).map((event) => event.drinkId));
  const preservedDrinks = data.drinks.filter((drink) => !isUnchangedDemoDrink(drink) || humanEventDrinkIds.has(drink.id));
  const preservedIds = new Set(preservedDrinks.map((drink) => drink.id));
  const companyIds = new Set(COMPANY_CATALOG.map((drink) => drink.id));
  const preservedById = new Map(preservedDrinks.map((drink) => [drink.id, drink]));
  const events = data.events.filter((event) => !isSyntheticDemoEvent(event) || preservedIds.has(event.drinkId));
  const wishes = data.wishes.filter((wish) => {
    const original = LEGACY_DEMO_WISHES.get(wish.id);
    return !original || !Object.entries(original).every(([key, value]) => wish[key] === value);
  });

  return {
    ...data,
    drinks: [
      ...COMPANY_CATALOG.map((drink) => ({ ...(preservedById.get(drink.id) || drink) })),
      ...preservedDrinks.filter((drink) => !companyIds.has(drink.id)).map((drink) => ({ ...drink })),
    ],
    events: events.map((event) => ({ ...event })),
    wishes: wishes.map((wish) => ({ ...wish })),
    lastInventoryAt: preservedDrinks.length || events.length ? (data.lastInventoryAt ?? null) : null,
    catalogVersion: 4,
  };
}

export function prepareCompanyCatalog(data) {
  let prepared = prepareCatalogVersion(data);
  if (!Array.isArray(prepared.drinks) || !Array.isArray(prepared.events) || !Array.isArray(prepared.wishes)) {
    throw new Error('庫存資料格式不正確，無法準備公司飲料清單。');
  }
  const correctedNames = prepared.drinks.map((drink) => {
    if (drink.id === 'company-drink-07' && drink.name === '波利芭樂汁') return { ...drink, name: '波蜜芭樂汁' };
    if (drink.id === 'company-drink-14' && drink.name === '波蜜一日蔬果') return { ...drink, name: '一日蔬果100%蘋果柳橙蔬果汁' };
    if (drink.id === 'company-drink-22' && ['Milkiis水蜜桃', 'Miilkis水蜜桃'].includes(drink.name)) return { ...drink, name: 'Milkis水蜜桃' };
    if (drink.id === 'company-drink-23' && ['Miilkis', 'Milkiis'].includes(drink.name)) return { ...drink, name: 'Milkis' };
    return drink;
  });
  if (correctedNames.some((drink, index) => drink !== prepared.drinks[index])) prepared = { ...prepared, drinks: correctedNames };
  if (prepared.caseSizeVersion >= 1) return prepared;
  // Apply the owner's uniform case size once, without changing historical facts.
  return { ...prepared, drinks: prepared.drinks.map((drink) => ({ ...drink, perCase: DEFAULT_CASE_SIZE })), caseSizeVersion: 1 };
}
