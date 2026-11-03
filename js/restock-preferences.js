export const RESTOCK_MODES = Object.freeze({ normal: '', hold: '暫不需要補貨', replace: '可以準備替換新品項', consider:'需要補貨' });

export const hasRecordedStock = item => Number.isSafeInteger(item.stock) && item.stock>=0 && !!(item.lastCountAt||item.lastArrivalAt);

export function restockThreshold(kind) {
  return kind==='drink'?10:kind==='noodle'?1:kind==='toner'?0:null;
}

export function isLowStockItem(item) {
  const threshold=restockThreshold(item.kind===undefined?'drink':item.kind);
  return threshold!==null && hasRecordedStock(item) && Number.isSafeInteger(item.stock) && item.stock >= 0 && item.stock <= threshold;
}

export function inventoryLowThreshold(kind) {
  return kind==='drink'||kind==='snack'?10:kind==='noodle'?3:kind==='toner'?0:null;
}

export function isOutOfStockItem(item) {
  const kind=item.kind===undefined?'drink':item.kind;
  return ['drink','snack','noodle'].includes(kind) && hasRecordedStock(item) && item.stock===0;
}

export function matchesInventoryStockFilter(item,filter='all',preferences=[]) {
  if(filter==='all')return true;
  if(filter==='empty')return isOutOfStockItem(item);
  const kind=item.kind===undefined?'drink':item.kind,threshold=inventoryLowThreshold(kind);
  return filter==='low' && threshold!==null && hasRecordedStock(item) && Number.isSafeInteger(item.stock) &&
    (kind==='toner'?item.stock===0:item.stock>0&&item.stock<=threshold) &&
    (kind!=='snack'||restockPreferenceMode(preferences,kind,item.id)==='consider');
}

export function sortInventoryItems(items,preferences=[]) {
  const stock=item=>hasRecordedStock(item)?item.stock:Infinity;
  const marked=item=>restockPreferenceMode(preferences,item.kind||'drink',item.id)==='consider';
  return [...items].sort((a,b)=>Number(marked(b))-Number(marked(a))||(stock(a)===stock(b)?0:stock(a)-stock(b)));
}

export function restockPreferenceMode(preferences, kind, itemId) {
  return preferences.find(entry=>entry.kind===kind&&entry.itemId===itemId)?.mode || 'normal';
}

export function normalizeRestockPreferences(payload) {
  if(payload.restockPreferenceEntry?.version!==1)return{restockPreferences:[],restockPreferenceVersion:0};
  if(!Array.isArray(payload.restockPreferences)||payload.restockPreferences.length>2000)throw new Error('補貨提醒設定格式不正確。');
  const keys=new Set();
  const restockPreferences=payload.restockPreferences.map(entry=>{
    if(!entry||!['drink','snack','noodle','toner'].includes(entry.kind)||typeof entry.itemId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(entry.itemId)||!Object.hasOwn(RESTOCK_MODES,entry.mode)||typeof entry.updatedAt!=='string'||!Number.isFinite(Date.parse(entry.updatedAt)))throw new Error('補貨提醒設定格式不正確。');
    const key=`${entry.kind}:${entry.itemId}`;if(keys.has(key))throw new Error('補貨提醒設定重複。');keys.add(key);
    if(entry.zeroStockPending!==undefined&&typeof entry.zeroStockPending!=='boolean')throw new Error('無庫存處理狀態不正確。');
    return{kind:entry.kind,itemId:entry.itemId,mode:entry.mode,updatedAt:entry.updatedAt,...(entry.zeroStockPending===true?{zeroStockPending:true}:{})};
  });
  return{restockPreferences,restockPreferenceVersion:1,...(payload.restockPreferenceEntry.snackManualVersion===1?{snackManualVersion:1}:{}),...(payload.restockPreferenceEntry.manualAllVersion===1?{manualAllVersion:1}:{})};
}
