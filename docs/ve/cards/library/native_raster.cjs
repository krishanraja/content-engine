/* A browser-free raster backend for the same artwork() entry point used by the sheets. */
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const {artworkContext}=require('./offline_art.cjs');
const job=JSON.parse(fs.readFileSync(0,'utf8'));
const {Resvg}=require(process.env.RESVG_MODULE || '@resvg/resvg-js');
const fonts={fontFiles:job.fonts,loadSystemFonts:false};
const defs=fs.readFileSync('library.html','utf8').match(/<defs>[\s\S]*?<\/defs>/)[0];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const root=(body,w,h)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${defs}${body.replaceAll('font-family="Mono"','font-family="DM Mono"')}</svg>`;
const cache=new Map();
function measure(s,font,size,weight,italic){
  const family=font==='Mono'?'DM Mono':font;
  const key=[s,family,weight,italic].join('|');
  if(!cache.has(key)){
    const markup=`<svg xmlns="http://www.w3.org/2000/svg" width="65535" height="700"><text x="30" y="360" style="font-family:${family};font-size:256px;font-style:${italic?'italic':'normal'};font-weight:${weight}" xml:space="preserve">${escape(s)}</text></svg>`;
    const box=new Resvg(markup,{font:fonts}).getBBox();
    cache.set(key,box?[30-box.x,box.x+box.width-30,360-box.y,box.y+box.height-360]:[0,0,0,0]);
  }
  const [left,right,ascent,descent]=cache.get(key).map(n=>n*size/256);
  return {actualBoundingBoxLeft:left, actualBoundingBoxRight:right,actualBoundingBoxAscent:ascent,actualBoundingBoxDescent:descent,width:right};
}
if(job.mode==='art'){
  const context=artworkContext({},measure);
  context.jobs=job.items;
  context.fileExists=file=>Boolean(file) && fs.existsSync(path.resolve(file));
  const result=vm.runInContext(`
    for(const key of Object.keys(photos))if(!fileExists(photoURL(key)))missingPhotos.add(key);
    jobs.map(([id,preview,t])=>{
      const item=items.find(i=>i.id===id);
      return art(item,preview,probe,t);
    })
  `,context);
  process.stdout.write(JSON.stringify(result));
}else{
  const result=[];
  for(const task of job.items){
    const svg=root(task.svg,task.w,task.h),renderer=new Resvg(svg,{font:fonts});
    if(task.path){fs.writeFileSync(task.path,renderer.render().asPng());continue}
    // Crop around the transformed witness. Keep native scale and threshold antialiased edges.
    const box=renderer.getBBox();
    if(!box){result.push(null);continue}
    const x=Math.max(0,Math.floor(box.x)-3),y=Math.max(0,Math.floor(box.y)-3);
    const right=Math.min(task.w,Math.ceil(box.x+box.width)+3),bottom=Math.min(task.h,Math.ceil(box.y+box.height)+3);
    if(right<=x || bottom<=y){result.push(null);continue}
    const width=right-x,height=bottom-y;
    const cropped=svg.replace('<svg xmlns=',`<svg viewBox="${x} ${y} ${width} ${height}" xmlns=`).replace(`width="${task.w}" height="${task.h}"`,`width="${width}" height="${height}"`);
    const pixels=new Resvg(cropped,{font:fonts}).render().pixels;
    let x0=width,y0=height,x1=0,y1=0;
    for(let py=0;py<height;py++)for(let px=0;px<width;px++){
      if(pixels[(py*width+px)*4+3]<16)continue;
      x0=Math.min(x0,px);x1=Math.max(x1,px+1);y0=Math.min(y0,py);y1=Math.max(y1,py+1);
    }
    result.push(x1>x0?[x+x0,y+y0,x+x1,y+y1]:null);
  }
  process.stdout.write(JSON.stringify(result));
}
