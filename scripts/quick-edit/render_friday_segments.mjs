// Render moving portions once. Reuse a held frame only after a pixel-identical
// end-state check. Speech and final release timing are deliberately absent here.
import {readFileSync,mkdirSync,writeFileSync,copyFileSync,existsSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {bundle} from '@remotion/bundler'
import {openBrowser,selectComposition,renderStill,renderMedia} from '@remotion/renderer'
const root=resolve(process.argv[2]),cut=process.argv[3]??'vo-5min'
if(!['vo-5min','cam-5min'].includes(cut))throw Error('Long photographic stage only')
const p=JSON.parse(readFileSync(join(root,cut+'.json'),'utf8'));delete p.camera
const out=join(root,cut+'-segments');mkdirSync(out,{recursive:true})
const ff=process.env.FRIDAY_FFMPEG;if(!ff)throw Error('Set FRIDAY_FFMPEG to the verified local binary')
const fp=join(resolve(ff,'..'),'ffprobe.exe')
const serveUrl=await bundle({entryPoint:resolve('apps/renderer/src/border-control/editorial-long-entry.tsx'),publicDir:join(root,'public')})
const browserInstance=await openBrowser('chrome',{browserExecutable:process.env.FRIDAY_BROWSER??null})
const cap={1:60,2:60,3:90,4:90,5:110,6:100,7:1,8:75,9:75,10:120,11:120,12:80,13:80,14:75,15:65,16:80,17:80,18:1,19:100,20:100,21:75,22:95,23:105,24:75,25:80,26:75,27:1,28:70,30:1,33:1,36:75,37:100,38:120,39:120,40:280,41:1}
const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex')
const manifest={status:'raw_clock_silent_stage_not_release',cut,props_sha256:hash(join(root,cut+'.json')),frames:p.frames,segments:[]}
const previousPath=join(out,'manifest.json')
const previous=existsSync(previousPath)?JSON.parse(readFileSync(previousPath,'utf8')):null
if(previous&&previous.props_sha256!==manifest.props_sha256)throw Error('Existing segments have different props; use a new output directory')
try{
 const composition=await selectComposition({serveUrl,id:'EditorialLong',inputProps:p,puppeteerInstance:browserInstance})
 for(let i=0;i<p.beats.length;i++){
  const b=p.beats[i],n=Number(b.beat.slice(1,3)),start=i===0?0:Math.round(b.start*30)-3,end=i===p.beats.length-1?p.frames:Math.round(b.end*30)-3,duration=end-start;let moving=Math.min(duration,cap[n]??duration)
  const clip=join(out,b.beat+'.mp4'),body=join(out,b.beat+'-motion.mp4')
  const saved=previous?.segments.find(s=>s.beat===b.beat)
  if(saved&&saved.start===start&&saved.end===end&&existsSync(clip)&&hash(clip)===saved.sha256){
   manifest.segments.push(saved);console.log(new Date().toISOString(),b.beat,'verified existing segment');continue
  }
  let holdProof=null
  if(moving<duration){
   const a=join(out,b.beat+'-hold.png'),z=join(out,b.beat+'-end.png')
   await renderStill({serveUrl,composition,inputProps:p,puppeteerInstance:browserInstance,timeoutInMilliseconds:120000,frame:start+moving-1,output:a})
   await renderStill({serveUrl,composition,inputProps:p,puppeteerInstance:browserInstance,timeoutInMilliseconds:120000,frame:end-1,output:z})
   holdProof={hold:hash(a),end:hash(z)}
   if(holdProof.hold!==holdProof.end){console.log(b.beat,'motion continues: rendering complete scene');moving=duration;holdProof=null}
  }
  await renderMedia({serveUrl,composition,inputProps:p,puppeteerInstance:browserInstance,timeoutInMilliseconds:120000,frameRange:[start,start+moving-1],codec:'h264',crf:14,x264Preset:'fast',muted:true,concurrency:2,outputLocation:body})
  if(moving===duration)copyFileSync(body,clip)
  else execFileSync(ff,['-v','error','-y','-i',body,'-vf',`tpad=stop_mode=clone:stop_duration=${(duration-moving)/30},fps=30`,'-frames:v',String(duration),'-an','-c:v','libx264','-preset','fast','-crf','14','-threads','3','-pix_fmt','yuv420p',clip],{stdio:'pipe'})
  const probe=JSON.parse(execFileSync(fp,['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames','-of','json',clip],{encoding:'utf8'}))
  if(Number(probe.streams[0].nb_frames)!==duration)throw Error('Frame-count mismatch: '+b.beat)
  manifest.segments.push({beat:b.beat,start,end,frames:duration,moving_frames:moving,hold_proof:holdProof,sha256:hash(clip)})
  writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(new Date().toISOString(),b.beat,moving+'/'+duration)
 }
 for(const segment of manifest.segments)execFileSync(ff,['-v','error','-y','-i',join(out,segment.beat+'.mp4'),'-map','0:v:0','-c','copy','-video_track_timescale','90000',join(out,segment.beat+'-normalized.mp4')],{stdio:'pipe'})
 const list=join(out,'concat.txt');writeFileSync(list,manifest.segments.map(s=>`file '${s.beat}-normalized.mp4'`).join('\n'))
 const final=join(out,'raw-clock-silent-stage.mp4')
 execFileSync(ff,['-v','error','-y','-f','concat','-safe','0','-i',list,'-an','-c:v','copy','-video_track_timescale','90000','-movflags','+faststart',final],{stdio:'pipe'})
 const finalProbe=JSON.parse(execFileSync(fp,['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,duration','-of','json',final],{encoding:'utf8'}));if(Number(finalProbe.streams[0].nb_frames)!==p.frames)throw Error('Final frame count mismatch');manifest.final_probe=finalProbe;manifest.output_sha256=hash(final);writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log('Silent stage assembled; no audio or release approval')
}finally{await browserInstance.close({silent:true})}
