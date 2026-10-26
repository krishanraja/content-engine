import {readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {bundle} from '@remotion/bundler'
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer'
const root=process.argv[2], full=JSON.parse(readFileSync(join(root,'props.json'),'utf8')),old=JSON.parse(readFileSync(join(root,'../story-io/props.json'),'utf8'))
const serveUrl=await bundle({entryPoint:resolve('apps/renderer/src/border-control/packaging-entry.tsx')})
for(const mode of ['intro','outro']){
 const inputProps={mode,title:old.title,question:old.commentQuestion,wordmark:old.brand.wordmark,link:old.link,flags:['us','cn','fr','ae','in'].map(k=>full.assets[k])}
 writeFileSync(join(root,`packaging-${mode}.json`),JSON.stringify(inputProps))
 const composition=await selectComposition({serveUrl,id:'BorderPackaging',inputProps})
 await renderStill({serveUrl,composition,inputProps,frame:60,output:join(root,`${mode}-minimal.png`)})
 await renderMedia({serveUrl,composition,inputProps,codec:'h264',crf:16,muted:true,concurrency:2,outputLocation:join(root,`${mode}-minimal.mp4`)})
 console.log(`${mode}: ${composition.durationInFrames} frames`)
}
