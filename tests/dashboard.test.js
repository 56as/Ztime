import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {completeLayout,defaultsFor,validateLayout} from '../shared/layout.js';
import {distribution,weekDays} from '../shared/dashboard.js';
import {aggregate,weekBounds,DEFAULT_SETTINGS} from '../shared/time.js';
import {createApp} from '../desktop/server.js';

test('legacy dashboard migration preserves edited cards and adds an editable header',()=>{
 const old={widgets:[{id:'apps',w:9,h:440,hidden:false,device:'windows'},{id:'phone',w:3,h:180,hidden:true}]};
 const before=JSON.stringify(old),layout=completeLayout(old);
 assert.equal(layout[0].id,'header');assert.equal(layout[1].id,'apps');assert.equal(layout[1].w,9);assert.equal(layout[1].device,'windows');assert.equal(layout[2].hidden,true);assert.equal(JSON.stringify(old),before);
 const hidden=layout.map(w=>w.id==='header'?{...w,hidden:true}:w);assert.equal(completeLayout({widgets:hidden})[0].hidden,true);
});
test('header dimensions and page identifiers are validated before saving',()=>{
 assert.equal(validateLayout({page:'week',widgets:[{id:'header',w:6,h:96,title:'本周'}]}),'weekLayout');
 assert.equal(validateLayout({widgets:[{id:'phone',w:6,h:185,timeFontSize:56,unitFontSize:28}]}),'layout');
 assert.throws(()=>validateLayout({widgets:[{id:'phone',w:6,h:185,unitFontSize:99}]}));
 assert.throws(()=>validateLayout({widgets:[{id:'phone',w:6,h:185,timeFontSize:'48px'}]}));
 assert.throws(()=>validateLayout({page:'settings',widgets:[]}));
 assert.throws(()=>validateLayout({widgets:[{id:'header',w:12,h:95}]}));
 assert.throws(()=>validateLayout({widgets:[{id:'phone',w:6,h:140},{id:'phone',w:6,h:140}]}));
 assert.throws(()=>validateLayout({widgets:[{id:'pie',w:13,h:300}]}));
 assert.throws(()=>validateLayout({widgets:[{id:'pie',w:6,h:300,title:'x'.repeat(41)}]}));
});
test('pie slices retain all duration in Other and apply device filter before percentages',()=>{
 const apps=Array.from({length:8},(_,i)=>({name:'App '+i,platform:i%2?'windows':'android',duration:(i+1)*60000}));
 const slices=distribution(apps,'all',5);assert.equal(slices.length,6);assert.equal(slices.at(-1).name,'其他');assert.equal(slices.reduce((n,s)=>n+s.value,0),36*60000);assert.ok(Math.abs(slices.reduce((n,s)=>n+s.share,0)-1)<1e-12);
 assert.equal(distribution(apps,'android',5).reduce((n,s)=>n+s.value,0),16*60000);assert.deepEqual(distribution([]),[]);
});
test('weekly chart uses matching elapsed days and conserves partial-hour durations',()=>{
 const now=Date.parse('2026-10-29T03:15:00Z'),w=weekBounds(now),devices=[{id:'p',platform:'android'}];
 const current=aggregate([{deviceId:'p',appId:'a',appName:'A',start:now-1800000,end:now}],w.start,w.end,devices);
 const previous=aggregate([{deviceId:'p',appId:'a',appName:'A',start:w.previousEnd-600000,end:w.previousEnd}],w.previous,w.previousEnd,devices);
 const days=weekDays({...w,current,previous},DEFAULT_SETTINGS);
 assert.equal(days.length,7);assert.equal(days.filter(d=>d.available).length,4);assert.equal(days.reduce((n,d)=>n+d.current.android,0),1800000);assert.equal(days.reduce((n,d)=>n+d.previous.android,0),600000);assert.equal(days[4].available,false);
});
test('today and weekly layouts save independently, including an intentionally hidden header',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ztime-layout-')),app=await createApp({dataDir:dir,collect:false,port:0,syncPort:0});
 try{
  const today=defaultsFor('home');today[0].hidden=true;
  const week=defaultsFor('week');week.find(w=>w.id==='pie').w=9;
  await app.route('PUT','/api/layout',{page:'home',widgets:today});await app.route('PUT','/api/layout',{page:'week',widgets:week});
  await app.route('PUT','/api/appearance',{theme:'dark',accentColor:'purple'});await assert.rejects(app.route('PUT','/api/appearance',{theme:'dark',accentColor:'unknown'}));
  const summary=await app.route('GET','/api/summary');assert.deepEqual(summary.appearance,{theme:'dark',accentColor:'purple'});assert.equal(summary.layout.widgets[0].hidden,true);assert.equal(summary.weekLayout.widgets[0].hidden,false);assert.equal(summary.layout.widgets.find(w=>w.id==='pie').w,6);assert.equal(summary.weekLayout.widgets.find(w=>w.id==='pie').w,9);
 }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
