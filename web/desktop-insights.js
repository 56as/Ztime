// Presentation shared by the Windows renderer and its example-data review board.
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The review board supplies example icons. The installed client supplies its local icon URL.
export function desktopRankRow({name,icon,device,minutes,percent,index}){
 const label=html(name),hours=Math.floor(minutes/60);
 const time=hours?hours+' 小时 '+minutes%60+' 分钟':minutes+' 分钟';
 const tag=index===undefined?'div':'button';
 const attributes=index===undefined?'class="pd-app desktop-rank-row"':'class="desktop-rank-row" type="button" data-rank="'+index+'"';
 return `<${tag} ${attributes}><span class="rank-label">${icon}<span class="rank-name" title="${label}">${label}</span></span><small>${device}</small><b>${time}</b><i class="rank-track" aria-hidden="true"><i style="width:${percent}%"></i></i></${tag}>`;
}

export function usageArea(bins,format){
 if(!bins.length)return '<p>所选期间暂无使用记录</p>';
 const max=Math.max(60000,...bins.map(b=>b.duration||0)), width=640, height=126;
 const points=bins.flatMap((b,i)=>b.duration==null?[]:[{x:(i+.5)*width/bins.length,y:height-height*b.duration/max,b}]);
 const line=points.map(({x,y},i)=>(i?'L':'M')+x+' '+y).join(' ');
 const fill=points.length?line+' L'+points.at(-1).x+' '+height+' L'+points[0].x+' '+height+' Z':'';
 const step=Math.ceil(bins.length/8);
 return `<div class="usage-chart"><div class="usage-y"><span>${(max/3600000).toFixed(1)}</span><span>0</span></div><div><svg viewBox="0 0 ${width} ${height+4}" preserveAspectRatio="none" role="img" aria-label="使用时间面积图，单位小时"><path d="${fill}" fill="currentColor" opacity=".16"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${points.map(({x,y,b})=>`<g><title>${html(b.label)} · ${html(format(b.duration))}</title><circle cx="${x}" cy="${y}" r="2.3" fill="currentColor"/><rect x="${x-width/bins.length/2}" width="${width/bins.length}" height="${height}" fill="transparent"/></g>`).join('')}</svg><div class="usage-x" style="grid-template-columns:repeat(${bins.length},1fr)">${bins.map((b,i)=>'<span>'+(i%step===0||i===bins.length-1?html(b.label):'')+'</span>').join('')}</div></div></div>`;
}
export function shareChart(key,apps,format){
 const total=apps.reduce((n,a)=>n+a.duration,0);
 if(!total)return '<p>所选期间暂无使用记录</p>';
 const devices=key==='devices', first=devices?apps.filter(a=>a.platform==='windows').reduce((n,a)=>n+a.duration,0):apps.slice(0,3).reduce((n,a)=>n+a.duration,0);
 const groups=[[devices?'电脑':'排行前三',first],[devices?'手机':'其他应用',total-first]];
 return '<div class="share-meter" aria-hidden="true"><i style="width:'+100*first/total+'%"></i></div>'+groups.map(([name,n])=>`<div class="share-row"><span>${name}</span><b>${Math.round(n*100/total)}%</b><small>${html(format(n))}</small></div>`).join('');
}
const popular={'Asia/Shanghai':'北京 / 上海','Asia/Hong_Kong':'香港','Asia/Macau':'澳门','Asia/Taipei':'台北','Asia/Singapore':'新加坡','Asia/Tokyo':'东京','Asia/Seoul':'首尔','Asia/Kolkata':'新德里','Europe/London':'伦敦','Europe/Paris':'巴黎','Europe/Berlin':'柏林','America/New_York':'纽约','America/Los_Angeles':'洛杉矶','America/Toronto':'多伦多','Australia/Sydney':'悉尼','Pacific/Auckland':'奥克兰','UTC':'协调世界时'};
const regions={Africa:'非洲',America:'美洲',Antarctica:'南极洲',Arctic:'北极',Asia:'亚洲',Atlantic:'大西洋',Australia:'澳洲',Europe:'欧洲',Indian:'印度洋',Pacific:'太平洋'};
export function zoneSelect(current){
 const groups=new Map([['常用城市',Object.entries(popular)]]);
 for(const id of new Set([current,...(Intl.supportedValuesOf?.('timeZone')||[])])){
  if(!id||Object.hasOwn(popular,id))continue;
  const region=regions[id.split('/')[0]]||'其他时区';
  if(!groups.has(region))groups.set(region,[]);
  groups.get(region).push([id,id.split('/').slice(1).join(' / ').replaceAll('_',' ')||id]);
 }
 return '<select id="timeZone">'+[...groups].map(([label,items])=>'<optgroup label="'+label+'">'+items.map(([id,city])=>`<option value="${html(id)}" ${current===id?'selected':''}>${html(city)}</option>`).join('')+'</optgroup>').join('')+'</select>';
}

