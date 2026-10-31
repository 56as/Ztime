import {addDays,dayBounds} from './time.js';
export function distribution(apps,device='all',count=5) {
 const items=apps.filter(a=>device==='all'||a.platform===device);
 const total=items.reduce((n,a)=>n+a.duration,0);
 if(!total)return [];
 const sorted=[...items].sort((a,b)=>b.duration-a.duration),limit=Math.max(1,Math.min(10,count));
 const slices=sorted.slice(0,limit).map(a=>({name:a.name,platform:a.platform,value:a.duration}));
 const other=sorted.slice(limit).reduce((n,a)=>n+a.duration,0);
 if(other)slices.push({name:'其他',value:other});
 return slices.map(a=>({...a,share:a.value/total}));
}
export function weekDays(week,settings) {
 const sum=(period,a,b)=>period.bins.reduce((total,bin)=>{
  const stop=Math.min(bin.start+3600000,period.end),overlap=Math.max(0,Math.min(stop,b)-Math.max(bin.start,a));
  if(stop<=bin.start||!overlap)return total;
  total.android+=bin.android*overlap/(stop-bin.start);total.windows+=bin.windows*overlap/(stop-bin.start);return total;
 },{android:0,windows:0});
 return Array.from({length:7},(_,i)=>{
  const date=addDays(week.first,i),now=dayBounds(date,settings),previous=dayBounds(addDays(date,-7),settings);
  return {date,label:['周一','周二','周三','周四','周五','周六','周日'][i],available:now.start<week.end,current:sum(week.current,now.start,now.end),previous:sum(week.previous,previous.start,previous.end)};
 });
}
