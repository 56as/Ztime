// A cancelled dialog (including Escape or Android back) never authorizes a request.
export function askForDeletion(dialog){
 if(dialog.open)return Promise.resolve(null);
 const content=dialog.querySelector('#dialogContent');
 content.innerHTML='<form><header><h2>清除历史记录</h2></header><p>这会删除所有使用记录，并同步到配对设备，无法撤销。</p><label class="field">请输入「删除」确认<input autocomplete="off" aria-label="输入删除确认"></label><div class="row"><button type="button" data-cancel>取消</button><button class="danger" disabled>确认删除</button></div></form>';
 const input=content.querySelector('input'),confirm=content.querySelector('.danger');let value=null;
 input.oninput=()=>confirm.disabled=input.value!=='删除';
 content.querySelector('[data-cancel]').onclick=()=>dialog.close();
 content.querySelector('form').onsubmit=e=>{e.preventDefault();if(input.value==='删除'){value=input.value;dialog.close();}};
 return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(value),{once:true});dialog.showModal();input.focus();});
}

