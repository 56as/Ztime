const $=id=>document.getElementById(id);
const samples=[
  ['course','11-02','09:00–09:22','课程播放器','电脑',22],
  ['lookup','11-02','09:22–09:30','词典','手机',8],
  ['mail','11-03','14:00–14:18','邮件','电脑',18],
  ['short','11-03','14:18–14:20','词典','手机',2],
  ['web','11-03','14:20–14:26','浏览器','电脑',6],
  ['spring','04-06','10:00–10:35','课程播放器','电脑',35],
  ['summer','07-15','16:00–16:40','邮件','电脑',40],
  ['oct','10-30','09:00–09:20','词典','手机',20]
].map(([id,date,time,app,device,minutes])=>({id,date:'2026-'+date,time,app,device,minutes}));
const storage='ztime-review-behavior-v1', missing='未分类';
const initial={names:['学习','工作'],rules:{'课程播放器':'学习','词典':'学习','邮件':'工作'},exceptions:{}};
const state=JSON.parse(sessionStorage.getItem(storage)||'null')||initial;
// Drop the former unused demo preset. Keep categories that already classify a record.
if(!Object.values(state.rules).includes('娱乐')&&!Object.values(state.exceptions).includes('娱乐')&&!sessionStorage.getItem('behavior-upgraded')){
  state.names=state.names.filter(n=>n!=='娱乐');
}
sessionStorage.setItem(storage,JSON.stringify(state));sessionStorage.setItem('behavior-upgraded','1');
let filter=null,mode='week',anchor='2026-11-02';
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
  const start=shift(anchor,-((date(anchor).getUTCDay()+6)%7));return [start,shift(start,6)];
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
        cell.id='cell-'+day;cell.title=day+' · '+leader(parts);cell.setAttribute('aria-label',cell.title);
        if(parts.length){cell.style.background=color(parts[0][0]);if(parts[1]?.[1]===parts[0][1])cell.style.background='linear-gradient(135deg,'+color(parts[0][0])+' 50%,'+color(parts[1][0])+' 50%)';}
        row.append(cell);
      }
      chart.append(row);
    }
    return;
  }
  const days=Array.from({length:7},(_,i)=>shift(start,i));
  const entries=mode==='week'?days.map(d=>({label:['周一','周二','周三','周四','周五','周六','周日'][days.indexOf(d)],day:d,parts:tally(rows.filter(s=>s.date===d))})):
    tally(rows).map(p=>({label:p[0],parts:[p]}));
  const max=Math.max(1,...entries.map(r=>r.parts.reduce((n,p)=>n+p[1],0)));
  for(const r of entries){
    const line=button('',()=>{if(r.day)dayView(r.day);else{filter=r.label;draw();}});
    line.className='bar-row';line.append(element('span',r.label),bar(r.parts,max),element('small',mode==='week'?leader(r.parts):r.parts[0][1]+' 分钟'));
    chart.append(line);
  }
  if(!entries.length)chart.append(element('p','当天没有使用记录。'));
}
function draw(){
  const [start,end]=bounds(),rows=samples.filter(s=>s.date>=start&&s.date<=end);
  $('anchor-date').value=anchor;$('range-label').textContent=mode==='year'?anchor.slice(0,4)+' 年':mode==='day'?anchor:start+' — '+end.slice(5);
  for(const b of $('period-modes').children)b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  const names=[...state.names,missing],options=names.map(n=>[n,n]),totals=new Map(tally(rows));
  $('sum').textContent='设备累计 '+rows.reduce((n,s)=>n+s.minutes,0)+' 分钟';
  drawChart(rows,start);
  $('purpose-totals').replaceChildren(...names.map((name,i)=>{
    const b=button(name,()=>{filter=filter===name?null:name;draw();});b.id='purpose-'+i;b.style.setProperty('--color',color(name));
    b.setAttribute('aria-pressed',String(filter===name));b.append(element('b',(totals.get(name)||0)+' 分钟'));return b;
  }));
  $('sessions-heading').textContent=filter?filter+'时段':'全部时段';$('show-all').hidden=!filter;
  const visible=rows.filter(s=>!filter||group(s)===filter).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  $('session-list').replaceChildren(...visible.map(s=>{
    const row=element('div');row.className='session-row';row.id='session-'+s.id;
    const info=element('div');info.append(element('b',s.app+' · '+s.minutes+' 分钟'),element('small',s.device));
    const controls=element('div');controls.className='session-actions';
    controls.append(picker('override-'+s.id,'调整'+s.app+'本段用途',options,group(s),value=>{
      state.exceptions[s.id]=value;save('本段已计入'+value+'。');
    }));
    if(Object.hasOwn(state.exceptions,s.id))controls.append(button('撤销调整',()=>{delete state.exceptions[s.id];save('本段已恢复为'+group(s)+'。');}));
    row.append(element('small',s.date.slice(5)+' '+s.time),info,controls);return row;
  }));
  if(!visible.length)$('session-list').append(element('p','所选期间没有对应记录。'));
  $('rule-list').replaceChildren(...[...new Set(samples.map(s=>s.app))].map((app,i)=>{
    const label=element('label',app);label.append(picker('rule-'+i,app+'默认行为',options,state.rules[app]??missing,value=>{
      if(value!==missing)state.rules[app]=value;else delete state.rules[app];save(app+'的默认行为已更新。');
    }));return label;
  }));
}
function move(n){anchor=mode==='year'?String(Number(anchor.slice(0,4))+n)+'-01-01':shift(anchor,n*(mode==='day'?1:7));filter=null;draw();}
for(const b of $('period-modes').children)b.onclick=e=>{if(!e.defaultPrevented){mode=b.dataset.mode;filter=null;draw();}};
$('prev').onclick=e=>{if(!e.defaultPrevented)move(-1);};$('next').onclick=e=>{if(!e.defaultPrevented)move(1);};
$('anchor-date').onchange=e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){anchor=e.target.value;filter=null;draw();}};
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
  const s=samples.find(s=>selector.startsWith('#session-'+s.id)||selector.startsWith('#override-'+s.id));
  if(s){anchor=s.date;mode='week';}
  const cell=selector.match(/^#cell-(\d{4}-\d{2}-\d{2})/);if(cell){anchor=cell[1];mode='year';}
  filter=null;draw();
  if(document.querySelector(selector)?.closest('#purpose-rules')){
    $('purpose-rules').hidden=false;$('rules-open').setAttribute('aria-expanded','true');
  }
});