export function desktopUsageChart(series,mode,style){
   const peak=Math.max(1,...series.map(bin=>(bin.minutes||0)/60));
   const step=Math.max(1,Math.ceil(peak/4));
   const top=Math.ceil(peak/step)*step;
   const ticks=Array.from({length:top/step+1},(_,i)=>top-step*i);
   const width=640,height=126,slot=width/series.length;
   const points=series.flatMap((bin,index)=>bin.minutes===null?[]:[{
     x:(index+.5)*slot,y:height*(1-bin.minutes/(top*60)),bin
   }]);
   const line=points.map(({x,y},i)=>(i?'L':'M')+x+' '+y).join(' ');
   const guides=ticks.map(tick=>'<line x1="0" x2="640" y1="'+(1-tick/top)*height+'" y2="'+(1-tick/top)*height+'" stroke="var(--line)" vector-effect="non-scaling-stroke"/>').join('');
   const drawing=style==='line' && points.length?'<path d="'+line+' L'+points.at(-1).x+' '+height+' L'+points[0].x+' '+height+' Z" fill="currentColor" opacity=".12"/><path d="'+line+'" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/>':'';
   const marks=points.map(({x,y})=>{
     if(style==='line'){
       const center=' cx="'+x+'" cy="'+y+'"';
       return '<g><path class="chart-dot" d="M'+x+' '+y+'h.01"/><circle class="dot-hit"'+center+' r="2"/></g>';
     }
     const left=x-slot*.3,right=x+slot*.3;
     const bar=`<rect class="bar-body" x="${left}" y="${y}" width="${right-left}" height="${height-y}" rx="2" fill="currentColor"/>`;
     // A shallow arch spans the selected column; its baseline stays at the data axis.
     const rounded=y<height?`<path class="bar-selected" d="M${left} ${height} V${y} Q${x} ${y-4} ${right} ${y} V${height} Z" fill="currentColor"/>`:'';
     return '<g>'+bar+rounded+'<rect x="'+(x-slot/2)+'" width="'+slot+'" height="'+height+'" fill="transparent"/></g>';
   }).join('');
   const labels=series.map((bin,i)=>'<span>'+(i%(mode==='day'?2:Math.ceil(series.length/8))===0?html(bin.label):'')+'</span>').join('');
   return '<div class="usage-chart desktop-hour-chart"><div class="usage-y">'+ticks.map(t=>'<span>'+t+' 小时</span>').join('')+'</div><div><svg viewBox="0 0 640 126" preserveAspectRatio="none">'+guides+drawing+marks+'</svg><div class="usage-x" style="grid-template-columns:repeat('+series.length+',1fr)">'+labels+'</div></div></div>';
 }
