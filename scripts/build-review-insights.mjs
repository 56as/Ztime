// Inline shared assets in the files served by the already-running, allowlisted review server.
import fs from 'node:fs';
const check=process.argv.includes('--check');
for(const [source,target,css,feature] of [
 ['web/desktop-insights.js','design/review/review.js',false],
 ['web/desktop-insights.css','design/review/boards/style.css',true],
 ['web/timing-settings.js','design/review/review.js',false,'timing'],
 ['web/timing-settings.css','design/review/boards/style.css',true,'timing']
]){
 const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
 const begin=css?'/* @generated desk-preview:start */':'// @generated desk-preview:start';
 const end=css?'/* @generated desk-preview:end */':'// @generated desk-preview:end';
 const first=begin.replace('desk-preview',feature||'desk-preview'),last=end.replace('desk-preview',feature||'desk-preview');
 const prev=read(target), start=prev.indexOf(first), stop=prev.indexOf(last,start+first.length);
 if(start<0||stop<0)throw Error('Missing review markers: '+target);
 const src=(css||feature?read(source):read('shared/desktop-card-layout.js')+'\n'+read('shared/rank-initial.js')+'\n'+read(source)).replace(/^export /gm,'').trimEnd();
 const next=prev.slice(0,start)+first+'\n'+src+'\n'+prev.slice(stop);
 if(prev!==next){if(check)throw Error('Run node scripts/build-review-insights.mjs');fs.writeFileSync(target,next);}
}
