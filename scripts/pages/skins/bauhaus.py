"""Bauhaus blocks (series skin "bauhaus", concept c09): the Receipt on a Bauhaus poster ground, one family across the three series.

The ground is cut into flat planes and set with elementary forms (discs, half and quarter discs, bands), in three
colours only: the series colour, ink and the house cream, with the house grain over all of it. One loud thing per
block. The figure (the series' own metaphor) is ink, its one key part cream, and where it lies on an ink plane its
ink turns the series colour. Each series keeps one device on both shapes:
  follow.the.money: three flows of three gauges (54/32/18, the width is the amount, widest on top, one even gap)
    run level, turn down together through 45 degrees about one centre and pour into the pool, a cream half disc
    laid over their ends;
  under.the.hood: one disc taken apart: the cream half lifted, the two ink quarters pulled apart diagonally under
    it, one gap of 0.27 r between every pair of pieces, all three whole and seen together;
  mind.the.gap: two rails (36/56/36: rail, gap, rail) with the gap held open run level into today, a cream disc
    laid over their ends.
- the words' block is cream paper; the headline is ink with its last part on the series colour; the pill and the
  tag are ink with the colour on them; the wordmark plate is untouched;
- the proof is pinned across the seam between the cream and the colour, with a 3 px ink keyline round its white
  frame and the house hard ink shadow (the frame only; the proof is untouched);
- the tall: the colour lies below the words, the seam crosses the frame at 38% of its height; the big form is one
  ink quarter disc rising from the card's bottom-left corner, its foot on the bottom edge under the proof's centre,
  so the series colour, not ink, takes most of the band below the proof; the counter-form is one disc of the series
  colour, cut by the card's right edge and its top, with the house hard ink shadow, its foot 80 px over the top row;
  the figure lives whole in the band under the proof, below the 3:4 grid window (y 1680) and 40 px or more off the
  shadow, so the grid crop shows the planes and no part of a figure; the strips beside the proof stay plain colour:
  follow.the.money: the flows run in from the card's right edge and pour into the pool, on the bottom edge in the
    middle of the colour, their centre line aimed a third of its radius over its centre;
  under.the.hood: the taken-apart disc in the middle of the colour, 40 px over the bottom edge;
  mind.the.gap: the rails run the full width under the proof and end in today, half cut by the card's right edge;
    where they cross the ink quarter they turn the colour;
- the wide: the colour is the left column, its edge on the shared right edge of the wordmark plate and the tag (it
  crosses the frame at about 70% of its width, behind the proof), and it grows one round shoulder under the words,
  its crown at the proof's shadow, 60 px off the words, out of YouTube's length badge; the column's edge meets the
  shoulder's arc behind the proof. The figure lies in the shoulder right of the proof; whole forms keep 20 px inside
  its arc, 40 px off the proof and 40 px over the bottom edge; every line starts under the frame (below it in
  z-order) and visibly comes out from behind the proof, 10 px or more inside the arc (nothing enters from the left
  edge). Lines can only come out of the proof's right edge between the crown (y 547 plus 10) and the shadow's
  corner (y 637): a 73 px window, so the wide's gauges are scaled to it:
  follow.the.money: the flows at 0.52 of the tall's gauges (28/17/9) come out level, turn as late as the crown
    allows and pour into the pool, whole in the shoulder;
  under.the.hood: the taken-apart disc, the largest that sits whole in the shoulder;
  mind.the.gap: the rails at half the tall's gauge (18/28/18) come out from under the proof's corner stepping down
    at 45 degrees (the tube map's kink; level rails out of the right edge would leave the shoulder within some
    150 px) and run level into today, whole in the shoulder, the device 200 px or more long.
Every form keeps 60 px off the words, the tag and the pill, clear of the wordmark plate, outside YouTube's length
badge on the wide (x >= 968, y >= 548 stays clean cream), and none carries words. The planes are the ground itself
(painted on the card); every form is a .deco element placed after the house fit.
A logo plate is kept clear too. On tall it sits under the proof on the column's left edge, inside the quarter disc:
the band under the proof is then turned round (the quarter disc from the bottom-right corner, made smaller if the
plate reaches towards it, 40 px or more off it, and left out under 240 px; the flows and the taken-apart disc turned
with it, mind.the.gap's rails still running left to right into today), in two boxes, neither reaching the plate. On
wide the plate sits over the headline, which pushes the shoulder down: when no figure fits in it, the wide shows its
planes and its shoulder alone.
"""

