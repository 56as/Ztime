import {aggregate} from './shared/time.js';

// Use the plotted bin's exact boundaries, including truncated current periods and DST changes.
export function bindPhoneUsage(host,{result,snapshot,scope,mode,selected,onSelect,escape,duration}){
  const svg=host.querySelector('.trend-card svg');
  if(!svg || !result.bins.length)return;
  const plot=document.createElement('div');
  plot.className='point-plot';
  svg.before(plot);plot.append(svg);
  const input=document.createElement('input');
  input.type='range';input.min=0;input.max=result.bins.length-1;input.value=selected??0;
  input.setAttribute('aria-label','查看时间点的应用与用时');plot.append(input);
  const detail=document.createElement('div');
  detail.className='point-detail';host.querySelector('.trend-card').append(detail);
  const formatter=new Intl.DateTimeFormat('zh-CN',{timeZone:snapshot.settings.timeZone,...(
    mode==='day'?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:
    mode==='year'?{year:'numeric',month:'long'}:{month:'short',day:'numeric'}
  )});
  function inspect(index){
    const bin=result.bins[index];
    if(!bin)return;
    onSelect(index);
    const end=Math.min(result.bins[index+1]?.start??result.end,result.end);
    const label=formatter.format(bin.start)+(mode==='day' && end>bin.start?'–'+formatter.format(end):'');
    const apps=end>bin.start?aggregate(snapshot.sessions,bin.start,end,snapshot.devices).apps.filter(a=>scope==='all'||a.platform===scope):[];
    const amount=bin.start>=result.end?'尚未到达':duration(bin.duration,true);
    input.setAttribute('aria-valuetext',label+' · '+amount);
    svg.querySelectorAll('circle').forEach((c,i)=>c.setAttribute('r',i===index?'5':'2.3'));
    detail.innerHTML='<div><strong>'+escape(label)+'</strong><b>'+escape(amount)+'</b></div>'+
      (apps.length?'<ul>'+apps.map(a=>'<li><span>'+escape(a.name)+' <small>'+(a.platform==='android'?'手机':'电脑')+'</small></span><b>'+escape(duration(a.duration,true))+'</b></li>').join('')+'</ul>':end>bin.start?'<p>这段时间没有使用记录。</p>':'');
  }
  input.oninput=input.onclick=()=>inspect(Number(input.value));
  if(selected!==null)inspect(selected);
}
