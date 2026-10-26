import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {bundle} from '@remotion/bundler'
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer'
const work=resolve(process.argv[2]),out=join(work,'motion-v7')
mkdirSync(out,{recursive:true})
const props=JSON.parse(readFileSync(join(work,'motion-v6/short-props.json'),'utf8'))
const beat=props.beats.find(x=>x.beat==='S12-call')
const start=Math.round(beat.start*30)-3,end=Math.round(beat.end*30)-3
const close=Math.round(props.beats.find(x=>x.beat==='S14-close').start*30)-3
const serveUrl=await bundle({entryPoint:resolve('apps/renderer/src/border-control/editorial-entry.tsx'),publicDir:join(work,'full-short/public')})
const composition=await selectComposition({serveUrl,id:'EditorialShort',inputProps:props})
for(const f of [40,60,80,100,120,150])await renderStill({serveUrl,composition,inputProps:props,frame:start+f,output:join(out,`passport-${f}.png`)})
await renderMedia({serveUrl,composition,inputProps:props,frameRange:[start,end-1],codec:'h264',crf:16,muted:true,concurrency:2,outputLocation:join(out,'passport-patch.mp4')})
console.log('Passport motion patch rendered')
const packaging=JSON.parse(readFileSync(join(work,'full-short/packaging-outro.json'),'utf8'))
packaging.frames=180+props.frames-close
packaging.brandFrame=packaging.frames-90
const outroUrl=await bundle({entryPoint:resolve('apps/renderer/src/border-control/packaging-entry.tsx')})
const outro=await selectComposition({serveUrl:outroUrl,id:'BorderPackaging',inputProps:packaging})
await renderMedia({serveUrl:outroUrl,composition:outro,inputProps:packaging,codec:'h264',crf:16,muted:true,concurrency:2,outputLocation:join(out,'continuous-outro.mp4')})
writeFileSync(join(out,'revision.json'),JSON.stringify({status:'candidate',start:start+105,end:end+105,close:close+105,total:2547,outroFrames:packaging.frames,brandFrame:packaging.brandFrame,audioChange:false},null,2))
console.log('Continuous ending rendered')
