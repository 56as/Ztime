const endpoint = 'http://127.0.0.1:40329/context';
let reports = Promise.resolve();

function publish() {
  // Serialize reports to prevent an older tab query overtaking a focus change.
  const next = reports.then(async () => {
    const {token, client} = await chrome.storage.local.get(['token','client']);
    if (!token || !client) return;
    const win = await chrome.windows.getLastFocused();
    let host = null;
    if (win.focused && !win.incognito && win.type === 'normal') {
      const [tab] = await chrome.tabs.query({active:true,windowId:win.id});
      if (tab && !tab.incognito && /^https?:\/\//.test(tab.url ?? '')) {
        const value = new URL(tab.url).hostname.toLowerCase().replace(/\.$/,'');
        if (/^[a-z0-9.-]+$/.test(value)) host = value;
      }
    }
    const app = /Edg\//.test(navigator.userAgent) ? 'msedge.exe' : 'chrome.exe';
    const r = await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({app,client,host}),signal:AbortSignal.timeout(3000)});
    if (!r.ok) throw new Error(r.status===401?'连接码已失效':'Ztime 拒绝了请求');
  });
  reports = next.catch(()=>{});
  return next;
}
const refresh = () => { publish().catch(()=>{}); };
chrome.tabs.onActivated.addListener(refresh);
chrome.tabs.onUpdated.addListener((_id,change,tab)=>{if (tab.active && change.url) refresh();});
chrome.tabs.onRemoved.addListener(refresh);
chrome.windows.onFocusChanged.addListener(refresh);
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='refresh')refresh();});
async function start() {
  if (!await chrome.alarms.get('refresh')) await chrome.alarms.create('refresh',{periodInMinutes:0.5});
  refresh();
}
chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.runtime.onMessage.addListener((msg,_sender,reply)=>{
  if (msg.type==='disconnect') {
    const clear = reports.then(async()=>{
      const {token,client}=await chrome.storage.local.get(['token','client']);
      if(token&&client) await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({client,app:navigator.userAgent.includes('Edg/')?'msedge.exe':'chrome.exe',host:null}),signal:AbortSignal.timeout(2000)}).catch(()=>{});
      await chrome.storage.local.remove('token');
    });
    reports=clear.catch(()=>{});
    clear.then(()=>reply({ok:true}),err=>reply({error:err.message}));return true;
  }
  if(msg.type!=='check')return;
  publish().then(()=>reply({ok:true}),err=>reply({error:err.message}));
  return true;
});
