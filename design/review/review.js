// All state lives in the current fixture document; no calls to the product or the notes API.
const timers=new WeakMap();
function notice(d,message){
 let el=d.querySelector('.sample-toast');
 if(!el){el=d.createElement('p');el.className='sample-toast';el.setAttribute('role','status');d.body.append(el);}
 clearTimeout(timers.get(el));el.textContent=message;el.hidden=false;
 timers.set(el,setTimeout(()=>{el.hidden=true;},2600));
}
function confirmDeletion(d,button){
 const group=button.closest('.spec,.risk-block');if(!group)return;
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
  if (id.startsWith('pair-')) return '配对 · '+flowTitles[id.slice(5)];
  if (id.includes('-detail-')) {
    const [parent, , app] = id.split('-');
    return titles[parent]+' · '+({writer:'文稿编辑器',browser:'浏览器',reader:'阅读',notes:'笔记'})[app]+'明细';
  }
  return titles[id];
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
  $('caption').textContent = (frame.dataset.feature==='controls'?'控件样式':describe(board())) + '　' + width + ' × ' + height + ' px';
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
  const [mode, ...parts] = key.split('-');
  const id = parts.join('-');
  page.querySelector('[data-context]')?.remove();
  if (!titles[id]) {const o=new Option(pageTitle(id),id);o.dataset.context='';page.add(o);}
  device.value = mode; page.value = id;
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
  setPicking(false);
  doc().querySelector('[data-review-selected]')?.removeAttribute('data-review-selected');
  targetFor(note)?.setAttribute('data-review-selected','');
  draft = note;
  $('editor').hidden = false;
  $('target').textContent = (note.id ? '#' + note.id + ' ' : '') + describe(note.board) + ' · ' + note.label;
  $('message').value = note.text || '';
  $('kind').value = note.kind || (note.board.includes('-pair-')?'UX':'UI');
  $('trail').textContent = note.flow || describe(note.board);
  $('trial-fields').hidden=!note.trial;
  $('editor').querySelector('.primary').textContent=note.trial?'保存试改':'保存批注';
  if(note.trial){$('trial-copy').value=note.trial.copy;$('trial-size').value=note.trial.size??'';$('trial-copy').focus();}
  else $('message').focus();
}
function canEdit(el){
  return el && !el.children.length && el.matches('button,h1,h2,h3,p,span,strong,label,small,td,th,a') && el.textContent.trim();
}
function applyTrials(){
  for(const [el,base] of originals){el.textContent=base.copy;el.style.fontSize=base.size;}
  for(const n of notes){
    if(n.board!==frame.dataset.loaded || !n.trial || n.resolved)continue;
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
 if(el)showCatalog(el.ownerDocument,!!el.closest('#design-control-gallery'));
  const state=el?.closest('#design-report-preview,#design-connection');
  if(state)state.hidden=false;
}
function targetFor(note) {
  try { return doc().querySelector(note.selector); } catch { return null; }
}
function locate(note) {
  if (!allowLeave()) return;
  if (board() !== note.board || frame.dataset.loaded !== note.board) {
    jumpTo = note;
    showBoard(note.board);
    return;
  }
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
  for (const note of notes.filter(n => n.board === frame.dataset.loaded && !n.resolved)) {
    const el = targetFor(note);
    if (!el) continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const pin = doc().createElement('button');
    pin.className = 'review-pin';
    pin.style.left = box.left + box.width*note.x + 'px';
    pin.style.top = box.top + box.height*note.y + 'px';
    pin.textContent = note.id; pin.title = '#' + note.id + ' ' + note.text;
    pin.onclick = () => locate(note);
    layer.append(pin);
  }
}
function renderList() {
  $('notes').replaceChildren();
  $('count').textContent = notes.filter(n => !n.resolved).length;
  for (const n of [...notes].reverse()) {
    const card = document.createElement('article');
    const label = document.createElement('small'), text = document.createElement('p');
    label.textContent = '#' + n.id + '　' + (n.kind||'UI')+' · '+describe(n.board) + (n.resolved ? ' · 已处理' : '');
    text.textContent = n.trial?('试改为“'+n.trial.copy+'”'+(n.trial.size?' · '+n.trial.size+' px':'')+' '+n.text):n.text;
    const open = document.createElement('button'), toggle = document.createElement('button');
    open.textContent = '定位 / 编辑'; open.onclick = () => locate(n);
    toggle.textContent = n.trial?(n.resolved?'重新应用':'撤回试改'):(n.resolved?'重新打开':'标为已处理');
    toggle.onclick = async () => { if (allowLeave()) await save({...n,resolved:!n.resolved}); };
    card.append(label,text,open,toggle); $('notes').append(card);
  }
  pins();
}
async function save(note) {
  try {
    const response = await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(note)});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '保存失败');
    clearEditor();
    await load();
    status('#' + data.id + ' 已保存到本地。');
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
  originals=new Map();drawSync();applyTrials();
  const feature=frame.dataset.feature;
  showCatalog(d,feature==='controls');
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
    if (!picking && handleStyleDemo(d,el))return;
    if (!picking) {
      const nav=el.closest('[data-page]'), action=el.closest('[data-action]')?.dataset.action;
      const flow=el.closest('[data-flow]'), app=el.closest('[data-app]');
      if (flow) changeBoard(flow.dataset.flow,flow.textContent.trim());
      else if (el.closest('[data-close]')) changeBoard(board().split('-detail-')[0],'关闭明细');
      else if (app && ['home','week'].includes(page.value)) changeBoard(board()+'-detail-'+app.dataset.app,'点应用排行');
      else if (nav) changeBoard(device.value+'-'+nav.dataset.page,nav.textContent.trim());
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
      const saved=notes.findLast(n=>n.board===board() && n.selector===selector && n.trial && !n.resolved);
      editor(saved || {board:board(),selector,label:nodeLabel(el),x:0.5,y:0.5,kind:'UI',size:frame.contentWindow.innerWidth+' × '+frame.contentWindow.innerHeight,flow:flowTrail||describe(board()),trial:{copy:el.textContent.trim().slice(0,300),size:null}});
      return;
    }
    const box=el.getBoundingClientRect(), clamp=v=>Math.max(0,Math.min(v,1));
    const syncState=el.closest('[data-sync-state]');
    const trail=(flowTrail||describe(board()))+(syncState?' → '+syncState.querySelector('h2').textContent:'');
    editor({board:board(),kind:syncState?'UX':undefined,flow:trail,size:frame.contentWindow.innerWidth+' × '+frame.contentWindow.innerHeight,selector:selectorFor(el),label:nodeLabel(el),x:clamp((e.clientX-box.left)/(box.width||1)),y:clamp((e.clientY-box.top)/(box.height||1))});
    pins();
  },true);
  d.addEventListener('scroll', pins, true);
  frame.contentWindow.addEventListener('resize',pins);
  pins();
  if (jumpTo && jumpTo.board === frame.dataset.loaded) { const n=jumpTo; jumpTo=null; locate(n); }
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
device.onchange=()=>changeBoard(page.value.startsWith('pair-')?device.value+'-devices':board());
page.onchange=()=>changeBoard(board());
$('flow').onclick=()=>changeBoard('desktop-pair-invite');
new ResizeObserver(resize).observe($('stage'));
$('trial').onclick=()=>{if(!allowLeave())return;const enable=!picking||!trialMode;clearEditor();trialMode=true;setPicking(enable);status(enable?'点选画板中要改的文字。':'');};
$('trial-copy').oninput=$('trial-size').oninput=previewTrial;
document.querySelector('.quick').onclick=e=>{
 const link=e.target.closest('a');if(!link)return;e.preventDefault();
 const [key,feature='']=link.hash.slice(1).split('/');changeBoard(key,link.textContent,feature);
};
function routeFromHash(){
 const [key,requested='']=location.hash.slice(1).split('/');
 const valid=/^((desktop|mobile)-((home|week)(-edit|-detail-(writer|browser|reader|notes))?|devices|settings)|desktop-pair-(invite|request)|mobile-pair-(scan|confirm|wait|success|refused|timeout))$/;
 return [valid.test(key)?key:'desktop-home',['report','extension','data','controls'].includes(requested)?requested:(key?'':'controls')];
}
window.addEventListener('hashchange',()=>{
 const [key,feature]=routeFromHash();
 if(key===board() && feature===frame.dataset.feature)return;
 changeBoard(key,'',feature);
});
showBoard(...routeFromHash());
load().catch(e=>status(e.message));
