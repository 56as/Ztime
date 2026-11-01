import test from 'node:test';
import assert from 'node:assert/strict';
import {periodStats,periodBounds} from '../shared/period.js';
import {DEFAULT_SETTINGS,dayBounds} from '../shared/time.js';

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
