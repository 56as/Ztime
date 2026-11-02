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
