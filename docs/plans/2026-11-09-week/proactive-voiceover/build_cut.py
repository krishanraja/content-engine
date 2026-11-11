"""Proactive-AI off-day short, the whole cut (take A, 0 to 42.1 s), on the proof Krish approved ("looks good",
11 Nov 2026). Data-story recipe (config/ve/recipes/data-story.json): one through-line object, the chat thread on your
AI's side; every move a change of state that says what the voice says; mint only for the answer. Captions: the
art-directed phrase style after his card instagram_DfkCOCLt7KZ. No wordmark in a tall cut. Off day: no series colour."""
import base64, json, pathlib, re
HERE = pathlib.Path(__file__).parent
REPO = pathlib.Path("/home/user/content-engine")
FONTS = REPO / "assets/fonts/makeyourmindup"

def b64(p, mime):
    return f"data:{mime};base64," + base64.b64encode(pathlib.Path(p).read_bytes()).decode()

T0, T1 = 0.0, 45.1
END = 42.0  # the end card (Krish, 11 Nov 2026: "we also need to have an outro card to follow for more at makeyourmindup.ai")
words = json.load(open(HERE / "words-a.json"))

# Hand-set phrases; *KEY* marks the key word. They must match the take's words in order.
PHRASES = """YOUR *AI* IS ABOUT | TO START *MESSAGING* | YOU *FIRST* | IT'LL *WAKE* UP | *BEFORE* YOU DO |
AND IT WON'T *WAIT* | TO BE *ASKED* | META'S AI, *MUSE* | IS ALREADY *SITTING* | IN YOUR *WHATSAPP* |
AND *EVERY* ASSISTANT | COMING *NEXT* | WANTS TO *ACT* | BEFORE YOU *ASK* |
SO *PICTURE* THIS | YOU *WAKE* UP | AND IT'S *BOOKED* | A *FLIGHT* | PAID THE HOTEL *DEPOSIT* | AND SENT YOUR *BOSS* |
A *THUMBS* UP | VERY *HELPFUL* | RIGHT UP *UNTIL* | IT DOES *SOMETHING* | YOU'D *NEVER* HAVE | SAID *YES* TO |
SO *GIVE* IT | TWO *RULES* TODAY | NO *SPENDING* | AND NO *SENDING* |
*NOTHING* GETS PAID | AND NOTHING GOES *OUT* | UNTIL YOU SAY *YES* | AND YOU DON'T *EVEN* | HAVE TO *WRITE* THEM |
*ASK* YOUR AI | ONE *QUESTION* | AND IT *WRITES* | THE *RULES* WITH YOU | THE *PROMPT'S* | IN THE *COMMENTS* |
*PASTE* IT IN | *TONIGHT* | BEFORE YOUR *ASSISTANT* | WAKES UP *TOMORROW*"""
norm = lambda x: re.sub(r"[^a-z']", "", x.lower().replace("’", "'"))
fix = {"prompts": "prompt's"}
seq = [fix.get(norm(w["w"]), norm(w["w"])) for w in words]
cap, k = [], 0
for i, ph in enumerate(p.strip() for p in PHRASES.replace("\n", " ").split("|")):
    toks = ph.split()
    out, key = [], 0
    for j, tok in enumerate(toks):
        if tok.startswith("*"): key = j
        clean = tok.strip("*,")
        assert norm(clean) == seq[k], (ph, clean, seq[k], k)
        out.append([clean, words[k]["s"]]); k += 1
    cap.append({"s": out[0][1], "w": out, "key": key, "side": i % 2})
assert k == len(words), (k, len(words))
for i, c in enumerate(cap):
    c["e"] = cap[i + 1]["s"] if i + 1 < len(cap) else words[-1]["e"] + 0.4

def at(word, n=1):
    c = 0
    for w, n_ in zip(words, seq):
        if n_ == word:
            c += 1
            if c == n: return w["s"]
    raise KeyError(word)

B = {"messaging": at("messaging"), "first": at("first"), "wake0": at("wake"), "do": at("do"), "wait": at("wait"),
     "muse": at("meta's"), "whatsapp": at("whatsapp"), "every": at("every"), "act": at("act"), "picture": at("picture"),
     "b1": at("booked"), "b2": at("paid"), "b3": at("sent"), "done": at("very"), "bad": at("until"), "gap": at("never"),
     "two": at("two"), "stop1": at("spending"), "stop2": at("sending"),
     "nothing": at("nothing"), "out": at("out"), "yes2": at("yes", 2), "even": at("even"), "ask": at("ask", 2),
     "writes": at("writes"), "prompt": at("prompt's"), "paste": at("paste"),
     "tonight": at("tonight"), "end": words[-1]["e"], "endcard": END}

