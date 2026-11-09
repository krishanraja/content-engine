"""Series worlds (series skin "series_worlds", concept c02): each weekly series draws its own metaphor as the ground, in its own colour.

One family on Mon, Wed and Fri, drawn to one locked grammar:

- Ground. The series colour with a 10% paper grain. The pill, tag, mark box, proof shadow and grain are the house
  ones, untouched.
- One anchor. Each world has one big object-like anchor in the open ground under the proof, and every line serves
  it: Mon's split point, Wed's gear, Fri's today. Mon's split point and Fri's today are the same solid ink node,
  radius NR = 108 px at tall (1.5 x the old today) and 67 on wide; the gear is 2 x BAND across.
- Weights. One band and three line weights: BAND 220, then 120, 60 and 24 px at tall, times 0.62 on wide. Fri's
  three lines are the three weights; Wed's parts are cut to the same sizes (bolt and shaft 84, plate 38 thick);
  Mon's trunk is its three shares side by side in 160 : 70 : 24, sized so the trunk is 0.88 of the node across.
- Colour roles. Drawing uses only ink #0C1512, paper #FFFCF4 and one deep step of the series colour (Mon #F2A900,
  Wed #7A62EC, Fri #C8361A). Bands, lines, nodes and Wed's parts carry a 3.6 px ink contour and the 7 px hard
  ink shadow the proof has. Wed's parts are solid bodies (bolt and shaft paper, plate and gear deep) with ink
  detail lines on paper and paper ones on deep; its centre lines and pitch circle are 8 px paper dash-dot (5 px
  on wide).
- Ends. Every band, line and axis comes in from off the card edge, or from behind the proof's bottom edge at 45
  deg or more off it, and ends off the card edge or inside its anchor; it crosses the card edge on a clear
  diagonal or square to it, and nothing runs within 30 px of a card edge parallel to it. Nothing ends in a cap,
  ring, bead or tick.
- Tilt. The world turns -2.5 deg about the card centre, the proof's own tilt (type and logos never turn), so its
  straight runs, parts and dashes sit parallel to the receipt.
- Placement. On tall the world lives in two places only: the top strip above the wordmark and pill (60 px clear
  of them) and the open ground under the proof. Nothing runs in the gutters beside the proof or the margins beside
  the headline, the gap between the headline and the proof stays empty, and nothing passes within 60 px of a
  proof corner. On wide it lives in the open ground under the headline, 60 px below its box and right of the
  proof's corner (60 px clear of it).

The worlds:
- follow.the.money, the money map. Tall: the trunk sweeps across the top strip from off the top right and off
  the left edge; under the proof it comes out from behind the receipt's bottom edge at 45 deg into the split
  point, where the shares part without crossing: the paper, the biggest, turns level and runs through the field
  under the proof and off the right edge, the amber falls away under it off the bottom edge, and the thin ink
  turns back level off the left edge. Wide: the trunk rises in off the bottom edge right of the proof, bends
  level 60 px under the headline and runs into the split point; the paper runs on off the right edge, the amber
  falls off the bottom right and the ink dives off the bottom. Width is the amount.
- under.the.hood, the product comes apart: an exploded assembly drawing on lilac, in solid parts. One axis, jogged
  as assembly drawings are: a dash-dot centre line across the top strip carrying a long bolt backing out of a
  plate, the whole plate inside the strip; a second centre line under the proof carrying the 440 px deep gear
  (tucked behind the receipt's bottom edge, clear of its corners, with a round bore, a web, a pitch circle and
  centre marks) and the plain chamfered shaft it slid off, with a two-line collar, whose top contour runs
  parallel to the proof's bottom edge 80 px under its shadow and off the right edge. Wide: the gear is the one
  loud thing, in the open ground under the headline and cropped off the bottom edge at its centre; the bolt backs
  out of the plate on a centre line to its left, its head 60 px clear of the proof's corner.
- mind.the.gap, the timeline. Three plain lines start far apart and meet at today, every end inside the node;
  only the future past it is dashed. Tall: the deep 120 (the far past) comes in off the top right, across the top
  strip and off the left edge, then back in off the left edge under the proof and level into today from the
  left; on the right the ink 24 comes in off the right edge under the proof, the paper 60 comes up off the bottom
  edge and the future runs off between them to the bottom right. Wide: the deep rises in off the bottom edge
  right of the proof and bends level into today from the left; the ink comes in off the right edge, the future
  runs off it dashed, and the paper comes up off the bottom edge.
The world is drawn once in card coordinates and shown through windows that tile the card minus a clear margin
round every word (headline lines, pill, tag, wordmark, logos); the drawing is routed so the windows cut nothing
that shows. Decorations carry no words or numbers.
"""
import re
from urllib.parse import quote

