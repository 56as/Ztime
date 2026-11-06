import {addDays, dateKey, dayBounds, zonedParts} from './time.js';

const DAY = 86_400_000;
export function periodBounds(from, to, settings, now = Date.now()) {
  for (const key of [from, to]) {
    const value = Date.parse(key + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(value) ||
        new Date(value).toISOString().slice(0, 10) !== key) throw Error('日期无效');
  }
  const days = (Date.parse(to) - Date.parse(from)) / DAY + 1;
  if (days < 1 || days > 366 || to > dateKey(now, settings)) throw Error('时间范围无效');
  return {start:dayBounds(from, settings).start, end:Math.min(now, dayBounds(to, settings).end), days};
}

export function periodStats(rows, devices, settings, from, to, mode, scope, now = Date.now(), detail = false) {
  const {includeBinApps,includeSessions} = typeof detail === 'boolean'
    ? {includeBinApps:detail,includeSessions:detail} : detail;
  const {start, end, days} = periodBounds(from, to, settings, now);
  const bins = [];
  if (mode === 'day') {
    const stop = dayBounds(to, settings).end;
    for (let at = start; at < stop; at += 3_600_000)
      bins.push({start:at, label:String(zonedParts(at, settings.timeZone).hour).padStart(2,'0'), duration:0});
  } else if (mode === 'year') {
    for (let month = 1; month <= 12; month++) {
      const key = from.slice(0,4) + '-' + String(month).padStart(2,'0') + '-01';
      bins.push({start:dayBounds(key, settings).start, label:month+'月', duration:key > to ? null : 0});
    }
  } else {
    for (let key = from; key <= to; key = addDays(key,1))
      bins.push({start:dayBounds(key, settings).start, label:String(Number(key.slice(-2))), duration:0});
  }
  const sessions = includeSessions && mode === 'day' && from === to ? [] : null;
  const perBin = includeBinApps ? bins.map(()=>new Map()) : null;
  const platforms = new Map(devices.map(d=>[d.id,d.platform]));
  const apps = new Map();
  let total = 0;
  for (const row of rows) {
    const platform = platforms.get(row.deviceId) || row.platform || 'windows';
    if (row.deletedAt || (scope !== 'all' && scope !== platform)) continue;
    const a = Math.max(start,row.start), b = Math.min(end,row.end);
    if (a >= b) continue;
    if(sessions)sessions.push({appId:row.appId,deviceId:row.deviceId,device:platform==='android'?'phone':'pc',name:row.appName,start:(a-start)/60000,end:(b-start)/60000,minutes:(b-a)/60000});
    const key = JSON.stringify([row.deviceId,row.appId]);
    const app = apps.get(key) || {name:row.appName,appId:row.appId,deviceId:row.deviceId,platform,duration:0};
    app.duration += b-a;
    apps.set(key,app);
    total += b-a;
    const firstAfter = bins.findIndex(bin=>bin.start > a);
    for (let i = firstAfter < 0 ? bins.length-1 : Math.max(0, firstAfter-1); i < bins.length && bins[i].start < b; i++) {
      const overlap=Math.min(b,bins[i+1]?.start ?? end) - Math.max(a,bins[i].start);
      bins[i].duration+=overlap;
      if(perBin)perBin[i].set(key,(perBin[i].get(key)||0)+overlap);
    }
  }
  if(perBin)bins.forEach((bin,i)=>{
    bin.apps=Array.from(perBin[i],([key,duration])=>({...apps.get(key),duration})).sort((a,b)=>b.duration-a.duration);
  });
  return {start,end,days,total,bins,...(sessions?{sessions,dayMinutes:(dayBounds(to,settings).end-start)/60000}:{}),apps:[...apps.values()].sort((a,b)=>b.duration-a.duration)};
}
