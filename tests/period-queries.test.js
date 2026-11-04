import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../desktop/store.js';
import {readPeriod} from '../desktop/period.js';
import {dayBounds,DEFAULT_SETTINGS} from '../shared/time.js';

test('legacy day responses, chart points and comparisons request independent detail',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const date='2024-03-01',start=dayBounds(date,DEFAULT_SETTINGS).start;
 store.write({id:'a',appId:'a',appName:'Reader',deviceId:store.device.id,start,end:start+60000});
 const params=new URLSearchParams({from:date,to:date,mode:'day'});
 const legacy=readPeriod(store,params);
 for(const [detail,wantBins,wantRows] of [['ring',true,true],['chart',true,false],['totals',false,false]]){
  params.set('detail',detail);
  const stats=readPeriod(store,params);
  assert.equal(stats.total,60000);
  assert.equal(Object.hasOwn(stats.bins[0],'apps'),wantBins);
  assert.equal(Object.hasOwn(stats,'sessions'),wantRows);
  assert.equal(Object.hasOwn(stats,'dayMinutes'),wantRows);
  if(wantRows)assert.deepEqual(stats,legacy);
 }
});

test('recent filters precede the cap and bounded application history remains complete',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 function add(id,appId,start,end){
  store.write({id,deviceId:store.device.id,appId,appName:appId,start,end});
 }
 store.transaction(()=>{
  for(let i=0;i<502;i++)add(String(i),'reader',i,i+1);
  add('other','editor',800,801);
  store.markDeleted('501');
 });
 const application={deviceId:store.device.id,appId:'reader'};
 const recent=store.recentSessions(application);
 assert.equal(recent.length,500);
 assert.equal(recent[0].id,'500');
 assert.equal(recent.at(-1).id,'1');
 assert.deepEqual(store.recentSessions({appId:'editor'}).map(r=>r.id),['other']);
 assert.equal(store.sessionsInRange(0,800,application).length,501);
 assert.deepEqual(store.sessionsInRange(1,2,application).map(r=>r.id),['1']);
 assert.deepEqual(store.sessionsInRange(1,2,{deviceId:null,appId:null}),[]);
});
