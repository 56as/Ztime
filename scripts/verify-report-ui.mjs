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
 browser=await chromium.launch({channel:process.env.ZTIME_BROWSER||'msedge',headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(service.url);
 for(const tab of ['dashboard','devices','settings']){
  await page.click('[data-page='+tab+']');
  const size=await page.locator('.refresh-control:visible').first().evaluate(button=>{
   const icon=button.querySelector('svg').getBoundingClientRect();
   return [button.offsetWidth,button.offsetHeight,icon.width,icon.height];
  });
  assert.deepEqual(size,[36,36,18,18],tab+' refresh control');
 }
 await page.click('[data-page=settings]');await page.click('[data-action=delete-data]');
 assert.equal(await page.locator('#dialog .danger').isDisabled(),true);await page.click('#dialog [data-cancel]');
 assert.equal(await page.locator('#dialog').isVisible(),false);
 await page.click('[data-page=dashboard]');await page.click('[data-mode=week]');await page.locator('[data-tool=report]').filter({hasText:'周报'}).waitFor();
 assert.deepEqual(await page.locator('.dashboard-view .actions button').allTextContents(),['布局','周报','']);
 await page.click('[data-tool=report]');await page.locator('.report-image svg').waitFor();assert.match(await page.locator('.period-report').textContent(),/每日用时/);
 assert.ok(await page.locator('.report-image text').evaluateAll(labels=>labels.some(label=>/\d 小时$/.test(label.textContent))));
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
 await page.keyboard.press('Escape');
 await page.click('[data-scope=phone]');
 for(const [mode,title] of [['day','日报'],['week','周报'],['month','月报'],['year','年报']]){
  await page.click('[data-mode='+mode+']');
  const trigger=page.getByRole('button',{name:title,exact:true});
  await trigger.click();
  await page.locator('#dialog h2').filter({hasText:title+'预览'}).waitFor();
  assert.match(await page.locator('.period-report').innerText(),/手机/);
  assert.equal(await page.locator('.period-report>strong').innerText(),'0 分钟');
  for(const fmt of ['csv','txt','png','pdf']){
   const [dl]=await Promise.all([page.waitForEvent('download'),page.click('[data-save-report='+fmt+']')]);
   assert.ok(dl.suggestedFilename().startsWith('Ztime-'+title+'-'));
   const raw=fs.readFileSync(await dl.path());
   if(fmt==='csv'||fmt==='txt')assert.ok(!raw.includes('示例笔记'));
   else assert.equal(fmt==='png'?raw.subarray(1,4).toString():raw.subarray(0,5).toString(),fmt==='png'?'PNG':'%PDF-');
  }
  await page.keyboard.press('Escape');
 }
 const mobile=await browser.newPage({viewport:{width:390,height:692}});
 const fixture={native:true,devices:[{id:'local',name:'手机',platform:'android',local:true},{id:'new',name:'同名电脑',platform:'windows'},{id:'old',name:'同名电脑',platform:'windows'}],peers:[{id:'new',last_sync:now}],sessions:[],settings:service.store.get('settings'),collector:{state:'ready'}};
 await mobile.addInitScript(d=>{window.TimeLedgerNative={request(payload){const {id,path,body}=JSON.parse(payload);if(path==='/api/week-report')window.savedReport=body;queueMicrotask(()=>window.ledgerReceive(id,{ok:true,data:path.startsWith('/api/summary')?d:{}}));}};},fixture);
 const mobileAssets=[];mobile.on('request',r=>mobileAssets.push(new URL(r.url()).pathname));
 await mobile.goto(service.url);await mobile.click('[data-page=devices]');assert.equal(await mobile.locator('.device:visible').count(),2);assert.equal(await mobile.locator('[data-unpair]').getAttribute('data-unpair'),'new');
 await mobile.click('[data-history] summary');assert.equal(await mobile.locator('.device:visible').count(),3);
 await mobile.click('[data-page=dashboard]');await mobile.click('[data-mode=week]');await mobile.locator('[data-tool=report]').waitFor();
 const buttons=await mobile.locator('.dashboard-view .actions button').evaluateAll(els=>els.map(e=>[e.offsetTop,e.offsetLeft]));assert.ok(buttons.every(([y],i)=>y===buttons[0][0]&&(!i||buttons[i-1][1]<buttons[i][1])));
 await mobile.click('[data-tool=report]');assert.equal(await mobile.locator('#dialog [data-save-report]').count(),1);await mobile.click('[data-save-report=txt]');assert.match(await mobile.evaluate(()=>window.savedReport.content),/设备累计/);assert.deepEqual(errors,[]);assert.ok(!mobileAssets.some(p=>['/reports/desktop.js','/reports/chart.js','/reports/image-export.js','/shared/report-csv.js'].includes(p)),'Android text reporting loads no desktop exporter');
 console.log('Passed: desktop toolbar, four actual downloads, Android toolbar + text bridge, same-name pair/history separation.');
}finally{await browser?.close();await service.close();fs.rmSync(tmp,{recursive:true,force:true});}