GRAIN = ("<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'>"
         "<feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .05  0 0 0 0 .08  0 0 0 0 .07  0 0 0 1.5 -.55'/></filter>"
         "<rect width='240' height='240' filter='url(#n)' opacity='.13'/></svg>")


def _enc(svg):
    return svg.replace('<', '%3C').replace('>', '%3E').replace('#', '%23').replace("'", '%27')


def skin(html, facts, shape, look, kit):
    if not look.get('series'):
        return html
    col, ink, cream = look['colour'], kit.INK, kit.CREAM
    css = f"""
:root {{ --col: {col}; --inkc: {ink}; --creamc: {cream}; --motif: {kit.day}; }}
body {{ background: {cream}; }}
#card {{ background: url("data:image/svg+xml,{_enc(GRAIN)}") 0 0 / 240px 240px repeat, var(--planes, none) 0 0 / 100% 100% no-repeat, {cream} !important; }}
#safe {{ z-index: 2; }}
.bh {{ position: absolute; z-index: 1; display: block; pointer-events: none; overflow: visible; }}
h1 {{ color: {ink}; }}
h1 mark {{ background: {col}; color: {ink}; }}
.pill {{ background: {ink}; color: {col}; }}
.tag {{ background: {ink}; color: {col}; }}
.frame {{ box-shadow: 0 0 0 3px {ink}, calc(var(--edge) * 1.4) calc(var(--edge) * 1.6) 0 3px {ink}; }}
"""
    return html.replace('</style>', css + '</style>', 1)


