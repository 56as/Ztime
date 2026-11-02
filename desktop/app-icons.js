import {rankInitialSvg} from '../shared/rank-initial.js';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import catalog from '../assets/app-icons/catalog/sources.json' with {type:'json'};
import path from 'node:path';

const exec=promisify(execFile);
const discover = `
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Get-Process | ForEach-Object { if ($_.Path) { $_.Path } }
foreach ($key in 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths') {
 Get-ChildItem -LiteralPath $key -ErrorAction SilentlyContinue | ForEach-Object { $_.GetValue('') }
}
`;
// For paired Android records, use the locally installed counterpart when available.
const counterparts=new Map([
 ['com.android.chrome','chrome.exe'],['com.microsoft.emmx','msedge.exe'],
 ['org.mozilla.firefox','firefox.exe'],['com.spotify.music','spotify.exe'],
 ['com.tencent.mm','weixin.exe'],['org.telegram.messenger','telegram.exe']
]);
const bundled=new Map([
 ['ztime.exe',new URL('../web/brand-icon.png',import.meta.url)],
 ['chatgpt.exe',new URL('../assets/app-icons/chatgpt.png',import.meta.url)]
]);
async function packageIcon(source){
 if(!source || !/\\WindowsApps\\/i.test(source))return null;
 try{
  const script=fileURLToPath(new URL('./package-icon.ps1',import.meta.url));
  const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,source],{windowsHide:true,timeout:8000});
  return stdout.trim()?await fs.readFile(stdout.trim()):null;
 }catch{return null;}
}
// This PNG is the standard executable thumbnail returned by the Windows shell on this build.
const genericDigest='a967ce9122a57a6c320d63ee04978fbc325262fefcd8e00b0690bd8cd62a1ca8';
const png=data=>data?.length && createHash('sha256').update(data).digest('hex')!==genericDigest?{type:'image/png',data}:null;
export function initialIcon(name,id){
 return {type:'image/svg+xml',data:rankInitialSvg(name,id)};
}

export function createAppIcons(dir,extract){
 const locations=new Map(),pending=new Map();
 let discovery;
 function remember(file){
  // Only locally observed absolute Windows executable paths can reach the shell.
  if(typeof file==='string' && /^[a-z]:[\\/]/i.test(file) && /\.exe$/i.test(file)){
   locations.set(path.win32.basename(file).toLowerCase(),file);
  }
 }
 async function load(id){
  if(bundled.has(id))return {type:'image/png',data:await fs.readFile(bundled.get(id))};
  const name=createHash('sha256').update(id).digest('hex')+'.png';
  const file=path.join(dir,'v2-'+name);
  try{const cached=png(await fs.readFile(file));if(cached)return cached;}catch{}
  if(process.platform!=='win32')return null;
  if(!locations.has(id)){
   discovery??=exec('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',discover],{windowsHide:true,timeout:8000})
    .then(({stdout})=>stdout.split(/\r?\n/).forEach(line=>remember(line.trim().replace(/^"|"$/g,'')))).catch(()=>{});
   await discovery;
  }
  const source=locations.get(id) || path.join(process.env.SystemRoot,'System32',id);
  try{
   let data=await packageIcon(source);
   if(!data && extract){await fs.access(source);data=await extract(source);}
   const icon=png(data);
   if(icon){
    await fs.mkdir(dir,{recursive:true});
    const temp=file+'.tmp';
    await fs.writeFile(temp,data);await fs.rename(temp,file);
    return icon;
   }
  }catch{/* An inaccessible or removed app uses the platform icon. */}
  // Historical apps can outlive their installers. Retain the prior artwork
  // only when neither a fresh source nor bundled artwork was available.
  try{return png(await fs.readFile(path.join(dir,name)));}catch{return null;}
 }
 return {remember,async get(platform,appId,name){
  const catalogId=platform==='windows'?String(appId).toLowerCase():String(appId);
  if(Object.hasOwn(catalog,platform) && Object.hasOwn(catalog[platform],catalogId)){
   return {type:'image/png',data:await fs.readFile(new URL('../assets/app-icons/catalog/'+platform+'/'+encodeURIComponent(catalogId)+'.png',import.meta.url))};
  }
  const id=platform==='android'?counterparts.get(appId):String(appId).toLowerCase();
  if(!id||!['windows','android'].includes(platform)||id.length>255||/[\\/:*?"<>|\x00-\x1f]/.test(id)||!id.endsWith('.exe'))return initialIcon(name,appId);
  if(!pending.has(id))pending.set(id,load(id).finally(()=>pending.delete(id)));
  const icon=await pending.get(id);
  return icon||initialIcon(name,appId);
 }};
}
