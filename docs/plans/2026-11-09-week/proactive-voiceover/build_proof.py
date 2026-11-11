"""Proactive-AI off-day short, proof of the hardest beat (13.8 s to 27.4 s of take A), to the data-story recipe,
"The Ladder: one object, every number on it" (config/ve/recipes/data-story.json): one through-line object on the
ink desk with grain, every move a change of state that says what the voice says, mint only for the answer, one word
of caption at a time. The object: one chat thread, your AI's side. Off day: no series colour, pill or sting.
No wordmark in a tall cut (Krish, 11 Nov 2026)."""
import base64, json, pathlib
HERE = pathlib.Path(__file__).parent
REPO = pathlib.Path("/home/user/content-engine")
FONTS = REPO / "assets/fonts/makeyourmindup"

def b64(p, mime):
    return f"data:{mime};base64," + base64.b64encode(pathlib.Path(p).read_bytes()).decode()

T0, T1 = 13.8, 27.6
words = json.load(open(HERE / "words-a.json"))
win = [w for w in words if T0 - 0.05 <= w["s"] < T1]
# Hand-set phrases, as the caption reference does (instagram_DfkCOCLt7KZ): (words, index of the key word)
PHRASES = [(3,1),(3,1),(3,2),(2,1),(4,3),(4,3),(3,1),(2,1),(3,2),(3,2),(3,1),(3,1),(3,1),(3,1),(2,1),(3,2)]
assert sum(n for n, _ in PHRASES) == len(win), (sum(n for n, _ in PHRASES), len(win))
cap, k = [], 0
for i, (n, key) in enumerate(PHRASES):
    p = win[k:k + n]; k += n
    cap.append({"s": p[0]["s"], "w": [[x["w"].strip(",.").upper(), x["s"]] for x in p], "key": key, "side": i % 2})
for i, c in enumerate(cap):
    c["e"] = cap[i + 1]["s"] if i + 1 < len(cap) else T1

def at(word, n=1):
    k = 0
    for w in win:
        if w["w"].strip(",.").lower() == word.lower():
            k += 1
            if k == n: return w["s"]
    raise KeyError(word)

B = {"scene": T0, "b1": at("booked"), "b2": at("paid"), "b3": at("sent"), "done": at("Very"),
     "bad": at("until"), "gap": at("never"), "two": at("two"), "stop1": at("spending"), "stop2": at("sending")}

