import {weekDays} from './shared/dashboard.js';

const sum=o=>o.windows+o.android;
const mins=ms=>Math.round(ms/60000*100)/100;
function time(ms){const m=Math.floor(ms/60000);return ms>0&&!m?'不足 1 分钟':m>=60?`${Math.floor(m/60)} 小时 ${m%60} 分钟`:`${m} 分钟`;}
const change=n=>n===0?'与上周同期持平':`比上周同期${n>0?'增加':'减少'} ${time(Math.abs(n))}`;
export function reportData(data){
 const {week,settings}=data,days=weekDays(week,settings),total=sum(week.current.totals),prior=sum(week.previous.totals);
 const end=new Intl.DateTimeFormat('zh-CN',{timeZone:settings.timeZone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(week.end);
 const peak=days.filter(d=>d.available).sort((a,b)=>sum(b.current)-sum(a.current))[0];
 const top=week.current.apps[0],notes=[];
 if(!total)notes.push('本周尚无使用记录；空白不代表设备完全没有使用。');
 if(!prior&&total)notes.push('上周同期没有记录，无法计算有意义的增长比例。');
 if(data.peers?.some(p=>!p.last_sync||week.end-p.last_sync>86400000))notes.push('有配对设备尚未同步或已超过一天未同步，周报可能不完整。');
 notes.push('只比较两周的相同进度；多台设备同时使用时分别计入。');
 return {data,days,total,delta:total-prior,range:week.first+' 至 '+end+' · '+settings.timeZone,
  observations:[peak&&total?`${peak.label}的设备累计用时最长：${time(sum(peak.current))}。`:'暂时没有可比较的每日用时。',
  top?`用时最多的应用：${top.name}（${top.platform==='windows'?'Windows':'Android'}），占设备累计用时的 ${Math.round(top.duration/total*100)}%。`:'有应用记录后，将显示本周占比最高的应用。'],notes};
}
const safeField=v=>{let s=String(v).replace(/[\x00-\x1f]/g,' ');if(typeof v==='string'&&/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function reportCsv(m){
 const w=m.data.week, rows=[['统计周起点','截至（含时区）','分组','日期或应用','平台','本期分钟','上期同期分钟','变化分钟']];
 const add=(category,label,platform,now,previous)=>rows.push([w.first,m.range,category,label,platform,mins(now),mins(previous),mins(now-previous)]);
 for(const p of ['windows','android']){
  add('设备合计','',p,w.current.totals[p],w.previous.totals[p]);
  for(const d of m.days.filter(x=>x.available))add('每日',d.date,p,d.current[p],d.previous[p]);
 }
 for(const app of w.changes)add('应用',app.name,app.platform,app.duration,app.previous);
 return rows.map(r=>r.map(safeField).join(',')).join('\r\n')+'\r\n';
}
const xml=v=>String(v).replace(/[\x00-\x1f]/g,' ').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// Fit variable app names by measured width so the on-screen and exported sheets agree.
function fit(text,width,size){
 const ctx=document.createElement('canvas').getContext('2d');ctx.font=`${size}px "Microsoft YaHei",sans-serif`;
 const s=String(text);if(ctx.measureText(s).width<=width)return s;
 let out='';for(const c of s){if(ctx.measureText(out+c+'…').width>width)break;out+=c;}return out+'…';
}
export function reportSvg(m){
 const width=760,ink='#18314b',muted='#50677b',blue='#3867ae',green='#368875',body=[];
 const text=(x,y,s,size=18,color=ink,bold=false)=>body.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${bold?700:400}">${xml(s)}</text>`);
 const rect=(x,y,w,h,color,r=0)=>body.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${color}"/>`);
 const rule=y=>rect(36,y,688,1,'#cfdae4');
 text(36,44,'ZTIME   /   每周回顾',17,blue,true);text(36,101,'每周使用报告',40,ink,true);
 text(36,139,m.range,19,muted);
 rect(36,166,688,116,'#e8eff8',12);text(58,200,'设备累计',17,muted);
 text(58,252,time(m.total),36,ink,true);text(423,246,change(m.delta),19,ink,true);
 text(36,335,'每日设备用时',26,ink,true);
 text(36,371,'每根柱为两端累计用时 · 单位：分钟',17,muted);
 rect(479,354,13,13,blue,3);text(500,367,'Windows',16);
 rect(607,354,13,13,green,3);text(628,367,'Android',16);
 const limit=Math.max(1,...m.days.map(d=>sum(d.current))),floor=548;
 rect(36,floor,688,1,'#c2cdd9');
 m.days.forEach((d,i)=>{const x=57+i*96,hp=d.current.windows/limit*130,ha=d.current.android/limit*130;
  rect(x,floor-hp,40,hp,blue);rect(x,floor-hp-ha,40,ha,green);
  text(x,floor-hp-ha-10,d.available?String(Math.round(sum(d.current)/60000)):'—',17,muted);
  text(x,floor+30,d.label,16,muted);
 });
 rule(606);text(36,649,'本周观察',24,ink,true);
 m.observations.forEach((s,i)=>text(36,690+i*37,fit(s,684,19),19));
 let y=764;rule(y);text(36,y+44,'阅读提示',24,ink,true);y+=85;
 for(const s of m.notes){text(36,y,fit(s,688,18),18,muted);y+=35;}
 rule(y+4);text(36,y+44,`统计日从 ${m.data.settings.dayStart} 时开始　·　Ztime 本地周报`,16,muted);
 const height=y+74;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="每周使用报告" font-family="Microsoft YaHei, sans-serif"><rect width="100%" height="100%" fill="#f8fafc"/>${body.join('')}</svg>`;
}
async function raster(svg){
 const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth*2;canvas.height=img.naturalHeight*2;
 canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
 return canvas;
}
const encode=(canvas,type)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('无法生成图像')),type,.96));
// One A4 page containing the same high-resolution sheet; no external fonts or services.
async function imagePdf(canvas){
 const jpeg=new Uint8Array(await (await encode(canvas,'image/jpeg')).arrayBuffer());
 const chunks=[],offset=[0];let length=0;
 const add=s=>{const bytes=typeof s==='string'?new TextEncoder().encode(s):s;chunks.push(bytes);length+=bytes.length;};
 const obj=(n,parts)=>{offset[n]=length;add(n+' 0 obj\n');for(const p of parts)add(p);add('\nendobj\n');};
 add('%PDF-1.4\n');obj(1,['<< /Type /Catalog /Pages 2 0 R >>']);obj(2,['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
 obj(3,['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Sheet 4 0 R >> >> /Contents 5 0 R >>']);
 obj(4,[`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg,'\nendstream']);
 const scale=Math.min(559/canvas.width,806/canvas.height),w=scale*canvas.width,h=scale*canvas.height;
 const draw=`q ${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${((595-w)/2).toFixed(3)} ${(842-18-h).toFixed(3)} cm /Sheet Do Q\n`;
 obj(5,[`<< /Length ${draw.length} >>\nstream\n`,draw,'endstream']);
 const start=length;add('xref\n0 6\n0000000000 65535 f \n');for(const off of offset.slice(1))add(String(off).padStart(10,'0')+' 00000 n \n');
 add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);return new Blob(chunks,{type:'application/pdf'});
}
export async function graphicExport(svg,format){
 const canvas=await raster(svg);return format==='png'?encode(canvas,'image/png'):imagePdf(canvas);
}

