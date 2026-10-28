"""Motion for Monday's pictures: every panel plays instead of sitting still.

Krish, 28 Oct 2026, on the first cut with pictures: "a motion-designed, headline-grabbing statement ...
provocative and visually intense", "These infographics ... still don't move enough. There's not enough
happening. There are just three arrow circles."  The pages draw_panels.py lays out are animated here: a
timeline (set `t`, take a frame) drives the same HTML in Chromium, so every frame is exact and the clip
is the same at any speed. Two kinds of clip come out, each an mp4 make.py plays like a picture:

  * the drawn pages (draw_panels.build): objects arrive, receipts print and count, the stamp slams,
    arrows draw, the camera never sits still. A page that follows another of the same beat only animates
    what is new on it, so a printed receipt does not print twice.
  * the opener (open-*.mp4) and the bust (bust-9x16.mp4): the wall of friends, the headline, the slam.

Run from the repository root after draw_panels.py (needs Playwright, as draw_panels.py does):

    python docs/plans/2026-10-26-monday/video/motion.py [--only ID ...] [--still SECONDS]
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import draw_panels as dp  # noqa: E402

brand = dp.brand
WORK, OUT, SIZE = dp.WORK, dp.OUT, dp.SIZE
FPS = 30
CUT = {'16x9': 'long', '9x16': 'short'}

ENGINE = r'''
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const E={lin:x=>x,out:x=>1-Math.pow(1-x,3),out5:x=>1-Math.pow(1-x,5),in:x=>x*x*x,
 io:x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,
 back:x=>{const c1=1.9,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)}};
const seg=(t,a,d,e=E.out)=>e(clamp((t-a)/d));
const rnd=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const shake=(t,a0,dur,amp)=>{if(t<a0||t>a0+dur)return[0,0];const k=1-(t-a0)/dur,f=Math.floor(t*50);
 return[(rnd(f)-.5)*2*amp*k,(rnd(f+99)-.5)*2*amp*k]};
'''

MOTION_CSS = '''
.fx{position:absolute;inset:0;overflow:hidden;z-index:0;pointer-events:none}
.fx i{position:absolute;display:block}
.fx .grid{inset:-100px;background-image:linear-gradient(rgba(126,240,192,.055) 2px,transparent 2px),linear-gradient(90deg,rgba(126,240,192,.055) 2px,transparent 2px);background-size:96px 96px}
.fx .g1{width:1000px;height:1000px;left:-300px;top:-380px;background:radial-gradient(closest-side,rgba(255,216,77,.16),transparent)}
.fx .g2{width:1000px;height:1000px;right:-320px;bottom:-420px;background:radial-gradient(closest-side,rgba(126,240,192,.14),transparent)}
main>.stage,main>.label{position:relative;z-index:1}
.scan{position:absolute;z-index:2;pointer-events:none;overflow:hidden;border-radius:10px}
.scan b{position:absolute;left:0;right:0;height:120px;background:linear-gradient(180deg,transparent,rgba(126,240,192,.38),transparent)}
.flash{position:absolute;inset:0;background:#fff;opacity:0;z-index:9;pointer-events:none}
.w{display:inline-block;will-change:transform}
'''

# ---------------------------------------------------------------- generic: animate a drawn page
GENERIC = r'''
function setup(prevObj,total,push){
  prevObj=prevObj||{};const prev=new Set(prevObj.sigs||[]),prevRects=prevObj.rects||{},R=[],sigs=[];
  window.__R=R;window.__T=total;window.__push=push;
  const main=document.querySelector('main'),stage=document.querySelector('.stage');
  const fx=document.createElement('div');fx.className='fx';fx.innerHTML='<i class="grid"></i><i class="g1"></i><i class="g2"></i>';main.prepend(fx);
  window.__fx=fx;
  const flash=document.createElement('div');flash.className='flash';main.append(flash);window.__flash=flash;
  const baseOf=el=>{if(el.__b===undefined){const t=getComputedStyle(el).transform;el.__b=t==='none'?'':t}return el.__b};
  const add=(el,t0,dur,p,ease)=>{R.push({el,t0,dur,p,ease:ease||E.out,b:baseOf(el),amb:0});return R[R.length-1]};
  const hidden=el=>getComputedStyle(el).visibility==='hidden';
  const same=sig=>{sigs.push(sig);return prev.has(sig)};
  const num=s=>{const m=s.match(/^([^0-9]*)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/);return m&&parseFloat(m[2].replace(/,/g,''))>0?{pre:m[1],v:parseFloat(m[2].replace(/,/g,'')),dec:(m[2].split('.')[1]||'').length,post:m[3],comma:/,/.test(m[2]),orig:s}:null};
  let T=.08;
  // the label: every word slams in
  const lab=document.querySelector('.label');
  if(lab){
    const walk=n=>{[...n.childNodes].forEach(c=>{if(c.nodeType===3){const f=document.createDocumentFragment();
      c.textContent.split(/(\s+)/).forEach(w=>{if(!w)return;if(/^\s+$/.test(w)){f.append(' ');return}const s=document.createElement('span');s.className='w';s.textContent=w;f.append(s)});
      c.replaceWith(f)}else if(c.nodeType===1)walk(c)})};
    walk(lab);
    if(!same('label|'+lab.innerText)){
      [...lab.querySelectorAll('.w')].forEach((w,i)=>add(w,T+i*.11,.42,{y:[-70,0],s:[1.45,1],o:[0,1],bl:[14,0]},E.out5));
      T+=.11*lab.querySelectorAll('.w').length+.25;
    }
  }
  // the objects on the stage, top level ones, in reading order
  const box='.receipt,.co,.card,.slot,.minicard,.pair,.sora';
  const sel=box+',.cap,.huge,.big,.mono,.money,.arrow,.void,img.logo,.row>.chip,.col>.chip,.dots';
  const objs=[...stage.querySelectorAll(sel)].filter(e=>!e.parentElement.closest(box)&&!hidden(e));
  const sg=e=>e.matches('.receipt')?'receipt|'+e.querySelector('.rh').innerText:e.matches('.co')?'co|'+e.className:e.matches('.cap')?'cap':
     e.matches('img.logo')?'logo|'+e.src.slice(60,110):e.className+'|'+e.innerText.slice(0,50);
  let idx=0;
  objs.forEach((e,i)=>{
    const fresh=!same(sg(e));
    const k=add(e,0,.01,{});k.amb=1+i*.9;
    if(fresh){
      const t0=T+idx*.17;idx++;
      let p,ez=E.back,d=.62;
      if(e.matches('.receipt')){p={y:[520,0],r:[9,0],s:[.9,1],o:[0,1]};d=.8}
      else if(e.matches('.co')){p={x:[-220,0],r:[-4,0],o:[0,1]};d=.7}
      else if(e.matches('img.logo')){p={s:[.35,1],r:[-6,0],o:[0,1]};d=.55}
      else if(e.matches('.cap')){p={s:[1.14,1],o:[0,1],bl:[12,0]};d=.9;ez=E.out5}
      else if(e.matches('.void')){p={s:[3.6,1],o:[0,1],r:[-26,0]};d=.26;ez=E.out5}
      else if(e.matches('.arrow')){p={clip:[100,0]};d=.55;ez=E.io}
      else if(e.matches('.chip')&&prevRects[e.innerText]){const r=e.getBoundingClientRect(),q=prevRects[e.innerText];p={x:[q[0]-(r.x+r.width/2),0],y:[q[1]-(r.y+r.height/2),0],r:[-9,0],o:[1,1]};d=.8;ez=E.io}
      else if(e.matches('.huge,.big')){p={s:[2.2,1],o:[0,1],bl:[16,0]};d=.5;ez=E.out5}
      else{p={y:[130,0],s:[.93,1],o:[0,1]}}
      if(e.matches('.void')){const hit=Math.max(t0,T+.85+idx*.1);k.t0=hit;k.dur=d;k.p=p;k.ease=ez;window.__hit=hit}
      else{k.t0=t0;k.dur=d;k.p=p;k.ease=ez}
      k.start=k.t0;
      // numbers count up as the object lands
      e.querySelectorAll('b.total,.money').forEach(b=>{const n=num(b.textContent);if(n&&!b.__c){b.__c=1;b.__n=n;R.push({el:b,t0:k.t0+.5,dur:.95,p:{count:1},ease:E.out,b:''})}});
      if(e.matches('.huge')){const n=num(e.textContent);if(n){e.__n=n;R.push({el:e,t0:k.t0+.1,dur:.9,p:{count:1},ease:E.out,b:''})}}
      if(e.matches('.money')){const n=num(e.textContent);if(n&&!e.__n){e.__n=n;R.push({el:e,t0:k.t0+.4,dur:.9,p:{count:1},ease:E.out,b:''})}}
      // a printed receipt prints its lines one at a time
      if(e.matches('.receipt')){
        const rh=e.querySelector('.rh');add(rh,k.t0+.25,.35,{y:[-18,0],o:[0,1]});
        e.querySelectorAll('.rule').forEach((r,j)=>{r.style.transformOrigin='left';add(r,k.t0+.3+j*.5,.45,{sx:[0,1]},E.io)});
        let j=0;
        e.querySelectorAll('.line').forEach(l=>{if(hidden(l))return;const tt=k.t0+.6+j*.5;j++;
          add(l,tt,.38,{x:[-46,0],o:[0,1]});
          let nx=l.nextElementSibling,q=0;while(nx&&nx.matches('.sub')){if(!hidden(nx))add(nx,tt+.25+q*.22,.35,{y:[10,0],o:[0,1]});q++;nx=nx.nextElementSibling}
          const tb=l.querySelector('b.total');if(tb){tb.style.backgroundColor='transparent';tb.style.backgroundImage='linear-gradient(#7EF0C0,#7EF0C0)';tb.style.backgroundRepeat='no-repeat';
            R.push({el:tb,t0:tt+.2,dur:.5,p:{bgw:[0,100]},ease:E.out,b:''})}});
        const rf=e.querySelector('.rf');if(rf)add(rf,k.t0+.6+j*.5,.4,{o:[0,1]});
      }
      // chips pop one after the other
      e.querySelectorAll('.chip:not(.dim)').forEach((c,j)=>{if(prev.has('chip|'+c.innerText))return;add(c,k.t0+.45+j*.2,.45,{s:[.55,1],y:[26,0],o:[0,1]},E.back)});
      e.querySelectorAll('.n').forEach((c,j)=>add(c,k.t0+.4+j*.1,.4,{s:[0,1]},E.back));
      e.querySelectorAll('.dots span').forEach((c,j)=>add(c,k.t0+.4+j*.14,.3,{s:[0,1]},E.back));
      e.querySelectorAll('.col>.logo,.row>.logo,.sora .logo').forEach((c,j)=>{add(c,k.t0+.3+j*.15,.5,{s:[.4,1],o:[0,1]},E.back)});
      // a document: a scan line passes over it once
      if(e.matches('.cap')){const r=e.getBoundingClientRect(),s=document.createElement('div');s.className='scan';
        s.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px`;s.innerHTML='<b></b>';main.append(s);
        R.push({el:s.firstChild,t0:k.t0+.5,dur:1.4,p:{scan:[-120,r.height]},ease:E.io,b:''})}
    } else {
      e.querySelectorAll('.chip:not(.dim)').forEach(c=>sigs.push('chip|'+c.innerText));
    }
    e.querySelectorAll('.chip:not(.dim)').forEach(c=>{if(!sigs.includes('chip|'+c.innerText))sigs.push('chip|'+c.innerText)});
  });
  // the source line types itself
  const src=document.querySelector('.source');
  if(src&&!same('src|'+src.innerText))add(src,T+.2,.9,{clip:[100,0],o:[0,1]},E.io);
  const rects={};document.querySelectorAll('.chip:not(.dim)').forEach(c=>{const r=c.getBoundingClientRect();rects[c.innerText]=[r.x+r.width/2,r.y+r.height/2]});
  return {sigs:sigs,rects:rects};
}
function setT(t){
  const fmt=(v,d,c)=>{const s=v.toFixed(d);return d?s:(c?Math.round(v).toLocaleString('en-US'):String(Math.round(v)))};
  for(const r of R_()){
    const k=clamp((t-r.t0)/r.dur),e=r.ease(k),g=(a,b)=>a+(b-a)*e,p=r.p;let tf='';
    if(p.count){const n=r.el.__n;r.el.textContent=k>=1?n.orig:n.pre+fmt(n.v*E.out(k),n.dec,n.comma)+n.post;continue}
    if(p.scan){r.el.style.top=g(p.scan[0],p.scan[1])+'px';continue}
    if(p.bgw){r.el.style.backgroundSize=g(p.bgw[0],p.bgw[1])+'% 100%';continue}
    let ax=0,ay=0,ar=0;
    if(r.amb){const ph=t/5.2*6.2832+r.amb;ay=Math.sin(ph)*4.5;ax=Math.cos(ph*.7)*2.5;ar=Math.sin(ph*.8)*.35}
    const x=p.x?g(p.x[0],p.x[1]):0,y=p.y?g(p.y[0],p.y[1]):0;
    tf+=`translate(${(x+ax).toFixed(2)}px,${(y+ay).toFixed(2)}px) `;
    if(p.r||ar)tf+=`rotate(${((p.r?g(p.r[0],p.r[1]):0)+ar).toFixed(3)}deg) `;
    if(p.s)tf+=`scale(${g(p.s[0],p.s[1]).toFixed(4)}) `;
    if(p.sx)tf+=`scale(${g(p.sx[0],p.sx[1]).toFixed(4)},1) `;
    r.el.style.transform=tf+r.b;
    if(p.o)r.el.style.opacity=clamp(g(p.o[0],p.o[1]));
    if(p.bl)r.el.style.filter=`blur(${Math.max(0,g(p.bl[0],p.bl[1])).toFixed(2)}px)`;
    if(p.clip)r.el.style.clipPath=`inset(-60px calc(${Math.max(0,g(p.clip[0],p.clip[1])).toFixed(2)}% - 60px) -60px 0)`;
  }
  // the ground moves, the camera drifts in
  const fx=window.__fx;fx.children[0].style.transform=`translate(${(t*26)%96}px,${(t*18)%96}px)`;
  fx.children[1].style.transform=`translate(${Math.sin(t*.5)*80}px,${Math.cos(t*.4)*60}px)`;
  fx.children[2].style.transform=`translate(${Math.cos(t*.45)*90}px,${Math.sin(t*.55)*70}px)`;
  const stage=document.querySelector('.stage'),hit=window.__hit;let sx=0,sy=0;
  if(hit!==undefined){[sx,sy]=shake(t,hit+.1,.5,14);const f=Math.max(0,1-Math.abs(t-hit-.12)/.12);window.__flash.style.opacity=(f*.7).toFixed(3)}
  const z=1+(window.__push||.03)*clamp(t/window.__T);
  document.querySelector('main').style.transformOrigin='50% 50%';
  stage.style.transform=`translate(${sx}px,${sy}px) scale(${z.toFixed(4)})`;
}
function R_(){return window.__R}
'''

# ---------------------------------------------------------------- the opener and the bust
OPENER = r'''
const P=%P%,W=P.W,H=P.H,B=P.B;
const sc=document.getElementById('sc'),wall=document.getElementById('wall');
const PAL=['#7EF0C0','#FFD84D','#F4EFE4','#5FB89A','#C9B35A','#8AA89E'];
const tiles=[];
{const gap=P.gap,tw=P.tw,th=P.th,x0=(W-P.cols*tw-(P.cols-1)*gap)/2,y0=(H-P.rows*th-(P.rows-1)*gap)/2;
 for(let r=0;r<P.rows;r++)for(let c=0;c<P.cols;c++){const i=r*P.cols+c,el=document.createElement('div');el.className='tile';
  el.style.cssText=`left:${x0+c*(tw+gap)}px;top:${y0+r*(th+gap)}px;width:${tw}px;height:${th}px`;
  const av=PAL[Math.floor(rnd(i*3.1)*PAL.length)],a=Math.round(th*.4);
  el.innerHTML=`<s class="av" style="width:${a}px;height:${a}px;background:${av}"></s><u style="width:${tw*(.5+rnd(i)*.3)}px"></u><u style="width:${tw*(.3+rnd(i+7)*.3)}px"></u><em></em>`;
  wall.append(el);
  const cx=x0+c*(tw+gap)+tw/2,cy=y0+r*(th+gap)+th/2,d=Math.hypot((cx-W/2)/W,(cy-H/2)/H)/.62;
  tiles.push({el,d,fd:rnd(i*5.3)*.9+r/P.rows*.55,fall:rnd(i*9.1)<.62,rv:rnd(i*2.2),dot:el.querySelector('em')})}}
const words=[...document.querySelectorAll('#h1 .w')].map(w=>({el:w,t:parseFloat(w.dataset.in),o:parseFloat(w.parentElement.dataset.out||'1e9')}));
const logo=document.getElementById('logo'),h2=document.getElementById('h2'),flash=document.getElementById('flash');
const t1=document.getElementById('t1'),t2=document.getElementById('t2'),
  tr1=t1.firstChild,tr2=t2.firstChild,u1=tr1.firstChild.offsetWidth,u2=tr2.firstChild.offsetWidth;
const bits=[...document.querySelectorAll('.bit')],bub=[...document.querySelectorAll('.bub')];
const shards=[];for(let i=0;i<48;i++)shards.push({a:rnd(i*1.7)*6.283,v:600+rnd(i*4.1)*900,w:10+rnd(i)*16,h:18+rnd(i+3)*34,c:PAL[i%3],r:rnd(i*8.8)*720});
const shEls=shards.map(s=>{const e=document.createElement('div');e.className='shard';e.style.cssText=`width:${s.w}px;height:${s.h}px;background:${s.c}`;sc.append(e);return e});
function setT(t){
  const bust=B!==null&&t>=B,u=bust?t-B:0;
  const[sx,sy]=B!==null?shake(t,B,.7,P.amp):[0,0];
  const z=1+.045*clamp(t/P.dur);
  sc.style.transform=`translate(${sx}px,${sy}px) scale(${z})`;
  const gray=B!==null?seg(t,B,.5):0;
  wall.style.filter=`grayscale(${gray}) brightness(${1-.4*gray})`;
  tiles.forEach((o,i)=>{
    const pop=P.enter?seg(t,.05+o.d*.8,.5,E.back):1;
    let y=0,r=0,op=1;
    if(bust){const w=t-B-o.fd;if(w>0){if(o.fall){y=w*w*1100*(.6+o.rv);r=w*(o.rv-.5)*220;op=clamp(1-w/1.2)}else{op=1-.78*clamp(w/.6)}}}
    const fl=Math.sin(t*1.3+i)*3;
    o.el.style.transform=`translate(0,${y+fl}px) rotate(${r}deg) scale(${.5+.5*pop})`;
    o.el.style.opacity=clamp(pop)*op;
    const on=!bust&&((Math.sin(t*2.2+i*1.7)>-.55));o.dot.style.background=bust?'#6b746f':(on?'#7EF0C0':'rgba(126,240,192,.25)');
  });
  // the headline arrives word by word, and goes when its time is up
  words.forEach(o=>{const k=seg(t,o.t,.34,E.out5),x=o.o<1e8?seg(t,o.o,.2,E.in):0,w=o.el;
    const[hx,hy]=shake(t,o.t+.06,.25,6);
    w.style.opacity=clamp(k)*(1-x);w.style.filter=`blur(${(1-k)*16+x*18}px)`;
    w.style.transform=`translate(${hx}px,${(1-k)*-70+hy}px) scale(${1.5-.5*k+x*.4})`});
  // the logo takes the hit
  const[lx,ly]=B!==null?shake(t,B,.5,10):[0,0];
  logo.style.transform=`translate(${lx}px,${ly}px) scale(${P.enter?.6+.4*seg(t,.1,.5,E.back):1})`;
  logo.style.opacity=P.enter?clamp(seg(t,.1,.3)):1;
  logo.style.filter=`grayscale(${gray}) brightness(${1-.35*gray})`;
  // the burst
  flash.style.opacity=B!==null?Math.max(0,.85*(1-Math.abs(t-B-.03)/.09)):0;
  const k2=B!==null?seg(t,B+.04,.26,E.out5):0;
  h2.style.opacity=clamp(k2*4);
  const bk=h2.querySelector('.bk'),nw=h2.querySelector('.nw');
  const gl=bust&&((u>1.0)&&(Math.floor(t*3.3)%3===0)&&((t*3.3)%1<.3))?1:0,[gx,gy]=gl?[(rnd(Math.floor(t*30))-.5)*16,(rnd(Math.floor(t*30)+4)-.5)*6]:[0,0];
  bk.style.transform=`translate(${gx}px,${gy}px) scale(${3.2-2.2*k2})`;
  bk.style.textShadow=gl?'-7px 0 #7EF0C0,7px 0 #F4EFE4,0 10px 0 rgba(0,0,0,.35)':'0 10px 0 rgba(0,0,0,.35)';
  nw.style.transform=`translateY(${(1-seg(t,B,.25,E.out5))*-50}px)`;nw.style.opacity=B!==null?seg(t,B,.15):0;
  // the tape
  const a=B!==null?seg(t,B+.02,.4,E.back):0,b=B!==null?seg(t,B+.1,.4,E.back):0;
  t1.style.transform=`translate(${(1-a)*W*1.6}px,0) rotate(-6deg)`;
  t2.style.transform=`translate(${-(1-b)*W*1.6}px,0) rotate(3.5deg)`;
  tr1.style.transform=`translateX(${-((t*230)%u1)}px)`;tr2.style.transform=`translateX(${-u2+((t*190)%u2)}px)`;
  // shards
  shards.forEach((s,i)=>{const q=t-(B===null?9e9:B+.08);const e=shEls[i];
    if(q<0||q>1.6){e.style.opacity=0;return}
    const x=W/2+Math.cos(s.a)*s.v*q,y=H*.5+Math.sin(s.a)*s.v*q+700*q*q;
    e.style.opacity=clamp(1.6-q*1.1);e.style.transform=`translate(${x}px,${y}px) rotate(${s.r*q}deg)`});
  // ghosts of chats that never got answered
  bub.forEach((e,i)=>{const q=bust?clamp((t-B-.9)/.6):0;const y=((t*52+i*P.H*.2)%(H+240))-120;
    e.style.opacity=.26*q;e.style.transform=`translate(${P.bx[i]}px,${y}px)`});
}
'''

OPEN_CSS = '''
html,body{margin:0;overflow:hidden}
#sc{position:absolute;inset:0;overflow:hidden}
#wall{position:absolute;inset:0}
.tile{position:absolute;background:rgba(244,239,228,.075);border:2px solid rgba(244,239,228,.16);border-radius:16px;padding:14px;box-sizing:border-box;will-change:transform}
.tile .av{display:block;border-radius:50%;margin-bottom:12px}
.tile u{display:block;height:9px;border-radius:5px;background:rgba(244,239,228,.3);margin-top:9px}
.tile em{position:absolute;right:14px;top:14px;width:13px;height:13px;border-radius:50%;background:#7EF0C0}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 52%,rgba(12,21,18,.93) 8%,rgba(12,21,18,.72) 38%,rgba(12,21,18,.1) 78%)}
#logo{position:absolute;left:50%;top:%LOGOY%px;margin-left:-%LOGOHW%px;width:%LOGOW%px;transform-origin:50% 50%}
#h1{position:absolute;inset:0;font:%H1%px/.98 Anton;color:#F4EFE4;text-shadow:0 8px 40px rgba(0,0,0,.7)}
#h1 .ph{position:absolute;left:0;right:0;top:50%;transform:translateY(-46%);text-align:center}
#h1 .m{color:#7EF0C0}
#h2{position:absolute;left:0;right:0;top:50%;transform:translateY(-52%);text-align:center;font-family:Anton;z-index:4}
#h2 .nw{font-size:%NW%px;line-height:1;color:#F4EFE4;letter-spacing:3px}
#h2 .bk{font-size:%BK%px;line-height:.92;color:#FFD84D;display:block;letter-spacing:2px}
.tape{position:absolute;left:-30%;width:160%;height:%TAPEH%px;background:#FFD84D;z-index:3;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.55)}
.tape::before,.tape::after{content:"";position:absolute;left:0;right:0;height:14px;background:repeating-linear-gradient(-45deg,#0C1512 0 18px,#FFD84D 18px 36px)}
.tape::before{top:0}.tape::after{bottom:0}
.tape .tr{position:absolute;left:0;top:0;height:100%;white-space:nowrap;display:flex;align-items:center;font:%TAPEF%px/1 Anton;color:#0C1512;letter-spacing:3px}
.tape .tr span{padding-right:.6em}
.tape.m .tr{font:600 %TAPEM%px/1 "IBM Plex Mono";letter-spacing:4px}
#t1{top:%T1Y%px}#t2{top:%T2Y%px}
#flash{position:absolute;inset:0;background:#fff;opacity:0;z-index:9}
.shard{position:absolute;left:0;top:0;opacity:0;z-index:5}
.bub{position:absolute;left:0;top:0;width:150px;height:76px;border-radius:30px;border:3px solid rgba(244,239,228,.55);opacity:0;z-index:2;display:flex;align-items:center;justify-content:center;font:48px/1 Anton;color:rgba(244,239,228,.7);letter-spacing:6px}
.w{display:inline-block;will-change:transform,filter}
'''


def opener_html(shape, mode):
    """The wall of friends and the statement. mode 'full': it builds, then bursts on the word "bust"."""
    w, h = SIZE[shape]
    wide = shape == '16x9'
    P = {'W': w, 'H': h, 'enter': mode != 'bust', 'B': None, 'dur': 8.0, 'amp': 18 if wide else 16,
         'cols': 9 if wide else 6, 'rows': 7 if wide else 6, 'tw': 140 if wide else 160, 'th': 150 if wide else 160,
         'gap': 14 if wide else 20, 'bx': [round(w * f) for f in (.08, .74, .2, .62, .4, .85)]}
    css = OPEN_CSS
    for key, val in {'LOGOY': 70 if wide else 78, 'LOGOW': 440 if wide else 420, 'LOGOHW': 220 if wide else 210,
                     'H1': 168 if wide else 156, 'NW': 92 if wide else 84, 'BK': 238 if wide else 214,
                     'TAPEH': 108 if wide else 100, 'TAPEF': 70 if wide else 64, 'TAPEM': 40 if wide else 36,
                     'T1Y': round(h * .2), 'T2Y': round(h * .79)}.items():
        css = css.replace(f'%{key}%', str(val))
    return P, css


def phases(mode, B, beats):
    """The statement, as phases of words that each slam in on their time and leave on the next phase's."""
    def span(w, t, m=False):
        return f'<span class="w{" m" if m else ""}" data-in="{t}">{w}</span>'
    if mode != 'bust':
        out = f' data-out="{B}"' if B is not None else ''
        return (f'<div class="ph"{out}>{span("MILLIONS", .35)} {span("MADE", .7)}<br>{span("FRIENDS", 1.05, True)} {span("HERE.", 1.5)}</div>')
    c, law = beats['cash'], beats['law']
    return (f'<div class="ph" data-out="{law}">{span("OUT", max(0, c - .5))} {span("OF", max(0, c - .25))} {span("CASH.", c, True)}</div>'
            f'<div class="ph" data-out="{B}">{span("LAWSUITS.", law)}</div>')


