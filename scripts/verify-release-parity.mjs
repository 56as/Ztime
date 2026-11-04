import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const appRoot=process.argv[2] || '.';
const {createApp}=await import(pathToFileURL(path.resolve(appRoot,'desktop/server.js')));

const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[process.cwd(),path.dirname(process.execPath)]}));
execFileSync(process.execPath,['scripts/build-review-insights.mjs','--check'],{stdio:'inherit'});
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ztime-release-check-'));
const evidence='artifacts/release-parity';
fs.mkdirSync(evidence,{recursive:true});
const service=await createApp({dataDir:directory,collect:false,port:0,syncPort:0});
let browser;
try {
  browser=await chromium.launch({channel:'msedge'});
  const viewport={width:1280,height:824};
  const live=await browser.newPage({viewport});
  const review=await browser.newPage({viewport});
  const boards=path.resolve('design/review');
  // Review the files in this checkout without an existing server or private annotations.
  await review.route('http://review.test/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==='/api/notes')return route.fulfill({json:[]});
    const file=path.resolve(boards,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(boards+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
    await route.fulfill({path:file});
  });
  await review.goto('http://review.test/?proposal=hourglass#desktop-settings/desktop-v2');
  await live.goto(service.url);
  const frame=review.frameLocator('#frame');
  async function check(selector,design=selector,geometry=false){
    const measure=(e,geometry)=>{
      const s=getComputedStyle(e),r=e.getBoundingClientRect();
      return [e.offsetWidth,e.offsetHeight,s.borderRadius,s.backgroundColor,getComputedStyle(e,'::before').backgroundColor,
        ...(geometry?[Math.round(r.left),Math.round(r.top)]:[])];
    };
    const actual=await live.locator(selector+':visible').first().evaluate(measure,geometry);
    const expected=await frame.locator(design+':visible').first().evaluate(measure,geometry);
    assert.deepEqual(actual,expected,selector);
  }
  for(const theme of ['light','dark']){
    for(const [tab,key] of [['settings','settings'],['dashboard','home'],['behavior','behavior'],['devices','devices']]){
      await live.locator('[data-page='+tab+']').click();
      await live.locator('main.'+tab+'-view .sand-seal').waitFor();
      await frame.locator('[data-page='+key+']:visible').first().click();
      const active=review.locator('#frame[data-loaded=desktop-'+key+']');
      await active.waitFor();
      await active.evaluate((e,v)=>{e.style.width=v.width+'px';e.style.height=v.height+'px'},viewport);
      if(tab==='settings'){
        for(const side of [live,frame])await side.locator('[data-theme='+theme+']:visible').click();
        await check('.appearance-options');
        await check('[data-theme='+theme+']');
      }
      await check('.sand-seal','.sand-seal',true);
      for(const side of [live,frame]){
        const dial=side.locator('.sand-seal');
        assert.equal(await dial.evaluate(el=>getComputedStyle(el,'::before').animationDuration),'10s');
      }
      if(tab==='dashboard'){
        for(const selector of ['[data-mode=day]','[data-chart=bar]','[data-scope=pc]'])await check(selector);
        await check('[data-tool=report]','[data-cal=report]');
        for(const side of [live,frame]){
          const body=side.locator('body');
          await body.evaluate(e=>{
            const d=e.ownerDocument;d.addEventListener('animationstart',ev=>{
              if(ev.animationName==='review-choice-slide')e.dataset.slideSeen='yes';
            });
          });
          for(const choice of ['[data-mode=week]','[data-scope=pc]','[data-mode=day]','[data-scope=all]','[data-chart=bar]','[data-chart=line]'])
            await side.locator(choice+':visible').first().click();
          await side.locator('body[data-slide-seen=yes]').waitFor();
          await side.locator('[data-chart=line][aria-pressed=true]').waitFor();
        }
        await check('[data-chart=line]');
        for(const side of [live,frame]){
          const chart=side.locator('.desktop-hour-chart:visible').first();
          await chart.locator('g[role=button]').first().press('Enter');
          const detail=side.locator('.desktop-point-detail:visible');
          assert.ok(await detail.evaluate(el=>el.getBoundingClientRect().top >= el.parentElement.querySelector('.usage-chart').getBoundingClientRect().bottom));
          assert.ok(await detail.locator('li').count()<=3);
          assert.equal(await detail.locator('header, :scope > small').count(),0);
          assert.equal(await detail.locator('.point-total').evaluate(row=>row.lastElementChild.getBoundingClientRect().left-row.firstElementChild.getBoundingClientRect().right),8);
          assert.equal(await chart.locator('.usage-x span').first().evaluate(el=>getComputedStyle(el,'::before').height),'5px');
          await chart.locator('g[aria-expanded=true]').press('Escape');
          assert.ok(await side.locator('.desktop-point-detail').isHidden());
        }
      }
      await active.screenshot({path:evidence+'/'+theme+'-'+key+'-review.png',animations:'disabled'});
      await live.screenshot({path:evidence+'/'+theme+'-'+key+'.png',animations:'disabled'});
    }
  }
  execFileSync(process.execPath,['scripts/verify-dashboard-ui.mjs'],{stdio:'inherit'});
  console.log('Windows release parity passed. Screens: '+evidence);
} finally {
  await browser?.close();await service.close();fs.rmSync(directory,{recursive:true,force:true});
}
