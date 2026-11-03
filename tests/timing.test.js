import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../desktop/store.js';
import {Collector} from '../desktop/collector.js';
import {defaultTiming,scheduled} from '../desktop/timing.js';

test('overlapping idle and scheduled minutes are excluded once without creating idle history',()=>{
 const store=new Store(':memory:'),collector=new Collector(store);
 try{
  store.set('settings',{...store.get('settings'),timeZone:'UTC'});
  store.set('timing',{...defaultTiming,schedule:true,start:'12:04',end:'12:06'});
  const base=Date.UTC(2026,10,3,12);
  // Last input at minute 2; returns at minute 10. The foreground changes
  // during that absence. The 2 scheduled minutes overlap with idle.
  for(let sec=0;sec<=720;sec+=5){
   const idleMs=sec>=120&&sec<600?(sec-120)*1000:0;
   const app=sec<300?'A':'B';
   collector.sample({state:'active',appId:app,appName:app,idleMs},base+sec*1000);
  }
  const minutes=()=>store.sessions().filter(s=>!s.deletedAt).reduce((n,s)=>n+s.end-s.start,0)/60000;
  assert.equal(minutes(),4);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='idle_parts'").get().n,0);
  assert.equal(store.summary('2026-11-03',base+720000).today.totals.windows,240000);
 }finally{store.close();}
});
test('overnight schedule is owned by its starting weekday in the configured zone',()=>{
 const rule={...defaultTiming,schedule:true,start:'23:00',end:'07:00',repeat:'weekdays'};
 const check=t=>scheduled(Date.parse(t),rule,'Asia/Hong_Kong');
 assert.equal(check('2026-11-06T22:59:00+08:00'),false);
 assert.equal(check('2026-11-07T06:59:00+08:00'),true);
 assert.equal(check('2026-11-07T07:00:00+08:00'),false);
 assert.equal(check('2026-11-09T02:00:00+08:00'),false);
});
