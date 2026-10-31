import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {Store} from '../desktop/store.js';
import {dateKey,dayBounds,addDays,wallTime} from '../shared/time.js';
import {defaultsFor} from '../shared/layout.js';

const require=createRequire(import.meta.url),{_electron}=require(process.env.PLAYWRIGHT_PATH||require.resolve('playwright',{paths:[process.cwd(),path.dirname(process.execPath)]}));
const root=process.cwd(),out=path.join(root,'dist','Ztime-desktop-demo.mp4');
const work=fs.mkdtempSync(path.join(root,'artifacts','video-demo-')),data=path.join(work,'data'),framesDir=path.join(work,'frames');fs.mkdirSync(data);fs.mkdirSync(framesDir);
const db=new Store(path.join(data,'ledger.sqlite'));
db.device.name='Windows 演示电脑';db.set('device',db.device);db.upsertDevice(db.device);db.upsertDevice({id:'demo-phone',name:'Android 演示设备',platform:'android'});
db.set('paused',true);db.set('collector',{state:'active',appName:'Visual Studio Code'});db.set('appearance',{theme:'light',accentColor:'blue'});
const settings=db.get('settings'),today=dateKey(Date.now(),settings);
const computer=[['code.exe','Visual Studio Code',8,0,120],['chrome.exe','Chrome',10,15,45],['figma.exe','Figma',11,15,60],['code.exe','Visual Studio Code',13,15,55],['terminal.exe','Terminal',14,30,35],['chrome.exe','Chrome',15,30,45],['obsidian.exe','Obsidian',16,45,30],['figma.exe','Figma',17,40,30],['code.exe','Visual Studio Code',19,0,25]];
const phone=[['com.wechat','微信',8,20,20],['com.reader','阅读',10,55,25],['com.bilibili','哔哩哔哩',12,5,45],['com.wechat','微信',14,30,20],['com.browser','浏览器',17,50,20],['com.reader','阅读',20,0,30]];
for(let day=-13;day<=0;day++){
 const date=addDays(today,day),factor=day===0?1:.65+((day+14)*3%7)*.05;
 for(const [deviceId,apps]of[[db.device.id,computer],['demo-phone',phone]])for(const [appId,appName,hour,minute,length]of apps){const start=wallTime(date,hour,settings.timeZone)+minute*60000,end=Math.min(start+Math.round(length*factor)*60000,Date.now());if(end>start)db.write({id:randomUUID(),deviceId,appId,appName,start,end});}
}
for(const page of ['home','week']){const widgets=defaultsFor(page);widgets.find(w=>w.id==='pie').count=5;widgets.find(w=>w.id==='apps').count=5;db.set(page==='home'?'layout':'weekLayout',{widgets});}
db.close();
const exe=path.join(root,'dist','TimeLedger-windows-x64','Ztime.exe');
let app,recording=false,capturePromise,frames=[],errors=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 app=await _electron.launch({executablePath:exe,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'],cwd:root,env:{...process.env,TIME_LEDGER_DATA_DIR:data,TIME_LEDGER_HEADLESS:'1'}});
 const page=await app.firstWindow();await app.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows()){win.webContents.setBackgroundThrottling(false);win.showInactive();}});await page.addInitScript(()=>{const interval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>ms===5000?0:interval(fn,ms,...args);});await page.reload();page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:810,deviceScaleFactor:4/3,mobile:false});
 await page.locator('[data-widget="pie"] .pie-visual').waitFor();await page.emulateMedia({colorScheme:'light'});
 await page.evaluate(()=>{
  const style=document.createElement('style');style.textContent=`html{scroll-behavior:smooth;scrollbar-width:none}html::-webkit-scrollbar{display:none}#demo-cursor{opacity:0;position:fixed;left:960px;top:540px;width:24px;height:30px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px #0004);transform:translate(-2px,-2px)}#demo-pulse{position:fixed;width:44px;height:44px;border-radius:50%;border:2px solid #007aff;z-index:2147483646;pointer-events:none;opacity:0}#demo-chapter{position:fixed;left:28px;bottom:26px;padding:14px 20px;border-radius:15px;background:#fffffff0;box-shadow:0 6px 30px #00000012;z-index:2147483644;pointer-events:none;font:500 17px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;color:#1d1d1f;backdrop-filter:blur(12px)}#demo-chapter small{font-size:12px;color:#6e6e73;margin-left:12px}#demo-data{position:fixed;right:22px;top:12px;border-radius:7px;background:#e9ebee;color:#62646a;padding:4px 9px;z-index:2147483643;font:11px "Segoe UI","Microsoft YaHei",sans-serif;pointer-events:none}#demo-intro{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#f5f5f7e8;backdrop-filter:blur(10px);z-index:2147483645;transition:opacity .55s;pointer-events:none;color:#1d1d1f;font-family:"Segoe UI","Microsoft YaHei",sans-serif}#demo-intro strong{font-size:76px;letter-spacing:-3px;font-weight:650}#demo-intro p{font-size:20px;color:#6e6e73;margin-top:10px}`;document.head.append(style);
  document.body.insertAdjacentHTML('beforeend','<div id="demo-cursor"><svg viewBox="0 0 24 30"><path d="M3 2v23l6-6 5 9 4-2-5-9h9z" fill="#1d1d1f" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg></div><div id="demo-pulse"></div><div id="demo-chapter">Ztime <small>桌面端功能展示</small></div><div id="demo-data">演示数据</div><div id="demo-intro"><strong>Ztime</strong><p>桌面端功能展示</p></div>');
  window.addEventListener('mousemove',e=>{const el=document.querySelector('#demo-cursor');el.style.left=e.clientX+'px';el.style.top=e.clientY+'px';});
  window.addEventListener('mousedown',e=>{const el=document.querySelector('#demo-pulse');el.style.left=e.clientX-22+'px';el.style.top=e.clientY-22+'px';el.getAnimations().forEach(a=>a.cancel());el.animate([{opacity:.8,transform:'scale(.4)'},{opacity:0,transform:'scale(1.5)'}],{duration:550,easing:'ease-out'});});
 });
 const move=async(selector,duration=450)=>{const locator=page.locator(selector);await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();if(!box)throw new Error('Missing target '+selector);await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:Math.max(5,Math.round(duration/25))});return locator;};
 const click=async(selector)=>{const el=await move(selector);await sleep(180);await el.click();await sleep(250);};
 const chapter=async(n,title)=>page.evaluate(({n,title})=>{document.querySelector('#demo-chapter').innerHTML=`<span>${n} · ${title}</span><small>Ztime</small>`;},{n,title});
 const scroll=async(y)=>{await page.evaluate(y=>window.scrollTo({top:y,behavior:'smooth'}),y);await sleep(750);};
 await page.screenshot({path:path.join(work,'preview.jpg'),type:'jpeg',quality:90,scale:'device'});
 if(process.argv.includes('--preview')){const times=[];for(let i=0;i<5;i++){const t=performance.now();await page.screenshot({path:path.join(work,'benchmark-'+i+'.jpg'),type:'jpeg',quality:88,scale:'device'});times.push(Math.round(performance.now()-t));}console.log(JSON.stringify({preview:path.join(work,'preview.jpg'),work,screenshotMs:times}));}
 else{
  const begin=performance.now();recording=true;
  capturePromise=(async()=>{let i=0;while(recording){const t=performance.now()-begin,file=path.join(framesDir,String(i).padStart(5,'0')+'.jpg');await page.screenshot({path:file,type:'jpeg',quality:88,scale:'device'});frames.push({file,t});i++;const delay=i*1000/12-(performance.now()-begin);if(delay>0)await sleep(delay);}})();
  const at=async(seconds)=>{const remaining=seconds*1000-(performance.now()-begin);if(remaining>0)await sleep(remaining);};
  await at(2);await page.evaluate(()=>document.querySelector('#demo-intro').style.opacity='0');await chapter('01','今日总览');
  await at(3);await page.evaluate(()=>document.querySelector('#demo-cursor').style.opacity='1');await move('[data-widget="phone"] .metric');await at(4.5);await move('[data-widget="computer"] .metric');await at(6);await move('[data-widget="pie"] .pie-visual');
  await at(8);await click('[data-page="week"]');await chapter('02','每周对比');
  await at(10);await move('[data-widget="apps"]');await at(12);await scroll(640);await move('[data-widget="hours"] .chart');await at(16);await scroll(0);
  await at(18);await click('[data-page="home"]');await click('[data-action="edit"]');await chapter('03','自由编辑布局');
  await at(21);await page.evaluate(()=>window.scrollTo(0,0));await sleep(300);
  const resize=await move('[data-widget="phone"] .resize-handle'),box=await resize.boundingBox();await page.mouse.down();await page.mouse.move(box.x+150,box.y+65,{steps:28});await page.mouse.up();
  await at(24);await page.locator('[data-width="computer"]').selectOption('5');
  await at(25);await move('[data-typography="phone"][data-size-key="unitFontSize"]');await page.locator('[data-typography="phone"][data-size-key="unitFontSize"]').selectOption('28');
  await at(27);await scroll(520);const handle=await move('[data-widget="pie"] .drag-handle');await handle.dragTo(page.locator('[data-widget="apps"]')); 
  await at(30);await click('[data-action="save-layout"]');await scroll(0);await chapter('03','布局与字号独立保存');
  await at(33);await click('[data-page="settings"]');await chapter('04','八种主题配色');
  await page.locator('.accent-picker').scrollIntoViewIfNeeded();await at(36);await click('.accent-choice[data-accent="green"]');await at(38);await click('.accent-choice[data-accent="purple"]');await at(40);await click('.accent-choice[data-accent="amber"]');
  await at(42);await move('#theme');await page.locator('#theme').selectOption('dark');await chapter('04','浅色与深色外观');
  await at(46);await move('#theme');await page.locator('#theme').selectOption('light');await click('.accent-choice[data-accent="blue"]');
  await at(49);await click('[data-page="home"]');await scroll(0);await chapter('05','按自己的习惯记录时间');
  await at(52);await page.evaluate(()=>{document.querySelector('#demo-cursor').style.opacity='0';const el=document.querySelector('#demo-intro');el.querySelector('p').textContent='今日 · 每周 · 自由布局 · 主题配色';el.style.opacity='1';});
  await at(55);recording=false;await capturePromise;
  if(errors.length)throw new Error(errors.join(' | '));
  const end=(performance.now()-begin)/1000,concat=frames.map((frame,i)=>`file '${frame.file.replaceAll('\\','/')}'\nduration ${Math.max(.001,((frames[i+1]?.t??end*1000)-frame.t)/1000).toFixed(6)}`).join('\n')+`\nfile '${frames.at(-1).file.replaceAll('\\','/')}'\n`;
  const list=path.join(work,'frames.txt');fs.writeFileSync(list,concat);fs.writeFileSync(path.join(work,'capture.json'),JSON.stringify({frames:frames.length,duration:55,capturedDuration:end,width:1920,height:1080,demoData:true,application:exe},null,2));
  await app.close();app=null;
  const ffmpeg=process.env.FFMPEG_PATH||path.join(root,'.tools/video-runtime/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
  await new Promise((resolve,reject)=>{const process=spawn(ffmpeg,['-hide_banner','-y','-f','concat','-safe','0','-i',list,'-t','55','-r','30','-vf',`setpts=${55/end}*PTS,scale=1920:1080:flags=lanczos`,'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart','-an',out],{windowsHide:true,stdio:['ignore','ignore','pipe']});const log=fs.createWriteStream(path.join(work,'encode.log'));process.stderr.pipe(log);process.on('error',reject);process.on('exit',code=>code===0?resolve():reject(new Error('Encoder exit '+code)));});
  console.log(JSON.stringify({output:out,work,frames:frames.length,duration:55,bytes:fs.statSync(out).size}));
 }
}finally{recording=false;await capturePromise?.catch(()=>{});await app?.close();}
