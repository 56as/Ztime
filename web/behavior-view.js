import {createTimeline} from './behavior-timeline.js';
import {behaviorDateLabel} from './shared/behavior.js';
import {addDays} from './shared/time.js';
import {drawChart} from './behavior-chart.js';

const missing='未分类';
const make=(tag,text='')=>Object.assign(document.createElement(tag),{textContent:text});
const fmt=ms=>ms===0?'0 分钟':ms<60000?'不足 1 分钟':Math.floor(ms/60000)+' 分钟';
function tally(rows){
 const sums=new Map();
 for(const r of rows)sums.set(r.category,(sums.get(r.category)||0)+r.end-r.start);
 return [...sums].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh'));
}
function picker(label,choices,value,change){
 const select=make('select');select.setAttribute('aria-label',label);
 for(const name of choices)select.add(new Option(name,name));
 select.value=value;select.onchange=()=>change(select.value);return select;
}
export function mountBehavior(host,{api,onError,date,settings,sequence}){
 host.innerHTML=markup;
 const $=id=>host.querySelector('#'+id);
 const formatter=zone=>new Intl.DateTimeFormat('zh-CN',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 let clock=formatter(settings.timeZone),observed=sequence;
 let today=date,anchor=date,mode='day',filter=null,device='全部',data,request=0;
 const timeline=createTimeline($('session-plot'),$('bucket-detail'),drawSelection);
 function button(label,click){const b=make('button',label);b.onclick=click;return b;}
 async function load(){
  const seq=++request;host.setAttribute('aria-busy','true');
  try{
   const result=await api('/api/behavior?'+new URLSearchParams({anchor,mode}));
   if(seq!==request||!host.isConnected)return;
   data={...result,mode,anchor};draw();
  }catch(e){if(seq===request&&host.isConnected){$('feedback').textContent=e.message;onError(e.message);}}
  finally{if(seq===request)host.removeAttribute('aria-busy');}
 }
 async function save(body,message){
  try{await api('/api/behavior','PUT',body);await load();if(host.isConnected)$('feedback').textContent=message;}
  catch(e){onError(e.message);await load();}
 }
 function selectDate(value,newMode=mode){anchor=value>today?today:value;mode=newMode;filter=null;timeline.reset();load();}
 function selectFilter(name){filter=name;timeline.reset();draw();}
 function draw(){
  const {first,last,rows,names,apps,mode,anchor}=data,options=[...names,missing];
  const color=name=>name===missing?'#969da9':['#397acb','#348b74','#9a6db0','#bd8037'][names.indexOf(name)]||'hsl('+((names.indexOf(name)*131)%360)+' 46% 46%)';
  today=data.today;
  $('anchor-date').max=today;$('next').disabled=last>=today;
  $('purpose-palette').replaceChildren(...options.map(name=>{
   const label=make('span',name);label.style.setProperty('--color',color(name));return label;
  }));
  $('anchor-date').value=anchor;$('range-label').textContent=mode==='year'?anchor.slice(0,4)+' 年':behaviorDateLabel(first,last,today);
  for(const b of $('period-modes').children)b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  const totals=new Map(tally(rows));
  drawChart({$,element:make,button,tally,color,mode,fmt,today,dayView:d=>selectDate(d,'day'),selectFilter},rows,first);
  $('purpose-totals').replaceChildren(...options.filter(name=>totals.has(name)||name===filter).map(name=>{
   const b=button(name,()=>selectFilter(filter===name?null:name));b.style.setProperty('--color',color(name));
   b.setAttribute('aria-pressed',String(filter===name));b.append(make('b',fmt(totals.get(name)||0)));return b;
  }));
  $('sessions-heading').textContent=filter?filter+'时段':'全部时段';$('show-all').hidden=!filter;
  for(const b of $('session-devices').children)b.setAttribute('aria-pressed',String(b.dataset.device===device));
  const visible=rows.filter(row=>(!filter||row.category===filter)&&(device==='全部'||row.platform===(device==='手机'?'android':'windows')));
  visible.sort((a,b)=>a.start-b.start||a.end-b.end||a.id.localeCompare(b.id));
  timeline.draw(visible,{clock,color,fmt,mode,first,last,today,settings});
  $('rule-list').replaceChildren(...apps.map(({app,appId,platform,rule})=>{
   const title=app+' · '+(platform==='android'?'手机':'电脑'),label=make('label',title);
   label.title=appId;label.append(picker(title+'默认行为',options,rule??missing,name=>save({kind:'rule',platform,appId,name},app+'的默认行为已更新。')));return label;
  }));
 }
 function drawSelection(s){
  const list=$('session-list');list.replaceChildren();
  if(!s)return;
  const row=make('div');row.className='session-row';
  const controls=make('div');controls.className='session-actions';
  controls.append(picker('调整'+s.app+'本段用途',[...data.names,missing],s.category,name=>save({kind:'override',id:s.id,name},'本段已计入'+name+'。')));
  if(s.manual)controls.append(button('撤销调整',()=>save({kind:'override',id:s.id,name:null},'本段已恢复应用默认行为。')));
  row.append(make('small',(data.mode==='year'?s.date.slice(5)+' ':'')+clock.format(s.start)+'–'+clock.format(s.end)),make('b',s.app+' · '+fmt(s.end-s.start)),controls);
  list.append(row);
 }
 for(const b of $('session-devices').children)b.onclick=()=>{
  device=b.dataset.device;timeline.reset();if(data)draw();
 };
 for(const b of $('timeline-style').children){
  b.setAttribute('aria-pressed',String(b.dataset.chart==='line'));
  b.onclick=()=>{
   for(const control of $('timeline-style').children)control.setAttribute('aria-pressed',String(control===b));
   timeline.setStyle(b.dataset.chart);
  };
 }
 for(const b of $('period-modes').children)b.onclick=()=>selectDate(anchor,b.dataset.mode);
 for(const [id,n] of [['prev',-1],['next',1]])$(id).onclick=()=>selectDate(mode==='year'?String(Number(anchor.slice(0,4))+n)+'-01-01':addDays(anchor,n*(mode==='day'?1:7)));
 $('anchor-date').onchange=e=>{if(e.target.validity.valid&&e.target.value)selectDate(e.target.value);else e.target.value=anchor;};
 $('rules-open').onclick=()=>{const panel=$('purpose-rules');panel.hidden=!panel.hidden;$('rules-open').setAttribute('aria-expanded',String(!panel.hidden));};
 $('show-all').onclick=()=>selectFilter(null);
 $('purpose-form').onsubmit=async e=>{e.preventDefault();const input=$('purpose-name'),name=input.value.trim();
  if(!name||[...(data?.names??[]),missing].includes(name)){onError('请输入一个新的行为名称。');return;}
  await save({kind:'add',name},'已添加'+name+'。');if(data?.names.includes(name))input.value='';
 };
 load();
 return {refresh(summary){
  if(host.getAttribute('aria-busy')==='true'||host.contains(document.activeElement)&&document.activeElement.matches('input,select'))return;
  if(summary.ledgerSequence===observed&&summary.settings.revision===settings.revision&&summary.date===today)return;
  if(summary.date!==today){if(anchor===today||anchor>summary.date)anchor=summary.date;today=summary.date;}
  observed=summary.ledgerSequence;settings=summary.settings;clock=formatter(settings.timeZone);load();
 }};
}

const markup=`<header><div><h1>行为</h1></div><button id="rules-open" aria-expanded="false">归类规则</button></header>
<section id="purpose-rules" class="panel" hidden><h2>按应用归类</h2><div id="purpose-palette" aria-label="可选行为"></div><div id="rule-list"></div><form id="purpose-form"><label>新行为 <input id="purpose-name" maxlength="16" placeholder="例如：写作"></label><button>添加</button></form></section>
<section class="panel behavior-summary"><div class="behavior-head"><h2 id="chart-title">当天用时排行</h2></div><div class="period-toolbar"><div role="group" aria-label="统计周期" id="period-modes"><button aria-pressed="true" data-mode="day">日</button><button data-mode="week">周</button><button data-mode="year">年</button></div><div class="period-nav"><button id="prev" aria-label="上一期间">‹</button><label><span id="range-label"></span><input type="date" aria-label="选择统计日期" id="anchor-date"></label><button id="next" aria-label="下一期间">›</button></div></div><div id="purpose-chart"></div><div id="purpose-totals" aria-label="按行为筛选时段"></div></section>
<section class="panel"><div class="behavior-head session-head"><h2 id="sessions-heading">全部时段</h2><button id="show-all" hidden>清除行为筛选</button><div id="session-devices" role="group" aria-label="按设备筛选时段"><button data-device="全部">全部</button><button data-device="手机">手机</button><button data-device="电脑">电脑</button></div></div>
<div class="timeline-toolbar"><div id="timeline-style" role="group" aria-label="时段图表样式"><button data-chart="line">折线图</button><button data-chart="bar">柱状图</button></div></div>
<div id="session-plot" aria-label="按开始时间排列的使用时段"></div><div id="bucket-detail" class="bucket-detail"></div><div id="session-list" aria-label="所选时段"></div><p id="feedback" role="status" aria-live="polite"></p></section>`;
