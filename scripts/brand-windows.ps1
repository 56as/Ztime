param([Parameter(Mandatory=$true)][string]$Executable)
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class ZtimeResources {
 delegate bool Names(IntPtr h,IntPtr type,IntPtr name,IntPtr data);
 delegate bool Langs(IntPtr h,IntPtr type,IntPtr name,ushort lang,IntPtr data);
 [DllImport("kernel32",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr LoadLibraryEx(string file,IntPtr zero,uint flags);
 [DllImport("kernel32")] static extern bool FreeLibrary(IntPtr h);
 [DllImport("kernel32",CharSet=CharSet.Unicode)] static extern bool EnumResourceNames(IntPtr h,IntPtr type,Names callback,IntPtr data);
 [DllImport("kernel32",CharSet=CharSet.Unicode)] static extern bool EnumResourceLanguages(IntPtr h,IntPtr type,IntPtr name,Langs callback,IntPtr data);
 [DllImport("kernel32",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr BeginUpdateResource(string file,bool delete);
 [DllImport("kernel32",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool UpdateResource(IntPtr h,IntPtr type,IntPtr name,ushort lang,byte[] data,uint size);
 [DllImport("kernel32",SetLastError=true)] static extern bool EndUpdateResource(IntPtr h,bool discard);
 static void Check(bool ok){if(!ok)throw new System.ComponentModel.Win32Exception();}
 public static void Apply(string exe,string icon,string version){
  var items=new List<int[]>();var lib=LoadLibraryEx(exe,IntPtr.Zero,2);if(lib==IntPtr.Zero)throw new System.ComponentModel.Win32Exception();
  try{foreach(int type in new[]{3,14,16})EnumResourceNames(lib,(IntPtr)type,(h,t,n,d)=>{int id=n.ToInt32();EnumResourceLanguages(h,t,n,(h2,t2,n2,l,d2)=>{items.Add(new[]{type,id,(int)l});return true;},IntPtr.Zero);return true;},IntPtr.Zero);}finally{FreeLibrary(lib);}
  var update=BeginUpdateResource(exe,false);if(update==IntPtr.Zero)throw new System.ComponentModel.Win32Exception();bool success=false;
  try{
   foreach(var i in items)Check(UpdateResource(update,(IntPtr)i[0],(IntPtr)i[1],(ushort)i[2],null,0));
   var ico=File.ReadAllBytes(icon);int count=BitConverter.ToUInt16(ico,4);
   using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){
    writer.Write((ushort)0);writer.Write((ushort)1);writer.Write((ushort)count);
    for(int i=0;i<count;i++){int at=6+i*16,size=BitConverter.ToInt32(ico,at+8),offset=BitConverter.ToInt32(ico,at+12);var bytes=new byte[size];Array.Copy(ico,offset,bytes,0,size);Check(UpdateResource(update,(IntPtr)3,(IntPtr)(i+1),1033,bytes,(uint)size));writer.Write(ico,at,12);writer.Write((ushort)(i+1));}
    var group=stream.ToArray();Check(UpdateResource(update,(IntPtr)14,(IntPtr)1,1033,group,(uint)group.Length));
   }
   var ver=File.ReadAllBytes(version);Check(UpdateResource(update,(IntPtr)16,(IntPtr)1,1033,ver,(uint)ver.Length));success=true;
  }finally{Check(EndUpdateResource(update,!success));}
 }
}
'@
$taskRoot=Split-Path -Parent $PSScriptRoot
[ZtimeResources]::Apply($Executable,(Join-Path $taskRoot 'assets/icon.ico'),(Join-Path $taskRoot 'assets/version.bin'))
