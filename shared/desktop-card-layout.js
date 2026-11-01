export const desktopTitles={trend:'使用时间',ranking:'应用排行',compare:'期间对比',devices:'设备用时占比',focus:'应用集中度'};
export function desktopLayout(saved){
 const defaults=Object.keys(desktopTitles).map(key=>({key,visible:['trend','ranking'].includes(key)}));
 if(!Array.isArray(saved) || saved.some(r=>!r || !Object.hasOwn(desktopTitles,r.key) || typeof r.visible!=='boolean') || new Set(saved.map(r=>r.key)).size!==saved.length)return defaults;
 return [...saved,...defaults.filter(row=>!saved.some(r=>r.key===row.key))];
}
export function validDesktopLayout(rows){
 return Array.isArray(rows) && rows.length===Object.keys(desktopTitles).length &&
   rows.every(row=>row && Object.hasOwn(desktopTitles,row.key) && typeof row.visible==='boolean') &&
   new Set(rows.map(r=>r.key)).size===rows.length;
}
