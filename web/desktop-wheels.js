// Keep the original select as the source for the board's existing change handlers.
export function mountDesktopWheels(d,isPicking=()=>false){
  const rowHeight=32;
  const initialized=new WeakSet();
  const observed=new WeakMap();
  let wheelSequence=0;
  function mount(select){
    if(initialized.has(select)||!select.options.length)return;
    initialized.add(select);
    const wheel=d.createElement('div');
    wheel.className='desktop-choice-wheel';
    wheel.tabIndex=0;
    wheel.dataset.styleNative='';
    wheel.setAttribute('role','listbox');
    const label=select.getAttribute('aria-label')||select.labels?.[0]?.textContent.trim()||select.title||'选择';
    wheel.setAttribute('aria-label',label);
    const optionPrefix=select.id||'choice-'+(++wheelSequence);
    const items=Array.from(select.options,(option,index)=>{
      const item=d.createElement('div');
      item.setAttribute('role','option');
      item.id=optionPrefix+'-item-'+index;
      item.textContent=option.text;
      item.title=option.text;
      wheel.append(item);
      return item;
    });
    select.after(wheel);
    select.hidden=true;
    function highlight(index){
      const last=wheel.querySelector('[aria-selected=true]');
      last?.setAttribute('aria-selected','false');
      items[index].setAttribute('aria-selected','true');
      wheel.setAttribute('aria-activedescendant',items[index].id);
      wheel.title=items[index].title;
    }
    function align(){
      if(select.selectedIndex<0)return;
      highlight(select.selectedIndex);
      wheel.scrollTop=select.selectedIndex*rowHeight;
    }
    function choose(index){
      if(isPicking()||index<0||index>=items.length||!wheel.clientHeight)return;
      if(index===select.selectedIndex)return;
      const wasFocused=d.activeElement===wheel;
      select.selectedIndex=index;
      align();
      select.dispatchEvent(new Event('change',{bubbles:true}));
      if(wasFocused&&!wheel.isConnected && select.id){
        queueMicrotask(()=>d.getElementById(select.id)?.nextElementSibling?.focus({preventScroll:true}));
      }
    }
    // Rules and schedule fields can be mounted inside a collapsed section.
    const sizeObserver=new ResizeObserver(()=>{if(wheel.clientHeight)align();});
    sizeObserver.observe(wheel);
    observed.set(wheel,sizeObserver);
    select.addEventListener('change',align);
    wheel.addEventListener('scrollend',()=>choose(Math.round(wheel.scrollTop/rowHeight)));
    wheel.setAttribute('aria-haspopup','listbox');
    wheel.setAttribute('aria-expanded','false');
    function openChoices(){
      if(isPicking()||select.disabled||!select.hidden)return;
      const rect=wheel.getBoundingClientRect();
      const style=select.style;
      style.setProperty('--wheel-left',rect.left+'px');
      style.setProperty('--wheel-top',rect.top+'px');
      style.setProperty('--wheel-width',rect.width+'px');
      select.classList.add('wheel-picker-anchor');
      select.hidden=false;
      select.focus({preventScroll:true});
      function closeChoices(){
        if(!select.isConnected)return;
        if(select.matches(':open')){d.defaultView.requestAnimationFrame(closeChoices);return;}
        const restore=d.activeElement===select;
        select.hidden=true;
        select.classList.remove('wheel-picker-anchor');
        wheel.setAttribute('aria-expanded','false');
        if(restore)wheel.focus({preventScroll:true});
      }
      try{
        select.showPicker();
        wheel.setAttribute('aria-expanded','true');
      }finally{d.defaultView.requestAnimationFrame(closeChoices);}
    }
    wheel.addEventListener('click',openChoices);
    let search='',typedAt=0;
    wheel.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();openChoices();return;}
      const index=select.selectedIndex;
      const targets={ArrowDown:index+1,ArrowUp:index-1,Home:0,End:items.length-1,PageDown:index+10,PageUp:index-10};
      if(Object.hasOwn(targets,event.key)){
        event.preventDefault();choose(Math.max(0,Math.min(items.length-1,targets[event.key])));
      }else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey){
        search=(Date.now()-typedAt<800?search:'')+event.key.toLowerCase();typedAt=Date.now();
        choose(Array.from(select.options).findIndex(option=>option.text.toLowerCase().startsWith(search)||option.value.toLowerCase().startsWith(search)));
      }
    });
    align();
  }
  const scan=(root,selector,visit)=>{
    if(root.nodeType!==1)return;
    if(root.matches(selector))visit(root);
    root.querySelectorAll(selector).forEach(visit);
  };
  scan(d.body,'select',mount);
  const observer=new MutationObserver(records=>{
    for(const change of records){
      change.removedNodes.forEach(node=>scan(node,'.desktop-choice-wheel',wheel=>observed.get(wheel)?.disconnect()));
      change.addedNodes.forEach(node=>scan(node,'select',mount));
    }
  });
  observer.observe(d.body,{childList:true,subtree:true});
}
