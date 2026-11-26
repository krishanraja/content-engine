/* Run by verify_static.py with measurements from the three local fonts. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const metrics=JSON.parse(fs.readFileSync(0,'utf8'));
const context=require('./offline_art.cjs').artworkContext(metrics);
assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify(registry)',context)),JSON.parse(fs.readFileSync('library.json')));
const bank=JSON.parse(fs.readFileSync('house-stills.json','utf8'));
assert.equal(bank.length,48);
for(const {id,provider,resolution,status,rejected_reason,...meta} of bank){
  if(status==='rejected'||status==='retired'){assert.equal(JSON.parse(vm.runInContext('JSON.stringify(photos['+JSON.stringify(id)+']??null)',context)),null);continue}
  assert.deepStrictEqual(JSON.parse(vm.runInContext('JSON.stringify(photos['+JSON.stringify(id)+'])',context)),meta);
}
// Inspect painted text independently of the fitter. A placeholder can wrap
// across several SVG lines, or exist only on the second beat of a clip.
function checkReviewCopy(svg, id) {
  for (const [,attrs,body] of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const text=body.replace(/<[^>]+>/g,'');
    if (!/[\[\]]/.test(text)) continue;
    if (/font-family="Mono"/.test(attrs) && ['[Camera: to camera]','[Approved headshot]'].includes(text)) continue;
    throw Error(id+' unresolved review text: '+text);
  }
}
function checkSampleFields(value, path) {
  if (value && typeof value==='object') {
    for (const [key,child] of Object.entries(value)) checkSampleFields(child,path+'.'+key);
  } else if (typeof value==='string' && /[\[\]]/.test(value)) {
    throw Error(path+' unresolved sample: '+value);
  }
}
for (const item of JSON.parse(fs.readFileSync('library.json')).items.filter(i=>i.status!=='retired')) {
  for (const key of ['scene','pieces','slots','sample']) checkSampleFields(item[key],item.id+'.'+key);
  checkSampleFields(item.motion?.excerpt,item.id+'.excerpt');
}
context.checkReviewCopy = checkReviewCopy;
const result=vm.runInContext(`(()=>{
 const errors=[],arts={},seen=new Set(),sequencesTested={},cameraSheets={};let captionStates=0;
 const captionText=markup=>[...markup.matchAll(/<g data-layer="captions"[^>]*>([^]*?)<[/]g>/g)]
   .map(group=>[...group[1].matchAll(/<tspan[^>]*>([^<]*)<[/]tspan>/g)].map(word=>word[1].trim()).join(' '));
 const plain=v=>String(v).toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
 const repeatsHeadline=(item,cue)=>{const said=plain(cue.words.join(' '));
   return (item.scene||[]).filter(op=>op.kind==='text').map(op=>plain(op.value)).some(v=>v===said||(v.length>8&&said.includes(v))||(said.length>8&&v.includes(said)))};
 const quietShot=(item,cue)=>['close','outro','statement-close','title'].includes(item.layout)||(cue&&repeatsHeadline(item,cue));
 const scriptLines=new Set([...Object.values(sequences),...items].flatMap(s=>
   (s.captions||[]).map(c=>c.words.map(esc).join(' '))));

 missingPhotos.add('headshot');
 for(const i of items){
  if(seen.has(i.id))throw Error('Duplicate '+i.id);seen.add(i.id);
  for(const t of new Set([0,(i.motion?.frames||1)-1,...(i.motion?.keyframes||[])])){
   try{const output=art(i,0,probe,t);checkReviewCopy(output,i.id+' at '+t);if(/NaN|undefined/.test(output))throw Error('invalid SVG');arts[i.id]=output}
   catch(e){errors.push(i.id+' '+t+' '+e.message)}
  }
 }
 for(const [name,seq] of Object.entries(sequences)){
  sequencesTested[name]=0;
  const boundaries=seq.shots.flatMap(s=>[s.start,s.start+1,s.start+9,s.start+s.frames-1]);
  for(const t of boundaries){try{
   const guides=(sequenceArt(seq,t,probe).match(/data-layer="platform-ui"/g)||[]).length;
   const shot=seq.shots.findLast(s=>s.start<=t);
   if(guides!==(seq.height>seq.width && !shot.item.endsWith('-outro')?1:0))errors.push(name+' guide count at '+t);
  }catch(e){errors.push(name+' at '+t+' '+e.message)}}
  for(const f of [0,.25,.5,.75,1]){
   try{sequenceArt(seq,Math.round((seq.frames-1)*f),probe);sequencesTested[name]++}catch(e){errors.push(name+' '+e.message)}
  }
  for(let t=0;t<seq.frames;t++){
   const shot=seq.shots.findLast(s=>s.start<=t),item=items.find(i=>i.id===(shot.slide||shot.item));
   const cue=seq.captions.find(c=>c.start<=t && t<c.end);
   try{
    const frame=sequenceArt(seq,t,probe),lines=captionText(frame);
    checkReviewCopy(frame,name+' at '+t);
    const index=seq.shots.indexOf(shot), before=index&&t-shot.start<10?seq.shots[index-1]:null;
    const silent=quietShot(item,cue)||frame.includes('href="#s3h"')||(before&&quietShot(items.find(i=>i.id===(before.slide||before.item))));
    const expected=!silent && cue ? cue.words.map(esc).join(' ') : '';
    // A punch cue shows one or two consecutive words of its line at a time.
    const fits=line=>cue?.style==='punch'?line.split(' ').length<=2&&expected.includes(line):line===expected;
    if(Boolean(lines.length)!==Boolean(expected) || lines.some(line=>!fits(line)))
      errors.push(name+' incomplete or misplaced caption at '+t);
   }catch(e){errors.push(name+' at '+t+' '+e.message)}
  }
  for(const c of seq.captions)for(const t of c.onsets){
   try{
    const frame=sequenceArt(seq,t,probe);
    const shot=seq.shots.findLast(s=>s.start<=t),item=items.find(i=>i.id===(shot.slide||shot.item));
    if(quietShot(item,c))continue;
    if(!/[.?!]$/.test(c.words.at(-1)) || !frame.includes('data-layer="captions"') || (seq.height>seq.width)!==frame.includes('data-layer="platform-ui"'))throw Error('caption or platform layer');
    captionStates++;
   }catch(e){errors.push(name+' at '+t+' '+e.message)}
  }
 }
 const edition=items.find(i=>i.layout==='weekly-edition');
 const filed=registry.items.find(i=>i.id===edition.id);
 if(JSON.stringify(edition)!==JSON.stringify(filed))errors.push('Weekly registry does not match its news');
 const examples=edition.news_groups.flatMap(g=>g.items);
 for(const size of [6,7,8,9,10])for(const groupCount of [2,3,4]){
   const groups=edition.news_groups.slice(0,groupCount).map(g=>({...g,items:[]}));
   for(let n=0;n<size;n++)groups[n%groupCount].items.push(examples[n%examples.length]);
   window.libraryContent={[edition.id]:{news_groups:groups}};
   const customised=editionContent(edition),output=art(edition,0,probe);
   if(customised.width!==600 || !artFrame(edition,0).includes('height="'+customised.height+'"') ||
      (output.match(/data-layer="news-source"/g)||[]).length!==size || (output.match(/<a href=/g)||[]).length!==size+1 || !output.includes('Forward them the edition.'))
     errors.push('Weekly edition layout for '+size+' stories in '+groupCount+' topics');
 }
 delete window.libraryContent;
 for(const v of ['system','grid'])try{reviewView(v)}catch(e){errors.push(v+' '+e.message)}
 for(const i of items){
  const sheet=art(i,400,probe);checkReviewCopy(sheet,i.id+' on sheet');
  if(sheet.includes('REFUSED:'))errors.push(i.id+' refused normal sheet example');
  const signed=sheet.includes('href="#s3h"') || ['close','outro','statement-close'].includes(i.layout);
  if(signed && sheet.includes('data-layer="captions"'))errors.push(i.id+' caption over a signature');
  if(i.family.startsWith('video-') && (sheet.includes('data-layer="captions"')===(signed||i.layout==='title') || !!arts[i.id]?.includes('data-layer="captions"')!==(['talking-head','captions'].includes(i.layout))))errors.push(i.id+' caption context');
  const guides=(sheet.match(/data-layer="platform-ui"/g)||[]).length;
  const tallMedia=i.height>=1.5*i.width && ['video-vertical','social','profile','future'].includes(i.family) && i.layout!=='bio';
  if(guides!==(i.preview_ui?1:0) || (tallMedia && !i.preview_ui))errors.push(i.id+' platform preview');
  if(i.family.startsWith('video-') && !signed && i.layout!=='title'){
   const cue=i.captions?.[0]||sequences.short.captions[0],colour=i.caption_surface==='colour';
   for(const [n,t] of cue.onsets.entries()){
    const caption=captionLayer(i,cue,t);
    const lit=[...caption.matchAll(/<tspan fill="([^"]+)"[^>]*>([^<]*)<[/]tspan>/g)].filter(m=>m[1]===(colour?cream:mint)).map(m=>m[2]);
    const size=Number((caption.match(/font-size="([0-9.]+)"/)||[])[1]);
    if(!(size>=(i.width>i.height?64:72)) ||
       (caption.match(/<text /g)||[]).length>2 || caption.includes('#caption-burn') ||
       lit.length!==1 || lit[0]!==esc(cue.words[n]) || (colour && !caption.includes('<rect ')))
     errors.push(i.id+' caption at '+t);
   }
  }
 }
 // Exercise the editorial silence even if a script extends through a closing push.
 for(const seq of Object.values(sequences)){
  const last=seq.shots.at(-1),cue={start:last.start,end:seq.frames,words:['It','counts.'],onsets:[last.start,last.start+1]};
  for(const t of [last.start,last.start+5,seq.frames-1]){
   if(sequenceArt({...seq,captions:[cue]},t,probe).includes('data-layer="captions"'))errors.push('Caption on '+(last.slide||last.item)+' at '+t);
  }
 }
 const slideshow=sequences.goodnews, closingSlide=slideshow.shots.at(-1), openingSlide=slideshow.shots[0];
 const returning={...slideshow,frames:60,shots:[{...closingSlide,start:0,frames:30},{...openingSlide,start:30,frames:30}],
   captions:[{start:0,end:60,words:['It','counts.'],onsets:[0,1]}]};
 for(const frame of [0,29,30,35,39,40,59]){
   if(Boolean(captionText(sequenceArt(returning,frame,probe)).length)!==(frame>=40))
     errors.push('Slideshow caption during the push from S3h at '+frame);
 }
 const documentCard=items.find(i=>i.id==='carousel-document');
 const evidencePath=photoRoot+crops['spotify-song-stream'].mobile.path;
 missingDocuments.add(evidencePath);
 if(!art(documentCard,400,probe).includes('source image unavailable'))errors.push('Missing source accepted on sheet');
 try{art(documentCard,0,probe);errors.push('Missing source accepted on export')}catch(e){if(!e.message.includes('source image unavailable'))throw e}
 missingDocuments.delete(evidencePath);
 const faceItems=items.filter(i=>i.scene?.some(op=>op.value==='headshot'));
 for(const i of faceItems)cameraSheets[i.id]=art(i,400,probe);
 if(photoURL('headshot')!=='')errors.push('Default review binds a headshot file');
 for(const i of faceItems){
  for(const proof of [art(i,0,probe),cameraSheets[i.id]]){
   if(proof.includes('.scratch/private/headshot.png') || !/\\[(?:Approved headshot|Camera: to camera)\\]/.test(proof))
    errors.push(i.id+' missing neutral camera guide');
  }
 }
 params.set('view','grid');
 for(const entry of registry.grid_proof){
  const i=items.find(row=>row.id===entry.item);
  if(art(i,300,probe).includes('data-layer="platform-ui"'))errors.push(i.id+' controls in profile crop');
 }
 params.delete('view');
 params.set('grid','1');
 for(const i of items){const svg=art(i,0,probe);if(/data-layer="platform-ui"|stroke-dasharray=/.test(svg))errors.push(i.id+' guide leaked into export')}
 params.delete('grid');
 let stressCases=0;
 for(const kind of ['short','long','word','nophoto','brightphoto','doc-long','numbers']){
  params.set('stress',kind);params.set('grid','1');
  for(const i of items)try{const svg=art(i,400,probe);if(/NaN|undefined/.test(svg))throw Error('invalid stress SVG');stressCases++}catch(e){errors.push(kind+' '+i.id+' '+e.message)}
 }
 params.delete('stress');params.delete('grid');
 window.libraryContent={'carousel-good-news-item':{body_1:'x'.repeat(1000)}};
 const nested=art(items.find(i=>i.id==='video-vertical-slideshow'),400,probe);
 if(!nested.includes('REFUSED: body_1 max_chars'))errors.push('Nested slot refusal missing');
 let refused=false;
 try{art(items.find(i=>i.id==='carousel-good-news-item'),0,probe)}catch(e){refused=e.message.includes('max_chars')}
 if(!refused)errors.push('Individual export accepted oversized copy');
 delete window.libraryContent;
  for(const deck of Object.values(registry.carousel_sets)){
    for(const edge of [deck.cover,deck.close]){
      if(!arts[edge] || !/href="#(?:v4|s3h)"/.test(arts[edge]))errors.push(edge+' missing signed deck boundary');
    }
    if(deck.inside.some(id=>!arts[id]))errors.push(deck.cover+' missing inside card');
  }
  for(const item of items.filter(i=>i.family==='carousel')){
    for(const [name,slot] of Object.entries(item.slots)){
      if(['photo','document','screenshot','logos'].includes(slot.role) &&
        (!Number.isInteger(slot.imagery_style)||slot.imagery_style<1||slot.imagery_style>5))errors.push(item.id+' '+name+' imagery style');
    }
  }
  for(const item of items.filter(i=>i.layout==='outro')){
    const tracks=item.motion.tracks,hold=item.motion.hold_from;
    if(tracks.some(track=>track.property==='pulse'?track.duration!==2:track.duration<5 || track.duration>12 || track.ease!==item.motion.easing) ||
      hold!==Math.max(...tracks.map(track=>track.start+track.duration)))errors.push(item.id+' motion timing');
    for(let t=0;t<item.motion.frames;t++){
      const output=art(item,0,probe,t);
      if(t<hold && (output.match(/data-sweep=/g)||[]).length!==4)errors.push(item.id+' sweep at '+t);
      const pulses=tracks.filter(s=>s.property==='pulse' && t>=s.start && t<s.start+s.duration).map(s=>s.element.slice(-1));
      if(pulses.join()!==Array.from(output.matchAll(/data-step-pulse="([1-4])"/g),m=>m[1]).join())errors.push(item.id+' step pulse at '+t);
      if((t===0)!==output.includes('data-roll="snap"'))errors.push(item.id+' snap at '+t);
      if(t>=hold && output!==arts[item.id])errors.push(item.id+' unsteady hold at '+t);
    }
    for(const name of ['make','your','disc','mind','up']){
      const track=tracks.find(k=>k.element===name);
      const mid=art(item,0,probe,track.start+1);
      if(!mid.includes('data-sign-part="'+name+'"') || art(item,0,probe,track.start).includes('data-sign-part="'+name+'"'))
        errors.push(item.id+' '+name+' entrance');
    }
  }
  for(const item of items){
    for(const [slot,rule] of Object.entries(item.slots)){
      const choices=bankChoices(registry,item,slot);
      if(choices.some(([,s])=>rule.source_only || s.imagery_style!==rule.imagery_style || (rule.aspect && s.aspect!==rule.aspect)))errors.push(item.id+' bank filter');
      const op=item.scene?.find(op=>op.slot===slot);
      if(op?.value?.startsWith?.('bank-') && !choices.some(([key])=>key===op.value))errors.push(item.id+' review default missing from picker');
    }
  }
  const bankCard=items.find(i=>i.id==='carousel-cover'), slot='photo_1';
  // The first bank is retired: the picker offers nothing and a retired still is refused.
  if(items.some(item=>Object.keys(item.slots).some(name=>bankChoices(registry,item,name).length)))errors.push('Retired bank still offered');
  for(const retired of ['bank-10','bank-30','bank-09']){
    window.libraryContent={[bankCard.id]:{[slot]:retired}};
    if(!art(bankCard,400,probe).includes('REFUSED: photo_1'))errors.push('Retired bank still accepted');
  }
  const dated=items.find(i=>i.id==='carousel-good-news-cover');
  window.libraryContent={[dated.id]:{[slot]:'bank-01'}};
  if(!art(dated,400,probe).includes('REFUSED: photo_1'))errors.push('Stock accepted for a reported event');
  delete window.libraryContent;
  const cover=items.find(i=>i.id==='carousel-howto-cover'),inside=items.find(i=>i.id==='carousel-howto-step');
  window.libraryContent={[cover.id]:{document_1:'',headline_1:'Listen for thirty seconds'},[inside.id]:{tools:['claude'],counter:'04 / 10'}};
  const changedCover=art(cover,0,probe),changedStep=art(inside,0,probe);
  if(changedCover.includes('data-align-name="source logo"') || !changedStep.includes('04 / 10') ||
     changedStep.includes(registry.tool_logos.chatgpt.src))errors.push('Carousel content override');
  window.libraryContent[inside.id].screenshot_1='absent';
  if(!art(inside,400,probe).includes('REFUSED: screenshot_1'))errors.push('Source screenshot fallback');
  delete window.libraryContent;
 return {arts,errors,sequencesTested,stressCases,captionStates,cameraSheets}
})()`,context);
// Exercise the host's generator callback and subsequent draw without a browser.
context.Image=class {constructor(){this.naturalWidth=2048;this.naturalHeight=2560} async decode(){}};
vm.runInContext(`(async()=>{
 const id='carousel-howto-step',slot='photo_1';
 const record=await window.generateCarouselImage(id,slot,'A short reel on the editing desk.',async brief=>{
  if(brief.imagery_style!==4 || brief.size[1]!==2560)throw Error('Image brief');
  return {src:'media/test-generated.webp',model:'test adapter',credits:0,date:'2026-11-25'};
 });
 if(!art(items.find(i=>i.id===id),0,probe).includes(record.src))throw Error('Generated photo not drawn');
 for(const [name,key] of [['carousel-howto-step','screenshot_1'],['carousel-good-news-item','photo_1']]){
  let refused=false;
  try{carouselImageBrief(registry,name,key,'A replacement.')}catch{refused=true}
  if(!refused)throw Error('Original evidence accepted as a generation slot');
 }
})()`,context).then(()=>process.stdout.write(JSON.stringify(result))).catch(e=>{console.error(e);process.exitCode=1});

