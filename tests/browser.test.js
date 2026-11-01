import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../desktop/store.js';
import {Collector} from '../desktop/collector.js';
import {BrowserBridge} from '../desktop/browser-bridge.js';

test('extension reports are opt-in, scoped to the foreground browser and split time without inflating totals', async () => {
 const store=new Store(':memory:');
 const bridge=new BrowserBridge(store,0);
 try {
  assert.equal(bridge.status().enabled,false);
  const {token}=await bridge.configure(true);
  const url='http://127.0.0.1:'+bridge.server.address().port+'/context';
  const report=(host,origin='chrome-extension://'+'a'.repeat(32),key=token)=>fetch(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+key},body:JSON.stringify({app:'chrome.exe',client:'test-client',host})});
  assert.equal((await report('example.org','https://example.org')).status,403);
  assert.equal((await report('example.org',undefined,'invalid')).status,401);
  assert.equal((await report('example.org/private?query=x')).status,400);
  assert.equal((await report('example.org')).status,200);
  const collector=new Collector(store,(app,now)=>bridge.hostFor(app,now));
  const t=Date.now();
  const sample=(app,offset)=>collector.sample({state:'active',appId:app,appName:app},t+offset);
  sample('chrome.exe',0);sample('chrome.exe',1000);
  assert.equal((await report('example.net')).status,200);
  sample('chrome.exe',2000);sample('msedge.exe',3000);sample('msedge.exe',4000);
  const sessions=store.sessions();
  assert.equal(sessions.reduce((sum,s)=>sum+s.end-s.start,0),4000);
  assert.deepEqual(sessions.map(s=>s.site),[null,'example.net','example.org']);
  assert.equal(store.changes(0).filter(s=>s.site).length,2);
  assert.equal(bridge.hostFor('chrome.exe',t+50000),null);
  await bridge.configure(true);assert.equal((await report('example.org')).status,401);
  await bridge.configure(false);assert.equal(bridge.hostFor('chrome.exe',Date.now()),null);
 } finally {bridge.close();store.close();}
});
