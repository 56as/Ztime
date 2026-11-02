import {recordingStatus} from './recording-status.js';
import {desktopTitles,desktopLayout} from './shared/desktop-card-layout.js';
import {usageArea,shareChart,desktopUsageChart,bindDesktopPoints,desktopRankRow} from './desktop-insights.js';
import {bindPhoneUsage} from './phone-usage.js';
import {refreshControl} from './refresh-control.js';
import {cardTitles,defaultCardLayout,validCardLayout} from './shared/period-layout.js';
import {dateKey} from './shared/time.js';
import {periodStats} from './shared/period.js';

const windowsRankNames=new Map([
 ['chrome.exe','Chrome'],['weixin.exe','微信'],['code.exe','VS Code'],['ztime.exe','Ztime'],
 ['chatgpt.exe','ChatGPT'],['excel.exe','Excel'],['winword.exe','Word'],['photos.exe','照片'],
 ['taskmgr.exe','任务管理器'],['rustdesk.exe','RustDesk'],['tailscale-ipn.exe','Tailscale']
]);

// Keep the selection when moving between dashboard, devices and settings.
export function createPeriodView({api, escape, duration, details, report, refreshPhone, onError}) {
 let selectedPoint=null, pointPeriod='';
 let chartStyle='line';
 let desktop=false, rankOffset=0, rankPeriod='';
 const DAY=86400000, iso=n=>new Date(n*DAY).toISOString().slice(0,10), num=s=>Date.parse(s+'T00:00:00Z')/DAY;
 let today;
 const ymd=(y,m,day=1)=>Date.UTC(y,m,day)/DAY;
 const month=n=>iso(n).slice(0,7),stamp=n=>iso(n).replaceAll('-','/'),short=n=>iso(n).slice(5).replace('-','/');
 const dt=n=>new Date(n*DAY),first=n=>ymd(dt(n).getUTCFullYear(),dt(n).getUTCMonth()),nextMonth=n=>ymd(dt(n).getUTCFullYear(),dt(n).getUTCMonth()+1);
 const yr=n=>dt(n).getUTCFullYear(), dayOf=n=>dt(n).getUTCDate(),len=r=>r[1]-r[0]+1;
 const modes={day:'日',week:'周',month:'月',year:'年'};
 const span=(mode,n)=>{let a=n,b=n;
  if(mode==='week'){const mon=n-(dt(n).getUTCDay()+6)%7;a=mon;b=mon+6;}
  if(mode==='month'){a=first(n);b=nextMonth(n)-1;}
  if(mode==='year'){a=ymd(yr(n),0);b=ymd(yr(n)+1,0)-1;}
  return [a,Math.min(b,today)];
 };

 const label=r=>len(r)===1?stamp(r[0]):stamp(r[0])+' – '+short(r[1]);
 let mode='day', period, comparison=null, scope='all', picker=null, followToday=true;
 let host, snapshot, revision=0, result, prior, loadedKey;
 const queryScope=()=>({all:'all',phone:'android',pc:'windows'})[scope];
 async function read(range, kind) {
   const from=iso(range[0]), to=iso(range[1]);
   if(snapshot.native)return periodStats(snapshot.sessions,snapshot.devices,snapshot.settings,from,to,kind,queryScope());
   return api('/api/period?'+new URLSearchParams({from,to,mode:kind,scope:queryScope()}));
 }
 let layout, draft=null, saving=false, openerSelector;
 const dialog=document.createElement('dialog');
 dialog.className='period-dialog';
 document.body.append(dialog);

 function layoutPanel() {
   const rows=draft.map(({key,visible},index)=>{
     const name=(desktop?desktopTitles:cardTitles)[key];
     return `<div class="layout-row"><b>${name}</b><button data-shift="-1" data-key="${key}" aria-label="上移${name}" ${index===0?'disabled':''}>↑</button><button data-shift="1" data-key="${key}" aria-label="下移${name}" ${index===draft.length-1?'disabled':''}>↓</button><button data-toggle="${key}" aria-pressed="${visible}">${visible?'已添加':'添加'}</button></div>`;
   }).join('');
   return `<section class="pd-picker"><h2>${desktop?'统计布局':'仪表盘布局'}</h2><p>调整卡片顺序和显示状态。</p>${rows}<div class="pd-end"><button data-cal="cancel">取消</button><button data-save class="pd-primary">保存布局</button></div><p class="layout-error" role="status"></p></section>`;
 }
 function drawModal() {
   const active=document.activeElement;
   const focusKey=active && dialog.contains(active) ? [...active.attributes].filter(a=>a.name.startsWith('data-')).map(a=>'['+a.name+'="'+CSS.escape(a.value)+'"]').join('') : '';
   dialog.innerHTML=draft?layoutPanel():calendar();
   dialog.setAttribute('aria-label',draft?(desktop?'统计布局':'仪表盘布局'):picker.target==='year'?'选择年份':picker.target==='comparison'?'选择对比区间':'选择统计区间');
   if(!dialog.open)dialog.showModal();
   if(focusKey)dialog.querySelector(focusKey)?.focus({preventScroll:true});
 }
 function closeModal(){
   if(!dialog.open)return false;
   if(saving)return true;
   draft=null;picker=null;dialog.close();
   host?.querySelector(openerSelector)?.focus({preventScroll:true});
   return true;
 }
 dialog.oncancel=event=>{event.preventDefault();closeModal();};
 dialog.onchange=event=>{
   const edge=event.target.dataset.edge;
   if(!picker || !edge)return;
   picker[edge]=event.target.value;
   picker.error=valid(picker);
   if(edge==='start' && Number.isInteger(num(picker.start)))picker.month=first(num(picker.start));
   drawModal();
 };
 dialog.onclick=async event=>{
   if(saving)return;
   const button=event.target.closest('button');
   if(!button){
     if(event.target===dialog){const rect=dialog.getBoundingClientRect();
       if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}
     return;
   }
   if(button.dataset.cal==='cancel'){closeModal();return;}
   if(button.hasAttribute('data-save')){
     saving=true;button.disabled=true;
     try{
       await api('/api/period-layout','PUT',{cards:draft});
       layout=draft;saving=false;closeModal();paint();
       host.querySelector('[data-tool=layout]')?.focus();
     }catch(error){saving=false;button.disabled=false;dialog.querySelector('.layout-error').textContent=error.message;}
   }else if(button.dataset.toggle){
     const card=draft.find(row=>row.key===button.dataset.toggle);
     card.visible=!card.visible;drawModal();
   }else if(button.dataset.shift){
     const i=draft.findIndex(row=>row.key===button.dataset.key),j=i+Number(button.dataset.shift);
     if(j>=0 && j<draft.length)[draft[i],draft[j]]=[draft[j],draft[i]];
     drawModal();
   }else act(button);
 };
 function promptPicker(target){
  const r=target==='comparison'?(comparison||period):period;
  const start=Math.max(r[0],first(r[1]));
  picker={target,month:first(start),start:iso(start),end:iso(r[1]),second:false,error:''};
 }
 function valid(p){const a=num(p.start),b=num(p.end);if(!Number.isInteger(a)||!Number.isInteger(b))return '请选择完整的起止日期。';if(b<a)return '结束日期不能早于开始日期。';if(month(a)!==month(b)||b-a+1>31)return '起止日期须在同一个自然月内，最多 31 天。';if(b>today)return '只能选择今天或更早的日期。';return '';}
 function calendar(){
  if(!picker)return '';if(picker.target==='year')return '<section class="pd-picker" aria-label="选择年份"><strong>选择年份</strong><div class="pd-short"><select aria-label="年份" id="pd-year">'+Array.from({length:yr(today)-1969},(_,i)=>yr(today)-i).map(y=>'<option '+(y===yr(period[0])?'selected':'')+'>'+y+'</option>').join('')+'</select><button class="pd-primary" data-cal="apply-year">查看全年</button><button data-cal="cancel">取消</button></div></section>';const p=picker,m=p.month,offset=(dt(m).getUTCDay()+6)%7,days=nextMonth(m)-m;
  const cells=Array.from({length:offset},()=>'<i></i>').join('')+Array.from({length:days},(_,i)=>{const n=m+i,s=iso(n),cl=s===p.start||s===p.end?'cap':s>p.start&&s<p.end?'inside':'';
   return '<button data-cal="pick" data-n="'+n+'" data-style-id="cal-day-'+s+'" class="'+cl+'" aria-label="'+s+'" '+(n>today?'disabled':'')+'>'+dayOf(n)+'</button>';}).join('');
  return '<section class="pd-picker" id="pd-picker" aria-label="日期选择"><div class="pd-top"><strong>'+(p.target==='comparison'?'选择对比区间':'选择统计区间')+'</strong><button data-cal="cancel" aria-label="关闭日历">关闭</button></div><div class="pd-short"><button data-cal="today">今天</button><button data-cal="yesterday">昨天</button></div><div class="pd-month"><button data-cal="back-month" aria-label="上个月">‹</button><strong>'+yr(m)+' 年 '+(dt(m).getUTCMonth()+1)+' 月</strong><button data-cal="next-month" aria-label="下个月" '+(nextMonth(m)>today?'disabled':'')+'>›</button></div><div class="pd-grid">'+[...'一二三四五六日'].map(x=>'<small>'+x+'</small>').join('')+cells+'</div><div class="pd-inputs"><label>开始日期<input type="date" data-edge="start" max="'+iso(today)+'" value="'+p.start+'"></label><label>结束日期<input type="date" data-edge="end" max="'+iso(today)+'" value="'+p.end+'"></label></div><p class="pd-help" role="status">'+(p.error||(p.second?'再点结束日，或直接应用为单日。':'选同月起止日，最多 31 天。'))+'</p><div class="pd-end"><button data-cal="cancel">取消</button><button class="pd-primary" data-cal="apply">应用区间</button></div></section>';
 }
 function choose(m,n){mode=m;period=span(m,n);comparison=null;picker=null;}
 function act(button){
  const a=button.dataset.cal;if(!a)return false;
  if(a==='mode'){const m=button.dataset.mode;if(m==='custom')promptPicker('period');else choose(m,Math.min(period[1],today));}
  if(a==='dates'){openerSelector='[data-cal=dates]';if(mode==='year')picker={target:'year'};else promptPicker('period');}
  if(a==='prev'||a==='next'){
   const k=a==='prev'?-1:1,n=k<0?period[0]-1:period[1]+1;
   if(mode==='custom'){const m=first(n);const limit=nextMonth(m)-1;const start=k<0?Math.max(m,n-len(period)+1):n;period=[start,Math.min(k<0?n:start+len(period)-1,limit,today)];comparison=null;picker=null;}
   else choose(mode,n);
  }
  if(a==='apply-year')choose('year',ymd(+dialog.querySelector('#pd-year').value,0));
  if(a==='compare'){openerSelector='[data-cal=compare]';if(mode==='year'){const year=yr(period[0])-1,e=dt(period[1]);const m=e.getUTCMonth();comparison=[ymd(year,0),Math.min(ymd(year,m,e.getUTCDate()),ymd(year,m+1)-1)];}else promptPicker('comparison');}
  if(a==='clear'){comparison=null;picker=null;}
  if(a==='scope')scope=button.dataset.scope;
  if(a==='today'||a==='yesterday'){const n=today-(a==='yesterday'?1:0);picker.start=picker.end=iso(n);picker.month=first(n);picker.second=false;picker.error='';}
  if(a==='cancel')picker=null;
  if(a==='back-month'||a==='next-month'){picker.month=a==='back-month'?first(picker.month-1):nextMonth(picker.month);}
  if(a==='pick'){const s=iso(+button.dataset.n);if(!picker.second){picker.start=picker.end=s;picker.second=true;picker.error='';}
   else if(s.slice(0,7)!==picker.start.slice(0,7)){picker.error='结束日必须与开始日在同一个月。';}
   else{[picker.start,picker.end]=[picker.start,s].sort();picker.second=false;picker.error='';}}
  if(a==='apply'){const p=picker;p.error=p.error||valid(p);if(!p.error){const r=[num(p.start),num(p.end)];if(p.target==='comparison')comparison=r;else{period=r;mode=len(r)===1?'day':'custom';comparison=null;}picker=null;}}
  if(picker){drawModal();return true;}
  if(dialog.open)closeModal();
  followToday=period[1]===today;
  update();return true;
 }
 function renderComparison() {
   let body=!desktop?'':mode==='year'?'比较上年同期的使用情况。':'选择另一段日期，按统计日数比较日均用时。';
   if(prior && comparison) {
     const current=result.total/result.days, previous=prior.total/prior.days;
     const difference=Math.abs(current-previous);
     body=`${label(comparison)}<br>对比期累计　${duration(prior.total,true)}<br>本期日均 ${duration(current,true)} · 对比期日均 ${duration(previous,true)}<br><strong>${difference<60_000?'日均基本持平':'日均'+(current>previous?'增加 ':'减少 ')+duration(difference,true)}</strong>`;
   }
   return `<section class="period-card"><h2>期间对比</h2>${body?'<p>'+body+'</p>':''}<button data-cal="compare">${mode==='year'?'对比上年同期':comparison?'更改对比日期':'选择对比日期'}</button> ${comparison?'<button data-cal="clear">清除对比</button>':''}</section>`;
 }
 function chartSeries(){
   const format=new Intl.DateTimeFormat('zh-CN',{timeZone:snapshot.settings.timeZone,...(mode==='day'?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:mode==='year'?{year:'numeric',month:'long'}:{month:'short',day:'numeric'})});
   return result.bins.map((bin,i)=>{
     const end=Math.min(result.bins[i+1]?.start??result.end,result.end);
     return {label:bin.label,detail:format.format(bin.start)+(mode==='day'&&end>bin.start?'–'+format.format(end):''),
       minutes:bin.start>=result.end?null:bin.duration/60000,
       rows:(bin.apps||[]).map(app=>({name:app.name,platform:app.platform,minutes:app.duration/60000}))};
   });
 }
 function paint() {
   const modesHtml=Object.entries(modes).map(([key,name])=>`<button data-cal="mode" data-mode="${key}" aria-pressed="${mode===key}">${name}</button>`).join('');
   const scopeHtml=[['all','全部设备'],['phone','手机'],['pc','电脑']].map(([key,name])=>`<button data-cal="scope" data-scope="${key}" aria-pressed="${scope===key}">${name}</button>`).join('');
   const header=`<header class="topbar page-header"><div class="page-heading"><h1>${desktop?'统计':'仪表盘'}</h1>${desktop?recordingStatus(snapshot.collector,escape):''}</div><div class="actions"><button data-tool="layout" aria-haspopup="dialog">布局</button>${mode==='week'?'<button data-tool="report">导出周报</button>':''}${refreshControl('data-tool="refresh"')}</div></header>`;
   const fullDate=mode==='year'?yr(period[0])+' 年':label(period);
   const dateText=!desktop && mode!=='year' && len(period)>1?short(period[0])+'–'+short(period[1]):fullDate;
   const controls=`<div class="pd-controls"><div class="pd-modes">${modesHtml}</div><div class="pd-range"><button aria-label="上一期间" data-cal="prev">‹</button><button data-cal="dates" aria-haspopup="dialog" aria-label="${fullDate}">${dateText} ▾</button><button aria-label="下一期间" data-cal="next" ${period[1]>=today?'disabled':''}>›</button></div></div>`;
   const ranking=result?.apps.map((app,index)=>{
     const device=app.platform==='android'?'手机':'电脑',percent=100*app.duration/result.apps[0].duration;
     if(!desktop)return `<button class="app-row" data-rank="${index}"><span class="app-name">${escape(app.name)}</span><small>${device}</small><strong>${duration(app.duration,true)}</strong><span class="rank-track" aria-hidden="true"><i style="width:${percent}%"></i></span></button>`;
     const query=new URLSearchParams({v:'4',platform:app.platform,id:app.appId,name:app.name});
     const mono=app.platform==='windows' && app.appId.toLowerCase()==='chatgpt.exe';
     const icon=`<img class="review-app-icon" alt="" loading="lazy" ${mono?'data-monochrome':''} src="/api/app-icon?${escape(query.toString())}">`;
     const name=(app.platform==='windows' && windowsRankNames.get(app.appId.toLowerCase()))||app.name;
     return desktopRankRow({name,icon,device,percent,index,minutes:Math.floor(app.duration/60000)});
   }).join('');
   const series=desktop && result?chartSeries():null;
   const styleButtons='<div class="chart-style" role="group" aria-label="图表类型">'+[['line','折线图'],['bar','柱形图']].map(([key,label])=>`<button data-chart="${key}" aria-pressed="${chartStyle===key}">${label}</button>`).join('')+'</div>';
   const cards=result?{
     trend:`<section class="period-card trend-card"><div class="pd-top"><h2>使用时间</h2>${desktop?styleButtons:'<small>单位：小时</small>'}</div>${desktop?desktopUsageChart(series,mode,chartStyle):usageArea(result.bins.map(b=>b.start>=result.end?{...b,duration:null}:b),ms=>duration(ms,true))}</section>`,
     ranking:`<section class="period-card ranking-card${desktop?' desktop-rank-card':''}"><h2>应用排行</h2>${ranking?'<div class="rank-scroll" tabindex="0" role="region" aria-label="应用排行">'+ranking+'</div>':ranking||'<p>所选期间暂无使用记录</p>'}</section>`,
     compare:renderComparison(),
     ...(desktop?Object.fromEntries(['devices','focus'].map(key=>[key,'<section class="period-card"><h2>'+desktopTitles[key]+'</h2>'+shareChart(key,result.apps,ms=>duration(ms,true))+'</section>'])):{})
   }:{};
   const visibleCards=layout.filter(card=>card.visible);
   const defaultPair=visibleCards.length===2 && visibleCards.every(c=>['trend','ranking'].includes(c.key));
   const summary=result?`<section class="period-card period-total"><div class="total-value"><small>${desktop?{all:'设备累计',phone:'手机累计',pc:'电脑累计'}[scope]:'设备累计'}</small><h2>${duration(result.total,true)}</h2></div><div class="pd-modes">${scopeHtml}</div></section><div class="pd-bottom${defaultPair?' default-pair':''}">${visibleCards.map(card=>cards[card.key]).join('')}</div>`:'<p role="status">正在读取所选期间…</p>';
   const previousList=host.querySelector('.rank-scroll');
   if(previousList?.isConnected && previousList.clientHeight)rankOffset=previousList.scrollTop;
   host.innerHTML=header+controls+summary;
   if(result){
     const key=JSON.stringify([period,mode,scope]);
     if(pointPeriod!==key){selectedPoint=null;pointPeriod=key;}
     const trend=host.querySelector('.trend-card');
     if(desktop && trend)bindDesktopPoints(trend,series,{pointIndex:selectedPoint,onSelect:i=>{selectedPoint=i;},dur:m=>duration(m*60000,true)});
     if(!desktop)bindPhoneUsage(host,{result,snapshot,scope:queryScope(),mode,selected:selectedPoint,onSelect:i=>{selectedPoint=i;},escape,duration});
   }
   const scroll=host.querySelector('.rank-scroll');
   if(scroll){
     const key=JSON.stringify([period,scope]);if(rankPeriod!==key){rankOffset=0;rankPeriod=key;}
     scroll.scrollTop=rankOffset;
     scroll.onscroll=()=>{if(scroll.isConnected)rankOffset=scroll.scrollTop;};
   }
   host.onclick=async event=>{
     const button=event.target.closest('button');
     if(!button)return;
     try {
       if(button.dataset.chart){
         chartStyle=button.dataset.chart;paint();host.querySelector('[data-chart="'+chartStyle+'"]').focus({preventScroll:true});
       } else if(button.hasAttribute('data-rank')){
         const app=result.apps[Number(button.dataset.rank)];
         await details(app.appId,app.deviceId,{start:result.start,end:result.end,label:label(period),single:mode==='day'});
       } else if(button.dataset.tool==='layout'){
         openerSelector='[data-tool=layout]';draft=structuredClone(layout);drawModal();
       }
       else if(button.dataset.tool==='report')await report(iso(period[1]));
       else if(button.dataset.tool==='refresh')await (desktop?update(true):refreshPhone());
       else act(button);
     } catch(error){onError(error.message);}
   };

 }
 async function update(force=false) {
   const key=JSON.stringify([mode,period,comparison,scope,snapshot.settings]);
   if(!force && key===loadedKey && result){paint();return;}
   const pending=++revision;
   if(key!==loadedKey){result=null;prior=null;paint();}
   try {
     const [current,previous]=await Promise.all([read(period,mode),comparison?read(comparison,mode==='year'?'year':'custom'):null]);
     if(revision!==pending || !host.isConnected)return;
     loadedKey=key;result=current;prior=previous;paint();
   }catch(error){if(revision===pending){loadedKey=null;onError(error.message);}}
 }
 function mount(element,data) {
   const nextToday=num(dateKey(Date.now(),data.settings));
   const rollover=today!==nextToday;
   today=nextToday;
   if(!period || (rollover && followToday && mode!=='custom'))choose(mode,today);
   host=element;snapshot=data;
   desktop=!data.native;
   layout??=desktop?desktopLayout(data.periodLayout?.cards):validCardLayout(data.periodLayout?.cards)?data.periodLayout.cards:defaultCardLayout();
   if(result)paint();
   update(true);
 }
 return {mount,closeModal,get choosing(){return dialog.open;}};
}
