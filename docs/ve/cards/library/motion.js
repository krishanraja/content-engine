/* The frame number is the only clock in export mode. */
function progress(value) {
  if(value<=0)return 0;
  if(value>=1)return 1;
  const x = Math.max(0, Math.min(1, value));
  let lo = 0, hi = 1;
  for (let i = 0; i < 22; i++) {
    const u = (lo + hi) / 2, v = 1 - u;
    if (3*v*v*u*.22 + 3*v*u*u*.36 + u*u*u < x) lo = u;
    else hi = u;
  }
  return 1 - (1-(lo+hi)/2)**3;
}
// Script beats: a production session binds a device move to a spoken word (SCRIPT-TO-MOTION.md).
// sequenceArt converts each beat into a track on the shot it belongs to, here, before drawing.
let beatTracks = {};
function beatsFor(seq, shot) {
  const norm = w => String(w).toLowerCase().replace(/[^a-z0-9]/g,'');
  const words = seq.captions.flatMap(c => c.words.map((w,i)=>({w:norm(w),at:c.onsets[i]})))
    .filter(x => x.at >= shot.start && x.at < shot.start + shot.frames);
  return (shot.beats || []).map(b => {
    const hits = words.filter(x => x.w === norm(b.word));
    const hit = hits[(b.occurrence || 1) - 1];
    if (!hit) throw Error(shot.item + ': beat word "' + b.word + '" is not spoken in this shot');
    return {element: b.element, property: b.property, from: b.from ?? 0, to: b.to ?? 1,
            start: Math.max(0, hit.at - shot.start - (b.lead ?? 3)), duration: b.duration ?? 10, ease: 'cubic-bezier(0.22,1,0.36,1)'};
  });
}
function trackState(item, element, frame) {
  const state = {};
  for (const track of [...(item.motion?.tracks || []), ...(beatTracks[item.id] || [])]) {
    if (track.element !== element) continue;
    const p = (frame-track.start)/track.duration;
    state[track.property] = track.from + (track.to-track.from)*progress(p);
    if (track.period) state[track.property]=(frame%track.period)/track.period;
    if (track.property === 'enterY' && frame < track.start) state.hidden = true;
  }
  return state;
}
// A pulse is a two-frame exposure. All other tracks interpolate on the house ease.
function outroSweep(item, frame) {
  const {width:w,height:h}=item, foot=item.scene.find(op=>op.kind==='bars').rect[3];
  const bars=[...rungs,mint].map((colour,i)=>{
    const key='bar-'+(i+1), drop=trackState(item,key,frame).drop;
    const height=h+(foot*(i+1)/4-h)*drop;
    const pulse=item.motion.tracks.find(t=>t.element===key && t.property==='pulse');
    const lit=frame>=pulse.start && frame<pulse.start+pulse.duration;
    const spread=trackState(item,'bar-4',frame).drop, edges=item.step_edges||[0,.25,.5,.75,1];
    const edge=n=>w*(n/4+(edges[n]-n/4)*spread);
    const rect=`x="${edge(i)}" y="${h-height}" width="${edge(i+1)-edge(i)}" height="${height}"`;
    return `<g data-sweep="${i+1}"><rect ${rect} fill="${colour}"/>${lit?`<rect data-step-pulse="${i+1}" ${rect} fill="${cream}" opacity=".24"/>`:''}<rect ${rect} fill="url(#grain)" opacity=".07"/></g>`;
  }).join('');
  return bars+(frame===0?`<rect data-roll="snap" y="${h*.35}" width="${w}" height="${h*.008}" fill="${ink}" opacity=".20"/>`:'');
}

