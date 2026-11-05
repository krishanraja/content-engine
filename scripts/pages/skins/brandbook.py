"""Brand book revival (series skin "brandbook", concept c01): the v1.4 devices Krish called the fun, worn by the three weekly series pieces.

One family on Mon, Wed and Fri, each in its own colour, on the house cream:
- one bold block of the series colour sits behind the proof, counter-tilted (+5deg) to the proof's -2.5deg and
  bled off the card on purpose (tall: a band right across, off both sides, under the proof; wide: one clean
  polygon behind the proof, off the left and the foot, whose right end is a single long slant that reaches the
  foot well short of YouTube's length badge and stays well clear under the headline);
- that block casts a hard ink shadow, drawn as its own grained ink plate (grain on the dark plates only);
- each series cuts its block its own way, with no words, where the block has room beside or below the proof:
  follow.the.money's block is a flow that starts narrow (6u) at the left edge, beside the proof, and widens to the
  block's full height on the right; under.the.hood's block comes apart along one cut and its part slides out,
  leaving a cream channel of even width (tall: under the proof; wide: a shallow 25deg cut from the proof's right
  corner to the foot, the slid-out part meeting the frame along a clear edge);
  mind.the.gap's block has a cream gap whose two edges lean toward each other and meet at one point under the
  proof's right corner (tall: the block's +5deg edge over a strip at the proof's own -2.5deg, so no third angle;
  wide: opening toward the foot, its upper edge landing on the foot as a prong); one rule in all four cuts: the
  block's ink shadow falls into the cut from its near side only, as any hard shadow would, and in mind.the.gap the
  upper part lies over the lower, so that shadow runs on at its one depth and the gap stays cream to its point;
- two hard-shadow depths only: 2u for the big pieces (the block and the proof frame, in ink) and 1.2u for the small
  ink pieces (the wordmark plate and the pill in the series colour, the highlight bar in ink);
- the pill's ink right edge sits on the headline's right ink edge (one right margin, as the plate and the
  headline share the left); its shadow may pass the safe box's edge by up to 1u, its words never;
- the highlight bar is the series colour with one hard ink shadow round the whole stepped bar.
No stickers, no halftone, no words in any decoration, nothing on the words.
Logo plates are kept clear too. On tall the plate sits under the proof on the column's left edge: every piece is cut
back from it, square, 2.8u right of it and its hard shadow 2u over it, so the block steps down beside the plate. On
wide the plates sit over the headline and push it down; the slant still meets the block's top edge behind the proof,
at least a quarter of the way across it, standing up and reaching the foot sooner when a low headline would lay it
flat.
"""
import re
from urllib.parse import quote

TILT = 5            # the colour block's counter-tilt, degrees (the proof leans -2.5; the house range is -8 to +5)
PLATE = 1.2         # the one hard-shadow depth of the small ink pieces: wordmark plate, series pill, highlight bar (u)
BLOCK = 2           # the one hard-shadow depth of the big pieces: the colour block and the proof frame (u)


def grain(alpha):
    """A tiling fractal-noise grain of light specks, for the ink plates only (never behind words)."""
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>"
           "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/>"
           "<feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.6 0 0 0 -.55'/></filter>"
           f"<rect width='240' height='240' filter='url(#g)' opacity='{alpha}'/></svg>")
    return f'url("data:image/svg+xml,{quote(svg)}")'


