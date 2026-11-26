function bankChoices(library,item,slot) {
  const rule=item.slots[slot];
  if(rule?.role!=='photo' || rule.source_only || !rule.imagery_style)return [];
  const aspect=rule.aspect || (item.width>item.height?'16:9':item.height>item.width*1.5?'9:16':'4:5');
  return Object.entries(library.photos).filter(([id,still])=>id.startsWith('bank-') &&
    still.imagery_style===rule.imagery_style && still.aspect===aspect);
}
/* Producer handoff for generated photography. Evidence has a separate source registry. */
function carouselImageBrief(library, id, slot, scene) {
  const item=library.items.find(row=>row.id===id && row.family==='carousel');
  const rule=item?.slots[slot];
  if(rule?.role!=='photo' || rule.source_only)throw Error(id+' '+slot+' requires original evidence or a licensed photograph');
  const moment=(scene || rule.scene_brief).trim();
  if(!moment || moment.includes('['))throw Error('Supply the moment that acts out this slide');
  const style=rule.imagery_style, house=library.imagery;
  return {item:id,slot,imagery_style:style,size:house.size,aspect:house.aspect,
    prompt:house.styles[style]+'. '+moment+' '+house.directions[style]+' Cinematic, photoreal, lit from the side. The subject occupies the upper 60%; the lower 40% falls into near-black. Slight film grain, ink shadows, cream highlights and one mint accent. No lettering, logos or readable screens. Any people are fictional adults. Vertical 4:5.'};
}
function acceptCarouselImage(library, id, slot, record) {
  const rule=library.items.find(i=>i.id===id && i.family==='carousel')?.slots[slot];
  if(rule?.source_only && rule.role==='photo'){
    if(!record?.src || !record.source || !record.credit)throw Error(id+' '+slot+' needs the original photograph and credit');
    return id+'/'+slot;
  }
  if(rule?.role!=='photo' || !record || record.imagery_style!==rule.imagery_style ||
     !record.src || !record.prompt?.trim() || !record.model?.trim() || !record.date ||
     !Number.isFinite(record.credits) || record.credits<0)throw Error(id+' '+slot+' incomplete generated image record');
  return id+'/'+slot;
}
function registerCarouselEvidence(library, evidence={}) {
  for(const [key,logo] of Object.entries(evidence.tool_logos||{})){
    if(!logo.src || !logo.name)throw Error(key+' needs the original logo and its name');
    library.tool_logos[key]=logo;
  }
  for(const [key,shot] of Object.entries(evidence.screenshots||{})){
    if(!shot.src || !shot.source || !shot.size?.every(n=>Number.isFinite(n) && n>0) ||
       shot.size.length!==2 || !Array.isArray(shot.crops) || !shot.crops.length)throw Error(key+' incomplete source screenshot');
    if(shot.crops.some(r=>!Array.isArray(r) || r.length!==4 || !r.every(Number.isFinite) ||
        r[0]<0 || r[1]<0 || r[2]<=0 || r[3]<=0 || r[0]+r[2]>shot.size[0] || r[1]+r[3]>shot.size[1]))
      throw Error(key+' crop outside the source screenshot');
    library.screenshots[key]={...shot,background:'#f5f5f5',edge:'#7EF0C0'};
  }
}
if(typeof process!=='undefined' && /(?:^|[\\/])imagery\.js$/.test(process.argv[1]||'')){
  (async()=>{
    const {readFileSync}=await import('node:fs');
    const {dirname,join}=await import('node:path');
    const library=JSON.parse(readFileSync(join(dirname(process.argv[1]),'library.json'),'utf8'));
    const [id,slot,...scene]=process.argv.slice(2);
    console.log(JSON.stringify(carouselImageBrief(library,id,slot,scene.join(' ')),null,2));
  })().catch(e=>{console.error(e.message);process.exitCode=1});
}
