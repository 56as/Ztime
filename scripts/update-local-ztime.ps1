param([switch]$RefreshPackage)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskDir=Join-Path $taskRoot 'dist/TimeLedger-windows-x64'
$taskOld=Join-Path $taskDir 'TimeLedger.exe'
$taskNew=Join-Path $taskDir 'Ztime.exe'
$taskMain=Get-CimInstance Win32_Process -Filter "Name='TimeLedger.exe' OR Name='Ztime.exe'" | Where-Object {$_.ExecutablePath -in @($taskOld,$taskNew) -and $_.CommandLine -notlike '*--type=*'} | Select-Object -First 1
$taskPaused=$false
if($taskMain){
 $taskPort=Get-NetTCPConnection -State Listen -OwningProcess $taskMain.ProcessId | Where-Object LocalAddress -eq '127.0.0.1' | Select-Object -First 1 -ExpandProperty LocalPort
 $taskUrl="http://127.0.0.1:$taskPort"
 $null=Invoke-WebRequest "$taskUrl/" -SessionVariable taskSession
 $taskSummary=Invoke-RestMethod "$taskUrl/api/summary" -WebSession $taskSession
 $taskPaused=$taskSummary.paused
 $null=Invoke-RestMethod "$taskUrl/api/pause" -Method Post -WebSession $taskSession -ContentType 'application/json' -Body '{"paused":true}'
 & taskkill.exe /PID $taskMain.ProcessId /T /F | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Could not stop old client'}
}
$taskBackup=Join-Path $taskRoot ('.tools/backups/pre-ztime-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $taskBackup -Force | Out-Null
foreach($taskName in @('ledger.sqlite','ledger.sqlite-wal','ledger.sqlite-shm','tls.json')){
 $taskFile=Join-Path $taskDir "data/$taskName"
 if(Test-Path -LiteralPath $taskFile){Copy-Item -LiteralPath $taskFile -Destination $taskBackup}
}
# Remove only the previous launcher; user data remains in the same data directory.
if(Test-Path -LiteralPath $taskOld){Remove-Item -LiteralPath $taskOld}
if($RefreshPackage){
 Push-Location $taskRoot
 try { & node scripts/package-windows.js --refresh-code; if($LASTEXITCODE -ne 0){throw 'Windows package refresh failed'} }
 finally { Pop-Location }
}
$taskRun='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$taskEntries=(Get-ItemProperty $taskRun).PSObject.Properties | Where-Object {$_.Value -is [string] -and $_.Value -like ('*'+$taskOld+'*')}
foreach($taskEntry in $taskEntries){Remove-ItemProperty $taskRun -Name $taskEntry.Name}
$taskProcess=Start-Process -FilePath $taskNew -WorkingDirectory $taskDir -WindowStyle Normal -PassThru
$taskPort=$null
for($i=0;$i -lt 30;$i++){
 Start-Sleep -Milliseconds 500
 $taskPort=Get-NetTCPConnection -State Listen -OwningProcess $taskProcess.Id -ErrorAction SilentlyContinue | Where-Object LocalAddress -eq '127.0.0.1' | Select-Object -First 1 -ExpandProperty LocalPort
 if($taskPort){break}
}
if(-not $taskPort){throw 'Updated client did not start'}
$taskUrl="http://127.0.0.1:$taskPort"
$null=Invoke-WebRequest "$taskUrl/" -SessionVariable taskNewSession
$null=Invoke-RestMethod "$taskUrl/api/autostart" -Method Post -WebSession $taskNewSession -ContentType 'application/json' -Body '{"enabled":true}'
$null=Invoke-RestMethod "$taskUrl/api/pause" -Method Post -WebSession $taskNewSession -ContentType 'application/json' -Body (@{paused=[bool]$taskPaused}|ConvertTo-Json)
$taskAfter=Invoke-RestMethod "$taskUrl/api/summary" -WebSession $taskNewSession
[pscustomobject]@{Program=$taskNew;ProcessId=$taskProcess.Id;Title=(Get-Process -Id $taskProcess.Id).MainWindowTitle;Autostart=$taskAfter.autostart;DataDirectory=(Join-Path $taskDir 'data');Backup=$taskBackup;DevicesBefore=$taskSummary.devices.Count;DevicesAfter=$taskAfter.devices.Count;SyncError=$taskAfter.sync.error}