def opener_page(shape, mode, bust_at, seconds, beats=None):
    P, css = opener_html(shape, mode)
    P['B'] = bust_at
    P['dur'] = seconds
    logo = dp.logo('characterai-cream.svg', 90, 'width:100%;height:auto')
    body = (f'<div id="sc"><div id="wall"></div><div id="vig"></div>'
            f'<div id="logo">{logo}</div>'
            f'<div id="h1">{phases(mode, bust_at, beats)}</div>'
            f'<div id="h2"><div class="nw">NOW IT’S</div><div class="bk">BANKRUPT.</div></div>'
            f'<div class="tape" id="t1"><div class="tr">{"<span>CHAPTER 11 ·</span>" * 14}</div></div>'
            f'<div class="tape m" id="t2"><div class="tr">{"<span>FILED 12 OCT 2026 · COURT FILING ·</span>" * 8}</div></div>'
            f'{"".join(f"<div class=bub>…</div>" for _ in range(6))}'
            f'<div id="flash"></div></div>')
    js = ENGINE + OPENER.replace('%P%', json.dumps(P))
    return f'<!doctype html><meta charset="utf-8"><style>{brand.font_css()}\nbody{{background:#0C1512;margin:0}}\n{css}</style><body>{body}', js


def generic_page(body):
    return (f'<!doctype html><meta charset="utf-8"><style>{brand.font_css()}\n{dp.CSS}\n{dp.EXTRA}\n{MOTION_CSS}</style>'
            f'<body>{body}</body>')