def skin(html, facts, shape, look, kit):
    if not look.get('series'):
        return html
    col = look['colour']
    ink = kit.INK
    cream = kit.CREAM
    lift = kit.mix(cream, '#FFFFFF', .45)
    u = 8 if kit.tall else 9                   # the house hard-shadow unit at this size (10 px on a 136 px tile)
    css = f"""
:root {{ --col: {col}; --u: {u}px; --sp: calc(var(--u) * {PLATE}); --sb: calc(var(--u) * {BLOCK}); }}
body {{ background: {cream}; }}
#card {{ background: radial-gradient(ellipse 90% 70% at 30% 18%, {lift} 0, {cream} 72%) !important; }}
#safe {{ z-index: 50; }}
.wmp {{ box-shadow: var(--sp) var(--sp) 0 {col}; }}
.pill {{ background: {ink}; color: {col}; box-shadow: var(--sp) var(--sp) 0 {col}; transform: translateX(calc(var(--sp) * -1)); }}
.pin .tag, .tag {{ background: {ink}; color: {col}; }}
.frame {{ box-shadow: var(--sb) var(--sb) 0 {ink}; }}
h1 mark {{ background: {col}; color: {ink}; box-shadow: none;
          filter: drop-shadow(var(--sp) var(--sp) 0 {ink}); }}
.deco {{ position: absolute; display: block; pointer-events: none; }}
.deco.shade {{ background: {grain(.3)}, {ink}; }}
.deco.slab {{ background: {col}; }}
"""
    html = html.replace('</style>', css + '</style>', 1)
    html = re.sub(r'<div id="card"', f'<div id="card" data-day="{kit.day}"', html, count=1)
    return html


