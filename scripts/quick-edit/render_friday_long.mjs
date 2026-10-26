import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {bundle} from '@remotion/bundler'
import {selectComposition,renderStill,renderMedia,openBrowser} from '@remotion/renderer'
const root=resolve(process.argv[2]),cut=process.argv[3]??'vo-5min',out=join(root,cut+'-render')
mkdirSync(out,{recursive:true})
const inputProps=JSON.parse(readFileSync(join(root,cut+'.json'),'utf8'))
const shortCamera=cut==='cam-90s'
const serveUrl=await bundle({entryPoint:resolve('apps/renderer/src/border-control/'+(shortCamera?'editorial-camera-entry.tsx':'editorial-long-entry.tsx')),publicDir:join(root,shortCamera?'public-short':'public')})
const browserInstance=await openBrowser('chrome',{browserExecutable:process.env.FRIDAY_BROWSER??null})
try{
 const composition=await selectComposition({serveUrl,id:shortCamera?'EditorialCameraShort':'EditorialLong',inputProps,puppeteerInstance:browserInstance})
 const filter=process.argv.find(a=>a.startsWith('--beats='))?.slice(8).split(',')
 for(const b of inputProps.beats.filter(b=>!filter||filter.includes(b.beat.slice(0,3)))){
  await renderStill({serveUrl,composition,inputProps,puppeteerInstance:browserInstance,frame:Math.min(inputProps.frames-1,Math.round((b.start+b.end)*15)),output:join(out,b.beat+'.png')})
  console.log(b.beat)
 }
 let last=-1
 const range=process.argv.find(a=>a.startsWith('--range='))?.slice(8).split(',').map(Number)
 if(process.argv.includes('--motion'))await renderMedia({serveUrl,composition,inputProps,puppeteerInstance:browserInstance,codec:'h264',crf:16,x264Preset:'fast',muted:true,concurrency:3,...(range?{frameRange:[range[0],range[1]]}:{}),onProgress:({progress})=>{const p=Math.floor(progress*10);if(p>last){last=p;console.log(new Date().toISOString()+' Motion '+p*10+'%')}},outputLocation:join(out,range?'motion-proof.mp4':'long-silent.mp4')})
 writeFileSync(join(out,'render.json'),JSON.stringify({status:'working_candidate',frames:inputProps.frames,source_clock:inputProps.source_clock,motion:process.argv.includes('--motion')},null,2))
}finally{await browserInstance.close({silent:true})}