html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Anton; src: url('{b64(FONTS/'Anton-Regular.ttf','font/ttf')}'); }}
@font-face {{ font-family: Archivo; src: url('{b64(FONTS/'Archivo-Variable.ttf','font/ttf')}'); font-weight: 100 900; }}
@font-face {{ font-family: Plex; src: url('{b64(FONTS/'IBMPlexMono-Medium.ttf','font/ttf')}'); }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html,body {{ width:1080px; height:1920px; overflow:hidden; background:#0A100D; }}
#stage {{ position:absolute; inset:0; background: radial-gradient(ellipse at 50% 40%, #1A2A23 0%, #0F1915 55%, #090E0C 100%); }}
#grain {{ position:absolute; inset:0; opacity:.07; mix-blend-mode:screen; }}
#cam {{ position:absolute; inset:0; transform-origin: 720px 880px; }}
#thread {{ position:absolute; left:120px; top:230px; width:840px; height:820px; transform: perspective(1800px) rotateX(10deg) rotateZ(-3deg); transform-origin:50% 40%; }}
.rail {{ position:absolute; inset:0; border:5px solid #F4EFE4; border-radius:36px; }}
.clock {{ position:absolute; left:40px; top:28px; font-family:Plex; font-size:30px; letter-spacing:3px; color:#AEAEA5; }}
.who {{ position:absolute; right:40px; top:28px; font-family:Plex; font-size:30px; letter-spacing:3px; color:#AEAEA5; }}
.b {{ position:absolute; left:40px; display:flex; align-items:center; gap:22px; padding:22px 26px 22px 30px; border:4px solid #F4EFE4;
      border-radius:28px 28px 28px 6px; background:#0F1915; font-family:Archivo; font-weight:700; font-size:46px; color:#F4EFE4; white-space:nowrap; opacity:0; }}
.slot {{ width:58px; height:58px; border-radius:50%; border:4px solid #F4EFE4; display:flex; align-items:center; justify-content:center;
      font-size:32px; color:#0C1512; background:#F4EFE4; transform:scale(0); }}
.slot.empty {{ background:transparent; border:4px dashed #F4EFE4; color:#F4EFE4; }}
.gaplabel {{ position:absolute; font-family:Plex; font-size:30px; letter-spacing:2px; color:#F4EFE4; opacity:0; white-space:nowrap; }}
.two {{ position:absolute; left:0; right:0; top:260px; text-align:center; font-family:Anton; font-size:520px; line-height:1; color:#F4EFE4; opacity:0; }}
.stop {{ position:absolute; left:-30px; width:900px; height:120px; display:flex; align-items:center; justify-content:center; gap:26px;
      background:#0C1512; border:5px solid #7EF0C0; border-radius:18px; opacity:0; }}
.stop .t {{ font-family:Anton; font-size:80px; color:#7EF0C0; letter-spacing:1px; }}
.stop .y {{ font-family:Plex; font-size:30px; color:#0C1512; background:#7EF0C0; padding:8px 16px; border-radius:8px; }}
#cap {{ position:absolute; left:70px; right:210px; top:1095px; height:230px; }}
#cap .ph {{ position:absolute; top:0; display:flex; flex-direction:column; gap:0; }}
#cap .ph.l {{ left:0; align-items:flex-start; }} #cap .ph.r {{ right:0; align-items:flex-end; }}
#cap .w {{ font-family:Anton; color:#FFFFFF; text-transform:uppercase; line-height:.96; letter-spacing:.5px; text-shadow:0 6px 24px rgba(0,0,0,.45); }}
#cap .row {{ display:flex; gap:22px; align-items:baseline; }}
#ghost {{ position:absolute; left:-60px; right:-60px; top:700px; text-align:center; font-family:Anton; font-size:430px; line-height:1;
         color:#F4EFE4; opacity:0; white-space:nowrap; text-transform:uppercase; }}
</style></head><body>
<div id="stage"></div>
<div id="ghost"></div>
<svg id="grain" width="1080" height="1920"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/></filter><rect width="1080" height="1920" filter="url(#n)"/></svg>
<div id="cam">
 <div id="thread">
  <div class="rail"></div>
  <div class="clock">06:12</div><div class="who">YOUR AI</div>
  <div class="b" id="b1" style="top:100px">Booked your flight<span class="slot empty">?</span></div>
  <div class="b" id="b2" style="top:245px">Paid the hotel deposit<span class="slot empty">?</span></div>
  <div class="b" id="b3" style="top:390px">Sent your boss a thumbs up<span class="slot empty">?</span></div>
  <div class="b" id="bad" style="top:545px">Bought that sofa you liked<span class="slot empty" id="badslot"></span></div>
  <div class="gaplabel" id="gaplabel" style="left:380px;top:690px">YOUR YES WAS HERE</div>
  <div class="stop" id="stop1" style="top:200px"><span class="t">NO SPENDING</span><span class="y">YES?</span></div>
  <div class="stop" id="stop2" style="top:470px"><span class="t">NO SENDING</span><span class="y">YES?</span></div>
 </div>
 <div class="two" id="two">2</div>
</div>
<div id="cap"></div>
<script>
const B = {json.dumps(B)}, CAP = {json.dumps(cap)};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const outBack=x=>{{const c=1.7;x=clamp(x);return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);}};
const outCubic=x=>1-Math.pow(1-clamp(x),3);
const $=id=>document.getElementById(id);
function pop(el,t0,t,dy=40){{const p=(t-t0)/0.12; if(p<=0){{el.style.opacity=0;return;}}
  el.style.opacity=clamp(p*1.6); el.style.transform=`translateY(${{(1-outCubic(p))*dy}}px) scale(${{0.92+0.08*outBack(p)}})`;}}
window.render=function(t){{
  // camera: a slow push; it rests on the empty slot where your yes should be; pulls back for the rules
  const rest=outCubic((t-B.gap)/0.45), back=outCubic((t-B.two)/0.35);
  const s=1+0.05*clamp((t-B.scene)/6)+0.10*rest*(1-back);
  const tx=0, ty=0;
  $('cam').style.transform=`translate(${{tx}}px,${{ty}}px) scale(${{s}})`;
  pop($('b1'),B.b1,t); pop($('b2'),B.b2,t); pop($('b3'),B.b3,t);
  // each action arrives with an empty slot: nobody said yes; on "very helpful" the slots fill with done ticks
  ['b1','b2','b3'].forEach((id,i)=>{{const sl=$(id).querySelector('.slot'); const t0=B[id]+0.08;
    sl.style.transform=`scale(${{outBack((t-t0)/0.14)}})`;
    if(t>=B.done+i*0.12){{sl.classList.remove('empty'); sl.textContent='\\u2713';}} else {{sl.classList.add('empty'); sl.textContent='?';}} }});
  pop($('bad'),B.bad,t,60);
  const bs=$('badslot'); bs.style.transform=`scale(${{outBack((t-B.bad-0.08)/0.14)}})`;
  // the missing part: the slot stays empty and breathes; the label names the gap
  bs.style.borderColor=`rgba(244,239,228,${{t>B.gap?0.55+0.45*Math.abs(Math.sin((t-B.gap)*4)):1}})`;
  $('gaplabel').style.opacity=clamp((t-B.gap)/0.3)*(1-back);
  // "two rules": everything the AI did dims; one big 2 arrives, then becomes the two mint stops
  const dim=outCubic((t-B.two)/0.25);
  ['b1','b2','b3','bad'].forEach(id=>{{$(id).style.filter=t>B.two?`grayscale(1) brightness(${{1-0.6*dim}})`:'none';}});
  const tw=$('two'); const pin=outBack((t-B.two)/0.18), pout=outCubic((t-B.stop1+0.15)/0.18);
  tw.style.opacity=t<B.two?0:clamp(pin)*(1-pout); tw.style.transform=`scale(${{0.6+0.4*pin}})`;
  [['stop1',B.stop1-0.15],['stop2',B.stop2-0.15]].forEach(([id,t0])=>{{const e=$(id); const p=(t-t0)/0.18;
    e.style.opacity=clamp(p*2); e.style.transform=`translateY(${{-120*(1-outBack(p))}}px)`;}});
  // captions: art-directed phrases; the words build as said; the key word is big; its ghost echoes behind
  const ph=CAP.find(c=>t>=c.s-0.02&&t<c.e), capEl=$('cap'), gh=$('ghost');
  if(!ph){{capEl.innerHTML='';gh.style.opacity=0;return;}}
  const rows=[]; let row=[];
  ph.w.forEach(([w,ws],j)=>{{ if(t<ws-0.03) return; const big=j===ph.key; const p=outBack((t-ws)/0.12);
    const span=`<span class="w" style="font-size:${{big?168:92}}px;display:inline-block;transform:translateY(${{(1-p)*30}}px) scale(${{0.85+0.15*p}});opacity:${{clamp(p*2)}}">${{w}}</span>`;
    if(big){{ if(row.length) rows.push(row); rows.push([span]); row=[]; }} else row.push(span); }});
  if(row.length) rows.push(row);
  capEl.innerHTML=`<div class="ph ${{ph.side?'r':'l'}}">`+rows.map(r=>`<div class="row">${{r.join('')}}</div>`).join('')+'</div>';
  const kw=ph.w[ph.key]; const kp=clamp((t-kw[1])/0.15);
  gh.textContent=kw[0]; gh.style.opacity=t>=kw[1]-0.03?0.07*kp:0; gh.style.transform=`scale(${{1.06-0.06*kp}})`;
}};
</script></body></html>"""
(HERE / "proof.html").write_text(html)
json.dump({"t0": T0, "t1": T1, "beats": B}, open(HERE / "proof.json", "w"), indent=1)
print(B)
