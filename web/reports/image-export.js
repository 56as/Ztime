async function raster(svg){
 const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth*2;canvas.height=img.naturalHeight*2;
 canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
 return canvas;
}
const encode=(canvas,type)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('无法生成图像')),type,.96));
// One A4 page containing the same high-resolution sheet; no external fonts or services.
async function imagePdf(canvas){
 const jpeg=new Uint8Array(await (await encode(canvas,'image/jpeg')).arrayBuffer());
 const chunks=[],offset=[0];let length=0;
 const add=s=>{const bytes=typeof s==='string'?new TextEncoder().encode(s):s;chunks.push(bytes);length+=bytes.length;};
 const obj=(n,parts)=>{offset[n]=length;add(n+' 0 obj\n');for(const p of parts)add(p);add('\nendobj\n');};
 add('%PDF-1.4\n');obj(1,['<< /Type /Catalog /Pages 2 0 R >>']);obj(2,['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
 obj(3,['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Sheet 4 0 R >> >> /Contents 5 0 R >>']);
 obj(4,[`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg,'\nendstream']);
 const scale=Math.min(559/canvas.width,806/canvas.height),w=scale*canvas.width,h=scale*canvas.height;
 const draw=`q ${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${((595-w)/2).toFixed(3)} ${(842-18-h).toFixed(3)} cm /Sheet Do Q\n`;
 obj(5,[`<< /Length ${draw.length} >>\nstream\n`,draw,'endstream']);
 const start=length;add('xref\n0 6\n0000000000 65535 f \n');for(const off of offset.slice(1))add(String(off).padStart(10,'0')+' 00000 n \n');
 add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);return new Blob(chunks,{type:'application/pdf'});
}
export async function graphicExport(svg,format){
 const canvas=await raster(svg);return format==='png'?encode(canvas,'image/png'):imagePdf(canvas);
}