function outroSignature(item, frame, x, y, w, h) {
  const rows=[['make',-3,146,-18],['your',143,154,16],['mind',296,101,-14],['up',296,101,18]];
  const words=rows.map(([name,top,height,startX])=>{
    const land=trackState(item,name,frame).land;
    if(!land)return '';
    // The mask travels with the complete word. Its horizontal edges sit in the line gaps.
    return `<g data-sign-part="${name}" transform="translate(${startX*(1-land)} 0)"><svg x="-5" y="${top}" width="412" height="${height}" viewBox="-5 ${top} 412 ${height}"><use href="#sign-${name}"/></svg></g>`;
  }).join('');
  const disc=trackState(item,'disc',frame);
  const offset=(1-disc.land)*9-disc.land*(1-disc.lock)*2.6;
  const wordShift=16*(1-trackState(item,'your',frame).land);
  const halves=disc.land ? `<g data-sign-part="disc" transform="translate(${wordShift} 0)"><use href="#sign-cream" transform="translate(${-offset} 0)"/><use href="#sign-mint" transform="translate(${offset} 0)"/></g>` : '';
  return `<svg data-building-mark="s3h" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 700 700" color="${cream}" fill="${mint}" overflow="visible"><svg x="26" y="35" width="645" height="631.237" viewBox="0 0 400 391.4649" overflow="visible">${words}${halves}</svg></svg>`;
}

