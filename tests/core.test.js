import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import dgram from 'node:dgram';
import {DEFAULT_SETTINGS,dateKey,dayBounds,weekBounds,aggregate} from '../shared/time.js';
import {Store} from '../desktop/store.js';
import {Collector} from '../desktop/collector.js';
import {createApp} from '../desktop/server.js';

test('04:00 splits the calendar day correctly',()=>{assert.equal(dateKey(Date.parse('2026-10-28T19:59:59Z')),'2026-10-28');assert.equal(dateKey(Date.parse('2026-10-28T20:00:00Z')),'2026-10-29');});
test('DST day uses wall-time boundaries rather than fixed 24h subtraction',()=>{const settings={...DEFAULT_SETTINGS,dayStart:0,timeZone:'Europe/Berlin'};const short=dayBounds('2026-03-29',settings),long=dayBounds('2026-10-25',settings);assert.equal(short.end-short.start,23*3600000);assert.equal(long.end-long.start,25*3600000);});
test('weekly comparison ends at the same local weekday and time',()=>{const now=Date.parse('2026-10-28T07:35:00.789Z');const w=weekBounds(now);assert.equal(new Date(w.start).toISOString(),'2026-10-25T20:00:00.000Z');assert.equal(new Date(w.previousEnd).toISOString(),'2026-10-21T07:35:00.789Z');assert.equal(w.end,now);});
test('aggregation clips across day boundary and preserves overlapping devices',()=>{const devices=[{id:'pc',platform:'windows'},{id:'phone',platform:'android'}];const sessions=[{deviceId:'pc',appId:'word',appName:'Word',start:0,end:3600000},{deviceId:'phone',appId:'chat',appName:'聊天',start:3000000,end:4200000}];const result=aggregate(sessions,3300000,7200000,devices);assert.equal(result.totals.windows,300000);assert.equal(result.totals.android,900000);assert.equal(result.apps.length,2);assert.equal(result.bins.reduce((n,b)=>n+b.android+b.windows,0),1200000);});
test('same record replay cannot inflate totals, deletion tombstones survive stale re-import',()=>{const db=new Store(':memory:');const now=Date.now();const source={id:randomUUID(),deviceId:'phone',appId:'chat',appName:'Chat',start:now-60000,end:now,sourceSeq:1};db.importChanges([source],'phone');db.importChanges([source],'phone');assert.equal(db.sessions().length,1);assert.equal(db.sessions()[0].end-db.sessions()[0].start,60000);db.markDeleted(source.id);db.importChanges([{...source,sourceSeq:2,end:now+100}],'phone');assert.ok(db.sessions()[0].deletedAt);db.close();});
test('sync ownership rejects writing other devices and rejects malformed records atomically',()=>{const db=new Store(':memory:');const s={id:'one',deviceId:'phone',appId:'a',appName:'A',start:0,end:1,sourceSeq:1};assert.throws(()=>db.importChanges([s,{...s,id:'two',deviceId:'computer'}],'phone'));assert.equal(db.sessions().length,0);assert.throws(()=>db.importChanges([{...s,end:-1}],'phone'));db.close();});
test('settings divergence becomes visible conflict instead of silent overwrite',()=>{const db=new Store(':memory:');const local=db.updateSettings({dayStart:5,timeZone:'Asia/Hong_Kong'});const remote={...local,dayStart:6,revision:'remote',baseRevision:'default'};assert.equal(db.receiveSettings(remote),true);assert.equal(db.get('settings').dayStart,5);assert.equal(db.get('settingsConflict').dayStart,6);db.close();});
test('explicit conflict resolution converges on both devices without repeated prompts',()=>{const a=new Store(':memory:'),b=new Store(':memory:');a.updateSettings({dayStart:5,timeZone:'Asia/Hong_Kong'});b.updateSettings({dayStart:6,timeZone:'Asia/Hong_Kong'});a.receiveSettings(b.get('settings'));a.resolveSettings('local');a.receiveSettings(b.get('settings'));assert.equal(a.get('settingsConflict'),null);b.receiveSettings(a.get('settings'));assert.equal(b.get('settings').dayStart,5);a.receiveSettings(b.get('settings'));assert.equal(a.get('settingsConflict'),null);a.close();b.close();});
test('collector keeps counting without input, splits on switch and stops at lock',()=>{const db=new Store(':memory:'),c=new Collector(db),t=Date.now()-10000;c.sample({state:'active',appId:'word',appName:'Word'},t);c.sample({state:'active',appId:'word',appName:'Word'},t+3000);c.sample({state:'active',appId:'browser',appName:'Browser'},t+6000);c.sample({state:'locked'},t+9000);const sessions=db.sessions();assert.equal(sessions.find(s=>s.appId==='word').end-t,6000);assert.equal(sessions.find(s=>s.appId==='browser').end-(t+6000),3000);assert.equal(c.active,null);db.close();});
test('collector never fills sleep/crash gaps with foreground time',()=>{const db=new Store(':memory:'),c=new Collector(db),t=Date.now()-120000;c.sample({state:'active',appId:'a',appName:'A'},t);c.sample({state:'active',appId:'a',appName:'A'},t+1000);c.sample({state:'active',appId:'a',appName:'A'},t+60000);assert.equal(db.sessions().length,2);assert.equal(db.sessions().reduce((n,s)=>n+s.end-s.start,0),1000);db.close();});
function post(port,route,body,token){return new Promise((resolve,reject)=>{const req=https.request({host:'127.0.0.1',port,path:route,method:'POST',rejectUnauthorized:false,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})}},res=>{let str='';res.on('data',x=>str+=x);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(str)}));});req.on('error',reject);req.end(JSON.stringify(body));});}
test('local service rejects DNS-rebinding Host headers',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-host-')),app=await createApp({dataDir:dir,collect:false,port:0,syncPort:0});try{const status=await new Promise((resolve,reject)=>{http.get(app.url,{headers:{host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(status,403);}finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}});
test('LAN discovery returns identity and nonce, never activity records',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-discovery-')),app=await createApp({dataDir:dir,collect:false,port:0,syncPort:0}),socket=dgram.createSocket('udp4');try{await new Promise(r=>setTimeout(r,15));const nonce=randomUUID();const reply=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Discovery timeout')),1500);socket.once('message',message=>{clearTimeout(timer);resolve(JSON.parse(message.toString()));});socket.send(Buffer.from(JSON.stringify({service:'time-ledger',type:'discover',nonce})),app.sync.discovery.address().port,'127.0.0.1');});assert.equal(reply.nonce,nonce);assert.equal(reply.deviceId,app.store.device.id);assert.equal(reply.pin,app.sync.pin);assert.equal(reply.sessions,undefined);assert.equal(reply.token,undefined);}finally{socket.close();await app.close();fs.rmSync(dir,{recursive:true,force:true});}});
test('HTTPS pairing requires desktop approval; pinned identity, retry and authenticated sync',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-test-'));const app=await createApp({dataDir:dir,collect:false,port:0,syncPort:0});try{app.sync.addresses=()=>['192.168.1.12'];const invitation=await app.route('POST','/api/pair');assert.match(invitation.pin,/^[a-f0-9]{64}$/);const device={id:'test-phone',name:'Test Android',platform:'android'};assert.equal((await post(app.sync.port,'/v1/pair',{device,code:'000000'})).status,403);const request=await post(app.sync.port,'/v1/pair',{device,code:invitation.code});const poll={id:request.data.id,pollSecret:request.data.pollSecret};assert.equal((await post(app.sync.port,'/v1/pair/status',poll)).data.status,'pending');app.sync.approve(request.data.id,true);const approved=await post(app.sync.port,'/v1/pair/status',poll);assert.ok(approved.data.token);assert.equal((await post(app.sync.port,'/v1/pair/status',poll)).data.token,approved.data.token);const body={device,changes:[],cursor:0,settings:DEFAULT_SETTINGS};assert.equal((await post(app.sync.port,'/v1/sync',body)).status,401);assert.equal((await post(app.sync.port,'/v1/sync',body,approved.data.token)).status,200);assert.equal((await post(app.sync.port,'/v1/sync',{...body,device:{...device,id:'spoofed'}},approved.data.token)).status,403);}finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}});
test('loopback UI API rejects absent cookies and cross-origin mutations; layout persists',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-ui-'));const app=await createApp({dataDir:dir,collect:false,port:0,syncPort:0});try{assert.equal((await fetch(app.url+'/api/summary')).status,401);const index=await fetch(app.url);const cookie=index.headers.get('set-cookie').split(';')[0];const headers={cookie,'content-type':'application/json'};assert.equal((await fetch(app.url+'/api/pause',{method:'POST',headers:{...headers,origin:'https://evil.example'},body:'{"paused":true}'})).status,403);const widgets=[{id:'phone',w:6,h:180,hidden:false}];assert.equal((await fetch(app.url+'/api/layout',{method:'PUT',headers,body:JSON.stringify({widgets})})).status,200);assert.deepEqual(app.store.get('layout').widgets,widgets);assert.equal((await fetch(app.url+'/api/layout',{method:'PUT',headers,body:JSON.stringify({widgets:[...widgets,...widgets]})})).status,400);}finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}});

test('desktop request waits for a paired phone to finish both directions before reporting success', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ztime-sync-request-'));
  const app = await createApp({dataDir:dir, collect:false, port:0, syncPort:0});
  const phone = new Store(':memory:', 'android', 'Test phone');
  try {
    await assert.rejects(app.route('POST','/api/sync'), /先用手机扫码/);
    app.sync.addresses = () => ['192.168.1.10'];
    const invite = await app.sync.createInvite();
    const device = phone.device;
    const send = (url, body, token) => post(app.sync.port,url,body,token);
    const request = (await send('/v1/pair',{device,code:invite.code})).data;
    app.sync.approve(request.id,true);
    const {token} = (await send('/v1/pair/status',request)).data;
    const call = (url,fields={}) => send(url,{device,...fields},token);
    const usage = {appId:'reader',appName:'Reader',start:1000,end:61000};
    phone.write({...usage,id:'phone-record',deviceId:device.id});
    app.store.write({...usage,id:'pc-record',deviceId:app.store.device.id});
    assert.equal((await send('/v1/sync/wait',{device})).status,401);
    app.store.write({...usage,id:'other-phone-record',deviceId:'other-phone'});
    app.store.markDeleted('other-phone-record');
    const listening = call('/v1/sync/wait');
    const clicked = app.route('POST','/api/sync');
    const repeatClick = app.route('POST','/api/sync');
    const {requestId} = (await listening).data;
    assert.ok(requestId);
    const page = (await call('/v1/sync',{cursor:0,changes:phone.changes(),confirmSync:true})).data;
    assert.equal(page.requestId,requestId);
    assert.equal(app.store.db.prepare('SELECT last_sync FROM peers').get().last_sync,0);
    phone.importChanges(page.changes,app.store.device.id);
    assert.deepEqual(phone.sessions().map(s=>s.id).sort(),app.store.sessions().filter(s=>!s.deletedAt).map(s=>s.id).sort());
    assert.ok(!page.changes.some(s=>s.id==='other-phone-record'));
    const ack = await call('/v1/sync/complete',{requestId,changed:true});
    assert.equal(ack.status,200);
    assert.equal((await clicked).message,'同步完成');
    assert.deepEqual(await clicked,await repeatClick);
    const nextClick = app.route('POST','/api/sync');
    const next = (await call('/v1/sync/wait')).data;
    assert.notEqual(next.requestId,requestId);
    await call('/v1/sync/complete',{requestId,changed:true});
    const replay = (await call('/v1/sync',{cursor:page.cursor,changes:[],confirmSync:true})).data;
    assert.equal(replay.requestId,next.requestId);
    assert.deepEqual(replay.changes,[]);
    await call('/v1/sync/complete',{requestId:next.requestId,changed:false});
    assert.equal((await nextClick).message,'已是最新');
    const lastSync=app.store.db.prepare('SELECT last_sync FROM peers').get().last_sync;
    await assert.rejects(app.sync.requestSync(20),/未收到确认/);
    assert.equal(app.store.db.prepare('SELECT last_sync FROM peers').get().last_sync,lastSync);
    const pending=app.sync.requestSync();
    await app.route('DELETE','/api/peer',{id:device.id});
    await assert.rejects(pending,/未收到确认/);
    assert.equal((await call('/v1/sync/wait')).status,401);
  } finally {
    phone.close();await app.close();fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('period details include every overlapping session even with over 500 newer records', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ztime-old-details-'));
  const app=await createApp({dataDir:dir,collect:false,port:0,syncPort:0});
  try {
    const deviceId=app.store.device.id;
    app.store.transaction(()=>{
      for(let i=0;i<1010;i++)app.store.write({id:String(i),deviceId,appId:'reader',appName:'Reader',start:2*i,end:2*i+2});
    });
    const records=await app.route('GET','/api/sessions?appId=reader&deviceId='+deviceId+'&start=1&end=1004');
    assert.equal(records.length,502);
    assert.equal(records[0].id,'501');
    assert.equal(records.at(-1).id,'0');
  } finally {await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
