import {addDays as shift} from './shared/time.js';
const date=s=>new Date(s+'T12:00:00Z');
export function drawChart({$,element,button,tally,color,mode,fmt,dayView,selectFilter,today},rows,start){
function bar(parts,max){
  const track=element('span');track.className='purpose-track';
  for(const [name,value] of parts){
    const segment=element('i');segment.style.width=(value/max*100)+'%';segment.style.background=color(name);
    segment.title=name+' '+fmt(value);track.append(segment);
  }
  return track;
}
function leader(parts){
  if(!parts.length)return '无记录';
  return parts.filter(p=>p[1]===parts[0][1]).map(p=>p[0]).join(' / ')+' '+fmt(parts[0][1]);
}

  const chart=$('purpose-chart');chart.replaceChildren();chart.className='chart-'+mode;
  $('chart-title').textContent={day:'当天用时排行',week:'每日行为分布',year:'每日用时最多的行为'}[mode];
  if(mode==='year'){
    const days=new Map();
    for(const s of rows){if(!days.has(s.date))days.set(s.date,[]);days.get(s.date).push(s);}
    for(let month=1;month<=12;month++){
      const row=element('div');row.className='year-row';row.append(element('small',month+'月'));
      for(let d=start.slice(0,4)+'-'+String(month).padStart(2,'0')+'-01';date(d).getUTCMonth()===month-1;d=shift(d,1)){
        const parts=tally(days.get(d)||[]),day=d,cell=button('',()=>dayView(day));
        cell.id='cell-'+day;cell.disabled=day>today;cell.title=cell.disabled?day:day+' · '+leader(parts);cell.setAttribute('aria-label',cell.title);
        if(parts.length){cell.style.background=color(parts[0][0]);if(parts[1]?.[1]===parts[0][1])cell.style.background='linear-gradient(135deg,'+color(parts[0][0])+' 50%,'+color(parts[1][0])+' 50%)';}
        row.append(cell);
      }
      chart.append(row);
    }
    return;
  }
  const days=Array.from({length:7},(_,i)=>shift(start,i)).filter(day=>day<=today);
  const entries=mode==='week'?days.map(d=>({label:['周一','周二','周三','周四','周五','周六','周日'][days.indexOf(d)],day:d,parts:tally(rows.filter(s=>s.date===d))})):
    tally(rows).map(p=>({label:p[0],parts:[p]}));
  const max=Math.max(1,...entries.map(r=>r.parts.reduce((n,p)=>n+p[1],0)));
  for(const r of entries){
    const line=button('',()=>{if(r.day)dayView(r.day);else{selectFilter(r.label);}});
    line.className='bar-row';line.append(element('span',r.label),bar(r.parts,max),element('small',mode==='week'?leader(r.parts):fmt(r.parts[0][1])));
    chart.append(line);
  }
  if(!entries.length)chart.append(element('p','当天没有使用记录。'));
}
