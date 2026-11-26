const fs=require('fs'),vm=require('vm');
function artworkContext(metrics,native,options={}){
const prepare=options.prepare || ((name,code)=>code);
const html=fs.readFileSync('library.html','utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

const source=script.split('window.ready=')[0];
let family='Mono',size=32,weight=400,italic=false;
const attr={};
function measure(s){
 if(native)return native(s,family,size,weight,italic);
 const face=metrics[family+(italic?"Italic":"")+weight]||metrics[family+weight]||metrics[family]||metrics.Mono;
 let width=0, asc=0, desc=0;
 for(const c of s){const [advance,a,d]=face[c]||face['M'];width+=advance;asc=Math.max(asc,a);desc=Math.max(desc,d)}
 return {width:width*size,actualBoundingBoxAscent:asc*size,actualBoundingBoxDescent:desc*size,actualBoundingBoxLeft:0,actualBoundingBoxRight:width*size};
}
const probe={style:{},setAttribute(k,v){attr[k]=v;if(k==='font-family')family=v;if(k==='font-size')size=v},getBBox(){return {x:0,width:measure(this.textContent).width}}};
const sandbox={probe,window:{},URLSearchParams,location:{search:''},getComputedStyle:()=>({fontStyle:attr['font-style']||'normal',fontWeight:attr['font-weight']||'400',fontFamily:family,fontSize:size+'px'}),document:{
 querySelector:()=>({}),createElement:()=>({getContext:()=>({measureText:measure,set font(v){const m=v.match(/([\d.]+)px (\w+)$/);if(m){italic=v.startsWith('italic ');size=+m[1];family=m[2];weight=v.match(/\b([1-9]00) /)?.[1]||400}}})}),
 getElementById:id=>({getAttribute:()=>html.match(new RegExp('id="'+id+'" viewBox="([^"]+)"'))[1]})},console};
const context=vm.createContext(Object.assign(sandbox,options.globals));
for(const [,file] of html.matchAll(/<script\s+src="([^"]+)"/g))
  vm.runInContext(prepare(file,fs.readFileSync(file,'utf8')),context);
vm.runInContext(prepare('library.html',source),context);
// Native canvas rasterisation is exercised by render.py. Use the local
// font's measured first-pixel bearing for browser-free poster proofs.
context.posterBearing=(letter,font,em)=>native?Math.round(native(letter,'Anton',em,400,false).actualBoundingBoxLeft):-Math.round((metrics.Anton[letter]?.[3]||0)*em);
// The browser probe measures nested path geometry; these fixtures supply bounds in Node.
vm.runInContext("for(const [id,x,y,w,h] of [['s3h',26,37.64014434814453,644.9999389648438,626.6893310546875],['v9',0,0,931,90],['v4',0,0,753,89],['d',12,17,88,86]])markBounds.set(id,{x,y,width:w,height:h})",context);
return context;
}
module.exports={artworkContext};
