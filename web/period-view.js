import {chartSeries,renderCardGrid} from './period-cards.js';
import {createPeriodDialog} from './period-dialog.js';
import {iso,num,short,yr,len,span,label,adjacentPeriod,previousYearPeriod} from './period-calendar.js';
import {recordingStatus} from './recording-status.js';
import {desktopLayout} from './shared/desktop-card-layout.js';
import {mountRingDesk,bindDesktopPoints,desktopPeriodLabel} from './desktop-insights.js';
import {bindPhoneUsage} from './phone-usage.js';
import {refreshControl} from './refresh-control.js';
import {defaultCardLayout,validCardLayout} from './shared/period-layout.js';
import {dateKey} from './shared/time.js';

// Keep the selection when moving between dashboard, devices and settings.
export function createPeriodView({readPeriod, saveLayout, escape, duration, details, report, refreshPhone, onError}) {
 let selectedPoint=null, pointPeriod='';
 let chartStyle='line', dailyView=new URLSearchParams(location.search).get('view')==='ringdesk'?'ringdesk':null;
 let showLatestRecord=dailyView==='ringdesk';
 const clock={minute:0,selected:false};
 let desktop=false, rankOffset=0, rankPeriod='';
 let today;
 const modes={day:'日',week:'周',month:'月',year:'年'};
 let mode='day', period, comparison=null, scope='all', followToday=true;
 let host, snapshot, revision=0, result, prior, loadedKey, loadedStamp, pendingKey, committed;
 const queryScope=()=>({all:'all',phone:'android',pc:'windows'})[scope];
 const detailForView=()=>desktop && mode==='day' && dailyView==='ringdesk'?'ring':'chart';
 const selectionKey=()=>JSON.stringify([mode,period,comparison,scope,snapshot.settings,detailForView()]);
 function dataStamp(){
   // The end of a live bin is displayed to the minute, even when collection is paused.
   const live=period[1]===today || comparison?.[1]===today;
   return JSON.stringify([snapshot.ledgerSequence,snapshot.devices.map(d=>[d.id,d.platform]),
     live?Math.floor(Date.now()/60000):null]);
 }
 function read(range,kind,detail){
   return readPeriod(snapshot,{from:iso(range[0]),to:iso(range[1]),mode:kind,scope:queryScope(),detail});
 }
 let layout,layoutNeedsPaint=false;
 const dialog=createPeriodDialog({
  saveLayout,
  restoreFocus:selector=>host?.querySelector(selector)?.focus({preventScroll:true}),
  onLayout(cards){
   layout=cards;
   if(pendingKey && pendingKey!==loadedKey)layoutNeedsPaint=true;
   else paint();
  },
  onSelect(target,range){
   if(target==='year')choose('year',range[0]);
   else if(target==='comparison')comparison=range;
   else {period=range;mode=len(range)===1?'day':'custom';comparison=null;}
   followToday=period[1]===today;update();
  }
 });
 function choose(m,n){mode=m;period=span(m,n,today);comparison=null;}
 function act(button){
  const a=button.dataset.cal;if(!a)return;
  if(a==='dates'||(a==='mode'&&button.dataset.mode==='custom')){
   dialog.openDates(a==='dates'&&mode==='year'?'year':'period',period,today,'[data-cal=dates]');return;
  }
  if(a==='mode')choose(button.dataset.mode,Math.min(period[1],today));
  if(a==='prev'||a==='next'){
   period=adjacentPeriod(mode,period,a==='next',today);comparison=null;
  }
  if(a==='compare'){
   if(mode==='year')comparison=previousYearPeriod(period);
   else {dialog.openDates('comparison',comparison||period,today,'[data-cal=compare]');return;}
  }
  if(a==='clear')comparison=null;
  if(a==='scope')scope=button.dataset.scope;
  followToday=period[1]===today;
  update();return true;
 }
 function paint() {
   layoutNeedsPaint=false;
   const modesHtml=Object.entries(modes).map(([key,name])=>`<button data-cal="mode" data-mode="${key}" aria-pressed="${mode===key}">${name}</button>`).join('');
   const scopeHtml=[['all','全部设备'],['phone','手机'],['pc','电脑']].map(([key,name])=>`<button data-cal="scope" data-scope="${key}" aria-pressed="${scope===key}">${name}</button>`).join('');
   const canExport=Object.hasOwn(modes,mode);
   const reportButton=canExport?`<button data-tool="report" aria-haspopup="dialog">${modes[mode]}报</button>`:'';
   const header=`<header class="topbar page-header"><div class="page-heading"><h1>${desktop?'统计':'仪表盘'}</h1>${desktop?recordingStatus(snapshot.collector,escape):''}</div><div class="actions"><button data-tool="layout" aria-haspopup="dialog">布局</button>${reportButton}${refreshControl('data-tool="refresh"',desktop?'统计':null)}</div></header>`;
   const fullDate=mode==='year'?yr(period[0])+' 年':label(period);
   const dateText=desktop?desktopPeriodLabel(mode,period,today):mode!=='year' && len(period)>1?short(period[0])+'–'+short(period[1]):fullDate;
   const controls=`<div class="pd-controls"><div class="pd-modes">${modesHtml}</div><div class="pd-range"><button aria-label="上一期间" data-cal="prev">‹</button><button data-cal="dates" aria-haspopup="dialog" aria-label="${fullDate}">${dateText} ▾</button><button aria-label="下一期间" data-cal="next" ${period[1]>=today?'disabled':''}>›</button></div></div>`;
   const dailyChart=desktop && mode==='day' && result?.sessions?dailyView:null;
   const series=desktop && result && !dailyChart && layout.some(c=>c.key==='trend' && c.visible)
     ?chartSeries(result,mode,snapshot.settings.timeZone):null;
   const grid=result?renderCardGrid({layout,desktop,result,prior,comparison,mode,chartStyle,dailyChart,series,escape,duration}):'';
   const summary=result?`<section class="period-card period-total"><div class="total-value"><small>${desktop?{all:'设备累计',phone:'手机累计',pc:'电脑累计'}[scope]:'设备累计'}</small><h2>${duration(result.total,true)}</h2></div><div class="pd-modes">${scopeHtml}</div></section>${grid}`:'<p role="status">正在读取所选期间…</p>';
   const previousList=host.querySelector('.rank-scroll');
   if(previousList?.isConnected && previousList.clientHeight)rankOffset=previousList.scrollTop;
   if(desktop){
     // Keep decoded icons when a refresh or filter change retains the same app.
     const active=host.contains(document.activeElement)?document.activeElement.dataset:{};
     const focus=active.mode?'[data-mode="'+active.mode+'"]':active.scope?'[data-scope="'+active.scope+'"]':active.cal?'[data-cal="'+active.cal+'"]':null;
     const icons=new Map([...host.querySelectorAll('.rank-label img')].map(img=>[img.getAttribute('src'),img]));
     const template=document.createElement('template');
     template.innerHTML=header+controls+summary;
     const toolbar=template.content.querySelector('.period-total');
     if(toolbar){
       const filters=template.content.querySelector('.pd-controls');
       toolbar.append(toolbar.querySelector('.pd-modes'),filters.querySelector('.pd-modes'),filters.querySelector('.pd-range'),toolbar.querySelector('.total-value'));
       filters.remove();
     }
     for(const img of template.content.querySelectorAll('.rank-label img')){
       const previous=icons.get(img.getAttribute('src'));
       if(previous){img.replaceWith(previous);icons.delete(img.getAttribute('src'));}
     }
     const existingHeader=host.querySelector('.page-header');
     const existingToolbar=host.querySelector('.period-total');
     if(existingHeader){
       // Keep the toolbar and its focused buttons mounted during asynchronous data refreshes.
       const reportButton=existingHeader.querySelector('[data-tool=report]');
       const nextReport=template.content.querySelector('[data-tool=report]');
       if(nextReport && !reportButton)existingHeader.querySelector('.sand-seal').before(nextReport);
       else if(!nextReport)reportButton?.remove();
       else if(reportButton.textContent!==nextReport.textContent)reportButton.textContent=nextReport.textContent;
       template.content.querySelector('.page-header').remove();
     }
     if(existingToolbar && toolbar){
       for(const selector of ['.pd-range','.total-value']){
         existingToolbar.querySelector(selector).replaceWith(toolbar.querySelector(selector));
       }
       toolbar.remove();
     }
     for(const child of [...host.children]){
       if(child!==existingHeader && !(child===existingToolbar && toolbar))child.remove();
     }
     host.append(template.content);
     if(focus)host.querySelector(focus)?.focus({preventScroll:true});
   }else host.innerHTML=header+controls+summary;
   if(!desktop)for(const img of host.querySelectorAll('.phone-app-icon img')){
     img.onerror=()=>img.remove();
     if(img.complete && !img.naturalWidth)img.remove();
   }
   if(result){
     const key=JSON.stringify([period,mode,scope]);
     if(pointPeriod!==key){selectedPoint=null;pointPeriod=key;}
     const trend=host.querySelector('.trend-card');
     if(desktop && trend && dailyChart){
       const fmt=new Intl.DateTimeFormat('zh-CN',{timeZone:snapshot.settings.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
       const timeAt=m=>fmt.format(result.start+Math.round(m*60000));
       const options={timeAt,dayMinutes:result.dayMinutes,offset:snapshot.settings.dayStart*60};
       const rows=result.sessions, panel=trend.querySelector('.daily-clock');
       if(!clock.selected)clock.minute=rows.length?rows.reduce((last,row)=>Math.max(last,row.start),0):0;
       if(showLatestRecord && rows.length){clock.selected=true;showLatestRecord=false;}
       clock.minute=Math.min(clock.minute,result.dayMinutes-1/60000);
       mountRingDesk(panel,rows,clock,m=>duration(m*60000,true),options);
     }else if(desktop && trend)bindDesktopPoints(trend,series,{pointIndex:selectedPoint,onSelect:i=>{selectedPoint=i;},dur:m=>duration(m*60000,true)});
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
         const next=button.dataset.chart;
         dailyView=next==='ringdesk'?next:null;
         if(!dailyView)chartStyle=next;
         if(detailForView()==='ring' && !result.sessions)await update();
         else {
           // The ring response also contains everything needed by a line or bar chart.
           ++revision;pendingKey=null;loadedKey=selectionKey();
           Object.assign(committed,{dailyView,chartStyle});
           paint();markPending(false);
         }
         if((dailyView||chartStyle)===next && (document.activeElement===button || document.activeElement===document.body))host.querySelector('[data-chart="'+next+'"]')?.focus({preventScroll:true});
       } else if(button.hasAttribute('data-rank')){
         const app=result.apps[Number(button.dataset.rank)];
         await details(app.appId,app.deviceId,{start:result.start,end:result.end,label:label(period),single:mode==='day'});
       } else if(button.dataset.tool==='layout'){
         dialog.openLayout(layout,desktop);
       }
       else if(button.dataset.tool==='report'){
         const selection={mode,from:iso(period[0]),to:iso(period[1]),scope:queryScope(),result,series:chartSeries(result,mode,snapshot.settings.timeZone)};
         await report(iso(period[1]),selection);
       }
       else if(button.dataset.tool==='refresh')await (desktop?update(true):refreshPhone());
       else act(button);
     } catch(error){onError(error.message);}
   };

 }
 function markPending(changing){
   if(!changing && layoutNeedsPaint)paint();
   host.setAttribute('aria-busy',String(changing));
   const exportButton=host.querySelector('[data-tool=report]');
   if(exportButton)exportButton.disabled=changing || !result;
   const grid=host.querySelector('.pd-bottom');
   if(grid)grid.inert=changing;
   for(const button of host.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
   for(const button of host.querySelectorAll('[data-scope]'))button.setAttribute('aria-pressed',String(button.dataset.scope===scope));
 }
 async function update(force=false) {
   const key=selectionKey(),stamp=dataStamp();
   if(key===pendingKey)return;
   const pending=++revision;
   if(!force && key===loadedKey && stamp===loadedStamp && result){
     if(pendingKey){pendingKey=null;markPending(false);}
     return;
   }
   pendingKey=key;
   if(!result && !host.childElementCount)paint();
   markPending(key!==loadedKey);
   try {
     const [current,previous]=await Promise.all([read(period,mode,detailForView()),comparison?read(comparison,mode==='year'?'year':'custom','totals'):null]);
     if(revision!==pending || !host.isConnected)return;
     // A poll already in flight may finish after the user starts dragging.
     if(key===loadedKey && host.querySelector('.daily-clock [data-scrubbing]'))return;
     loadedKey=key;loadedStamp=stamp;result=current;prior=previous;
     committed={mode,period,comparison,scope,followToday,dailyView,chartStyle};
     paint();
   }catch(error){
     if(revision!==pending || !host.isConnected)return;
     if(committed)({mode,period,comparison,scope,followToday,dailyView,chartStyle}=committed);
     else host.querySelector('[role=status]')?.replaceChildren('统计暂时无法读取，请点更新重试。');
     onError(error.message);
   }finally{
     if(revision===pending){
       pendingKey=null;
       if(host.isConnected)markPending(false);
     }
   }
 }
 function receive(data){
   snapshot=data;
   today=num(dateKey(Date.now(),data.settings));
   // Compare the selection so a failed request at the day boundary can retry.
   if(!period || (followToday && mode!=='custom' && period[1]!==today))choose(mode,today);
 }
 function refresh(data,force=false){
   if(host.querySelector('.daily-clock [data-scrubbing]'))return;
   receive(data);
   return update(force || data.ledgerSequence==null);
 }
 function mount(element,data) {
   host=element;
   revision++;pendingKey=null;
   receive(data);
   desktop=!data.native;
   layout??=desktop?desktopLayout(data.periodLayout?.cards):validCardLayout(data.periodLayout?.cards)?data.periodLayout.cards:defaultCardLayout();
   if(loadedKey!==selectionKey()){result=null;prior=null;committed=null;}
   if(result)paint();
   return update(true);
 }
 return {mount,refresh,closeModal:dialog.close,get choosing(){return dialog.open;}};
}