# Placed after the house fit, against the laid-out proof, tag and headline, so nothing ever touches the words.
# Every piece is a polygon in card pixels drawn in an unturned box exactly its own size, so the overlap check
# measures the shape itself. All shades sit under all slabs, so pieces of one colour read as one block.
PLACE_JS = r"""([shape]) => {
  const card = document.querySelector('#card');
  const W = card.clientWidth, H = card.clientHeight, day = card.dataset.day, tall = shape !== 'wide';
  const C = card.getBoundingClientRect();
  const R = q => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect();
                   return {left: r.left - C.left, right: r.right - C.left, top: r.top - C.top, bottom: r.bottom - C.top}; };
  const T = R('.tag'), h1 = R('h1');
  const headBottom = Math.max(h1.bottom, ...[...document.querySelectorAll('h1 mark')].flatMap(e => [...e.getClientRects()]).map(r => r.bottom - C.top));
  const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u'));
  const SH = u * BLOCK, SP = u * PLATE, E = u * 4;  // the block's (and frame's) hard shadow; the plates'; how far a bleed runs off the card
  const rad = TILT_DEG * Math.PI / 180, tan = Math.tan(rad), ax = [Math.cos(rad), Math.sin(rad)], dn = [-Math.sin(rad), Math.cos(rad)];
  // The proof frame's four turned corners, measured with markers at its border box.
  const fr = document.querySelector('.frame'), bw = parseFloat(getComputedStyle(fr).borderTopWidth);
  const corner = (x, y) => { const m = document.createElement('i');
    Object.assign(m.style, {position: 'absolute', left: x, top: y, width: '0', height: '0'}); fr.appendChild(m);
    const r = m.getBoundingClientRect(); m.remove(); return [r.left - C.left, r.top - C.top]; };
  const lo = `-${bw}px`, hi = `calc(100% + ${bw}px)`;
  const FTL = corner(lo, lo), FTR = corner(hi, lo), FBR = corner(hi, hi), FBL = corner(lo, hi);
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]], sub = (p, q) => [p[0] - q[0], p[1] - q[1]], mul = (p, k) => [p[0] * k, p[1] * k];
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const atX = (A, B, x) => lerp(A, B, (x - A[0]) / (B[0] - A[0]));       // the point of line AB at x
  const atY = (A, B, y) => lerp(A, B, (y - A[1]) / (B[1] - A[1]));      // the point of line AB at y
  const meet = (A, B, P, Q) => { const d1 = sub(B, A), d2 = sub(Q, P), den = d1[0] * d2[1] - d1[1] * d2[0];
    return add(A, mul(d1, ((P[0] - A[0]) * d2[1] - (P[1] - A[1]) * d2[0]) / den)); };
  // The part of a polygon where f >= 0 (one Sutherland-Hodgman plane).
  const clip = (pts, f) => { const out = []; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], a = f(p), b = f(q);
    if (a >= 0) out.push(p); if ((a >= 0) !== (b >= 0)) out.push(lerp(p, q, a / (a - b))); }); return out; };
  // Each piece sits on a layer (z): a layer's shades are drawn under its own slabs, and over every lower layer.
  const shades = [], slabs = [];
  // On tall, a logo plate sits on the column's left edge under the proof: every piece is cut back from it, square,
  // 2.8u right of it and its hard shadow 2u over it, so the block steps down beside the plate and no box reaches it.
  const LG = tall ? R('.logos') : null;
  const notch = pts => { if (!LG) return [pts];
    const xr = LG.right + u * 2.8, yt = LG.top - SH - u * 2;
    return [clip(clip(pts, p => xr - p[0]), p => yt - p[1]), clip(pts, p => p[0] - xr)].filter(q => q.length > 2); };
  const shaded = (pts, z = 0) => notch(pts).forEach(q => { shades.push({pts: q.map(p => add(p, [SH, SH])), z}); slabs.push({pts: q, z}); });
  const yTop = T.bottom + u * 2.8;                    // the block's highest point, clear below the tag
  const top = x => yTop + (x + E) * tan;             // its +5deg top edge, highest at the left bleed
  if (tall) {
    // A band right across the card behind the proof, off both sides; its bottom edge well below the proof.
    const P = [W / 2, FBL[1] + u * (day === 'fri' ? 14 : 18)], bot = x => P[1] + (x - P[0]) * tan;
    const TL = [-E, top(-E)], TR = [W + E, top(W + E)], BR = [W + E, bot(W + E)], BL = [-E, bot(-E)];
    if (day === 'mon') {
      // follow.the.money: narrow (6u) at the left edge beside the proof, the block's full height at the right.
      const y0 = lerp(TL, BL, MON_AT)[1], A = [0, y0 - u * 3], B = [0, y0 + u * 3];
      shaded([atX(A, TR, -E), TR, BR, atX(B, BR, -E)]);
    } else if (day === 'wed') {
      // under.the.hood: one cut, and the part beyond it slides out along the block and down.
      const cutT = lerp(TL, TR, WED_K[0]), cutB = lerp(BL, BR, WED_K[1]);
      const d = add(mul(ax, u * WED_M[0]), mul(dn, u * WED_M[1]));
      shaded([TL, cutT, cutB, BL]);
      shaded([cutT, TR, BR, cutB].map(p => add(p, d)));
    } else {
      // mind.the.gap: under the block a strip of the same colour, turned to the proof's own -2.5deg, so the block's
      // +5deg bottom edge and the strip's top edge lean in to meet at one point under the proof's right corner. The
      // strip is tucked under the block: the block's ink shadow falls into the gap and runs on across the strip at
      // one even depth, so the gap stays cream right to its point and no black needle closes it.
      const M = [FBR[0], bot(FBR[0])], tl = Math.tan(FRI_TILT * Math.PI / 180), low = x => M[1] + (x - M[0]) * tl, t = u * FRI_T;
      shaded([[-E, low(-E)], [W + E, low(W + E)], [W + E, low(W + E) + t], [-E, low(-E) + t]], 0);
      shaded([TL, TR, BR, BL], 1);
    }
  } else {
    // One polygon behind the proof, off the left and the foot. Its right end is one slant from behind the proof
    // to the foot, well clear under the headline and short of YouTube's length badge (x 968).
    const foot = 968 - u * 3;
    const yC = Math.min(headBottom + u * CLEAR, H - u * 10);
    const D0 = [h1.left, yC];
    let D1 = [foot, H];
    // The slant meets the block's top edge behind the proof, at least a quarter of the way across it. A low headline
    // (logo plates over it in the column) would lay it so flat that the two edges met off the card; then the slant
    // stays clear under the headline and is stood up to meet the top edge there, reaching the foot sooner.
    const Pmin = FTL[0] + (FTR[0] - FTL[0]) * .25;
    if (meet([-E, top(-E)], [W, top(W)], D0, D1)[0] < Pmin) D1 = atY(D0, [Pmin, top(Pmin)], H);
    const TLb = [-E, top(-E)], Phi = meet(TLb, [W, top(W)], D0, D1), Dft = atY(D0, D1, H + E), BLb = [-E, H + E];
    const FS = add(FBR, [SH, SH]);                    // the corner of the proof's own hard shadow
    let pieces;
    if (day === 'mon') {
      // follow.the.money: narrow (6u) at the left edge beside the proof's lower half, widening under the proof
      // to the slant's full height.
      const y0 = lerp(FTL, FBL, MON_W)[1], A = [0, y0 - u * 3], B = [0, y0 + u * 3];
      const Pt = atY(D0, D1, lerp(FTR, FBR, .4)[1]), Db = [MON_FOOT, H];       // its top edge meets the slant behind the proof
      pieces = [[atX(A, Pt, -E), Pt, Dft, atY(B, Db, H + E), atX(B, Db, -E)]];
    } else {
      const base = [TLb, Phi, Dft, BLb], ed = sub(FBR, FTR), deg = g => [Math.cos(g * Math.PI / 180), Math.sin(g * Math.PI / 180)];
      const side = (A, dir) => { const n = Math.hypot(dir[0], dir[1]);       // signed distance: + below / left of a line run rightward or downward
        return p => (dir[0] * (p[1] - A[1]) - dir[1] * (p[0] - A[0])) / n; };
      const sIn = side(add(FS, [-SH, 0]), ed);          // the line whose own shadow ends on the proof's shadow edge
      if (day === 'wed') {
        // under.the.hood: one cut from the proof's right corner to the foot; the part beyond it slides out along the
        // block, leaving a cream channel of even width. The slant is drawn one slide short, so once slid out it
        // sits exactly where the family's slant sits.
        // The cut is shallow (WED_A), so the block's 2u down-right shadow falls into the channel from the slid-out
        // part's edge, at an even depth all the way down. The slid-out part is bounded behind the proof (WED_B in from
        // its right edge), so the cut never shows beside the proof; it meets the frame along a clear edge.
        const f = side(FS, deg(WED_A)), d = mul(ax, u * WED_S), D0w = sub(D0, d), D1w = sub(D1, d);
        const g = side(add(FTR, [-u * WED_B, 0]), ed);
        const bw = [TLb, meet(TLb, [W, top(W)], D0w, D1w), atY(D0w, D1w, H + E), BLb], far = clip(bw, p => -f(p));
        // The part that stays is drawn in two pieces, either side of the cut's line; the one above it reaches 1 px past
        // the line, so where that line runs on beside the proof no seam shows between them.
        pieces = [clip(bw, f), clip(clip(bw, p => 1 - f(p)), g), clip(far, p => -g(p)).map(p => add(p, d))];
      } else {
        // mind.the.gap: a cream gap opens toward the foot, its two edges leaning in to meet at the proof's right corner.
        // The upper edge is steep enough to land on the foot (a prong, never a needle in the cream), and as in the
        // tall, the block's ink shadow falls into the gap along that upper edge. The prong runs on behind the proof
        // (to the line whose shadow ends on the proof's), so its shadow starts at the gap's apex, not 2u short.
        const fu = side(FS, deg(FRI_U)), fl = side(FS, deg(FRI_L));
        const upper = clip(clip(base, p => -fu(p)), p => 1 - sIn(p)), lower = clip(clip(base, fl), p => 1 - sIn(p));
        // As in the tall, the prong is laid over the lower part, so where the gap starts narrower than the prong's
        // shadow, that shadow runs on over the lower part at its one depth and the gap's cream reaches its point.
        upper.z = 1;
        pieces = [clip(base, p => sIn(p) + 1), lower, upper];
      }
    }
    // A piece that reaches the headline's column is drawn in two halves, split at the column's edge with a 2 px
    // overlap, so neither half's box reaches the headline (the overlap check measures boxes). Each half of the
    // shade is cut from the whole shade, so the split itself casts no shadow.
    const xs = h1.left - 2, L = p => xs + 1 - p[0], Rt = p => p[0] - (xs - 1);
    pieces.forEach(pts => {
      const sh = pts.map(p => add(p, [SH, SH])), z = pts.z || 0;
      if (Math.max(...sh.map(p => p[0])) < h1.left) { shades.push({pts: sh, z}); slabs.push({pts, z}); return; }
      shades.push({pts: clip(sh, L), z}, {pts: clip(sh, Rt), z}); slabs.push({pts: clip(pts, L), z}, {pts: clip(pts, Rt), z});
    });
  }
  // The pill's ink right edge on the headline's right edge (its glyphs' ink, or a highlight bar if one reaches
  // further), so pill and headline share one right margin as the wordmark plate and headline share the left. The
  // pill casts the wordmark plate's own shadow (SP). The safe box binds the pill's words, not its shadow (the block
  // bleeds off the card too), so the shadow may pass the safe box's edge by up to 1u; past that the pill is set back.
  const pill = document.querySelector('.pill');
  if (pill) {
    const cv = document.createElement('canvas').getContext('2d');
    let inkR = Math.max(...[...document.querySelectorAll('h1 mark')].flatMap(e => [...e.getClientRects()]).map(r => r.right - C.left));
    const tw = document.createTreeWalker(document.querySelector('h1'), NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const cs = getComputedStyle(n.parentElement), up = cs.textTransform === 'uppercase';
      cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      for (let i = 0; i < n.length; i++) {
        const ch = n.data[i]; if (!ch.trim()) continue;
        const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
        const r = rg.getBoundingClientRect(); if (!r.width) continue;
        inkR = Math.max(inkR, r.left - C.left + cv.measureText(up ? ch.toUpperCase() : ch).actualBoundingBoxRight);
      }
    }
    const S = document.querySelector('#safe').getBoundingClientRect().right - C.left;
    pill.style.transform = 'none';
    const p0 = pill.getBoundingClientRect().right - C.left, to = Math.min(inkR, S + u - SP);
    pill.style.transform = `translateX(${(to - p0).toFixed(1)}px)`;
  }
  const all = [0, 1].flatMap(z => [...shades.filter(p => p.z === z).map(p => ({pts: p.pts, cls: 'shade'})),
                                    ...slabs.filter(p => p.z === z).map(p => ({pts: p.pts, cls: 'slab'}))]).filter(p => p.pts.length > 2);
  all.forEach((p, i) => {
    const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const el = document.createElement('div'); el.className = 'deco ' + p.cls;
    Object.assign(el.style, {left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px', zIndex: i + 1,
      clipPath: 'polygon(' + p.pts.map(q => `${(q[0] - x0).toFixed(1)}px ${(q[1] - y0).toFixed(1)}px`).join(', ') + ')'});
    card.insertBefore(el, card.querySelector('#safe'));
  });
  return all.length;
}"""
# MON_AT / MON_W: where the flow's narrow end sits down the left edge (tall: of the block; wide: of the proof);
# MON_FOOT: where the wide flow's lower edge leaves the foot. WED_K: the tall cut along the top and bottom edges;
# WED_M: the tall slide, along the block and down, in u; WED_A, WED_S: the wide cut's angle (degrees; shallow, so
# the 2u shadow lands about 20 px wide along it) and slide (u); WED_B: how far in from the proof's right edge the
# slid-out part is bounded, hidden behind the proof (u, more than the slide and its shadow). FRI_TILT, FRI_T: the
# tall strip's angle (a house angle, the proof's own) and depth (u); FRI_U, FRI_L: the wide gap's two edges, in
# degrees. CLEAR: the slant's clearance under the headline, in u.
PARAMS = {'TILT_DEG': TILT, 'PLATE': PLATE, 'BLOCK': BLOCK, 'MON_AT': .62, 'MON_W': .68, 'MON_FOOT': 300,
          'WED_K': [.64, .46], 'WED_M': [6, 4], 'WED_A': 25, 'WED_S': 12, 'WED_B': 16, 'FRI_TILT': -2.5, 'FRI_T': 7,
          'FRI_U': 22, 'FRI_L': 45, 'CLEAR': 9}
for k, v in sorted(PARAMS.items(), key=lambda kv: -len(kv[0])):
    PLACE_JS = PLACE_JS.replace(k, str(v))
