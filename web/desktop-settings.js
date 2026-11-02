function switchRow(key,label,checked){
  return `<label class="switch-row"><span>${label}</span><button class="setting-switch" data-switch="${key}" role="switch" aria-label="${label}" aria-checked="${checked}"></button></label>`;
}

export function preferenceCard(data,theme,deleteButton){
  const colors=[['light','浅色'],['dark','深色']].map(([value,label])=>
    `<button data-theme="${value}" aria-pressed="${theme===value}">${label}</button>`).join('');
  return `<section class="panel settings-section fixed-setting desktop-preferences"><h2>记录与外观</h2>
    <div class="record-actions">${switchRow('recording','记录',!data.paused)}
      ${data.autostart!=null?switchRow('startup','开机自启',data.autostart):''}</div>
    <div class="appearance-options" role="group" aria-label="外观">${colors}</div>
    <div class="record-data" role="group" aria-label="使用记录操作"><div class="row"><button data-export="json">导出 JSON</button><button data-export="csv">导出 CSV</button>${deleteButton}</div></div></section>`;
}

export function bindDesktopSettings(root,{changeSwitch,changeTheme,onError}){
  for(const button of root.querySelectorAll('[data-theme]')){
    button.onclick=()=>changeTheme(button.dataset.theme).catch(error=>onError(error.message));
  }
  for(const button of root.querySelectorAll('[data-switch]')){
    let start=null, draggedTo=null;
    const checked=()=>button.getAttribute('aria-checked')==='true';
    button.onpointerdown=e=>{
      if(e.button!==0)return;
      start=e.clientX;draggedTo=null;button.setPointerCapture(e.pointerId);
    };
    button.onpointermove=e=>{
      if(start===null)return;
      const offset=Math.min(18,Math.max(0,(checked()?18:0)+e.clientX-start));
      button.style.setProperty('--switch-position',offset+'px');
    };
    button.onpointerup=e=>{
      if(start!==null && Math.abs(e.clientX-start)>5)draggedTo=e.clientX>start;
      start=null;button.style.removeProperty('--switch-position');
    };
    button.onpointercancel=()=>{start=null;draggedTo=null;button.style.removeProperty('--switch-position');};
    button.onclick=async()=>{
      const value=draggedTo??!checked();draggedTo=null;
      if(button.disabled || value===checked())return;
      button.disabled=true;
      try{await changeSwitch(button.dataset.switch,value);button.setAttribute('aria-checked',String(value));}
      catch(error){onError(error.message);}
      finally{button.disabled=false;}
    };
  }
}
