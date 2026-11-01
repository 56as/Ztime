// UI-only device directory. Pairing, sync and storage remain outside this module.
export function createDeviceList({esc,icon,stamp}){
 let historyOpen=false;
 function render(devices,peers=[]){
  const byId=new Map(peers.map(peer=>[peer.id,peer]));
  const active=[],history=[];
  for(const device of new Map(devices.map(item=>[item.id,item])).values()){
   (device.local||byId.has(device.id)?active:history).push(device);
  }
  const row=device=>{
   const peer=byId.get(device.id);
   const status=device.local?'':!peer?' · 未配对，仅保留历史记录':peer.last_sync?' · 上次同步 '+stamp(peer.last_sync):' · 尚未完成同步';
   return `<div class="device"><span class="device-icon">${icon(device.platform==='android'?'phone':'devices')}</span><div class="device-info"><strong>${esc(device.name)}</strong> ${device.local?'<span class="tag">本机</span>':''}<div class="small">${device.platform==='android'?'Android':'Windows'}${status}</div></div>${!device.local&&peer?`<button data-unpair="${esc(device.id)}" class="ghost danger">解除配对</button>`:''}</div>`;
  };
  return `${active.map(row).join('')}${history.length?`<details data-history ${historyOpen?'open':''}><summary>历史设备（${history.length}）</summary><p class="small">这些设备不再参与同步，已有记录仍计入统计。</p>${history.map(row).join('')}</details>`:''}`;
 }
 function bind(details){
  if(details)details.ontoggle=()=>{if(details.isConnected)historyOpen=details.open;};
 }
 return {render,bind};
}
