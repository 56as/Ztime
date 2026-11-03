import {addDays,dayBounds} from './time.js';
export const missing='未分类';
export function behaviorRange(anchor,mode){
 const d=new Date(anchor+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(anchor)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==anchor||+anchor.slice(0,4)<1900||+anchor.slice(0,4)>9998)throw Error('日期无效');
 if(mode==='day')return [anchor,anchor];
 if(mode==='week'){const start=addDays(anchor,-((d.getUTCDay()+6)%7));return [start,addDays(start,6)];}
 if(mode==='year')return [anchor.slice(0,4)+'-01-01',anchor.slice(0,4)+'-12-31'];
 throw Error('周期无效');
}
// Sessions arrive ordered by start. Only the part inside each accounting day contributes.
export function behaviorRows(sessions,settings,first,last){
 const days=[];
 for(let date=first;date<=last;date=addDays(date,1))days.push({date,...dayBounds(date,settings)});
 const rows=[];let i=0;
 for(const s of sessions){
  while(i<days.length&&days[i].end<=s.start)i++;
  for(let j=i;j<days.length&&days[j].start<s.end;j++){
   const day=days[j],start=Math.max(day.start,s.start),end=Math.min(day.end,s.end);
   if(end>start)rows.push({id:s.id,date:day.date,start,end,app:s.app,platform:s.platform,category:s.override??s.rule??missing,manual:s.override!=null});
  }
 }
 return rows;
}

const weekdays=['周日','周一','周二','周三','周四','周五','周六'];
const weekday=date=>new Date(date+'T12:00:00Z').getUTCDay();
const monthDay=date=>Number(date.slice(5,7))+'月'+Number(date.slice(8))+'日';
export function behaviorDateLabel(first,last,today){
 const year=first.slice(0,4),prefix=year===today.slice(0,4)?'':year+'年';
 if(first===last)return prefix+monthDay(first)+' '+weekdays[weekday(first)];
 const finish=year!==last.slice(0,4)?last.slice(0,4)+'年'+monthDay(last):first.slice(0,7)!==last.slice(0,7)?monthDay(last):Number(last.slice(8))+'日';
 return prefix+monthDay(first)+'至'+finish;
}

// Rows are already clipped to accounting days. Only contributions are split
// at an hour boundary; the selectable source row keeps its original identity.
export function behaviorBuckets(rows,{mode,first,last,today,settings,clock}){
 const bins=[];
 const bucket=(key,label,title)=>({key,label,title,rows:[],duration:0,categories:new Map()});
 function add(bin,row,duration){
  bin.rows.push(row);bin.duration+=duration;
  bin.categories.set(row.category,(bin.categories.get(row.category)||0)+duration);
 }
 if(mode==='day'){
  const {start,end}=dayBounds(first,settings);
  for(let t=start;t<end;t+=3600000){
   const label=clock.format(t);
   bins.push(bucket(String(t),label,label+'–'+clock.format(Math.min(t+3600000,end))));
  }
  for(const row of rows){
   for(let t=row.start;t<row.end;){
    const i=Math.floor((t-start)/3600000),stop=Math.min(row.end,start+(i+1)*3600000);
    add(bins[i],row,stop-t);t=stop;
   }
  }
 }else{
  const byDate=new Map();
  for(let date=first;date<=last;date=addDays(date,1)){
   if(date===first || mode==='week' || weekday(date)===1)bins.push(bucket(date,mode==='week'?weekdays[weekday(date)]:'第'+(bins.length+1)+'周',''));
   const bin=bins.at(-1);bin.title=behaviorDateLabel(bin.key,date,today);byDate.set(date,bin);
  }
  for(const row of rows)add(byDate.get(row.date),row,row.end-row.start);
 }
 return bins;
}
