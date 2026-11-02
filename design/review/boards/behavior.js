const $=id=>document.getElementById(id);
const samples=[
  {id:'course',time:'周一 09:00–09:22',app:'课程播放器',device:'电脑',minutes:22},
  {id:'lookup',time:'周一 09:22–09:30',app:'词典',device:'手机',minutes:8},
  {id:'mail',time:'周二 14:00–14:18',app:'邮件',device:'电脑',minutes:18},
  {id:'short',time:'周二 14:18–14:20',app:'词典',device:'手机',minutes:2},
  {id:'web',time:'周二 14:20–14:26',app:'浏览器',device:'电脑',minutes:6}
];
const storage='ztime-review-behavior-v1';
const initial={names:['学习','工作','娱乐'],rules:{'课程播放器':'学习','词典':'学习','邮件':'工作'},exceptions:{}};
const state=JSON.parse(sessionStorage.getItem(storage)||'null')||initial;
const missing='未分类';
let filter=null;
function group(s){return state.exceptions[s.id]??state.rules[s.app]??missing;}
function element(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function save(message){sessionStorage.setItem(storage,JSON.stringify(state));draw();$('feedback').textContent=message;}
function picker(id,label,choices,value,onchange){
  const select=document.createElement('select');select.id=id;select.setAttribute('aria-label',label);
  for(const [key,title] of choices)select.add(new Option(title,key));
  select.value=value;select.onchange=()=>onchange(select.value);return select;
}
function draw(){
  const names=[...state.names,missing], options=names.map(name=>[name,name]);
  $('sum').textContent='设备累计 '+samples.reduce((n,s)=>n+s.minutes,0)+' 分钟';
  $('purpose-totals').replaceChildren(...names.map((name,i)=>{
    const button=element('button',name);button.id='purpose-'+i;button.dataset.styleNative='';
    button.setAttribute('aria-pressed',String(filter===name));
    button.append(element('b',samples.filter(s=>group(s)===name).reduce((n,s)=>n+s.minutes,0)+' 分钟'));
    button.onclick=e=>{if(e.defaultPrevented)return;filter=filter===name?null:name;draw();};return button;
  }));
  $('sessions-heading').textContent=filter?filter+'时段':'全部时段';$('show-all').hidden=!filter;
  const visible=samples.filter(s=>!filter||group(s)===filter);
  $('session-list').replaceChildren(...visible.map(s=>{
    const row=element('div','');row.className='session-row';row.id='session-'+s.id;
    const info=element('div','');
    info.append(element('b',s.app+' · '+s.minutes+' 分钟'));
    const rule=state.rules[s.app];
    const reason=state.exceptions[s.id]?'手动修正 · 本段归入'+group(s):rule?'应用规则 · '+s.app+' → '+rule:'未命中规则';
    info.append(element('small',s.device+' · '+reason));
    row.append(element('small',s.time),info,picker('override-'+s.id,'调整'+s.app+'本段用途',[['','按规则：'+(rule||missing)],...options],state.exceptions[s.id]??'',value=>{
      if(value)state.exceptions[s.id]=value;else delete state.exceptions[s.id];
      save(s.time+' 已计入'+group(s)+'。');
    }));
    return row;
  }));
  if(!visible.length)$('session-list').append(element('p','这周没有归入此行为的时段。'));
  $('rule-list').replaceChildren(...[...new Set(samples.map(s=>s.app))].map((app,i)=>{
    const label=element('label',app);label.append(picker('rule-'+i,app+'默认行为',[['','无规则'],...options.slice(0,-1)],state.rules[app]??'',value=>{
      if(value)state.rules[app]=value;else delete state.rules[app];save(app+'的规则已更新。');
    }));return label;
  }));
}
$('rules-open').onclick=e=>{if(e.defaultPrevented)return;const panel=$('purpose-rules');panel.hidden=!panel.hidden;$('rules-open').setAttribute('aria-expanded',String(!panel.hidden));};
$('show-all').onclick=e=>{if(!e.defaultPrevented){filter=null;draw();}};
$('purpose-form').onsubmit=e=>{e.preventDefault();const name=$('purpose-name').value.trim();
  if(!name||[...state.names,missing].includes(name)){ $('feedback').textContent='请输入一个新的行为名称。';return;}
  state.names.push(name);$('purpose-name').value='';save('已添加'+name+'。');
};
draw();
document.addEventListener('reveal-behavior-note',event=>{
  filter=null;draw();
  if(document.querySelector(event.detail)?.closest('#purpose-rules')){
    $('purpose-rules').hidden=false;$('rules-open').setAttribute('aria-expanded','true');
  }
});
