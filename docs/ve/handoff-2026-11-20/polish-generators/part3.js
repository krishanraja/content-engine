
// ===== Protected baselines: the platform deep dive (Character.ai band) and the additive unit chart (Mon 2 Nov) =====
const frames = []
const add = (name, w, h, body) => frames.push({ name, w, h, html: page(w, h, body) })
const CAI = `file://${ROOT}/polish/cai`
const BUTTER = T.butter

// The original frames from his cut (sha 39f1039c...), kept as the baseline.
add('PD-0a-original-headline-wall', 1080, 1920, `<img class="abs" src="${CAI}/f-6.2.png" style="width:1080px">`)
add('PD-0b-original-recording-circles', 1080, 1920, `<img class="abs" src="${CAI}/f-9.6.png" style="width:1080px">`)
add('PD-0c-original-event-tape', 1080, 1920, `<img class="abs" src="${CAI}/f-13.2.png" style="width:1080px">`)

// The face band and his caption stay the cut's own: the rebuilt panel covers y 0 to 1000 only.
const keepBand = (src) => `<img class="abs" src="${CAI}/${src}" style="width:1080px">`
// A platform UI wall built from his real screen grabs (the cards of his own screen recording), not drawn tiles.
function uiWall(drift = 0) {
  const cards = [0, 1, 2, 3]
  let out = ''
  for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) {
    const k = (r * 3 + c) % 4, x = -60 + c * 156 + (r % 2) * 40 - drift, y = -40 + r * 236
    out += `<img src="${CAI}/card${k}.png" style="position:absolute;left:${x}px;top:${y}px;width:140px;height:220px;object-fit:cover;border-radius:12px;opacity:.9">`
  }
  return `<div class="abs" style="inset:0;overflow:hidden">${out}</div><div class="abs" style="inset:0;background:linear-gradient(180deg, rgba(7,13,11,.55), rgba(7,13,11,.72))"></div>`
}
const platformHeader = `<img class="abs" src="${CAI}/cai-wordmark.png" style="left:${540 - 175}px;top:40px;width:350px;mix-blend-mode:screen">`
const yellowTop = `<div class="abs" style="left:0;right:0;top:0;height:8px;background:${BUTTER}"></div>`

// PD-1: rebuilt, then polished: the wall is his real grabs; the two-tone headline (cream, one mint word) slams in by
// word (the cut's own WORD BLUR-IN: 8 px blur to sharp in 2 to 3 f at 30 fps); grain; tighter leading; 72 px margins.
function headlineWall(f) {
  const words = [['Millions', T.cream], ['made', T.cream], ['friends', T.mint], ['here.', T.cream]]
  const lines = [[0, 1], [2, 3]]
  const w = (i) => { const p = clamp((f - i * 4) / 3); return `<span style="display:inline-block;color:${words[i][1]};filter:blur(${(1 - p) * 8}px);opacity:${0.5 + 0.5 * p};margin-right:.18em">${words[i][0]}</span>` }
  return `${keepBand('f-6.2.png')}
  <div class="abs" style="left:0;top:0;width:1080px;height:1000px;background:${T.inkDeep};overflow:hidden">${uiWall(f * 0.6)}<div class="grain"></div>
    ${yellowTop}${platformHeader}
    <div class="abs display" style="left:72px;right:72px;top:330px;font-size:150px;line-height:.9;text-align:center;text-shadow:0 10px 40px rgba(0,0,0,.45)">${lines.map(l => l.map(w).join('')).join('<br>')}</div>
    <div class="abs data" style="left:72px;top:920px;font-size:22px;opacity:.7">CHARACTER.AI HOME PAGE · SCREEN GRABS · 28 OCT 2026</div></div>`
}
add('PD-1a-polish-headline-wall-f6', 1080, 1920, headlineWall(6))
add('PD-1b-polish-headline-wall-settled', 1080, 1920, headlineWall(24))