PALETTE = {
    # ground (the series colour), deep (one deeper step of it)
    'mon': {'ground': '#FFD84D', 'deep': '#F2A900'},
    'wed': {'ground': '#B7A6FF', 'deep': '#7A62EC'},
    'fri': {'ground': '#FF6A4D', 'deep': '#C8361A'},
}
PAPER = '#FFFCF4'
SHADOW = 7  # the hard ink offset shadow, px, on the proof and on every drawn body


def grain(alpha):
    """A tiling fractal-noise paper grain (dark specks) as a data URI."""
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'>"
           "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/>"
           "<feColorMatrix values='0 0 0 0 .05 0 0 0 0 .08 0 0 0 0 .07 1.7 0 0 0 -.6'/></filter>"
           f"<rect width='260' height='260' filter='url(#g)' opacity='{alpha}'/></svg>")
    return f'url("data:image/svg+xml,{quote(svg)}")'


def skin(html, facts, shape, look, kit):
    if not look.get('series') or kit.day not in PALETTE:
        return html
    pal = PALETTE[kit.day]
    col, ink = pal['ground'], kit.INK
    u = 9 if kit.tall else 8
    css = f"""
:root {{ --g: {col}; --deep: {pal['deep']}; --paper: {PAPER}; --u: {u}px; --sh: {SHADOW}px; }}
body {{ background: {col}; }}
#card {{ background: {grain(.10)}, {col} !important; }}
#safe {{ z-index: 2; }}
.pill {{ background: {ink}; color: {col}; }}
.pin .tag, .tag {{ background: {ink}; color: {col}; }}
.frame {{ box-shadow: var(--sh) var(--sh) 0 {ink}; }}
h1 mark {{ background: {PAPER}; color: {ink}; box-shadow: var(--u) var(--u) 0 {ink}; }}
.deco.win {{ position: absolute; z-index: 1; pointer-events: none; overflow: hidden; display: block; }}
"""
    html = html.replace('</style>', css + '</style>', 1)
    html = re.sub(r'<div id="card" class="', f'<div id="card" data-world="{kit.day}" class="', html, count=1)
    return html


