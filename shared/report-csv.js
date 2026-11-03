const mins=ms=>Math.round(ms/60000*100)/100;
export const safeField=v=>{let s=String(v).replace(/[\x00-\x1f]/g,' ');if(typeof v==='string'&&/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function reportCsv(m,scope='all'){
 const rows=[['统计周起点','截至（含时区）','分组','日期或应用','平台','本期分钟','上期同期分钟','变化分钟']];
 const add=(category,label,platform,now,previous)=>rows.push([m.first,m.range,category,label,platform,mins(now),mins(previous),mins(now-previous)]);
 for(const p of ['windows','android']){
  if(scope!=='all'&&scope!==p)continue;
  add('设备合计','',p,m.devices[p],m.previousDevices[p]);
  for(const d of m.days.filter(x=>x.available))add('每日',d.date,p,d.current[p],d.previous[p]);
 }
 for(const app of m.apps)add('应用',app.name,app.platform,app.duration,app.previous);
 const scopeName={all:'全部设备',android:'手机',windows:'电脑'}[scope];
 rows.forEach((row,i)=>row.push(i?scopeName:'设备范围'));
 return rows.map(r=>r.map(safeField).join(',')).join('\r\n')+'\r\n';
}
