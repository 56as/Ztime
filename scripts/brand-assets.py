"""Convert the selected master artwork into Windows, Android and UI icon resources."""
from pathlib import Path
import struct, json, sys
root=Path(__file__).resolve().parents[1]
# The selected AI artwork is the canonical source. Only format/size conversions
# happen here; never redraw an old logo when preparing a new release.
if '--version-only' not in sys.argv:
    from PIL import Image
    master=Image.open(root/'assets/icon-master.png').convert('RGBA')
    im=master.resize((256,256),Image.Resampling.LANCZOS)
    im.save(root/'assets/icon.png')
    im.save(root/'assets/icon.ico',sizes=[(v,v) for v in (16,24,32,48,64,128,256)])
    master.resize((128,128),Image.Resampling.LANCZOS).save(root/'web/brand-icon.png')
    android=root/'android/app/src/main/res/drawable-nodpi'
    android.mkdir(parents=True,exist_ok=True)
    master.resize((512,512),Image.Resampling.LANCZOS).save(android/'ztime_launcher.png')

def pad(b):return b+b'\0'*((-len(b))%4)
def block(key,value=b'',children=b'',text=False):
 head=pad(struct.pack('<HHH',0,len(value)//2 if text else len(value),int(text))+key.encode('utf-16le')+b'\0\0')
 out=head+value
 if children:out=pad(out)+children
 return struct.pack('<H',len(out))+out[2:]
version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
parts=[int(v) for v in version.split('.')]+[0]
strings={'CompanyName':'Ztime','FileDescription':'Ztime','FileVersion':version,'InternalName':'Ztime','OriginalFilename':'Ztime.exe','ProductName':'Ztime','ProductVersion':version,'LegalCopyright':'MIT License'}
entries=b''.join(pad(block(k,(v+'\0').encode('utf-16le'),text=True)) for k,v in strings.items())
info=block('StringFileInfo',children=block('040904b0',children=entries,text=True),text=True)
var=block('VarFileInfo',children=block('Translation',struct.pack('<HH',1033,1200)))
fixed=struct.pack('<13I',0xFEEF04BD,0x10000,(parts[0]<<16)|parts[1],(parts[2]<<16)|parts[3],(parts[0]<<16)|parts[1],(parts[2]<<16)|parts[3],0x3f,0,0x40004,1,0,0,0)
(root/'assets/version.bin').write_bytes(block('VS_VERSION_INFO',fixed,pad(info)+var))
print('Generated Ztime executable metadata for '+version)