PLACE_JS = r"""([shape]) => {
  const card = document.querySelector('#card');
  const W = card.clientWidth, H = card.clientHeight, tall = shape !== 'wide';
  const css = getComputedStyle(document.documentElement);
  const v = k => css.getPropertyValue(k).trim();
  const col = v('--col'), ink = v('--inkc'), cream = v('--creamc'), day = v('--motif');
  const R = q => { const e = document.querySelector(q); return e ? e.getBoundingClientRect() : null; };
  const fr = R('.frame'), h1 = R('h1'), tag = R('.tag'), pill = R('.pill'), wmp = R('.wmp');
  const marks = [...document.querySelector('h1 mark').getClientRects()];
  const wordsBottom = Math.max(h1.bottom, ...marks.map(r => r.bottom));
  const frameEl = document.querySelector('.frame');
  const edge = parseFloat(getComputedStyle(frameEl).borderTopWidth);
  const f = n => (+n).toFixed(1);
  const CLEAR = 60, INSIDE = 40, BREAK = 24, KEY = 3;
  let uid = 0;

  // The proof's true outline: the frame with its keyline, turned with the pin, and the hard shadow under it.
  const pin = document.querySelector('.pin');
  const keep = pin.style.transform; pin.style.transform = 'none';
  const p0 = pin.getBoundingClientRect(), f0 = frameEl.getBoundingClientRect();
  pin.style.transform = keep;
  const ocx = (p0.left + p0.right) / 2, ocy = (p0.top + p0.bottom) / 2, an = -2.5 * Math.PI / 180;
  const ca = Math.cos(an), sa = Math.sin(an);
  const rot = (x, y) => [ocx + (x - ocx) * ca - (y - ocy) * sa, ocy + (x - ocx) * sa + (y - ocy) * ca];
  const C = {tl: rot(f0.left - KEY, f0.top - KEY), tr: rot(f0.right + KEY, f0.top - KEY),
             br: rot(f0.right + KEY, f0.bottom + KEY), bl: rot(f0.left - KEY, f0.bottom + KEY)};
  const ox = edge * 1.4 * ca - edge * 1.6 * sa, oy = edge * 1.4 * sa + edge * 1.6 * ca;
  const S = Object.fromEntries(Object.entries(C).map(([k, p]) => [k, [p[0] + ox, p[1] + oy]]));
  const lerp = (a, b, t) => a + (b - a) * t;
  const leftX = y => lerp(C.tl[0], C.bl[0], (y - C.tl[1]) / (C.bl[1] - C.tl[1]));     // the frame's left edge
  const shadowX = y => lerp(S.tr[0], S.br[0], (y - S.tr[1]) / (S.br[1] - S.tr[1]));   // the shadow's right edge
  const shadowY = x => lerp(S.bl[1], S.br[1], (x - S.bl[0]) / (S.br[0] - S.bl[0]));   // the shadow's bottom edge
  const lowest = S.bl[1];                                                             // the shadow's lowest point
  // Points along the proof's outer outline (frame, keyline and shadow), to hold every form 40 px off it.
  const outline = [];
  for (const [a, b] of [[C.tl, S.tr], [S.tr, S.br], [S.br, S.bl], [S.bl, C.bl], [C.bl, C.tl]])
    for (let i = 0; i <= 40; i++) outline.push([lerp(a[0], b[0], i / 40), lerp(a[1], b[1], i / 40)]);
  const offProof = (x, y) => Math.min(...outline.map(p => Math.hypot(p[0] - x, p[1] - y)));

  // The planes: cream paper for the words, the series colour for the proof's block, the seam across the proof.
  const seam = tall ? Math.round(fr.top + (fr.bottom - fr.top) * .38) : Math.round(wmp.right);
  // The wide's shoulder: a disc rising from under the bottom edge, its crown at the proof's shadow and 60 px under
  // the words, its right foot out of YouTube's length badge.
  const sh = (() => { if (tall) return null;
    const top = wordsBottom + CLEAR, a = H - top, cx = shadowX(top) + 8, F = 968 - 6 - cx;
    const Rs = (a + F * F / a) / 2, k = (F * F / a - a) / 2;
    return {cx, cy: H + k, R: Rs, top}; })();
  const planes = tall ? `<rect x="0" y="${seam}" width="${W}" height="${H - seam}" fill="${col}"/>`
                      : `<rect x="0" y="0" width="${seam}" height="${H}" fill="${col}"/><circle cx="${f(sh.cx)}" cy="${f(sh.cy)}" r="${f(sh.R)}" fill="${col}"/>`;
  const psvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${planes}</svg>`;
  card.style.setProperty('--planes', `url("data:image/svg+xml,${encodeURIComponent(psvg)}")`);

  // One svg (class deco) in card coordinates, with the house grain over its forms.
  const add = (x0, y0, x1, y1, body, defs = '') => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), id = 'g' + (uid++);
    s.setAttribute('class', 'deco bh');
    s.setAttribute('width', x1 - x0); s.setAttribute('height', y1 - y0);
    s.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    s.style.left = x0 + 'px'; s.style.top = y0 + 'px';
    s.innerHTML = `<defs>${defs}<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/>` +
      `<feColorMatrix values="0 0 0 0 .96  0 0 0 0 .94  0 0 0 0 .89  0 0 0 2 -1.25"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>` +
      `<g>${body}</g><g filter="url(#${id})" opacity=".45">${body}</g>`;
    card.insertBefore(s, card.firstChild);
  };
  const disc = (cx, cy, r, fill) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"/>`;
  const halfUp = (cx, y, r, fill) => `<path d="M${f(cx - r)},${f(y)}A${f(r)},${f(r)} 0 0 1 ${f(cx + r)},${f(y)}Z" fill="${fill}"/>`;
  const band = (d, t, fill) => `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${f(t)}" stroke-linecap="butt"/>`;
  const S2 = Math.SQRT1_2;
  // A stack of bands that runs level, turns 45 degrees about one shared centre (xk, yk) and runs straight on, so
  // every band keeps the same gap through the turn. dir +1 runs right and turns down-right, -1 runs left and turns
  // down-left. A band of radius r runs level at yk - r from x0 and goes len px past the turn.
  const pourEnd = (xk, yk, r, dir) => [xk + dir * r * S2, yk - r * S2];
  const pourPath = (x0, xk, yk, r, dir, len) => { const [ax, ay] = pourEnd(xk, yk, r, dir);
    return `M${f(x0)},${f(yk - r)}H${f(xk)}A${f(r)},${f(r)} 0 0 ${dir > 0 ? 1 : 0} ${f(ax)},${f(ay)}L${f(ax + dir * len * S2)},${f(ay + len * S2)}`; };
  // How far past the turn a band runs to reach the point on its line nearest (px, py): it ends there, under the pool.
  const pourLen = (xk, yk, r, dir, px, py) => { const [ax, ay] = pourEnd(xk, yk, r, dir); return (px - ax) * dir * S2 + (py - ay) * S2; };
  // Two rails stepping down once at 45 degrees (the tube map's kink): the centre line runs level at y1 from x0, turns
  // at xa (arcs of radius rho), drops d and runs level to x1; `off` is a rail's offset from it (negative is up), so
  // both rails keep the gap through the step.
  const stepPath = (x0, y1, xa, d, rho, x1, off) => {
    const xb = xa + d + 2 * rho * (2 * S2 - 1), y2 = y1 + d, r1 = rho - off, r2 = rho + off;
    return `M${f(x0)},${f(y1 + off)}H${f(xa)}A${f(r1)},${f(r1)} 0 0 1 ${f(xa + r1 * S2)},${f(y1 + rho - r1 * S2)}` +
           `L${f(xb - r2 * S2)},${f(y2 - rho + r2 * S2)}A${f(r2)},${f(r2)} 0 0 0 ${f(xb)},${f(y2 + off)}H${f(x1)}`; };
  const stepXb = (xa, d, rho) => xa + d + 2 * rho * (2 * S2 - 1);
  // One disc taken apart: the cream half lifted, the two ink quarters pulled apart diagonally under it, one gap g
  // between every pair of pieces. (cx, cy) is the whole disc's centre.
  const exploded = (cx, cy, r, g) =>
    `<path d="M${f(cx - r)},${f(cy - g / 2)}A${f(r)},${f(r)} 0 0 1 ${f(cx + r)},${f(cy - g / 2)}Z" fill="${cream}"/>` +
    `<path d="M${f(cx - g / 2)},${f(cy + g / 2)}H${f(cx - g / 2 - r)}A${f(r)},${f(r)} 0 0 0 ${f(cx - g / 2)},${f(cy + g / 2 + r)}Z" fill="${ink}"/>` +
    `<path d="M${f(cx + g / 2)},${f(cy + g / 2)}H${f(cx + g / 2 + r)}A${f(r)},${f(r)} 0 0 1 ${f(cx + g / 2)},${f(cy + g / 2 + r)}Z" fill="${ink}"/>`;
  // Points round the exploded disc's outline, to hold it inside its plane.
  const explodedPts = (cx, cy, r, g) => { const p = [];
    for (let i = 0; i <= 24; i++) { const th = Math.PI * i / 24; p.push([cx + r * Math.cos(th), cy - g / 2 - r * Math.sin(th)]); }
    for (let i = 0; i <= 12; i++) { const th = Math.PI / 2 * i / 12;
      p.push([cx - g / 2 - r * Math.cos(th), cy + g / 2 + r * Math.sin(th)], [cx + g / 2 + r * Math.cos(th), cy + g / 2 + r * Math.sin(th)]); }
    return p; };
  const halfPts = (cx, y, r) => { const p = []; for (let i = 0; i <= 24; i++) { const th = Math.PI * i / 24; p.push([cx + r * Math.cos(th), y - r * Math.sin(th)]); } return p; };

  if (tall) {
    // The big form: one ink quarter disc from the bottom-left corner, its foot on the bottom edge under the proof's
    // centre, so the series colour takes most of the band below the proof.
    const mid = (C.tl[0] + C.tr[0] + C.br[0] + C.bl[0]) / 4;          // under the proof's centre
    // A logo plate under the proof sits on the column's left edge, inside the quarter disc. Then the band under the
    // proof is drawn mirrored (the quarter disc from the bottom-right corner, every figure turned with it), the disc
    // made smaller if the plate reaches towards it, so it stays 40 px or more off the plate; if the plate leaves it
    // under 240 px, the band has no quarter disc. The figures already lie under the plate (under the grid window);
    // mind.the.gap's lines keep running left to right into today, over the turned disc.
    const LG = R('.logos'), RQMIN = 240;
    let Rq = Math.round(mid), mode = 'plain';
    if (LG) { const Rm = Math.min(Rq, Math.floor(W - LG.right - INSIDE)); if (Rm >= RQMIN) { Rq = Rm; mode = 'mirror'; } else mode = 'bare'; }
    const disc0 = `<path d="M0,${H}V${f(H - Rq)}A${f(Rq)},${f(Rq)} 0 0 1 ${f(Rq)},${H}Z" fill="${ink}"/>`;
    let body = mode === 'plain' ? disc0 : '', defs = '', y0 = H - Rq;
    const xc = (Rq + W) / 2;                                          // the middle of the colour on the bottom edge
    // Under the proof, the figure starts below the 3:4 grid window and 40 px or more off the shadow, so the grid
    // crop shows the planes alone and no part of a figure.
    const under = Math.ceil(Math.max(lowest + INSIDE, H / 2 + W * 2 / 3)) + 4, MON_AIM = .35;
    if (day === 'mon') {
      // Three flows of three gauges (the width is the amount, widest on top, one even gap) come in from the card's
      // right edge, turn down together through 45 degrees and pour into the pool, a cream half disc on the bottom
      // edge in the middle of the colour, laid over their ends.
      const g = [54, 32, 18], GD = 18, T = g[0] + g[1] + g[2] + 2 * GD, top = under + 6, rho0 = 18, yk = top + T + rho0;
      const rp = Math.min(160, xc - Rq - INSIDE, H - under - 90);
      let y = top; const bands = g.map(w => { const r = yk - (y + w / 2); y += w + GD; return {w, r}; });
      // the stack's centre line runs into the pool a third of its radius over its centre, so the run in from the edge
      // is long enough to read as a flow
      const ay = H - rp * MON_AIM, xk = xc + ay - yk + Math.SQRT2 * (yk - (top + T / 2));
      for (const b of bands) body += band(pourPath(W + 2, xk, yk, b.r, -1, pourLen(xk, yk, b.r, -1, xc, ay)), b.w, ink);
      body += halfUp(xc, H, rp, cream);
    } else if (day === 'wed') {
      // One disc taken apart: the cream half lifted, the two ink quarters pulled apart diagonally under it at one gap
      // of a quarter of r or more, whole in the colour under the proof and 40 px over the bottom edge.
      const room = H - INSIDE - under, r = Math.floor(Math.min(110, room / 2.27, (W - INSIDE - Rq - INSIDE) / 2.27)), gap = Math.round(r * .27);
      const cy = under + r + gap / 2 + (room - 2 * r - gap) / 2;
      body += exploded(xc, cy, r, gap);
    } else {
      // Two lines with the gap between them run the full width under the proof, 40 px off its shadow and the
      // bottom edge, and end in today, a cream disc half cut by the card's right edge. Ink on the colour; where they
      // cross the ink quarter they turn the colour.
      const t = 36, G = 56, top = under, bot = H - INSIDE;
      const ym = Math.round((top + bot) / 2), rt = Math.floor(Math.min(ym - top, bot - ym)), o = G / 2 + t / 2;
      const lines = band(`M-1,${f(ym - o)}H${W - INSIDE}`, t, '@') + band(`M-1,${f(ym + o)}H${W - INSIDE}`, t, '@');
      const id = 'q' + (uid++);
      // (mirrored, the lines still run left to right into today: only the quarter disc they cross is turned)
      defs = mode === 'bare' ? '' : `<clipPath id="${id}"><circle cx="${mode === 'mirror' ? W : 0}" cy="${H}" r="${Rq}"/></clipPath>`;
      body += lines.replaceAll('@', ink) + (mode === 'bare' ? '' : `<g clip-path="url(#${id})">${lines.replaceAll('@', col)}</g>`);
      body += disc(W, ym, rt, cream);
    }
    if (mode === 'plain') add(-20, Math.floor(y0) - 2, W + 20, H, body, defs);
    else {
      // Two boxes, so neither reaches the plate: the figures (all under it) and the quarter disc (beside it).
      const turn = s => `<g transform="matrix(-1 0 0 1 ${W} 0)">${s}</g>`;
      add(-20, under - 2, W + 20, H, mode === 'mirror' && day !== 'fri' ? turn(body) : body, defs);
      if (mode === 'mirror') add(W - Rq - 2, Math.floor(y0) - 2, W, H, turn(disc0));
    }
    // The counter-form: one disc of the colour cut by the card's right edge and the top, with the house hard ink
    // shadow, its foot 80 px over the top row.
    const rt = 270, foot = Math.min(pill.top, wmp.top) - 80, cy = foot - rt, sx = edge * 1.4, sy = edge * 1.6;
    add(Math.floor(W - Math.sqrt(rt * rt - cy * cy)) - 2, 0, W, Math.ceil(foot + sy) + 2, disc(W + sx, cy + sy, rt, ink) + disc(W, cy, rt, col));
  } else {
    // The wide: every figure lies in the shoulder, right of the proof. Whole forms keep 20 px inside its arc, 40 px
    // off the proof and 40 px over the bottom edge; lines start under the frame and come out from behind it.
    const inArc = (x, y) => sh.R - Math.hypot(x - sh.cx, y - sh.cy);
    const arcY = x => sh.cy - Math.sqrt(Math.max(0, sh.R * sh.R - (x - sh.cx) ** 2));
    const ARC = 20, LINE = 10, FOOT = INSIDE, FRI_XB = 24;    // inside the arc: whole forms, lines; the rails level out 24 px past the corner
    const fits = pts => pts.every(([x, y]) => inArc(x, y) >= ARC && offProof(x, y) >= INSIDE);
    const x0 = C.br[0] - 80;                                           // under the frame
    // The window on the proof's right edge a stack can come out of: 60 px under the words and clear of the
    // shoulder's crown, 6 px over the shadow's corner.
    const wTop = Math.max(wordsBottom + CLEAR, arcY(S.br[0] + 40) + LINE), wBot = S.br[1] - 6;
    if (day === 'mon') {
      // The tall's three flows (54/32/18 and one even gap, scaled to the window) come out from behind the proof, turn
      // down together through 45 degrees and pour into the pool: a cream half disc whole in the shoulder, 40 px over
      // the bottom edge, laid over their ends.
      const T = wTop < wBot ? wBot - wTop : 0, k = T / 140, g = [54, 32, 18].map(w => w * k), GD = 18 * k;
      const yb = H - INSIDE, yk = wBot + 8 * k + 4, rc = yk - (wTop + T / 2);
      let y = wTop; const bands = g.map(w => { const r = yk - (y + w / 2); y += w + GD; return {w, r}; });
      const topEdge = (xk) => { const p = [], ro = bands[0].r + bands[0].w / 2;
        for (let x = S.br[0]; x <= xk; x += 4) p.push([x, yk - ro]);
        for (let i = 0; i <= 12; i++) { const th = Math.PI / 4 * i / 12; p.push([xk + ro * Math.sin(th), yk - ro * Math.cos(th)]); }
        return p; };
      let best = null;
      for (let xk = S.br[0] - 4; xk < S.br[0] + 120; xk += 2) {
        const px = yb - yk + xk + Math.SQRT2 * rc;
        if (!topEdge(xk).every(([x, yy]) => inArc(x, yy) >= LINE)) break;
        let rp = 0; for (let r = 130; r >= 40; r -= 1) if (fits(halfPts(px, yb, r))) { rp = r; break; }
        if (rp >= 60) best = {xk, px, rp};
      }
      if (!best) return;   // no room in the shoulder (a low headline): the planes and the shoulder alone
      const {xk, px, rp} = best;
      const id = 'p' + (uid++), defs = `<clipPath id="${id}"><rect x="0" y="0" width="${W}" height="${yb}"/></clipPath>`;
      let body = `<g clip-path="url(#${id})">`;
      for (const b of bands) body += band(pourPath(x0, xk, yk, b.r, 1, pourLen(xk, yk, b.r, 1, px, yb)), b.w, ink);
      body += '</g>' + halfUp(px, yb, rp, cream);
      add(Math.floor(x0) - 2, Math.floor(wTop) - 2, Math.ceil(px + rp) + 2, yb + 2, body, defs);
    } else if (day === 'wed') {
      // One disc taken apart, whole in the shoulder: the cream half lifted, the two ink quarters pulled apart
      // diagonally under it at one gap of a quarter of r or more.
      let best = null;
      for (let r = 80; r >= 30 && !best; r -= .5) {
        const gap = Math.max(10, Math.round(r * .27)), ok = [];
        for (let cx = S.br[0]; cx < sh.cx + sh.R; cx += 2) {
          const cy = H - FOOT - r - gap / 2;
          if (fits(explodedPts(cx, cy, r, gap))) ok.push(cx);
        }
        if (ok.length) best = {r, gap, cx: (ok[0] + ok[ok.length - 1]) / 2, cy: H - FOOT - r - gap / 2};
      }
      if (!best) return;   // no room in the shoulder: the planes and the shoulder alone
      const {r, gap, cx, cy} = best;
      add(Math.floor(cx - r - gap) - 2, Math.floor(cy - gap / 2 - r) - 2, Math.ceil(cx + r + gap) + 2, Math.ceil(cy + gap / 2 + r) + 2, exploded(cx, cy, r, gap));
    } else {
      // The tall's two rails (36/56/36 at half size) with the gap held open come out from under the proof's
      // corner, stepping down at 45 degrees as they come, and run level into today, a cream disc whole in the
      // shoulder, laid over their ends. Rails level out of the proof's right edge would stay inside the shoulder
      // only some 150 px: its crown sits at the shadow and the proof ends at y 637.
      const discPts = (cx, cy, r) => { const p = []; for (let i = 0; i < 36; i++) { const th = 2 * Math.PI * i / 36; p.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]); } return p; };
      const k = .5, t = 36 * k, G = 56 * k, o = G / 2 + t / 2, h = o + t / 2;
      const rd = Math.round(h * 1.3), y2 = H - FOOT - rd, rho = o + t / 2 + 4, d = 70;
      let xd = 0;
      for (let x = S.br[0]; x < sh.cx + sh.R; x += 1)
        if (discPts(x, y2, rd).every(([a, b]) => inArc(a, b) >= ARC && offProof(a, b) >= INSIDE)) xd = x;
      if (!xd) return;     // no room in the shoulder for today's disc: the planes and the shoulder alone
      const xb = S.br[0] + FRI_XB, xa = xb - d - 2 * rho * (2 * S2 - 1), y1 = y2 - d, xs = xa - 40;
      const body = band(stepPath(xs, y1, xa, d, rho, xd, -o), t, ink) + band(stepPath(xs, y1, xa, d, rho, xd, o), t, ink) + disc(xd, y2, rd, cream);
      add(Math.floor(xs) - 2, Math.floor(y1 - o - t / 2) - 2, Math.ceil(xd + rd) + 2, Math.ceil(y2 + rd) + 2, body);
    }
  }
}"""

