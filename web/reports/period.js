import {reportDuration} from '../shared/report-format.js';
import {reportCsv,safeField} from '../shared/report-csv.js';
import {reportData} from '../shared/report-model.js';
import {weekReport} from '../shared/week-report.js';
import {download} from './desktop.js';
import {showReportDialog} from './dialog.js';

const periods={day:['日报','分时用时'],week:['周报','每日用时'],month:['月报','每日用时'],year:['年报','每月用时']};
const scopes={all:'全部设备',windows:'电脑',android:'手机'};
const esc=value=>String(value).replace(/[\x00-\x1f]/g,' ').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

function scopedWeek(snapshot,scope){
 if(scope==='all')return snapshot;
 const includes=row=>row.platform===scope;
 const other=scope==='android'?'windows':'android';
 const restrict=aggregate=>({...aggregate,apps:aggregate.apps.filter(includes),totals:{...aggregate.totals,[other]:0},
   bins:aggregate.bins.map(bin=>({...bin,[other]:0}))});
 const {week}=snapshot,devices=snapshot.devices.filter(includes);
 return {...snapshot,devices,peers:snapshot.peers?.filter(peer=>devices.some(device=>device.id===peer.id)),
   week:{...week,current:restrict(week.current),previous:restrict(week.previous),changes:week.changes.filter(includes)}};
}

function barChart(series){
 const maximum=Math.max(1,...series.map(bin=>bin.minutes));
 const slot=420/Math.max(1,series.length);
 const step=Math.max(1,Math.ceil(series.length/6));
 const marks=series.map((bin,i)=>{
   const x=(i+.5)*slot,height=80*bin.minutes/maximum,width=Math.min(18,slot*.7);
   return `<g><title>${esc(bin.detail)} · ${reportDuration(bin.minutes*60000)}</title><rect x="${x-width/2}" y="${104-height}" width="${width}" height="${height}" rx="2" fill="#3786dd"/>${i%step===0?`<text x="${x}" y="122" text-anchor="middle">${esc(bin.label)}</text>`:''}</g>`;
 }).join('');
 const scale=Math.round(maximum/60*100)/100;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="128" viewBox="0 0 420 128" font-size="12" fill="currentColor" role="img" aria-label="用时分布，单位小时"><text x="0" y="14">${scale} 小时</text>${marks}</svg>`;
}

export function openPeriodReport(selection,dialog,weekly){
 const {mode,from,to,scope,result,series}=selection;
 const [name,chartTitle]=periods[mode],scopeName=scopes[scope];
 const range=(from===to?from:from+' 至 '+to)+' · '+scopeName;
 const bins=series.filter(bin=>bin.minutes!==null);
 const peak=bins.reduce((best,bin)=>!best||bin.minutes>best.minutes?bin:best,null);
 const observation=result.total&&peak?`${peak.detail} 用时最多，共 ${reportDuration(peak.minutes*60000)}。`:'这段时间没有使用记录。';
 const top=result.apps.slice(0,3);
 const total=reportDuration(result.total),chart=barChart(bins);
 const preview=`<section class="period-report"><p>${esc(range)}</p><strong>${total}</strong><h3>${chartTitle}</h3><div class="report-image">${chart}</div><p>${esc(observation)}</p><h3>主要应用</h3>${top.map(app=>`<div class="report-app"><span>${esc(app.name)}</span><b>${reportDuration(app.duration)}</b></div>`).join('')||'<p>暂无记录</p>'}</section>`;
 const lines=['Ztime '+name,range,'设备累计　'+total,chartTitle,...bins.map(bin=>bin.detail+'　'+reportDuration(bin.minutes*60000)),observation,'主要应用',...result.apps.map(app=>app.name+'　'+scopes[app.platform]+'　'+reportDuration(app.duration))];
 const rows=[['开始日期','结束日期','设备范围','分组','日期或应用','平台','本期分钟']];
 const add=(kind,label,platform,ms)=>rows.push([from,to,scopeName,kind,label,platform,Math.round(ms/600)/100]);
 add('合计','','',result.total);
 for(const bin of bins)add(chartTitle,bin.detail,'',bin.minutes*60000);
 for(const app of result.apps)add('应用',app.name,scopes[app.platform],app.duration);
 const week=weekly&&scopedWeek(weekly,scope);
 if(week)lines.push('',weekReport(week).content);
 const text=lines.join('\r\n');
 const csv=week?reportCsv(reportData(week),scope):rows.map(row=>row.map(safeField).join(',')).join('\r\n')+'\r\n';
 const label=(y,value,size)=>`<text x="24" y="${y}" font-size="${size}">${esc(value)}</text>`;
 const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="520" height="520" font-family="Microsoft YaHei,sans-serif" fill="#23354a"><rect width="100%" height="100%" fill="#fff"/>${label(48,'Ztime · '+name,26)}${label(80,range,15)}${label(124,total,26)}${label(165,chartTitle,18)}<g transform="translate(24,180)">${chart}</g>${label(343,observation,16)}${label(385,'主要应用',19)}${top.map((app,i)=>label(418+i*30,Array.from(app.name).slice(0,16).join('')+'　'+reportDuration(app.duration),16)).join('')}</svg>`;
 const formats=['txt','csv','pdf','png'].map(id=>[id,id.toUpperCase()]);
 showReportDialog(dialog,{title:name+'预览',preview,text,formats,async save(format){
   const filename='Ztime-'+name+'-'+from+'.'+format;
   const blob=format==='txt'||format==='csv'?new Blob(['\uFEFF',format==='txt'?text:csv],{type:(format==='txt'?'text/plain':'text/csv')+';charset=utf-8'}):await (await import('./image-export.js')).graphicExport(sheet,format);
   download(blob,filename);return {message:'已发起下载：'+filename};
 }});
}
