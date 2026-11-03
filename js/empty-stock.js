import { hasRecordedStock, restockPreferenceMode } from './restock-preferences.js';

export function groupEmptyStock(items) {
  const pending=item=>item.mode==='consider'&&item.zeroStockPending===true;
  return { pending:items.filter(pending), undecided:items.filter(item=>!pending(item)) };
}

/** Only actual arrivals fulfil a zero-stock purchase decision; counts do not. */
export function fulfilZeroRestocks(previous, next) {
  const oldIds=new Set([...(previous.events||[]),...(previous.supplyEvents||[])].map(event=>event.id));
  const incoming=[...(next.events||[]),...(next.supplyEvents||[])].filter(event=>!oldIds.has(event.id)&&event.type==='restock'&&event.accepted!==false&&event.quantity>0);
  const fulfilled=new Set();
  for(const event of incoming){
    const kind=event.drinkId?'drink':(previous.supplies||[]).find(item=>item.id===event.supplyId)?.kind;
    const id=event.drinkId||event.supplyId,old=(kind==='drink'?previous.drinks:previous.supplies||[]).find(item=>item.id===id);
    if(old&&hasRecordedStock(old)&&old.stock===0&&restockPreferenceMode(previous.restockPreferences||[],kind,id)==='consider'&&(previous.restockPreferences||[]).some(entry=>entry.kind===kind&&entry.itemId===id&&entry.zeroStockPending===true))fulfilled.add(`${kind}:${id}`);
  }
  return fulfilled.size?{...next,restockPreferences:(next.restockPreferences||[]).map(entry=>fulfilled.has(`${entry.kind}:${entry.itemId}`)?{kind:entry.kind,itemId:entry.itemId,mode:'normal',updatedAt:new Date().toISOString()}:entry)}:next;
}
