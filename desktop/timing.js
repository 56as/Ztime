import {randomUUID} from 'node:crypto';

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

// Only unscheduled idle fragments can be restored. Counted sessions remain the
// single input to reports, classification and the existing device sync protocol.
export class IdleHistory{
 constructor(store){
  this.store=store;
  store.db.exec(`CREATE TABLE IF NOT EXISTS idle_parts(id INTEGER PRIMARY KEY,episode TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,app_id TEXT NOT NULL,app_name TEXT NOT NULL,site TEXT,restored_id TEXT);
    CREATE INDEX IF NOT EXISTS idle_episode ON idle_parts(episode,id);`);
 }
 add(episode,app,start,end){
  if(end<=start)return;
  const db=this.store.db,last=db.prepare('SELECT * FROM idle_parts WHERE episode=? ORDER BY id DESC LIMIT 1').get(episode);
  if(last && !last.restored_id && last.end===start && last.app_id===app.appId && last.site===(app.site??null))
   db.prepare('UPDATE idle_parts SET end=? WHERE id=?').run(end,last.id);
  else db.prepare('INSERT INTO idle_parts(episode,start,end,app_id,app_name,site) VALUES(?,?,?,?,?,?)').run(episode,start,end,app.appId,app.appName,app.site??null);
 }
 rewind(episode,cutoff,now){
  const store=this.store;
  for(const row of store.db.prepare('SELECT * FROM sessions WHERE device_id=? AND deleted_at IS NULL AND end>? AND start<? ORDER BY start').all(store.device.id,cutoff,now)){
   const app=store.decode(row);
   this.add(episode,app,Math.max(app.start,cutoff),app.end);
   if(app.start>=cutoff)store.markDeleted(app.id);
   else store.write({...app,end:cutoff});
  }
 }
 recent(active){
  return this.store.db.prepare(`SELECT episode,min(start) start,max(end) end,sum(end-start) duration,max(restored_id IS NOT NULL) restored FROM idle_parts WHERE episode<>? AND episode<>'schedule' GROUP BY episode ORDER BY end DESC LIMIT 30`).all(active??'');
 }
 restore(episode,count,active){
  if(typeof episode!=='string'||typeof count!=='boolean'||episode===active||episode==='schedule')throw Error('请选择已结束的待机时段');
  const store=this.store;
  store.transaction(()=>{
   const rows=store.db.prepare('SELECT * FROM idle_parts WHERE episode=?').all(episode);
   if(!rows.length)throw Error('时段不存在');
   for(const row of rows){
    if(Boolean(row.restored_id)===count)continue;
    let id=null;
    if(count){id=randomUUID();store.write({id,deviceId:store.device.id,appId:row.app_id,appName:row.app_name,start:row.start,end:row.end,site:row.site});}
    else store.markDeleted(row.restored_id);
    store.db.prepare('UPDATE idle_parts SET restored_id=? WHERE id=?').run(id,row.id);
   }
  });
 }
}
