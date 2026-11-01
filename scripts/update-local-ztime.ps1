param([switch]$RefreshPackage)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$primary=Join-Path $root 'dist/TimeLedger-windows-x64'
$mirror=Join-Path $root 'installed/windows'
$exe=Join-Path $primary 'Ztime.exe'
$data=Join-Path $primary 'data'
$version=(Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json).version

function MainProcess($program) {
    Get-CimInstance Win32_Process -Filter "Name='Ztime.exe'" |
        Where-Object {$_.ExecutablePath -eq $program -and $_.CommandLine -notlike '*--type=*'} |
        Select-Object -First 1
}
function ConnectClient($processId) {
    $ports=Get-NetTCPConnection -State Listen -OwningProcess $processId -ErrorAction SilentlyContinue |
        Where-Object LocalAddress -eq '127.0.0.1' | Select-Object -ExpandProperty LocalPort
    foreach ($port in $ports) {
        try {
            $url="http://127.0.0.1:$port"
            $null=Invoke-WebRequest "$url/" -UseBasicParsing -SessionVariable session -TimeoutSec 4
            $summary=Invoke-RestMethod "$url/api/summary" -WebSession $session -TimeoutSec 6
            if ($null -ne $summary.paused -and $summary.device.id) {
                return [pscustomobject]@{Url=$url;Session=$session;Paused=[bool]$summary.paused}
            }
        } catch {continue}
    }
    throw 'Client has no ready UI port'
}
function SetPaused($client,$value) {
    $null=Invoke-RestMethod "$($client.Url)/api/pause" -Method Post -WebSession $client.Session -ContentType 'application/json' -Body (@{paused=[bool]$value}|ConvertTo-Json)
}
function StopClient($processInfo,$client) {
    $capability=try {Invoke-RestMethod "$($client.Url)/api/version" -WebSession $client.Session} catch {$null}
    if ($capability.quitForUpdate) {
        Start-Process -FilePath $exe -ArgumentList '--quit-for-update' -WindowStyle Hidden
    } else {
        # Migration from 0.2.8: it has no quit command. Flush the active sample first.
        SetPaused $client $true
        & taskkill.exe /PID $processInfo.ProcessId /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) {throw 'Could not stop verified old client'}
    }
    for ($i=0;$i -lt 80;$i++) {
        if (!(Get-Process -Id $processInfo.ProcessId -ErrorAction SilentlyContinue)) {return}
        Start-Sleep -Milliseconds 150
    }
    throw 'The old client did not exit'
}
function StartClient {
    $headless=$env:TIME_LEDGER_HEADLESS
    try {
        $env:TIME_LEDGER_HEADLESS=$null
        $process=Start-Process -FilePath $exe -WorkingDirectory $primary -PassThru
    } finally {$env:TIME_LEDGER_HEADLESS=$headless}
    for ($i=0;$i -lt 45;$i++) {
        if ($process.HasExited) {throw 'Updated process exited during startup'}
        try {return ConnectClient $process.Id} catch {Start-Sleep -Milliseconds 250}
    }
    throw 'Updated client did not open its UI'
}
$lock=[Threading.Mutex]::new($false,'Local\ZtimeLocalUpgrade')
try {$locked=$lock.WaitOne(0)} catch [Threading.AbandonedMutexException] {$locked=$true}
if (!$locked) {$lock.Dispose();throw 'An update is already in progress'}
$backupDir=Join-Path $root '.tools/backups'
$null=New-Item -Type Directory -Force -Path $backupDir
$backup=Join-Path $backupDir ("before-"+$version+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.zip')
$work=Join-Path $root ('.tools/update-'+[Guid]::NewGuid().ToString('N'))
$stage=Join-Path $work 'stage'
$null=New-Item -Type Directory -Path $stage -Force
$undo=[Collections.Generic.List[object]]::new()
$keep=$false
$paused=$null
$interrupted=$false
$oldOutput=$env:ZTIME_BUILD_OUTPUT
Push-Location $root
try {
    # Stage only the branded launcher and application files, never a second full installation.
    Copy-Item -LiteralPath $exe -Destination $stage
    $env:ZTIME_BUILD_OUTPUT=$stage
    & node scripts/package-windows.js --refresh-code
    if ($LASTEXITCODE -ne 0) {throw 'Could not prepare program files'}
    $targets=@($primary)
    if (Test-Path -LiteralPath (Join-Path $mirror 'Ztime.exe')) {
        if (MainProcess (Join-Path $mirror 'Ztime.exe')) {throw 'The mirror is also running'}
        $targets+=@($mirror)
    }
    & python scripts/upgrade-ledger.py backup $data $backup
    if ($LASTEXITCODE -ne 0) {throw 'Backup failed'}
    $old=MainProcess $exe
    if ($old) {
        $client=ConnectClient $old.ProcessId
        $paused=$client.Paused
        $interrupted=$true
        StopClient $old $client
    }
    $payload=@('resources/app')+@(Get-ChildItem -LiteralPath $stage -File | Select-Object -ExpandProperty Name)
    foreach ($target in $targets) {
        foreach ($relative in $payload) {
            $dest=[IO.Path]::GetFullPath((Join-Path $target $relative))
            if (!$dest.StartsWith($target+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Invalid update path'}
            $previous=Join-Path $work ('old-'+$undo.Count)
            $existed=Test-Path -LiteralPath $dest
            if ($existed) {Move-Item -LiteralPath $dest -Destination $previous}
            $undo.Add(@{Destination=$dest;Previous=$previous;Existed=$existed;Target=$target})
            Copy-Item -LiteralPath (Join-Path $stage $relative) -Destination $dest -Recurse
        }
    }
    $client=StartClient
    $live=Invoke-RestMethod "$($client.Url)/api/version" -WebSession $client.Session
    if ($live.version -ne $version) {throw 'Running version differs from package version'}
    if ($null -ne $paused -and $client.Paused -ne $paused) {SetPaused $client $paused}
    & python scripts/upgrade-ledger.py verify $data $backup
    if ($LASTEXITCODE -ne 0) {throw 'Ledger or pairing verification failed'}
    Write-Output "Running Ztime $version. Backup: $backup"
} catch {
    $cause=$_
    try {
        $current=MainProcess $exe
        if ($current -and $undo.Count) {StopClient $current (ConnectClient $current.ProcessId)}
        for ($i=$undo.Count-1;$i -ge 0;$i--) {
            $entry=$undo[$i]
            if (Test-Path -LiteralPath $entry.Destination) {
                $actual=(Resolve-Path -LiteralPath $entry.Destination).Path
                if (!$actual.StartsWith($entry.Target+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Unexpected rollback path'}
                Remove-Item -LiteralPath $actual -Recurse -Force
            }
            if ($entry.Existed) {Move-Item -LiteralPath $entry.Previous -Destination $entry.Destination}
        }
        if ($interrupted) {
            $current=MainProcess $exe
            $client=if ($current) {ConnectClient $current.ProcessId} else {StartClient}
            if ($null -ne $paused -and $paused -ne $client.Paused) {SetPaused $client $paused}
        }
    } catch {$keep=$true; Write-Warning "Recovery files retained at $work. $_"}
    throw $cause
} finally {
    $env:ZTIME_BUILD_OUTPUT=$oldOutput
    Pop-Location
    $actual=(Resolve-Path -LiteralPath $work).Path
    if (!$keep -and (Split-Path -Parent $actual) -eq (Join-Path $root '.tools') -and (Split-Path -Leaf $actual) -match '^update-[0-9a-f]{32}$') {
        Remove-Item -LiteralPath $actual -Recurse -Force
    }
    $lock.ReleaseMutex();$lock.Dispose()
}
