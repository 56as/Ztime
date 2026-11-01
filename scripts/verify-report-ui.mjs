import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createApp} from '../desktop/server.js';
const req=createRequire(import.meta.url),{chromium}=req(process.env.PLAYWRIGHT_PATH||req.resolve('playwright',{paths:[process.cwd(),path.dirname(process.execPath)]}));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ztime-report-test-'));
const service=await createApp({dataDir:tmp,collect:false,port:0,syncPort:0});
let browser;
try{
 const now=Date.now(),w=service.store.summary().week;
 for(const [i,h] of [2,1,.5].entries()){
  const start=w.start+i*86400000+60000;if(start>=now)continue;
  service.store.write({id:'sample'+i,deviceId:service.store.device.id,appId:'notes',appName:'=示例笔记',start,end:Math.min(now,start+h*3600000),site:'private.example'});
 }
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(service.url);
 await page.click('[data-page=week]');
 assert.deepEqual(await page.locator('.header-main .actions button').allTextContents(),['导出周报',' 更新',' 编辑']);
 await page.click('[data-action=week-report]');await page.locator('.report-image svg').waitFor();assert.match(await page.locator('.report-image').textContent(),/本周观察/);
 const preview=await page.locator('.report-image').boundingBox(), formats=await page.locator('.report-formats').boundingBox();
 assert.ok(formats.y>=preview.y+preview.height,'export actions below recap');
 const out=process.env.ZTIME_REPORT_QA_DIR||tmp;fs.mkdirSync(out,{recursive:true});
 for(const fmt of ['txt','csv','pdf','png']){
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:10000}),page.click('[data-save-report='+fmt+']')]);
  assert.equal(dl.suggestedFilename(),`Ztime-周报-${w.first}.${fmt}`);const dest=path.join(out,'sample.'+fmt);await dl.saveAs(dest);
  const raw=fs.readFileSync(dest);assert.ok(raw.length>100);assert.ok(!raw.includes('private.example'));
  if(fmt==='csv'){assert.match(raw.toString(),/本期分钟/);if(now>w.start+60000)assert.match(raw.toString(),/"'=示例笔记"/);}
  if(fmt==='png')assert.equal(raw.subarray(1,4).toString(),'PNG');if(fmt==='pdf')assert.equal(raw.subarray(0,5).toString(),'%PDF-');
 }
 const mobile=await browser.newPage({viewport:{width:390,height:692}});
 const fixture={native:true,devices:[{id:'local',name:'手机',platform:'android',local:true},{id:'new',name:'同名电脑',platform:'windows'},{id:'old',name:'同名电脑',platform:'windows'}],peers:[{id:'new',last_sync:now}],sessions:[],settings:service.store.get('settings'),collector:{state:'ready'}};
 await mobile.addInitScript(d=>{window.TimeLedgerNative={request(payload){const {id,path,body}=JSON.parse(payload);if(path==='/api/week-report')window.savedReport=body;queueMicrotask(()=>window.ledgerReceive(id,{ok:true,data:path.startsWith('/api/summary')?d:{}}));}};},fixture);
 const mobileAssets=[];mobile.on('request',r=>mobileAssets.push(new URL(r.url()).pathname));
 await mobile.goto(service.url);await mobile.click('[data-page=devices]');assert.equal(await mobile.locator('.device:visible').count(),2);assert.equal(await mobile.locator('[data-unpair]').getAttribute('data-unpair'),'new');
 await mobile.click('[data-history] summary');assert.equal(await mobile.locator('.device:visible').count(),3);
 await mobile.click('[data-page=week]');
 const buttons=await mobile.locator('.header-main .actions button').evaluateAll(els=>els.map(e=>[e.offsetTop,e.offsetLeft]));assert.ok(buttons.every(([y],i)=>y===buttons[0][0]&&(!i||buttons[i-1][1]<buttons[i][1])));
 await mobile.click('[data-action=week-report]');assert.equal(await mobile.locator('#dialog [data-save-report]').count(),1);await mobile.click('[data-save-report=txt]');assert.match(await mobile.evaluate(()=>window.savedReport.content),/设备累计/);assert.deepEqual(errors,[]);assert.ok(!mobileAssets.some(p=>['/reports/desktop.js','/reports/chart.js','/reports/image-export.js','/shared/report-csv.js'].includes(p)),'Android text reporting loads no desktop exporter');
 console.log('Passed: desktop toolbar, four actual downloads, Android toolbar + text bridge, same-name pair/history separation.');
}finally{await browser?.close();await service.close();fs.rmSync(tmp,{recursive:true,force:true});}

