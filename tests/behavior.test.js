import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../desktop/store.js';
import {createBehavior} from '../desktop/behavior.js';
import {dayBounds} from '../shared/time.js';

test('a correction survives restart and changing the default, without mutating a session or sequence',()=>{
 const tmp=mkdtempSync(path.join(tmpdir(),'behavior-test-')),file=path.join(tmp,'ledger.sqlite');
 let store=new Store(file);
 try{
  const day='2026-10-26',start=dayBounds(day,store.get('settings')).start;
  store.upsertDevice({id:'phone',platform:'android',name:'Phone'});
  for(const [id,deviceId,minutes] of [['pc',store.device.id,8],['phone','phone',2]])
   store.write({id,deviceId,appId:'dictionary',appName:'词典',start,end:start+minutes*60000});
  const original=store.sessions(),sequence=store.get('sequence');
  let b=createBehavior(store);
  b.change({kind:'rule',platform:'windows',appId:'dictionary',name:'学习'});
  assert.equal(b.read(day,'week').rows.find(r=>r.id==='phone').category,'未分类');
  b.change({kind:'override',id:'phone',name:'工作'});
  b.change({kind:'add',name:'翻译'});
  b.change({kind:'rule',platform:'android',appId:'dictionary',name:'翻译'});
  store.close();store=new Store(file);b=createBehavior(store);
  let rows=b.read(day,'week').rows;
  assert.equal(rows.reduce((n,r)=>n+r.end-r.start,0),600000);
  assert.deepEqual(rows.map(r=>r.category).sort(),['学习','工作']);
  b.change({kind:'override',id:'phone',name:'未分类'});
  assert.equal(b.read(day,'day').rows.find(r=>r.id==='phone').category,'未分类');
  b.change({kind:'override',id:'phone',name:null});
  assert.equal(b.read(day,'week').rows.find(r=>r.id==='phone').category,'翻译');
  assert.equal(store.get('sequence'),sequence);assert.deepEqual(store.sessions(),original);
  assert.throws(()=>b.change({kind:'override',id:'phone',name:'不存在'}));
  b.change({kind:'override',id:'phone',name:'学习'});store.markDeleted('phone');
  assert.equal(b.read(day,'week').rows.length,1);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM behavior_overrides').get().n,0);
 }finally{store.close();rmSync(tmp,{recursive:true,force:true});}
});
test('a raw session crossing the configured day boundary is clipped once per day, including across a year',()=>{
 const store=new Store(':memory:');
 try{
  const b=createBehavior(store),boundary=dayBounds('2026-01-01',store.get('settings')).start;
  store.write({id:'s',deviceId:store.device.id,appId:'a',appName:'A',start:boundary-20000,end:boundary+40000});
  const week=b.read('2026-01-01','week').rows;
  assert.deepEqual(week.map(r=>[r.id,r.date,r.end-r.start]),[['s','2025-12-31',20000],['s','2026-01-01',40000]]);
  assert.equal(b.read('2026-01-01','year').rows[0].start,boundary);
  assert.equal(b.read('2025-12-31','day').rows[0].end,boundary);
  assert.throws(()=>b.read('2026-02-31','week'));
 }finally{store.close();}
});
