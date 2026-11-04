import {desktopTitles} from './shared/desktop-card-layout.js';
import {desktopUsageChart,desktopRankRow,usageArea,shareChart} from './desktop-insights.js';
import {label} from './period-calendar.js';

const windowsRankNames=new Map([
 ['chrome.exe','Chrome'],['weixin.exe','微信'],['code.exe','VS Code'],['ztime.exe','Ztime'],
 ['chatgpt.exe','ChatGPT'],['excel.exe','Excel'],['winword.exe','Word'],['photos.exe','照片'],
 ['taskmgr.exe','任务管理器'],['rustdesk.exe','RustDesk'],['tailscale-ipn.exe','Tailscale']
]);

export function chartSeries(result,mode,timeZone){
   const format=new Intl.DateTimeFormat('zh-CN',{timeZone,...(mode==='day'?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:mode==='year'?{year:'numeric',month:'long'}:{month:'short',day:'numeric'})});
   return result.bins.map((bin,i)=>{
     const end=Math.min(result.bins[i+1]?.start??result.end,result.end);
     return {label:bin.label,detail:format.format(bin.start)+(mode==='day'&&end>bin.start?'–'+format.format(end):''),
       minutes:bin.start>=result.end?null:bin.duration/60000,
       rows:(bin.apps||[]).map(app=>({name:app.name,platform:app.platform,minutes:app.duration/60000}))};
   });
 }
function renderComparison({desktop,mode,result,prior,comparison,duration}) {
   let body=!desktop?'':mode==='year'?'比较上年同期的使用情况。':'选择另一段日期，按统计日数比较日均用时。';
   if(prior && comparison) {
     const current=result.total/result.days, previous=prior.total/prior.days;
     const difference=Math.abs(current-previous);
     body=`${label(comparison)}<br>对比期累计　${duration(prior.total,true)}<br>本期日均 ${duration(current,true)} · 对比期日均 ${duration(previous,true)}<br><strong>${difference<60_000?'日均基本持平':'日均'+(current>previous?'增加 ':'减少 ')+duration(difference,true)}</strong>`;
   }
   return `<section class="period-card"><h2>期间对比</h2>${body?'<p>'+body+'</p>':''}<button data-cal="compare">${mode==='year'?'对比上年同期':comparison?'更改对比日期':'选择对比日期'}</button> ${comparison?'<button data-cal="clear">清除对比</button>':''}</section>`;
 }
function renderRanking({result,desktop,escape,duration}){
   const ranking=result.apps.map((app,index)=>{
     const device=app.platform==='android'?'手机':'电脑',percent=100*app.duration/result.apps[0].duration;
     if(!desktop)return `<button class="app-row" data-rank="${index}"><span class="app-name"><span class="phone-app-icon" aria-hidden="true">${escape(Array.from(app.name)[0]||'?')}${/^[^/\\]+$/.test(app.appId)?`<img alt="" loading="lazy" src="./app-icons/${app.platform==='android'?'android':'windows'}/${escape(encodeURIComponent(app.platform==='android'?app.appId:app.appId.toLowerCase()))}.png">`:''}</span>${escape(app.name)}</span><small>${device}</small><strong>${duration(app.duration,true)}</strong><span class="rank-track" aria-hidden="true"><i style="width:${percent}%"></i></span></button>`;
     const query=new URLSearchParams({v:'4',platform:app.platform,id:app.appId,name:app.name});
     const mono=app.platform==='windows' && app.appId.toLowerCase()==='chatgpt.exe';
     const icon=`<img class="review-app-icon" alt="" ${mono?'data-monochrome':''} src="/api/app-icon?${escape(query.toString())}">`;
     const name=(app.platform==='windows' && windowsRankNames.get(app.appId.toLowerCase()))||app.name;
     return desktopRankRow({name,icon,device,percent,index,minutes:Math.floor(app.duration/60000)});
   }).join('');
   return `<section class="period-card ranking-card${desktop?' desktop-rank-card':''}"><h2>应用排行</h2>${ranking?'<div class="rank-scroll" tabindex="0" role="region" aria-label="应用排行">'+ranking+'</div>':'<p>所选期间暂无使用记录</p>'}</section>`;
}
function renderTrend({desktop,mode,chartStyle,dailyChart,series,result,duration}){
   const formats=[['line','折线图'],['bar','柱形图']];
   if(mode==='day')formats.push(['ringdesk','环台']);
   const styleButtons='<div class="chart-style" role="group" aria-label="图表类型">'+formats.map(([key,label])=>`<button data-chart="${key}" aria-pressed="${(dailyChart||chartStyle)===key}">${label}</button>`).join('')+'</div>';
   return `<section class="period-card trend-card"><div class="pd-top"><h2>使用时间</h2>${desktop?styleButtons:'<small>单位：小时</small>'}</div>${dailyChart?'<section class="daily-clock ring-desk" aria-label="环台"></section>':desktop?desktopUsageChart(series,mode,chartStyle):usageArea(result.bins.map(b=>b.start>=result.end?{...b,duration:null}:b),ms=>duration(ms,true))}</section>`;
}

// Layout order determines which renderers run. Hidden cards do no formatting work.
export function renderCardGrid(options){
 const {layout,dailyChart,result,duration}=options;
 const clockActive=dailyChart && layout.some(card=>card.visible && card.key==='trend');
 const visible=layout.filter(card=>card.visible && !(clockActive && card.key==='ranking'));
 const clockOnly=clockActive && visible.length===1;
 const defaultPair=visible.length===2 && visible.every(card=>['trend','ranking'].includes(card.key));
 const cards=visible.map(({key})=>{
  if(key==='trend')return renderTrend(options);
  if(key==='ranking')return renderRanking(options);
  if(key==='compare')return renderComparison(options);
  return '<section class="period-card"><h2>'+desktopTitles[key]+'</h2>'+shareChart(key,result.apps,ms=>duration(ms,true))+'</section>';
 });
 return '<div class="pd-bottom'+(clockOnly?' clock-only':defaultPair?' default-pair':'')+'">'+cards.join('')+'</div>';
}
