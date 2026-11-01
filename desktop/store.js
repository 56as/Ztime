import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { DEFAULT_SETTINGS, aggregate, dateKey, dayBounds, weekBounds, validSettings } from '../shared/time.js';

export class Store {
 constructor(path,platform='windows',name=os.hostname()){
  this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,name TEXT NOT NULL,platform TEXT NOT NULL,last_seen INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,device_id TEXT NOT NULL,app_id TEXT NOT NULL,app_name TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,source_seq INTEGER NOT NULL,seq INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER);
  CREATE INDEX IF NOT EXISTS sessions_time ON sessions(start,end);CREATE INDEX IF NOT EXISTS sessions_seq ON sessions(seq);
  CREATE TABLE IF NOT EXISTS peers(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,name TEXT NOT NULL,created_at INTEGER NOT NULL,last_sync INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,name TEXT NOT NULL,device_id TEXT NOT NULL,secret_hash TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,token TEXT);
  `);
  let device=this.get('device');if(!device){device={id:randomUUID(),name,platform};this.set('device',device);}this.device=device;this.upsertDevice(device);
  if(!this.get('settings'))this.set('settings',DEFAULT_SETTINGS);
 }
 get(key,fallback=null){const r=this.db.prepare('SELECT value FROM meta WHERE key=?').get(key);return r?JSON.parse(r.value):fallback;}
 set(key,value){this.db.prepare('INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));return value;}
 next(){const seq=this.get('sequence',0)+1;this.set('sequence',seq);return seq;}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 upsertDevice(d){if(!d||!['windows','android'].includes(d.platform)||typeof d.id!=='string'||typeof d.name!=='string'||d.name.length>100)throw new Error('设备信息无效');this.db.prepare('INSERT INTO devices(id,name,platform,last_seen) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,last_seen=excluded.last_seen').run(d.id,d.name,d.platform,Date.now());}
 devices(){return this.db.prepare('SELECT * FROM devices').all().map(r=>({id:r.id,name:r.name,platform:r.platform,lastSeen:r.last_seen,local:r.id===this.device.id}));}
 decode(r){return {id:r.id,deviceId:r.device_id,appId:r.app_id,appName:r.app_name,start:r.start,end:r.end,sourceSeq:r.source_seq,seq:r.seq,updatedAt:r.updated_at,deletedAt:r.deleted_at};}
 sessions(){return this.db.prepare('SELECT * FROM sessions ORDER BY start DESC').all().map(r=>this.decode(r));}
 write(s,local=true){
  const old=this.db.prepare('SELECT * FROM sessions WHERE id=?').get(s.id);
  if(old?.deleted_at)return false;
  if(old&&(old.device_id!==s.deviceId||old.app_id!==s.appId||old.start!==s.start))throw new Error('记录来源不可修改');
  if(old&&!s.deletedAt&&!local&&old.source_seq>=s.sourceSeq)return false;
  const seq=this.next(),sourceSeq=local?seq:s.sourceSeq;
  this.db.prepare(`INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET end=excluded.end,source_seq=excluded.source_seq,seq=excluded.seq,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at`).run(s.id,s.deviceId,s.appId,s.appName,s.start,s.end,sourceSeq,seq,Date.now(),s.deletedAt||null);return true;
 }
 markDeleted(id){const row=this.db.prepare('SELECT * FROM sessions WHERE id=?').get(id);if(row&&!row.deleted_at){const seq=this.next();this.db.prepare('UPDATE sessions SET deleted_at=?,seq=?,updated_at=? WHERE id=?').run(Date.now(),seq,Date.now(),id);}return !!row;}
 changes(after=0,limit=1000,peerId=null){return this.db.prepare('SELECT * FROM sessions WHERE seq>? AND (device_id=? OR (deleted_at IS NOT NULL AND (? IS NULL OR device_id=?))) ORDER BY seq LIMIT ?').all(after,this.device.id,peerId,peerId,limit).map(r=>this.decode(r));}
 importChanges(changes,owner){if(!Array.isArray(changes)||changes.length>1000)throw new Error('同步批次无效');let count=0;this.transaction(()=>{for(const s of changes){validateSession(s);if(s.deviceId!==owner){const existing=this.db.prepare('SELECT * FROM sessions WHERE id=?').get(s.id);if(!s.deletedAt||!existing||existing.device_id!==s.deviceId)throw new Error('不能替其他设备写入记录');if(this.markDeleted(s.id))count++;continue;}if(this.write(s,false))count++;}});return count;}
 receiveSettings(remote){if(!validSettings(remote))throw new Error('统计设置无效');const local=this.get('settings');if(JSON.stringify([local.dayStart,local.timeZone])===JSON.stringify([remote.dayStart,remote.timeZone])){this.set('settingsConflict',null);return false;}if(remote.revision===local.baseRevision)return false;if(local.revision==='default'||remote.baseRevision===local.revision){this.set('settings',remote);this.set('settingsConflict',null);return false;}if(remote.revision!=='default')this.set('settingsConflict',remote);return true;}
 resolveSettings(choice){const remote=this.get('settingsConflict');if(!remote)return;if(choice==='remote')this.set('settings',remote);else this.set('settings',{...this.get('settings'),baseRevision:remote.revision,revision:randomUUID()});this.set('settingsConflict',null);}
 updateSettings(input){const old=this.get('settings');const value={...old,dayStart:Number(input.dayStart),timeZone:input.timeZone,weekStart:1,baseRevision:old.revision,revision:randomUUID()};if(!validSettings(value))throw new Error('请检查日界线和时区');this.set('settings',value);return value;}
 summary(date,now=Date.now()){
  const settings=this.get('settings'),key=date??dateKey(now,settings);if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!Number.isFinite(Date.parse(key+'T12:00:00Z'))||new Date(key+'T12:00:00Z').toISOString().slice(0,10)!==key)throw new Error('日期无效');
  const bounds=dayBounds(key,settings),w=weekBounds(now,settings),sessions=this.db.prepare('SELECT * FROM sessions WHERE deleted_at IS NULL AND ((end>? AND start<?) OR (end>? AND start<?))').all(bounds.start,bounds.end,w.previous,w.end).map(r=>this.decode(r)),devices=this.devices();const today=aggregate(sessions,bounds.start,Math.min(bounds.end,now),devices);const current=aggregate(sessions,w.start,w.end,devices),previous=aggregate(sessions,w.previous,w.previousEnd,devices);const apps=new Map();for(const a of current.apps)apps.set(a.key,{...a,previous:0});for(const a of previous.apps){if(!apps.has(a.key))apps.set(a.key,{...a,duration:0,previous:0});apps.get(a.key).previous=a.duration;}
  const changes=[...apps.values()].map(a=>({...a,change:a.duration-a.previous})).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change));
  return {device:this.device,devices,settings,date:key,today,week:{...w,current,previous,changes},paused:this.get('paused',false),collector:this.get('collector',{state:'starting'}),appearance:this.get('appearance'),layout:this.get('layout'),weekLayout:this.get('weekLayout'),settingsConflict:this.get('settingsConflict'),peers:this.db.prepare('SELECT id,name,created_at,last_sync FROM peers').all(),requests:this.db.prepare("SELECT id,name,device_id,created_at FROM requests WHERE status='pending' AND created_at>?").all(Date.now()-300000)};
 }
 close(){this.db.close();}
}
export function validateSession(s){if(!s||typeof s.id!=='string'||s.id.length>100||typeof s.deviceId!=='string'||s.deviceId.length>100||typeof s.appId!=='string'||s.appId.length>500||typeof s.appName!=='string'||s.appName.length>200||!Number.isSafeInteger(s.start)||!Number.isSafeInteger(s.end)||s.start<0||s.end<s.start||s.end-s.start>32*86400000||s.end>Date.now()+86400000||!Number.isSafeInteger(s.sourceSeq)||s.sourceSeq<0||(s.deletedAt!=null&&!Number.isSafeInteger(s.deletedAt)))throw new Error('无效的使用记录');}