export function bindDesktopPoints(card,series,{pointIndex,onSelect,dur,enabled=()=>true,onChange=()=>{}}){
   const d=card.ownerDocument;
   const svg=card.querySelector('.usage-chart svg');
   // The chart keeps hourly data; only axis labels are spaced two hours apart.
   svg.setAttribute('role','group');
   svg.setAttribute('aria-label','使用时间，点击时间点查看应用明细');
   const detail=d.createElement('section');detail.className='desktop-point-detail';detail.id='point-detail';detail.hidden=true;
   detail.setAttribute('role','region');detail.setAttribute('aria-label','所选时段明细');detail.setAttribute('aria-live','polite');
   card.append(detail);
   const points=[...svg.querySelectorAll('g')];
   const close=()=>{detail.hidden=true;pointIndex=null;onSelect(null);points.forEach(g=>{g.setAttribute('aria-expanded','false');});onChange();};
   function inspect(index){
     const bin=series[index];pointIndex=index;onSelect(index);detail.hidden=false;
     points.forEach((g,i)=>{g.setAttribute('aria-expanded',String(i===index));});
     const rows=[...bin.rows].sort((a,b)=>b.minutes-a.minutes).slice(0,3);
     detail.innerHTML='<div class="point-total"><span>累计用时</span><b>'+dur(bin.minutes)+'</b></div>'+
       (rows.length?'<ul>'+rows.map(({name,platform,minutes})=>'<li><span>'+html(name)+' <small>'+(platform==='windows'?'电脑':'手机')+'</small></span><b>'+dur(minutes)+'</b></li>').join('')+'</ul>':'<p>这段时间没有使用记录。</p>');
     onChange();
   }
   points.forEach((g,index)=>{
     g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-controls','point-detail');g.setAttribute('aria-expanded','false');
     g.setAttribute('aria-label',series[index].detail+' · '+dur(series[index].minutes));
     const toggle=()=>{if(pointIndex===index)close();else inspect(index);};
     g.onclick=()=>{if(enabled())toggle();};
     g.onkeydown=e=>{if(enabled() && ['Enter',' '].includes(e.key)){e.preventDefault();toggle();}};
   });
   card.addEventListener('keydown',e=>{if(e.key==='Escape' && !detail.hidden){const index=pointIndex;close();points[index]?.focus();e.stopPropagation();}});
   if(pointIndex!==null && series[pointIndex]?.minutes!=null)inspect(pointIndex);
 }

export function desktopPeriodLabel(mode,[a,b],today){
 const date=n=>new Date(n*86400000);
 const year=n=>date(n).getUTCFullYear();
 const format=(n,options)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'UTC',...options}).format(date(n));
 if(mode==='year')return year(a)+'年';
 if(mode==='month')return format(a,{year:'numeric',month:'long'});
 const withYear=year(a)!==year(today)||year(a)!==year(b);
 const day=n=>format(n,{month:'long',day:'numeric',...(withYear?{year:'numeric'}:{})});
 return day(a)+(a===b?'':'到'+day(b));
}

function defaultClockTime(minute){
  const t=(Math.floor(minute)+240)%1440;
  return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
}

