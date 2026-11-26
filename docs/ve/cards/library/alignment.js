// Expand the artwork's nested SVG viewports into one measurable path group.
const markBounds = new Map();
function measureMark(kind) {
  if (markBounds.has(kind)) return markBounds.get(kind);
  const ns='http://www.w3.org/2000/svg';
  const group=()=>document.createElementNS(ns,'g');
  const definition=document.getElementById(kind);
  function expand(node) {
    if (node.localName==='use') {
      const target=document.getElementById(node.getAttribute('href').slice(1));
      const g=group();
      const x=Number(node.getAttribute('x')), y=Number(node.getAttribute('y'));
      let transform=(node.getAttribute('transform')||'')+' translate('+x+' '+y+')';
      if (target.localName==='symbol') {
        const [vx,vy,vw,vh]=target.getAttribute('viewBox').split(/\s+/).map(Number);
        const w=Number(node.getAttribute('width'))||vw,h=Number(node.getAttribute('height'))||vh;
        const scale=Math.min(w/vw,h/vh);
        transform+=' translate('+((w-vw*scale)/2)+' '+((h-vh*scale)/2)+') scale('+scale+') translate('+(-vx)+' '+(-vy)+')';
      }
      g.setAttribute('transform',transform);g.append(expand(target));return g;
    }
    if (node.localName==='symbol'||node.localName==='g') {
      const g=group();
      if(node.hasAttribute('transform'))g.setAttribute('transform',node.getAttribute('transform'));
      for(const child of node.children)g.append(expand(child));
      return g;
    }
    const path=node.cloneNode(false);path.removeAttribute('id');return path;
  }
  const paths=expand(definition);
  paths.style.visibility='hidden';
  definition.ownerSVGElement.append(paths);
  try {
    const {x,y,width,height}=paths.getBBox();
    if(!(width>0&&height>0))throw Error('Empty vector artwork: '+kind);
    const bounds={x,y,width,height};markBounds.set(kind,bounds);return bounds;
  } finally {paths.remove()}
}
function alignmentAttrs(edge, side='left', name='line'){
  return `data-align-edge="${edge}" data-align-side="${side}" data-align-name="${esc(name)}"`;
}

// At poster sizes Chrome's layout metrics can round away the first glyph's
// bearing. Sample the same face at its output size, including antialiasing.
const initialBearings = new Map();
function posterBearing(letter, font, size) {
  const key = font+' '+letter;
  if (initialBearings.has(key)) return initialBearings.get(key);
  const canvas = document.createElement('canvas');
  const pad = Math.ceil(size*.3);
  canvas.width = Math.ceil(size*1.8);
  canvas.height = Math.ceil(size*1.6);
  const brush = canvas.getContext('2d', {willReadFrequently:true});
  brush.font = font;
  brush.fillText(letter, pad, size);
  const pixels = brush.getImageData(0,0,canvas.width,canvas.height).data;
  let first = canvas.width;
  for (let y=0; y<canvas.height; y++) {
    for (let x=0; x<first; x++) {
      if (pixels[(y*canvas.width+x)*4+3]>=14) {first=x;break}
    }
  }
  const bearing = first===canvas.width ? 0 : pad-first;
  initialBearings.set(key,bearing);
  return bearing;
}
