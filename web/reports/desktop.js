import {reportData} from '../shared/report-model.js';
import {reportCsv} from '../shared/report-csv.js';
import {reportSvg} from './chart.js';

function download(blob,filename){
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;
 try{link.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
export function desktopPreview(snapshot,report){
 const model=reportData(snapshot),sheet=reportSvg(model);
 const text=report.content+'\r\n本周观察与提示\r\n'+[...model.observations,...model.notes].join('\r\n')+'\r\n';
 const textFile=(body,type)=>new Blob(['\uFEFF',body],{type:type+';charset=utf-8'});
 const image=async format=>(await import('./image-export.js')).graphicExport(sheet,format);
 const formats=[
  ['txt','文本',()=>textFile(text,'text/plain')],
  ['csv','CSV',()=>textFile(reportCsv(model),'text/csv')],
  ['pdf','PDF',()=>image('pdf')],
  ['png','PNG 图片',()=>image('png')]
 ];
 return {text,sheet,formats:formats.map(([id,label])=>[id,label]),async save(format){
  const entry=formats.find(([id])=>id===format);
  if(!entry)throw new Error('不支持的导出格式');
  const filename=report.filename.replace(/\.txt$/,'.'+format);
  download(await entry[2](),filename);
  return {message:'已发起下载：'+filename};
 }};
}
