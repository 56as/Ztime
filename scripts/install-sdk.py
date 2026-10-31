"""Install official SDK archives with their repository-provided SHA-1 checksums."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request,zipfile,hashlib,xml.etree.ElementTree as E
root=Path(__file__).resolve().parents[1]/'.tools';sdk=root/'android-sdk';sdk.mkdir(exist_ok=True)
base='https://dl.google.com/android/repository/'
with urllib.request.urlopen(base+'repository2-1.xml',timeout=30) as r: repository=E.fromstring(r.read())
targets={'platforms;android-35':('platform-35_r02.zip',sdk/'platforms'/'android-35'),'build-tools;35.0.0':('build-tools_r35_windows.zip',sdk/'build-tools'/'35.0.0'),'platform-tools':(None,sdk/'platform-tools')}
jobs=[]
for pkg,(wanted,dest) in targets.items():
 if dest.exists():continue
 for p in repository.findall('remotePackage'):
  if p.attrib['path']!=pkg:continue
  for archive in p.findall('archives/archive'):
   if archive.findtext('host-os') not in [None,'windows']:continue
   name=archive.findtext('complete/url')
   if wanted and name!=wanted:continue
   jobs.append((name,archive.findtext('complete/checksum'),dest));break
  else:continue
  break
def install(job):
 name,checksum,dest=job;file=root/name
 print('Downloading '+name,flush=True)
 for attempt in range(4):
  try:
   with urllib.request.urlopen(base+name,timeout=20) as source,file.open('wb') as out:
    while part:=source.read(1024*1024):out.write(part)
   break
  except Exception:
   if attempt==3:raise
   print('Retry '+name,flush=True)
 if hashlib.sha1(file.read_bytes()).hexdigest()!=checksum:raise RuntimeError('SDK checksum mismatch: '+name)
 dest.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(file) as z:
  entries=z.infolist();prefix=entries[0].filename.split('/')[0]+'/'
  for entry in entries:
   relative=entry.filename.removeprefix(prefix)
   if not relative:continue
   path=(dest/relative).resolve()
   if not path.is_relative_to(dest.resolve()):raise RuntimeError('Unsafe SDK archive path')
   if entry.is_dir():path.mkdir(parents=True,exist_ok=True)
   else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(z.read(entry))
 print('Installed '+name,flush=True)
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(install,jobs))
licenses=sdk/'licenses';licenses.mkdir(exist_ok=True)
for license in repository.findall('license'):
 text=''.join(license.itertext()).strip()
 (licenses/license.attrib['id']).write_text(hashlib.sha1(text.encode()).hexdigest()+'\n',encoding='utf-8')
print('SDK ready',flush=True)
