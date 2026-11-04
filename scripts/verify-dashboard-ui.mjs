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
  await page.locator('.rank-label img').first().evaluate(image=>image.decode());
  const rowStyle=await page.locator('.desktop-rank-row').first().evaluate(row=>{
    const name=row.querySelector('.rank-name'),icon=row.querySelector('img'),bar=row.querySelector('.rank-track');
    return [getComputedStyle(name).fontSize,icon.offsetWidth,bar.offsetLeft-icon.offsetLeft,
      getComputedStyle(row).borderBottomWidth,getComputedStyle(row.querySelector('small')).fontSize,
      getComputedStyle(row.querySelector('b')).fontSize,getComputedStyle(bar.firstElementChild).backgroundColor];
  });
  assert.deepEqual(rowStyle,['15px',18,120,'1px','11px','13px','rgb(22, 142, 133)']);
  assert.equal(await page.locator('.page-header .statusbar').isVisible(),false);
  assert.deepEqual(await page.locator('[data-mode]').allTextContents(),['日','周','月','年']);
  for(const [width,height] of [[820,620],[1280,824]]) {
    await page.setViewportSize({width,height});
    const firstScreen=await page.locator('.default-pair').evaluate(grid=>{
      const trend=grid.querySelector('.trend-card').getBoundingClientRect();
      const rank=grid.querySelector('.ranking-card').getBoundingClientRect();
      const [scope,mode,range]=[...document.querySelector('.period-total').children].map(el=>el.getBoundingClientRect());
      const summary=document.querySelector('.period-total').getBoundingClientRect();
      return document.scrollingElement.scrollHeight===innerHeight && rank.top>trend.bottom &&
        rank.width===trend.width && rank.bottom>innerHeight-32 && scope.left<mode.left && mode.left<range.left && mode.top===scope.top && mode.height===scope.height;
    });
    assert.ok(firstScreen,'Default cards fill one desktop window');
  }
  assert.ok(await page.locator('.period-total').evaluate(el=>
    el.querySelector('.pd-modes').getBoundingClientRect().right<=el.querySelector('.total-value').getBoundingClientRect().left));
  // Delay both kinds of queries. The old view stays visible, and a response
  // from a superseded selection must never replace the currently selected one.
  for(const [selector,query,restore] of [
    ['[data-mode=week]','mode=week','[data-mode=day]'],
    ['[data-scope=phone]','scope=android','[data-scope=all]']
  ]){
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    const route=async request=>{await gate;await request.continue();};
    const pattern=url=>url.pathname==='/api/period' && url.search.includes(query);
    await page.route(pattern,route);
    const previous=await page.locator('.ranking-card').elementHandle();
    const pending=page.waitForRequest(req=>pattern(new URL(req.url())));
    await click(selector);await pending;
    assert.ok(await previous.evaluate(el=>el.isConnected && el.getBoundingClientRect().height>0));
    assert.equal(await page.locator('#period-view').getAttribute('aria-busy'),'true');
    assert.equal(await page.locator('#period-view [role=status]').count(),0);
    assert.equal(await page.locator(selector).getAttribute('aria-pressed'),'true');
    await click(restore);
    const response=page.waitForResponse(r=>pattern(new URL(r.url())));
    release();await response;await page.unroute(pattern,route);
    assert.equal(await page.locator(restore).getAttribute('aria-pressed'),'true');
    assert.ok(await previous.evaluate(el=>el.isConnected));
  }
  await page.route('**/api/period?**mode=month**',route=>route.abort());
  await click('[data-mode=month]');
  await page.locator('#period-view[aria-busy=false]').waitFor();
  assert.equal(await page.locator('[data-mode=day]').getAttribute('aria-pressed'),'true');
  assert.ok(await page.locator('.ranking-card').isVisible());
  await page.unroute('**/api/period?**mode=month**');
  await click('[data-scope=pc]');await page.locator('.total-value small').filter({hasText:'电脑累计'}).waitFor();
  await click('[data-scope=all]');await page.locator('.total-value small').filter({hasText:'设备累计'}).waitFor();
  assert.match(await page.locator('.sidebar-version').innerText(),/版本/);
  const dayTicks=await page.locator('.desktop-hour-chart .usage-x span').allTextContents();
  assert.ok(dayTicks.every((text,i)=>i%2===0?text.length>0:text===''));
  await click('[data-mode=week]');
  const lastPoint=page.locator('.trend-card g[role=button]').last();
  assert.equal(await lastPoint.locator('rect').count(),0);
  await lastPoint.click();
  assert.equal(await lastPoint.locator('.chart-dot').evaluate(dot=>getComputedStyle(dot).strokeWidth),'8px');await page.locator('.desktop-point-detail li').first().waitFor();
  const selected=await page.locator('.desktop-point-detail').innerText();
  assert.match(selected,/notes/);
  await click('[data-chart=bar]');
  assert.equal(await page.locator('.desktop-point-detail').innerText(),selected);
  assert.ok(await page.locator('.desktop-hour-chart rect[rx]').count()>0);
  await click('[aria-label=关闭时段明细]');await click('[data-chart=line]');

  // A refresh must not replace the report action or interrupt the moving selection.
  const reportAction=await page.locator('[data-tool=report]').elementHandle();
  await page.evaluate(()=>{
    window.segmentSlides=[];
    document.addEventListener('animationstart',event=>{
      if(event.animationName==='review-choice-slide'){
        window.segmentSlides.push({button:event.target.dataset,offset:parseFloat(event.target.style.getPropertyValue('--slide-from'))});
      }
    });
  });
  for(const [key,value] of [['mode','day'],['mode','week'],['scope','pc'],['scope','all'],['chart','bar'],['chart','line']]){
    await click('[data-'+key+'="'+value+'"]');
    await page.waitForFunction(([key,value])=>window.segmentSlides.some(s=>s.button[key]===value && Math.abs(s.offset)>1),[key,value]);
    await page.locator('#period-view[aria-busy=false]').waitFor();
    assert.ok(await reportAction.evaluate(e=>e.isConnected));
  }
  const chartButtons=await page.locator('.chart-style button').evaluateAll(buttons=>buttons.map(b=>[
    b.offsetWidth,b.offsetHeight,getComputedStyle(b).backgroundColor,getComputedStyle(b,'::before').backgroundColor
  ]));
  assert.deepEqual(chartButtons,[[52,24,'rgba(0, 0, 0, 0)','rgb(255, 253, 248)'],[52,24,'rgba(0, 0, 0, 0)','rgba(0, 0, 0, 0)']]);
  const bars=page.locator('.rank-track i');
  await bars.first().waitFor();
  assert.equal(await bars.count(),2);
  assert.ok((await bars.first().boundingBox()).width >= (await bars.last().boundingBox()).width);
  await click('[data-rank="0"]');await page.locator('#dialog[open]').waitFor();await page.keyboard.press('Escape');
  await page.locator('.period-total').waitFor();
  const before=await page.locator('.period-total').boundingBox();
  const tools=page.locator('[data-tool=layout], [data-tool=refresh]');
  assert.deepEqual(await tools.evaluateAll(nodes=>nodes.map(n=>n.offsetHeight)),[36,49]);
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
      el.querySelector('#timeZone + .desktop-choice-wheel').getBoundingClientRect().width<=135;
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
  await click('#dayStart + .desktop-choice-wheel');
  const offsets=await page.locator('#dayStart').evaluate(select=>{
    const wheel=select.nextElementSibling.getBoundingClientRect();
    return Array.from(select.options,option=>{
      const range=document.createRange();range.selectNodeContents(option);
      const label=range.getBoundingClientRect();
      return Math.abs((label.left+label.right-wheel.left-wheel.right)/2);
    });
  });
  assert.ok(offsets.every(offset=>offset<1),'hour labels align with the collapsed value: '+Math.max(...offsets));
  await page.keyboard.press('Escape');
  await click('#timeZone + .desktop-choice-wheel');
  assert.equal(await page.locator('#timeZone').evaluate(e=>getComputedStyle(e,'::picker(select)').scrollbarWidth),'none');
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/settings')&&r.request().method()==='PUT');
  await click('#timeZone option[value="Europe/Paris"]');await saved;
  await page.waitForFunction(()=>document.querySelector('#timeZone')?.value==='Europe/Paris');
  assert.equal(service.store.get('settings').timeZone,'Europe/Paris');
  assert.deepEqual(await page.locator('.appearance-options button').allTextContents(),['浅色','深色']);
  assert.equal(await page.locator('.accent-picker').count(),0);assert.match(await page.locator('.sidebar-version').innerText(),/版本 \d/);
  assert.deepEqual(await page.locator('.settings-grid>.panel h2').allTextContents().then(xs=>xs.slice(0,2)),['统计规则','记录与外观']);
  for(const name of ['dashboard','devices','settings']){
    await click('[data-page='+name+']');
    const refresh=page.getByRole('button',{name:'刷新'+({dashboard:'统计',devices:'设备',settings:'设置'}[name]),exact:true});
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
