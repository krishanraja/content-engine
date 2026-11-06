"""Memphis (series skin "memphis", concept c07): 1980s Memphis shapes round the proof, on a printed ground of the series colour.

One family on Mon, Wed and Fri, each in its own colour, and every shape where the feed and the profile grid show it
(inside the safe box, y 260 to 1660 on the tall, and inside the 3:4 grid crop):
- the ground is paper taken well toward the series colour, so it reads as colour and never as cream, but short of
  the flat full-bleed colour (Wednesday's lavender is first warmed a little toward rose, so it never goes grey;
  Friday's paper is first warmed with butter, so coral turns it peach and never blush pink), and it carries the
  house grain (fractal noise, about 7 %), so it reads as a printed sheet and not as flat clip-art. No halftone on the
  ground and no offset shadow on the headline;
- few, big shapes (a disc and the signature, on both shapes), every ink line at least 12 px (only the node's ring,
  the dots and the triangle's 10 px edges are finer), so each survives a 360 px phone-grid tile; nothing above the
  wordmark row, out of the safe box and the 3:4 grid:
  tall: the skin keeps a 200 px band at the foot of the safe box, and the house fit lays the headline and the proof
  out above it (the proof stays over the house floor, PROOF_MIN); the pin sits on the left margin with the headline.
  One loud disc in the series colour, 460 px, behind the proof's top-right corner and bleeding off the right edge,
  clear of the headline by 40 px; and the series' signature, the loud thing, drawn whole in that band, in one box
  for all three series: from the 72 px left margin to the proof's own right edge (the frame's bottom-right corner,
  x 798), its top 40 px under the frame's hard shadow, its foot on the safe box's (y 1660), so the band under the
  proof is as wide as the proof above it; the flows and the timelines run the whole box, their ink ending on x 798
  and their shadow falling past it as the frame's does; the triangle, which a 160 px band holds only about 270 px
  wide, sits whole on the left margin. Nothing passes behind the frame and nothing sits in a gutter. wide: the disc grown to 420 px behind the proof's bottom-left corner, and
  the signature large and bold in the right column under the headline, its left edge on the headline's (x 672) and
  its ink ending at y 680, 40 px over the foot as the wordmark and pill sit 40 px under the top. The solid shapes
  carry the house hard ink shadow, down and to the right;
- each series has one signature, its own metaphor in Memphis form, the same drawing on both shapes:
  follow.the.money three flows 1:2:4 (14, 28 and 56 px on the tall, about 13, 26 and 52 on the wide; ink, ink then
  the colour), in phase, whole waves crest to crest so their cut ends stand square, so the width is the amount;
  under.the.hood the house triangle come apart along its medians into its three parts, all three in the colour,
  each turned only a degree or two so the cut edges stay nearly parallel across even gaps with the ground showing in
  each, the way an exploded drawing shows the parts of one thing; their shadows are the parts' own polygons, filled,
  10 px down and right on the tall (8 on the wide), so each foot carries one offset; mind.the.gap a coral squiggle
  along the top and an ink zigzag along the foot, two timelines, running in from the left and meeting at one node,
  today, from opposite sides (the squiggle calms and runs down into its ring from the upper left, the zigzag's last
  leg runs up into it from the lower left at its own teeth's slope), the node a cream dot in an ink ring with
  nothing behind it, and a dotted line running on from it;
- the highlight is the full series colour with one hard ink shadow cast from all its lines together (a filter, so
  no line's shadow falls on the line above); the pill and the tag are ink with the colour on them; the proof frame
  casts a hard ink shadow in place of the soft one; the wordmark plate is untouched; no shadow on any letter.
Every shape is its own .deco SVG, drawn behind the page's words and proof, and placed after the house fit against
the laid-out page with 40 px clear round the headline, tag, pill, wordmark and logos and out of YouTube's length
badge; the disc that would come near them is drawn smaller, and dropped if it still would, and the signature is
dropped when its band is under 110 px. No words, numbers or badges in any decoration. A post outside the three
series keeps the plain Receipt.
"""
from urllib.parse import quote

