export const WIDGETS = [
 {id:'header',name:'顶部信息',w:12,h:112,view:'summary'},
 {id:'phone',name:'手机',w:6,h:185,view:'numbers'},
 {id:'computer',name:'电脑',w:6,h:185,view:'numbers'},
 {id:'apps',name:'应用',w:6,h:360,view:'bar'},
 {id:'pie',name:'应用占比',w:6,h:360,view:'donut'},
 {id:'hours',name:'时段',w:6,h:340,view:'bar'},
 {id:'stats',name:'统计摘要',w:6,h:340,view:'numbers'},
 {id:'week',name:'每周对比',w:6,h:300,view:'numbers'},
 {id:'changes',name:'应用变化',w:6,h:300,view:'list'},
 {id:'deviceShare',name:'设备占比',w:6,h:340,view:'donut',hidden:true}
];
export function defaultsFor(page='home') {
 return WIDGETS.map(w=>({...w,hidden:!!w.hidden,count:w.id==='changes'?5:10,device:'all',direction:'all',...(page==='week'&&w.id==='hours'?{name:'每日趋势'}:{})}));
}
export function completeLayout(saved,page='home') {
 const catalog=defaultsFor(page),known=new Map(catalog.map(w=>[w.id,w]));
 const result=[],seen=new Set();
 for(const raw of saved?.widgets??[]){if(known.has(raw.id)&&!seen.has(raw.id)){result.push({...known.get(raw.id),...raw});seen.add(raw.id);}}
 for(const item of catalog){if(!seen.has(item.id)){if(item.id==='header')result.unshift({...item});else result.push({...item});}}
 return result;
}
export function layoutKey(page='home'){if(!['home','week'].includes(page))throw new Error('布局页面无效');return page==='week'?'weekLayout':'layout';}
export function validateLayout(body) {
 const key=layoutKey(body.page??'home');
 if(!Array.isArray(body.widgets)||body.widgets.length>WIDGETS.length)throw new Error('布局无效');
 const ids=new Set(),known=new Set(WIDGETS.map(w=>w.id));
 for(const w of body.widgets){
  if(!w||!known.has(w.id)||ids.has(w.id)||!Number.isInteger(w.w)||w.w<3||w.w>12||!Number.isInteger(w.h)||w.h<(w.id==='header'?96:140)||w.h>900)throw new Error('模块尺寸无效');
  if(w.title!==undefined&&(typeof w.title!=='string'||w.title.length>40))throw new Error('模块标题过长');
  for(const [key,min,max]of [['timeFontSize',24,72],['unitFontSize',14,36]])if(w[key]!==undefined&&(!Number.isInteger(w[key])||w[key]<min||w[key]>max))throw new Error('时间字号无效');
  if(w.hidden!==undefined&&typeof w.hidden!=='boolean')throw new Error('模块状态无效');
  if(w.device!==undefined&&!['all','android','windows'].includes(w.device))throw new Error('设备筛选无效');
  ids.add(w.id);
 }
 return key;
}
