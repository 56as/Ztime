const timingLimits=[3,5,10,30];

export function timingCard(id='timing-card'){
 const options=timingLimits.map(n=>`<label><input type="radio" name="idle-minutes" value="${n}"><span>${n} 分钟</span></label>`).join('');
 return `<section id="${id}" class="panel settings-section timing-card"><h2>电脑计时</h2>
 <div class="idle-rule"><label for="idle-auto">排除待机</label>
 <div id="idle-limit" role="radiogroup" aria-label="待机判定时间">${options}</div><input id="idle-auto" type="checkbox" role="switch"></div>
 <div class="idle-rule"><label for="idle-schedule">屏蔽时段</label><input id="idle-schedule" type="checkbox" role="switch"></div>
 <div id="idle-hours" hidden><select id="idle-repeat" aria-label="重复日期"><option value="weekdays">工作日</option><option value="daily">每天</option><option value="weekends">周末</option></select>
 <input id="idle-start" aria-label="开始时间" type="time"><span>至</span><input id="idle-end" aria-label="结束时间" type="time"><small id="idle-next"></small></div>
 <small id="idle-error" role="status"></small></section>`;
}

export function bindTiming(card,config,api,onError){
 if(!card||!config)return;
 const el=id=>card.querySelector('#idle-'+id);
 const group=el('limit'), radios=[...group.querySelectorAll('input')];
 function render(value){
  for(const key of ['auto','schedule'])el(key).checked=value[key];
  for(const key of ['repeat','start','end'])el(key).value=value[key];
  radios.forEach(radio=>{radio.checked=Number(radio.value)===value.limit;});
  group.style.setProperty('--choice',timingLimits.indexOf(value.limit));
  group.hidden=!value.auto;el('hours').hidden=!value.schedule;
  el('next').textContent=value.start>value.end?'次日':'';
 }
 render(config);
 card.onchange=async()=>{
  const value={auto:el('auto').checked,limit:Number(group.querySelector(':checked').value),schedule:el('schedule').checked,
   repeat:el('repeat').value,start:el('start').value,end:el('end').value};
  if(!value.start||!value.end||value.start===value.end){
   if(value.schedule){el('error').textContent='请选择不同的起止时间。';return;}
   value.start=config.start;value.end=config.end;
  }
  el('error').textContent='';
  const focus=card.ownerDocument.activeElement;
  render(value);card.inert=true;
  try{config=await api('/api/timing','PUT',value);}
  catch(error){onError(error.message);}
  finally{render(config);card.inert=false;if(card.contains(focus))focus.focus({preventScroll:true});}
 };
}
