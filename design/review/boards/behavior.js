const $=id=>document.getElementById(id);
const samples=[
  ['course','11-02','09:00–09:22','课程播放器','电脑',22],
  ['lookup','11-02','09:22–09:30','词典','手机',8],
  ['mail','11-03','14:00–14:18','邮件','电脑',18],
  ['short','11-03','14:18–14:20','词典','手机',2],
  ['web','11-03','14:20–14:26','浏览器','电脑',6],
  ['glance','11-03','14:26:00–14:26:45','日历','手机',0.75],
  ['minute','10-30','09:20–09:21','日历','手机',1],
  ['spring','04-06','10:00–10:35','课程播放器','电脑',35],
  ['summer','07-15','16:00–16:40','邮件','电脑',40],
  ['oct','10-30','09:00–09:20','词典','手机',20]
].map(([id,date,time,app,device,minutes])=>({id,date:'2026-'+date,time,app,device,minutes}));
const storage='ztime-review-behavior-v1', missing='未分类';
// The sample ledger ends on Tuesday. Historical weeks still show all seven days.
const demoToday='2026-11-03';
const presets=['学习','工作','社交','娱乐','运动','生活','出行'];
const previousNames=new Map([['沟通社交','社交'],['休闲娱乐','娱乐'],['运动健康','运动'],['生活事务','生活']]);
const rename=name=>previousNames.get(name)??name;
const initial={names:presets,rules:{'课程播放器':'学习','词典':'学习','邮件':'工作','日历':'生活'},exceptions:{}};
const state=JSON.parse(sessionStorage.getItem(storage)||'null')||initial;
state.names=[...new Set([...presets,...state.names.map(rename)])];
for(const table of [state.rules,state.exceptions]){
  for(const key of Object.keys(table))table[key]=rename(table[key]);
}
sessionStorage.setItem(storage,JSON.stringify(state));
const countedSamples=samples.filter(s=>s.minutes>=1);
let filter=null,device='全部',mode='week',anchor=demoToday;
let chartStyle='line',selectedId=null;
const date=s=>new Date(s+'T12:00:00Z');
const key=d=>d.toISOString().slice(0,10);
function shift(s,n){const d=date(s);d.setUTCDate(d.getUTCDate()+n);return key(d);}
function group(s){return state.exceptions[s.id]??state.rules[s.app]??missing;}
function element(tag,text=''){const el=document.createElement(tag);el.textContent=text;return el;}
function button(label,action){const b=element('button',label);b.dataset.styleNative='';b.onclick=e=>{if(!e.defaultPrevented)action();};return b;}
function save(message){sessionStorage.setItem(storage,JSON.stringify(state));draw();$('feedback').textContent=message;}
function picker(id,label,choices,value,onchange){
  const select=document.createElement('select');select.id=id;select.setAttribute('aria-label',label);
  for(const [k,title] of choices)select.add(new Option(title,k));
  select.value=value;select.onchange=()=>onchange(select.value);return select;
}
function bounds(){
  if(mode==='year')return [anchor.slice(0,4)+'-01-01',anchor.slice(0,4)+'-12-31'];
  if(mode==='day')return [anchor,anchor];
  const start=shift(anchor,-((date(anchor).getUTCDay()+6)%7)),last=shift(start,6);
  return [start,last<demoToday?last:demoToday];
}
function tally(rows){
  const totals=new Map();
  for(const s of rows)totals.set(group(s),(totals.get(group(s))||0)+s.minutes);
  return [...totals].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh'));
}
function color(name){
  if(name===missing)return '#969da9';
  const i=state.names.indexOf(name);
  return ['#397acb','#348b74','#9a6db0','#bd8037'][i]||'hsl('+((i*131)%360)+' 46% 46%)';
}
function dayView(day){mode='day';anchor=day;filter=null;draw();}
function bar(parts,max){
  const track=element('span');track.className='purpose-track';
  for(const [name,value] of parts){
    const segment=element('i');segment.style.width=(value/max*100)+'%';segment.style.background=color(name);
    segment.title=name+' '+value+' 分钟';track.append(segment);
  }
  return track;
}
function leader(parts){
  if(!parts.length)return '无记录';
  return parts.filter(p=>p[1]===parts[0][1]).map(p=>p[0]).join(' / ')+' '+parts[0][1]+' 分钟';
}
function drawChart(rows,start){
  const chart=$('purpose-chart');chart.replaceChildren();chart.className='chart-'+mode;
  $('chart-title').textContent={day:'当天用时排行',week:'每日行为分布',year:'每日用时最多的行为'}[mode];
  if(mode==='year'){
    const days=new Map();
    for(const s of rows){if(!days.has(s.date))days.set(s.date,[]);days.get(s.date).push(s);}
    for(let month=1;month<=12;month++){
      const row=element('div');row.className='year-row';row.append(element('small',month+'月'));
      for(let d=start.slice(0,4)+'-'+String(month).padStart(2,'0')+'-01';date(d).getUTCMonth()===month-1;d=shift(d,1)){
        const parts=tally(days.get(d)||[]),day=d,cell=button('',()=>dayView(day));
        cell.id='cell-'+day;cell.disabled=day>demoToday;cell.title=cell.disabled?day:day+' · '+leader(parts);cell.setAttribute('aria-label',cell.title);
        if(parts.length){cell.style.background=color(parts[0][0]);if(parts[1]?.[1]===parts[0][1])cell.style.background='linear-gradient(135deg,'+color(parts[0][0])+' 50%,'+color(parts[1][0])+' 50%)';}
        row.append(cell);
      }
      chart.append(row);
    }
    return;
  }
  const days=Array.from({length:7},(_,i)=>shift(start,i)).filter(day=>day<=demoToday);
  const entries=mode==='week'?days.map(d=>({label:['周一','周二','周三','周四','周五','周六','周日'][days.indexOf(d)],day:d,parts:tally(rows.filter(s=>s.date===d))})):
    tally(rows).map(p=>({label:p[0],parts:[p]}));
  const max=Math.max(1,...entries.map(r=>r.parts.reduce((n,p)=>n+p[1],0)));
  for(const r of entries){
    const line=button('',()=>{if(r.day)dayView(r.day);else{filter=r.label;draw();}});
    line.className='bar-row';
    line.append(element('span',r.label),bar(r.parts,max));
    if(mode==='day')line.append(element('small',r.parts[0][1]+' 分钟'));
    else line.setAttribute('aria-label',r.label+' · '+leader(r.parts));
    chart.append(line);
  }
  if(!entries.length)chart.append(element('p','当天没有使用记录。'));
}
const monthDay=d=>Number(d.slice(5,7))+'月'+Number(d.slice(8))+'日';
const weekday=d=>['周日','周一','周二','周三','周四','周五','周六'][date(d).getUTCDay()];
function dateRange(start,end){
  const prefix=start.slice(0,4)===demoToday.slice(0,4)?'':start.slice(0,4)+'年';
  if(start===end)return prefix+monthDay(start)+' '+weekday(start);
  const finish=start.slice(0,4)!==end.slice(0,4)?end.slice(0,4)+'年'+monthDay(end):start.slice(0,7)!==end.slice(0,7)?monthDay(end):Number(end.slice(8))+'日';
  return prefix+monthDay(start)+'至'+finish;
}
function timelineBins(rows){
  const [start,end]=bounds(),bins=[];
  if(mode==='day'){
    const hour=h=>String(h).padStart(2,'0')+':00';
    for(let h=0;h<24;h++){
      const parts=rows.flatMap(s=>{
        const [begin,finish]=s.time.split('–').map(t=>Number(t.slice(0,2))*60+Number(t.slice(3,5)));
        const minutes=Math.min((h+1)*60,finish)-Math.max(h*60,begin);
        return minutes>0?[{...s,minutes}]:[];
      });
      bins.push({label:hour(h),title:hour(h)+'–'+hour(h+1),parts});
    }
    return bins;
  }
  const until=end<demoToday?end:demoToday;
  for(let first=start;first<=until;){
    const last=mode==='week'?first:shift(first,6-(date(first).getUTCDay()+6)%7);
    const stop=last<until?last:until;
    bins.push({label:mode==='week'?weekday(first):'第'+(bins.length+1)+'周',
      title:dateRange(first,stop),parts:rows.filter(s=>s.date>=first && s.date<=stop)});
    first=shift(stop,1);
  }
  return bins;
}
let selectedBin=null,showShort=false;
function bucketDuration(minutes){
  const divisor=mode==='year'?1440:mode==='week'?60:1;
  const unit=mode==='year'?' 天':mode==='week'?' 小时':' 分钟';
  const value=minutes/divisor;
  return (value>0 && value<0.01?'不到 0.01':Number(value.toFixed(2)))+unit;
}
function drawTimeline(rows){
  const plot=$('session-plot');
  plot.replaceChildren();
  for(const control of $('timeline-style').children)control.setAttribute('aria-pressed',String(chartStyle===control.dataset.chart));
  if(!rows.length){plot.append(element('p','所选期间没有对应记录。'));return;}
  const bins=timelineBins(rows).map(bin=>({...bin,minutes:bin.parts.reduce((sum,s)=>sum+s.minutes,0)}));
  const selected=bins.find(b=>b.title===selectedBin && b.parts.some(s=>s.id===selectedId))??bins.find(b=>b.parts.some(s=>s.id===selectedId));
  selectedBin=selected?.title;
  const stepMinutes={day:5,week:15,year:14.4}[mode];
  const top=Math.max(2*stepMinutes,Math.ceil(Math.max(...bins.map(b=>b.minutes))/(2*stepMinutes))*2*stepMinutes);
  const axis=element('div');axis.className='timeline-axis';
  for(const tick of [top,top/2,0])axis.append(element('small',bucketDuration(tick)));
  const scroll=element('div');scroll.className='timeline-scroll';
  const columns=element('div');columns.className='timeline-columns '+chartStyle+' timeline-'+mode;
  columns.style.setProperty('--count',bins.length);
  if(chartStyle==='line'){
    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg'),line=document.createElementNS(ns,'polyline');
    svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
    line.setAttribute('points',bins.map((s,i)=>[(i+0.5)*100/bins.length,100-s.minutes/top*100].join(',')).join(' '));
    svg.append(line);columns.append(svg);
  }
  const step=mode==='day'?4:mode==='year'?Math.ceil(bins.length/7):1;
  for(const [i,bin] of bins.entries()){
    const label=bin.title+' · '+bucketDuration(bin.minutes);
    const column=button('',()=>{
      if(selectedBin!==bin.title)showShort=false;
      selectedId=(bin.parts.find(part=>samples.find(s=>s.id===part.id).minutes>=5)??bin.parts[0]).id;selectedBin=bin.title;draw();
      $(column.id)?.focus({preventScroll:true});
    });
    column.id='bucket-'+mode+'-'+i;column.className='timeline-column';column.title=label;
    column.disabled=!bin.parts.length;
    column.setAttribute('aria-label',label);column.setAttribute('aria-pressed',String(bin===selected));
    column.style.setProperty('--height',(bin.minutes/top*100)+'%');
    column.style.setProperty('--color',color(tally(bin.parts)[0]?.[0]??missing));
    if(bin.minutes){const mark=element('span');mark.className='timeline-mark';column.append(mark);}
    if(i%step===0){
      const tick=element('small',bin.label);tick.className='timeline-tick';column.append(tick);
    }
    columns.append(column);
  }
  scroll.append(columns);plot.append(axis,scroll);return selected;
}
function draw(){
  const [start,end]=bounds(),rows=countedSamples.filter(s=>s.date>=start&&s.date<=end);
  $('anchor-date').max=demoToday;
  $('next').disabled=end>=demoToday;
  $('anchor-date').value=anchor;$('range-label').textContent=mode==='year'?anchor.slice(0,4)+' 年':dateRange(start,end);
  for(const b of $('period-modes').children)b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  const names=[...state.names,missing],options=names.map(n=>[n,n]),totals=new Map(tally(rows));
  $('purpose-palette').replaceChildren(...names.map(name=>{
    const label=element('span',name);label.style.setProperty('--color',color(name));return label;
  }));
  drawChart(rows,start);
  $('purpose-totals').replaceChildren(...names.filter(name=>totals.has(name)||name===filter).map(name=>{
    const b=button(name,()=>{filter=filter===name?null:name;draw();});b.id='purpose-'+names.indexOf(name);b.style.setProperty('--color',color(name));
    b.setAttribute('aria-pressed',String(filter===name));b.append(element('b',(totals.get(name)||0)+' 分钟'));return b;
  }));
  $('sessions-heading').textContent=filter?filter+'时段':'全部时段';$('show-all').hidden=!filter;
  for(const b of $('session-devices').children)b.setAttribute('aria-pressed',String(device===b.dataset.device));
  const visible=rows.filter(s=>(!filter||group(s)===filter)&&(device==='全部'||s.device===device)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const selected=visible.find(s=>s.id===selectedId)??visible[0];
  selectedId=selected?.id??null;
  const oldOffset=$('session-plot').querySelector('.timeline-scroll')?.scrollLeft??0;
  const bucket=drawTimeline(visible);
  const scroller=$('session-plot').querySelector('.timeline-scroll');
  if(scroller)scroller.scrollLeft=oldOffset;
  $('session-list').replaceChildren();
  if(selected){
    const s=selected;
    const row=element('div');row.className='session-row';row.id='session-'+s.id;
    const info=element('div');info.append(element('b',s.app+' · '+s.minutes+' 分钟'));
    const controls=element('div');controls.className='session-actions';
    controls.append(picker('override-'+s.id,'调整'+s.app+'本段用途',options,group(s),value=>{
      state.exceptions[s.id]=value;save('本段已计入'+value+'。');
    }));
    if(Object.hasOwn(state.exceptions,s.id))controls.append(button('撤销调整',()=>{delete state.exceptions[s.id];save('本段已恢复为'+group(s)+'。');}));
    if(bucket){
      const summary=element('div');summary.className='bucket-detail';
      summary.append(element('b',bucket.title+' · '+bucketDuration(bucket.minutes)));
      const short=bucket.parts.filter(part=>samples.find(s=>s.id===part.id).minutes<5);
      const list=showShort?bucket.parts:bucket.parts.filter(part=>!short.includes(part));
      if(short.length){
        const disclosure=button('短于 5 分钟 · '+short.length+' 条',()=>{
          showShort=!showShort;
          selectedId=(showShort?short[0]:bucket.parts.find(part=>!short.includes(part)))?.id??selectedId;
          draw();$('short-disclosure')?.focus({preventScroll:true});
        });
        disclosure.id='short-disclosure';
        disclosure.setAttribute('aria-expanded',String(showShort));
        summary.append(disclosure);
      }
      if(list.length && (list.length>1 || !list.some(part=>part.id===s.id)))summary.append(picker('bucket-session','选择原始时段',list.map(part=>[part.id,part.time+' · '+part.app]),s.id,id=>{selectedId=id;draw();}));
      $('session-list').append(summary);
    }
    row.hidden=s.minutes<5 && !showShort;
    row.append(element('small',(mode==='year'?monthDay(s.date)+' ':'')+s.time),info,controls);$('session-list').append(row);
  }
  $('rule-list').replaceChildren(...[...new Set(countedSamples.map(s=>s.app))].map((app,i)=>{
    const label=element('label',app);label.append(picker('rule-'+i,app+'默认行为',options,state.rules[app]??missing,value=>{
      if(value!==missing)state.rules[app]=value;else delete state.rules[app];save(app+'的默认行为已更新。');
    }));return label;
  }));
}
function move(n){const next=mode==='year'?String(Number(anchor.slice(0,4))+n)+'-01-01':shift(anchor,n*(mode==='day'?1:7));anchor=next<=demoToday?next:demoToday;filter=null;draw();}
for(const b of $('session-devices').children)b.onclick=e=>{if(!e.defaultPrevented){device=b.dataset.device;draw();}};
for(const b of $('timeline-style').children)b.onclick=e=>{if(!e.defaultPrevented){chartStyle=b.dataset.chart;draw();}};
for(const b of $('period-modes').children)b.onclick=e=>{if(!e.defaultPrevented){mode=b.dataset.mode;filter=null;draw();}};
$('prev').onclick=e=>{if(!e.defaultPrevented)move(-1);};$('next').onclick=e=>{if(!e.defaultPrevented)move(1);};
$('anchor-date').onchange=e=>{if(e.target.validity.valid&&e.target.value){anchor=e.target.value;filter=null;}draw();};
$('range-label').onclick=e=>{if(!e.defaultPrevented)$('anchor-date').showPicker?.();};
$('rules-open').onclick=e=>{if(e.defaultPrevented)return;const panel=$('purpose-rules');panel.hidden=!panel.hidden;$('rules-open').setAttribute('aria-expanded',String(!panel.hidden));};
$('show-all').onclick=e=>{if(!e.defaultPrevented){filter=null;draw();}};
$('purpose-form').onsubmit=e=>{e.preventDefault();const name=$('purpose-name').value.trim();
  if(!name||[...state.names,missing].includes(name)){ $('feedback').textContent='请输入一个新的行为名称。';return;}
  state.names.push(name);$('purpose-name').value='';save('已添加'+name+'。');
};
draw();
document.addEventListener('reveal-behavior-note',event=>{
  const selector=event.detail;
  if(selector==='#purpose-chart > button:nth-of-type(3)'){mode='week';anchor=demoToday;}
  const s=countedSamples.find(s=>['#session-','#override-','#point-'].some(prefix=>selector.startsWith(prefix+s.id)));
  if(s){if(s.minutes<5)showShort=true;anchor=s.date;mode=selector.startsWith('#point-')?'day':'week';device='全部';selectedId=s.id;selectedBin=null;}
  const cell=selector.match(/^#cell-(\d{4}-\d{2}-\d{2})/);if(cell){anchor=cell[1];mode='year';}
  filter=null;draw();
  if(selector==='#purpose-rules > p:nth-of-type(1)'||document.querySelector(selector)?.closest('#purpose-rules')){
    $('purpose-rules').hidden=false;$('rules-open').setAttribute('aria-expanded','true');
  }
});
