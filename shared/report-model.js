import {weekDays} from './dashboard.js';

import {deviceTotal,reportDuration} from './report-format.js';
export function reportData({week,settings,peers}){
 const days=weekDays(week,settings),total=deviceTotal(week.current.totals),prior=deviceTotal(week.previous.totals);
 const end=new Intl.DateTimeFormat('zh-CN',{timeZone:settings.timeZone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(week.end);
 const peak=days.filter(d=>d.available).sort((a,b)=>deviceTotal(b.current)-deviceTotal(a.current))[0];
 const top=week.current.apps[0],notes=[];
 if(!total)notes.push('本周尚无使用记录；空白不代表设备完全没有使用。');
 if(!prior&&total)notes.push('上周同期没有记录，无法计算有意义的增长比例。');
 if(peers?.some(p=>!p.last_sync||week.end-p.last_sync>86400000))notes.push('有配对设备尚未同步或已超过一天未同步，周报可能不完整。');
 notes.push('只比较两周的相同进度；多台设备同时使用时分别计入。');
 return {first:week.first,dayStart:settings.dayStart,devices:week.current.totals,previousDevices:week.previous.totals,apps:week.changes,days,total,delta:total-prior,range:week.first+' 至 '+end+' · '+settings.timeZone,
  observations:[peak&&total?`${peak.label}的设备累计用时最长：${reportDuration(deviceTotal(peak.current))}。`:'暂时没有可比较的每日用时。',
  top?`用时最多的应用：${top.name}（${top.platform==='windows'?'Windows':'Android'}），占设备累计用时的 ${Math.round(top.duration/total*100)}%。`:'有应用记录后，将显示本周占比最高的应用。'],notes};
}
