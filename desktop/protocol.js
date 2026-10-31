import { randomBytes, randomInt, randomUUID, createHash, timingSafeEqual, X509Certificate } from 'node:crypto';
import https from 'node:https';
import dgram from 'node:dgram';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import selfsigned from 'selfsigned';
import QRCode from 'qrcode';

export const hash=v=>createHash('sha256').update(v).digest('hex');
const secret=()=>randomBytes(32).toString('hex');
export function equalSecret(a,b){return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export async function readJson(req){let size=0;const parts=[];for await(const p of req){size+=p.length;if(size>2_000_000)throw new Error('请求数据过大');parts.push(p);}return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');}
export function send(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));}
export class SyncServer {
 constructor(store,dir){this.store=store;this.dir=dir;this.invite=null;this.attempts=new Map();}
 async start(port=40327){
  const certPath=path.join(this.dir,'tls.json');let tls;
  if(fs.existsSync(certPath))tls=JSON.parse(fs.readFileSync(certPath,'utf8'));
  else {const p=await selfsigned.generate([{name:'commonName',value:'Time Ledger local device'}],{days:3650,keySize:2048,algorithm:'sha256'});tls={key:p.private,cert:p.cert};fs.writeFileSync(certPath,JSON.stringify(tls),{mode:0o600});}
  this.pin=new X509Certificate(tls.cert).fingerprint256.replaceAll(':','').toLowerCase();
  this.server=https.createServer(tls,(req,res)=>this.handle(req,res));this.server.requestTimeout=15000;this.server.headersTimeout=10000;
  await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(port,'0.0.0.0',resolve);});this.port=this.server.address().port;
  this.discovery=dgram.createSocket('udp4');this.discovery.on('error',()=>{});this.discovery.on('message',(message,remote)=>{try{if(message.length>512)return;const q=JSON.parse(message.toString());if(q.service!=='time-ledger'||q.type!=='discover'||typeof q.nonce!=='string'||q.nonce.length>80)return;const reply={service:'time-ledger',type:'reply',nonce:q.nonce,deviceId:this.store.device.id,pin:this.pin,port:this.port};this.discovery.send(Buffer.from(JSON.stringify(reply)),remote.port,remote.address);}catch{}});this.discovery.bind(port===0?0:40328,'0.0.0.0');
 }
 addresses(){return Object.values(os.networkInterfaces()).flat().filter(i=>i&&i.family==='IPv4'&&!i.internal).map(i=>i.address).filter(a=>/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)).sort((a,b)=>(a.startsWith('192.168.')?0:a.startsWith('10.')?1:2)-(b.startsWith('192.168.')?0:b.startsWith('10.')?1:2));}
 async createInvite(selected){if(!this.port)throw new Error('局域网同步服务未启动');this.store.db.prepare('DELETE FROM requests WHERE created_at<?').run(Date.now()-300000);this.invite={code:String(randomInt(100000,1000000)),expires:Date.now()+300000};const addresses=this.addresses();if(!addresses.length)throw new Error('未发现局域网地址，请连接 Wi-Fi 后重试');const host=addresses.includes(selected)?selected:addresses[0];const uri=`timeledger://pair?host=${host}&port=${this.port}&pin=${this.pin}&code=${this.invite.code}`;return {...this.invite,host,addresses,port:this.port,pin:this.pin,uri,qr:await QRCode.toDataURL(uri,{width:240,margin:2})};}
 rateLimit(address){const now=Date.now();const list=(this.attempts.get(address)||[]).filter(t=>now-t<60000);if(list.length>=8)return false;list.push(now);this.attempts.set(address,list);if(this.attempts.size>1000)this.attempts.clear();return true;}
 async handle(req,res){try{
  if(req.method!=='POST')return send(res,405,{error:'不支持的方法'});
  const body=await readJson(req);
  if(req.url==='/v1/pair'){
   if(!this.rateLimit(req.socket.remoteAddress))return send(res,429,{error:'尝试过于频繁，请稍后再试'});
   if(!this.invite||Date.now()>this.invite.expires||!equalSecret(body.code,this.invite.code))return send(res,403,{error:'配对码无效或已过期'});
   if(!body.device||body.device.platform!=='android'||typeof body.device.name!=='string'||body.device.name.length>100||typeof body.device.id!=='string'||body.device.id.length>100)return send(res,400,{error:'设备信息无效'});
   const id=randomUUID(),pollSecret=secret();this.store.db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?)').run(id,body.device.name,body.device.id,hash(pollSecret),'pending',Date.now(),null);
   this.store.upsertDevice(body.device);return send(res,200,{id,pollSecret,device:this.store.device});
  }
  if(req.url==='/v1/pair/status'){
   const r=this.store.db.prepare('SELECT * FROM requests WHERE id=?').get(body.id);
   if(!r||Date.now()-r.created_at>300000||!equalSecret(hash(body.pollSecret??''),r.secret_hash))return send(res,403,{error:'配对请求无效或过期'});
   if(r.status==='approved'&&r.token)return send(res,200,{status:'approved',token:r.token,device:this.store.device});
   return send(res,200,{status:r.status});
  }
  const token=(req.headers.authorization??'').replace(/^Bearer /,'');const peer=this.store.db.prepare('SELECT * FROM peers WHERE token_hash=?').get(hash(token));
  if(!peer)return send(res,401,{error:'请先配对设备'});
  if(req.url!=='/v1/sync')return send(res,404,{error:'接口不存在'});
  if(body.device?.id!==peer.id||body.device.platform!=='android')return send(res,403,{error:'设备来源不符'});
  this.store.db.prepare("UPDATE requests SET token=NULL,status='delivered' WHERE device_id=? AND status='approved'").run(peer.id);
  this.store.upsertDevice(body.device);const imported=this.store.importChanges(body.changes??[],peer.id);if(body.settings)this.store.receiveSettings(body.settings);
  const cursor=Number(body.cursor??0);if(!Number.isSafeInteger(cursor)||cursor<0)return send(res,400,{error:'同步游标无效'});
  const changes=this.store.changes(cursor);const next=changes.at(-1)?.seq??cursor;
  this.store.db.prepare('UPDATE peers SET last_sync=? WHERE id=?').run(Date.now(),peer.id);
  return send(res,200,{device:this.store.device,changes,cursor:next,hasMore:changes.length===1000,ack:body.changes?.at(-1)?.seq??0,settings:this.store.get('settings'),imported});
 }catch(e){if(!res.headersSent)send(res,400,{error:e.message});else res.end();}}
 approve(id,accept){const r=this.store.db.prepare('SELECT * FROM requests WHERE id=?').get(id);if(!r||r.status!=='pending'||Date.now()-r.created_at>300000)throw new Error('配对请求已失效');if(!accept){this.store.db.prepare("UPDATE requests SET status='rejected' WHERE id=?").run(id);return;}const token=secret();this.store.db.prepare('INSERT INTO peers VALUES(?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,name=excluded.name').run(r.device_id,hash(token),r.name,Date.now());this.store.db.prepare("UPDATE requests SET status='approved',token=? WHERE id=?").run(token,id);this.invite=null;}
 close(){this.server?.close();try{this.discovery?.close();}catch{}}
}
