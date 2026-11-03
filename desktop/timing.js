
export const defaultTiming={auto:true,limit:5,schedule:false,repeat:'weekdays',start:'12:00',end:'13:00'};
export function validateTiming(value){
 const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
 if(!value||typeof value.auto!=='boolean'||typeof value.schedule!=='boolean'||![3,5,10,30].includes(value.limit)||
    !['weekdays','weekends','daily'].includes(value.repeat)||!time.test(value.start)||!time.test(value.end)||value.start===value.end)
   throw Error('请检查待机时间和屏蔽时段');
 return Object.fromEntries(Object.keys(defaultTiming).map(k=>[k,value[k]]));
}
const clocks=new Map();
export function scheduled(at,config,zone){
 if(!config.schedule)return false;
 if(!clocks.has(zone))clocks.set(zone,new Intl.DateTimeFormat('en-GB',{timeZone:zone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
 const parts=Object.fromEntries(clocks.get(zone).formatToParts(at).map(p=>[p.type,p.value]));
 const clock=parts.hour+':'+parts.minute;
 let day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
 if(config.start<config.end){
   if(clock<config.start||clock>=config.end)return false;
 }else if(clock<config.end)day=(day+6)%7;
 else if(clock<config.start)return false;
 const weekend=day===0||day===6;
 return config.repeat==='daily'||(config.repeat==='weekends')===weekend;
}

// Remove provisional usage back to the last input when the idle threshold is reached.
export function excludeIdleTail(store,cutoff,now){
 const rows=store.db.prepare('SELECT * FROM sessions WHERE device_id=? AND deleted_at IS NULL AND end>? AND start<?').all(store.device.id,cutoff,now);
 for(const row of rows){
  if(row.start>=cutoff)store.markDeleted(row.id);
  else store.write({...store.decode(row),end:cutoff});
 }
}
