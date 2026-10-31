param(
 [string]$Executable=(Join-Path (Split-Path -Parent $PSScriptRoot) 'dist/TimeLedger-windows-x64/Ztime.exe'),
 [string]$InterfaceAlias='WLAN'
)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskStatus=Join-Path $taskRoot 'artifacts/lan-firewall-status.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $taskStatus) -Force | Out-Null
try {
 $Executable=(Resolve-Path -LiteralPath $Executable).Path
 if((Split-Path -Leaf $Executable) -ne 'Ztime.exe'){throw 'Expected Ztime.exe'}
 $taskAddress=Get-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 | Where-Object {$_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254.*'} | Select-Object -First 1
 if(-not $taskAddress){throw 'No active Wi-Fi IPv4 address'}
 $taskBytes=[Net.IPAddress]::Parse($taskAddress.IPAddress).GetAddressBytes()
 $taskPrefix=[int]$taskAddress.PrefixLength
 if($taskPrefix -lt 8 -or $taskPrefix -gt 32){throw 'Unexpected subnet prefix'}
 $taskNetwork=for($i=0;$i -lt 4;$i++){$taskBits=[Math]::Min(8,[Math]::Max(0,$taskPrefix-8*$i));$taskMask=if($taskBits -eq 0){0}else{256-[Math]::Pow(2,8-$taskBits)};[int]$taskBytes[$i] -band [int]$taskMask}
 $taskSubnet=($taskNetwork -join '.')+'/'+$taskPrefix
 # Explicit block rules override allow rules; remove only blocks for this exact app.
 Get-NetFirewallApplicationFilter -Program $Executable -ErrorAction SilentlyContinue | Get-NetFirewallRule | Where-Object {$_.Direction -eq 'Inbound' -and $_.Action -eq 'Block'} | Remove-NetFirewallRule
 foreach($taskRule in @(@{Name='TimeLedger-LocalSync-TLS';Protocol='TCP';Port=40327},@{Name='TimeLedger-LocalDiscovery-UDP';Protocol='UDP';Port=40328})){
  Get-NetFirewallRule -Name $taskRule.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -Name $taskRule.Name -DisplayName ('Ztime - '+$taskRule.Protocol+' '+$taskRule.Port) -Direction Inbound -Action Allow -Enabled True -Profile Private,Public -Program $Executable -Protocol $taskRule.Protocol -LocalPort $taskRule.Port -RemoteAddress $taskSubnet -InterfaceAlias $InterfaceAlias -EdgeTraversalPolicy Block | Out-Null
 }
 [pscustomobject]@{success=$true;program=$Executable;interface=$InterfaceAlias;subnet=$taskSubnet;tcp=40327;udp=40328;networkCategoryChanged=$false} | ConvertTo-Json | Set-Content -LiteralPath $taskStatus -Encoding utf8
} catch {
 [pscustomobject]@{success=$false;error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath $taskStatus -Encoding utf8
 exit 1
}
