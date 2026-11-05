import { SNACK_UNITS } from './supplies.js';
import { workingDaysBetween, WORKWEEK_DAYS } from './workdays.js';
/** Aggregate warehouse activity; counts are actual counts, never arrival baselines. */
export function inventoryActivity(drinks,supplies,events,supplyEvents) {
  const items=[...drinks.map(item=>({...item,kind:'drink'})),...supplies];
  const find=event=>items.find(item=>item.id===(event.drinkId||event.supplyId));
  const rows=[...events,...supplyEvents].filter(event=>event.accepted!==false&&['count','restock'].includes(event.type)).map(event=>{
    const item=find(event);return item?{id:event.id,itemId:item.id,kind:item.kind,name:item.name,flavor:item.flavor||'',unit:item.unit,quantity:event.quantity,createdAt:event.createdAt,type:event.type}:null;
  }).filter(Boolean).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  return {recentArrivals:rows.filter(event=>event.type==='restock').slice(0,12),recentCounts:['drink','snack','noodle','toner'].map(kind=>{
    const counted=rows.filter(event=>event.type==='count'&&event.kind===kind),stamp=counted[0]?.createdAt;
    return {kind,countedAt:stamp||null,items:counted.filter(event=>event.createdAt===stamp).slice(0,1000)};
  })};
}

/** Explicit arrival history gives a known balance; an actual count replaces it. */
export function recordedBalances(items,events,idField) {
  return items.map(item=>{
    const rows=events.map((event,index)=>({event,index})).filter(({event})=>event[idField]===item.id&&event.accepted!==false&&['count','restock'].includes(event.type)).sort((a,b)=>Date.parse(a.event.createdAt)-Date.parse(b.event.createdAt)||a.index-b.index);
    if(!rows.length)return item;
    let stock=null,lastCountAt=null,lastArrivalAt=null;
    for(const {event} of rows){if(event.type==='count'){stock=event.quantity;lastCountAt=event.createdAt;}else{stock=(stock??0)+event.quantity;lastArrivalAt=event.createdAt;}}
    if(!Number.isSafeInteger(stock)||stock<0||stock>999999)throw new Error('累計庫存超出上限，請核對紀錄。');
    return {...item,stock,lastCountAt,...(lastArrivalAt?{lastArrivalAt}:{})};
  });
}

/** Estimate consumption only between real counts, including intervening arrivals. */
export function snackFlavorStatistics(supplies,events) {
  return supplies.filter(item=>item.kind==='snack').map(item=>{
    const rows=events.map((event,index)=>({event,index})).filter(({event})=>event.supplyId===item.id&&['count','restock'].includes(event.type)).sort((a,b)=>Date.parse(a.event.createdAt)-Date.parse(b.event.createdAt)||a.index-b.index);
    let previous=null,received=0,used=0,days=0,arrivals=0;
    for(const {event} of rows){if(event.type==='restock'){received+=event.quantity;arrivals+=event.quantity;}else{if(previous){const span=workingDaysBetween(previous.createdAt,event.createdAt),amount=previous.quantity+received-event.quantity;if(span>=1&&amount>=0){used+=amount;days+=span;}}previous=event;received=0;}}
    return {id:item.id,name:item.name,flavor:item.flavor||'',unit:item.unit,arrivals,weekly:days?Math.round(used/days*WORKWEEK_DAYS*10)/10:null,days};
  }).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')||(b.weekly??-1)-(a.weekly??-1));
}

/** All accepted arrivals in the rolling 72-hour window, with no item limit. */
export function recentArrivalEvents(events,now=Date.now()) {
  const until=+new Date(now),since=until-3*86400000;
  return events.filter(event=>event.type==='restock'&&event.accepted!==false&&Date.parse(event.createdAt)>=since&&Date.parse(event.createdAt)<=until).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
}

/** Current recorded balances across the entire catalog, independent of count batches. */
export function inventoryTotals(items) {
  return ['drink','snack','noodle','toner'].map(kind=>{
    const group=items.filter(item=>item.kind===kind);
    return {kind,unknownCount:group.filter(item=>item.active!==false&&item.stock===null).length,
      items:group.filter(item=>item.stock>0).map(item=>({id:item.id,name:item.name,flavor:item.flavor||'',unit:item.unit,stock:item.stock,active:item.active!==false}))};
  });
}

export function normalizeInventoryTotals(groups) {
  const kinds=['drink','snack','noodle','toner'],seen=new Set();
  if(!Array.isArray(groups)||groups.length!==4)throw new Error('分類庫存總量格式不正確。');
  return groups.map(group=>{
    if(!group||!kinds.includes(group.kind)||seen.has(group.kind)||!Number.isSafeInteger(group.unknownCount)||group.unknownCount<0||group.unknownCount>2000||!Array.isArray(group.items)||group.items.length>2000)throw new Error('分類庫存總量格式不正確。');
    seen.add(group.kind);const ids=new Set(),units={drink:['包','瓶','罐'],snack:SNACK_UNITS,noodle:['杯','碗'],toner:['盒']};
    const items=group.items.map(item=>{
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>160||ids.has(item.id)||typeof item.name!=='string'||!item.name||item.name.length>80||typeof item.flavor!=='string'||item.flavor.length>80||!units[group.kind].includes(item.unit)||!Number.isSafeInteger(item.stock)||item.stock<1||item.stock>999999||typeof item.active!=='boolean')throw new Error('分類庫存品項格式不正確。');
      ids.add(item.id);return {id:item.id,name:item.name,flavor:item.flavor,unit:item.unit,stock:item.stock,active:item.active};
    });
    return {kind:group.kind,unknownCount:group.unknownCount,items};
  });
}
