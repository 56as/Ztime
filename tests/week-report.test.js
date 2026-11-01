import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../desktop/store.js';
import {weekReport} from '../shared/week-report.js';

test('export uses the displayed comparison, device overlap and sync coverage, without raw site history',()=>{
 const db=new Store(':memory:');const now=Date.parse('2026-10-31T08:00:00Z');
 try{
  db.upsertDevice({id:'phone',name:'测试手机',platform:'android'});
  const w=db.summary(undefined,now).week;
  for(const [id,deviceId,start,length] of [
    ['pc',db.device.id,now-3600000,1800000],['mobile','phone',now-3600000,600000],
    ['previous',db.device.id,w.previousEnd-600000,600000]]){
    db.write({id,deviceId,appId:'reader',appName:'Reader',start,end:start+length,site:'private.example'});
  }
  const d=db.summary(undefined,now);d.peers=[{id:'phone',last_sync:now-3600000}];
  const report=weekReport(d);
  assert.equal(report.filename,'Ztime-周报-'+w.first+'.txt');
  assert.match(report.content,/设备累计　40 分钟，增加 30 分钟/);
  assert.match(report.content,/Windows　30 分钟，上周同期 10 分钟/);
  assert.match(report.content,/测试手机　最近同步/);
  assert.ok(!report.content.includes('private.example'));
  d.peers[0].last_sync=0;assert.match(weekReport(d).content,/尚未完成同步/);
 }finally{db.close();}
});
