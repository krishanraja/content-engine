// A 600 px email grows with its news list. A source line belongs to one story.
function buildEdition(base, groups, pieces=base.pieces) {
  if(pieces.length!==3)throw Error('Weekly edition needs three deep-dive slots');
  const count=groups.reduce((n,g)=>n+g.items.length,0);
  if(groups.length<2 || groups.length>4 || count<6 || count>10 || groups.some(g=>!g.topic || !g.items.length))
    throw Error('Weekly edition needs six to ten stories in two to four topics');
  const W=600,X=32,B=536, ink='#0C1512',cream='#F4EFE4';
  const scene=[], slots={}, slot_order=[], spacing_pairs=[],members={};
  let y=24, previous=null;
  function field(top,height,color){scene.push({kind:'field',rect:[0,top,W,height],color})}
  function next(name,min=64){
    if(previous)spacing_pairs.push([previous,name,min]);
    members[name]='left-32'; previous=name;
  }
  function line(id,value,face,role,size,lines,gap=38,min=64,href=null,color=ink) {
    if(face==='Anton')size=Math.max(size,Math.min(124,Math.ceil(B*1.95/value.length)));
    if(face==='Mono')size=Math.max(size,19);
    if(face==='Fraunces')size=Math.max(20,Math.min(24,size));
    const height=Math.ceil(size*(1.25*(lines-1)+1.13));
    slots[id]={role,max_chars:id.startsWith('summary_')?650:role==='body'?280:110,max_lines:lines,min_size_px:face==='Mono'?19:face==='Fraunces'?(value.startsWith('[')?24:Math.min(size,20)):Math.ceil(size*.74),
               max_size_px:size,step_px:1,fit:'wrap at measured width, then step down',refuse_when:'character, line or ink bounds exceeded'};
    slot_order.push(id);
    scene.push({kind:'text',slot:id,value,face,color,rect:[X,y,B,height],...(href?{href}:{})});
    next(id,min); y+=height+gap;
  }
  field(0,94,ink);scene.push({kind:'mark',value:'v9',rect:[X,y,290,42]});next('v9');y=110;
  line('opener','When does a play count? This week we look at how Spotify counts the first 30 seconds.','Fraunces','body',26,2);
  line('contents','This week','Anton','headline',39,1);
  const titles=pieces.map(piece=>piece.title);
  line('contents_pieces',titles.join('\n'),'Fraunces','body',22,3);
  line('contents_topics',groups.map(g=>g.topic).join(' / '),'Mono','label',17,3);
  pieces.forEach((piece,i)=>{
    field(y-8,5,['#FF6A4D','#FFD84D','#B7A6FF'][i]); y+=12;
    line('day_'+i,['Monday','Wednesday','Friday'][i],'Mono','label',17,1);
    line('piece_'+i,piece.title,'Anton','headline',39,Math.ceil(piece.title.length/34),44);
    line('summary_'+i,piece.summary,'Fraunces','body',26,Math.max(1,Math.ceil(piece.summary.length/39)),14,40);
    const slot='photo_'+i;slots[slot]={role:'photo',required:true,imagery_style:piece.imagery_style??base.slots[slot]?.imagery_style??1,aspect:'16:9'};slot_order.push(slot);
    scene.push({kind:'photo',slot,value:piece.cover,stock:cream,burn_axis:'bottom',rect:[X,y,B,164]});y+=183;
    const first='read_'+i,second='watch_'+i;
    const summary=previous,top=y;
    line(first,'Read the piece','Mono','label',17,1,38,64,piece.article_url);
    scene.at(-1).rect[2]=245;
    y=top;previous=summary;
    line(second,'Watch the video','Mono','label',17,1,38,64,piece.video_url);
    scene.at(-1).rect=[300,top,268,scene.at(-1).rect[3]];
    members[second]='left-300';
  });
  line('news','What else happened','Anton','headline',41,1);
  for(let i=0;i<3;i++)spacing_pairs.push(['read_'+i,i<2?'day_'+(i+1):'news',64]);
  let n=0;
  groups.forEach((group,index)=>{
    line('topic_'+index,group.topic,'Anton','headline',31,1,42);
    for(const [indexInGroup,story] of group.items.entries()){
      if(!story.text || !story.source_name || !/^https:\/\//.test(story.source_url) ||
         !/^\d{4}-\d{2}-\d{2}$/.test(story.date) || !story.checked_at)throw Error('Weekly news needs a dated, checked primary source');
      const date=new Date(story.date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
      const lines=Math.max(2,Math.ceil(story.text.length/47));
      line('news_'+n,story.text,'Fraunces','body',22,lines,38,indexInGroup===0?40:64);
      line('source_'+n,story.source_name+' / '+date,'Mono','source',16,story.source_name.length>26?2:1,40,64,story.source_url);
      scene.at(-1).element='news-source';
      n++;
    }
  });
  line('forward','Know someone who would enjoy this? Forward them the edition.','Fraunces','body',24,2);
  line('subscribe','Get the Saturday edition','Mono','label',17,1,38,64,base.subscribe_url);
  line('closing','See you next Saturday.','Fraunces','body',24,1);
  y+=14;
  line('footer','Email preferences   /   Unsubscribe','Mono','label',19,1,24,64);
  scene.unshift({kind:'field',rect:[0,0,W,y],color:cream});
  return {...base, height:y, safe_zones:{content_box:[X,24,B,y-48]},scene,slots,slot_order,spacing_pairs,
    alignment:{columns:{'left-32':X,'left-300':300},members}};
}

function editionContent(item) {
  const content=window.libraryContent?.[item.id];
  if(item.layout!=='weekly-edition' || (!content?.news_groups && !content?.pieces))return item;
  return buildEdition(item,content.news_groups || item.news_groups,content.pieces || item.pieces);
}
