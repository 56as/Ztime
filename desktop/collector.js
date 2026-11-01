import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export class Collector {
 constructor(store,hostFor=()=>null){this.store=store;this.hostFor=hostFor;this.active=null;this.last=0;this.process=null;this.state='starting';}
 sample(value,now=Date.now()){
  if(this.store.get('paused',false)){this.active=null;this.state='paused';return;}
  if(now-this.last>10000)this.active=null;
  const site=value.state==='active'?this.hostFor(value.appId,now):null;
  if(this.active&&(this.active.site!==site||value.state!=='active'||value.appId!==this.active.appId)){this.active.end=now;this.store.write(this.active);this.active=null;}
  this.last=now;this.state=value.state;
  if(value.state!=='active'||!value.appId){this.active=null;this.store.set('collector',{state:value.state,lastSample:now});return;}
  if(!this.active||this.active.appId!==value.appId)this.active={id:randomUUID(),deviceId:this.store.device.id,appId:value.appId,appName:value.appName,site,start:now,end:now};
  this.active.end=now;
  this.store.write(this.active);
  this.store.set('collector',{state:'active',lastSample:now,appName:value.appName});
 }
 start(){
  if(process.platform!=='win32'){this.store.set('collector',{state:'unsupported'});return;}
  this.process=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./collector.ps1',import.meta.url))],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  createInterface({input:this.process.stdout}).on('line',line=>{try{this.sample(JSON.parse(line));}catch{this.store.set('collector',{state:'error'});}});
  this.process.stderr.on('data',()=>{this.store.set('collector',{state:'error'});});
  this.process.on('error',()=>this.store.set('collector',{state:'error'}));
  this.process.on('exit',()=>{this.active=null;if(!this.stopped)this.store.set('collector',{state:'stopped'});});
 }
 pause(paused){if(this.active&&Date.now()-this.last<=10000){this.active.end=Date.now();this.store.write(this.active);}this.active=null;this.store.set('paused',paused);this.store.set('collector',{state:paused?'paused':'starting'});}
 stop(){this.stopped=true;this.active=null;this.process?.kill();}
}
