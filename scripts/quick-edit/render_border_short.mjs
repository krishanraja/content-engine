import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {bundle} from '@remotion/bundler'
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer'
const job=JSON.parse(readFileSync(process.argv[2],'utf8'))
const props=JSON.parse(readFileSync(job.props,'utf8'))
mkdirSync(job.out,{recursive:true})
const serveUrl=await bundle({entryPoint:resolve('apps/renderer/src/border-control/short-entry.tsx'),publicDir:job.public})
const opts=job.browser?{browserExecutable:job.browser}:{}
const composition=await selectComposition({serveUrl,id:'BorderControlShort',inputProps:props,...opts})
for(const beat of props.beats){
 const frame=Math.min(props.frames-1,Math.round(((beat.start+beat.end)/2)*30))
 await renderStill({serveUrl,composition,inputProps:props,frame,output:join(job.out,beat.beat+'.png'),...opts})
}
console.log('All 14 held beats rendered')
if(!job.stillsOnly){
 await renderMedia({serveUrl,composition,inputProps:props,codec:'h264',crf:16,muted:true,concurrency:2,outputLocation:join(job.out,'short-motion-silent.mp4'),...opts})
 console.log('Full short motion rendered: '+props.frames+' frames')
}
writeFileSync(join(job.out,'render.json'),JSON.stringify({status:'working-render',frames:props.frames,stillsOnly:!!job.stillsOnly},null,2))
