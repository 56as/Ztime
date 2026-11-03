const groups=['.pd-modes','.chart-style','#period-modes','#session-devices','#timeline-style','.appearance-options'];
function turn(){
  const seal=document.querySelector('.sand-seal');
  if(!seal)return;
  seal.classList.remove('turn');
  void seal.offsetWidth;
  seal.classList.add('turn');
}

function whenPainted(ready,timeout=500){
  return new Promise(resolve=>{
    const end=performance.now()+timeout;
    function check(){
      if(ready() || performance.now()>=end)resolve();
      else setTimeout(check,16);
    }
    check();
  });
}

export function switchDesktopPage(navigate){
  const change=async()=>{
    navigate();
    // Keep the previous frame on screen while the incoming chart reads its first result.
    await whenPainted(()=>!document.querySelector('main [aria-busy=true]'));
    turn();
  };
  if(document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    document.startViewTransition(change);
  else void change();
}

export function bindDesktopMotion(){
  document.addEventListener('click',async event=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const button=event.target.closest('button');
    if(!button)return;
    if(button.matches('.sand-seal')){turn();return;}
    const selector=groups.find(group=>button.parentElement.matches(group));
    if(!selector)return;
    const group=button.parentElement;
    const previous=group.querySelector('[aria-pressed=true]');
    if(!previous || previous===button)return;
    const origin=previous.getBoundingClientRect();
    const offset=origin.left-group.getBoundingClientRect().left;
    const key=Object.keys(button.dataset)[0];
    if(!key)return;
    const value=button.dataset[key];
    const find=()=>Array.from(document.querySelectorAll(selector+'>button[aria-pressed=true]')).find(b=>b.dataset[key]===value);
    await whenPainted(()=>!!find());
    const next=find();
    if(!next)return;
    const target=next.getBoundingClientRect();
    if(!target.width)return;
    next.style.setProperty('--slide-from',(offset+next.parentElement.getBoundingClientRect().left-target.left)+'px');
    next.style.setProperty('--slide-scale',String(origin.width/target.width));
    next.classList.remove('choice-sliding');
    void next.offsetWidth;
    next.classList.add('choice-sliding');
  },true);
}
