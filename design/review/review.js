// @generated desk-preview:start
const desktopTitles={trend:'使用时间',ranking:'应用排行',compare:'期间对比',devices:'设备用时占比',focus:'应用集中度'};
function desktopLayout(saved){
 const defaults=Object.keys(desktopTitles).map(key=>({key,visible:['trend','ranking'].includes(key)}));
 if(!Array.isArray(saved) || saved.some(r=>!r || !Object.hasOwn(desktopTitles,r.key) || typeof r.visible!=='boolean') || new Set(saved.map(r=>r.key)).size!==saved.length)return defaults;
 return [...saved,...defaults.filter(row=>!saved.some(r=>r.key===row.key))];
}
function validDesktopLayout(rows){
 return Array.isArray(rows) && rows.length===Object.keys(desktopTitles).length &&
   rows.every(row=>row && Object.hasOwn(desktopTitles,row.key) && typeof row.visible==='boolean') &&
   new Set(rows.map(r=>r.key)).size===rows.length;
}

// Presentation shared by the Windows renderer and its example-data review board.
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function usageArea(bins,format){
 if(!bins.length)return '<p>所选期间暂无使用记录</p>';
 const max=Math.max(60000,...bins.map(b=>b.duration||0)), width=640, height=126;
 const points=bins.flatMap((b,i)=>b.duration==null?[]:[{x:(i+.5)*width/bins.length,y:height-height*b.duration/max,b}]);
 const line=points.map(({x,y},i)=>(i?'L':'M')+x+' '+y).join(' ');
 const fill=points.length?line+' L'+points.at(-1).x+' '+height+' L'+points[0].x+' '+height+' Z':'';
 const step=Math.ceil(bins.length/8);
 return `<div class="usage-chart"><div class="usage-y"><span>${(max/3600000).toFixed(1)}</span><span>0</span></div><div><svg viewBox="0 0 ${width} ${height+4}" preserveAspectRatio="none" role="img" aria-label="使用时间面积图，单位小时"><path d="${fill}" fill="currentColor" opacity=".16"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${points.map(({x,y,b})=>`<g><title>${html(b.label)} · ${html(format(b.duration))}</title><circle cx="${x}" cy="${y}" r="2.3" fill="currentColor"/><rect x="${x-width/bins.length/2}" width="${width/bins.length}" height="${height}" fill="transparent"/></g>`).join('')}</svg><div class="usage-x" style="grid-template-columns:repeat(${bins.length},1fr)">${bins.map((b,i)=>'<span>'+(i%step===0||i===bins.length-1?html(b.label):'')+'</span>').join('')}</div></div></div>`;
}
function shareChart(key,apps,format){
 const total=apps.reduce((n,a)=>n+a.duration,0);
 if(!total)return '<p>所选期间暂无使用记录</p>';
 const devices=key==='devices', first=devices?apps.filter(a=>a.platform==='windows').reduce((n,a)=>n+a.duration,0):apps.slice(0,3).reduce((n,a)=>n+a.duration,0);
 const groups=[[devices?'电脑':'排行前三',first],[devices?'手机':'其他应用',total-first]];
 return '<div class="share-meter" aria-hidden="true"><i style="width:'+100*first/total+'%"></i></div>'+groups.map(([name,n])=>`<div class="share-row"><span>${name}</span><b>${Math.round(n*100/total)}%</b><small>${html(format(n))}</small></div>`).join('');
}
const popular={'Asia/Shanghai':'北京 / 上海','Asia/Hong_Kong':'香港','Asia/Macau':'澳门','Asia/Taipei':'台北','Asia/Singapore':'新加坡','Asia/Tokyo':'东京','Asia/Seoul':'首尔','Asia/Kolkata':'新德里','Europe/London':'伦敦','Europe/Paris':'巴黎','Europe/Berlin':'柏林','America/New_York':'纽约','America/Los_Angeles':'洛杉矶','America/Toronto':'多伦多','Australia/Sydney':'悉尼','Pacific/Auckland':'奥克兰','UTC':'协调世界时'};
const regions={Africa:'非洲',America:'美洲',Antarctica:'南极洲',Arctic:'北极',Asia:'亚洲',Atlantic:'大西洋',Australia:'澳洲',Europe:'欧洲',Indian:'印度洋',Pacific:'太平洋'};
function zoneSelect(current){
 const groups=new Map([['常用城市',Object.entries(popular)]]);
 for(const id of new Set([current,...(Intl.supportedValuesOf?.('timeZone')||[])])){
  if(!id||Object.hasOwn(popular,id))continue;
  const region=regions[id.split('/')[0]]||'其他时区';
  if(!groups.has(region))groups.set(region,[]);
  groups.get(region).push([id,id.split('/').slice(1).join(' / ').replaceAll('_',' ')||id]);
 }
 return '<select id="timeZone">'+[...groups].map(([label,items])=>'<optgroup label="'+label+'">'+items.map(([id,city])=>`<option value="${html(id)}" ${current===id?'selected':''}>${html(city)}</option>`).join('')+'</optgroup>').join('')+'</select>';
}

function desktopUsageChart(series,mode,style){
   const peak=Math.max(1,...series.map(bin=>(bin.minutes||0)/60));
   const step=Math.max(1,Math.ceil(peak/4));
   const top=Math.ceil(peak/step)*step;
   const ticks=Array.from({length:top/step+1},(_,i)=>top-step*i);
   const width=640,height=126,slot=width/series.length;
   const points=series.flatMap((bin,index)=>bin.minutes===null?[]:[{
     x:(index+.5)*slot,y:height*(1-bin.minutes/(top*60)),bin
   }]);
   const line=points.map(({x,y},i)=>(i?'L':'M')+x+' '+y).join(' ');
   const guides=ticks.map(tick=>'<line x1="0" x2="640" y1="'+(1-tick/top)*height+'" y2="'+(1-tick/top)*height+'" stroke="var(--line)" vector-effect="non-scaling-stroke"/>').join('');
   const drawing=style==='line' && points.length?'<path d="'+line+' L'+points.at(-1).x+' '+height+' L'+points[0].x+' '+height+' Z" fill="currentColor" opacity=".12"/><path d="'+line+'" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/>':'';
   const marks=points.map(({x,y})=>{
     const bar=style==='bar'?'<rect x="'+(x-slot*.3)+'" y="'+y+'" width="'+slot*.6+'" height="'+(height-y)+'" rx="2" fill="currentColor"/>':'';
     return '<g>'+bar+'<circle cx="'+x+'" cy="'+y+'" r="2.3" fill="currentColor"/><rect x="'+(x-slot/2)+'" width="'+slot+'" height="'+height+'" fill="transparent"/></g>';
   }).join('');
   const labels=series.map((bin,i)=>'<span>'+(i%(mode==='day'?2:Math.ceil(series.length/8))===0?html(bin.label):'')+'</span>').join('');
   return '<div class="usage-chart desktop-hour-chart"><div class="usage-y">'+ticks.map(t=>'<span>'+t+' 小时</span>').join('')+'</div><div><svg viewBox="0 0 640 126" preserveAspectRatio="none">'+guides+drawing+marks+'</svg><div class="usage-x" style="grid-template-columns:repeat('+series.length+',1fr)">'+labels+'</div></div></div>';
 }
function bindDesktopPoints(card,series,{pointIndex,onSelect,dur,enabled=()=>true,onChange=()=>{}}){
   const d=card.ownerDocument;
   const svg=card.querySelector('.usage-chart svg');
   // The chart keeps hourly data; only axis labels are spaced two hours apart.
   svg.setAttribute('role','group');
   svg.setAttribute('aria-label','使用时间，点击时间点查看应用明细');
   const detail=d.createElement('section');detail.className='desktop-point-detail';detail.id='point-detail';detail.hidden=true;
   detail.setAttribute('role','region');detail.setAttribute('aria-label','所选时段明细');detail.setAttribute('aria-live','polite');
   card.append(detail);
   const points=[...svg.querySelectorAll('g')];
   const close=()=>{detail.hidden=true;pointIndex=null;onSelect(null);points.forEach(g=>{g.setAttribute('aria-expanded','false');g.querySelector('circle').setAttribute('r','2.3');});onChange();};
   function inspect(index){
     const bin=series[index];pointIndex=index;onSelect(index);detail.hidden=false;
     points.forEach((g,i)=>{g.setAttribute('aria-expanded',String(i===index));g.querySelector('circle').setAttribute('r',i===index?'5':'2.3');});
     const rows=bin.rows;
     detail.innerHTML='<header><strong>'+html(bin.detail)+'</strong><button type="button" aria-label="关闭时段明细">×</button></header><div class="point-total"><span>累计用时</span><b>'+dur(bin.minutes)+'</b></div>'+
       (rows.length?'<ul>'+rows.map(({name,platform,minutes})=>'<li><span>'+html(name)+' <small>'+(platform==='windows'?'电脑':'手机')+'</small></span><b>'+dur(minutes)+'</b></li>').join('')+'</ul>':'<p>这段时间没有使用记录。</p>');
     detail.querySelector('button').onclick=()=>{close();points[index]?.focus();};
     onChange();
   }
   points.forEach((g,index)=>{
     g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-controls','point-detail');g.setAttribute('aria-expanded','false');
     g.setAttribute('aria-label',series[index].detail+' · '+dur(series[index].minutes));
     g.onclick=()=>{if(enabled())inspect(index);};
     g.onkeydown=e=>{if(enabled() && ['Enter',' '].includes(e.key)){e.preventDefault();inspect(index);}};
   });
   card.addEventListener('keydown',e=>{if(e.key==='Escape' && !detail.hidden){const index=pointIndex;close();points[index]?.focus();e.stopPropagation();}});
   if(pointIndex!==null && series[pointIndex]?.minutes!=null)inspect(pointIndex);
 }
