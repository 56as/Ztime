import http from 'node:http';
import {validAppearance} from '../shared/appearance.js';
import {validateLayout} from '../shared/layout.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { BrowserBridge } from './browser-bridge.js';
import { Store } from './store.js';
import { Collector } from './collector.js';
import { SyncServer, readJson, send, equalSecret } from './protocol.js';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function createApp(options={}){
 const dir=options.dataDir??process.env.TIME_LEDGER_DATA_DIR??path.join(root,'.data');fs.mkdirSync(dir,{recursive:true});
 const store=new Store(path.join(dir,'ledger.sqlite'));const browser=new BrowserBridge(store,options.browserPort);const collector=new Collector(store,(app,now)=>browser.hostFor(app,now));
 if(browser.status().enabled){try{await browser.listen();}catch{/* Settings displays the unavailable bridge. */}}const sync=new SyncServer(store,dir);let syncError=null;
 try{await sync.start(options.syncPort??40327);}catch(e){syncError=e.message;}
 if(options.collect!==false)collector.start();
 const cookie=randomBytes(32).toString('hex');
 async function route(method,url,body={}){
  const u=new URL(url,'http://localhost');
  if(method==='GET'&&u.pathname==='/api/summary')return {...store.summary(u.searchParams.get('date')||undefined),browser:browser.status(),autostart:options.autostart?.get()??null,sync:{port:sync.port,addresses:sync.addresses(),error:syncError}};
  if(method==='POST'&&u.pathname==='/api/browser')return browser.configure(body.enabled===true);
  if(method==='PUT'&&u.pathname==='/api/appearance'){if(!validAppearance(body))throw new Error('外观选项无效');store.set('appearance',{theme:body.theme,accentColor:body.accentColor});return {ok:true};}
  if(method==='POST'&&u.pathname==='/api/autostart'){if(!options.autostart)throw new Error('开机启动仅在桌面程序中设置');options.autostart.set(body.enabled===true);return {ok:true};}
  if(method==='POST'&&u.pathname==='/api/pause'){collector.pause(body.paused===true);return {ok:true};}
  if(method==='PUT'&&u.pathname==='/api/layout'){const key=validateLayout(body);store.set(key,{widgets:body.widgets});return {ok:true};}
  if(method==='PUT'&&u.pathname==='/api/settings')return store.updateSettings(body);
  if(method==='POST'&&u.pathname==='/api/settings/resolve'){store.resolveSettings(body.choice);return {ok:true};}
  if(method==='POST'&&u.pathname==='/api/pair')return sync.createInvite(body.host);
  if(method==='POST'&&u.pathname==='/api/pair/approve'){sync.approve(body.id,body.accept===true);return {ok:true};}
  if(method==='POST'&&u.pathname==='/api/sync')return sync.requestSync();
  if(method==='DELETE'&&u.pathname==='/api/peer'){sync.cancelPeer(body.id);store.db.prepare('DELETE FROM peers WHERE id=?').run(body.id);return {ok:true};}
  if(method==='GET'&&u.pathname==='/api/sessions'&&u.searchParams.has('start')){
   const params=u.searchParams,start=Number(params.get('start')),end=Number(params.get('end'));
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start)throw new Error('时间范围无效');
   return store.db.prepare('SELECT * FROM sessions WHERE device_id=? AND app_id=? AND deleted_at IS NULL AND start<? AND end>? ORDER BY start DESC')
    .all(params.get('deviceId'),params.get('appId'),end,start).map(row=>store.decode(row));
  }
  if(method==='GET'&&u.pathname==='/api/sessions')return store.sessions().filter(s=>!s.deletedAt&&(!u.searchParams.get('appId')||s.appId===u.searchParams.get('appId'))&&(!u.searchParams.get('deviceId')||s.deviceId===u.searchParams.get('deviceId'))).slice(0,500);
  if(method==='DELETE'&&u.pathname==='/api/session'){store.markDeleted(body.id);collector.active=null;return {ok:true};}
  if(method==='DELETE'&&u.pathname==='/api/data'){if(body.confirm!=='删除')throw new Error('请输入“删除”确认');store.transaction(()=>{for(const s of store.sessions())store.markDeleted(s.id);});collector.active=null;return {ok:true};}
  if(method==='GET'&&u.pathname==='/api/export'){
   const rows=store.sessions().filter(s=>!s.deletedAt);const csv=v=>'"'+String(/^[=+\-@]/.test(String(v))?"'"+v:v).replaceAll('"','""')+'"';const format=u.searchParams.get('format');return format==='csv'?{filename:'time-ledger.csv',type:'text/csv',content:'\uFEFF'+[['id','device_id','app_id','app_name','start_utc','end_utc','duration_ms'],...rows.map(s=>[s.id,s.deviceId,s.appId,s.appName,new Date(s.start).toISOString(),new Date(s.end).toISOString(),s.end-s.start])].map(r=>r.map(csv).join(',')).join('\r\n')}:{filename:'time-ledger.json',type:'application/json',content:JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),settings:store.get('settings'),devices:store.devices(),sessions:rows},null,2)};
  }
  throw new Error('接口不存在');
 }
 const server=http.createServer(async(req,res)=>{
  try{
   const listenPort=server.address()?.port;if(![`127.0.0.1:${listenPort}`,`localhost:${listenPort}`].includes(req.headers.host))return send(res,403,{error:'仅允许本机访问'});
   const u=new URL(req.url,'http://localhost');
   // LAN clients never see this service: it listens on loopback only.
   if(u.pathname.startsWith('/api/')){
    const token=(req.headers.cookie??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ledger='))?.slice(7);
    if(!equalSecret(token,cookie))return send(res,401,{error:'请重新打开应用'});
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(res,403,{error:'请求来源不受信任'});
    return send(res,200,await route(req.method,req.url,req.method==='GET'?{}:await readJson(req)));
   }
   const files={'/':'web/index.html','/app.js':'web/app.js','/dashboard.js':'web/dashboard.js','/report-view.js':'web/report-view.js','/style.css':'web/style.css','/brand-icon.png':'web/brand-icon.png','/shared/week-report.js':'shared/week-report.js','/shared/time.js':'shared/time.js','/shared/layout.js':'shared/layout.js','/shared/appearance.js':'shared/appearance.js','/shared/dashboard.js':'shared/dashboard.js'};
   const file=files[u.pathname];if(!file){res.writeHead(404);return res.end();}
   const type=file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
   res.writeHead(200,{'content-type':type+';charset=utf-8','set-cookie':`ledger=${cookie}; HttpOnly; SameSite=Strict; Path=/`,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"});res.end(fs.readFileSync(path.join(root,file)));
  }catch(e){send(res,400,{error:e.message});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port??40326,'127.0.0.1',resolve);});
 return {store,collector,sync,route,url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>{browser.close();collector.stop();sync.close();server.close(()=>{store.close();resolve();});})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const app=await createApp();console.log(`Time Ledger: ${app.url}`);for(const s of ['SIGINT','SIGTERM'])process.on(s,async()=>{await app.close();process.exit();});}
