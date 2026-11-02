import {behaviorRange,behaviorRows,missing} from '../shared/behavior.js';
import {dayBounds} from '../shared/time.js';

// Classification is local metadata: it never changes the raw ledger or its sync sequence.
export function createBehavior(store){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS behavior_names(name TEXT PRIMARY KEY);
 INSERT OR IGNORE INTO behavior_names VALUES ('学习'),('工作');
 CREATE TABLE IF NOT EXISTS behavior_rules(platform TEXT,app_id TEXT,name TEXT NOT NULL REFERENCES behavior_names(name),PRIMARY KEY(platform,app_id));
 CREATE TABLE IF NOT EXISTS behavior_overrides(session_id TEXT PRIMARY KEY REFERENCES sessions(id),name TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS forget_behavior AFTER UPDATE OF deleted_at ON sessions WHEN NEW.deleted_at IS NOT NULL BEGIN DELETE FROM behavior_overrides WHERE session_id=NEW.id; END;`);
 function read(anchor,mode){
  const settings=store.get('settings'),[first,last]=behaviorRange(anchor,mode);
  const records=db.prepare(`SELECT s.id,s.start,s.end,s.app_name app,d.name device,r.name AS rule,o.name AS override
   FROM sessions s JOIN devices d ON d.id=s.device_id
   LEFT JOIN behavior_rules r ON r.app_id=s.app_id AND r.platform=d.platform
   LEFT JOIN behavior_overrides o ON o.session_id=s.id
   WHERE s.deleted_at IS NULL AND s.start<? AND s.end>? ORDER BY s.start,s.id`)
   .all(dayBounds(last,settings).end,dayBounds(first,settings).start);
  const apps=db.prepare(`SELECT d.platform,s.app_id AS appId,MAX(s.app_name) app,r.name AS rule FROM sessions s
   JOIN devices d ON d.id=s.device_id LEFT JOIN behavior_rules r ON r.platform=d.platform AND r.app_id=s.app_id
   WHERE s.deleted_at IS NULL GROUP BY d.platform,s.app_id ORDER BY app,d.platform,s.app_id`).all();
  return {first,last,rows:behaviorRows(records,settings,first,last),names:db.prepare('SELECT name FROM behavior_names ORDER BY rowid').all().map(r=>r.name),apps};
 }
 function change({kind,name,platform,appId,id}){
  if(kind==='add'){
   if(typeof name!=='string'||!name.trim()||name.trim().length>16||name.trim()===missing)throw Error('请输入 1 至 16 字的新行为名称');
   if(!db.prepare('INSERT OR IGNORE INTO behavior_names VALUES (?)').run(name.trim()).changes)throw Error('该行为名称已存在');
  }else{
   if(name!==null&&name!==missing&&(typeof name!=='string'||!db.prepare('SELECT 1 FROM behavior_names WHERE name=?').get(name)))throw Error('行为不存在');
   if(kind==='rule'){
    if(!db.prepare('SELECT 1 FROM sessions s JOIN devices d ON d.id=s.device_id WHERE s.app_id=? AND d.platform=? AND s.deleted_at IS NULL LIMIT 1').get(appId,platform))throw Error('应用不存在');
    if(name===null||name===missing)db.prepare('DELETE FROM behavior_rules WHERE platform=? AND app_id=?').run(platform,appId);
    else db.prepare('INSERT OR REPLACE INTO behavior_rules VALUES (?,?,?)').run(platform,appId,name);
   }else if(kind==='override'){
    if(!db.prepare('SELECT 1 FROM sessions WHERE id=? AND deleted_at IS NULL').get(id))throw Error('时段已不存在');
    if(name===null)db.prepare('DELETE FROM behavior_overrides WHERE session_id=?').run(id);
    else db.prepare('INSERT OR REPLACE INTO behavior_overrides VALUES (?,?)').run(id,name);
   }else throw Error('操作无效');
  }
  return {ok:true};
 }
 return {read,change};
}
