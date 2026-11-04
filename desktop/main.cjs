const {app,BrowserWindow,Menu,Tray,nativeImage,powerMonitor}=require('electron');
const path=require('node:path');
app.setName('Ztime');app.setAppUserModelId('org.timeledger.app');
const dataDir=process.env.TIME_LEDGER_DATA_DIR||(app.isPackaged?path.join(path.dirname(process.execPath),'data'):path.resolve(__dirname,'../.data'));
app.setPath('userData',dataDir);app.setPath('sessionData',path.join(dataDir,'chromium'));
let service,window,tray,quitting=false;
if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',(_event,argv)=>{
 if(argv.includes('--quit-for-update')){quitting=true;app.quit();return;}
 window?.show();window?.focus();
});
app.whenReady().then(async()=>{
 const {createApp}=await import('./server.js');
 service=await createApp({dataDir,port:0,extractIcon:async file=>(await app.getFileIcon(file,{size:'normal'})).resize({width:32,height:32}).toPNG(),version:app.getVersion(),autostart:{get:()=>{const s=app.getLoginItemSettings({path:process.execPath,args:[]});return process.platform==='win32'?s.executableWillLaunchAtLogin:s.openAtLogin;},set:enabled=>app.setLoginItemSettings({openAtLogin:enabled,name:'Ztime',path:process.execPath,args:[]})}});
 const iconPath=path.resolve(__dirname,'../assets/icon.png');
 window=new BrowserWindow({width:1320,height:900,minWidth:820,minHeight:620,show:process.env.TIME_LEDGER_HEADLESS!=='1',icon:iconPath,title:'Ztime',backgroundColor:'#f7f8fa',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
 window.setMenuBarVisibility(false);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(service.url+'/')&&url!==service.url)event.preventDefault();});
 const startUrl=new URL(service.url);
 if(process.env.ZTIME_START_VIEW==='ringdesk')startUrl.searchParams.set('view','ringdesk');
 await window.loadURL(startUrl.href);
 const icon=nativeImage.createFromPath(iconPath);
 tray=new Tray(icon.resize({width:16,height:16}));tray.setToolTip('Ztime · 本地应用计时');
 tray.setContextMenu(Menu.buildFromTemplate([{label:'打开Ztime',click:()=>window.show()},{label:'暂停 / 恢复记录',click:()=>service.collector.pause(!service.store.get('paused',false))},{type:'separator'},{label:'退出并停止记录',click:()=>{quitting=true;app.quit();}}]));tray.on('double-click',()=>window.show());
 window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
 powerMonitor.on('suspend',()=>service.collector.sample({state:'sleeping'}));powerMonitor.on('lock-screen',()=>service.collector.sample({state:'locked'}));
});
app.on('before-quit',()=>{quitting=true;service?.collector.stop();service?.sync.close();});
app.on('window-all-closed',()=>{});
