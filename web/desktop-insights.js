// Presentation shared by the Windows renderer and its example-data review board.
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
     const bar='<rect x="'+(x-slot*.3)+'" y="'+y+'" width="'+slot*.6+'" height="'+(height-y)+'" rx="2" fill="currentColor"/>';
     return '<g>'+bar+'<circle cx="'+x+'" cy="'+y+'" r="2.3" fill="currentColor"/><rect x="'+(x-slot/2)+'" width="'+slot+'" height="'+height+'" fill="transparent"/></g>';
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
     const rows=bin.rows;
     detail.innerHTML='<header><strong>'+html(bin.detail)+'</strong><button type="button" aria-label="关闭时段明细">×</button></header><div class="point-total"><span>累计用时</span><b>'+dur(bin.minutes)+'</b></div>'+
       (rows.length?'<ul>'+rows.map(({name,platform,minutes})=>'<li><span>'+html(name)+' <small>'+(platform==='windows'?'电脑':'手机')+'</small></span><b>'+dur(minutes)+'</b></li>').join('')+'</ul>':'<p>这段时间没有使用记录。</p>');
     detail.querySelector('button').onclick=()=>{close();points[index]?.focus();};
     onChange();
   }
   points.forEach((g,index)=>{
     g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-controls','point-detail');g.setAttribute('aria-expanded','false');
     g.setAttribute('aria-label',series[index].detail+' · '+dur(series[index].minutes));
     g.onclick=()=>{if(enabled())inspect(index);};
     g.onkeydown=e=>{if(enabled() && ['Enter',' '].includes(e.key)){e.preventDefault();inspect(index);}};
   });
   card.addEventListener('keydown',e=>{if(e.key==='Escape' && !detail.hidden){const index=pointIndex;close();points[index]?.focus();e.stopPropagation();}});
   if(pointIndex!==null && series[pointIndex]?.minutes!=null)inspect(pointIndex);
 }
