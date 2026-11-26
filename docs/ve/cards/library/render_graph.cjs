/* Trace the single-item SVG composer without taking a screenshot or encoding a frame. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {artworkContext} = require('./offline_art.cjs');
const ts = require('typescript');
const digest = value => createHash('sha256').update(value).digest('hex');
const registry = JSON.parse(fs.readFileSync('library.json', 'utf8'));
const metrics = JSON.parse(fs.readFileSync(0, 'utf8'));
const components = {}, roots = {};
let current;

// A parent depends on a helper's interface. Only callers that enter the helper
// depend on its body. Layout branches inside art() use the same convention.
function prepare(file, raw) {
  if (file === 'library.html') raw = raw.replace(/^const registry=.*;$/m, 'const registry=__registry;');
  const tree = ts.createSourceFile(file+'.js', raw, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (tree.parseDiagnostics.length) throw Error('Cannot trace '+file);
  const root = {key:file,start:0,end:raw.length,children:[],hits:{}};
  function add(parent,node,name,hook='') {
    const n = (parent.hits[name] || 0)+1;
    parent.hits[name] = n;
    const key = parent.key+'/'+name+(n===1?'':'#'+n);
    const block = ts.isBlock(node);
    const part = {key,start:node.getStart(tree)+(block?1:0),end:node.end-(block?1:0),
      block,children:[],hits:{},hook};
    parent.children.push(part);
    return part;
  }
  const getters = [];
  function isLiteral(node) {
    if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return true;
    if (ts.isArrayLiteralExpression(node)) return node.elements.every(isLiteral);
    return ts.isObjectLiteralExpression(node) && node.properties.every(
      p=>ts.isPropertyAssignment(p) && isLiteral(p.initializer));
  }
  function visit(node,parent) {
    // A VM global getter observes real reads, including reads across script files.
    // Keep palette values, copy, inline media and arrow helpers out of unrelated hashes.
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) &&
        node.parent.parent.parent===tree && (isLiteral(node.initializer)||ts.isArrowFunction(node.initializer))) {
      const name=node.name.text;
      const part=add(parent,node,'const '+name);
      part.literal=name;
      part.nameEnd=node.name.end;
      getters.push('Object.defineProperty(globalThis,'+JSON.stringify(name)+
        ',{get(){__component('+JSON.stringify(part.key)+');return __input_'+name+';}});');
      return;
    }
    if (ts.isFunctionDeclaration(node) && node.body) {
      const name=node.name.text;
      const arg={art:'item.id',photo:'name',doc:'key',mark:'kind'}[name];
      const part=add(parent,node.body,name,arg?', '+arg:'');
      ts.forEachChild(node.body,n=>visit(n,part));
      return;
    }
    // An opt-in slot override leaves the original value in the parent's hash.
    // Only a line that takes the override also depends on its condition and paint code.
    if (ts.isConditionalExpression(node) && ts.isTemplateExpression(node.whenTrue) && ts.isIdentifier(node.whenFalse) &&
        /^rule\.\w+ && /.test(node.condition.getText(tree))) {
      const part=add(parent,node,'slot '+node.condition.getText(tree));
      part.condition=node.condition.getText(tree);
      part.override=node.whenTrue.getText(tree);
      part.fallback=node.whenFalse.getText(tree);
      return;
    }
    // A motion-only expression is an input only on frames that evaluate that arm.
    if (ts.isConditionalExpression(node) && /\bstate\./.test(node.condition.getText(tree))) {
      for (const [choice,arm] of [['yes',node.whenTrue],['no',node.whenFalse]]) {
        const part=add(parent,arm,'when '+node.condition.getText(tree)+' '+choice);
        part.expression=true;
        ts.forEachChild(arm,n=>visit(n,part));
      }
      return;
    }
    if (ts.isIfStatement(node) && /(?:\bk\b|op\.kind|videoLayout)/.test(node.expression.getText(tree))) {
      const part=add(parent,node.thenStatement,'if '+node.expression.getText(tree));
      ts.forEachChild(node.thenStatement,n=>visit(n,part));
      if(node.elseStatement)visit(node.elseStatement,parent);
      return;
    }
    ts.forEachChild(node,n=>visit(n,parent));
  }
  visit(tree,root);
  function rewrite(part) {
    let cursor=part.start, code='', local='';
    for (const child of part.children) {
      const prefix=raw.slice(cursor,child.start);
      code+=prefix+rewrite(child);
      local+=prefix+(child.fallback ?? '/* '+child.key+' */');
      cursor=child.end;
    }
    const tail=raw.slice(cursor,part.end);
    code+=tail;
    local+=tail;
    if(part===root){
      roots[file]=digest(local);
      return code;
    }
    components[part.key]=digest(local);
    if(part.fallback)return '('+part.condition+' ? (__component('+JSON.stringify(part.key)+'),'+part.override+') : '+part.fallback+')';
    if(part.literal)return '__input_'+part.literal+raw.slice(part.nameEnd,part.end);
    const call='__component('+JSON.stringify(part.key)+(part.hook||'')+');';
    if(part.expression)return '(__component('+JSON.stringify(part.key)+'),'+code+')';
    return part.block ? call+code : '{'+call+code+'}';
  }
  return getters.join('\n')+'\n'+rewrite(root);
}