# How far the ground moves from paper toward the series colour: far enough that it reads as the colour, short of
# the flat full colour. Each series' paper is first warmed a little (WARM), so the tint keeps its warmth.
TINT = {'mon': .34, 'wed': .40, 'fri': .24}
WARM = {'wed': ('#FF8FB8', .12), 'fri': ('#FFD84D', .12)}
# The tall's band for the signature under the proof: the signature (up to 160 px), its 40 px clear of the frame's
# hard shadow, and the frame's own slack in the proof box.
BAND = 200


def grain(alpha, light=False):
    """The house grain: a tiling fractal noise (feTurbulence, .9, three octaves), as specks of ink or of paper."""
    rgb = '1 1 1' if light else '.05 .08 .07'
    r, g, b = rgb.split()
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>"
           "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'"
           f" seed='{7 if light else 3}'/>"
           f"<feColorMatrix values='0 0 0 0 {r} 0 0 0 0 {g} 0 0 0 0 {b} 1.9 0 0 0 -.62'/></filter>"
           f"<rect width='240' height='240' filter='url(#n)' opacity='{alpha}'/></svg>")
    return f'url("data:image/svg+xml,{quote(svg)}")'


def skin(html, facts, shape, look, kit):
    if not look.get('series'):
        return html
    col, ink, cream, day = look['colour'], kit.INK, kit.CREAM, kit.day
    paper = kit.mix(kit.CREAM, '#FFFFFF', .5)
    if day in WARM:
        paper = kit.mix(paper, *WARM[day])
    ground = kit.mix(paper, col, TINT.get(day, .3))
    u = 8 if kit.tall else 6
    css = f"""
:root {{ --col: {col}; --ink: {ink}; --cream: {cream}; --paper: {paper}; --ground: {ground}; --motif: {day}; --u: {u}px; }}
body {{ background: {ground}; }}
#card {{ background: {grain(.12)}, {grain(.10, True)}, {ground} !important; }}
.pill {{ background: {ink}; color: {col}; }}
.tag {{ background: {ink}; color: {col}; }}
.frame {{ box-shadow: calc(var(--u) * 1.6) calc(var(--u) * 1.6) 0 {ink}; }}
h1 mark {{ background: {col}; color: {ink}; box-shadow: none; filter: drop-shadow(var(--u) var(--u) 0 {ink}); }}
.deco {{ position: absolute; pointer-events: none; overflow: visible; }}
"""
    if kit.tall:
        # The signature's own band at the foot of the safe box, under the proof: the house fit lays the headline and
        # the proof out in what is left (the proof stays at or over the house floor, PROOF_MIN). The pin sits on the
        # left margin with the headline, inset by what its -2.5 degree turn swings out. The square cover is too short
        # to give up the band (a long headline would push the proof under its floor): it keeps the house layout, and
        # its signature is left out for want of room.
        band = 0 if kit.shape == 'square' else BAND
        css += f".stack .proof {{ justify-content: flex-start; padding-left: 16px; margin-bottom: {band}px; }}\n"
    return html.replace('</style>', css + '</style>', 1)


