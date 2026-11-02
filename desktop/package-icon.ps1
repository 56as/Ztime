param([Parameter(Mandatory)][string]$Executable)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
if ($Executable -notmatch '^(?<root>[a-z]:\\.+?\\WindowsApps\\[^\\]+)\\(?<relative>.+)$') { return }
$root=$Matches.root
$relative=$Matches.relative
$manifest=Join-Path $root 'AppxManifest.xml'
[xml]$xml=Get-Content -LiteralPath $manifest -Raw -Encoding UTF8
$app=$xml.Package.Applications.Application | Where-Object { ([string]$_.Executable).Replace('/','\') -eq $relative } | Select-Object -First 1
$logo=[string]$app.VisualElements.Square44x44Logo
if (!$logo -or [IO.Path]::GetExtension($logo) -ine '.png') { return }
$file=[IO.Path]::GetFullPath((Join-Path $root $logo))
if (!$file.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) { return }
$stem=$file.Substring(0,$file.Length-4)
foreach ($suffix in '.targetsize-48_altform-lightunplated.png','.targetsize-32_altform-lightunplated.png','.targetsize-48_altform-unplated.png','.scale-200.png','.png') {
 $candidate=$stem+$suffix
 if ([IO.File]::Exists($candidate)) { Write-Output $candidate; return }
}
