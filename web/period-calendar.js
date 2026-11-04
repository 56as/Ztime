const DAY=86400000, iso=n=>new Date(n*DAY).toISOString().slice(0,10), num=s=>Date.parse(s+'T00:00:00Z')/DAY;
const ymd=(y,m,day=1)=>Date.UTC(y,m,day)/DAY;
const month=n=>iso(n).slice(0,7),stamp=n=>iso(n).replaceAll('-','/'),short=n=>iso(n).slice(5).replace('-','/');
const dt=n=>new Date(n*DAY),first=n=>ymd(dt(n).getUTCFullYear(),dt(n).getUTCMonth()),nextMonth=n=>ymd(dt(n).getUTCFullYear(),dt(n).getUTCMonth()+1);
const yr=n=>dt(n).getUTCFullYear(), dayOf=n=>dt(n).getUTCDate(),len=r=>r[1]-r[0]+1;
const span=(mode,n,today)=>{let a=n,b=n;
 if(mode==='week'){const mon=n-(dt(n).getUTCDay()+6)%7;a=mon;b=mon+6;}
 if(mode==='month'){a=first(n);b=nextMonth(n)-1;}
 if(mode==='year'){a=ymd(yr(n),0);b=ymd(yr(n)+1,0)-1;}
 return [a,Math.min(b,today)];
};

const label=r=>len(r)===1?stamp(r[0]):stamp(r[0])+' – '+short(r[1]);

// Ranges contain inclusive UTC day numbers for the displayed civil dates.
export {iso,num,ymd,short,first,nextMonth,yr,len,span,label};

export function adjacentPeriod(mode,period,forward,today){
 const next=forward?period[1]+1:period[0]-1;
 if(mode!=='custom')return span(mode,next,today);
 const monthStart=first(next),monthEnd=nextMonth(next)-1;
 const start=forward?next:Math.max(monthStart,next-len(period)+1);
 return [start,Math.min(forward?start+len(period)-1:next,monthEnd,today)];
}

export function previousYearPeriod(period){
 const year=yr(period[0])-1,end=dt(period[1]),month=end.getUTCMonth();
 return [ymd(year,0),Math.min(ymd(year,month,end.getUTCDate()),ymd(year,month+1)-1)];
}

export function validRange(p,today){const a=num(p.start),b=num(p.end);if(!Number.isInteger(a)||!Number.isInteger(b))return '请选择完整的起止日期。';if(b<a)return '结束日期不能早于开始日期。';if(month(a)!==month(b)||b-a+1>31)return '起止日期须在同一个自然月内，最多 31 天。';if(b>today)return '只能选择今天或更早的日期。';return '';}
export function calendar(picker,today,period){
 if(!picker)return '';if(picker.target==='year')return '<section class="pd-picker" aria-label="选择年份"><strong>选择年份</strong><div class="pd-short"><select aria-label="年份" id="pd-year">'+Array.from({length:yr(today)-1969},(_,i)=>yr(today)-i).map(y=>'<option '+(y===yr(period[0])?'selected':'')+'>'+y+'</option>').join('')+'</select><button class="pd-primary" data-cal="apply-year">查看全年</button><button data-cal="cancel">取消</button></div></section>';const p=picker,m=p.month,offset=(dt(m).getUTCDay()+6)%7,days=nextMonth(m)-m;
 const cells=Array.from({length:offset},()=>'<i></i>').join('')+Array.from({length:days},(_,i)=>{const n=m+i,s=iso(n),cl=s===p.start||s===p.end?'cap':s>p.start&&s<p.end?'inside':'';
  return '<button data-cal="pick" data-n="'+n+'" data-style-id="cal-day-'+s+'" class="'+cl+'" aria-label="'+s+'" '+(n>today?'disabled':'')+'>'+dayOf(n)+'</button>';}).join('');
 return '<section class="pd-picker" id="pd-picker" aria-label="日期选择"><div class="pd-top"><strong>'+(p.target==='comparison'?'选择对比区间':'选择统计区间')+'</strong><button data-cal="cancel" aria-label="关闭日历">关闭</button></div><div class="pd-short"><button data-cal="today">今天</button><button data-cal="yesterday">昨天</button></div><div class="pd-month"><button data-cal="back-month" aria-label="上个月">‹</button><strong>'+yr(m)+' 年 '+(dt(m).getUTCMonth()+1)+' 月</strong><button data-cal="next-month" aria-label="下个月" '+(nextMonth(m)>today?'disabled':'')+'>›</button></div><div class="pd-grid">'+[...'一二三四五六日'].map(x=>'<small>'+x+'</small>').join('')+cells+'</div><div class="pd-inputs"><label>开始日期<input type="date" data-edge="start" max="'+iso(today)+'" value="'+p.start+'"></label><label>结束日期<input type="date" data-edge="end" max="'+iso(today)+'" value="'+p.end+'"></label></div><p class="pd-help" role="status">'+(p.error||(p.second?'再点结束日，或直接应用为单日。':'选同月起止日，最多 31 天。'))+'</p><div class="pd-end"><button data-cal="cancel">取消</button><button class="pd-primary" data-cal="apply">应用区间</button></div></section>';
}
