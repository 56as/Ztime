const collation=new Intl.Collator('zh-CN-u-co-pinyin');
const initials='ABCDEFGHJKLMNOPQRSTWXYZ';
const boundaries=Array.from('阿八擦搭妸发旮哈丌咔垃妈拿噢趴七呥仨他挖夕丫帀');

export function rankInitialSvg(name,id){
 const first=String(name||id||'').normalize('NFKC').match(/[\p{L}\p{N}]/u)?.[0];
 let letter=first?.toLocaleUpperCase()||'#';
 if(first && /\p{Script=Han}/u.test(first)){
  const index=boundaries.findLastIndex(start=>collation.compare(first,start)>=0);
  letter=initials[Math.max(0,index)];
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22"><rect width="22" height="22" rx="5" fill="#526982"/><text x="11" y="11" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="white">${letter}</text></svg>`;
}
