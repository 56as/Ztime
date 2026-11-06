import test from 'node:test';
import assert from 'node:assert/strict';
import {periodStats,periodBounds} from '../shared/period.js';
import {DEFAULT_SETTINGS,dayBounds} from '../shared/time.js';
import {adjacentPeriod,previousYearPeriod,num,iso} from '../web/period-calendar.js';

test('calendar navigation clips custom ranges to the month and leap day to the prior year',()=>{
 const range=(from,to)=>[num(from),num(to)];
 assert.deepEqual(previousYearPeriod(range('2024-01-01','2024-02-29')).map(iso),['2023-01-01','2023-02-28']);
 assert.deepEqual(adjacentPeriod('custom',range('2024-03-01','2024-03-31'),false,num('2024-04-04')).map(iso),['2024-02-01','2024-02-29']);
 assert.deepEqual(adjacentPeriod('custom',range('2024-03-01','2024-03-31'),true,num('2024-04-04')).map(iso),['2024-04-01','2024-04-04']);
});

test('yearly bins split at the configured month boundary and conserve overlapping device time',()=>{
 const edge=dayBounds('2024-03-01',DEFAULT_SETTINGS).start;
 const rows=['pc','phone'].map(deviceId=>({appId:'reader',appName:'阅读',deviceId,start:edge-60000,end:edge+120000}));
 const devices=[{id:'pc',platform:'windows'},{id:'phone',platform:'android'}];
 for(const [scope,n] of [['all',2],['android',1]]){
   const stats=periodStats(rows,devices,DEFAULT_SETTINGS,'2024-01-01','2024-12-31','year',scope);
   assert.equal(stats.days,366);assert.equal(stats.bins.length,12);
   assert.equal(stats.bins[1].duration,n*60000);assert.equal(stats.bins[2].duration,n*120000);
   assert.equal(stats.apps.reduce((v,a)=>v+a.duration,0),stats.total);
 }
});
test('day chart covers the DST fallback and respects the current time',()=>{
 const settings={...DEFAULT_SETTINGS,dayStart:0,timeZone:'America/New_York'};
 const now=dayBounds('2024-11-03',settings).end-60000;
 const stats=periodStats([],[],settings,'2024-11-03','2024-11-03','day','all',now);
 assert.equal(stats.bins.length,25);assert.equal(stats.end,now);
 assert.throws(()=>periodBounds('2024-02-30','2024-03-01',settings,now));
});

import {desktopLayout,validDesktopLayout} from '../shared/desktop-card-layout.js';
test('desktop layout upgrades an existing choice without overwriting order or enabled cards',()=>{
 const saved=[{key:'compare',visible:true},{key:'trend',visible:false},{key:'ranking',visible:true}];
 const next=desktopLayout(saved);
 assert.deepEqual(next.slice(0,3),saved);assert.ok(next.slice(3).every(r=>!r.visible));
 assert.deepEqual(desktopLayout().filter(r=>r.visible).map(r=>r.key),['trend','ranking']);
 assert.ok(validDesktopLayout(next));assert.equal(validDesktopLayout([...next.slice(1),next[1]]),false);
});


import {ringWindowUsage} from '../web/desktop-insights.js';
test('replay usage clips to the visible window and keeps same-name apps and devices separate',()=>{
 const row={name:'Editor',device:'pc',deviceId:'a',appId:'editor'};
 const sessions=[
  {...row,start:30,end:70},
  {...row,start:90,end:100},
  {...row,appId:'other',start:60,end:80},
  {...row,deviceId:'b',start:60,end:90},
  {...row,start:0,end:60},
  {...row,start:180,end:200}
 ];
 const usage=ringWindowUsage(sessions,60,180);
 assert.deepEqual(usage.map(r=>r.minutes),[30,20,20]);
 assert.equal(usage.find(r=>r.deviceId==='a'&&r.appId==='editor').minutes,20);
 assert.equal(ringWindowUsage([{...row,start:1430,end:1500}],1440,1500)[0].minutes,60);
 assert.deepEqual(ringWindowUsage(sessions,300,420),[]);
});
