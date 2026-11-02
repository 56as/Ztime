import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
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
 ['ztime.exe',new URL('../assets/icon.png',import.meta.url)],
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
const glyphs={
 windows:'<path d="M4 5h16v13H4z M8 21h8 M12 18v3"/>',
 android:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>'
};
function fallback(platform){
 const glyph=glyphs[platform==='android'?'android':'windows'];
 return {type:'image/svg+xml',data:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#526982"/><g fill="none" stroke="white" stroke-width="1.5">${glyph}</g></svg>`};
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
  if(id==='ztime.exe')return {type:'image/png',data:await fs.readFile(bundled.get(id))};
  const file=path.join(dir,'v2-'+createHash('sha256').update(id).digest('hex')+'.png');
  try{return {type:'image/png',data:await fs.readFile(file)};}catch{}
  if(process.platform!=='win32')return fallback('windows');
  if(!locations.has(id)){
   discovery??=exec('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',discover],{windowsHide:true,timeout:8000})
    .then(({stdout})=>stdout.split(/\r?\n/).forEach(line=>remember(line.trim().replace(/^"|"$/g,'')))).catch(()=>{});
   await discovery;
  }
  const source=locations.get(id) || path.join(process.env.SystemRoot,'System32',id);
  try{
   let data=await packageIcon(source);
   if(!data && bundled.has(id))data=await fs.readFile(bundled.get(id));
   if(!data && extract){await fs.access(source);data=await extract(source);}
   if(data?.length){
    await fs.mkdir(dir,{recursive:true});
    const temp=file+'.tmp';
    await fs.writeFile(temp,data);await fs.rename(temp,file);
    return {type:'image/png',data};
   }
  }catch{/* An inaccessible or removed app uses the platform icon. */}
  return fallback('windows');
 }
 return {remember,async get(platform,appId){
  const id=platform==='android'?counterparts.get(appId):String(appId).toLowerCase();
  if(!id||!['windows','android'].includes(platform)||id.length>255||/[\\/:*?"<>|\x00-\x1f]/.test(id)||!id.endsWith('.exe'))return fallback(platform);
  if(!pending.has(id))pending.set(id,load(id).finally(()=>pending.delete(id)));
  const icon=await pending.get(id);
  return platform==='android' && icon.type!=='image/png'?fallback(platform):icon;
 }};
}
