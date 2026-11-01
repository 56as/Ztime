// Render a prepared preview. No knowledge of the week model, file formats or native bridge.
export function showReportDialog(dialog,{text,sheet='',formats,save}){
 const content=dialog.querySelector('#dialogContent');
 const actions=formats.map(([id,label])=>`<button data-save-report="${id}" data-file-code="${id.toUpperCase()}">${label}</button>`).join('');
 const body=sheet?`<div class="report-image">${sheet}</div><details><summary>查看文字明细</summary><pre class="report-text"></pre></details>`:'<pre class="report-text"></pre>';
 content.innerHTML=`<header><h2>周报预览</h2><button class="dialog-close" aria-label="关闭">×</button></header>${body}<p class="small">导出统计摘要，不含网站域名和原始时段。</p><div class="row report-formats" aria-label="导出格式">${actions}</div><p class="small" role="status" data-report-notice></p>`;
 content.querySelector('pre').textContent=text;
 content.querySelector('.dialog-close').onclick=()=>dialog.close();
 const notice=content.querySelector('[data-report-notice]');
 for(const button of content.querySelectorAll('[data-save-report]'))button.onclick=async()=>{
  button.disabled=true;
  try{
   const result=await save(button.dataset.saveReport);
   if(result.close && notice.isConnected)dialog.close();else notice.textContent=result.message||'';
  }catch(e){notice.textContent='导出失败：'+e.message;}finally{button.disabled=false;}
 };
 dialog.showModal();
}