PLACE_JS = r"""([shape]) => {
  const NS = 'http://www.w3.org/2000/svg';
  const card = document.querySelector('#card'), safe = document.querySelector('#safe');
  const W = card.clientWidth, H = card.clientHeight, tall = shape !== 'wide';
  const css = getComputedStyle(document.documentElement);
  const v = k => css.getPropertyValue(k).trim();
  const COL = v('--col'), INK = v('--ink'), CREAM = v('--cream'), day = v('--motif'), U = parseFloat(v('--u'));
  if (!day) return {skipped: 'not a series piece: the plain Receipt'};
  const R = q => [...document.querySelectorAll(q)].map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
  const fe = document.querySelector('.frame'), F = fe.getBoundingClientRect();
  const words = [...R('.wmp'), ...R('.pill'), ...R('h1'), ...R('h1 mark'), ...R('.tag'), ...R('.logos')];
  const clear = tall ? [] : [{left: 968, top: 548, right: 1280, bottom: 720}];
  const PAD = 40;                            // clear space kept round every word
  const SH = tall ? 10 : 6;                  // the house hard ink shadow on the shapes
  const LW = tall ? 16 : 12;                 // the least ink line
  const FSH = U * 1.6;                       // the frame's own hard shadow
  const f = n => (+n).toFixed(1);
  const D2R = Math.PI / 180;
  const headBottom = Math.max(...R('h1').map(r => r.bottom), ...R('h1 mark').map(r => r.bottom)) + U;

  // ---- the frame's own corners: the pin turns it -2.5 degrees about its centre ----
  const fw = fe.offsetWidth, fh = fe.offsetHeight, fcx = (F.left + F.right) / 2, fcy = (F.top + F.bottom) / 2;
  const ct = Math.cos(-2.5 * D2R), st = Math.sin(-2.5 * D2R);
  const corner = (sx, sy) => [fcx + sx * fw / 2 * ct - sy * fh / 2 * st, fcy + sx * fw / 2 * st + sy * fh / 2 * ct];
  const TL = corner(-1, -1), TR = corner(1, -1), BR = corner(1, 1), BL = corner(-1, 1);

  // ---- the Memphis cast ----
  const disc = r => {
    const c = `<circle cx="${f(r)}" cy="${f(r)}" r="${f(r)}"`;
    return {w: 2 * r, h: 2 * r, body: `${c} fill="${COL}"/>`, shade: `${c} fill="${INK}"/>`};
  };
  const stroke = (d, c, sw, shadow, cap = 'round', join = 'round') =>
    (shadow ? `<path d="${d}" transform="translate(${SH} ${SH})" fill="none" stroke="${INK}" stroke-width="${f(sw)}" stroke-linecap="${cap}" stroke-linejoin="${join}" stroke-miterlimit="8"/>` : '') +
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(sw)}" stroke-linecap="${cap}" stroke-linejoin="${join}" stroke-miterlimit="8"/>`;
  // a cubic curve sampled by arc length: [{x, y, nx, ny, s}], with the unit normal at each point
  const curve = (P0, P1, P2, P3, n = 240) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
      const da = -3 * (1 - t) ** 2, db = 3 * (1 - t) * (1 - 3 * t), dc = 3 * t * (2 - 3 * t), dd = 3 * t * t;
      const x = a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], y = a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1];
      const tx = da * P0[0] + db * P1[0] + dc * P2[0] + dd * P3[0], ty = da * P0[1] + db * P1[1] + dc * P2[1] + dd * P3[1];
      const tl = Math.hypot(tx, ty) || 1;
      pts.push({x, y, nx: -ty / tl, ny: tx / tl, s: i ? pts[i - 1].s + Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y) : 0});
    }
    return pts;
  };
  // a strict-rhythm wave along a curve that calms over its last `calm` px, so it meets its end clean
  const waveOn = (pts, amp, lam, calm, phase = 0) => {
    const L = pts[pts.length - 1].s;
    return pts.map((p, i) => { const k = Math.min(1, Math.max(0, (L - p.s) / calm)), o = amp * k * Math.sin(2 * Math.PI * p.s / lam + phase);
      return (i ? 'L' : 'M') + f(p.x + p.nx * o) + ',' + f(p.y + p.ny * o); }).join('');
  };
  // a row of dots whose first dot's left edge is on xa and whose last dot's right edge is on xb, evenly spaced
  const dotRow = (xa, xb, y, r, step) => {
    const n = Math.max(1, Math.round((xb - xa - 2 * r) / step)), st = (xb - xa - 2 * r) / n;
    let b = '';
    for (let i = 0; i <= n; i++) b += `<circle cx="${f(xa + r + i * st)}" cy="${f(y)}" r="${f(r)}"/>`;
    return `<g fill="${INK}">${b}</g>`;
  };
  // the node, today: a cream dot in an ink ring, and nothing behind it (no offset disc, so it reads as a point on
  // the timelines and never as an eye)
  const node = (x, y, r, lw) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${CREAM}" stroke="${INK}" stroke-width="${f(lw)}"/>`;

  // the house triangle, wider than an equilateral one, cut along its medians into three parts (one per corner:
  // the corner, the two edge midpoints beside it and the centre); each part's outward direction is its median
  const parts = (B, h) => {
    const A = [B / 2, 0], Bv = [0, h], C = [B, h], G = [B / 2, 2 * h / 3];
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const Mab = mid(A, Bv), Mbc = mid(Bv, C), Mca = mid(C, A);
    const out = (p) => { const dx = p[0] - G[0], dy = p[1] - G[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
    return [
      {pts: [A, Mca, G, Mab], dir: out(A)},
      {pts: [Bv, Mab, G, Mbc], dir: out(Bv)},
      {pts: [C, Mbc, G, Mca], dir: out(C)},
    ];
  };
  const centre = pts => [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
  // one part with its centre at (cx, cy), turned `tilt` about that centre, with the hard shadow cut after the turn:
  // the shadow is the part's own polygon, filled and never stroked, `d` px down and right, so each foot carries one
  // offset of ink past its edge and not an edge's worth more
  const part = (p, cx, cy, tilt, fill, lw, d) => {
    const [ox, oy] = centre(p.pts), a = tilt * D2R, c = Math.cos(a), sn = Math.sin(a);
    const pts = p.pts.map(([x, y]) => { const dx = x - ox, dy = y - oy; return [cx + dx * c - dy * sn, cy + dx * sn + dy * c]; });
    const poly = (ddx, ddy) => pts.map(q => f(q[0] + ddx) + ',' + f(q[1] + ddy)).join(' ');
    const edge = ` stroke="${INK}" stroke-width="${f(lw)}" stroke-linejoin="round"`;
    return {pts, shade: `<polygon points="${poly(d, d)}" fill="${INK}"/>`, body: `<polygon points="${poly(0, 0)}" fill="${fill}"${edge}/>`};
  };
  // the exploded triangle in one box: the parts pushed out along their medians (the top one a fifth further, so the
  // three cuts open to about the same gap), each turned
  const exploded = (B, h, g, lw, d, looks) => {
    const ps = parts(B, h);
    const out = ps.map((p, i) => {
      const [ox, oy] = centre(p.pts), push = i === 0 ? g * 1.2 : g;
      return part(p, ox + p.dir[0] * push, oy + p.dir[1] * push, looks[i][1], looks[i][0], lw, d);
    });
    const all = out.flatMap(q => q.pts);
    const x0 = Math.min(...all.map(q => q[0])) - lw / 2, y0 = Math.min(...all.map(q => q[1])) - lw / 2;
    const x1 = Math.max(...all.map(q => q[0])) + Math.max(lw / 2, d), y1 = Math.max(...all.map(q => q[1])) + Math.max(lw / 2, d);
    return {w: x1 - x0, h: y1 - y0, x0, y0, body: out.map(q => q.shade).join('') + out.map(q => q.body).join('')};
  };

  // ---- placing: each shape its own .deco behind the page, clear of every word ----
  const hits = (a, b, pad) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
  const placed = [];
  const clean = s => { const r = s.getBoundingClientRect(); return !words.some(w => hits(r, w, PAD)) && !clear.some(c => hits(r, c, 0)); };
  // make(scale) -> shape; (x, y) is where `anchor` (two letters: t/c/b then l/c/r) of the box goes
  const put = (name, make, x, y, anchor = 'tl') => {
    for (const sc of [1, .9, .8]) {
      const sh = make(sc), ow = sh.w + (sh.shade ? SH : 0), oh = sh.h + (sh.shade ? SH : 0);
      const left = anchor[1] === 'l' ? x : anchor[1] === 'c' ? x - sh.w / 2 : x - sh.w;
      const top = anchor[0] === 't' ? y : anchor[0] === 'c' ? y - sh.h / 2 : y - sh.h;
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('class', 'deco ' + name);
      s.setAttribute('width', f(ow)); s.setAttribute('height', f(oh));
      s.setAttribute('viewBox', `0 0 ${f(ow)} ${f(oh)}`);
      s.style.position = 'absolute'; s.style.left = f(left) + 'px'; s.style.top = f(top) + 'px';
      s.innerHTML = (sh.shade ? `<g transform="translate(${SH} ${SH})">${sh.shade}</g>` : '') + sh.body;
      card.insertBefore(s, safe);
      if (clean(s)) { placed.push(name); return s; }
      s.remove();
    }
    return null;
  };
  // a drawing made straight in page coordinates, clipped to its box (x, y, w, h), so nothing it draws leaves the box
  const raw = (name, x, y, w, h, body) => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'deco ' + name);
    s.setAttribute('width', f(w)); s.setAttribute('height', f(h));
    s.setAttribute('viewBox', `${f(x)} ${f(y)} ${f(w)} ${f(h)}`);
    s.style.position = 'absolute'; s.style.left = f(x) + 'px'; s.style.top = f(y) + 'px'; s.style.overflow = 'hidden';
    s.innerHTML = body;
    card.insertBefore(s, safe);
    if (clean(s)) { placed.push(name); return s; }
    s.remove();
    return null;
  };

  // ---- the signature, whole, in one box (x0, y0, w, h), its ink starting on x0 and ending inside the box ----
  // follow.the.money: three flows 1:2:4, ink, ink then the colour, in phase, `n` whole waves crest to crest so the
  // cut ends stand square to the box; the width is the amount
  const flows = (x0, y0, w, h, least, n) => {
    const amp = Math.round(h * .07), k = Math.max(least, (h - 2 * amp - SH) / 9.2), gap = (h - SH - 2 * amp - 7 * k) / 2;
    const ws = [k, 2 * k, 4 * k];
    let y = y0 + amp + ws[0] / 2;
    const ys = [y, y += (ws[0] + ws[1]) / 2 + gap, y += (ws[1] + ws[2]) / 2 + gap];
    const xa = x0, xb = x0 + w - SH, lam = (xb - xa) / n;
    const wave = (yc) => { let d = ''; for (let x = xa; x <= xb + .1; x += 3) d += (x > xa ? 'L' : 'M') + f(x) + ',' + f(yc - amp * Math.cos(2 * Math.PI * (x - xa) / lam)); return d; };
    return stroke(wave(ys[0]), INK, ws[0], false, 'butt') + stroke(wave(ys[1]), INK, ws[1], false, 'butt') + stroke(wave(ys[2]), COL, ws[2], true, 'butt');
  };
  // under.the.hood: the house triangle come apart along its medians, all three parts in the colour (cream on the
  // lilac read as a hole), each knocked a degree or two loose so the cut edges stay nearly parallel across each gap
  // and it reads as one triangle pulled apart, as large as the box holds, on its left edge. The gaps are pushed wide
  // enough (26/360 of the base) that the ground shows through every one past the parts' shadows; the parts are never
  // spread sideways to fill a width, which only scatters them into chips (a 160 px band holds a triangle about
  // 270 px wide). `lw` is the parts' ink edge and `d` their shadow's offset; the box's last SH px are for a shadow,
  // as on the other signatures.
  const apart = (x0, y0, w, h, lw, d) => {
    const looks = [[COL, -2], [COL, 2], [COL, 1]], tw = w - SH + d;
    let B = 600, e;
    for (; B > 60; B -= 2) { e = exploded(B, B * 196 / 360, B * 26 / 360, lw, d, looks); if (e.w <= tw && e.h <= h) break; }
    return {w: e.w, B, body: `<g transform="translate(${f(x0 - e.x0)} ${f(y0 + (h - e.h) / 2 - e.y0)})">${e.body}</g>`};
  };
  // mind.the.gap: the coral squiggle and the ink zigzag, two timelines, run in from the left, the squiggle along the
  // top and the zigzag along the foot, and meet at one cream node, today, from opposite sides. The zigzag keeps
  // strict teeth on its own row to a last low corner, and its last leg runs on at the teeth's own slope straight to
  // the node's centre, ending on the ring at its lower left (the step is eased until that leg lands there); the
  // squiggle calms and runs down into the ring at its upper left on the mirror of that line. So the two lines arrive
  // on opposite sides of the node, the squiggle's hard shadow falls along its own run into the node, and nothing
  // meets or knots beside it; the dots run on from the node to the box's ink edge. `sc` scales every line (1 on the
  // wide).
  const timelines = (x0, y0, w, h, sc, waves = 2.7, teeth = 4.35) => {
    const r = 18 * sc, lw = 6 * sc, sqw = 18 * sc, zzw = 14 * sc, amp = 14 * sc;
    const nx = x0 + w * .66, ny = y0 + h * .48, run = nx - x0;
    const sa = x0 + sqw / 2, za = x0 + zzw / 2;           // the round caps start on x0
    const ys = y0 + 22 * sc, yz = y0 + h - SH - 22 * sc;
    let half = run / teeth / 2, m = 1, th = 0;
    for (let i = 0; i < 8; i++) {
      th = Math.atan2(2 * amp, half);
      const xl = nx - (yz + amp - ny) / Math.tan(th), q = (xl - za) / half;
      m = Math.max(1, Math.round(q)); if (m % 2 === 0) m += q > m ? 1 : -1;
      half = (xl - za) / m;
    }
    const ct = Math.cos(th), st = Math.sin(th);
    const es = [nx - r * ct, ny - r * st], ez = [nx - r * ct, ny + r * st];   // the two ends, on the ring
    let zd = '';
    for (let k = 0; k <= m; k++) zd += (k ? 'L' : 'M') + f(za + k * half) + ',' + f(yz + (k % 2 ? amp : -amp));
    zd += 'L' + f(ez[0]) + ',' + f(ez[1]);
    const lead = Math.min(56 * sc, (es[1] - ys + 6 * sc) / st);
    const sq = curve([sa, ys], [x0 + w * .34, ys], [es[0] - lead * ct, es[1] - lead * st], es, 240);
    return stroke(zd, INK, zzw, false, 'round', 'miter') + stroke(waveOn(sq, 13 * sc, run / waves, lead * 1.2), COL, sqw, true) +
           dotRow(nx + r + lw / 2 + 12 * sc, x0 + w - SH, ny, 6 * sc, 22 * sc) + node(nx, ny, r, lw);
  };

  const S = R('#safe')[0];
  if (tall) {
    // 1. the loud colour: a 460 px disc behind the proof's top-right corner, bleeding off the right edge, clear of
    // the headline by 40 px
    const dr = 230, dTop = Math.max(headBottom + PAD + 4, TR[1] - 62);
    put('disc', s => disc(dr * s), Math.max(TR[0] + 62, W + 50 - dr), dTop, 'tc');

    // 2. the signature, whole, in the open band under the proof, in one box for every series: from the left margin
    // to the proof's own right edge (the frame's bottom-right corner, about x 798), so the band under the proof is
    // as wide as the proof above it; its top 40 px under the frame's hard shadow, its foot inside the safe box (and
    // 40 px over the logos, when the piece has them). The flows and the timelines end their ink on that line and
    // their shadow falls past it, as the frame's own does; the triangle sits whole on the left margin.
    const x0 = S.left, y0 = Math.ceil(Math.max(BL[1], BR[1]) + FSH + PAD);
    const y1 = Math.min(S.bottom, ...R('.foot').map(r => r.top - PAD));
    const h = Math.min(160, y1 - y0), xr = Math.round(Math.max(TR[0], BR[0])), w = xr - x0 + SH;
    if (h >= 110) {
      if (day === 'mon') raw('sig', x0, y0, w, h, flows(x0, y0, w, h, 14, Math.max(2, Math.round((w - SH) / (h * .95)))));
      else if (day === 'wed') { const a = apart(x0, y0, w, h, 10, 10); raw('sig', x0, y0, Math.max(w, Math.ceil(a.w)), h, a.body); }
      else { const run = (w - SH) * .66; raw('sig', x0, y0, w, h, timelines(x0, y0, w, h, Math.max(h / 145, LW / 14), run / (h * .63), run / (h * .4))); }
    }
  } else {
    // 1. the loud colour: a 420 px disc behind the proof's bottom-left corner, out below and left of the frame
    put('disc', s => disc(210 * s), BL[0] + 30, BL[1] + 6, 'cc');

    // 2. the signature, large and bold in the right column under the headline: its left edge on the headline's,
    // its ink ending 40 px over the foot (the wordmark and pill sit 40 px under the top), clear of YouTube's badge
    const x0 = Math.min(...R('h1').map(r => r.left)), x1 = 950, y0 = headBottom + PAD + 2, y1 = H - 40;
    const bw = x1 - x0, bh = y1 - y0;
    if (day === 'mon') raw('sig', x0, y0, bw, bh, flows(x0, y0, bw, bh, LW, 2));
    else if (day === 'wed') { const a = apart(x0, y0, bw, bh, 10, 8); raw('sig', x0, y0, Math.max(bw, Math.ceil(a.w)), bh, a.body); }
    else raw('sig', x0, y0, bw, bh, timelines(x0, y0, bw, bh, 1));
  }
  return {placed, frame: [TL, TR, BR, BL].map(p => p.map(Math.round))};
}"""
