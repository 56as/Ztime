import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createApp} from '../desktop/server.js';

const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[process.cwd(),path.dirname(process.execPath)]}));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ztime-timing-review-'));
const installed=process.argv[2];
const service=installed?null:await createApp({dataDir:temporary,port:0,syncPort:0,collect:false});
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage(),review=await browser.newPage();
 await page.goto(installed||service.url);await page.locator('[data-page=settings]').click();
 await review.goto('http://127.0.0.1:41877/?proposal=idle#desktop-settings/desktop-v2');
 const frame=review.frameLocator('iframe');
 const controls=['.idle-rule > label','#idle-limit','#idle-limit label span','#idle-auto','#idle-schedule'];
 const read=async(side,selector)=>side.locator(selector).first().evaluate(e=>{
   const r=e.getBoundingClientRect(),row=e.closest('.idle-rule').getBoundingClientRect();
   const css=getComputedStyle(e),thumb=getComputedStyle(e,'::after');
   return [e.offsetWidth,e.offsetHeight,Math.round(r.top-row.top),css.borderRadius,css.fontSize,...(e.matches('[role=switch]')?[thumb.width,thumb.height]:[])];
 });
 const choose=async(side,n)=>side.getByRole('radio',{name:n+' 分钟',exact:true}).check();
 await frame.locator('#idle-limit').waitFor();
 if(!installed){
  for(const n of [3,10,30,5]){
   await choose(page,n);await choose(frame,n);
   await page.waitForFunction(n=>document.querySelector('#idle-limit :checked').value===String(n)&&!document.querySelector('#timing-card').inert,n);
  }
  await page.reload();await page.locator('[data-page=settings]').click();assert.ok(await page.getByRole('radio',{name:'5 分钟',exact:true}).isChecked());
  await page.locator('#idle-auto').uncheck();assert.ok(!await page.locator('#idle-limit').isVisible());await page.locator('#idle-auto').check();
  await page.locator('#idle-schedule').check();await page.locator('.schedule-editor summary').click();await page.getByLabel('开始时间').fill('22:00');await page.getByLabel('结束时间').fill('07:00');await page.getByText('次日',{exact:true}).waitFor();
 }
 const config=await page.evaluate(async()=>(await(await fetch('/api/summary')).json()).timing);
 await choose(frame,config.limit);await frame.locator('#idle-auto').setChecked(config.auto);
 await frame.locator('#idle-schedule').setChecked(config.schedule);
 for(const side of [page,frame])assert.equal(await side.getByText(/^(最近待机|计入本次|查看示例)$/).count(),0);
 for(const selector of controls){
  if(!config.auto&&selector.includes('limit'))continue;
  assert.deepEqual(await read(page,selector),await read(frame,selector),selector);
 }
 for(const side of [page,frame]){
  const dims=await side.locator('#idle-auto').evaluate(e=>[e.offsetWidth,e.offsetHeight]);
  assert.deepEqual(dims,[42,24]);
 }
 console.log('Design and Windows timing controls match. Saved limit:',config.limit);
}finally{await browser.close();await service?.close();fs.rmSync(temporary,{recursive:true,force:true});}
