$ErrorActionPreference='Stop'
try {
 $taskScript=Join-Path $PSScriptRoot 'allow-lan-sync.ps1'
 $taskShell=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
 $taskProcess=Start-Process -FilePath $taskShell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$taskScript+'"')) -Verb RunAs -WindowStyle Hidden -Wait -PassThru
 if($taskProcess.ExitCode -ne 0){throw 'Firewall setup did not complete. See artifacts/lan-firewall-status.json.'}
 Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'artifacts/lan-firewall-status.json')
}catch{Write-Error $_;exit 1}