// @generated desk-preview:end
// All state lives in the current fixture document; no calls to the product or the notes API.
const timers=new WeakMap();
function notice(d,message){
 let el=d.querySelector('.sample-toast');
 if(!el){el=d.createElement('p');el.className='sample-toast';el.setAttribute('role','status');d.body.append(el);}
 if(el.parentElement!==d.body)d.body.append(el);
 clearTimeout(timers.get(el));el.textContent=message;el.hidden=false;
 timers.set(el,setTimeout(()=>{el.hidden=true;},2600));
}
function confirmDeletion(d,button){
 const group=button.closest('.spec,.risk-block,#design-settings-data');if(!group)return;
 const existing=group.querySelector('.style-confirm');if(existing){existing.querySelector('button').focus();return;}
 const box=d.createElement('div');box.className='style-confirm';box.setAttribute('role','group');
 box.setAttribute('aria-label','确认删除');
 box.innerHTML='<p>确认删除所有记录？此操作无法撤销。</p><div class="row"><button data-style-demo="cancel">取消</button><button class="danger" data-style-demo="confirm">确认删除</button></div>';
 group.append(box);box.querySelector('button').focus();
}
function handleStyleDemo(d,el){
 const button=el.closest('button');if(!button)return false;
 const scope=button.dataset.scope;
 if(scope){
  const card=button.closest('.spec'),[time,caption]=({all:['4 小时 30 分钟','两台设备累计'],phone:['1 小时 30 分钟','手机用时'],pc:['3 小时','电脑用时']})[scope];
  card.querySelectorAll('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  card.querySelector('[data-scope-time]').textContent=time;card.querySelector('[data-scope-caption]').textContent=caption;
  card.querySelector('.mini-meter i').style.display=scope==='pc'?'none':'';
  card.querySelector('.mini-meter b').style.display=scope==='phone'?'none':'';
  return true;
 }
 const action=button.dataset.styleDemo||({refresh:'refresh','save-settings':'save','delete-data':'delete'})[button.dataset.action]||(button.dataset.export?'export':null);
 if(!action)return false;
 switch(action){
  case 'refresh':notice(d,'已更新示例视图');break;
  case 'save':{
   const hint=d.querySelector('[data-save-hint]');if(hint)hint.textContent='示例起点：'+d.querySelector('[data-style-id=day-start]').value;
    if(d.body.dataset.reviewDevice==='mobile' && d.getElementById('timeZone'))mobileZone=d.getElementById('timeZone').value;
   if(currentDraft() && d.getElementById('timeZone')){
     desktopZone=d.getElementById('timeZone').value;
     desktopPreview.dayStart=d.getElementById('dayStart').value;
   }
   notice(d,'示例设置已保存');break;
  }
  case 'export':notice(d,'示例：'+button.textContent.trim().replace(/\s+/g,' ')+'（不会下载真实记录）');break;
  case 'delete':confirmDeletion(d,button);break;
  case 'confirm':case 'cancel':{
   const box=button.closest('.style-confirm'),trigger=box.parentElement.querySelector('[data-style-demo=delete],[data-action=delete-data]');
   box.remove();trigger?.focus();notice(d,action==='cancel'?'已取消':'删除流程演示结束，示例数据保留');break;
  }
  default:return false;
 }
 return true;
}



const $ = id => document.getElementById(id);
const frame = $('frame'), device = $('device'), page = $('page');
const titles = Object.fromEntries([...page.options].map(option => [option.value, option.text]));
const flowTitles = {invite:'电脑生成配对信息',scan:'手机扫码',confirm:'确认目标设备',wait:'等待确认',request:'电脑审批',success:'配对成功',refused:'配对被拒绝',timeout:'等待超时'};
function pageTitle(id) {
  if(id==="behavior")return "行为";
  if(id==="home" && device.value==="desktop")return "统计";
  if (id.startsWith('pair-')) return '配对 · '+flowTitles[id.slice(5)];
  if (id.includes('-detail-')) {
    const [parent, , app] = id.split('-');
    return titles[parent]+' · '+({writer:'文稿编辑器',browser:'浏览器',reader:'阅读',notes:'笔记'})[app]+'明细';
  }
  return titles[id] || ({week:'每周（历史批注）','week-edit':'每周编辑（历史批注）'})[id];
}
let periodView=null;
const refreshGlyph='<svg class="review-refresh-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M20 7v5h-5 M19.4 11a7.4 7.4 0 1 0-2 6.5"/></svg>';
const desktopV2='desktop-v2';
const secondDraftPrefix='电脑版第二版 · ';
const secondDraftNote=note=>note.flow?.startsWith(secondDraftPrefix)===true;
const currentDraft=()=>frame.dataset.feature===desktopV2;
const dashboardRoute=()=>device.value==='desktop'?desktopV2:'dashboard';
const isDashboard = f=>['dashboard','calendar','layout',desktopV2].includes(f);

let desktopZone='Asia/Hong_Kong';
const desktopPreview={recording:true,startup:true,theme:'light',chart:'line',dayStart:'4'};
function applyPreviewTheme(d){
  const dark=desktopPreview.theme==='dark';
  d.body.classList.toggle('dark',dark);
  d.body.classList.toggle('light',!dark);
}
function updatePreviewRecording(d){
  for(const state of d.querySelectorAll('.statusbar .state')){
    state.innerHTML='<span class="dot'+(desktopPreview.recording?'':' off')+'"></span>'+(desktopPreview.recording?'正在记录 · 文稿编辑器':'记录已暂停');
  }
}
function previewSwitch(d,row,button,label,key){
  const line=d.createElement('label');line.className='preview-switch-row';
  const caption=d.createElement('span');caption.textContent=label;
  line.append(caption,button);row.append(line);
  button.textContent='';button.dataset.styleNative='';button.className='preview-switch';
  button.setAttribute('role','switch');button.setAttribute('aria-label',label);
  function set(value){
    desktopPreview[key]=value;button.setAttribute('aria-checked',String(value));
    if(key==='recording')updatePreviewRecording(d);
  }
  set(desktopPreview[key]);
  let start=null,dragged=false;
  button.onpointerdown=e=>{if(picking||e.button!==0)return;start=e.clientX;dragged=false;button.setPointerCapture(e.pointerId);};
  button.onpointermove=e=>{
    if(start===null)return;
    const position=(desktopPreview[key]?18:0)+e.clientX-start;
    button.style.setProperty('--switch-position',Math.max(0,Math.min(18,position))+'px');
  };
  button.onpointerup=e=>{
    if(start!==null && Math.abs(e.clientX-start)>5){dragged=true;set(e.clientX>start);}
    button.style.removeProperty('--switch-position');
    start=null;
  };
  button.onpointercancel=()=>{button.style.removeProperty('--switch-position');start=null;dragged=false;};
  button.onclick=e=>{if(!picking && (!dragged||e.detail===0))set(!desktopPreview[key]);dragged=false;};
}
function appearanceChoices(d){
  const field=d.querySelector('#theme').closest('.field');
  field.classList.add('preview-appearance');field.setAttribute('role','group');field.setAttribute('aria-label','外观');
  field.innerHTML='<div class="appearance-options"></div>';
  const options=field.lastElementChild;
  for(const [key,label] of [['light','浅色'],['dark','深色']]){
    const button=d.createElement('button');button.type='button';button.dataset.theme=key;button.dataset.styleNative='';
    button.textContent=label;
    button.setAttribute('aria-pressed',String(key===desktopPreview.theme));
    button.onclick=()=>{if(picking)return;desktopPreview.theme=key;applyPreviewTheme(d);for(const item of options.children)item.setAttribute('aria-pressed',String(item===button));};
    options.append(button);
  }
}
let mobileZone='Asia/Hong_Kong';
function populateTimeZones(d){
  const select=d.getElementById('timeZone');
  const common=new Map([['Asia/Hong_Kong','香港'],['Asia/Shanghai','上海（北京时间）'],['Asia/Taipei','台北'],['Asia/Singapore','新加坡'],['Asia/Tokyo','东京'],['Europe/London','伦敦'],['America/New_York','纽约'],['UTC','协调世界时']]);
  select.replaceChildren();
  for(const [title,zones] of [
    ['常用时区',common],
    ['其他时区',(Intl.supportedValuesOf?.('timeZone')??[]).filter(id=>!common.has(id)).map(id=>[id,id])]
  ]){
    const group=d.createElement('optgroup');
    group.label=title;
    for(const [id,label] of zones)group.append(new Option(label,id));
    select.append(group);
  }
  select.value=mobileZone;
}

// Former copy anchors remain navigable after the text has been removed from this draft.
const removedDesktopCopy={
  'desktop-settings':[
    ['#extension-settings > p:nth-of-type(1)','#extension-settings h2'],
    ['#design-settings-data > p:nth-of-type(1)','#design-settings-data'],
    ['#design-settings-data > section:nth-of-type(1) > p:nth-of-type(1)','#design-settings-data [data-action=delete-data]']
  ],
  'desktop-devices':[
    ['#app > div:nth-of-type(1) > main:nth-of-type(1) > section:nth-of-type(1) > p:nth-of-type(1)','#lan-ready h2']
  ]
};
const desktopNavigation=[
  ['home','统计','M4 4v16h17 M8 16v-4 M13 16V7 M18 16v-7'],
  ['behavior','行为','M3 12h4l3-7 4 14 3-7h4'],
  ['devices','设备','M3 4h18v12H3z M8 21h8 M12 16v5'],
  ['settings','设置','M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2']
];
function desktopNavButtons(current){
  return desktopNavigation.map(([id,label,path])=>{
    const active=current===id;
    const target=active && id==='home'?'data-cal="home"':'data-page="'+id+'"';
    return '<button '+target+(active?' class="active" aria-current="page"':'')+'><svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="'+path+'"/></svg>'+label+'</button>';
  }).join('');
}
function applySecondDesktopDraft(d,pageId){
  d.body.classList.add('desktop-v2','desk-ui');
  applyPreviewTheme(d);updatePreviewRecording(d);
  if(pageId!=='home'){
    const nav=d.querySelector('.sidebar .nav');
    nav.setAttribute('aria-label','主导航');
    nav.innerHTML=desktopNavButtons(pageId);
    const version=d.createElement('small');
    version.id='desktop-version';version.textContent='版本 0.2.19';
    d.querySelector('.sidebar').append(version);
  }

  for(const [selector] of removedDesktopCopy['desktop-'+pageId]||[])d.querySelector(selector)?.remove();
  if(pageId==='devices'){
    const card=d.createElement('section');card.className='panel';card.id='extension-settings';
    card.innerHTML='<h2>浏览器识别</h2><button data-action="design-extension">启用并生成连接码</button><p id="design-connection" hidden>连接码示意 · 在扩展弹窗中输入</p>';
    d.querySelector('.devices-view').append(card);
  }
  if(pageId!=='settings')return;
  d.getElementById('extension-settings')?.remove();
  const data=d.getElementById('design-settings-data');
  data.querySelector('.row').append(data.querySelector('[data-action=delete-data]'));
  data.querySelector('.risk-block').remove();
  const grid=d.querySelector('.settings-grid');
  const input=d.getElementById('timeZone');input.outerHTML=zoneSelect(desktopZone);
  const day=d.getElementById('dayStart');day.value=desktopPreview.dayStart;
  const rules=day.closest('.panel');rules.classList.add('preview-rules');
  const pause=grid.querySelector('[data-action=pause]'), startup=grid.querySelector('[data-action=autostart]');
  const row=d.createElement('div');row.className='record-actions';pause.before(row);const p=startup.parentElement;
  previewSwitch(d,row,pause,'记录','recording');previewSwitch(d,row,startup,'开机自启','startup');p.remove();
  appearanceChoices(d);
  const appearance=row.closest('.panel');appearance.classList.add('preview-preferences');
  data.querySelector('h2').remove();data.className='preview-data-actions';
  data.setAttribute('role','group');data.setAttribute('aria-label','使用记录操作');
  appearance.append(data);
  grid.querySelector('.accent-picker')?.remove();
  const about=[...grid.children].find(card=>card.querySelector('h2')?.textContent==='Ztime');
  about?.remove();
}
let flowTrail = '', trialMode = false, originals = new Map();
// All synchronization here is simulated with the same two fixed example devices.
const syncDemo = {state:'ready', initiator:null, lastSuccess:null, hasChanges:true};
function drawSync(override) {
  const d=doc(), button=d?.querySelector('[data-action="sync"]');
  if (!button || !d.getElementById('lan-ready')) return;
  let state=override || syncDemo.state;
  if (!override && state==='offline' && syncDemo.initiator!==device.value) state=syncDemo.lastSuccess?'current':'ready';
  d.querySelectorAll('[data-sync-state]').forEach(el=>el.hidden=el.dataset.syncState!==state);
  button.disabled=state==='busy';
  button.textContent=state==='busy'?'正在同步…':'立即同步';
  if (syncDemo.lastSuccess) {
    const info=d.querySelector('[data-unpair]')?.closest('.device')?.querySelector('.device-info .small');
    if (info) info.textContent=info.textContent.split(' · ')[0]+' · 上次同步 '+syncDemo.lastSuccess;
  }
}
function simulateSync() {
  if (syncDemo.state==='busy') return;
  const reachable=$('reachability').value==='online';
  syncDemo.state='busy'; syncDemo.initiator=device.value;
  flowTrail=describe(board())+' → 已配对 → 立即同步';
  drawSync();
  setTimeout(()=>{
    if (reachable) {
      syncDemo.state=syncDemo.hasChanges?'done':'current';
      syncDemo.hasChanges=false;
      syncDemo.lastSuccess=new Date().toLocaleTimeString('zh-CN',{hour12:false});
    } else syncDemo.state='offline';
    if (page.value==='devices' && !picking && !draft) {drawSync(); pins();}
  },900);
}
let notes = [], picking = false, draft = null, highlight = null, jumpTo = null;
const board = () => device.value + '-' + page.value;
const doc = () => frame.contentDocument;
function describe(key) {
  const [mode, ...parts] = key.split('-');
  return (mode === 'mobile' ? '手机' : '桌面') + ' · ' + pageTitle(parts.join('-'));
}
function status(text) { $('status').textContent = text; }
function resize() {
  const stage = $('stage'), width = device.value === 'mobile' ? 390 : 1280;
  const scale = Math.min(1, stage.clientWidth / width);
  if (!scale) return;
  const height = Math.round(stage.clientHeight / scale);
  $('mount').style.width = width * scale + 'px';
  Object.assign(frame.style, {width: width + 'px', height: height + 'px', transform: 'scale(' + scale + ')'});
  $('caption').textContent = (frame.dataset.feature===desktopV2?secondDraftPrefix:'') + (frame.dataset.feature==='controls'?'控件样式':isDashboard(frame.dataset.feature)&&page.value==='home'?(frame.dataset.feature===desktopV2?'统计':'仪表盘'):describe(board())) + '　' + width + ' × ' + height + ' px';
}
function setPicking(enabled) {
  picking = enabled;
  $('trial').setAttribute('aria-pressed', String(enabled && trialMode));
  $('annotate').setAttribute('aria-pressed', String(enabled && !trialMode));
  $('annotate').textContent = enabled && !trialMode ? '取消选点' : '＋ 添加批注';
  doc()?.documentElement.classList.toggle('picking', enabled);
  if (highlight) highlight.removeAttribute('data-pointer-target');
  highlight = null;
}
function clearEditor() {
  draft = null;
  doc()?.querySelector('[data-review-selected]')?.removeAttribute('data-review-selected');
  $('editor').hidden = true;
  setPicking(false);
  drawSync(); applyTrials(); pins();
}
function allowLeave() {
  if(!draft)return true;
  const changed=$('message').value!==(draft.text||'') || (draft.trial &&
    ($('trial-copy').value!==draft.trial.copy || $('trial-size').value!==String(draft.trial.size??'')));
  return !changed || confirm('放弃尚未保存的修改？');
}
function showBoard(key, feature = "") {
  if (/^mobile-(home|devices|settings)$/.test(key) && !['calendar','layout'].includes(feature)) feature='dashboard';
  const [mode, ...parts] = key.split('-');
  const id = parts.join('-');
  page.querySelector('[data-context]')?.remove();
  if (![...page.options].some(o=>o.value===id)) {const o=new Option(pageTitle(id),id);o.dataset.context='';page.add(o);}
  device.value = mode; page.value = id;
  page.querySelector('option[value="home"]').textContent=feature===desktopV2?'统计':isDashboard(feature)?'仪表盘':'今日';
  $('sync-scenario').hidden=id!=='devices';
  clearEditor(); frame.dataset.feature=feature; resize();
  location.hash = feature?key+'/'+feature:key;
  frame.src = 'boards/' + key + '.html';
}
function changeBoard(key, action, feature = "") {
  const previous = frame.dataset.loaded;
  if (!allowLeave()) {
    if (previous) {
      const [mode, ...parts] = previous.split('-');
      device.value = mode; page.value = parts.join('-');
    }
    return;
  }
  jumpTo = null;
  flowTrail = action ? ((flowTrail || describe(previous || key))+' → '+action+' → '+describe(key)).slice(-1000) : describe(key);
  showBoard(key,feature);
}

// Prefer stable control and widget identifiers. Within unlabelled regions
// retain the specific descendant, so two units in one metric stay distinct.
function selectorFor(el) {
  const parts = [];
  while (el && el !== doc().body) {
    if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
    const attr = ['data-style-id','data-widget','data-action','data-page','data-filter','data-title','data-app','data-export','data-accent'].find(k => el.hasAttribute(k));
    if (attr) {
      const match = '[' + attr + '=' + CSS.escape(el.getAttribute(attr)) + ']';
      if (doc().querySelectorAll(match).length === 1) { parts.unshift(match); break; }
    }
    const tag = el.localName;
    const siblings = [...el.parentElement.children].filter(child => child.localName === tag);
    parts.unshift(tag + ':nth-of-type(' + (siblings.indexOf(el)+1) + ')');
    el = el.parentElement;
  }
  return parts.join(' > ') || 'body';
}
function nodeLabel(el) {
  const region = el.closest('[data-widget],.panel,.sidebar');
  const title = region?.querySelector('h1,h2,h3')?.textContent.trim() || region?.dataset.widget || '';
  const detail = el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g,' ').slice(0,36) || el.classList[0] || el.localName;
  return [title, detail].filter((v,i,a) => v && a.indexOf(v) === i).join(' / ');
}
function editor(note) {
  if(!note.id && currentDraft() && !secondDraftNote(note))note.flow=secondDraftPrefix+(note.flow||describe(note.board));
  setPicking(false);
  doc().querySelector('[data-review-selected]')?.removeAttribute('data-review-selected');
  targetFor(note)?.setAttribute('data-review-selected','');
  draft = note;
  $('editor').hidden = false;
  $('target').textContent = (note.id && device.value!=='desktop' ? '#' + note.id + ' ' : '') + describe(note.board) + ' · ' + note.label;
  $('message').value = note.text || '';
  $('kind').value = note.kind || (note.board.includes('-pair-')?'UX':'UI');
  $('trail').textContent = (note.flow || describe(note.board)).split('｜')[0];
  $('trial-fields').hidden=!note.trial;
  $('editor').querySelector('.primary').textContent=note.trial?'保存试改':'保存批注';
  if(note.trial){$('trial-copy').value=note.trial.copy;$('trial-size').value=note.trial.size??'';$('trial-copy').focus();}
  else $('message').focus();
}
function canEdit(el){
  return el && !el.children.length && el.matches('button,h1,h2,h3,p,span,strong,label,small,td,th,a') && el.textContent.trim();
}
function applyTrials(){
  for(const [el,base] of originals){if(!el.isConnected){originals.delete(el);continue;}el.textContent=base.copy;el.style.fontSize=base.size;}
  for(const n of notes){
    if(noteBoard(n)!==frame.dataset.loaded || !n.trial || n.resolved)continue;
    const el=targetFor(n);if(!canEdit(el))continue;
    if(!originals.has(el))originals.set(el,{copy:el.textContent,size:el.style.fontSize});
    el.textContent=n.trial.copy;
    el.style.fontSize=n.trial.size?n.trial.size+'px':originals.get(el).size;
  }
}
function previewTrial(){
  applyTrials();
  if(!draft?.trial)return;
  const el=targetFor(draft);if(!canEdit(el))return;
  if(!originals.has(el))originals.set(el,{copy:el.textContent,size:el.style.fontSize});
  const size=Number($('trial-size').value);
  el.textContent=$('trial-copy').value || originals.get(el).copy;
  el.style.fontSize=size>=8 && size<=80?size+'px':originals.get(el).size;
}
function showCatalog(d,visible){
 const gallery=d.getElementById('design-control-gallery');if(!gallery)return;
 gallery.hidden=!visible;d.body.classList.toggle('catalog',visible);
 d.getElementById('app').hidden=visible;
}
function reveal(el){
 if(el){const active=!!el.closest('#period-dashboard');showCatalog(el.ownerDocument,!!el.closest('#design-control-gallery'));if(periodView){periodView.root.hidden=!active;if(active)el.ownerDocument.getElementById('app').hidden=true;}}
  const state=el?.closest('#design-report-preview,#design-connection');
  if(state)state.hidden=false;
}
// Keep mobile annotations attached to their replacement controls on the current boards.
const mobileAnnotationTargets={
  'mobile-home':{'[data-action=edit]':'[data-cal=layout]','[data-widget=header]':'.pd-summary'},
  'mobile-devices':{'#app > div:nth-of-type(1) > main:nth-of-type(1) > section:nth-of-type(1) > p:nth-of-type(1)':'.devices-view > section[aria-live]'},
  'mobile-settings':{
    '#design-settings-data > p:nth-of-type(1)':'#design-settings-data > h2',
    '#design-settings-data > section:nth-of-type(1) > p:nth-of-type(1)':'#design-settings-data [data-action=delete-data]',
    '#app > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > fieldset:nth-of-type(1)':'#theme',
    '#app > div:nth-of-type(1) > main:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(4)':'#mobile-version'
  }
};
// Keep earlier desktop notes attached to the browser card after it moves to Devices.
function noteBoard(note){
  return secondDraftNote(note) && note.board==='desktop-settings' && /^#(?:extension-settings|design-connection)(?:$|[ >])/.test(note.selector)
    ? 'desktop-devices' : note.board;
}
function comparisonNote(note){
  return (secondDraftNote(note) && note.id===37) ||
    (note.board==='mobile-home' && [48,49].includes(note.id));
}
function targetFor(note) {
  if(secondDraftNote(note)!==currentDraft())return null;
  try {
    if(note.board==='desktop-behavior' && note.id===110)return doc().querySelector('.behavior h1');
    if(note.board==='desktop-behavior' && note.id===115)return doc().getElementById('purpose-chart');
    if(note.board==='desktop-behavior' && note.id===118)return doc().getElementById('purpose-rules');
    if(note.board==='desktop-behavior' && note.id===108)return doc().getElementById('session-course');
    if(note.board==='desktop-settings' && [96,97].includes(note.id))return doc().querySelector(note.selector)?.parentElement.querySelector('span');
    if(note.board==='mobile-home' && note.selector==='#point-detail' && !doc().querySelector('#point-detail')?.textContent)return doc().querySelector('.point-plot');
    if(comparisonNote(note)){
      const card=doc().querySelector('[data-card-key=compare]');
      return card?.hidden?doc().querySelector('[data-cal=layout-toggle][data-key=compare]'):card;
    }
    if(note.board==='desktop-home' && note.id===99)return doc().querySelector('.chart-style');
    if(note.board==='desktop-settings' && note.id===102)return doc().querySelector('.preview-appearance')?.closest('.panel')?.querySelector('h2');
    if(note.board==='desktop-settings' && note.id===104)return doc().querySelector('.appearance-options');
    if(secondDraftNote(note) && note.board==='desktop-settings' && note.selector==='#design-settings-data > section:nth-of-type(1)')return doc().querySelector('#design-settings-data [data-action=delete-data]');
    const moved=secondDraftNote(note) && removedDesktopCopy[note.board]?.find(([selector])=>selector===note.selector);
    if(moved)return doc().querySelector(moved[1]);
    const replacement=mobileAnnotationTargets[note.board]?.[note.selector];
    if(replacement)return doc().querySelector(replacement);
    const el=doc().querySelector(note.selector);
    if(!el && note.flow?.startsWith('仪表盘 · ') && note.label==='ZTIME / 使用概览')return doc().getElementById('pd-heading');
    return el;
  } catch { return null; }
}
function locate(note) {
  if (!allowLeave()) return;
  const v2=secondDraftNote(note);
  const flow=v2?note.flow.slice(secondDraftPrefix.length):note.flow;
  const dashboardNote=flow?.startsWith('仪表盘 · ');
  const unifiedPage=note.flow?.includes('仪表盘') && /-(devices|settings)$/.test(note.board);
  const destination=noteBoard(note);
  if (board() !== destination || frame.dataset.loaded !== destination || v2!==currentDraft() || (dashboardNote && !periodView) || (unifiedPage && !isDashboard(frame.dataset.feature))) {
    jumpTo = note;
    showBoard(destination,v2?desktopV2:dashboardNote||unifiedPage?'dashboard':'');
    return;
  }
  if(dashboardNote)periodView.restore(flow);
  if(comparisonNote(note) && doc().querySelector('[data-card-key=compare]')?.hidden)periodView.open('layout');
  if(destination==='desktop-behavior')doc().dispatchEvent(new CustomEvent('reveal-behavior-note',{detail:note.selector}));
  const el = targetFor(note);
  if (el) {
    reveal(el);
    const syncState=el.closest('[data-sync-state]')?.dataset.syncState;
    if (syncState) drawSync(syncState);
    el.scrollIntoView({block:'center'});
    el.animate([{outline:'3px solid #dd681b'},{outline:'3px solid transparent'}], {duration:1700});
    status('');
  } else status('此控件已在新版画板中移动或移除，可参考批注记录的位置说明。');
  editor(note);
}
function pins() {
  const layer = doc()?.getElementById('review-pins');
  if (!layer) return;
  layer.replaceChildren();
  if(device.value==='desktop')return;
  const phoneNav=device.value==='mobile' && doc().querySelector('#period-dashboard:not([hidden]) .pd-nav, .unified .sidebar');
  const pinCounts=new Map();
  for (const note of notes.filter(n => noteBoard(n) === frame.dataset.loaded && !n.resolved)) {
    const el = targetFor(note);
    if (!el) continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const flow=secondDraftNote(note)?note.flow.slice(secondDraftPrefix.length):note.flow;
    if(flow?.startsWith('仪表盘 · ') && periodView?.describeState()!==flow)continue;
    const pin = doc().createElement('button');
    pin.className = 'review-pin';
    // Keep toolbar actions clickable while their feedback remains open.
    const above=currentDraft() && el.closest('.pd-tools button,.preview-appearance') ||
      device.value==='mobile' && el.matches('button,select,.pd-nav,.pd-controls');
    let x=box.left + box.width*note.x, y=above?box.top-8:box.top + box.height*note.y;
    const switchRow=el.closest('.preview-switch-row');
    if(switchRow){
      const row=switchRow.getBoundingClientRect(),count=pinCounts.get(switchRow)||0;
      pinCounts.set(switchRow,count+1);x=row.right+18+32*count;y=row.top+row.height/2;
    }
    const tools=phoneNav && el.closest('.pd-tools');
    const summary=phoneNav && el.matches('.pd-summary > div:first-child');
    if(tools || summary){
      const anchor=tools || el, bounds=anchor.getBoundingClientRect();
      const count=pinCounts.get(anchor)||0;
      pinCounts.set(anchor,count+1);
      x=tools?bounds.left-16-26*count:bounds.right+16+26*count;
      y=bounds.top+bounds.height/2;
    }
    if(phoneNav && !phoneNav.contains(el) && y+12>phoneNav.getBoundingClientRect().top)continue;
    pin.style.left = x + 'px';
    pin.style.top = y + 'px';
    pin.textContent = note.id; pin.title = '#' + note.id + ' ' + note.text;
    pin.onclick = () => locate(note);
    layer.append(pin);
  }
}
function renderList() {
  $('notes').replaceChildren();
  const visibleNotes=notes.filter(n=>n.board.startsWith(device.value+'-') &&
    (device.value!=='mobile' || !/^mobile-(week|home-edit|home-detail)/.test(n.board) || n.board===board()));
  const pending=visibleNotes.filter(n=>!n.resolved).length;
  $('count').textContent=String(pending);
  $('count').hidden=device.value==='desktop';
  const archive=document.createElement('details');
  const summary=document.createElement('summary');
  summary.textContent=device.value==='desktop'?'已归档的桌面批注':'已归档的手机批注';archive.append(summary);
  for (const n of visibleNotes.reverse()) {
    const card = document.createElement('article');
    const label = document.createElement('small'), text = document.createElement('p');
    label.textContent = (device.value==='desktop'?'':'#' + n.id + '　') + (n.kind||'UI')+' · '+describe(noteBoard(n)) + (n.resolved ? ' · 已处理' : '');
    text.textContent = n.trial?('试改为“'+n.trial.copy+'”'+(n.trial.size?' · '+n.trial.size+' px':'')+' '+n.text):n.text;
    const open = document.createElement('button'), toggle = document.createElement('button');
    open.textContent = '定位 / 编辑'; open.onclick = () => locate(n);
    toggle.textContent = n.trial?(n.resolved?'重新应用':'撤回试改'):(n.resolved?'重新打开':'标为已处理');
    toggle.onclick = async () => { if (allowLeave()) await save({...n,resolved:!n.resolved}); };
    card.append(label,text,open,toggle);
    (n.resolved?archive:$('notes')).append(card);
  }
  if(archive.childElementCount>1)$('notes').append(archive);
  pins();
}
async function save(note) {
  try {
    const response = await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(note)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '保存失败');
    clearEditor();
    await load();
    status(device.value==='desktop'?'批注已保存到本地。':'#' + data.id + ' 已保存到本地。');
  } catch (e) { status(e.message); }
}
async function load() {
  const r = await fetch('/api/notes');
  if (!r.ok) throw new Error('无法读取本地批注');
  notes = await r.json(); applyTrials(); renderList();
}
frame.onload = () => {
  const d = doc();
  frame.dataset.loaded = d.location.pathname.split('/').pop().replace('.html','');
  d.body.dataset.reviewDevice = device.value;
  originals=new Map();drawSync();applyTrials();
  const feature=frame.dataset.feature;
  showCatalog(d,feature==='controls');periodView=null;
  for(const button of d.querySelectorAll('[data-action=refresh],[data-style-demo=refresh]')){
    button.innerHTML=refreshGlyph;
    button.setAttribute('aria-label','更新');button.title='更新';button.style.order='99';
  }
  if(isDashboard(feature)||['devices','settings'].includes(page.value)){
    if(page.value==='home'){
      periodView=mountPeriodDashboard(d,()=>{applyTrials();pins();});
      periodView.root.hidden=false;d.getElementById('app').hidden=true;
      if(feature==='calendar'||feature==='layout')periodView.open(feature);
    }else{
      d.body.classList.add('unified');
      d.querySelector('main')?.classList.add(page.value+'-view');
      if(page.value==='settings'){
        const priorities=['统计规则','记录与外观','浏览器识别','我的数据','Ztime'];
        for(const card of d.querySelectorAll('.settings-grid > .panel')){
          const rank=priorities.indexOf(card.querySelector('h2')?.textContent);
          card.style.order=rank<0?priorities.length:rank;
          card.classList.toggle('fixed-setting',rank===0||(rank===1 && device.value==='desktop'));
        }
      }
      d.querySelectorAll('[data-page=week]').forEach(el=>el.remove());
      d.querySelectorAll('[data-page=home]').forEach(el=>{for(const n of el.childNodes)if(n.nodeType===3)n.textContent='仪表盘';});
    }
  }
  if(feature===desktopV2)applySecondDesktopDraft(d,page.value);
  if(frame.dataset.loaded==='mobile-settings')populateTimeZones(d);
  const anchor=feature==='extension'?d.getElementById('extension-settings'):feature==='report'?d.getElementById('design-report-preview'):feature==='data'?d.getElementById('design-settings-data'):null;
  if(anchor){anchor.hidden=false;anchor.scrollIntoView({block:'center'});}
  const css = d.createElement('style');
  css.textContent = '.picking *{cursor:crosshair!important}[data-pointer-target]{outline:2px dashed #d56824!important;outline-offset:-2px}#review-pins{position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden}.review-pin{position:absolute;pointer-events:auto;transform:translate(-50%,-50%);border:2px solid white;border-radius:30px;background:#ac4616;color:white;font:600 12px/20px sans-serif;padding:0 5px;min-width:24px;height:24px}';
  d.head.append(css);
  css.textContent += '[data-review-selected]{outline:2px solid #c15922!important;outline-offset:-2px}';
  css.textContent += 'body:has(dialog[open])::after{content:"";position:fixed;inset:0;background:#16191c66;z-index:100}dialog[open]{position:fixed;inset:0;margin:auto;z-index:101;height:fit-content;max-height:80vh}';
  const layer = d.createElement('div'); layer.id = 'review-pins'; d.body.append(layer);
  d.addEventListener('pointermove', e => {
    if (!picking || e.target.closest('#review-pins')) return;
    if (highlight !== e.target) {
      highlight?.removeAttribute('data-pointer-target'); highlight=e.target; highlight.setAttribute('data-pointer-target','');
    }
  });
  d.addEventListener('pointerdown', e => {
    if (picking && !e.target.closest('#review-pins')) e.preventDefault();
  }, true);
  d.addEventListener('click', e => {
    const el=e.target;
    if (el.closest('#review-pins')) return;
    if(!picking && el.closest('[data-style-native], input[type=date], select'))return;
    e.preventDefault();
    if(!picking && el.closest('#period-dashboard') && el.closest('[data-cal]')){
      if(!allowLeave())return;if(draft)clearEditor();
      const trigger=el.closest('[data-cal]');
      if(trigger.dataset.cal==='dismiss' && el!==trigger)return;
      periodView.act(trigger);

      return;
    }
    if (!picking && handleStyleDemo(d,el))return;
    if (!picking) {
      const nav=el.closest('[data-page]'), action=el.closest('[data-action]')?.dataset.action;
      const flow=el.closest('[data-flow]'), app=el.closest('[data-app]');
      if (flow) changeBoard(flow.dataset.flow,flow.textContent.trim());
      else if (el.closest('[data-close]')) changeBoard(board().split('-detail-')[0],'关闭明细');
      else if (app && ['home','week'].includes(page.value)) changeBoard(board()+'-detail-'+app.dataset.app,'点应用排行');
      else if (nav) changeBoard(device.value+'-'+nav.dataset.page,nav.textContent.trim(),['home','devices','settings','behavior'].includes(nav.dataset.page)?dashboardRoute():'');
      else if (el.closest('[data-demo-format]')) d.querySelector('[data-demo-status]').textContent='示例：正式版将保存 '+el.closest('[data-demo-format]').dataset.demoFormat+' 格式的本地文件。';
      else if (el.closest('summary')) { const box=el.closest('details');box.open=!box.open; }
      else if (action==='design-extension') d.getElementById('design-connection').hidden=false;
      else if (action==='design-report' || action==='design-report-close') d.getElementById('design-report-preview').hidden=action==='design-report-close';
      else if (action==='edit') changeBoard(board()+'-edit','编辑布局');
      else if (['cancel-edit','save-layout'].includes(action)) changeBoard(board().replace('-edit',''),el.textContent.trim());
      else if (action==='pair') changeBoard('desktop-pair-invite','生成配对信息');
      else if (action==='sync' || action==='sync-retry') simulateSync();
      else if (action==='scan') changeBoard('mobile-pair-confirm','模拟扫码');
      return;
    }
    if(trialMode){
      if(!canEdit(el))return status('请选择一处文字，例如按钮文字或标题。间距或位置可用批注标记。');
      const selector=selectorFor(el);
      const saved=notes.findLast(n=>n.board===board() && n.selector===selector && secondDraftNote(n)===currentDraft() && n.trial && !n.resolved);
      editor(saved || {board:board(),selector,label:nodeLabel(el),x:0.5,y:0.5,kind:'UI',size:frame.contentWindow.innerWidth+' × '+frame.contentWindow.innerHeight,flow:el.closest('#period-dashboard')?periodView.describeState():flowTrail||describe(board()),trial:{copy:el.textContent.trim().slice(0,300),size:null}});
      return;
    }
    const box=el.getBoundingClientRect(), clamp=v=>Math.max(0,Math.min(v,1));
    const syncState=el.closest('[data-sync-state]');
    const trail=el.closest('#period-dashboard')?periodView.describeState():(flowTrail||describe(board()))+(syncState?' → '+syncState.querySelector('h2').textContent:'');
    editor({board:board(),kind:syncState?'UX':undefined,flow:trail,size:frame.contentWindow.innerWidth+' × '+frame.contentWindow.innerHeight,selector:selectorFor(el),label:nodeLabel(el),x:clamp((e.clientX-box.left)/(box.width||1)),y:clamp((e.clientY-box.top)/(box.height||1))});
    pins();
  },true);
  d.addEventListener('scroll', pins, true);
  frame.contentWindow.addEventListener('resize',pins);
  renderList();
  if (jumpTo && noteBoard(jumpTo) === frame.dataset.loaded) { const n=jumpTo; jumpTo=null; locate(n); }
};
$('annotate').onclick = () => {
  if (!allowLeave()) return;
  const enabled=!picking || trialMode; clearEditor(); trialMode=false;setPicking(enabled);
  status(enabled?'点一下需要调整的位置。':'');
};
$('cancel').onclick=()=>{ clearEditor(); status(''); };
$('editor').onsubmit=async e=>{
  e.preventDefault();
  let text=$('message').value.trim(), trial=draft.trial;
  if(trial){
    const copy=$('trial-copy').value.trim(),size=$('trial-size').value===''?null:Number($('trial-size').value);
    if(!copy || (size!==null && (!Number.isInteger(size)||size<8||size>80)))return status('请填写文字，字号可留空或填写 8 至 80。');
    trial={copy,size};text=text||'设计稿文字或字号试改';
  }
  if (!text) return status('请写下修改意见。');
  if ($('editor').querySelector('.primary').disabled) return;
  $('editor').querySelector('.primary').disabled=true;
  try {await save({...draft,...(trial?{trial}:{}),text,kind:$('kind').value});} finally {$('editor').querySelector('.primary').disabled=false;}
};
device.onchange=()=>changeBoard(device.value+'-'+(['home','devices','settings'].includes(page.value)?page.value:'devices'),'',dashboardRoute());
page.onchange=()=>changeBoard(board(),'',dashboardRoute());
$('flow').onclick=()=>changeBoard(device.value==='mobile'?'mobile-pair-scan':'desktop-pair-invite');
new ResizeObserver(resize).observe($('stage'));
$('trial').onclick=()=>{if(!allowLeave())return;const enable=!picking||!trialMode;clearEditor();trialMode=true;setPicking(enable);status(enable?'点选画板中要改的文字。':'');};
$('trial-copy').oninput=$('trial-size').oninput=previewTrial;
document.querySelector('.quick').onclick=e=>{
 const link=e.target.closest('a');if(!link)return;e.preventDefault();
 const [key,feature='']=link.hash.slice(1).split('/');changeBoard(key,link.textContent,feature);
};
function routeFromHash(){
 const [key,requested='']=location.hash.slice(1).split('/');
 if(key==='desktop-behavior')return [key,desktopV2];
 if(!key)return ['desktop-home',desktopV2];
 if(key==='mobile-home-edit')return ['mobile-home','layout'];
 if(/^mobile-(home|devices|settings)$/.test(key))return [key,['calendar','layout'].includes(requested)?requested:'dashboard'];
 const valid=/^((desktop|mobile)-((home|week)(-edit|-detail-(writer|browser|reader|notes))?|devices|settings)|desktop-pair-(invite|request)|mobile-pair-(scan|confirm|wait|success|refused|timeout))$/;
 if(requested===desktopV2 && /^desktop-(home|devices|settings)$/.test(key))return [key,desktopV2];
 return [valid.test(key)?key:'desktop-home',['report','extension','data','controls','dashboard','calendar','layout'].includes(requested)?requested:(key?'':'dashboard')];
}
window.addEventListener('hashchange',()=>{
 const [key,feature]=routeFromHash();
 if(key===board() && feature===frame.dataset.feature){
   const hash='#'+key+(feature?'/'+feature:'');
   if(location.hash!==hash)history.replaceState(null,'',hash);
   return;
 }
 changeBoard(key,'',feature);
});
showBoard(...routeFromHash());
load().catch(e=>status(e.message));

