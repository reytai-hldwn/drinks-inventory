import { workingDaysBetween, WORKWEEK_DAYS } from './workdays.js';
import { completeConsumptionIntervals } from './consumption-intervals.js';

/** Read-only, measured consumption between completed real stocktakes. */
export const CONSUMPTION_KINDS = Object.freeze({drink:'飲料',snack:'零食'});
const CONSUMPTION_DAY = 86400000;

export function buildConsumptionRecords({drinks=[],supplies=[],events=[],supplyEvents=[]}, now=Date.now()) {
  const until=+new Date(now),rows=new Map(),supplyKinds=new Map();
  for(const item of supplies)supplyKinds.set(item.id,item.kind);
  for(const item of [...drinks.map(item=>({...item,kind:'drink'})),...supplies]){
    if(Object.hasOwn(CONSUMPTION_KINDS,item.kind))rows.set(`${item.kind}:${item.id}`,{...item,counts:0,latestCountAt:null,segments:[],invalidEvents:0,timeline:[]});
  }
  for(const [index,event] of [...events,...supplyEvents].entries()){
    const kind=event.drinkId?'drink':supplyKinds.get(event.supplyId),row=rows.get(`${kind}:${event.drinkId||event.supplyId}`),stamp=Date.parse(event.createdAt);
    if(!row||event.accepted===false||!['count','restock'].includes(event.type)||!Number.isFinite(stamp)||stamp>until)continue;
    row.timeline.push({event,index,stamp});
  }
  for(const row of rows.values()){
    let previous=null,received=0,invalid=false;
    row.timeline.sort((a,b)=>a.stamp-b.stamp||a.index-b.index);
    for(const current of row.timeline){
      const event=current.event,valid=Number.isSafeInteger(event.quantity)&&event.quantity>=0;
      if(event.type==='restock'){
        if(previous){if(valid&&Number.isSafeInteger(received+event.quantity))received+=event.quantity;else invalid=true;}
        continue;
      }
      if(!valid){row.invalidEvents++;previous=null;received=0;invalid=false;continue;}
      row.counts++;row.latestCountAt=event.createdAt;
      if(previous){
        const days=workingDaysBetween(previous.stamp,current.stamp),amount=previous.event.quantity+received-event.quantity;
        const status=invalid||!Number.isSafeInteger(amount)?'invalid':amount<0?'adjustment':days<1?'short':previous.event.quantity===0&&received===0&&event.quantity===0?'unavailable':'ready';
        row.segments.push({startAt:previous.event.createdAt,endAt:event.createdAt,startQuantity:previous.event.quantity,arrivals:received,endQuantity:event.quantity,consumed:['ready','short'].includes(status)?amount:null,days,status});
      }
      previous=current;received=0;invalid=false;
    }
    delete row.timeline;
  }
  return [...rows.values()];
}

export function consumptionPeriod(records,{days=30,now=Date.now()}={}) {
  const until=+new Date(now),since=days===0?-Infinity:until-days*CONSUMPTION_DAY;
  return records.map(row=>{
    // Keep complete intervals inside the window; never prorate unobserved days.
    const segments=row.segments.filter(segment=>Date.parse(segment.startAt)>=since&&Date.parse(segment.endAt)<=until),measured=completeConsumptionIntervals(segments);
    const observedDays=measured.reduce((sum,segment)=>sum+segment.days,0),consumed=measured.reduce((sum,segment)=>sum+segment.consumed,0),weekly=observedDays?consumed/observedDays*WORKWEEK_DAYS:null;
    const issue=segments.some(segment=>['invalid','adjustment'].includes(segment.status))||row.invalidEvents>0;
    const reason=row.counts===0?'尚未實際盤點':row.counts===1?'等待下次盤點':issue?'盤點差額待確認':segments.some(segment=>segment.status==='unavailable')?'區間內沒有庫存':segments.some(segment=>segment.status==='short')?'連續觀察未滿一個工作日':'期間內尚無完整盤點區間';
    return {...row,measured,observedDays,consumed,weekly,issue,reason};
  });
}

/** Drink packages can be ranked together; snacks retain their physical-unit filter. All filters stay local. */
export function selectConsumption(records,state={}) {
  const kind=Object.hasOwn(CONSUMPTION_KINDS,state.kind)?state.kind:'drink';
  const kindRows=records.filter(row=>row.kind===kind&&(state.archived||row.active!==false));
  const unitCounts=new Map();for(const row of kindRows)unitCounts.set(row.unit,(unitCounts.get(row.unit)||0)+1);
  const units=[...(kind==='drink'?['*']:[]),...[...unitCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-TW')).map(([unit])=>unit)],unit=units.includes(state.unit)?state.unit:units[0]||'';
  const categories=[...new Set(kindRows.filter(row=>(unit==='*'||row.unit===unit)).map(row=>row.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-TW'));
  const category=categories.includes(state.category)?state.category:'';
  const query=String(state.query||'').normalize('NFKC').trim().toLocaleLowerCase();
  const items=kindRows.filter(row=>(unit==='*'||row.unit===unit)&&(!category||row.category===category)&&(!query||`${row.name} ${row.flavor||''}`.normalize('NFKC').toLocaleLowerCase().includes(query)));
  const nameOrder=(a,b)=>a.name.localeCompare(b.name,'zh-TW')||(a.flavor||'').localeCompare(b.flavor||'','zh-TW')||a.id.localeCompare(b.id);
  return {kind,unit,units,category,categories,items,kindRows:kindRows.filter(row=>(unit==='*'||row.unit===unit)),ranked:items.filter(row=>row.weekly!==null&&row.weekly>0).sort((a,b)=>b.weekly-a.weekly||nameOrder(a,b)),pending:items.filter(row=>row.weekly===null).sort(nameOrder),zero:items.filter(row=>row.weekly===0).sort(nameOrder),observed:items.filter(row=>row.weekly!==null).length};
}