class Encoder:
    def __init__(self, out, fps=FPS):
        self.out = out
        self.p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', str(fps), '-i', '-',
                                   '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', str(fps),
                                   '-movflags', '+faststart', str(out)], stdin=subprocess.PIPE)

    def add(self, jpeg):
        self.p.stdin.write(jpeg)

    def close(self):
        self.p.stdin.close()
        if self.p.wait():
            raise SystemExit(f'ffmpeg failed on {self.out}')


def frames(pg, seconds, out, still=None):
    if still is not None:
        pg.evaluate(f'setT({still})')
        (OUT / 'stills').mkdir(exist_ok=True)
        pg.screenshot(path=str(OUT / 'stills' / (out.stem + '.png')))
        return
    enc = Encoder(out)
    for n in range(round(seconds * FPS)):
        pg.evaluate(f'setT({n / FPS:.4f})')
        enc.add(pg.screenshot(type='jpeg', quality=93))
    enc.close()


def cue_seconds():
    """The longest any picture file is on screen in the last render (a clip must outlast its window, or
    make.py loops it from the start), plus a margin."""
    secs = {}
    for shape, cut in CUT.items():
        kit = json.loads((WORK / 'kit' / f'{cut}.json').read_text(encoding='utf-8'))
        rep = json.loads((WORK / cut / f'disney-google-and-character-ai-{cut}.report.json').read_text(encoding='utf-8'))
        win = {c['id']: c['e'] - c['s'] for c in rep['cues']}
        tails = {c['id']: c.get('tail', 0) for c in kit['cues']}
        for c in kit['cues']:
            files = (c.get('pages') or {}).get(shape) or [c['panel']]
            for f in files:
                stem = Path(f).stem
                secs[stem] = max(secs.get(stem, 0), win.get(c['id'], 6.0) + tails.get(c['id'], 0))
    return secs


