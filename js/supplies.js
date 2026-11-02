/** Back-office supplies are independent of the public drinks catalog. */
export const SUPPLY_KINDS = Object.freeze({ noodle: '泡麵', toner: '碳粉' });
export const SUPPLY_CATALOG = Object.freeze([
  ['supply-noodle-01','來一客海鮮','noodle','杯'],
  ['supply-noodle-02','滿漢大餐牛肉麵','noodle','碗'],
  ['supply-noodle-03','拉麵道味噌拉麵','noodle','杯'],
  ['supply-noodle-04','拉麵道豚骨拉麵','noodle','杯'],
  ['supply-noodle-05','奶油白醬辣火雞麵','noodle','杯'],
  ['supply-toner-black','黑色碳粉','toner','盒'],
  ['supply-toner-yellow','黃色碳粉','toner','盒'],
  ['supply-toner-red','紅色碳粉','toner','盒'],
  ['supply-toner-blue','藍色碳粉','toner','盒'],
].map(([id,name,kind,unit])=>Object.freeze({id,name,kind,unit,active:true})));

export function initialSupplies() {
  return SUPPLY_CATALOG.map(item=>({...item,stock:null,lastCountAt:null}));
}

export function supplyToday(now = new Date()) {
  return new Date(+new Date(now)+8*3600000).toISOString().slice(0,10);
}

export function validSupplyExpiry(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const stamp=Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value;
}

export function supplyExpiryStatus(value,now=new Date()) {
  if(!validSupplyExpiry(value))return {kind:'unknown',label:'效期待補'};
  const days=Math.round((Date.parse(`${value}T00:00:00Z`)-Date.parse(`${supplyToday(now)}T00:00:00Z`))/86400000);
  return days<0?{kind:'expired',label:'已到期'}:days===0?{kind:'near',label:'今天到期'}:days<=30?{kind:'near',label:`${days} 天後到期`}:{kind:'fresh',label:'效期正常'};
}

// Arrival amounts are original batch sizes, never inferred remaining amounts.
// Only an explicit "used up" mark or a later zero count ends a reminder.
export function supplyBatches(supplyId,events) {
  const timeline=events.map((event,index)=>({event,index})).filter(entry=>entry.event.supplyId===supplyId)
    .sort((a,b)=>Date.parse(a.event.createdAt)-Date.parse(b.event.createdAt)||a.index-b.index).map(entry=>entry.event);
  let batches=[];
  for(const event of timeline){
    if(event.type==='count'&&event.quantity===0)batches=[];
    else if(event.type==='restock')batches.push({...event});
    else if(event.type==='expiry-close')batches=batches.filter(batch=>batch.id!==event.batchId);
  }
  return batches.sort((a,b)=>(a.expiresOn||'9999').localeCompare(b.expiresOn||'9999'));
}

export function supplyHasUntrackedExpiry(supplyId,events) {
  let stock=null,unknown=false;
  const timeline=events.map((event,index)=>({event,index})).filter(entry=>entry.event.supplyId===supplyId)
    .sort((a,b)=>Date.parse(a.event.createdAt)-Date.parse(b.event.createdAt)||a.index-b.index);
  for(const {event} of timeline){
    if(event.type==='count'){
      if(event.quantity===0)unknown=false;
      else if(stock===null||event.quantity>stock)unknown=true;
      stock=event.quantity;
    }else if(event.type==='restock'&&stock!==null)stock+=event.quantity;
  }
  return unknown;
}

export function normalizeSupplyWarehouse(payload) {
  if (payload.supplyEntry?.version !== 1) return { supplies: [], supplyEvents: [], supplyEntryVersion: 0, supplyExpiryVersion:0 };
  if (!Array.isArray(payload.supplies) || payload.supplies.length>1000 || !Array.isArray(payload.supplyEvents) || payload.supplyEvents.length>100000) throw new Error('泡麵與碳粉庫存資料格式不正確。');
  const ids=new Set(),eventIds=new Set();
  const validCount=value=>Number.isSafeInteger(value)&&value>=0&&value<=999999;
  const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
  const supplies=payload.supplies.map(item=>{
    if(!item||typeof item.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(item.id)||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||!Object.hasOwn(SUPPLY_KINDS,item.kind)||!['碗','杯','盒'].includes(item.unit)||typeof item.active!=='boolean')throw new Error('泡麵與碳粉品項格式不正確。');
    const known=SUPPLY_CATALOG.find(known=>known.id===item.id);
    if(known&&(known.kind!==item.kind||known.unit!==item.unit))throw new Error('泡麵與碳粉單位不符合已確認設定。');
    if(item.kind==='toner'&&!SUPPLY_CATALOG.some(known=>known.kind==='toner'&&known.id===item.id))throw new Error('碳粉限黑、黃、紅、藍四個顏色。');
    if(item.stock!==null&&!validCount(item.stock))throw new Error('泡麵與碳粉庫存數量不正確。');
    if(item.lastCountAt!==null&&!validDate(item.lastCountAt))throw new Error('泡麵與碳粉盤點時間不正確。');
    ids.add(item.id);
    return {id:item.id,name:item.name.trim(),kind:item.kind,unit:item.unit,active:item.active,stock:item.stock,lastCountAt:item.lastCountAt};
  });
  const supplyEvents=payload.supplyEvents.map(event=>{
    if(!event||typeof event.id!=='string'||!event.id||event.id.length>240||eventIds.has(event.id)||!ids.has(event.supplyId)||!['count','restock','expiry-close'].includes(event.type)||!validCount(event.quantity)||(event.type==='restock'&&event.quantity===0)||(event.type==='expiry-close'&&event.quantity!==0)||!validDate(event.createdAt)||event.accepted===false||typeof event.recorder!=='string'||!event.recorder.trim()||event.recorder.length>80||typeof event.note!=='string'||event.note.length>500)throw new Error('泡麵與碳粉異動紀錄不正確。');
    const expiresOn=event.expiresOn||null,batchId=event.batchId||null;
    if(expiresOn!==null&&!validSupplyExpiry(expiresOn))throw new Error('保存期限格式不正確。');
    if(event.type==='expiry-close'&&(typeof batchId!=='string'||batchId.length>240||!batchId))throw new Error('效期批次代號不正確。');
    eventIds.add(event.id);
    return {id:event.id,supplyId:event.supplyId,type:event.type,quantity:event.quantity,createdAt:event.createdAt,recorder:event.recorder,note:event.note,expiresOn,batchId};
  });
  for(const event of supplyEvents.filter(event=>event.type==='expiry-close')){
    const batch=supplyEvents.find(batch=>batch.id===event.batchId&&batch.type==='restock'&&batch.supplyId===event.supplyId);
    if(!batch||supplies.find(item=>item.id===event.supplyId)?.kind!=='noodle')throw new Error('效期批次來源不正確。');
  }
  return {supplies,supplyEvents,supplyEntryVersion:1,supplyExpiryVersion:payload.supplyEntry.expiryVersion===1?1:0};
}