// Independent calendar fixture. All numbers below come from one synthetic daily ledger.
function mountPeriodDashboard(d,onChange){
 const DAY=86400000, iso=n=>new Date(n*DAY).toISOString().slice(0,10), num=s=>Date.parse(s+'T00:00:00Z')/DAY;
 const today=num(new Date(Date.now()-4*3600000).toLocaleDateString('sv-SE',{timeZone:'Asia/Hong_Kong'}));
 const ymd=(y,m,day=1)=>Date.UTC(y,m,day)/DAY;
 const month=n=>iso(n).slice(0,7),stamp=n=>iso(n).replaceAll('-','/'),short=n=>iso(n).slice(5).replace('-','/');
 const dt=n=>new Date(n*DAY),first=n=>ymd(dt(n).getUTCFullYear(),dt(n).getUTCMonth()),nextMonth=n=>ymd(dt(n).getUTCFullYear(),dt(n).getUTCMonth()+1);
 const yr=n=>dt(n).getUTCFullYear(), dayOf=n=>dt(n).getUTCDate(),len=r=>r[1]-r[0]+1;
 const modes={day:'每日',week:'每周',month:'每月',year:'每年',custom:'自选'};
 const span=(mode,n)=>{let a=n,b=n;
  if(mode==='week'){const mon=n-(dt(n).getUTCDay()+6)%7;a=mon;b=mon+6;}
  if(mode==='month'){a=first(n);b=nextMonth(n)-1;}
  if(mode==='year'){a=ymd(yr(n),0);b=ymd(yr(n)+1,0)-1;}
  return [a,Math.min(b,today)];
 };
 const label=r=>len(r)===1?stamp(r[0]):stamp(r[0])+' – '+short(r[1]);
 const root=d.createElement('section');root.id='period-dashboard';root.hidden=true;d.body.append(root);
 let mode='day',period=[today,today],comparison=null,scope='all',picker=null;
 const desktop=currentDraft();
 if(desktop)updatePreviewRecording(d);
 const recording=desktop?(d.querySelector('#app .statusbar')?.outerHTML||''):'';
 const mobile=d.body.dataset.reviewDevice==='mobile';
 const apps=[['浏览器','pc'],['阅读','phone'],['编辑器','pc'],['笔记','phone']];
 if(desktop || mobile)apps.push(['邮件','pc'],['日历','phone'],['终端','pc'],['相册','phone'],['音乐','pc'],['地图','phone']);
 // Desktop examples use the same Windows launcher artwork as the named apps.
 const windowsExamples={
   0:['Ztime','brand-icon.png'],2:['ChatGPT','rank-icons/chatgpt.png'],
   4:['Chrome','rank-icons/chrome.png'],6:['微信','rank-icons/weixin.png'],
   8:['VS Code','rank-icons/code.png']
 };
 if(desktop)for(const [index,[name]] of Object.entries(windowsExamples))apps[index][0]=name;
 const base=(n,i)=>{const q=Math.abs((n*(19+i*8)+Math.floor(n/7)*(i+11))%167);if(i>=4)return 2+q%14;return [40,19,35,10][i]+q%[95,45,85,35][i];};
 const vector=r=>{const totals=apps.map(()=>0);for(let n=r[0];n<=r[1];n++)for(let i=0;i<apps.length;i++)if(scope==='all'||scope===apps[i][1])totals[i]+=base(n,i);return totals;};
 const total=v=>v.reduce((a,b)=>a+b,0),dur=m=>{const v=Math.round(m);return v>=60?Math.floor(v/60)+' 小时 '+v%60+' 分钟':v+' 分钟';};
 function hourlyUsage(day){
   const totals=vector([day,day]);
   return Array.from({length:24},(_,hour)=>{
     // Spread whole minutes across each app's sample hours without losing the daily total.
     const values=totals.map((minutes,i)=>{
       const slot=hour-(3+(day+i*3)%11),length=6+i%4;
       if(slot<0 || slot>=length)return 0;
       return Math.floor((slot+1)*minutes/length)-Math.floor(slot*minutes/length);
     });
     const clock=h=>String((h+4)%24).padStart(2,'0');
     return {label:clock(hour),detail:clock(hour)+':00–'+clock(hour+1)+':00',values,minutes:total(values)};
   });
 }
 let pointIndex=null;
 function enablePointDetails(card,series){
   const svg=card.querySelector('.usage-chart svg');
   const plot=d.createElement('div');
   plot.className='point-plot';
   svg.before(plot);plot.append(svg);
   const slider=d.createElement('input');
   slider.type='range';slider.min=0;slider.max=series.length-1;slider.value=pointIndex??0;
   slider.setAttribute('aria-label','查看时间点的应用与用时');
   slider.dataset.styleNative='';
   plot.append(slider);
   const detail=d.createElement('div');detail.className='point-detail';detail.id='point-detail';
   card.append(detail);
   function inspect(index){
     pointIndex=index;
     const bin=series[index];
     svg.querySelectorAll('circle').forEach((circle,i)=>circle.setAttribute('r',i===index?'5':'2.3'));
     slider.setAttribute('aria-valuetext',bin.detail+' · '+(bin.minutes===null?'尚未到达':dur(bin.minutes)));
     const rows=(bin.values||[]).map((minutes,i)=>({minutes,i})).filter(r=>r.minutes).sort((a,b)=>b.minutes-a.minutes);
     detail.innerHTML='<div class="point-total"><strong>'+bin.detail+'</strong><b>'+(bin.minutes===null?'尚未到达':dur(bin.minutes))+'</b></div>'+
       (rows.length?'<ul>'+rows.map(({minutes,i})=>'<li><span>'+apps[i][0]+' <small>'+(apps[i][1]==='pc'?'电脑':'手机')+'</small></span><b>'+dur(minutes)+'</b></li>').join('')+'</ul>':bin.minutes===0?'<p>这段时间没有使用记录。</p>':'');
   }
   slider.oninput=slider.onclick=()=>{if(!picking){inspect(Number(slider.value));onChange();}};
   if(pointIndex!==null && series[pointIndex])inspect(pointIndex);
 }
 function bins(){
  const [a,b]=period;
  if(mobile || desktop){
    if(mode==='day')return hourlyUsage(a);
    const count=mode==='year'?12:len(period);
    return Array.from({length:count},(_,i)=>{
      const start=mode==='year'?ymd(yr(a),i):a+i;
      const end=mode==='year'?Math.min(b,nextMonth(start)-1):start;
      const values=start>b?null:vector([start,end]);
      return {label:mode==='year'?(i+1)+'月':String(dayOf(start)),detail:mode==='year'?month(start):stamp(start),
        values,minutes:values?total(values):null};
    });
  }
  if(mode==='year')return Array.from({length:12},(_,i)=>{const n=ymd(yr(a),i);return {label:(i+1)+'月',minutes:n>b?null:total(vector([n,Math.min(b,nextMonth(n)-1)]))};});
  if(mode==='day'){
   const weights=Array.from({length:24},(_,i)=>i<6||i>22?0:2+((i*3+a)%9)),sum=total(weights),used=total(vector(period));
   return weights.map((v,i)=>({label:String((i+4)%24).padStart(2,'0'),minutes:used*v/sum}));
  }
  return Array.from({length:len(period)},(_,i)=>({label:String(dayOf(a+i)),minutes:total(vector([a+i,a+i]))}));
 }
 const layoutKey='review-dashboard-layout-'+device.value+(currentDraft()?'-v2':'');
 const modules=desktop?desktopTitles:{trend:mobile?'使用时间':'用时趋势',ranking:'应用排行',compare:'期间对比'};
 let layout=desktop?desktopLayout():Object.keys(modules).map(key=>({key,visible:!mobile||key!=='compare'}));
 try{
   const saved=JSON.parse(sessionStorage.getItem(layoutKey));
   if(desktop)layout=desktopLayout(saved);
   else if(Array.isArray(saved) && saved.length===layout.length && new Set(saved.map(r=>r.key)).size===layout.length &&
      saved.every(row=>Object.hasOwn(modules,row.key)&&typeof row.visible==='boolean'))layout=saved;
 }catch{/* Use the default design when no saved preference exists. */}
 let layoutDraft=null,returnFocus='dates';
 function layoutPanel(){
   const rows=layoutDraft.map(({key,visible},i)=>{
     const name=modules[key];
     return `<div class="pd-module-row"><b>${name}</b><button data-cal="layout-up" data-key="${key}" aria-label="上移${name}" ${i===0?'disabled':''}>↑</button><button data-cal="layout-down" data-key="${key}" aria-label="下移${name}" ${i===layoutDraft.length-1?'disabled':''}>↓</button><button data-cal="layout-toggle" data-key="${key}" aria-pressed="${visible}">${desktop||mobile?(visible?'已添加':'添加'):(visible?'显示':'隐藏')}</button></div>`;
   }).join('');
   return '<section class="pd-picker"><h3>'+(desktop?'统计布局':'仪表盘布局')+'</h3><p class="pd-help">调整卡片顺序和显示状态。</p>'+rows+'<div class="pd-end"><button data-cal="cancel">取消</button><button class="pd-primary" data-cal="layout-save">保存布局</button></div></section>';
 }
 function applyLayout(series){
   const grid=root.querySelector('.pd-bottom');
   const trend=grid.previousElementSibling;
   grid.prepend(trend);
   const [ranking,compare]=[...grid.children].slice(1);
   const cards={trend,ranking,compare};
   if(desktop || mobile){
     trend.querySelector('h3').textContent='使用时间';
     trend.querySelector('.pd-plot').outerHTML=desktop?desktopUsageChart(series,mode,desktopPreview.chart):usageArea(series.map(b=>({label:b.label,duration:b.minutes==null?null:b.minutes*60000})),ms=>dur(ms/60000));
     if(mobile)enablePointDetails(trend,series);
     if(desktop){
       const selector=d.createElement('div');selector.className='chart-style';selector.setAttribute('role','group');selector.setAttribute('aria-label','图表类型');
       for(const [key,label] of [['line','折线图'],['bar','柱形图']]){
         const button=d.createElement('button');button.dataset.cal='chart-style';button.dataset.chart=key;
         button.textContent=label;button.setAttribute('aria-pressed',String(desktopPreview.chart===key));selector.append(button);
       }
       trend.querySelector('.pd-top small').replaceWith(selector);
       const details=series.map(bin=>({...bin,rows:(bin.values||[]).map((minutes,i)=>({minutes,name:apps[i][0],platform:apps[i][1]==='pc'?'windows':'android'})).filter(row=>row.minutes).sort((a,b)=>b.minutes-a.minutes)}));
       bindDesktopPoints(trend,details,{pointIndex,onSelect:index=>{pointIndex=index;},dur,enabled:()=>!picking,onChange});
     }
     const scroll=d.createElement('div');scroll.className='rank-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','应用排行');scroll.setAttribute('role','region');
     scroll.append(...ranking.querySelectorAll('.pd-app'));ranking.append(scroll);
   }
   if(desktop){
     const appTotals=vector(period).map((m,i)=>({duration:m,platform:apps[i][1]==='pc'?'windows':'android'})).sort((a,b)=>b.duration-a.duration);
     for(const key of ['devices','focus']){
       const card=d.createElement('section');card.className='pd-card';
       card.innerHTML='<h3>'+modules[key]+'</h3>'+shareChart(key,appTotals,ms=>dur(ms/60000));cards[key]=card;
     }
   }
   const shown=layout.filter(row=>row.visible);
   grid.classList.toggle('default-pair',(desktop || mobile) && shown.length===2 && shown.every(row=>['ranking','trend'].includes(row.key)));
   for(const entry of layout){
     const card=cards[entry.key];
     card.dataset.cardKey=entry.key;card.hidden=!entry.visible;
     card.classList.toggle('pd-trend',entry.key==='trend');
     grid.append(card);
   }
 }
 root.addEventListener('keydown',e=>{
   if(!picker && !layoutDraft)return;
   if(e.key==='Escape'){e.preventDefault();act({dataset:{cal:'cancel'}});return;}
   if(e.key!=='Tab')return;
   const focusable=[...root.querySelectorAll('.pd-modal button:not(:disabled),.pd-modal input,.pd-modal select')];
   const next=e.shiftKey?focusable.at(-1):focusable[0],edge=e.shiftKey?focusable[0]:focusable.at(-1);
   if(d.activeElement===edge){e.preventDefault();next.focus();}
 });
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
 function draw(){
  const focused=d.activeElement?.closest('.pd-modal')?selectorFor(d.activeElement):null;
  const v=vector(period),sum=total(v),series=bins(),max=Math.max(1,...series.map(x=>x.minutes||0));
  const compare=comparison?total(vector(comparison)):null,delta=comparison?sum/len(period)-compare/len(comparison):null;
  const barUnit=mode==='day'?'时':mode==='year'?'月':'日';
  const bars=series.map((s,i)=>{const display=series.length<=12||i%Math.ceil(series.length/8)===0||i===series.length-1;return '<div class="pd-col" title="'+s.label+(barUnit==='月'?'':barUnit)+' · '+(s.minutes===null?'尚未到达':dur(s.minutes))+'"><div class="pd-track"><i style="height:'+((s.minutes||0)*100/max)+'%"></i></div><small>'+(display?s.label:'&nbsp;')+'</small></div>';}).join('');
  const presetButtons=Object.entries({day:'日',week:'周',month:'月',year:'年'}).map(([k,v])=>'<button data-cal="mode" data-mode="'+k+'" aria-pressed="'+(mode===k)+'" data-style-id="pd-'+k+'">'+v+'</button>').join('');
  const exampleIcons=['browser','reader','editor','notes','mail','calendar','terminal','gallery','music','map'];
  function icon(i){
   if(!desktop)return '';
   if(windowsExamples[i])return '<img class="review-app-icon" src="'+windowsExamples[i][1]+'" alt="">';
   return '<svg class="review-app-icon" aria-hidden="true" viewBox="0 0 24 24"><use href="app-icons.svg#'+exampleIcons[i]+'"></use></svg>';
  }
  const ranking=v.map((m,i)=>({m,i})).filter(o=>o.m).sort((a,b)=>b.m-a.m).map(({m,i})=>'<div class="pd-app"><span>'+icon(i)+(desktop?'<span class="rank-name">'+apps[i][0]+'</span>':apps[i][0])+'</span><small>'+(apps[i][1]==='pc'?'电脑':'手机')+'</small><b>'+dur(m)+'</b><i class="rank-track"><i style="width:'+100*m/Math.max(...v)+'%"></i></i></div>').join('');
  const fullDate=mode==='year'?yr(period[0])+' 年':label(period);
  const dateText=mobile && mode!=='year' && len(period)>1?short(period[0])+'–'+short(period[1]):fullDate;
  root.innerHTML='<div class="pd-layout"><nav class="pd-nav" aria-label="主导航"><div class="pd-brand"><img src="brand-icon.png" alt=""> Ztime</div>'+(desktop?desktopNavButtons('home'):'<button aria-current="page" data-cal="home">仪表盘</button><button data-page="devices">设备</button><button data-page="settings">设置</button>')+'</nav><div class="pd-main"><header class="pd-header"><div><h1 id="pd-heading">'+(desktop?'统计':'仪表盘')+'</h1>'+recording+'</div><div class="pd-tools"><button data-cal="layout" aria-haspopup="dialog">布局</button><button data-cal="refresh" aria-label="更新" title="更新">'+refreshGlyph+'</button></div></header><section class="pd-controls"><div class="pd-modes">'+presetButtons+'</div><div class="pd-range"><button data-cal="prev" aria-label="上一期间">‹</button><button class="pd-date" aria-haspopup="dialog" data-cal="dates" aria-label="'+fullDate+'" title="'+fullDate+'">'+dateText+' ▾</button><button data-cal="next" aria-label="下一期间" '+(period[1]>=today?'disabled':'')+'>›</button></div></section>'+
  '<section class="pd-summary"><div><small>'+(desktop?{all:'设备累计',phone:'手机累计',pc:'电脑累计'}[scope]:'设备累计')+'</small><h2>'+dur(sum)+'</h2></div><div class="pd-scope">'+[['all','全部设备'],['phone','手机'],['pc','电脑']].map(([k,v])=>'<button data-cal="scope" data-scope="'+k+'" aria-pressed="'+(scope===k)+'">'+v+'</button>').join('')+'</div></section><section class="pd-card"><div class="pd-top"><h3>'+({时:'分时用时',日:'每日趋势',月:'全年趋势'})[barUnit]+'</h3><small>单位：小时</small></div><div class="pd-plot"><div class="pd-axis"><span>'+(max/60).toFixed(1)+'</span><span>0</span></div><div class="pd-bars">'+bars+'</div></div></section><div class="pd-bottom"><section class="pd-card"><h3>应用排行</h3>'+ranking+'</section><section class="pd-card"><h3>期间对比</h3>'+
  (comparison?'<p class="pd-comp-label">'+label(comparison)+'</p><p>对比期累计　'+dur(compare)+'</p><strong>日均'+(Math.abs(delta)<0.5?'持平':(delta>0?'增加 ':'减少 ')+dur(Math.abs(delta)))+'</strong><p>本期日均 '+dur(sum/len(period))+' · 对比期日均 '+dur(compare/len(comparison))+'</p>':'<p>'+(mode==='year'?'比较上年同期的使用情况。':'可选另一月份的一段日期，比较日均用时。')+'</p>')+
  '<div class="pd-short"><button data-cal="compare">'+(mode==='year'?'对比上年同期':comparison?'更改对比日期':'选择对比日期')+'</button>'+(comparison?'<button data-cal="clear">清除对比</button>':'')+'</div></section></div></div></div>';

  if(desktop){
    const version=d.createElement('small');version.id='desktop-version';version.textContent='版本 0.2.19';
    root.querySelector('.pd-nav').append(version);
  }
  if(mobile){
    root.querySelector('.pd-brand').remove();
    if(!comparison)root.querySelector('.pd-bottom > section:last-child > p')?.remove();
  }
  applyLayout(series);
  const content=layoutDraft?layoutPanel():calendar();
  if(content){
    const label=layoutDraft?(desktop?'统计布局':'仪表盘布局'):picker.target==='year'?'选择年份':picker.target==='comparison'?'选择对比区间':'选择统计区间';
    root.firstElementChild.inert=true;
    root.insertAdjacentHTML('beforeend','<div class="pd-scrim" data-cal="dismiss"><div class="pd-modal" role="dialog" aria-modal="true" aria-label="'+label+'">'+content+'</div></div>');
    // Dialog fields are created after the dashboard. Delegate edits to the current draft.
    const modal=root.querySelector('.pd-modal');
    (focused && modal.querySelector(focused) || modal.querySelector('button,select'))?.focus({preventScroll:true});
    modal.querySelectorAll('input[data-edge]').forEach(input=>input.onchange=()=>{
      picker[input.dataset.edge]=input.value;
      picker.error=valid(picker);
      if(input.dataset.edge==='start' && Number.isInteger(num(input.value)))picker.month=first(num(input.value));
      draw();
    });
  }
  onChange();
 }
 function choose(m,n){mode=m;period=span(m,n);comparison=null;picker=null;}
 function act(button){
  const a=button.dataset.cal;if(!a)return false;
  if(a==='chart-style'){desktopPreview.chart=button.dataset.chart;draw();root.querySelector('[data-chart="'+desktopPreview.chart+'"]').focus({preventScroll:true});return true;}
  if(['mode','prev','next','apply-year','apply','scope'].includes(a))pointIndex=null;
  const wasOpen=!!picker || !!layoutDraft;
  if(['layout','dates','compare'].includes(a))returnFocus=a;
  if(a==='refresh'){notice(d,'已更新示例视图');return true;}
  if(a==='layout')layoutDraft=structuredClone(layout);
  if(a==='layout-toggle')layoutDraft.find(row=>row.key===button.dataset.key).visible=!layoutDraft.find(row=>row.key===button.dataset.key).visible;
  if(a==='layout-up'||a==='layout-down'){
    const i=layoutDraft.findIndex(row=>row.key===button.dataset.key);
    const j=i+(a==='layout-up'?-1:1);
    if(j>=0 && j<layoutDraft.length)[layoutDraft[i],layoutDraft[j]]=[layoutDraft[j],layoutDraft[i]];
  }
  if(a==='layout-save'){
    layout=layoutDraft;
    sessionStorage.setItem(layoutKey,JSON.stringify(layout));
    layoutDraft=null;
  }
  if(a==='cancel'||a==='dismiss'){picker=null;layoutDraft=null;}

  if(a==='mode'){const m=button.dataset.mode;if(m==='custom')promptPicker('period');else choose(m,Math.min(period[1],today));}
  if(a==='dates'){if(mode==='year')picker={target:'year'};else promptPicker('period');}
  if(a==='prev'||a==='next'){
   const k=a==='prev'?-1:1,n=k<0?period[0]-1:period[1]+1;
   if(mode==='custom'){const m=first(n);const limit=nextMonth(m)-1;const start=k<0?Math.max(m,n-len(period)+1):n;period=[start,Math.min(k<0?n:start+len(period)-1,limit,today)];comparison=null;picker=null;}
   else choose(mode,n);
  }
  if(a==='apply-year')choose('year',ymd(+root.querySelector('#pd-year').value,0));
  if(a==='compare'){if(mode==='year'){const year=yr(period[0])-1,e=dt(period[1]);const m=e.getUTCMonth();comparison=[ymd(year,0),Math.min(ymd(year,m,e.getUTCDate()),ymd(year,m+1)-1)];}else promptPicker('comparison');}
  if(a==='clear'){comparison=null;picker=null;}
  if(a==='scope')scope=button.dataset.scope;
  if(a==='today'||a==='yesterday'){const n=today-(a==='yesterday'?1:0);picker.start=picker.end=iso(n);picker.month=first(n);picker.second=false;picker.error='';}
  if(a==='cancel')picker=null;
  if(a==='back-month'||a==='next-month'){picker.month=a==='back-month'?first(picker.month-1):nextMonth(picker.month);}
  if(a==='pick'){const s=iso(+button.dataset.n);if(!picker.second){picker.start=picker.end=s;picker.second=true;picker.error='';}
   else if(s.slice(0,7)!==picker.start.slice(0,7)){picker.error='结束日必须与开始日在同一个月。';}
   else{[picker.start,picker.end]=[picker.start,s].sort();picker.second=false;picker.error='';}}
  if(a==='apply'){const p=picker;p.error=p.error||valid(p);if(!p.error){const r=[num(p.start),num(p.end)];if(p.target==='comparison')comparison=r;else{period=r;mode=len(r)===1?'day':'custom';comparison=null;}picker=null;}}
  draw();
  if(wasOpen && !picker && !layoutDraft)root.querySelector('[data-cal="'+returnFocus+'"]')?.focus({preventScroll:true});
  return true;
 }
 const describeState=()=>'仪表盘 · '+modes[mode]+' '+label(period)+'｜'+[mode,...period,scope,...(comparison||['','']),layoutDraft?'layout':picker?.target||'',picker?.month||'',picker?.start||'',picker?.end||'',picker?.second?1:0,...(mobile && pointIndex!==null?[pointIndex]:[])].join(',');
 function restore(flow){
  const [m,a,b,sc,c,e,t,mo,start,end,second,point]=(flow.split('｜')[1]||'').split(',');
  const sane=v=>/^-?\d{1,6}$/.test(v)&&+v>=ymd(1900,0)&&+v<=today;
  if(!Object.hasOwn(modes,m)||!sane(a)||!sane(b)||+b<+a||+b-+a>366||!['all','phone','pc'].includes(sc))return;
  mode=m;period=[+a,+b];scope=sc;comparison=sane(c)&&sane(e)&&+e>=+c&&+e-+c<=366?[+c,+e]:null;picker=null;
  pointIndex=mobile && /^\d+$/.test(point) && +point<bins().length?+point:null;
  layoutDraft=t==='layout'?structuredClone(layout):null;
  if(t==='year')picker={target:t};
  else if(['period','comparison'].includes(t)&&sane(mo)&&[start,end].every(x=>/^(?:\d{4}-\d{2}-\d{2})?$/.test(x)))picker={target:t,month:first(+mo),start,end,second:second==='1',error:''};
  draw();
 }
 draw();return {root,act,describeState,restore,open(feature){if(feature==='layout'){returnFocus='layout';layoutDraft=structuredClone(layout);}else{promptPicker('period');returnFocus='dates';}draw();}};
}