function hit(key,value){
  if(!current)return;
  current.code.add(key);
  if(value===undefined)return;
  const name=key.split('/').at(-1);
  if(name==='art')current.items.add(value);
  if(name==='photo')current.photos.add(value);
  if(name==='doc')current.crops.add(value);
  if(name==='mark')current.defs.add(value);
}
const context=artworkContext(metrics, undefined, {prepare,globals:{__component:hit,__registry:registry}});
context.exists = file=>Boolean(file) && fs.existsSync(path.resolve(file));
vm.runInContext("for(const key of Object.keys(photos))if(!exists(photoURL(key)))missingPhotos.add(key)",context);
const items=vm.runInContext('items',context), recipes={};
for(const item of items){
  current=Object.fromEntries(['code','items','photos','crops','defs','files','fonts'].map(k=>[k,new Set()]));
  const end=(item.motion?.frames||1)-1;
  const times=new Set([0,end]);
  for(const track of item.motion?.tracks||[]){
    for(const t of [track.start,track.start+1,track.start+Math.ceil(track.duration/2),track.start+track.duration])
      times.add(Math.max(0,Math.min(end,t)));
  }
  for(const cue of item.captions||[])times.add(Math.min(end,cue.start));
  const shapes=createHash('sha256');
  context.template=item;
  for(const t of [...times].sort((a,b)=>a-b)){
    context.frame=t;
    const svg=vm.runInContext('art(template,0,probe,frame)',context);
    shapes.update(svg);
    for (const [,url] of svg.matchAll(/(?:href="([^"]+)")/g)) {
      if(url.startsWith('#'))current.defs.add(url.slice(1));
      else if(!/^(?:[a-z]+:|\?)/i.test(url))current.files.add(url.replaceAll('&amp;','&'));
    }
    for(const [,ref] of svg.matchAll(/url\(#([^)]*)\)/g))current.defs.add(ref);
    for(const tag of svg.match(/<text\b[^>]*>/g)||[]){
      const face=/font-family="([^"]+)"/.exec(tag)?.[1];
      if(face)current.fonts.add(face+(/font-style="italic"/.test(tag)?'/italic':''));
    }
  }
  // The planning VM substitutes the two DOM measurement functions.
  for(const [key] of Object.entries(components)){
    if(current.defs.size && key.startsWith('alignment.js/measureMark'))current.code.add(key);
    if(current.fonts.has('Anton') && key.startsWith('alignment.js/posterBearing'))current.code.add(key);
    if(item.layout==='weekly-edition' && key.startsWith('edition.js/buildEdition'))current.code.add(key);
  }
  const recipe=Object.fromEntries(Object.entries(current).map(([k,v])=>[k,[...v].sort()]));
  recipe.svg_samples=shapes.digest('hex');
  recipes[item.id]=recipe;
}
process.stdout.write(JSON.stringify({roots,components,recipes}));
