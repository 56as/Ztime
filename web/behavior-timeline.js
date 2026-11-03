import {behaviorBuckets} from './shared/behavior.js';
const make=(tag,text='')=>Object.assign(document.createElement(tag),{textContent:text});
function linePath(rows,top){
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 100 100');
 svg.setAttribute('preserveAspectRatio','none');
 svg.setAttribute('aria-hidden','true');
 const line=document.createElementNS(ns,'polyline');
 line.setAttribute('points',rows.map((row,i)=>[(i+0.5)*100/rows.length,100-row.duration/60000/top*100].join(',')).join(' '));
 svg.append(line);return svg;
}


export function createTimeline(plot,detail,renderSelection){
 let selectedKey=null,selectedId=null,style='line',lastRows=[],currentOptions;
 function reset(){selectedKey=null;selectedId=null;}
 function draw(rows,options){
  lastRows=rows;currentOptions=options;
  plot.replaceChildren();detail.replaceChildren();
  if(!rows.length){reset();plot.append(make('p','所选期间没有对应记录。'));renderSelection(null);return;}
  const bins=behaviorBuckets(rows,options);
  const active=bins.find(b=>b.key===selectedKey && b.rows.length)||bins.find(b=>b.rows.length);
  selectedKey=active.key;
  const top=Math.max(5,Math.ceil(Math.max(...bins.map(b=>b.duration))/300000)*5);
  const axis=make('div');axis.className='timeline-axis';
  for(const tick of [top,top/2,0])axis.append(make('small',tick+' min'));
  const scroll=make('div');scroll.className='timeline-scroll';
  const columns=make('div');columns.className='timeline-columns '+style+' timeline-'+options.mode;
  columns.style.setProperty('--count',bins.length);
  if(style==='line')columns.append(linePath(bins,top));
  const step=options.mode==='day'?4:options.mode==='year'?Math.ceil(bins.length/7):1;
  function select(bin){
   selectedKey=bin.key;
   const identity=r=>r.date+'|'+r.id;
   const row=bin.rows.find(r=>identity(r)===selectedId)||bin.rows[0];
   selectedId=identity(row);
   detail.replaceChildren(make('b',bin.title+' · '+options.fmt(bin.duration)));
   if(bin.rows.length>1){
    const list=make('select');list.setAttribute('aria-label','选择原始时段');
    for(const r of bin.rows)list.add(new Option((options.mode==='year'?r.date+' ':'')+options.clock.format(r.start)+'–'+options.clock.format(r.end)+' · '+r.app,identity(r)));
    list.value=selectedId;list.onchange=()=>{selectedId=list.value;renderSelection(bin.rows[list.selectedIndex]);};
    detail.append(list);
   }
   renderSelection(row);
  }
  for(const [i,bin] of bins.entries()){
   const button=make('button');button.className='timeline-column';button.disabled=!bin.rows.length;
   button.title=bin.title+' · '+options.fmt(bin.duration);button.setAttribute('aria-label',button.title);
   button.setAttribute('aria-pressed',String(bin===active));
   if(bin.rows.length){
    const leader=[...bin.categories].sort((a,b)=>b[1]-a[1])[0][0];
    button.style.setProperty('--color',options.color(leader));button.style.setProperty('--height',bin.duration/60000/top*100+'%');
    const mark=make('span');mark.className='timeline-mark';button.append(mark);
   }
   if(i%step===0){const tick=make('small',bin.label);tick.className='timeline-tick';button.append(tick);}
   button.onclick=()=>{for(const b of columns.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));select(bin);};
   columns.append(button);
  }
  scroll.append(columns);plot.append(axis,scroll);select(active);
 }
 return {draw,reset,setStyle(value){style=value;if(currentOptions)draw(lastRows,currentOptions);}};
}
