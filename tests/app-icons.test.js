import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createAppIcons,initialIcon} from '../desktop/app-icons.js';

test('letter tiles use the displayed name and remain stable across repeated lookups',()=>{
 for(const [name,letter] of [['设置','S'],['相机','X'],['Setup','S'],['123','1'],['<','\u0023']]){
  const icon=initialIcon(name,'id');
  assert.ok(icon.data.includes('>'+letter+'</text>'));
  assert.equal(icon.data,initialIcon(name,'id').data);
 }
});

test('known package artwork and unknown packages with different names resolve independently',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ztime-icon-test-'));
 try{
  const icons=createAppIcons(dir);
  for(const [platform,id] of [['windows','EXCEL.EXE'],['android','com.eg.android.AlipayGphone']]){
   const file=new URL('../assets/app-icons/catalog/'+platform+'/'+(platform==='windows'?id.toLowerCase():id)+'.png',import.meta.url);
   assert.deepEqual((await icons.get(platform,id,'example')).data,await readFile(file));
  }
  const [a,b]=await Promise.all(['相机','浏览'].map(name=>icons.get('android','example.unknown',name)));
  assert.match(a.data,/>X<\/text>/);assert.match(b.data,/>L<\/text>/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