html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Anton; src: url('{b64(FONTS/'Anton-Regular.ttf','font/ttf')}'); }}
@font-face {{ font-family: Archivo; src: url('{b64(FONTS/'Archivo-Variable.ttf','font/ttf')}'); font-weight: 100 900; }}
@font-face {{ font-family: Plex; src: url('{b64(FONTS/'IBMPlexMono-Medium.ttf','font/ttf')}'); }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html,body {{ width:1080px; height:1920px; overflow:hidden; background:#0A100D; }}
#stage {{ position:absolute; inset:0; background: radial-gradient(ellipse at 50% 40%, #1A2A23 0%, #0F1915 55%, #090E0C 100%); }}
#grain {{ position:absolute; inset:0; opacity:.07; mix-blend-mode:screen; }}
#ghost {{ position:absolute; left:-60px; right:-60px; top:700px; text-align:center; font-family:Anton; font-size:430px; line-height:1;
         color:#F4EFE4; opacity:0; white-space:nowrap; text-transform:uppercase; }}
#cam {{ position:absolute; inset:0; transform-origin: 720px 880px; }}
.thread {{ position:absolute; left:120px; top:230px; width:840px; height:820px; transform: perspective(1800px) rotateX(10deg) rotateZ(-3deg); transform-origin:50% 40%; }}
.copy {{ opacity:0; }}
.rail {{ position:absolute; inset:0; border:5px solid #F4EFE4; border-radius:36px; }}
.copy .rail {{ border-color: rgba(244,239,228,.45); }}
.clock {{ position:absolute; left:40px; top:28px; font-family:Plex; font-size:30px; letter-spacing:3px; color:#AEAEA5; }}
.who {{ position:absolute; right:40px; top:22px; display:flex; align-items:center; gap:14px; font-family:Plex; font-size:30px; letter-spacing:3px; color:#AEAEA5; }}
.who img {{ width:44px; height:44px; opacity:0; }}
.b {{ position:absolute; left:40px; display:flex; align-items:center; gap:22px; padding:22px 26px 22px 30px; border:4px solid #F4EFE4;
      border-radius:28px 28px 28px 6px; background:#0F1915; font-family:Archivo; font-weight:700; font-size:46px; color:#F4EFE4; white-space:nowrap; opacity:0; }}
.b.me {{ left:auto; right:40px; border-radius:28px 28px 6px 28px; background:#F4EFE4; color:#0C1512; }}
.b.rules {{ flex-direction:column; align-items:flex-start; gap:10px; }}
.b .typed {{ font-family:Archivo; font-weight:700; font-size:46px; }}
.slot {{ min-width:58px; height:58px; border-radius:29px; border:4px solid #F4EFE4; display:flex; align-items:center; justify-content:center;
      font-size:32px; color:#0C1512; background:#F4EFE4; transform:scale(0); padding:0 4px; font-family:Archivo; font-weight:800; }}
.slot.empty {{ background:transparent; border:4px dashed #F4EFE4; color:#F4EFE4; }}
.slot.ask {{ background:#7EF0C0; border:4px solid #7EF0C0; color:#0C1512; font-family:Plex; font-size:26px; padding:0 14px; }}
.dots {{ display:flex; gap:12px; padding:6px 4px; }} .dots i {{ width:16px; height:16px; border-radius:50%; background:#F4EFE4; display:block; }}
.gaplabel {{ position:absolute; font-family:Plex; font-size:30px; letter-spacing:2px; color:#F4EFE4; opacity:0; white-space:nowrap; }}
.bigclock {{ position:absolute; left:0; right:0; top:330px; text-align:center; font-family:Anton; font-size:300px; line-height:1; color:#F4EFE4; opacity:0; }}
.two {{ position:absolute; left:0; right:0; top:260px; text-align:center; font-family:Anton; font-size:520px; line-height:1; color:#F4EFE4; opacity:0; }}
.stop {{ position:absolute; left:-30px; width:900px; height:120px; display:flex; align-items:center; justify-content:center; gap:26px;
      background:#0C1512; border:5px solid #7EF0C0; border-radius:18px; opacity:0; }}
.stop .t {{ font-family:Anton; font-size:80px; color:#7EF0C0; letter-spacing:1px; }}
.stop .y {{ font-family:Plex; font-size:30px; color:#0C1512; background:#7EF0C0; padding:8px 16px; border-radius:8px; }}
.chip {{ position:absolute; left:40px; bottom:36px; font-family:Plex; font-size:34px; letter-spacing:2px; color:#0C1512; background:#7EF0C0;
      padding:14px 22px; border-radius:12px; opacity:0; }}
#cap {{ position:absolute; left:70px; right:210px; top:1095px; height:230px; }}
#cap .ph {{ position:absolute; top:0; display:flex; flex-direction:column; }}
#cap .ph.l {{ left:0; align-items:flex-start; }} #cap .ph.r {{ right:0; align-items:flex-end; }}
#cap .w {{ font-family:Anton; color:#FFFFFF; text-transform:uppercase; line-height:.96; letter-spacing:.5px; text-shadow:0 6px 24px rgba(0,0,0,.45); }}
#cap .row {{ display:flex; gap:22px; align-items:baseline; }}
</style></head><body>
<div id="stage"></div>
<div id="ghost"></div>
<svg id="grain" width="1080" height="1920"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/></filter><rect width="1080" height="1920" filter="url(#n)"/></svg>
<div id="cam">
 <div class="thread copy" id="c1"><div class="rail"></div></div>
 <div class="thread copy" id="c2"><div class="rail"></div></div>
 <div class="thread copy" id="c3"><div class="rail"></div></div>
 <div class="thread copy" id="c4"><div class="rail"></div></div>
 <div class="thread" id="thread">
  <div class="rail"></div>
  <div class="clock" id="clock">06:12</div><div class="who"><img id="wa" src="{b64(HERE/'wa-symbol.png','image/png')}"><span id="whoname">YOUR AI</span></div>
  <div class="b me" id="old1" style="top:110px">Can you book dinner?</div>
  <div class="b" id="old2" style="top:250px">Done</div>
  <div class="b" id="first" style="top:110px">Morning. I've already started.</div>
  <div class="b" id="typing" style="top:250px"><span class="dots"><i></i><i></i><i></i></span></div>
  <div class="b" id="b1" style="top:100px">Booked your flight<span class="slot empty">?</span></div>
  <div class="b" id="b2" style="top:245px">Paid the hotel deposit<span class="slot empty">?</span></div>
  <div class="b" id="b3" style="top:390px">Sent your boss a thumbs up<span class="slot empty">?</span></div>
  <div class="b" id="bad" style="top:545px">Bought that sofa you liked<span class="slot empty" id="badslot"></span></div>
  <div class="gaplabel" id="gaplabel" style="left:380px;top:690px">YOUR YES WAS HERE</div>
  <div class="stop" id="stop1" style="top:200px"><span class="t">NO SPENDING</span><span class="y">YES?</span></div>
  <div class="stop" id="stop2" style="top:470px"><span class="t">NO SENDING</span><span class="y">YES?</span></div>
  <div class="b me" id="q" style="top:110px">Set your rules with me?</div>
  <div class="b rules" id="rules" style="top:260px"><span class="typed" id="r1"></span><span class="typed" id="r2"></span></div>
  <img id="wabig" src="{b64(HERE/'wa-symbol.png','image/png')}" style="position:absolute;left:330px;top:330px;width:180px;height:180px;opacity:0">
  <div class="chip" id="chip">PROMPT IN THE COMMENTS &darr;</div>
 </div>
 <div class="bigclock" id="bigclock">07:00</div>
 <div class="two" id="two">2</div>
</div>
<div id="endcard" style="position:absolute;left:0;right:0;top:620px;text-align:center;opacity:0">
  <div style="font-family:Anton;font-size:150px;line-height:1;color:#F4EFE4;text-transform:uppercase">Follow<br>for more</div>
  <div style="margin-top:44px;font-family:Plex;font-size:52px;letter-spacing:2px;color:#7EF0C0">makeyourmindup.ai</div>
</div>
<div id="cap"></div>
<script>
const B = {json.dumps(B)}, CAP = {json.dumps(cap)};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const outBack=x=>{{const c=1.7;x=clamp(x);return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);}};
const outCubic=x=>1-Math.pow(1-clamp(x),3);
const $=id=>document.getElementById(id);
function pop(el,t0,t,dy=40){{const p=(t-t0)/0.12; if(p<=0){{el.style.opacity=0;return 0;}}
  el.style.opacity=clamp(p*1.6); el.style.transform=`translateY(${{(1-outCubic(p))*dy}}px) scale(${{0.92+0.08*outBack(p)}})`; return 1;}}
function leave(el,t0,t){{ if(t<t0) return; const p=outCubic((t-t0)/0.18); el.style.opacity=(1-p)*parseFloat(el.style.opacity||1); el.style.transform+=` translateY(${{-60*p}}px)`; }}
function show(el,on){{ el.style.display=on?'flex':'none'; }}
function type(el,text,t0,t,cps=26){{ const n=Math.max(0,Math.min(text.length,Math.floor((t-t0)*cps))); el.textContent=t<t0?'':text.slice(0,n); }}
window.render=function(t){{
  const ec=$('endcard'); if(t>=B.endcard){{ const e=outCubic((t-B.endcard)/0.3); $('cam').style.opacity=1-e; $('cap').innerHTML=''; $('ghost').style.opacity=0;
    const p=outBack((t-B.endcard-0.15)/0.25); ec.style.opacity=clamp(p*1.5); ec.style.transform=`translateY(${{(1-p)*50}}px) scale(${{0.92+0.08*p}})`; return; }}
  // ---- camera: a slow push through each scene; rest on the gap; pull back for the rules
  const rest=outCubic((t-B.gap)/0.45)*(1-outCubic((t-B.two)/0.35));
  const push=0.05*clamp(((t<B.picture?t:t-B.picture))/6);
  $('cam').style.transform=`scale(${{1+push+0.10*rest}})`;
  // ---- scene 1: the old way is already on the thread; on "messaging you first" it flips
  const s1=t<B.picture;
  ['old1','old2','first','typing'].forEach(id=>show($(id),s1));
  if(s1){{
    $('old1').style.opacity=1; $('old1').style.transform='none'; $('old2').style.opacity=1; $('old2').style.transform='none';
    leave($('old1'),B.messaging,t); leave($('old2'),B.messaging+0.06,t);
    pop($('first'),B.first,t); const ck=clamp((t-B.wake0)/0.15)*(1-outCubic((t-B.do-0.35)/0.2)); if(t>=B.first) $('first').style.opacity=1-0.85*ck;
    // "won't wait to be asked": it is already typing again
    pop($('typing'),B.wait,t); $('typing').querySelectorAll('i').forEach((d,i)=>d.style.opacity=0.35+0.65*Math.abs(Math.sin(t*6-i*0.7)));
    if(t>B.act+0.4){{ leave($('first'),B.act+0.4,t); leave($('typing'),B.act+0.45,t); }}
  }}
  // the big clock counts back from 07:00 to 06:12 on "wake up before you do", then settles into the header
  const bc=$('bigclock'), cp=clamp((t-B.wake0)/0.9), m=Math.round(48*outCubic(cp));
  const mins=60-m, hh=mins===60?'07':'06', mm=String(mins===60?0:mins).padStart(2,'0');
  bc.textContent=`${{hh}}:${{mm}}`; const bin=outBack((t-B.wake0+0.05)/0.15), bout=outCubic((t-B.do-0.35)/0.2);
  bc.style.opacity=t<B.wake0-0.05?0:clamp(bin)*(1-bout); bc.style.transform=`scale(${{0.8+0.2*bin-0.5*bout}}) translateY(${{-260*bout}}px)`;
  $('clock').textContent = t<B.do+0.4 && t>=B.wake0 ? '' : (t>=B.tonight?'22:00':'06:12');
  // WhatsApp's real mark lands once in the header on "Muse ... WhatsApp"; the header names Muse
  const wb=$('wabig'), wbi=outBack((t-B.whatsapp)/0.15), wbo=outCubic((t-B.whatsapp-0.8)/0.25);
  wb.style.opacity=t<B.whatsapp?0:clamp(wbi)*(1-wbo);
  wb.style.transform=`translate(${{410*wbo}}px,${{-300*wbo}}px) scale(${{(0.7+0.3*wbi)*(1-0.75*wbo)}})`;
  const wa=$('wa'), wp=outBack((t-B.whatsapp-0.9)/0.15); wa.style.opacity=t>=B.whatsapp+0.9&&t<B.picture?clamp(wp):0; wa.style.transform=`scale(${{wp}})`;
  $('whoname').textContent = (t>=B.muse && t<B.picture) ? 'MUSE' : 'YOUR AI';
  // "every assistant coming next": the thread copies itself, then the copies fold back into the one
  ['c1','c2','c3','c4'].forEach((id,i)=>{{const e=$(id); const p=outCubic((t-B.every-i*0.12)/0.2), back=outCubic((t-B.picture+0.35)/0.3);
    const v=p*(1-back); e.style.opacity=t<B.every?0:0.9*v;
    const dx=[-1,1,-1,1][i]*(60+40*i), dy=-30-25*i;
    e.style.transform=`perspective(1800px) rotateX(10deg) rotateZ(${{-3+[-4,4,-7,7][i]*v}}deg) translate(${{dx*v}}px,${{dy*v}}px) scale(${{1-0.05*(i+1)*v}})`; }});
  // ---- scene 2 (the approved proof): actions, the gap, the two stops
  const s2=t>=B.picture-0.02;
  ['b1','b2','b3','bad','stop1','stop2'].forEach(id=>show($(id),s2));
  if(s2){{
    pop($('b1'),B.b1,t); pop($('b2'),B.b2,t); pop($('b3'),B.b3,t);
    ['b1','b2','b3'].forEach((id,i)=>{{const sl=$(id).querySelector('.slot'); const t0=B[id]+0.08;
      sl.style.transform=`scale(${{outBack((t-t0)/0.14)}})`; sl.className='slot';
      if(t>=B.nothing+0.25+i*0.35){{sl.classList.add('ask'); sl.textContent='YES?';}}
      else if(t>=B.done+i*0.12){{sl.textContent='\\u2713';}} else {{sl.classList.add('empty'); sl.textContent='?';}} }});
    pop($('bad'),B.bad,t,60);
    const bs=$('badslot'); bs.style.transform=`scale(${{outBack((t-B.bad-0.08)/0.14)}})`; bs.className='slot';
    if(t>=B.nothing+0.25+3*0.35){{bs.classList.add('ask'); bs.textContent='YES?';}} else {{bs.classList.add('empty'); bs.textContent='';
      bs.style.borderColor=`rgba(244,239,228,${{t>B.gap?0.55+0.45*Math.abs(Math.sin((t-B.gap)*4)):1}})`;}}
    $('gaplabel').style.opacity=clamp((t-B.gap)/0.3)*(1-outCubic((t-B.two)/0.35));
    const dim=outCubic((t-B.two)/0.25);
    ['b1','b2','b3','bad'].forEach(id=>{{$(id).style.filter=t>B.two?`grayscale(${{t>B.nothing?0:1}}) brightness(${{1-0.6*dim}})`:'none';}});
    [['stop1',B.stop1-0.15],['stop2',B.stop2-0.15]].forEach(([id,t0])=>{{const e=$(id); const p=(t-t0)/0.18;
      e.style.opacity=clamp(p*2); e.style.transform=`translateY(${{-120*(1-outBack(p))}}px)`;
      // on "until you say yes" the stops glow once: they wait for you
      if(t>=B.yes2) e.style.boxShadow=`0 0 ${{40*Math.max(0,1-(t-B.yes2)/0.6)}}px #7EF0C0`; }});
    // "you don't even have to write them": the thread clears for your one question
    if(t>=B.even){{ ['b1','b2','b3','bad','stop1','stop2'].forEach((id,i)=>leave($(id),B.even+0.03*i,t)); }}
  }}
  const tw=$('two'); const pin=outBack((t-B.two)/0.18), pout=outCubic((t-B.stop1+0.15)/0.18);
  tw.style.opacity=t<B.two?0:clamp(pin)*(1-pout); tw.style.transform=`scale(${{0.6+0.4*pin}})`;
  // ---- scene 3: one question; it writes the rules with you; the prompt is in the comments
  const s3=t>=B.even+0.2; ['q','rules','chip'].forEach(id=>show($(id),s3));
  if(s3){{ pop($('q'),B.ask,t); pop($('rules'),B.writes-0.1,t);
    type($('r1'),'1  Ask me before you pay',B.writes,t,30); type($('r2'),'2  Ask me before you send',B.writes+0.85,t,30);
    pop($('chip'),B.prompt,t,30); }}
  // ---- captions: art-directed phrases (after instagram_DfkCOCLt7KZ)
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
(HERE / "cut.html").write_text(html)
json.dump({"t0": T0, "t1": T1, "beats": B, "page": "cut.html"}, open(HERE / "cut.json", "w"), indent=1)
print(json.dumps(B))