// PD-2: the screen recording, with hand-drawn loops on the items he names, each drawn on his word (8 f, utility),
// double stroke, in the day's colour (butter on follow.the.money), and the mono source line under it.
function recording(f) {
  const loop = (cx, cy, rx, ry, start, seed) => {
    const p = UTIL(prog(f, start, 8)), L = 2 * Math.PI * Math.max(rx, ry) * 1.1
    const d = `M ${cx + rx} ${cy} C ${cx + rx} ${cy - ry * 1.15}, ${cx - rx * 1.1} ${cy - ry}, ${cx - rx} ${cy + seed} S ${cx + rx * 0.9} ${cy + ry * 1.2}, ${cx + rx * 1.05} ${cy - ry * 0.25}`
    return `<path d="${d}" fill="none" stroke="${BUTTER}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - p)}"/>
    <path d="${d}" fill="none" stroke="${BUTTER}" stroke-width="3" stroke-linecap="round" opacity=".6" transform="rotate(4 ${cx} ${cy})" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - UTIL(prog(f, start + 3, 8)))}"/>`
  }
  const push = 1 + 0.04 * clamp(f / 60)
  return `${keepBand('f-9.6.png')}
  <div class="abs" style="left:0;top:0;width:1080px;height:1000px;background:${T.inkDeep};overflow:hidden"><div class="grain"></div>${yellowTop}
    <div class="abs" style="left:40px;top:230px;width:1000px;height:438px;border-radius:22px;overflow:hidden;border:2px solid rgba(244,239,228,.16);box-shadow:0 30px 80px rgba(0,0,0,.5)">
      <img src="${CAI}/rec.png" style="width:1000px;transform:scale(${push});transform-origin:30% 50%"></div>
    <svg class="abs" style="left:0;top:0" width="1080" height="1000">${loop(240, 380, 92, 84, 6, 8)}${loop(868, 380, 92, 84, 18, -6)}</svg>
    <div class="abs data" style="left:72px;top:720px;font-size:22px;opacity:.75">CHARACTER.AI HOME PAGE · SCREEN RECORDING · 28 OCT 2026</div></div>`
}
add('PD-2a-polish-recording-first-loop', 1080, 1920, recording(12))
add('PD-2b-polish-recording-both-loops', 1080, 1920, recording(40))

// PD-3: event tape. Two butter tapes cross the panel (Anton repeat on the upper, the filing in mono on the lower, both
// slide in from opposite sides, 10 f hero), the confetti chips burst once (12 chips, mint, cream and butter), the
// headline: a small cream line, then the giant butter word.
function tape(f) {
  const t1 = HERO(prog(f, 0, 10)), t2 = HERO(prog(f, 3, 10)), h = HERO(prog(f, 8, 8))
  const rep = (s, n) => Array.from({ length: n }, () => s).join('')
  const chips = Array.from({ length: 12 }, (_, i) => {
    const a = i * 2.4, r = 120 + 260 * clamp((f - 8) / 14) * (0.6 + (i % 3) * 0.2)
    const x = 540 + Math.cos(a) * r * 1.4, y = 520 + Math.sin(a) * r * 0.8
    const c = [T.mint, T.cream, BUTTER][i % 3]
    return f > 8 ? `<div class="abs" style="left:${x}px;top:${y}px;width:${18 + (i % 4) * 6}px;height:10px;background:${c};transform:rotate(${i * 37}deg);opacity:${1 - clamp((f - 24) / 12)}"></div>` : ''
  }).join('')
  return `${keepBand('f-13.2.png')}
  <div class="abs" style="left:0;top:0;width:1080px;height:1000px;background:${T.inkDeep};overflow:hidden">${uiWall(f * 0.6)}<div class="grain"></div>${yellowTop}${platformHeader}
    <div class="abs" style="left:-100px;top:170px;width:1400px;transform:translateX(${(1 - t1) * -1400}px) rotate(-6deg);background:${BUTTER};padding:14px 0;box-shadow:0 10px 0 rgba(0,0,0,.25)">
      <div class="display" style="font-size:64px;color:${T.ink};white-space:nowrap">${rep('Chapter 11 · ', 8)}</div></div>
    <div class="abs" style="left:-100px;top:800px;width:1400px;transform:translateX(${(1 - t2) * 1400}px) rotate(5deg);background:${BUTTER};padding:16px 0;box-shadow:0 10px 0 rgba(0,0,0,.25)">
      <div class="data" style="font-size:34px;font-weight:600;color:${T.ink};white-space:nowrap;letter-spacing:.12em">${rep('COURT FILING · FILED 12 OCT 2026 · ', 4)}</div></div>
    ${chips}
    <div class="abs" style="left:0;right:0;top:360px;text-align:center;opacity:${h};transform:scale(${1.08 - 0.08 * h})">
      <div class="display" style="font-size:96px;color:${T.cream}">Now it's</div>
      <div class="display" style="font-size:230px;color:${BUTTER};margin-top:-6px">Bankrupt.</div></div></div>`
}
add('PD-3a-polish-tape-f6', 1080, 1920, tape(6))
add('PD-3b-polish-tape-settled', 1080, 1920, tape(20))

