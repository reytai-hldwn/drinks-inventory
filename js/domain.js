/** Pure inventory helpers. Quantities always refer to individual containers. */
export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function number(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim())) {
    throw new Error('請輸入 0 或以上的整數。');
  }
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error('請輸入 0 或以上的整數。');
  }
  return quantity;
}

export function stockStatus(drink) {
  if (Object.hasOwn(drink, 'lastCountAt') && !drink.lastCountAt) return 'unknown';
  return drink.stock <= drink.threshold ? 'low' : 'ok';
}

export function blankData() {
  return { drinks: [], events: [], wishes: [], lastInventoryAt: null };
}

/**
 * Estimate consumption only over completed stocktake intervals.
 * Arrivals after the latest stocktake and elapsed time since it do not create
 * observed consumption. Negative intervals are adjustments, not negative usage.
 */
export function getConsumption(drinkId, events, now = new Date()) {
  const result = { dailyRate: null, days: 0, consumed: 0, samples: 0, anomaly: false };
  const cutoff = new Date(now).getTime();
  const timeline = (Array.isArray(events) ? events : [])
    .filter((event) => event.drinkId === drinkId && ['count', 'restock'].includes(event.type))
    .map((event) => ({ ...event, timestamp: Date.parse(event.createdAt) }))
    .filter((event) => Number.isFinite(event.timestamp) && event.timestamp <= cutoff)
    .sort((left, right) => left.timestamp - right.timestamp);

  let previousCount = null;
  let received = 0;
  let invalidInterval = false;
  for (const event of timeline) {
    const valid = Number.isSafeInteger(event.quantity) && event.quantity >= 0;
    if (event.type === 'restock') {
      if (previousCount) {
        if (valid) received += event.quantity;
        else invalidInterval = result.anomaly = true;
      }
      continue;
    }

    if (!valid) {
      previousCount = null;
      received = 0;
      invalidInterval = false;
      result.anomaly = true;
      continue;
    }

    if (previousCount) {
      const days = (event.timestamp - previousCount.timestamp) / 86_400_000;
      const consumed = previousCount.quantity + received - event.quantity;
      if (days > 0 && consumed >= 0 && Number.isSafeInteger(consumed) && !invalidInterval) {
        result.days += days;
        result.consumed += consumed;
        result.samples += 1;
      } else if (consumed < 0 || invalidInterval || !Number.isSafeInteger(consumed)) {
        result.anomaly = true;
      }
    }
    previousCount = event;
    received = 0;
    invalidInterval = false;
  }

  if (result.samples > 0) result.dailyRate = result.consumed / result.days;
  return result;
}

/** Fictional examples only; never load these into a configured shared database. */
export function sampleData() {
  const now = Date.now();
  const atDaysAgo = (days) => new Date(now - days * 86_400_000).toISOString();
  const previousAt = atDaysAgo(10);
  const lastAt = atDaysAgo(3);
  const arrivalsAt = atDaysAgo(6);
  const definitions = [
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
  const events = [];
  const drinks = definitions.map(([name, category, unit, perCase, stock, icon], index) => {
    const id = `demo-drink-${index + 1}`;
    const received = index % 4 === 0 ? perCase : 0;
    const consumed = received + 7 + (index % 9) * 2;
    const initial = stock + consumed - received;
    events.push({
      id: `${id}-count-first`, type: 'count', drinkId: id,
      quantity: initial, previousStock: initial, createdAt: previousAt, note: '示範盤點',
    });
    if (received) events.push({
      id: `${id}-arrival`, type: 'restock', drinkId: id,
      quantity: received, previousStock: initial, createdAt: arrivalsAt, note: '示範到貨',
    });
    events.push({
      id: `${id}-count-last`, type: 'count', drinkId: id,
      quantity: stock, previousStock: initial + received, createdAt: lastAt, note: '示範盤點',
    });
    return {
      id, name, category, unit, perCase, stock, icon, threshold: 10,
      target: perCase * 2, lastCountAt: lastAt,
    };
  });
  return {
    drinks,
    events,
    wishes: [
      { id: 'demo-wish-1', name: '無糖氣泡水', url: 'https://www.google.com/search?q=無糖氣泡水', note: '想要沒有糖、下午喝起來清爽的選擇。', status: 'pending', createdAt: atDaysAgo(2) },
      { id: 'demo-wish-2', name: '燕麥奶', url: '', note: '可以搭配辦公室的咖啡。', status: 'pending', createdAt: atDaysAgo(4) },
      { id: 'demo-wish-3', name: '無糖豆漿', url: '', note: '早餐補給，已加入飲料品項。', status: 'purchased', createdAt: atDaysAgo(8) },
    ],
    lastInventoryAt: lastAt,
  };
}
