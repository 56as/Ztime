export function mobileWheel(select,onChange){
  const d=select.ownerDocument, options=Array.from(select.options);
  const label=select.labels[0].textContent;
  const trigger=d.createElement('button');
  trigger.type='button';trigger.id=select.id;trigger.className='wheel-value';
  trigger.setAttribute('aria-haspopup','dialog');
  let index=Math.max(0,options.findIndex(o=>o.value===select.value));
  const update=()=>{
    trigger.textContent=options[index].text;
    trigger.setAttribute('aria-label',label+'，'+options[index].text);
  };
  update();select.replaceWith(trigger);
  trigger.onclick=()=>{
    const original=options[index].value;
    const dialog=d.createElement('dialog');
    dialog.className='wheel-sheet';
    dialog.setAttribute('aria-label','选择'+label);
    dialog.innerHTML='<header><strong></strong><button type="button">完成</button></header><div class="wheel-window"><div class="wheel-list" tabindex="0" role="listbox"></div></div>';
    dialog.querySelector('strong').textContent=label;
    const list=dialog.querySelector('.wheel-list');
    list.setAttribute('aria-label',label);
    for(const [i,option] of options.entries()){
      const row=d.createElement('div');row.setAttribute('role','option');
      row.id=trigger.id+'-choice-'+i;row.textContent=option.text;list.append(row);
    }
    d.body.append(dialog);dialog.showModal();
    const height=list.firstElementChild.offsetHeight;
    function selectRow(i){
      list.children[index].removeAttribute('aria-selected');
      index=Math.max(0,Math.min(options.length-1,i));
      list.children[index].setAttribute('aria-selected','true');
      list.setAttribute('aria-activedescendant',list.children[index].id);
      update();
    }
    function move(i){selectRow(i);list.scrollTop=index*height;}
    move(index);list.focus({preventScroll:true});
    list.onscroll=()=>selectRow(Math.round(list.scrollTop/height));
    list.onclick=e=>{
      const row=e.target.closest('[role=option]');
      if(row)move(Array.prototype.indexOf.call(list.children,row));
    };
    list.onkeydown=e=>{
      const next={ArrowDown:index+1,ArrowUp:index-1,Home:0,End:options.length-1};
      if(Object.hasOwn(next,e.key)){e.preventDefault();move(next[e.key]);}
      if(e.key==='Enter')dialog.close();
    };
    dialog.querySelector('button').onclick=()=>dialog.close();
    dialog.onclose=()=>{dialog.remove();if(options[index].value!==original)onChange(options[index].value);trigger.focus({preventScroll:true});};
  };
}
