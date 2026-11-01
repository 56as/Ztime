const el = id=>document.getElementById(id);
async function check() {
  try {
    const result = await chrome.runtime.sendMessage({type:'check'});
    el('status').textContent = result.ok?'已连接':(result.error||'请打开 Ztime 后重试');
  } catch { el('status').textContent='请打开 Ztime 后重试'; }
}
el('connect').onclick = async () => {
  const token=el('token').value.trim();
  if(!/^[0-9a-f]{64}$/.test(token)){el('status').textContent='请输入完整连接码';return;}
  if(!await chrome.permissions.request({permissions:['tabs']})){el('status').textContent='需要允许读取活动标签页';return;}
  const old=await chrome.storage.local.get('client');
  await chrome.storage.local.set({token,client:old.client||crypto.randomUUID()});
  el('token').value='';await check();
};
el('off').onclick=async()=>{
  await chrome.runtime.sendMessage({type:'disconnect'});
  await chrome.permissions.remove({permissions:['tabs']});
  el('status').textContent='已断开';
};
chrome.storage.local.get('token').then(v=>{if(v.token)check();else el('status').textContent='尚未连接';});
