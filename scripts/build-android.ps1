$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$taskJdk=Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools\jdk') -Directory | Select-Object -First 1
$taskGradle=Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools\gradle') -Directory | Select-Object -First 1
if (-not $taskJdk -or -not $taskGradle) { throw 'Run scripts/bootstrap-android.py first, or use Android Studio.' }
$env:JAVA_HOME=$taskJdk.FullName
$env:GRADLE_USER_HOME=Join-Path $projectRoot '.tools\gradle-cache'
$env:ANDROID_HOME=Join-Path $projectRoot '.tools\android-sdk'
$env:ANDROID_USER_HOME=Join-Path $projectRoot '.tools\android-user'
New-Item -ItemType Directory -Path $env:ANDROID_USER_HOME -Force | Out-Null
$env:Path=(Join-Path $env:JAVA_HOME 'bin')+';'+$env:Path
New-Item -ItemType Directory -Path $env:ANDROID_HOME -Force | Out-Null
$sdkManager=Join-Path $projectRoot '.tools\android-tools\cmdline-tools\bin\sdkmanager.bat'
if (-not (Test-Path -LiteralPath (Join-Path $env:ANDROID_HOME 'platforms\android-35\android.jar'))) {
 @('y','y','y','y','y','y','y','y') | & $sdkManager "--sdk_root=$env:ANDROID_HOME" --licenses
 & $sdkManager "--sdk_root=$env:ANDROID_HOME" 'platforms;android-35' 'build-tools;35.0.0' 'platform-tools'
 if ($LASTEXITCODE -ne 0) { throw 'Android SDK installation failed.' }
}
Push-Location $projectRoot
try { node scripts/android-assets.js; & (Join-Path $taskGradle.FullName 'bin\gradle.bat') -p android assembleDebug --console=plain; if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' } }
finally { Pop-Location }
