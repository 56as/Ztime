import {deviceTotal,reportDuration,weeklyComparison} from '../shared/report-format.js';
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
 text(58,252,reportDuration(m.total),36,ink,true);text(423,246,weeklyComparison(m.delta),19,ink,true);
 text(36,335,'每日设备用时',26,ink,true);
 text(36,371,'每根柱为两端累计用时 · 单位：小时',17,muted);
 rect(479,354,13,13,blue,3);text(500,367,'Windows',16);
 rect(607,354,13,13,green,3);text(628,367,'Android',16);
 const limit=Math.max(1,...m.days.map(d=>deviceTotal(d.current))),floor=548;
 rect(36,floor,688,1,'#c2cdd9');
 m.days.forEach((d,i)=>{const x=57+i*96,hp=d.current.windows/limit*130,ha=d.current.android/limit*130;
  rect(x,floor-hp,40,hp,blue);rect(x,floor-hp-ha,40,ha,green);
  text(x,floor-hp-ha-10,d.available?(deviceTotal(d.current)>0 && deviceTotal(d.current)<36000?'<0.01':String(Math.round(deviceTotal(d.current)/36000)/100)):'—',17,muted);
  text(x,floor+30,d.label,16,muted);
 });
 rule(606);text(36,649,'本周观察',24,ink,true);
 m.observations.forEach((s,i)=>text(36,690+i*37,fit(s,684,19),19));
 let y=764;rule(y);text(36,y+44,'阅读提示',24,ink,true);y+=85;
 for(const s of m.notes){text(36,y,fit(s,688,18),18,muted);y+=35;}
 rule(y+4);text(36,y+44,`统计日从 ${m.dayStart} 时开始　·　Ztime 本地周报`,16,muted);
 const height=y+74;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="每周使用报告" font-family="Microsoft YaHei, sans-serif"><rect width="100%" height="100%" fill="#f8fafc"/>${body.join('')}</svg>`;
}
