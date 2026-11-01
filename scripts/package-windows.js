import {execFileSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=process.cwd(),out=process.env.ZTIME_BUILD_OUTPUT||path.join(root,'dist','TimeLedger-windows-x64');
const exists=fs.existsSync(out);if(exists&&!process.argv.includes('--refresh-code'))throw new Error('Windows output already exists. Rename the previous build or pass --refresh-code to update program files without touching data.');
const electronRoot=path.dirname(require.resolve('electron/package.json'));if(!fs.existsSync(path.join(electronRoot,'dist','electron.exe')))throw new Error('Install the Electron runtime first.');
fs.mkdirSync(out,{recursive:true});if(!exists){fs.cpSync(path.join(electronRoot,'dist'),out,{recursive:true});fs.renameSync(path.join(out,'electron.exe'),path.join(out,'Ztime.exe'));}
const brandedExe=path.join(out,'Ztime.exe');if(!fs.existsSync(brandedExe))fs.copyFileSync(path.join(electronRoot,'dist','electron.exe'),brandedExe);
execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/brand-windows.ps1'),'-Executable',brandedExe],{stdio:'inherit'});
const target=path.join(out,'resources','app');fs.mkdirSync(target,{recursive:true});
for(const dir of ['desktop','web','shared','assets'])fs.cpSync(path.join(root,dir),path.join(target,dir),{recursive:true});
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));delete pkg.devDependencies;delete pkg.scripts;fs.writeFileSync(path.join(target,'package.json'),JSON.stringify(pkg,null,2));
const copied=new Map();
function copyDependency(name,from){const req=createRequire(path.join(from,'package.json'));const file=req.resolve(name+'/package.json'),source=path.dirname(file),metadata=JSON.parse(fs.readFileSync(file,'utf8'));if(copied.has(name)){if(copied.get(name)!==metadata.version)throw new Error('Dependency version conflict: '+name);return;}copied.set(name,metadata.version);const dest=path.join(target,'node_modules',name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(source,dest,{recursive:true,filter:src=>!path.relative(source,src).split(path.sep).includes('node_modules')});for(const dep of Object.keys(metadata.dependencies??{}))copyDependency(dep,source);}
for(const name of Object.keys(pkg.dependencies))copyDependency(name,root);
fs.copyFileSync('LICENSE',path.join(out,'LICENSE-TimeLedger.txt'));if(fs.existsSync('README.md'))fs.copyFileSync('README.md',path.join(out,'README.md'));
fs.writeFileSync(path.join(out,'使用说明.txt'),'Ztime '+pkg.version+'\r\n\r\n双击 Ztime.exe 开始。关闭窗口后保留托盘计时；在托盘中选择退出才停止。\r\n记录保存在同目录 data 文件夹，不需要账号或额外安装 Node。\r\n手机配对请打开“设备同步”，生成二维码，在 Android App 扫描，随后在电脑确认。\r\n两台设备须处于同一可互访的局域网。首次 Windows 防火墙询问时只允许专用网络。\r\n请保留整个文件夹；不要只移动 exe。\r\n');
fs.writeFileSync(path.join(out,'third-party-dependencies.json'),JSON.stringify(Object.fromEntries(copied),null,2));console.log(out);
