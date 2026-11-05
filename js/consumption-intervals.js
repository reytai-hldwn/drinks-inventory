/** Include short adjacent counts in a long enough observation, without extrapolating minutes alone. */
export function completeConsumptionIntervals(segments) {
  const measured=[];let chain=[];
  const merge=(left,right)=>({...left,endAt:right.endAt,endQuantity:right.endQuantity,arrivals:left.arrivals+right.arrivals,consumed:left.consumed+right.consumed,days:left.days+right.days,status:'ready'});
  const finish=()=>{
    const first=measured.length;let pending=null;
    for(const segment of chain){
      pending=pending?merge(pending,segment):{...segment};
      if(pending.days>=1){measured.push({...pending,status:'ready'});pending=null;}
    }
    // The final morning count may be earlier than yesterday's. Extend the last
    // complete interval instead of dropping its newly observed consumption.
    if(pending&&measured.length>first)measured[measured.length-1]=merge(measured.at(-1),pending);
    chain=[];
  };
  for(const segment of segments){
    const valid=['ready','short'].includes(segment.status)&&Number.isSafeInteger(segment.consumed)&&segment.consumed>=0&&Number.isFinite(segment.days)&&segment.days>=0;
    if(!valid||(chain.length&&chain.at(-1).endAt!==segment.startAt))finish();
    if(valid)chain.push(segment);
  }
  finish();return measured;
}
