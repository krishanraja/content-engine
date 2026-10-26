import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {bundle} from '@remotion/bundler'
import {openBrowser,selectComposition,renderMedia} from '@remotion/renderer'
const work=resolve(process.argv[2]),out=join(work,'shipping-candidates');mkdirSync(out,{recursive:true})
const serveUrl=await bundle({entryPoint:resolve('apps/renderer/src/border-control/packaging-entry.tsx')})
const browser=await openBrowser('chrome',{browserExecutable:process.env.FRIDAY_BROWSER??null})
try{
for(const [name,cut] of [['cam-short','cam-90s'],['cam-long','cam-5min'],['vo-long','vo-5min']]){
 const edit=JSON.parse(readFileSync(join(out,name+'-edit.json'),'utf8')),p=JSON.parse(readFileSync(join(work,'long-production',cut+'.json'),'utf8'))
 const closeSource=Math.round(p.beats.at(-1).start*30)/30-.1
 const span=edit.spans.find(s=>s.source===name&&s.a<=closeSource&&s.b>closeSource)
 if(!span)throw Error('Close outside retained timeline')
 const frames=Math.ceil(edit.seconds*30),close=Math.round((closeSource-span.a+span.off)*30)
 const wide=name!=='cam-short',shape=wide?'wide':'tall'
 for(const mode of ['intro','outro']){
  if(mode==='intro'&&name==='vo-long')continue
  const props=JSON.parse(readFileSync(join(work,'full-short','packaging-'+mode+'.json'),'utf8'))
  props.width=wide?1920:1080;props.height=wide?1080:1920;props.frames=mode==='intro'?105:frames-close+180;props.brandFrame=props.frames-90
  const composition=await selectComposition({serveUrl,id:'BorderPackaging',inputProps:props,puppeteerInstance:browser})
  await renderMedia({serveUrl,composition,inputProps:props,puppeteerInstance:browser,codec:'h264',crf:16,x264Preset:'fast',concurrency:2,muted:true,outputLocation:join(out,mode==='intro'?'intro-'+shape+'.mp4':name+'-outro.mp4')})
 }
 writeFileSync(join(out,name+'-packaging.json'),JSON.stringify({frames,close,final_frames:frames+285,intro_frames:105,outro_frames:frames-close+180},null,2));console.log(name,'packaging rendered')
}
}finally{await browser.close({silent:true})}