// ---- the additive unit chart (Mon 2 Nov, "Who trains your 2030 seniors") ----
// 100 ID badges, 10 x 10, a plane in slight 3D; the juniors carry a butter stripe; one change lands per spoken claim.
const JUNIORS = (() => { const s = []; for (let i = 0; i < 100 && s.length < 27; i++) if (((i * 53 + 17) % 100) < 28) s.push(i); return s })()
function unitChart(state, { w = 1080, h = 1920, wide = false } = {}) {
  // state: 0 = the wall lands (no stripes), 1 = 27 juniors striped ("27%"), 2 = juniors grey from the end of the grid to 9 left ("9%")
  const greyed = state >= 2 ? JUNIORS.slice(9) : []
  const pct = state === 0 ? '' : state === 1 ? '27%' : '9%'
  const badges = Array.from({ length: 100 }, (_, i) => {
    const jr = state >= 1 && JUNIORS.includes(i), grey = greyed.includes(i)
    return `<div style="width:62px;height:84px;border-radius:7px;background:${grey ? '#5d6461' : '#F7F4EC'};opacity:${grey ? 0.5 : 1};position:relative;box-shadow:0 4px 0 rgba(0,0,0,.35)">
      <div style="position:absolute;left:22px;top:7px;width:18px;height:5px;border-radius:3px;background:rgba(12,21,18,.25)"></div>
      ${jr ? `<div style="position:absolute;left:0;right:0;top:56px;height:11px;background:${grey ? '#7c7a64' : BUTTER}"></div>` : ''}</div>`
  }).join('')
  const grid = `<div style="display:grid;grid-template-columns:repeat(10,62px);gap:12px;transform:perspective(1600px) rotateX(24deg) rotateZ(-6deg) skewX(-4deg)">${badges}</div>`
  if (!wide) return `${bandTake()}
  <div class="abs" style="left:0;top:0;width:1080px;height:${PANEL_H}px;background:radial-gradient(90% 70% at 40% 20%, #15241e, ${T.inkDeep} 75%);overflow:hidden"><div class="grain"></div>
    <div class="abs data" style="left:72px;top:96px;font-size:22px;opacity:.75">ANTHROPIC · OCT 2026</div>
    <div class="abs display" style="left:66px;top:130px;font-size:230px;color:${T.cream}">${pct}</div>
    <div class="abs" style="left:540px;top:300px;transform:scale(.6);transform-origin:0 0">${grid}</div></div>
  ${seamCaption(state === 0 ? 'out of every hundred' : state === 1 ? 'juniors were 27' : 'and now just 9').replace(T.coral, BUTTER)}`
  return `${wideTake()}
  <div class="abs" style="left:0;top:0;width:1312px;height:1080px;background:radial-gradient(90% 70% at 40% 20%, #15241e, ${T.inkDeep} 75%);overflow:hidden"><div class="grain"></div>
    <div class="abs data" style="left:96px;top:96px;font-size:22px;opacity:.75">ANTHROPIC · OCT 2026</div>
    <div class="abs display" style="left:90px;top:140px;font-size:260px;color:${T.cream}">${pct}</div>
    <div class="abs" style="left:640px;top:190px;transform:scale(.72);transform-origin:0 0">${grid}</div></div>
  <div class="abs caption" style="left:0;width:1312px;top:930px;display:flex;justify-content:center"><span style="background:${T.ink};color:${T.cream};font-size:52px;padding:14px 30px 18px;box-shadow:0 8px 0 ${BUTTER}">and now just 9</span></div>`
}
add('UC-0-original-mon02', 1080, 1920, `<img class="abs" src="${W}/jobs-before.png" style="width:1080px">`)
add('UC-1-tall-wall-lands', 1080, 1920, unitChart(0))
add('UC-2-tall-27-juniors', 1080, 1920, unitChart(1))
add('UC-3-tall-greys-to-9', 1080, 1920, unitChart(2))
add('UC-4-wide-greys-to-9', 1920, 1080, unitChart(2, { wide: true }))

;(async () => {
  const browser = await chromium.launch(); const only = process.argv[2]
  for (const fr of frames) {
    if (only && !fr.name.startsWith(only)) continue
    const file = path.join(HTML, fr.name + '.html'); fs.writeFileSync(file, fr.html)
    const p = await browser.newPage({ viewport: { width: fr.w, height: fr.h } })
    await p.goto('file://' + file); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(120)
    await p.screenshot({ path: path.join(OUT, fr.name + '.png') }); await p.close(); console.log('wrote', fr.name)
  }
  await browser.close()
})()
