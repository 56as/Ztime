export function phoneTimingSettings(rule={}){
 const repeat=rule.repeat||'off';
 const time=value=>/^\d{2}:\d{2}$/.test(value)?value:'';
 return `<details class="phone-timing"><summary>本机计时</summary><p>授权后，仅统计已解锁、屏幕可交互时的前台应用。</p>
 <label>屏蔽时段<select data-repeat>${Object.entries({off:'关闭',daily:'每天',weekdays:'工作日（周一至周五）',weekends:'周末'}).map(([key,label])=>`<option value="${key}" ${repeat===key?'selected':''}>${label}</option>`).join('')}</select></label>
 <div data-hours ${repeat==='off'?'hidden':''}><label>从 <input type="time" data-start value="${time(rule.start)||'22:00'}"></label><label>至 <input type="time" data-end value="${time(rule.end)||'07:00'}"></label><p>按本机统计时区，从现在起生效。结束早于开始时跨至次日。</p></div></details>`;
}
export function bindPhoneTiming(api,toast){
 const card=document.querySelector('.phone-timing');
 const [repeat,start,end]=card.querySelectorAll('select,input');
 let previous=[repeat.value,start.value,end.value];
 card.onchange=async()=>{
   const values=[repeat.value,start.value,end.value];
   for(const field of [repeat,start,end])field.disabled=true;
   try{await api('/api/phone-timing','PUT',{repeat:repeat.value,start:start.value,end:end.value});previous=values;}
   catch(e){toast(e.message);[repeat.value,start.value,end.value]=previous;}
   finally{for(const field of [repeat,start,end])field.disabled=false;card.querySelector('[data-hours]').hidden=repeat.value==='off';}
 };
}