def bust_offsets():
    """Seconds from each opener cue's start to the word "bust" (and, in the short, to "cash" and "lawsuits"),
    less 3 frames so the eye leads the ear."""
    out = {}
    for shape, cut in (('16x9', 'long'), ('9x16', 'short')):
        ws = json.loads((WORK / cut / f'disney-google-and-character-ai-{cut}.words.json').read_text(encoding='utf-8'))['words']
        norm = [w['w'].strip().lower().strip('.,?!') for w in ws]
        a = norm.index('disney') if cut == 'long' else next(i - 1 for i in range(1, len(norm)) if norm[i] == 'ran' and norm[i - 1] == 'it')
        at = lambda word: round(ws[next(i for i in range(a, len(norm)) if norm[i] == word)]['s'] - max(0.0, ws[a]['s'] - 0.15) - 0.1, 2)
        out[shape] = at('bust')
        if cut == 'short':
            out['cash'], out['law'] = at('cash'), at('lawsuits')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*', help='panel or opener ids')
    ap.add_argument('--still', type=float, help='write a still at this second instead of a clip')
    ap.add_argument('--shard', default='0/1', help='i/n: this worker draws every n-th page, so n workers share the job')
    a = ap.parse_args()
    records = {r['id']: r for r in json.loads((dp.CAPS / 'captures.json').read_text(encoding='utf-8'))}
    panels = dp.build(records)
    secs = cue_seconds()
    bust = bust_offsets()
    print('bust at (s into the cue):', bust)
    todo = set(a.only or [])
    si, sn = (int(x) for x in a.shard.split('/'))
    fonts_ready = 'document.fonts.ready'
    with brand.playwright() as p:
        browser = brand.browser(p)
        pgs = {s: browser.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1) for s, (w, h) in SIZE.items()}
        # ---- the opener and the bust
        for name, shape, mode, B, dur in (('open', '16x9', 'full', bust['16x9'], max(12.0, secs.get('l01-16x9', 8) + 2)),
                                          ('open', '9x16', 'enter', None, 4.5),
                                          ('bust', '9x16', 'bust', None, 5.0)):
            pid = f'{name}-{shape}'
            if (todo and pid not in todo and name not in todo) or si != 0:
                continue
            if name == 'bust':
                # the slam lands on "bust": its cue's own offset, from its first word to the word
                B = bust['9x16']
            pg = browser.new_page(viewport={'width': SIZE[shape][0], 'height': SIZE[shape][1]}, device_scale_factor=1)
            html, js = opener_page(shape, mode, B, dur, bust)
            pg.set_content(html)
            pg.evaluate(fonts_ready)
            pg.add_script_tag(content=js)
            pg.wait_for_timeout(150)
            frames(pg, dur, OUT / f'{pid}.mp4', a.still)
            pg.close()
            print('drew', pid, f'B={B}', f'{dur}s')
        # ---- every drawn page
        for n, (pid, spec) in enumerate(panels.items()):
            if pid in ('l01', 's01') or (todo and pid not in todo) or n % sn != si:
                continue
            pg = pgs[spec['shape']]
            prev = {}
            many = len(spec['pages']) > 1
            for k, (body, _texts) in enumerate(spec['pages'], 1):
                stem = f'{pid}-{spec["shape"]}' if not many else f'{pid}-p{k}-{spec["shape"]}'
                seconds = round(min(14.0, max(4.5, secs.get(stem, 6.0) + 1.5)), 1)
                pg.set_content(generic_page(body))
                pg.evaluate(fonts_ready)
                pg.add_script_tag(content=ENGINE + GENERIC)
                push = .085 if pid in ('l03', 'l08', 'l15') else (.02 if many else .035)
                prev = pg.evaluate(f'setup({json.dumps(prev)},{seconds},{push})')
                pg.wait_for_timeout(80)
                frames(pg, seconds, OUT / f'{stem}.mp4', a.still)
                print('drew', stem, f'{seconds}s', flush=True)
        browser.close()


if __name__ == '__main__':
    main()