function bandFor(item) {
  const [left,top,width,height] = item.safe_zones.content_box;
  const wide = item.width > item.height;
  const size = wide ? 64*item.width/1920 : 80*item.width/1080;
  const h = Math.ceil(size*2.45);
  const band=item.safe_zones.caption_band || [left,top+height-h,width,h];
  const x=item.caption_column ?? band[0];
  return {x,y:band[1],w:band[0]+band[2]-x,h:band[3],size};
}
function captionEligible(item) {
  return !['close','outro','statement-close','title'].includes(item.layout) &&
    !item.scene?.some(op=>op.kind==='mark' && op.value==='s3h' ||
      op.kind==='slide' && !captionEligible(items.find(i=>i.id===op.value)));
}
// House captions (SCRIPT-TO-MOTION.md). One look, four motion styles, chosen per cue by the session:
//   punch  one or two words at a time, large, each landing in 3 frames (hooks only)
//   build  words rise in as they are spoken, the spoken word lit (vertical default)
//   line   the whole line settles in over 6 frames, the spoken word lit (long-form default)
//   chip   the line holds still and the spoken word rides an ink chip (colour fields)
function captionStyle(item, cue, surface) {
  if (cue.style) return cue.style;
  if (surface === 'colour') return 'chip';
  return item.width > item.height ? 'line' : 'build';
}
function captionLayer(item, cue, frame, surface=item.caption_surface) {
  if (!cue || !captionEligible(item)) return '';
  const band = bandFor(item), {x,y,w,h} = band;
  const style = captionStyle(item, cue, surface);
  const colour = surface === 'colour';
  const active = cue.onsets.filter(at=>at<=frame).length-1;
  const ease = p => progress(Math.max(0,Math.min(1,p)));
  let words = cue.words.map((word,n)=>({word,n,at:cue.onsets[n]}));
  let size = band.size;
  if (style === 'punch') {
    // The word being said and, if short, the next one with it; shown alone, larger.
    const start = Math.max(0, active - (active % 2));
    words = words.slice(start, start + 2).filter(o => o.at <= frame || o.n === start);
    size = band.size * 1.5;
  }
  // Lay out the whole line first so words never jump lines as they appear; build hides words not yet said.
  if (style === 'build' && !words.some(o => o.at <= frame)) return '';
  ctx.font = size+'px Anton';
  const space = ctx.measureText(' ').width, pad = size*.16;
  const rows = [[]];
  let width = 0;
  for (const o of words) {
    const ww = ctx.measureText(o.word).width;
    if (rows.at(-1).length && width + space + ww > w) { rows.push([]); width = 0; }
    width += (rows.at(-1).length ? space : 0) + ww;
    rows.at(-1).push(o);
  }
  if (rows.length>2) throw Error(item.id+' caption exceeds two lines');
  const lead = size*1.12, ascent = ctx.measureText('H').actualBoundingBoxAscent;
  const lineIn = style === 'line' ? ease((frame-cue.start)/6) : 1;
  let baseline = y + (h - (rows.length-1)*lead - ascent)/2 + ascent + (1-lineIn)*size*.35;
  let out = `<g data-layer="captions" data-caption-style="${style}"${lineIn<1?` opacity="${lineIn.toFixed(3)}"`:''}>`;
  // One text element per line, one tspan per word, so the line is measured as one edge and read as one line.
  // On ink or pictures the keyline paints outside each glyph: inset by half its width so the visible ink meets the column.
  const keyline = colour ? 0 : size*.12;
  const face = colour ? '' : ` stroke="${ink}" stroke-width="${keyline}" stroke-linejoin="round" paint-order="stroke"`;
  rows.forEach((row,index)=>{
    let cx = x + ctx.measureText(row[0].word).actualBoundingBoxLeft + keyline/2;
    const by = baseline + index*lead;
    let spans = '';
    row.forEach(o=>{
      const word = esc(o.word), ww = ctx.measureText(o.word).width, on = o.n===active;
      // build lays the whole line out and keeps unsaid words invisible, so words never jump
      const unsaid = style === 'build' && o.at > frame;
      // build and punch: each word rises 30% of its size over 4 frames (3 for punch) as it is said
      const p = unsaid ? 0 : style==='build' ? ease((frame-o.at)/4) : style==='punch' ? ease((frame-o.at)/3) : 1;
      const dy = (1-p)*size*.3;
      const alpha = unsaid ? 0 : .25+.75*p;
      const op = alpha<1 ? ` fill-opacity="${alpha.toFixed(3)}" stroke-opacity="${alpha.toFixed(3)}"` : '';
      if (colour && on) out+=`<rect x="${cx-pad}" y="${by-ascent-pad+dy}" width="${ww+pad*2}" height="${ascent+pad*2}" fill="${ink}"/>`;
      spans+=`<tspan fill="${colour?(on?cream:ink):(on?mint:cream)}" x="${cx}" y="${by+dy}"${op}>${word}</tspan>`;
      cx += ww + space;
    });
    out+=`<text ${alignmentAttrs(x,'left','house caption')} x="${x+ctx.measureText(row[0].word).actualBoundingBoxLeft+keyline/2}" y="${by}" font-family="Anton" font-size="${size}"${face}>${spans}</text>`;
  });
  return out+'</g>';
}
function platformGuide(item) {
  const mode=item.preview_ui;
  if (!mode) return '';
  const w=item.width/1080, h=item.height/w;
  const open='<g data-layer="platform-ui" aria-hidden="true" transform="scale('+w+')" opacity=".20" fill="none" stroke="'+cream+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">';
  if (mode==='story') {
    const zone=item.safe_zones.link_zone || [276*w,(h-385)*w,528*w,92*w];
    const [x,y,width,height]=zone.map(n=>n/w);
    const linkWidth=Math.min(width,320),linkHeight=Math.min(height,68),cx=x+width/2,cy=y+height/2;
    return open+'<rect x="64" y="'+(h-140)+'" width="828" height="86" rx="43"/><path d="M942 '+(h-112)+'l64 -18 -30 65 -11 -25z"/>'+
      '<rect x="'+(cx-linkWidth/2)+'" y="'+(cy-linkHeight/2)+'" width="'+linkWidth+'" height="'+linkHeight+'" rx="20"/><g transform="translate('+cx+' '+cy+') rotate(-32)"><rect x="-30" y="-9" width="32" height="18" rx="9"/><rect x="-2" y="-9" width="32" height="18" rx="9"/></g></g>';
  }
  return open+'<g transform="translate(982 '+(h-760)+')"><circle r="29"/><path d="M-25 126c-34 -29 -9 -58 13 -42l12 10 10 -10c23 -17 48 14 14 43l-24 20z"/><path d="M-24 221h49q7 0 7 7v27q0 7 -7 7h-19l-20 14v-14h-10z"/><path d="M-27 395l50 -39 -1 29 12 8 -59 22z"/></g>'+
    '<path stroke-width="9" d="M66 '+(h-216)+'h263m-263 37h482m-482 37h340"/></g>';
}
function previewLayers(item,frame,hasExportCaption=false) {
  if(hasExportCaption || !item.family.startsWith('video-') || !captionEligible(item))return platformGuide(item);
  const slide=item.scene?.find(op=>op.kind==='slide')?.value;
  let cue=item.captions?.find(c=>c.start<=frame && frame<c.end);
  let time=frame;
  if(!cue){
    const seq=Object.values(sequences).find(s=>s.shots.some(shot=>shot.item===item.id && (!slide || shot.slide===slide)));
    const shot=seq?.shots.find(s=>s.item===item.id && (!slide || s.slide===slide));
    time=shot?shot.start+Math.min(frame,shot.frames-1):0;
    cue=seq?.captions.find(c=>c.start<=time && time<c.end) || sequences.short.captions[0];
  }
  return captionLayer(item,cue,time)+platformGuide(item);
}
function sceneGraphic(op, state, W) {
  const [x,y,w,h]=op.rect, col=op.color||ink;
  const line=(ax,ay,bx,by,c=col,sw=3)=>`<line x1="${x+ax*w}" y1="${y+ay*h}" x2="${x+bx*w}" y2="${y+by*h}" stroke="${c}" stroke-width="${sw}"/>`;
  const text=(s,ax,ay,c=col)=>{ctx.font=(33*W/1080)+"px Mono";const edge=x+ax*w;return `<text ${alignmentAttrs(edge,"left",s)} x="${edge+ctx.measureText(s).actualBoundingBoxLeft}" y="${y+ay*h}" fill="${c}" font-family="Mono" font-size="${33*W/1080}">${s}</text>`};
  if(op.kind==='timeline')return line(.03,.45,.91,.45)+line(.03,.25,.03,.6)+line(.91,.25,.91,.6)+text('0:00',.01,.9)+text('0:30',.79,.9);
  if(op.kind==='threshold-axis'){
    const size=48*W/1080;ctx.font=size+'px Mono';
    return [0,10,20,30].map((v,n)=>{
      const edge=x+w*n/3,right=n===3,value=v+' s',measure=ctx.measureText(value);
      const origin=right?edge-measure.actualBoundingBoxRight:edge+measure.actualBoundingBoxLeft;
      return line(n/3,0,n/3,.17)+`<text ${alignmentAttrs(edge,right?'right':'left',right?'threshold tick':value)} x="${origin}" y="${y+h}" font-family="Mono" font-size="${size}" fill="${col}">${value}</text>`;
    }).join('');
  }
  if(op.kind==='scale'){
    return `<rect x="${x}" y="${y}" width="${w}" height="${h*.47}" fill="${rungs[1]}"/>`+
      [0,10,20,30].map((v,n)=>{
        const px=n/3;
        if(n!==3)return line(px,.48,px,.58)+text(v+' s',px,.90);
        const size=33*W/1080;ctx.font=size+'px Mono';
        return line(1,.48,1,.58)+`<text ${alignmentAttrs(x+w,'right','threshold tick')} x="${x+w-ctx.measureText('30 s').actualBoundingBoxRight}" y="${y+h*.90}" font-family="Mono" font-size="${size}" fill="${col}">30 s</text>`;
      }).join('');
  }
  if(op.kind==='wave')return Array.from({length:96},(_,n)=>{const phase=(state.phase||0)*Math.PI*2;const amp=.08+.37*Math.abs(Math.sin(n*.29+phase)*Math.cos(n*.77+phase*.5));return line(n/96,.5-amp,n/96,.5+amp,col,w/190)}).join('');
  if(op.kind==='rail')return line(.5,0,.5,1,cream,w*.45)+line(.5,0,.5,.35,col,w);
  if(op.kind==='leader')return line(1,0,1-(state.draw??1),state.draw??1,cream,4);
  if(op.kind==='line')return line(0,0,1,0);
  if(op.kind==='map')return `<image href="${registry.geography.path}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
  if(op.kind==='sound'){
    if(op.value==='beds')return line(.05,.28,.40,.72)+line(.40,.72,.68,.72)+line(.68,.72,.92,.34)+text('Open −16',0,.20)+text('Voice −31',.37,.63)+text('Close −18',.73,.22)+text('LUFS   /   Mix −14 LUFS   /   Peak ≤ −1 dBTP',0,.97);
    if(op.value==='close-sting')return [0,1,2].map(n=>line(n*.25,.73-n*.21,(n+1)*.25,.73-n*.21,rungs[n],18)+text(n*4+'f',n*.25,.95)).join('')+text('Ink',.80,.33);
    return line(0,.6,1,.6)+line(.5,.25,.5,.75,ink,8)+text('One cue on the number',0,.93);
  }
  return '';
}
function sequenceArt(seq,frame,probe) {
  frame=Math.max(0,Math.min(seq.frames-1,frame));
  const index=seq.shots.findLastIndex(s=>s.start<=frame), shot=seq.shots[index], local=frame-shot.start;
  function draw(s,t){
    const item=items.find(i=>i.id===(s.slide||s.item));
    const body=art(item,0,probe,t,true,s.photo);
    if(!s.slide)return body;
    const outer=items.find(i=>i.id===s.item);
    const [x,y,w,h]=outer.scene.find(op=>op.kind==='slide').rect;
    return `<rect width="${seq.width}" height="${seq.height}" fill="${ink}"/><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${item.width} ${item.height}">${body}</svg>`;
  }
  const item=items.find(i=>i.id===shot.item);
  beatTracks={[shot.item]:beatsFor(seq,shot)};
  if(index && local<10){const prev=seq.shots[index-1];beatTracks[prev.item]=beatsFor(seq,prev)}
  const cue=seq.captions.find(c=>c.start<=frame&&frame<c.end);
  let body=draw(shot,local), boundary=0, previous;
  if(index && local<10 && item.layout!=='outro'){
    const prev=seq.shots[index-1], amount=(1-progress(local/10))*seq.height;
    body=draw(prev,prev.frames-1)+`<g transform="translate(0 ${amount})">${body}</g>`;
    previous=items.find(i=>i.id===prev.item);
    boundary=amount;
  }
  // When the spoken line is already the frame's headline, the caption would only repeat it: no caption.
  const said = cue ? cue.words.join(' ').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim() : '';
  const shown = (item.scene||[]).filter(op=>op.kind==='text').map(op=>String(op.value).toLowerCase().replace(/[^a-z0-9 ]/g,'').trim());
  const repeats = said && shown.some(v=>v===said || (v.length>8 && said.includes(v)) || (said.length>8 && v.includes(said)));
  if (cue && !repeats && captionEligible(item) && (!previous || captionEligible(previous)) && !body.includes('href="#s3h"')) {
    // Captions stay on the screen plane. Split the treatment at the moving
    // join, so black letters never sit on the outgoing ink during a push.
    const wipe=trackState(item,'rung',local).wipe??1;
    const strips=[[0,boundary,previous?.caption_surface],
      [boundary,boundary+(1-wipe)*seq.height,'ink'],
      [boundary+(1-wipe)*seq.height,seq.height,item.caption_surface]];
    const band=bandFor(item);
    strips.forEach(([top,bottom,surface],n)=>{
      const y=Math.max(top,band.y), end=Math.min(bottom,band.y+band.h);
      if (end<=y) return;
      const layer=captionLayer(item,cue,frame,surface);
      if (y===band.y && end===band.y+band.h) body+=layer;
      else body+=`<defs><clipPath id="caption-strip-${n}"><rect y="${y}" width="${seq.width}" height="${end-y}"/></clipPath></defs><g clip-path="url(#caption-strip-${n})">${layer}</g>`;
    });
  }
  return item.layout==='outro'?body:body+platformGuide(item);
}
