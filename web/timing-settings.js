export function timingCard(){
 return `<section id="timing-card" class="panel settings-section"><h2>电脑计时</h2>
 <div class="timing-rule"><label for="idle-auto">排除待机</label><select id="idle-limit" aria-label="待机判定时间">${[3,5,10,30].map(n=>`<option value="${n}">${n} 分钟</option>`).join('')}</select><input id="idle-auto" type="checkbox" role="switch"></div>
 <div class="timing-rule"><label for="idle-schedule">屏蔽时段</label><input id="idle-schedule" type="checkbox" role="switch"></div>
 <div id="idle-hours" hidden><select id="idle-repeat" aria-label="重复日期"><option value="weekdays">工作日</option><option value="daily">每天</option><option value="weekends">周末</option></select>
 <input id="idle-start" aria-label="开始时间" type="time"> 至 <input id="idle-end" aria-label="结束时间" type="time"><small id="idle-next"></small></div>
 <details id="idle-example"><summary>查看示例</summary><p>周二 12:00–13:00 · ChatGPT</p><p>12:10–12:50 待机　<button id="idle-demo-restore" type="button">计入本次</button></p><output></output></details>
 <details id="idle-history"><summary>最近待机</summary><div></div></details></section>`;
}
export function bindTiming(card,config,api,onError){
 if(!card||!config)return;
 const el=id=>card.querySelector('#idle-'+id);
 const read=()=>({auto:el('auto').checked,limit:Number(el('limit').value),schedule:el('schedule').checked,
  repeat:el('repeat').value,start:el('start').value,end:el('end').value});
 let demoRestored=false;
 function render(value){
  for(const key of ['auto','schedule'])el(key).checked=value[key];
  for(const key of ['limit','repeat','start','end'])el(key).value=value[key];
  el('hours').hidden=!value.schedule;el('limit').hidden=!value.auto;
  el('next').textContent=value.start>value.end?' 次日':'';
  el('demo-restore').hidden=!value.auto;
  el('demo-restore').textContent=demoRestored?'撤销计入':'计入本次';
  let counted=0;
  for(let m=0;m<60;m++){
   const time='12:'+String(m).padStart(2,'0');
   const masked=value.start<value.end?time>=value.start&&time<value.end:time>=value.start||time<value.end;
   if(value.schedule && value.repeat!=='weekends' && masked)continue;
   if(!value.auto || demoRestored || m<10 || m>=50)counted++;
  }
  card.querySelector('output').textContent='计入 '+counted+' 分钟';
 }
 render(config);
 el('demo-restore').onclick=()=>{demoRestored=!demoRestored;render(config);};
 card.onchange=async()=>{
  const value=read();card.inert=true;
  try{config=await api('/api/timing','PUT',value);}
  catch(error){onError(error.message);}
  finally{render(config);card.inert=false;}
 };
 const history=el('history'),list=history.querySelector('div');
 async function load(){
  try{
   const rows=await api('/api/idle-history');
   list.replaceChildren();
   if(!rows.length)list.textContent='暂无已结束的待机时段';
   const format=new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
   for(const row of rows){
    const line=document.createElement('div'),button=document.createElement('button');
    line.className='timing-rule';line.append(format.format(row.start)+' · '+Math.round(row.duration/60000)+' 分钟');
    button.textContent=row.restored?'撤销计入':'计入本次';line.append(button);list.append(line);
    button.onclick=async()=>{button.disabled=true;try{await api('/api/idle-history','PUT',{episode:row.episode,count:!row.restored});await load();}
      catch(error){onError(error.message);button.disabled=false;}};
   }
  }catch(error){onError(error.message);}
 }
 history.ontoggle=()=>{if(history.open)load();};
}
