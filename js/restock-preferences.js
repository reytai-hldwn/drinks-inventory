export const RESTOCK_MODES = Object.freeze({ normal: '', hold: '暫不需要補貨', replace: '可以準備替換新品項' });

export function isLowStockItem(item) {
  return !!item.lastCountAt && Number.isSafeInteger(item.stock) && item.stock >= 0 && item.stock <= 10;
}

export function sortInventoryItems(items) {
  const stock=item=>item.lastCountAt&&Number.isSafeInteger(item.stock)?item.stock:Infinity;
  return [...items].sort((a,b)=>stock(a)===stock(b)?0:stock(a)-stock(b));
}

export function restockPreferenceMode(preferences, kind, itemId) {
  return preferences.find(entry=>entry.kind===kind&&entry.itemId===itemId)?.mode || 'normal';
}

export function normalizeRestockPreferences(payload) {
  if(payload.restockPreferenceEntry?.version!==1)return{restockPreferences:[],restockPreferenceVersion:0};
  if(!Array.isArray(payload.restockPreferences)||payload.restockPreferences.length>2000)throw new Error('補貨提醒設定格式不正確。');
  const keys=new Set();
  const restockPreferences=payload.restockPreferences.map(entry=>{
    if(!entry||!['drink','noodle','toner'].includes(entry.kind)||typeof entry.itemId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(entry.itemId)||!Object.hasOwn(RESTOCK_MODES,entry.mode)||typeof entry.updatedAt!=='string'||!Number.isFinite(Date.parse(entry.updatedAt)))throw new Error('補貨提醒設定格式不正確。');
    const key=`${entry.kind}:${entry.itemId}`;if(keys.has(key))throw new Error('補貨提醒設定重複。');keys.add(key);
    return{kind:entry.kind,itemId:entry.itemId,mode:entry.mode,updatedAt:entry.updatedAt};
  });
  return{restockPreferences,restockPreferenceVersion:1};
}
