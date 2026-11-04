export const DEFAULT_SETTINGS = { dayStart: 4, timeZone: 'Asia/Hong_Kong', weekStart: 1, revision: 'default', baseRevision: null };
const formatters = new Map();
export function zonedParts(time, timeZone) {
  if (!formatters.has(timeZone)) formatters.set(timeZone, new Intl.DateTimeFormat('en-CA', {timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  return Object.fromEntries(formatters.get(timeZone).formatToParts(new Date(time)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
export function dateKey(time, settings=DEFAULT_SETTINGS) {
  const p=zonedParts(time,settings.timeZone);
  const d=new Date(Date.UTC(p.year,p.month-1,p.day-(p.hour<settings.dayStart?1:0)));
  return d.toISOString().slice(0,10);
}
export function addDays(date,days){return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function wallTime(date,hour,timeZone){
  const [y,m,d]=date.split('-').map(Number), target=Date.UTC(y,m-1,d,hour);
  let guess=target;
  for(let i=0;i<6;i++){const p=zonedParts(guess,timeZone);const observed=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);const delta=target-observed;if(!delta)return guess;guess+=delta;}
  // A skipped local hour (DST) resolves forward to the first valid wall time.
  const candidates=[guess,guess+3600000,guess-3600000].sort((a,b)=>a-b);
  return candidates.find(t=>{const p=zonedParts(t,timeZone);return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)>=target;})??guess;
}
export function dayBounds(date,settings=DEFAULT_SETTINGS){return {start:wallTime(date,settings.dayStart,settings.timeZone),end:wallTime(addDays(date,1),settings.dayStart,settings.timeZone)};}
export function weekBounds(now,settings=DEFAULT_SETTINGS){const key=dateKey(now,settings);const weekday=new Date(key+'T12:00:00Z').getUTCDay();const first=addDays(key,-((weekday-settings.weekStart+7)%7));const start=dayBounds(first,settings).start;const previous=dayBounds(addDays(first,-7),settings).start;const end=Math.min(now,dayBounds(addDays(first,7),settings).start);const p=zonedParts(end,settings.timeZone);const endKey=`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;const previousEnd=wallTime(addDays(endKey,-7),p.hour,settings.timeZone)+p.minute*60000+p.second*1000+new Date(end).getUTCMilliseconds();return {start,end,previous,previousEnd,first};}
export function validSettings(value){try{return value&&Number.isInteger(value.dayStart)&&value.dayStart>=0&&value.dayStart<=23&&value.weekStart===1&&typeof value.revision==='string'&&value.revision.length<=80&&typeof value.timeZone==='string'&&!!new Intl.DateTimeFormat('en',{timeZone:value.timeZone});}catch{return false;}}
export function aggregate(sessions,start,end,devices=[]){
  const totals={windows:0,android:0};const apps=new Map();const bins=Array.from({length:Math.ceil((end-start)/3600000)},(_,i)=>({start:start+i*3600000,windows:0,android:0}));
  for(const s of sessions){if(s.deletedAt)continue;const a=Math.max(start,s.start),b=Math.min(end,s.end);if(b<=a)continue;const device=devices.find(d=>d.id===s.deviceId);const platform=device?.platform??s.platform??'windows';const kind=platform==='android'?'android':'windows';totals[kind]+=b-a;const key=s.deviceId+'|'+s.appId;const app=apps.get(key)??{key,appId:s.appId,name:s.appName,deviceId:s.deviceId,platform:kind,duration:0};app.duration+=b-a;apps.set(key,app);for(let t=a;t<b;){const i=Math.floor((t-start)/3600000);const stop=Math.min(b,start+(i+1)*3600000);if(bins[i])bins[i][kind]+=stop-t;t=stop;}}
  return {totals,apps:[...apps.values()].sort((a,b)=>b.duration-a.duration),bins,start,end};
}
