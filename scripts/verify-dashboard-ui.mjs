import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createApp} from '../desktop/server.js';

const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[process.cwd(),path.dirname(process.execPath)]}));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ztime-dashboard-'));
let startup=true;
const service=await createApp({dataDir:dir,port:0,syncPort:0,collect:false,autostart:{get:()=>startup,set:value=>{startup=value;}}});
let browser;
try{
  const now=Date.now();
  service.store.set('collector',{state:'active',appName:'Editor <Example>'});
  for(const [appId,minutes] of [['notes',20],['reader',5]])
    service.store.write({id:appId,appId,appName:appId,deviceId:service.store.device.id,start:now-minutes*60000,end:now});
  browser=await chromium.launch({channel:process.env.ZTIME_BROWSER||'msedge'});
  const page=await browser.newPage();
  page.setDefaultTimeout(6000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(service.url);
  const click=selector=>page.locator(selector).click();
  const cal=name=>click('[data-cal="'+name+'"]');
  const modal=page.locator('.period-dialog');
  await page.locator('.period-total').waitFor();
  assert.equal(await page.locator('.page-header .statusbar').innerText(),'正在记录 · Editor <Example>');
  assert.deepEqual(await page.locator('[data-mode]').allTextContents(),['日','周','月','年']);
  for(const [width,height] of [[820,620],[1280,824]]) {
    await page.setViewportSize({width,height});
    const firstScreen=await page.locator('.default-pair').evaluate(grid=>{
      const trend=grid.querySelector('.trend-card').getBoundingClientRect();
      const rank=grid.querySelector('.ranking-card').getBoundingClientRect();
      const controls=document.querySelector('.pd-controls').getBoundingClientRect();
      const summary=document.querySelector('.period-total').getBoundingClientRect();
      return document.scrollingElement.scrollHeight===innerHeight && rank.top>trend.bottom &&
        rank.width===trend.width && rank.bottom>innerHeight-32 && controls.bottom===summary.top;
    });
    assert.ok(firstScreen,'Default cards fill one desktop window');
  }
  assert.ok(await page.locator('.period-total').evaluate(el=>
    el.querySelector('.pd-modes').getBoundingClientRect().right<=el.querySelector('.total-value').getBoundingClientRect().left));
  await click('[data-scope=pc]');await page.locator('.total-value small').filter({hasText:'电脑累计'}).waitFor();
  await click('[data-scope=all]');await page.locator('.total-value small').filter({hasText:'设备累计'}).waitFor();
  assert.match(await page.locator('.sidebar-version').innerText(),/版本/);
  const dayTicks=await page.locator('.desktop-hour-chart .usage-x span').allTextContents();
  assert.ok(dayTicks.every((text,i)=>i%2===0?text.length>0:text===''));
  await click('[data-mode=week]');
  const lastPoint=page.locator('.trend-card g[role=button]').last();
  await lastPoint.click();await page.locator('.desktop-point-detail li').first().waitFor();
  const selected=await page.locator('.desktop-point-detail').innerText();
  assert.match(selected,/notes/);
  await click('[data-chart=bar]');
  assert.equal(await page.locator('.desktop-point-detail').innerText(),selected);
  assert.ok(await page.locator('.desktop-hour-chart rect[rx]').count()>0);
  await click('[aria-label=关闭时段明细]');await click('[data-chart=line]');

  const bars=page.locator('.rank-track i');
  await bars.first().waitFor();
  assert.equal(await bars.count(),2);
  assert.ok((await bars.first().boundingBox()).width >= (await bars.last().boundingBox()).width);
  await click('[data-rank="0"]');await page.locator('#dialog[open]').waitFor();await page.keyboard.press('Escape');
  await page.locator('.period-total').waitFor();
  const before=await page.locator('.period-total').boundingBox();
  const tools=page.locator('[data-tool=layout], [data-tool=refresh]');
  assert.deepEqual(await tools.evaluateAll(nodes=>nodes.map(n=>n.offsetHeight)),[36,36]);
  assert.equal(await page.getByRole('heading',{name:'期间对比'}).count(),0);
  await click('[data-tool=layout]');await click('[data-toggle=compare]');await click('[data-toggle=devices]');await click('[data-toggle=focus]');await click('[data-save]');
  await page.getByRole('heading',{name:'设备用时占比'}).waitFor();
  assert.match(await page.locator('.share-row').first().innerText(),/100%/);
  await page.getByRole('heading',{name:'应用集中度'}).waitFor();
  await cal('dates');await modal.waitFor();
  assert.deepEqual(await page.locator('.period-total').boundingBox(),before);
  await modal.locator('[data-edge=start]').fill('2024-03-01');await modal.locator('[data-edge=end]').fill('2024-04-01');await cal('apply');
  assert.match(await modal.innerText(),/同一个自然月/);
  await modal.locator('[data-edge=end]').fill('2024-03-31');await cal('apply');
  await page.waitForFunction(()=>document.querySelectorAll('.usage-x span').length===31);
  await cal('compare');await page.keyboard.press('Escape');assert.ok(!await modal.isVisible());
  await click('[data-tool=layout]');await click('[data-toggle=ranking]');await cal('cancel');
  assert.ok(await page.getByRole('heading',{name:'应用排行'}).isVisible());
  await click('[data-tool=layout]');await click('[data-key=compare][data-shift="-1"]');await click('[data-toggle=ranking]');await click('[data-save]');
  await modal.waitFor({state:'hidden'});await page.reload();await page.locator('.period-total').waitFor();
  assert.equal(await page.getByRole('heading',{name:'应用排行'}).count(),0);
  assert.equal(service.store.get('periodLayout').cards[1].key,'compare');
  await click('[data-mode=day]');
  await cal('dates');await cal('today');await cal('apply');
  for(let i=0;i<30;i++)service.store.write({id:'extra'+i,appId:'extra'+i,appName:'Example '+i,deviceId:service.store.device.id,start:now-60000,end:now});
  await click('[data-tool=layout]');await click('[data-toggle=ranking]');await click('[data-save]');
  await click('[data-tool=refresh]');
  const scroll=page.locator('.rank-scroll');await scroll.waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.rank-scroll [data-rank]').length>20);
  assert.equal(await scroll.evaluate(el=>getComputedStyle(el).scrollbarWidth),'none');
  await scroll.hover();await page.mouse.wheel(0,480);
  await page.waitForFunction(()=>document.querySelector('.rank-scroll')?.scrollTop>0);
  const refreshed=page.waitForResponse(r=>r.url().includes('/api/period?'));
  await click('[data-tool=refresh]');await refreshed;await page.waitForFunction(()=>document.querySelector('.rank-scroll')?.scrollTop>0);
  await scroll.locator('[data-rank]').last().click();await page.locator('#dialog[open]').waitFor();await page.keyboard.press('Escape');
  await click('[data-page=devices]');
  await page.getByRole('heading',{name:'浏览器识别'}).waitFor();
  assert.ok(await page.evaluate(()=>document.scrollingElement.scrollHeight===innerHeight));
  await click('[data-action=pair]');await page.locator('.qr').waitFor();
  await click('[data-page=settings]');await click('[data-theme=dark]');await page.waitForFunction(()=>document.body.classList.contains('dark'));
  const grid=page.locator('.settings-grid');
  assert.equal(await page.getByRole('heading',{name:'浏览器识别'}).count(),0);
  assert.ok(await grid.evaluate(el=>{
    const [rules,appearance]=Array.from(el.children,c=>c.getBoundingClientRect());
    const controls=el.querySelector('.record-actions').getBoundingClientRect();
    const [json,csv,del]=Array.from(el.querySelector('.record-data .row').children,c=>c.getBoundingClientRect());
    return appearance.top===rules.top && json.left>=controls.right && json.bottom<=csv.top && csv.bottom<=del.top &&
      el.querySelector('#timeZone').getBoundingClientRect().width<=135;
  }));
  await click('[data-switch=recording]');await page.waitForFunction(()=>document.querySelector('[data-switch=recording]').getAttribute('aria-checked')==='false');
  assert.equal(service.store.get('paused'),true);
  const switchBox=await page.locator('[data-switch=startup]').boundingBox();
  await page.mouse.move(switchBox.x+switchBox.width-4,switchBox.y+switchBox.height/2);
  await page.mouse.down();await page.mouse.move(switchBox.x+4,switchBox.y+switchBox.height/2,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('[data-switch=startup]').getAttribute('aria-checked')==='false');
  assert.equal(startup,false);
  await click('[data-switch=recording]');await page.waitForFunction(()=>document.querySelector('[data-switch=recording]').getAttribute('aria-checked')==='true');
  for(const type of ['json','csv']){
    const download=page.waitForEvent('download');await click('[data-export='+type+']');assert.ok((await download).suggestedFilename().endsWith('.'+type));
  }
  await click('[data-action=delete-data]');await page.locator('#dialog[open] [data-cancel]').click();
  await page.locator('#timeZone').selectOption('Europe/Paris');await click('[data-action=save-settings]');
  await page.waitForFunction(()=>document.querySelector('#timeZone')?.value==='Europe/Paris');
  assert.equal(service.store.get('settings').timeZone,'Europe/Paris');
  assert.deepEqual(await page.locator('.appearance-options button').allTextContents(),['浅色','深色']);
  assert.equal(await page.locator('.accent-picker').count(),0);assert.match(await page.locator('.sidebar-version').innerText(),/版本 \d/);
  assert.deepEqual(await page.locator('.settings-grid>.panel h2').allTextContents().then(xs=>xs.slice(0,2)),['统计规则','记录与外观']);
  for(const name of ['dashboard','devices','settings']){
    await click('[data-page='+name+']');
    const refresh=page.getByRole('button',{name:'更新',exact:true});
    assert.equal(await refresh.textContent(),'');assert.ok(await refresh.evaluate(el=>el===el.parentElement.lastElementChild));
    await refresh.click();
    assert.equal(await page.locator('.nav [data-page=week]').count(),0);
  }
  await page.setViewportSize({width:390,height:740});await click('[data-page=dashboard]');await cal('dates');
  assert.ok(await modal.evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
  assert.ok(await page.evaluate(()=>window.ledgerBack()));assert.ok(!await modal.isVisible());
  assert.deepEqual(errors,[]);
  console.log('Passed dashboard dates, ranking, layout persistence, refresh, navigation, settings and mobile modal.');
}finally{
  await browser?.close();await service.close();fs.rmSync(dir,{recursive:true,force:true});
}
