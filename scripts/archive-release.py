"""Archive binaries and tracked/trackable source; never include personal data."""
from pathlib import Path
import zipfile,subprocess,hashlib,json
root=Path(__file__).resolve().parents[1];dist=root/'dist'
program=dist/'TimeLedger-windows-x64'
with zipfile.ZipFile(dist/'Ztime-windows-x64.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in program.rglob('*'):
  relative=p.relative_to(program)
  if 'data' in relative.parts:continue
  if p.is_file():z.write(p,Path(program.name)/relative)
files=subprocess.check_output(['git','-c','safe.directory='+str(root),'ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode('utf-8').split('\0')
with zipfile.ZipFile(dist/'Ztime-source.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for name in files:
  if not name:continue
  p=root/name
  if p.is_file():z.write(p,Path('time-ledger')/name)
paths=[dist/'Ztime-windows-x64.zip',dist/'Ztime-android-debug.apk',dist/'Ztime-source.zip']
manifest=[]
for p in paths:
 digest=hashlib.sha256(p.read_bytes()).hexdigest();manifest.append({'file':p.name,'bytes':p.stat().st_size,'sha256':digest})
(dist/'SHA256SUMS.txt').write_text('\n'.join(m['sha256']+'  '+m['file'] for m in manifest)+'\n',encoding='utf-8')
(dist/'release-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(manifest,indent=2))