PLACE_JS = r"""([shape, geo]) => {
  const card = document.querySelector('#card'), cr = card.getBoundingClientRect();
  const W = card.clientWidth, H = card.clientHeight, tall = shape !== 'wide';
  // A cover (not one of the two thumbnails, skins.GEO) whose wordmark row sits near the top edge (the square) has no top
  // strip: the world is drawn under the proof alone, never cut into scraps round the wordmark and the pill.
  const GEO = geo || {thumb: true};
  const world = card.dataset.world, full = card.dataset.full === '1';
  const css = getComputedStyle(document.documentElement);
  const v = n => css.getPropertyValue(n).trim();
  const C = {g: v('--g'), deep: v('--deep'), paper: v('--paper'), ink: '#0C1512'};
  const U = parseFloat(v('--u')), SH = parseFloat(v('--sh'));
  const rel = r => ({l: r.left - cr.left, t: r.top - cr.top, r: r.right - cr.left, b: r.bottom - cr.top, w: r.width, h: r.height});
  const R = q => { const e = document.querySelector(q); return e ? rel(e.getBoundingClientRect()) : null; };
  // The clear margin the windows keep round every word: wider round the wordmark and pill than round the
  // headline, whose outer margins the world runs down.
  const P = tall ? 22 : 18, PT = tall ? 60 : 18;
  const pad = (k, p, q = p) => ({l: Math.floor(k.l - p), t: Math.floor(k.t - p), r: Math.ceil(k.r + q), b: Math.ceil(k.b + q)});
  const h1 = document.querySelector('h1'), rg = document.createRange(); rg.selectNodeContents(h1);
  const lines = [...rg.getClientRects()].map(rel);
  const marks = [...document.querySelectorAll('h1 mark')].flatMap(m => [...m.getClientRects()]).map(rel);
  const keep = [pad(R('h1'), 3),
    ...['.wmp', '.pill'].flatMap(q => [...document.querySelectorAll(q)]).map(e => pad(rel(e.getBoundingClientRect()), PT)),
    ...['.tag', '.logos'].flatMap(q => [...document.querySelectorAll(q)]).map(e => pad(rel(e.getBoundingClientRect()), P)),
    ...lines.map(k => pad(k, P)), ...marks.map(k => pad(k, P, P + U))];
  card.dataset.keep = JSON.stringify(keep);
  const WM = R('.wmp'), PL = R('.pill'), HD = R('h1'), TG = R('.tag');
  const strip = GEO.thumb || Math.min(WM.t, ...(PL ? [PL.t] : [])) - PT >= 140;
  // The headline's drawn bottom: its box, or its marks and their hard shadow, whichever is lower.
  const HB = Math.max(HD.b, ...marks.map(m => m.b + U));
  // The proof frame as it is drawn, turned -2.5deg about its centre: onF(u, v) is a point on it (0..1 each way).
  const fe = document.querySelector('.frame'), fb = rel(fe.getBoundingClientRect());
  const fw = fe.offsetWidth, fh = fe.offsetHeight, fcx = (fb.l + fb.r) / 2, fcy = (fb.t + fb.b) / 2, fa = -2.5 * Math.PI / 180;
  const onF = (u, v) => { const x = (u - .5) * fw, y = (v - .5) * fh; return [fcx + x * Math.cos(fa) - y * Math.sin(fa), fcy + x * Math.sin(fa) + y * Math.cos(fa)]; };
  // The proof's bottom edge (with its hard shadow) at card x.
  const BLc = onF(0, 1), BRc = onF(1, 1);
  const edgeY = x => BLc[1] + (x - BLc[0]) * (BRc[1] - BLc[1]) / (BRc[0] - BLc[0]) + SH;
  // The world turns with the proof (-2.5deg), so its straight runs sit parallel to the receipt. W_ takes a card
  // point to world coordinates, so anchors are set against the laid-out page while every direction keeps the tilt.
  const TILT = -2.5, ta = TILT * Math.PI / 180, cx0 = W / 2, cy0 = H / 2;
  const W_ = p => { const x = p[0] - cx0, y = p[1] - cy0; return [cx0 + x * Math.cos(-ta) - y * Math.sin(-ta), cy0 + x * Math.sin(-ta) + y * Math.cos(-ta)]; };
  const C_ = p => { const x = p[0] - cx0, y = p[1] - cy0; return [cx0 + x * Math.cos(ta) - y * Math.sin(ta), cy0 + x * Math.sin(ta) + y * Math.cos(ta)]; };
  const wp = (p, dx, dy = 0) => { const w = W_(p); return C_([w[0] + dx, w[1] + dy]); };   // a card point moved along world axes
  const shd = [SH * Math.cos(-ta) - SH * Math.sin(-ta), SH * Math.sin(-ta) + SH * Math.cos(-ta)];   // (SH, SH) on the card

  // ---- the grammar ---------------------------------------------------------------------------------------------
  const s = tall ? 1 : .62;
  const BAND = 220 * s, W1 = 120 * s, W2 = 60 * s, W3 = 24 * s;   // the band and the three line weights
  const NR = W1 * .9;                            // the anchor node: Fri's today and Mon's split point, 1.5x the old today
  const LW = tall ? 3.6 : 2.8;                   // the ink contour
  const HL = tall ? 4 : 3;                       // default linework width
  const CLR = 60;                                // clear of the headline box, pill, wordmark and the proof's corners

  // ---- geometry helpers ------------------------------------------------------------------------------------------
  const f1 = v => v.toFixed(1);
  const curve = (p0, d0, p3, d1, k = .45) => { const L = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) * k;
    const n0 = Math.hypot(...d0), n1 = Math.hypot(...d1);
    return [p0, [p0[0] + d0[0] / n0 * L, p0[1] + d0[1] / n0 * L], [p3[0] - d1[0] / n1 * L, p3[1] - d1[1] / n1 * L], p3]; };
  // A path through card points [[p, d, k], ...], where the directions d are world directions (so they carry the
  // tilt) and each anchor p is pinned to the laid-out card.
  const route = (pts, k = .45) => pts.slice(1).map((q, i) => curve(W_(pts[i][0]), pts[i][1], W_(q[0]), q[1], q[2] || k));
  const cubic = segs => segs.map((c, i) => (i ? '' : `M${f1(c[0][0])} ${f1(c[0][1])} `) + `C${c.slice(1).map(p => f1(p[0]) + ' ' + f1(p[1])).join(' ')}`).join(' ');
  const seg = (a, b) => `M${f1(a[0])} ${f1(a[1])} L${f1(b[0])} ${f1(b[1])}`;
  const bez = (c, t) => { const m = 1 - t; return [0, 1].map(i => m * m * m * c[0][i] + 3 * m * m * t * c[1][i] + 3 * m * t * t * c[2][i] + t * t * t * c[3][i]); };
  const dbez = (c, t) => { const m = 1 - t; return [0, 1].map(i => 3 * m * m * (c[1][i] - c[0][i]) + 6 * m * t * (c[2][i] - c[1][i]) + 3 * t * t * (c[3][i] - c[2][i])); };
  // Points along a path with the unit normal on the left of the direction of travel.
  const samp = (segs, n = 90) => segs.flatMap((c, j) => [...Array(n + (j === segs.length - 1 ? 1 : 0))].map((_, i) => {
    const t = i / n, p = bez(c, t), d = dbez(c, t), L = Math.hypot(...d) || 1; return {p, nl: [d[1] / L, -d[0] / L], d: [d[0] / L, d[1] / L]}; }));
  const poly = pts => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join(' L');
  let out = '';
  const tr = `transform="translate(${f1(shd[0])} ${f1(shd[1])})"`;
  // A band or line: its hard ink shadow, its ink contour, then its body. Butt ends: every one runs off the card or
  // into an anchor. Inside a group (lay), shadows, contours and bodies are each laid as one layer, so pieces that
  // join (a bundle and the shares it peels into, the lines that meet at today) meet without a seam.
  let L = null;
  const put = (k, sv) => { if (L) L[k] += sv; else out += sv; };
  const lay = f => { L = {s: '', c: '', f: ''}; f(); out += L.s + L.c + L.f; L = null; };
  const line = (d, w, fill, dash = '') => {
    const da = dash ? `stroke-dasharray="${dash}"` : '';
    put('s', `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${f1(w + 2 * LW)}" stroke-linejoin="round" ${da} ${tr}/>`);
    put('c', `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${f1(w + 2 * LW)}" stroke-linejoin="round" ${da}/>`);
    if (fill !== C.ink) put('f', `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${f1(w)}" stroke-linejoin="round" ${da}/>`);
  };
  // Linework (paper by default, no fill).
  const wire = (d, w = HL, dash = '', col = C.paper) => { out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f1(w)}" stroke-linecap="butt" stroke-linejoin="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`; };
  // The anchor node: one solid ink disc with the hard shadow, at a card point (drawn in world coordinates).
  const disc = (p, r) => { const w = W_(p); out += `<circle cx="${f1(w[0] + shd[0])}" cy="${f1(w[1] + shd[1])}" r="${f1(r)}" fill="${C.ink}"/><circle cx="${f1(w[0])}" cy="${f1(w[1])}" r="${f1(r)}" fill="${C.ink}"/>`; };
  // A node in the open ground under the proof (tall): at card x, its top a share of the free height below the
  // proof's edge, so it sits clear of the proof and of the bottom edge.
  const under = (x, r, k = .56) => { const t = edgeY(x), room = H - t - 2 * r; return [x, t + room * k + r]; };

  // A spoke: a line from the centre of node n out along world angle ang (deg, 0 = along the proof, 90 = down) to
  // an exit point beyond the card edge, bending to arrive there in direction d1.
  const spoke = (n, ang, exit, d1, k = .5) => { const a = ang * Math.PI / 180;
    return cubic([curve(W_(n), [Math.cos(a), Math.sin(a)], W_(exit), d1, k)]); };
  if (world === 'mon') {
    // ---- follow.the.money: one trunk in, the same amount out in three shares -------------------------------------
    // The trunk is the three shares bundled side by side (paper, amber and ink, 160 : 70 : 24), so it is visibly their
    // sum. It ends in the split point, a solid ink node the size of Fri's today, and the shares leave it.
    const k3 = (2 * NR * .88 - 6 * LW) / 254;
    const SH3 = [[160 * k3, C.paper], [70 * k3, C.deep], [24 * k3, C.ink]];
    const TOT = SH3.reduce((a, [w]) => a + w + 2 * LW, 0);
    const offs = (() => { let x = TOT / 2; return SH3.map(([w]) => { const o = x - (w + 2 * LW) / 2; x -= w + 2 * LW; return o; }); })();
    const bundle = segs => {
      const d = cubic(segs), pts = samp(segs);
      put('s', `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${f1(TOT)}" stroke-linejoin="round" ${tr}/>`);
      put('c', `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${f1(TOT)}" stroke-linejoin="round"/>`);
      SH3.forEach(([w, col], i) => { if (col === C.ink) return;
        put('f', `<path d="${poly(pts.map(q => [q.p[0] + q.nl[0] * offs[i], q.p[1] + q.nl[1] * offs[i]]))}" fill="none" stroke="${col}" stroke-width="${f1(w)}" stroke-linejoin="round"/>`); });
      return pts[pts.length - 1];
    };
    // Each share leaves the split point from its own place in the trunk's end e, in its own world direction, and runs
    // to its exit; the node hides where they part.
    const share = (e, i, d0, exit, d1, k = .5) => { const q = [e.p[0] + e.nl[0] * offs[i], e.p[1] + e.nl[1] * offs[i]];
      line(cubic([curve(q, d0, W_(exit), d1, k)]), SH3[i][0], SH3[i][1]); };
    if (tall) {
      // Top strip: the trunk sweeps in off the top right and off the left edge on a falling diagonal, 60 px and more
      // above the wordmark and pill.
      if (strip) lay(() => bundle(route([[[W + 150, -160], [-1, .6]], [[W * .62, 34], [-1, .15], .5], [[W * .25, 66], [-1, .1], .5], [[-90, 108], [-1, .38], .5]])));
      // Open ground: the trunk comes out from behind the receipt's bottom edge on a steep diagonal (45 deg off it),
      // well clear of its corners, into the split point. There the shares part: the paper, the biggest, turns level
      // and runs through the field under the proof and off the right edge; the amber falls away under it and off the
      // bottom edge; the ink turns back under the trunk and off the left edge.
      const J = under(W * .56, NR, .6), dj = [Math.cos(45 * Math.PI / 180), Math.sin(45 * Math.PI / 180)];
      lay(() => { const e = bundle(route([[[J[0] - 330 * dj[0], J[1] - 330 * dj[1]], dj], [J, dj, .5]]));
        share(e, 0, [1, -.02], [W + 80, J[1] - 40], [1, 0]);
        share(e, 1, [1, .3], [W * .88, H + 80], [.6, 1], .55);
        share(e, 2, [-1, .02], [-80, J[1] + 50], [-1, 0]); });
      disc(J, NR);
    } else {
      // The open ground under the headline: the trunk rises in off the bottom edge right of the proof's corner and
      // turns to run level, 60 px under the headline, into the split point; there the shares part: the paper runs
      // on level off the right edge, the amber falls off the bottom right, the ink dives off the bottom edge.
      const J = [W * .8, HB + CLR + NR + 4];
      lay(() => { const e = bundle(route([[[BRc[0] + SH + CLR + 20, H + 60], [1, -.53]], [[J[0] - 150, J[1] + 3], [1, -.04], .55], [J, [1, 0], .5]]));
        share(e, 0, [1, -.02], [W + 60, J[1] - 24], [1, -.03]);
        share(e, 1, [1, .5], [W - 40, H + 60], [.55, 1], .55);
        share(e, 2, [.8, 1], [J[0] + 140, H + 60], [.6, 1], .5); });
      disc(J, NR);
    }
  } else if (world === 'wed') {
    // ---- under.the.hood: the product comes apart, an exploded assembly drawing -----------------------------------
    // Every part is a solid body to the family grammar: a paper or deep fill with the 3.6 px ink contour and the 7 px
    // hard ink shadow that Mon's bands and Fri's lines carry; ink detail lines on paper, paper detail lines on deep.
    // Centre lines and the pitch circle are paper dash-dot, 8 px (5 px on wide), laid under the parts so they show
    // between them. Parts are drawn in world coordinates about a pinned anchor, so they carry the tilt.
    const CL = tall ? 8 : 5;
    const AXD = `${f1(CL * 6)} ${f1(CL * 1.75)} ${f1(CL)} ${f1(CL * 1.75)}`;   // dash-dot, scaled to its weight
    const pth = (pts, close = true) => 'M' + pts.map(q => f1(q[0]) + ' ' + f1(q[1])).join(' L') + (close ? 'Z' : '');
    const ring = (c, rad) => `M${f1(c[0] + rad)} ${f1(c[1])} A${f1(rad)} ${f1(rad)} 0 1 0 ${f1(c[0] - rad)} ${f1(c[1])} A${f1(rad)} ${f1(rad)} 0 1 0 ${f1(c[0] + rad)} ${f1(c[1])}Z`;
    // A solid part: its hard ink shadow, its ink contour (LW outside the body), then its body.
    const body = (d, fill, rule = 'nonzero') => {
      out += `<path d="${d}" fill="${C.ink}" fill-rule="${rule}" stroke="${C.ink}" stroke-width="${f1(2 * LW)}" stroke-linejoin="round" ${tr}/>`;
      out += `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${f1(2 * LW)}" stroke-linejoin="round"/>`;
      out += `<path d="${d}" fill="${fill}" fill-rule="${rule}"/>`;
    };
    const inkl = d => wire(d, LW, '', C.ink);
    const along = (a, dx) => wp(a, dx);                              // along the world x axis from a card point
    const cline = (a, b) => wire(seg(W_(a), W_(b)), CL, AXD);       // a centre line between two card points
    // A bolt side-on along the world x axis, its head's left end at card point a: length len, shank d, head hh. One
    // paper body (head and shank), the head's flats, the thread and the chamfer in ink.
    const bolt = (a, len, d, hh) => { const o = W_(a), r = q => [o[0] + q[0], o[1] + q[1]];
      const hw = hh * .62, ch = d * .2, t0 = hw + (len - hw) * .45;
      body(pth([[0, -hh / 2], [hw, -hh / 2], [hw, -d / 2], [len - ch, -d / 2], [len, -d / 2 + ch], [len, d / 2 - ch], [len - ch, d / 2],
                [hw, d / 2], [hw, hh / 2], [0, hh / 2]].map(r)), C.paper);
      inkl(pth([[hw, -d / 2], [hw, d / 2]].map(r), false));
      inkl(pth([[0, -hh / 6], [hw, -hh / 6]].map(r), false)); inkl(pth([[0, hh / 6], [hw, hh / 6]].map(r), false));
      inkl(pth([[t0, -d / 2], [t0, d / 2]].map(r), false));
      inkl(pth([[t0, -d * .3], [len - ch, -d * .3]].map(r), false)); inkl(pth([[t0, d * .3], [len - ch, d * .3]].map(r), false));
      inkl(pth([[len - ch, -d / 2], [len - ch, d / 2]].map(r), false));
    };
    // A plate seen edge-on across the axis: thickness t, height h, one deep body.
    const plate = (c, t, h) => { const o = W_(c), r = q => [o[0] + q[0], o[1] + q[1]];
      body(pth([[-t / 2, -h / 2], [t / 2, -h / 2], [t / 2, h / 2], [-t / 2, h / 2]].map(r)), C.deep); };
    // The gear face-on: one deep body (teeth and a round bore through it), the web and the dash-dot pitch circle in
    // paper, and its centre marks (hx: half the horizontal mark, 0 for none; up and dn: the vertical mark each way).
    const gear = (c, r, N, rot0, hx, up, dn) => {
      const w = W_(c), rr = r * .86, st = 2 * Math.PI / N, pts = [];
      for (let i = 0; i < N; i++) { const a = rot0 + i * st;
        [[-.5, rr], [-.22, rr], [-.12, r], [.12, r], [.22, rr]].forEach(([k, rad]) => pts.push([w[0] + rad * Math.cos(a + k * st), w[1] + rad * Math.sin(a + k * st)])); }
      body(pth(pts) + ' ' + ring(w, rr * .22), C.deep, 'evenodd');
      wire(ring(w, rr * .6), CL * .75);
      wire(ring(w, rr * .91), CL, AXD);
      if (hx) wire(seg([w[0] - hx, w[1]], [w[0] + hx, w[1]]), CL, AXD);
      wire(seg([w[0], w[1] - up], [w[0], w[1] + dn]), CL, AXD);
    };
    // A shaft side-on along the world x axis from its chamfered end at card point a: length len, diameter d. A plain
    // paper body, the chamfer line and a collar (two ink ring lines) in ink.
    const shaft = (a, len, d) => { const o = W_(a), r = q => [o[0] + q[0], o[1] + q[1]], ch = d * .16;
      body(pth([[len, -d / 2], [ch, -d / 2], [0, -d / 2 + ch], [0, d / 2 - ch], [ch, d / 2], [len, d / 2]].map(r)), C.paper);
      inkl(pth([[ch, -d / 2], [ch, d / 2]].map(r), false));
      [d * 1.5, d * 1.85].forEach(x => inkl(pth([[x, -d / 2], [x, d / 2]].map(r), false))); };
    if (tall) {
      // One exploded axis, jogged as assembly drawings are. Across the top strip the bolt backs out of the plate, the
      // whole plate inside the strip and 60 px and more clear of the wordmark and pill. Under the proof the gear has
      // slid off the shaft: the shaft's top edge runs parallel to the proof's bottom edge, 80 px under it, and the
      // gear on its centre line tucks behind the proof's bottom edge, clear of its corner. Both centre lines come in
      // off the left edge and leave off the right.
      const BH = W1, PH = W1 * 1.2, SD = W2 * 1.4;
      const P0 = wp([150, 124], W * .7 - 150);                          // the plate, on the top centre line
      if (strip) {
        cline(along(P0, -P0[0] - 60), along(P0, W - P0[0] + 60));
        bolt(along(P0, 110 - P0[0]), 560, W2 * 1.4, BH);
        plate(P0, W3 * 1.6, PH);
      }
      const B0 = wp(onF(.5, 1), 0, SH + 80 + LW + SD / 2);              // the shaft's centre line: its contour 80 px under the proof's shadow
      const G = along(B0, W * .39 - B0[0]);
      cline(along(B0, -B0[0] - 60), along(B0, W - B0[0] + 60));
      shaft(along(G, BAND * 1.27), W, SD);
      gear(G, BAND, 24, .1, BAND * .8, BAND * 1.16, BAND * 1.16);
    } else {
      // The gear is the one loud thing: in the open ground under the headline, cropped off the bottom edge with its
      // centre on it (its horizontal mark would run along the edge, so it has none), 60+ px clear of the headline box.
      // To its left, on a centre line that starts just ahead of the bolt head, the bolt backs out of the plate, its
      // head 60 px and more clear of the proof's corner.
      const gc = [HD.r - 132, H - 4], BH = W1 * 1.1;
      const a0 = [BRc[0] + SH + CLR + 26, Math.max(HB + CLR + BH / 2 + 8, gc[1] - BAND * .6)];
      cline(along(a0, 4), along(a0, gc[0] - a0[0] - BAND * .3));
      bolt(a0, 160, W2 * 1.3, BH);
      plate(along(a0, 206), W3 * 1.6, W1 * 1.2);
      gear(gc, BAND, 20, .1, 0, BAND * 1.12, BAND * 1.16);
    }
  } else if (world === 'fri') {
    // ---- mind.the.gap: three lines that meet at today ------------------------------------------------------------
    const dash = `${f1(34 * s)} ${f1(24 * s)}`;
    const future = d => { out += `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${f1(W3)}" stroke-dasharray="${dash}"/>`; };
    if (tall) {
      const T = under(W * .58, NR, .56);
      // Deep 120, the far past: in off the top right on a steep diagonal, across the top strip (60 px and more above
      // the pill and wordmark) and off the left edge on a falling diagonal; it comes back in off the left edge below
      // the proof, clear of its corner, and runs through the field under it, level, in to today from the left. The
      // other two come in on the right: the ink off the right edge below the proof, the paper up off the bottom edge;
      // the future leaves between them, dashed, off the bottom right.
      lay(() => {
        if (strip) line(cubic(route([[[W + 100, -150], [-1, .75]], [[W * .7, 92], [-1, .14], .5], [[W * .2, 110], [-1, .05], .5], [[-50, 130], [-1, .42], .5]])), W1, C.deep);
        line(cubic(route([[[-90, T[1] + 60], [1, -.08]], [T, [1, 0], .5]])), W1, C.deep);
        line(spoke(T, -10, [W + 60, T[1] - 64], [1, -.04]), W3, C.ink);
        line(spoke(T, 58, [T[0] + 200, H + 60], [.5, 1]), W2, C.paper);
      });
      future(spoke(T, 20, [W + 50, H - 40], [1, .45]));
      disc(T, NR);
    } else {
      // Today sits in the open ground under the headline, 60 px clear of it: the deep line rises in off the bottom
      // edge right of the proof's corner and turns to run in level from the left; on the right the ink comes in off the right edge,
      // the future runs off it dashed, and the paper comes up off the bottom edge.
      const T = [W * .78, HB + CLR + NR + 4];
      lay(() => {
        line(cubic(route([[[BRc[0] + SH + CLR + 10, H + 60], [1, -.53]], [[T[0] - 150, T[1] + 3], [1, -.04], .55], [T, [1, 0], .5]])), W1, C.deep);
        line(spoke(T, -14, [W + 60, T[1] - 52], [1, -.1]), W3, C.ink);
        line(spoke(T, 56, [T[0] + 120, H + 60], [.5, 1]), W2, C.paper);
      });
      future(spoke(T, 14, [W + 60, T[1] + 40], [1, .1]));
      disc(T, NR);
    }
  }

  // ---- windows: the card minus a clear margin round every word ---------------------------------------------------
  const svgOf = (x0, y0, x1, y1) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'deco win');
    el.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    el.setAttribute('preserveAspectRatio', 'none');
    Object.assign(el.style, {left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px'});
    el.innerHTML = `<g transform="rotate(${TILT} ${cx0} ${cy0})">${out}</g>`;
    card.insertBefore(el, document.querySelector('#safe'));
  };
  if (full) { svgOf(0, 0, W, H); return {wins: 1}; }
  const ys = [...new Set([0, H, ...keep.flatMap(k => [k.t, k.b]).map(v => Math.max(0, Math.min(H, v)))])].sort((a, b) => a - b);
  const wins = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1]; if (y1 - y0 < .5) continue;
    const block = keep.filter(k => k.t < y1 && k.b > y0).map(k => [Math.max(0, k.l), Math.min(W, k.r)]).sort((a, b) => a[0] - b[0]);
    let x = 0;
    for (const [a, b] of block) { if (a - x > .5) wins.push([x, y0, a, y1]); x = Math.max(x, b); }
    if (W - x > .5) wins.push([x, y0, W, y1]);
  }
  for (const w of wins) svgOf(...w);
  return {wins: wins.length};
}"""