export function mountDailyReplay(host,rows,state,{onChange=()=>{},enabled=()=>true,timeAt=defaultClockTime,dayMinutes=1440}={}){
  const windowMinutes=()=>state.zoom===1440?dayMinutes:Math.min(dayMinutes,state.zoom);
  const starts=[...new Set(rows.map(row=>row.start))].sort((a,b)=>a-b);
  host.innerHTML='<div class="clock-face clock-replay"><svg id="clock-instrument" data-style-native viewBox="0 0 600 215" tabindex="0" role="slider" aria-label="选择回溯时刻" aria-valuemin="0" aria-valuemax="'+(dayMinutes-1)+'"></svg><div class="replay-controls"><div role="group" aria-label="切换记录"><button data-step="-1">上一段</button><button data-step="1">下一段</button></div><div role="group" aria-label="时间范围">'+[120,240,1440].map(m=>'<button data-zoom="'+m+'">'+(m===1440 && dayMinutes!==1440?'全天':m/60+' 小时')+'</button>').join('')+'</div></div></div>';
  const svg=host.querySelector('svg'),left=54,width=520;
  const clamp=(m,max)=>Math.max(0,Math.min(max,m));
  const startOfWindow=()=>clamp(Math.round(state.minute-windowMinutes()/2),dayMinutes-windowMinutes());
  let start=startOfWindow();
  const label=(x,y,size,text,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}">${html(text)}</text>`;
  const step=direction=>direction<0?starts.findLast(m=>m<state.minute):starts.find(m=>m>state.minute);
  function draw(){
    const x=m=>left+(m-start)*width/windowMinutes();
    const time=timeAt(state.minute);
    const names=rows.filter(r=>r.start<=state.minute && state.minute<r.end).map(r=>r.name).join(' · ')||'无记录';
    let marks='<g class="replay-time">'+label(300,40,32,time)+'</g>'+label(300,63,12,names);
    for(let i=0;i<=4;i++){
      const tick=start+i*windowMinutes()/4;
      marks+=label(x(tick),95,11,timeAt(tick))+`<path d="M${x(tick)} 103v87" stroke="var(--clock-grid)"/>`;
    }
    for(const [device,title,y,color] of [['pc','电脑',128,'var(--clock-pc)'],['phone','手机',174,'var(--clock-phone)']]){
      marks+=label(left-10,y+4,12,title,'end')+`<path d="M${left} ${y}h${width}" stroke="var(--clock-track)" stroke-width="22"/>`;
      for(const row of rows.filter(r=>r.device===device)){
        const a=Math.max(start,row.start),b=Math.min(start+windowMinutes(),row.end);
        if(b<=a)continue;
        marks+=`<path d="M${x(a)} ${y}H${x(b)}" stroke="${color}" stroke-width="20"/>`;
        if(x(b)-x(a)>row.name.length*12+10)marks+='<g class="replay-app">'+label((x(a)+x(b))/2,y+4,11,row.name)+'</g>';
      }
    }
    svg.innerHTML=marks+`<path d="M${x(state.minute)} 100v94" stroke="var(--clock-hand)" stroke-width="2"/>`;
    svg.setAttribute('aria-valuenow',Math.floor(state.minute));svg.setAttribute('aria-valuetext',time+' '+names);
    for(const b of host.querySelectorAll('[data-step]'))b.disabled=step(+b.dataset.step)===undefined;
    for(const b of host.querySelectorAll('[data-zoom]'))b.setAttribute('aria-pressed',String(+b.dataset.zoom===state.zoom));
  }
  function select(m,recenter){
    state.minute=clamp(m,dayMinutes-0.00001);state.selected=true;
    if(recenter)start=startOfWindow();
    draw();onChange();
  }
  host.querySelector('.replay-controls').onclick=e=>{
    const b=e.target.closest('button');
    if(!b || !enabled())return;
    if(b.dataset.zoom)state.zoom=+b.dataset.zoom;
    select(b.dataset.step?step(+b.dataset.step):state.minute,true);
  };
  function scrub(e){
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    if(e.type==='pointerdown'){
      if(p.x<left-5 || p.x>left+width+5 || p.y<82 || p.y>198)return;
      svg.setPointerCapture(e.pointerId);
    }
    select(Math.round(start+clamp((p.x-left)/width,1)*windowMinutes()),false);
  }
  svg.onpointerdown=e=>{if(enabled())scrub(e);};
  svg.onpointermove=e=>{if(enabled() && svg.hasPointerCapture(e.pointerId))scrub(e);};
  svg.onkeydown=e=>{
    if(!enabled() || !['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();select(state.minute+(e.key==='ArrowLeft'?-1:1),true);
  };
  draw();
}

export function mountDailyRing(host,rows,state,dur,{onChange=()=>{},enabled=()=>true,timeAt=defaultClockTime,dayMinutes=1440,offset=240}={}){
  const ring=(m,r)=>{const a=(m+offset)*2*Math.PI/dayMinutes;return [150+r*Math.sin(a),150-r*Math.cos(a)];};
  const path=(m,r)=>ring(m,r).join(' ');
  host.innerHTML='<div class="clock-face"><svg id="clock-instrument" data-style-native viewBox="0 0 300 300" role="slider" tabindex="0" aria-label="选择时刻" aria-valuemin="0" aria-valuemax="'+(dayMinutes-1)+'"></svg><div class="clock-legend"><span><i></i>电脑</span><span><i></i>手机</span></div></div>';
  const svg=host.querySelector('svg');
  let marks='';
  for(let i=0;i<96;i++){
    const m=i*dayMinutes/96-offset;
    marks+=`<path d="M${path(m,119)}L${path(m,i%4?122:127)}" stroke="var(--clock-grid)"/>`;
  }
  for(const hour of [0,3,6,9,12,15,18,21]){
    const [x,y]=ring(hour*dayMinutes/24-offset,139);
    marks+=`<text x="${x}" y="${y+3}" text-anchor="middle" font-size="9">${timeAt((hour*dayMinutes/24-offset+dayMinutes)%dayMinutes).slice(0,2)}</text>`;
  }
  for(const [device,r,color] of [['pc',104,'var(--clock-pc)'],['phone',88,'var(--clock-phone)']]){
    marks+=`<circle cx="150" cy="150" r="${r}" fill="none" stroke="var(--clock-track)" stroke-width="10"/>`;
    for(const part of rows.filter(row=>row.device===device)){
      marks+=`<path d="M${path(part.start,r)}A${r} ${r} 0 0 1 ${path((part.start+part.end)/2,r)} A${r} ${r} 0 0 1 ${path(part.end,r)}" fill="none" stroke="${color}" stroke-width="10"/>`;
    }
  }
  svg.innerHTML=marks+'<path class="clock-hand" stroke="var(--clock-hand)" stroke-width="2"/><text class="clock-value" x="150" y="152" text-anchor="middle"></text><text class="clock-caption" x="150" y="173" text-anchor="middle" font-size="11"></text>';
  const total=dur(rows.reduce((sum,row)=>sum+row.minutes,0));
  function update(){
    const {minute,selected}=state;
    const names=rows.filter(row=>row.start<=minute && minute<row.end).map(row=>row.name).join(' · ')||'无记录';
    const value=svg.querySelector('.clock-value'),hand=svg.querySelector('.clock-hand');
    hand.setAttribute('d',selected?'M'+path(minute,77)+'L'+path(minute,128):'');
    value.textContent=selected?timeAt(minute):total;
    value.setAttribute('font-size',selected?29:20);
    svg.querySelector('.clock-caption').textContent=selected?names:'设备累计';
    svg.setAttribute('aria-valuenow',Math.floor(minute));
    svg.setAttribute('aria-valuetext',selected?timeAt(minute)+' '+names:'设备累计 '+total);
  }
  update();
  function select(minute){state.minute=Math.min(dayMinutes-1,Math.max(0,minute));state.selected=true;update();onChange();}
  function position(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
  function pick(p){select((Math.round(Math.atan2(p.x-150,150-p.y)*dayMinutes/(2*Math.PI))+dayMinutes*2-offset)%dayMinutes);}
  svg.onpointerdown=e=>{
    if(!enabled())return;
    const p=position(e);
    if(Math.abs(Math.hypot(p.x-150,p.y-150)-106)>36)return;
    svg.setPointerCapture(e.pointerId);pick(p);
  };
  svg.onpointermove=e=>{if(enabled() && svg.hasPointerCapture(e.pointerId))pick(position(e));};
  svg.onkeydown=e=>{
    if(!enabled() || !['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();select(state.minute+(e.key==='ArrowLeft'?-1:1));
  };
}
