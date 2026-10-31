import https from 'node:https';
import fs from 'node:fs';
import dgram from 'node:dgram';
import {X509Certificate,randomUUID,createHash} from 'node:crypto';
const data=process.argv[2]||'dist/TimeLedger-windows-x64/data';
const host=process.argv[3]||'127.0.0.1';
const pin=new X509Certificate(JSON.parse(fs.readFileSync(data+'/tls.json','utf8')).cert).fingerprint256.replaceAll(':','').toLowerCase();
const tls=await new Promise((resolve,reject)=>{
 const req=https.request({host,port:40327,path:'/v1/pair',method:'POST',rejectUnauthorized:false,timeout:5000,headers:{'content-type':'application/json'}},res=>{
  let body='';res.on('data',x=>body+=x);res.on('end',()=>{if(res.statusCode!==403)return reject(new Error('Unexpected response '+res.statusCode));resolve({status:res.statusCode,reachable:true,certificatePinned:true});});
 });
 req.on('socket',socket=>socket.once('secureConnect',()=>{const actual=createHash('sha256').update(socket.getPeerCertificate().raw).digest('hex');if(actual!==pin)req.destroy(new Error('Certificate pin mismatch'));}));
 req.on('timeout',()=>req.destroy(new Error('TLS timeout')));req.on('error',reject);req.end('{"code":"000000"}');
});
const socket=dgram.createSocket('udp4');
try{
 const discovery=await new Promise((resolve,reject)=>{const nonce=randomUUID(),timer=setTimeout(()=>reject(new Error('Discovery timeout')),3000);socket.once('message',raw=>{clearTimeout(timer);try{const reply=JSON.parse(raw);if(reply.nonce!==nonce||reply.pin!==pin)throw new Error('Discovery identity mismatch');resolve({reachable:true,identityVerified:true});}catch(e){reject(e);}});socket.once('error',e=>{clearTimeout(timer);reject(e);});socket.send(Buffer.from(JSON.stringify({service:'time-ledger',type:'discover',nonce})),40328,host);});
 console.log(JSON.stringify({host,tls,discovery,note:'Local computer probe; phone reachability requires a phone retry.'}));
}finally{socket.close();}
