// Inline shared assets in the files served by the already-running, allowlisted review server.
import fs from 'node:fs';
const check=process.argv.includes('--check');
for(const [source,target,css] of [
 ['web/desktop-insights.js','design/review/review.js',false],
 ['web/desktop-insights.css','design/review/boards/style.css',true]
]){
 const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
 const begin=css?'/* @generated desk-preview:start */':'// @generated desk-preview:start';
 const end=css?'/* @generated desk-preview:end */':'// @generated desk-preview:end';
 const prev=read(target), start=prev.indexOf(begin), stop=prev.indexOf(end,start+begin.length);
 if(start<0||stop<0)throw Error('Missing review markers: '+target);
 const src=read(source).replace(/^export /gm,'').trimEnd();
 const next=prev.slice(0,start)+begin+'\n'+src+'\n'+prev.slice(stop);
 if(prev!==next){if(check)throw Error('Run node scripts/build-review-insights.mjs');fs.writeFileSync(target,next);}
}
