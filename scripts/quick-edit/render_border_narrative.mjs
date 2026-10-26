import {readFileSync,mkdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {bundle} from '@remotion/bundler'
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer'
const job=JSON.parse(readFileSync(process.argv[2],'utf8'))
const inputProps=JSON.parse(readFileSync(job.props,'utf8'))
mkdirSync(job.out,{recursive:true})
const serveUrl=await bundle({entryPoint:resolve('apps/renderer/src/border-control/narrative-entry.tsx')})
const composition=await selectComposition({serveUrl,id:'Narrative',inputProps})
for(const frame of [50,135,200,310,400,590,700,866])await renderStill({serveUrl,composition,inputProps,frame,output:join(job.out,`frame-${frame}.png`)})
console.log('Eight proof states rendered')
if(!job.stillsOnly)await renderMedia({serveUrl,composition,inputProps,codec:'h264',crf:16,concurrency:2,muted:true,outputLocation:join(job.out,'narrative-silent.mp4')})
console.log('Narrative proof render complete')
