const pageSize=32;
const keyFor=row=>row.date+'|'+row.id;
const minutes=row=>(row.end-row.start)/60000;
const make=(tag,text='')=>Object.assign(document.createElement(tag),{textContent:text});

function linePath(rows,top){
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 100 100');
 svg.setAttribute('preserveAspectRatio','none');
 svg.setAttribute('aria-hidden','true');
 const line=document.createElementNS(ns,'polyline');
 line.setAttribute('points',rows.map((row,i)=>[(i+0.5)*100/rows.length,100-minutes(row)/top*100].join(',')).join(' '));
 svg.append(line);return svg;
}

export function createTimeline(plot,paging,renderSelection){
 let selectedKey=null,style='line',offset=0,lastRows=[],currentOptions;
 function reset(){selectedKey=null;offset=0;}
 function draw(rows,options){
  lastRows=rows;currentOptions=options;
  const oldScroll=plot.querySelector('.timeline-scroll')?.scrollLeft??0;
  const focused=plot.contains(document.activeElement)?document.activeElement.dataset.key:null;
  plot.replaceChildren();paging.replaceChildren();
  if(!rows.length){
   reset();plot.append(make('p','所选期间没有对应记录。'));renderSelection(null);return;
  }
  const index=rows.findIndex(row=>keyFor(row)===selectedKey);
  if(index>=0)offset=Math.floor(index/pageSize)*pageSize;
  offset=Math.min(offset,Math.floor((rows.length-1)/pageSize)*pageSize);
  const windowRows=rows.slice(offset,offset+pageSize);
  const selected=index>=0?rows[index]:windowRows[0];
  selectedKey=keyFor(selected);
  const top=Math.ceil(Math.max(...windowRows.map(minutes))/5)*5;
  const axis=make('div');axis.className='timeline-axis';
  for(const tick of [top,top/2,0])axis.append(make('small',tick));
  const scroll=make('div');scroll.className='timeline-scroll';
  const columns=make('div');columns.className='timeline-columns '+style;
  columns.style.setProperty('--count',windowRows.length);
  if(style==='line')columns.append(linePath(windowRows,top));
  for(const row of windowRows){
   const key=keyFor(row);
   const title=[row.date+' '+options.clock.format(row.start)+'–'+options.clock.format(row.end),row.app,options.fmt(row.end-row.start),row.category].join(' · ');
   const button=make('button');button.className='timeline-column';button.dataset.key=key;
   button.title=title;button.setAttribute('aria-label',title);
   button.setAttribute('aria-pressed',String(key===selectedKey));
   button.style.setProperty('--color',options.color(row.category));
   button.style.setProperty('--height',(minutes(row)/top*100)+'%');
   const mark=make('span');mark.className='timeline-mark';
   const tick=make('small',row.date.slice(5));tick.className='timeline-tick';
   tick.append(make('span',options.clock.format(row.start)));button.append(mark,tick);
   button.onclick=()=>{
    selectedKey=key;
    for(const point of columns.querySelectorAll('button'))point.setAttribute('aria-pressed',String(point===button));
    renderSelection(row);
   };
   columns.append(button);
  }
  scroll.append(columns);plot.append(axis,scroll);scroll.scrollLeft=oldScroll;
  if(focused)Array.from(columns.querySelectorAll('button')).find(b=>b.dataset.key===focused)?.focus({preventScroll:true});
  if(rows.length>pageSize){
   const pageButton=(label,newOffset)=>{
    const button=make('button',label);button.disabled=newOffset<0||newOffset>=rows.length;
    button.onclick=()=>{offset=newOffset;selectedKey=null;scroll.scrollLeft=0;draw(lastRows,currentOptions);};
    return button;
   };
   paging.append(pageButton('上一组',offset-pageSize),make('small',String(offset+1)+'–'+(offset+windowRows.length)+' / '+rows.length),pageButton('下一组',offset+pageSize));
  }
  renderSelection(selected);
 }
 return {draw,reset,setStyle(value){style=value;if(currentOptions)draw(lastRows,currentOptions);}};
}
