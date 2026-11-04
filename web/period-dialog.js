import {desktopTitles} from './shared/desktop-card-layout.js';
import {cardTitles} from './shared/period-layout.js';
import {calendar,validRange,first,nextMonth,iso,num,ymd} from './period-calendar.js';

export function createPeriodDialog({saveLayout,onLayout,onSelect,restoreFocus}){
 let range,today,picker=null,draft=null,saving=false,openerSelector,titles,layoutTitle;
 const dialog=document.createElement('dialog');
 dialog.className='period-dialog';
 document.body.append(dialog);

 function layoutPanel() {
   const rows=draft.map(({key,visible},index)=>{
     const name=titles[key];
     return `<div class="layout-row"><b>${name}</b><button data-shift="-1" data-key="${key}" aria-label="上移${name}" ${index===0?'disabled':''}>↑</button><button data-shift="1" data-key="${key}" aria-label="下移${name}" ${index===draft.length-1?'disabled':''}>↓</button><button data-toggle="${key}" aria-pressed="${visible}">${visible?'已添加':'添加'}</button></div>`;
   }).join('');
   return `<section class="pd-picker"><h2>${layoutTitle}</h2><p>调整卡片顺序和显示状态。</p>${rows}<div class="pd-end"><button data-cal="cancel">取消</button><button data-save class="pd-primary">保存布局</button></div><p class="layout-error" role="status"></p></section>`;
 }
 function drawModal() {
   const active=document.activeElement;
   const focusKey=active && dialog.contains(active) ? [...active.attributes].filter(a=>a.name.startsWith('data-')).map(a=>'['+a.name+'="'+CSS.escape(a.value)+'"]').join('') : '';
   dialog.innerHTML=draft?layoutPanel():calendar(picker,today,range);
   dialog.setAttribute('aria-label',draft?layoutTitle:picker.target==='year'?'选择年份':picker.target==='comparison'?'选择对比区间':'选择统计区间');
   if(!dialog.open)dialog.showModal();
   if(focusKey)dialog.querySelector(focusKey)?.focus({preventScroll:true});
 }
 function closeModal(){
   if(!dialog.open)return false;
   if(saving)return true;
   draft=null;picker=null;dialog.close();
   restoreFocus(openerSelector);
   return true;
 }
 dialog.oncancel=event=>{event.preventDefault();closeModal();};
 dialog.onchange=event=>{
   const edge=event.target.dataset.edge;
   if(!picker || !edge)return;
   picker[edge]=event.target.value;
   picker.error=validRange(picker,today);
   if(edge==='start' && Number.isInteger(num(picker.start)))picker.month=first(num(picker.start));
   drawModal();
 };
 dialog.onclick=async event=>{
   if(saving)return;
   const button=event.target.closest('button');
   if(!button){
     if(event.target===dialog){const rect=dialog.getBoundingClientRect();
       if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}
     return;
   }
   if(button.dataset.cal==='cancel'){closeModal();return;}
   if(button.hasAttribute('data-save')){
     saving=true;button.disabled=true;
     try{await saveLayout(draft);}
     catch(error){
       button.disabled=false;dialog.querySelector('.layout-error').textContent=error.message;return;
     }finally{saving=false;}
     const saved=draft;
     closeModal();onLayout(saved);
   }else if(button.dataset.toggle){
     const card=draft.find(row=>row.key===button.dataset.toggle);
     card.visible=!card.visible;drawModal();
   }else if(button.dataset.shift){
     const i=draft.findIndex(row=>row.key===button.dataset.key),j=i+Number(button.dataset.shift);
     if(j>=0 && j<draft.length)[draft[i],draft[j]]=[draft[j],draft[i]];
     drawModal();
   }else calendarClick(button);
 };
 function calendarClick(button){
  const a=button.dataset.cal;
  if(a==='apply-year'){
   const year=Number(dialog.querySelector('#pd-year').value);
   closeModal();onSelect('year',[ymd(year,0),ymd(year+1,0)-1]);return;
  }
  if(a==='today'||a==='yesterday'){const n=today-(a==='yesterday'?1:0);picker.start=picker.end=iso(n);picker.month=first(n);picker.second=false;picker.error='';}
  if(a==='back-month'||a==='next-month'){picker.month=a==='back-month'?first(picker.month-1):nextMonth(picker.month);}
  if(a==='pick'){const s=iso(+button.dataset.n);if(!picker.second){picker.start=picker.end=s;picker.second=true;picker.error='';}
   else if(s.slice(0,7)!==picker.start.slice(0,7)){picker.error='结束日必须与开始日在同一个月。';}
   else{[picker.start,picker.end]=[picker.start,s].sort();picker.second=false;picker.error='';}}
  if(a==='apply'){
   picker.error=picker.error||validRange(picker,today);
   if(!picker.error){
    const {target,start,end}=picker;
    closeModal();onSelect(target,[num(start),num(end)]);return;
   }
  }
  drawModal();
 }
 function openDates(target,selected,lastDay,opener){
  openerSelector=opener;range=selected;today=lastDay;
  const start=Math.max(range[0],first(range[1]));
  picker={target,month:first(start),start:iso(start),end:iso(range[1]),second:false,error:''};
  drawModal();
 }
 function openLayout(cards,desktop){
  draft=structuredClone(cards);titles=desktop?desktopTitles:cardTitles;
  layoutTitle=desktop?'统计布局':'仪表盘布局';openerSelector='[data-tool=layout]';
  drawModal();
 }
 return {openDates,openLayout,close:closeModal,get open(){return dialog.open;}};
}
