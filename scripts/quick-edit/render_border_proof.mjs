import {readFileSync, writeFileSync} from 'node:fs'
import {resolve, join} from 'node:path'
import {bundle} from '@remotion/bundler'
import {selectComposition, renderMedia, renderStill} from '@remotion/renderer'

const job=JSON.parse(readFileSync(process.argv[2],'utf8'))
const props=JSON.parse(readFileSync(job.props,'utf8'))
const serveUrl=await bundle({entryPoint:resolve('apps/renderer/src/border-control/proof-entry.tsx')})
const opts=job.browser?{browserExecutable:job.browser}:{}
for (const shape of ['tall','wide']) {
  const inputProps={...props,shape}
  const composition=await selectComposition({serveUrl,id:'BorderControlProof',inputProps,...opts})
  for (const frame of [145,285,430]) {
    await renderStill({serveUrl,composition,inputProps,frame,output:join(job.out,`${shape}-${frame}.png`),...opts})
  }
  console.log(`${shape}: three full-size frames rendered`)
  await renderMedia({serveUrl,composition,inputProps,codec:'h264',crf:16,muted:true,
    concurrency:2,outputLocation:join(job.out,`proof-${shape}-silent.mp4`),...opts})
  console.log(`${shape}: ${composition.durationInFrames} frames rendered`)
}
writeFileSync(join(job.out,'render-receipt.json'),JSON.stringify({status:'visual-study-not-deliverable',frames:props.frames,shapes:['tall','wide']},null,2))
