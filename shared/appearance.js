export const ACCENT_COLORS=[
 {id:'blue',name:'海蓝',light:'#007aff',dark:'#409cff'},
 {id:'green',name:'松绿',light:'#24835a',dark:'#4ac88a'},
 {id:'purple',name:'鸢紫',light:'#7b50c8',dark:'#b59bff'},
 {id:'amber',name:'琥珀',light:'#b96713',dark:'#ffb15c'},
 {id:'pink',name:'玫粉',light:'#c64e7b',dark:'#ff8eb4'},
 {id:'teal',name:'青碧',light:'#007f8f',dark:'#55cbd6'},
 {id:'coral',name:'珊瑚',light:'#cb4449',dark:'#ff8b86'},
 {id:'graphite',name:'石墨',light:'#62646a',dark:'#b4b7c0'}
];
export function validAppearance(value){return !!value&&['system','light','dark'].includes(value.theme)&&ACCENT_COLORS.some(c=>c.id===value.accentColor);}
