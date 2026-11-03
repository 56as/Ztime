param([int]$MaxSamples=0,[switch]$Diagnostics)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Foreground {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
 [DllImport("user32.dll")] public static extern bool SwitchDesktop(IntPtr desktop);
 [DllImport("user32.dll")] public static extern bool CloseDesktop(IntPtr desktop);
 [StructLayout(LayoutKind.Sequential)] struct InputStamp {public uint size;public uint tick;}
 [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref InputStamp stamp);
 public static long IdleMs(){var s=new InputStamp();s.size=(uint)Marshal.SizeOf(s);return GetLastInputInfo(ref s)?(long)unchecked((uint)Environment.TickCount-s.tick):-1;}
 public static bool Unlocked() {var d=OpenInputDesktop(0,false,0x0100);if(d==IntPtr.Zero)return false;try{return SwitchDesktop(d);}finally{CloseDesktop(d);}}
}
'@
$sampleCount=0
while ($MaxSamples -eq 0 -or $sampleCount -lt $MaxSamples) {
 $sampleCount++
 try {
  if (-not [Foreground]::Unlocked()) { @{ state='locked' } | ConvertTo-Json -Compress }
  else {
   $windowHandle = [Foreground]::GetForegroundWindow()
   [uint32]$foregroundProcessId = 0
   [void][Foreground]::GetWindowThreadProcessId($windowHandle, [ref]$foregroundProcessId)
   if ($foregroundProcessId -gt 0) {
    $foregroundProcess = Get-Process -Id $foregroundProcessId -ErrorAction Stop
    # Deliberately never read window titles, document names or keyboard input.
    $appName = $foregroundProcess.ProcessName
    $iconSource=try { $foregroundProcess.Path } catch { $null }
    @{state='active';idleMs=[Foreground]::IdleMs();appId=($appName.ToLowerInvariant()+'.exe');appName=$appName;iconSource=$iconSource} | ConvertTo-Json -Compress
   } else { @{state='unknown';reason='no-foreground-window'} | ConvertTo-Json -Compress }
  }
 } catch { if($Diagnostics){@{state='unknown';reason=$_.Exception.Message} | ConvertTo-Json -Compress}else{@{state='unknown'} | ConvertTo-Json -Compress} }
 Start-Sleep -Milliseconds 1500
}
