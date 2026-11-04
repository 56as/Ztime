import {aggregate} from './time.js';

// Both platforms compare the same elapsed portion of this week and last week.
export function summaryStats(sessions,devices,day,week,now){
 const today=aggregate(sessions,day.start,Math.min(day.end,now),devices);
 const current=aggregate(sessions,week.start,week.end,devices);
 const previous=aggregate(sessions,week.previous,week.previousEnd,devices);
 const apps=new Map(current.apps.map(app=>[app.key,{...app,previous:0}]));
 for(const app of previous.apps){
  if(!apps.has(app.key))apps.set(app.key,{...app,duration:0,previous:0});
  apps.get(app.key).previous=app.duration;
 }
 const changes=[...apps.values()].map(app=>({...app,change:app.duration-app.previous}))
  .sort((a,b)=>Math.abs(b.change)-Math.abs(a.change));
 return {today,week:{...week,current,previous,changes}};
}
