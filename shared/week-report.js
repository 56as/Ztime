const clean = value => String(value).replace(/[\r\n\t\u0000-\u001f]/g,' ').trim();
function duration(ms) {
  const minutes=Math.floor(ms/60000);
  if(ms>0 && !minutes)return '不足 1 分钟';
  return minutes>=60 ? Math.floor(minutes/60)+' 小时 '+minutes%60+' 分钟' : minutes+' 分钟';
}
function change(ms) {
  return ms===0?'持平':(ms>0?'增加 ':'减少 ')+duration(Math.abs(ms));
}
export function weekReport(data) {
  const {week,settings}=data;
  const format=new Intl.DateTimeFormat('zh-CN',{timeZone:settings.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const lines=['Ztime 每周使用报告','',
    '本周　'+format.format(week.start)+' 至 '+format.format(week.end),
    '对照　'+format.format(week.previous.start)+' 至 '+format.format(week.previousEnd),
    '时区　'+settings.timeZone+'，统计日从 '+settings.dayStart+' 时开始','',
    '设备用时（多台设备同时使用时分别计入）'];
  let total=0,previous=0;
  for(const [platform,label] of [['windows','Windows'],['android','Android']]) {
    const current=week.current.totals[platform], prior=week.previous.totals[platform];
    total+=current;previous+=prior;
    lines.push(label+'　'+duration(current)+'，上周同期 '+duration(prior)+'，'+change(current-prior));
  }
  lines.push('设备累计　'+duration(total)+'，'+change(total-previous),'','本周使用最多的应用');
  const apps=week.current.apps.slice(0,5);
  if(!apps.length)lines.push('此期间尚无已记录的应用用时。');
  apps.forEach((a,i)=>lines.push((i+1)+'. '+clean(a.name)+'（'+(a.platform==='android'?'Android':'Windows')+'）　'+duration(a.duration)));
  lines.push('','与上周同期相比，变化最大的应用');
  const changes=week.changes.filter(x=>x.change!==0).slice(0,3);
  if(!changes.length)lines.push('暂无变化。');
  for(const a of changes)lines.push(clean(a.name)+'（'+(a.platform==='android'?'Android':'Windows')+'）　'+change(a.change));
  lines.push('','数据范围');
  for(const d of data.devices){
    const peer=data.peers?.find(p=>p.id===d.id);
    const status=d.local?'本机记录':peer?.last_sync?'最近同步 '+format.format(peer.last_sync):peer?'尚未完成同步':'未配对，显示已有记录';
    lines.push(clean(d.name)+'　'+status);
  }
  return {filename:'Ztime-周报-'+week.first+'.txt',content:lines.join('\r\n')+'\r\n'};
}
