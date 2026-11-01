export const deviceTotal=o=>o.windows+o.android;
export function reportDuration(ms){const m=Math.floor(ms/60000);return ms>0&&!m?'不足 1 分钟':m>=60?`${Math.floor(m/60)} 小时 ${m%60} 分钟`:`${m} 分钟`;}
export const weeklyComparison=n=>n===0?'与上周同期持平':`比上周同期${n>0?'增加':'减少'} ${reportDuration(Math.abs(n))}`;
