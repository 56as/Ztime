"""Download a project-local Android build toolchain. No system PATH changes."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request, zipfile, hashlib, json
ROOT=Path(__file__).resolve().parents[1]/'.tools'
ROOT.mkdir(exist_ok=True)
items=[
 ('jdk','https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip',None),
 ('gradle','https://repo.huaweicloud.com/gradle/gradle-8.13-bin.zip',None),
 ('android-tools','https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip',None)]
def get(item):
 name,url,checksum=item
 target=ROOT/(name+'.zip');dest=ROOT/name
 if dest.exists():return str(dest)
 print('Downloading '+name,flush=True)
 with urllib.request.urlopen(url,timeout=30) as source, target.open('wb') as output:
  while chunk:=source.read(1024*1024):output.write(chunk)
 if checksum and hashlib.sha256(target.read_bytes()).hexdigest()!=checksum:raise RuntimeError('Checksum mismatch: '+name)
 # Constrain all archive output paths to this project's toolchain directory.
 with zipfile.ZipFile(target) as z:
  for entry in z.infolist():
   path=(dest/entry.filename).resolve()
   if not path.is_relative_to(dest.resolve()):raise RuntimeError('Unsafe archive path')
  z.extractall(dest)
 print('Ready '+name,flush=True)
 return str(dest)
with ThreadPoolExecutor(max_workers=3) as pool:
 print(json.dumps(list(pool.map(get,items))),flush=True)
