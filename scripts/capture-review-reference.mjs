import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';

// Capture the packaged renderer with disposable example data. Never open the user's ledger.
const bundle=path.resolve('dist/TimeLedger-windows-x64/resources/app');
const version=JSON.parse(readFileSync(path.join(bundle,'package.json'),'utf8')).version;
const {createApp}=await import(pathToFileURL(path.join(bundle,'desktop/server.js')));
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[process.cwd(),path.dirname(process.execPath)]}));
const temp=mkdtempSync(path.join(os.tmpdir(),'ztime-reference-'));
const service=await createApp({dataDir:temp,port:0,syncPort:0,browserPort:0,collect:false,version,autostart:{get:()=>true}});
let browser;
try{
 const {store}=service;
 const device={...store.device,name:'示例电脑'};store.device=device;store.set('device',device);store.upsertDevice(device);
 store.upsertDevice({id:'phone-demo',name:'示例手机',platform:'android'});
 store.set('collector',{state:'active',appName:'Notes'});
 for(let day=0;day<20;day++)for(const [i,name] of ['Notes','ChatGPT','微信'].entries()){
  const end=Date.now()-(day*1440+(2-i)*60)*60000;
  store.write({id:day+'-'+i,deviceId:i===2?'phone-demo':device.id,appId:['notes.exe','chatgpt.exe','com.tencent.mm'][i],appName:name,start:end-(12+(day+i)*7%37)*60000,end});
 }
 browser=await chromium.launch({channel:process.env.ZTIME_BROWSER||'msedge'});
 const page=await browser.newPage({viewport:{width:1280,height:824},reducedMotion:'reduce'});
 await page.route('**/api/summary*',async route=>{const r=await route.fetch(),s=await r.json();s.sync.addresses=['192.0.2.1'];await route.fulfill({response:r,json:s});});
 await page.goto(service.url);
 const out=path.resolve('design/review/reference',version);
 mkdirSync(out,{recursive:true});
 const shot=async key=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,key+'.png'),animations:'disabled'});};
 for(const mode of ['day','week','month','year']){
  await page.locator('[data-mode='+mode+']').click();
  await page.locator('#period-view[aria-busy=false] .desktop-rank-row').first().waitFor();
  await page.locator('.desktop-rank-row img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  await shot(mode);
  if(mode==='day'){
   await page.locator('[data-chart=ringdesk]').click();
   await page.locator('#replay-instrument').waitFor();
   await shot('dial');
   await page.locator('[data-chart=line]').click();
  }
  await page.locator('[data-tool=report]').click();
  await page.locator('#dialog[open] .report-image svg').waitFor();
  await shot(mode+'-report');await page.keyboard.press('Escape');
 }
 for(const [key,ready] of [['behavior','#behavior-view:not([aria-busy]) #purpose-chart'],['devices','#extension-settings, [data-action=pair]'],['settings','#timeZone + .desktop-choice-wheel']]){
  await page.locator('[data-page='+key+']').click();await page.locator(ready).first().waitFor();await shot(key);
 }
 console.log('Windows '+version+' → '+out);
}finally{await browser?.close();await service.close();rmSync(temp,{recursive:true,force:true});}
