import fs from 'node:fs';
import path from 'node:path';
const dir='android/app/build/generated/sharedAssets/web';fs.mkdirSync(dir,{recursive:true});
fs.cpSync('web',dir,{recursive:true});fs.cpSync('shared',path.join(dir,'shared'),{recursive:true});
const file=path.join(dir,'index.html');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('href="/style.css"','href="./style.css"').replaceAll('src="/app.js"','src="./app.js"'));
console.log('Shared UI and brand assets copied into Android assets.');
