import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {defaultTiming,scheduled,excludeIdleTail} from './timing.js';

export class Collector {
 constructor(store,hostFor=()=>null,rememberIcon=()=>{}){this.rememberIcon=rememberIcon;this.store=store;this.hostFor=hostFor;this.active=null;this.last=0;this.process=null;this.state='starting';}
 resetTracking(){this.active=null;this.foreground=null;this.wasIdle=false;this.last=0;}
 sample(value,now=Date.now()){return this.store.transaction(()=>this.track(value,now));}
 track(value,now){
  if(this.store.get('paused',false)){this.resetTracking();this.state='paused';return;}
  const config=this.store.get('timing',defaultTiming),zone=this.store.get('settings').timeZone;
  if(!this.last||now<this.last||now-this.last>10000){this.resetTracking();this.since=now;}
  if(value.iconSource)this.rememberIcon(value.iconSource);
  const app=value.state==='active'&&value.appId?{appId:value.appId,appName:value.appName,site:this.hostFor(value.appId,now)}:null;
  const idle=app&&config.auto&&Number.isFinite(value.idleMs)&&value.idleMs>=config.limit*60000;
  const lastInput=Math.max(this.since,now-(value.idleMs>=0?value.idleMs:0));
  if(idle && !this.wasIdle){
   this.wasIdle=true;
   excludeIdleTail(this.store,lastInput,now);this.active=null;
  }
  // Attribute each interval to the previous foreground window. Split at input
  // and minute boundaries so overlapping exclusions are applied once.
  for(let at=this.last||now;this.foreground&&at<now;){
   const stop=Math.min(now,(Math.floor(at/60000)+1)*60000,lastInput>at?lastInput:now);
   const absent=this.wasIdle && (idle?at>=lastInput:at<lastInput||!app);
   if(absent||scheduled(at,config,zone))this.active=null;
   else this.record(this.foreground,at,stop);
   at=stop;
  }
  if(!idle)this.wasIdle=false;
  const blocked=scheduled(now,config,zone);
  if(!app||idle||blocked)this.active=null;
  else this.record(app,now,now);
  this.foreground=app;this.last=now;
  if(!app)this.since=now;
  this.state=app?(blocked?'scheduled':idle?'idle':'active'):value.state;
  this.store.set('collector',{state:this.state,lastSample:now,...(this.state==='active'?{appName:app.appName}:{})});
 }
 record(app,start,end){
  if(!this.active||this.active.appId!==app.appId||this.active.site!==app.site||this.active.end!==start)
   this.active={...app,id:randomUUID(),deviceId:this.store.device.id,start,end};
  else if(this.active.end===end)return;
  this.active.end=end;this.store.write(this.active);
 }
 start(){
  if(process.platform!=='win32'){this.store.set('collector',{state:'unsupported'});return;}
  this.process=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./collector.ps1',import.meta.url))],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  createInterface({input:this.process.stdout}).on('line',line=>{try{this.sample(JSON.parse(line));}catch{this.store.set('collector',{state:'error'});}});
  this.process.stderr.on('data',()=>{this.store.set('collector',{state:'error'});});
  this.process.on('error',()=>this.store.set('collector',{state:'error'}));
  this.process.on('exit',()=>{this.active=null;if(!this.stopped)this.store.set('collector',{state:'stopped'});});
 }
 pause(paused){this.resetTracking();this.store.set('paused',paused);this.store.set('collector',{state:paused?'paused':'starting'});}
 stop(){this.stopped=true;this.active=null;this.process?.kill();}
}
