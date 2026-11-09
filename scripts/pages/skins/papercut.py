"""Paper cut-out (series skin "papercut", concept c11): the series piece sits in a paper diorama cut from tones of its own colour.

The ground is a sheet of paper tinted toward cream with the series colour (Monday s .45 at L .86, Wednesday s .35 at
L .88, Friday s .85 at L .80), with paper grain at 7%, so the series-colour mark stands off it: mark against paper at
(84, 890) on the tall measures WCAG 1.49 and dE76 41 on Wednesday (was 1.15 and 24), 1.69 and 49 on Friday, and on
Monday dE76 58 (was 39) but WCAG 1.07: a yellow mark cannot reach 1.4 on any paper lighter than itself (white gives
1.38), so Monday stands off by chroma, cream against yellow, and by its deep hard shadow. The paper frames the
page like a little stage: a torn valance hangs from the top (deep on the tall, clear of the wordmark and pill; a thin
torn edge on the wide), narrow torn strips run down the outer gutters, and behind the proof a stack of torn card climbs
both gutters (on the tall from well under the tag down; on the wide the left gutter from well under the tag). The
stack is palest at the back and deepens sheet by sheet; the front-most sheet is exactly the series colour. Every sheet
lifts off the one behind on a soft shadow (offset and blur 10 px tall, 6 px wide, at 30%) and shows the paper's fibre
(cream mixed half into its colour) along its torn edge. The proof stands on the house hard shadow in the deepest tone;
the highlight is a strip of the series colour laid on the sheet with its own hard paper shadow. Under the words on the
wide only the palest sheet and the front sheet show, and every torn edge there stays at least 50 px under the mark's
shadow. The stack and the bands are texture only; the one object carries the idea.

One slot for the metaphor object, the same for all three series, whole and never behind the proof:
  tall: in the tag's row, inside the safe box and the 3:4 grid crop: its floor runs 10 px over the proof's top edge,
        turned with the proof, its right end on the proof's right edge, its top 14 px past the headline's keep-out
        (28 px beside it); each object is fitted by its own top profile, so its tallest part stands at the right,
        under the open space beside the last line (about 330 to 365 by 95 to 104 px; y about 923 to 1027);
  wide: under the words, its left end on the headline's left edge, its floor 18 px over the bottom edge, about 275
        px across and 100 to 113 px tall, its shadow clear of YouTube's length badge (968, 548)-(1280, 720).
The stack and the bands below y 1660 on the tall are texture only.
Each object is cut from the same paper as the sheets: the sheet grain, a soft lifted shadow and a cream fibre rim
along its upper-left edge. One silhouette each:
  follow.the.money (mon): three stacks of paper coins, one, two and four, left to right: 1 : 2 : 4, each stack twice
      the one before it (the halving read the other way). Coins in profile: a deep-tone keyline and deep reeding on a
      gold edge, a gold face with a pale raised rim, the cream fibre upper left. Broad thin coins spread across the
      band on the tall; chunkier coins close together on the wide, to fill its height.
  under.the.hood  (wed): an exploded cog: the gear at the right end, then a washer, the pinion and (on the tall) a hex
      nut slid off to the left along their axis; the axis shows only in the gaps between the parts, never through a
      hole. The gear and the nut in the deepest card tone (T3), the washer pale, the pinion between. The wide drops
      the nut so the three parts can be larger.
  mind.the.gap    (fri): the gap itself: two ends of one torn sheet of layered card, pulled apart: each end a little
      stack of three torn layers (the stack's deepest card, the deep tone at L .40, deeper still), the back layer
      tallest; the layers' inner ends are one tear line on both sides, so they read as one sheet torn in two. The open
      gap between them runs to the floor (77 px on the wide, 86 px on the tall), and a cream strip with a series-colour
      fibre rim lies on the far side's back layer, pushed out over the gap past halfway, reaching across but not there
      yet. Nothing is cut from the series colour the front sheet already uses.
The paper never enters the words: PLACE_JS draws the scene once in page coordinates and shows it through tiles that
keep clear of the headline, tag, pill, wordmark plate and logos, and no torn edge or shadow crosses a tile's border,
so the border never shows. Nothing decorative carries words. Off days are untouched (the plain sage Receipt).
"""
import colorsys
import json

GRAIN = ("<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'>"
         "<feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .05  0 0 0 0 .07  0 0 0 0 .06  0 0 0 1.6 -.6'/></filter>"
         "<rect width='260' height='260' filter='url(#n)' opacity='.07'/></svg>")


def _enc(svg):
    return svg.replace('<', '%3C').replace('>', '%3E').replace('#', '%23').replace("'", '%27')


def hls(hex_, l=None, dl=0.0, dh=0.0, s=None):
    r, g, b = (int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, L, S = colorsys.rgb_to_hls(r, g, b)
    L = l if l is not None else L + dl
    S = s if s is not None else S
    r, g, b = colorsys.hls_to_rgb((h + dh) % 1, max(0, min(1, L)), max(0, min(1, S)))
    return '#' + ''.join(f'{round(v * 255):02X}' for v in (r, g, b))


# Per series: the tinted sheet; the card tones (T0 the palest, at the back, deepening to T3; T4, the front sheet, is
# the series colour itself); the deepest tone for the hard shadows; and the hue of the soft shadows.
def palette(day, c):
    if day == 'mon':
        return dict(paper=hls(c, l=.86, s=.45),
                    tones=[hls(c, l=.74, s=.92), hls(c, l=.63, dh=-.010, s=.96), hls(c, l=.555, dh=-.018, s=.95),
                           hls(c, l=.49, dh=-.026, s=.94), c],
                    deep=hls(c, l=.45, dh=-.026, s=.94), shadow=hls(c, l=.28, dh=-.02, s=.9),
                    cut=hls(c, l=.45, dh=-.026, s=.94))
    if day == 'wed':
        return dict(paper=hls(c, l=.88, s=.35),
                    tones=[hls(c, l=.86, s=.7), hls(c, l=.70, s=.74), hls(c, l=.60, s=.66), hls(c, l=.50, s=.6), c],
                    deep=hls(c, l=.45, s=.6), shadow=hls(c, l=.18, s=.5), cut=hls(c, l=.45, s=.6))
    return dict(paper=hls(c, l=.80, dh=.022, s=.85),
                tones=[hls(c, l=.775, dh=.014, s=.9), hls(c, l=.70, dh=.008, s=.92), hls(c, l=.62, s=.86),
                       hls(c, l=.545, dh=.004, s=.80), c],
                deep=hls(c, l=.545, dh=.004, s=.80), shadow=hls(c, l=.2, s=.55), cut=hls(c, l=.40, dh=.004, s=.80))


def skin(html, facts, shape, look, kit):
    if not look.get('series'):
        return html
    col, ink = look['colour'], kit.INK
    pal = palette(kit.day, col)
    data = dict(day=kit.day, col=col, ink=ink, cream=kit.CREAM, **pal)
    sh, deep = pal['shadow'], pal['deep']
    rgb = ','.join(str(int(sh[i:i + 2], 16)) for i in (1, 3, 5))
    paper, t0 = pal['paper'], pal['tones'][0]
    tall = kit.tall
    css = f"""
:root {{ --pc: '{json.dumps(data)}'; }}
body {{ background: {paper}; }}
#card {{ background: url("data:image/svg+xml,{_enc(GRAIN)}") 0 0 / 260px 260px repeat,
   radial-gradient(ellipse at 34% 38%, {kit.mix(paper, '#FFFFFF', .10)} 0, {paper} 55%, {kit.mix(paper, t0, .35)} 100%) !important; }}
.deco {{ position: absolute; pointer-events: none; overflow: hidden; display: block; }}
h1 {{ color: {ink}; }}
h1 mark {{ background: {col}; color: {ink};
   box-shadow: {'6px 7px' if tall else '4px 5px'} 0 {deep}, 0 {'10px 12px' if tall else '6px 8px'} -4px rgba({rgb}, .30); }}
.pill {{ background: {ink}; color: {col}; box-shadow: {'4px 5px' if tall else '3px 4px'} 0 {deep}; }}
.tag {{ background: {ink}; color: {col}; }}
.frame {{ box-shadow: {'12px 14px' if tall else '8px 9px'} 0 {deep}, 0 {'22px 26px' if tall else '14px 16px'} -12px rgba({rgb}, .40); }}
"""
    return html.replace('</style>', css + '</style>', 1)


PLACE_JS = r"""([shape, geo]) => {
  const NS = 'http://www.w3.org/2000/svg';
  const card = document.querySelector('#card'), safe = document.querySelector('#safe');
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--pc').trim();
  if (!raw) return;
  const P = JSON.parse(raw.slice(1, -1));
  const W = card.clientWidth, H = card.clientHeight, tall = shape !== 'wide';
  // The shape's platforms (skins.GEO): YouTube's length badge on the wide thumbnail. On a cover (not a thumbnail) the
  // object's slot may be too small for it: then it is left out, never drawn as a speck.
  const GEO = geo || {thumb: true, badge: tall ? null : [968, 548, 1280, 720]};
  const T = P.tones, day = P.day;
  const R = q => { const e = document.querySelector(q); return e ? e.getBoundingClientRect() : null; };
  const fr = R('.frame'), tg = R('.tag'), hb = R('h1'), lg = R('.logos');
  const marks = [...document.querySelectorAll('h1 mark')].flatMap(m => [...m.getClientRects()]);
  const h1B = Math.max(hb.bottom, ...marks.map(r => r.bottom));
  const FL = fr.left, FR = fr.right, FT = fr.top, FB = Math.max(fr.bottom, lg && lg.height ? lg.bottom : 0), fh = FB - FT, fw = FR - FL;
  const FBs = FB + (tall ? 16 : 10), FRs = FR + (tall ? 12 : 8);   // the proof's hard shadow
  const tagB = tg ? tg.bottom : FT;                                 // the tag sits on the proof's top-left corner
  const f = n => (+n).toFixed(1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  let seed = {mon: 11, wed: 23, fri: 37}[day] + (tall ? 0 : 100);
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const u = tall ? 1 : .62;
  const hx = (a, b, t) => '#' + [1, 3, 5].map(k => Math.round(parseInt(a.substr(k, 2), 16) * (1 - t) + parseInt(b.substr(k, 2), 16) * t).toString(16).padStart(2, '0')).join('');
  const rimC = c => hx(P.cream, c, .5);   // the paper's fibre a tear shows: cream mixed half into the layer's colour
  const MG = tall ? 12 : 8;               // the keep-out round the tag, pill, wordmark and logos (3 px beside the words)

  // ---- paper filters: a soft shadow cast on the card behind, and the grain of the card ----
  const sh = (id, dx, dy, blur, op) => `<filter id="${id}" x="-20%" y="-30%" width="140%" height="160%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}"/><feOffset dx="${dx}" dy="${dy}" result="o"/>
    <feFlood flood-color="${P.shadow}" flood-opacity="${op}"/><feComposite in2="o" operator="in" result="s"/>
    <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="4" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0" result="g"/>
    <feComponentTransfer in="g" result="g2"><feFuncR type="linear" slope=".22" intercept=".86"/><feFuncG type="linear" slope=".22" intercept=".86"/><feFuncB type="linear" slope=".22" intercept=".86"/></feComponentTransfer>
    <feBlend in="SourceGraphic" in2="g2" mode="multiply" result="p"/><feComposite in="p" in2="SourceAlpha" operator="in" result="pp"/>
    <feMerge><feMergeNode in="s"/><feMergeNode in="pp"/></feMerge></filter>`;
  const SD = tall ? 10 : 6, SB = tall ? 10 : 6;
  const defs = sh('pcUp', 0, -SD, SB, .30) + sh('pcDn', 0, SD, SB, .30) + sh('pcObj', SD * .45, SD, SB * .8, .34)
             + sh('pcL', -4 * u, 2, 3.5 * u, .28) + sh('pcR', 4 * u, 2, 3.5 * u, .28)
             + sh('pcGL', SD * .55, -SD * .8, SB * .9, .30) + sh('pcGR', -SD * .55, -SD * .8, SB * .9, .30);

  const line = pts => pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ',' + f(p[1])).join('');

  const N = 5, NW = N + 12, X0 = -60, X1 = W + 60, BOT = H + 140;
  const waves = [...Array(NW)].map(() => [[rnd() * 6.28, .7 + rnd() * .6], [rnd() * 6.28, 1.6 + rnd() * .9], [rnd() * 6.28, 3.1 + rnd() * 1.2]]);
  const wave = (w, x, A) => A * (Math.sin(6.283 * w[0][1] * x / W + w[0][0]) * .62 + Math.sin(6.283 * w[1][1] * x / W + w[1][0]) * .28 + Math.sin(6.283 * w[2][1] * x / W + w[2][0]) * .1);
  const minTop = h1B + (tall ? 40 : 56);                    // nothing climbs nearer the words than this

  // ---- torn card: a deckled edge with the paper's fibre showing along the tear ----
  const JAG = tall ? 5.5 : 3.4, SP = tall ? 5 : 3.5;
  const rimW = (s, i) => (tall ? 2.5 : 1.6) + (tall ? 9 : 5.5) * Math.max(0, Math.sin(s / 47 + i * 1.7) * .6 + Math.sin(s / 131 + i * 2.9) * .55);
  // pts: [[x, y, s], ...] along the edge (s drives the wobble); out: the side away from the sheet's body.
  // Returns the torn edge and its fibre line (the edge pushed out by the rim's width).
  const jag = (pts, out, i, rimK = 1) => {
    const top = [], rim = [];
    pts.forEach(([x, y, s], k) => {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
      let nx = b[1] - a[1], ny = a[0] - b[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const o = typeof out === 'function' ? out(x, y) : out;
      if (nx * o[0] + ny * o[1] < 0) { nx = -nx; ny = -ny; }
      const j = wave(waves[(i + 2) % NW], s * 7, JAG * .5) + (rnd() - .5) * JAG, rw = (rimW(s, i) + rnd() * JAG * .7) * (typeof rimK === 'function' ? rimK(x, y) : rimK);
      top.push([x + nx * j, y + ny * j]); rim.push([x + nx * (j + rw), y + ny * (j + rw)]);
    });
    return [top, rim];
  };
  // close: the body's far side
  const torn = (pts, out, close, fill, i, rimK = 1) => {
    const [top, rim] = jag(pts, out, i, rimK);
    return (rimK ? `<path d="${line([...rim, ...close])}Z" fill="${rimC(fill)}"/>` : '') + `<path d="${line([...top, ...close])}Z" fill="${fill}"/>`;
  };
  const xs = (a, b, st = SP) => { const v = []; for (let x = a; x <= b + .01; x += st) v.push(x); return v; };
  const sheetUp = (e, i, fill, rimK = 1) => `<g filter="url(#pcUp)">${torn(xs(X0, X1).map(x => [x, e(x), x]), [0, -1], [[X1, BOT], [X0, BOT]], fill, i, rimK)}</g>`;
  const sheetDn = (e, i, fill) => `<g filter="url(#pcDn)">${torn(xs(X0, X1).map(x => [x, e(x), x]), [0, 1], [[X1, -80], [X0, -80]], fill, i)}</g>`;
  const stripV = (sx, side, i, fill, y0, y1) => {
    const pts = xs(y0, y1).map(y => [sx(y), y, y + 400 * i]);
    const far = side < 0 ? -80 : W + 80;
    return `<g filter="url(#${side < 0 ? 'pcR' : 'pcL'})">${torn(pts, [-side, 0], [[far, y1], [far, y0]], fill, i, .7)}</g>`;
  };
  // half a sheet, torn along its top and torn off at xg: 'L' keeps the part left of xg, 'R' the part right of it
  const halfSheet = (e, i, fill, side, xg) => {
    const L = side === 'L', yt = e(xg);
    const [tJ, tR] = jag((L ? xs(X0, xg) : xs(xg, X1)).map(x => [x, e(x), x]), [0, -1], i);
    const [eJ, eR] = jag(xs(yt, BOT, SP).map(y => [xg + (L ? -1 : 1) * (y - yt) * .05, y, y * 1.3 + 700 + 60 * i]), [L ? 1 : -1, 0], i + 5);
    const far = [[L ? X0 : X1, BOT]];
    const pf = L ? [...tJ, ...eJ, ...far] : [...eJ.reverse(), ...tJ, ...far], pr = L ? [...tR, ...eR, ...far] : [...eR.reverse(), ...tR, ...far];
    return `<g filter="url(#${L ? 'pcGL' : 'pcGR'})"><path d="${line(pr)}Z" fill="${rimC(fill)}"/><path d="${line(pf)}Z" fill="${fill}"/></g>`;
  };

  const parts = [];   // {z, bbox: [x0, y0, x1, y1], svg}
  const add = (z, bbox, svg) => parts.push({z, bbox, svg});

  // ---- the slot for the metaphor object, the same for all three series ----
  // tall: in the tag's row, inside the safe box and the 3:4 grid crop: the floor runs 10 px over the proof's top edge,
  //       turned with the proof; the right end stands on the proof's right edge; the top keeps 14 px past the
  //       headline's keep-out (28 px beside it). wide: under the words, the left end on the headline's left edge, the floor 18 px over
  //       the bottom edge, the right end clear of YouTube's length badge.
  let slot;
  {
    const kb = ['.wmp', '.logos', '.pill', '.tag'].flatMap(q => [...document.querySelectorAll(q)]).map(e => e.getBoundingClientRect())
      .filter(r => r.width > 0 && r.height > 0).map(r => [r.left - MG, r.top - MG, r.right + MG, r.bottom + MG])
      .concat([hb, ...marks].filter(r => r.width > 0 && r.height > 0).map(r => [r.left - 3, r.top - MG, r.right + 3, r.bottom + MG]));
    if (tall) {
      const fe = document.querySelector('.frame'), pe = document.querySelector('.pin');
      const mm = (getComputedStyle(pe).transform.match(/matrix\(([^)]+)\)/) || [0, '1,0,0,1,0,0'])[1].split(',').map(Number);
      const a = Math.atan2(mm[1], mm[0]), ca = Math.cos(a), sa = Math.sin(a);
      const cx = (fr.left + fr.right) / 2, cy = (fr.top + fr.bottom) / 2, hw = fe.offsetWidth / 2, hh = fe.offsetHeight / 2;
      const TR = [cx + hw * ca + hh * sa, cy + hw * sa - hh * ca], lift = 10;
      const A = [TR[0] + lift * sa, TR[1] - lift * ca];                       // the floor's right end
      const wMax = (A[0] - ((tg ? tg.right : FL) + MG + 40)) / ca;
      const roof = x => Math.max(0, ...kb.filter(k => k[1] < A[1] - 20 && k[0] - 28 < x && k[2] + 28 > x).map(k => k[3] + 14));
      let hMax = 1e9;
      for (let t = 0; t <= wMax; t += 6) { const px = A[0] - t * ca, py = A[1] - t * sa; hMax = Math.min(hMax, (py - roof(px)) / ca); }
      // the room over the floor at local x for an object of width w (its right end on A)
      const room = (lx, w) => { const px = A[0] - (w - lx) * ca, py = A[1] - (w - lx) * sa; return (py - roof(px)) / ca; };
      slot = {a, ca, sa, wMax, hMax, room, at: w => [A[0] - w * ca, A[1] - w * sa]};
    } else {
      let x0 = hb.left, floor = H - 18, xr = GEO.badge ? GEO.badge[0] - 18 : W - 40;   // the length badge starts at x 968; the shadow needs 12 px
      let top = Math.max(h1B + 88, ...kb.filter(k => k[0] < xr && k[2] > x0 && k[1] < floor).map(k => k[3] + 60));
      if (!GEO.thumb) {
        // A cover's words run down a column to the foot: the band under the proof, left of the column, when it is the
        // larger room.
        const colL = Math.min(...kb.map(k => k[0]).filter(x => x > FL)), u0 = Math.max(40, FL), ur = colL - 40, ut = FBs + 40;
        if (floor - ut > floor - top && ur - u0 > 200) { x0 = u0; xr = ur; top = ut; }
      }
      slot = {a: 0, ca: 1, sa: 0, wMax: xr - x0, hMax: floor - top, room: () => floor - top, at: () => [x0, floor]};
    }
  }

  // ---- the stack: sheets climbing both gutters beside the proof, palest at the back, the series colour in front ----
  // The tag sits on the proof's top-left corner; the stack starts far enough under it that no tear, fibre or shadow
  // reaches the tag's keep-out, so the keep-out's border never cuts a tear.
  let stackEdge;
  if (tall) {
    const g = x => Math.min(1.2, Math.pow(2 * x / W - 1, 2));
    const y0 = Math.max(FT - 80, tagB + MG + 82), y4 = FB - 46, dr = [14, 20, 22, 22, 12];
    const Ls = [0, 1, 2, 3, 4].map(i => lerp(y0, y4, i / 4));
    const C = [FT + 150, FT + 290, FT + 430, FB - 30, FBs + 45], amp = [14, 14, 13, 12, 10];
    stackEdge = (i, x) => { const side = lerp(Ls[i], Ls[i] - dr[i], clamp(x / W, 0, 1));
      return C[i] + (side - C[i]) * g(x) + wave(waves[i], x, amp[i]); };
  } else {
    // left of the proof the sheets climb to well under the tag; under the words only the palest and the front show
    const y0 = tagB + MG + 52, y4 = FB - 14;
    const Lh = [0, 1, 2, 3, 4].map(i => lerp(y0, y4, i / 4));
    const Rh = [minTop + 16, minTop + 110, minTop + 120, minTop + 114, minTop + 30];
    const ka = FL + .3 * fw, kb = FR - 20, amp = [10, 10, 10, 9, 7];
    stackEdge = (i, x) => { const t = sstep(ka, kb, x), y = Rh[i] + (Lh[i] - Rh[i]) * (1 - t) + wave(waves[i], x, amp[i] * (x > FR ? .6 : 1));
      return x > FR - 30 ? Math.max(minTop + 16, y) : y; };   // the torn rim then stays 50 px clear of the mark's shadow
  }

  for (let i = 0; i < N; i++) {
    const e = x => stackEdge(i, x);
    let mn = 1e9; for (let x = X0; x <= X1; x += 20) mn = Math.min(mn, e(x));
    add(10 + i * 10, [X0, mn - 40, X1, H], sheetUp(e, i, T[i]));
  }

  // ---- the stage: a torn valance hanging from the top, torn strips down the outer gutters ----
  {
    const kTop = Math.min(...['.wmp', '.pill'].map(q => R(q)).filter(Boolean).map(r => r.top));
    const vy = tall ? [kTop - 92, kTop - 150] : [kTop - 30, kTop - 37];   // rear (deeper) hangs lower, front shorter
    const vamp = tall ? [16, 14] : [3.5, 3];
    [[0, T[3]], [1, T[2]]].forEach(([k, fill]) => {
      const e = x => vy[k] + wave(waves[N + k], x, vamp[k]);
      add(80 + k * 2, [X0, -80, X1, vy[k] + 60], sheetDn(e, N + k, fill));
    });
    const y0 = tall ? 40 : 4;
    [[-1, tall ? FT + 200 : tagB + 80], [1, tall ? FT + 200 : minTop + 70]].forEach(([side, y1]) => {
      const base = tall ? 30 : 22, a1 = tall ? 5 : 3.5, a2 = tall ? 3 : 2;
      const wd = y => base + a1 * Math.sin(y / 97 + (side < 0 ? 0 : 2.1)) + a2 * Math.sin(y / 37 + (side < 0 ? 1.3 : .4));
      const sx = y => side < 0 ? wd(y) : W - wd(y);
      add(5, side < 0 ? [-80, 0, 70, y1] : [W - 70, 0, W + 80, y1], stripV(sx, side, N + 3 + (side > 0 ? 1 : 0), T[1], y0, y1));
    });
  }

  // a cut-paper part: its fibre (rimC) shows as a thin rim along the upper-left edge, under the sheet's grain
  const rimOff = tall ? [-2.2, -2.6] : [-1.5, -1.8];
  const cutPart = (d, fill, extra = '') => `<path d="${d}" fill="${rimC(fill)}" fill-rule="evenodd" transform="translate(${rimOff[0]} ${rimOff[1]})"/>` +
                                         `<path d="${d}" fill="${fill}" fill-rule="evenodd"${extra}/>`;

  // Every object is drawn in its own frame: x from 0 to w along the floor, y up from the floor (y = 0) to -h.
  const put = ({w, h, svg}) => {
    const [ox, oy] = slot.at(w), deg = slot.a * 180 / Math.PI, pad = 34;
    const cs = [[-pad, pad], [w + pad, pad], [w + pad, -h - pad], [-pad, -h - pad]].map(([x, y]) => [ox + x * slot.ca - y * slot.sa, oy + x * slot.sa + y * slot.ca]);
    add(260, [Math.min(...cs.map(c => c[0])), Math.min(...cs.map(c => c[1])), Math.max(...cs.map(c => c[0])), Math.max(...cs.map(c => c[1]))],
        `<g transform="translate(${f(ox)} ${f(oy)}) rotate(${deg.toFixed(3)})">${svg}</g>`);
  };

  // Each object is drawn at a size k and reports its top profile [[x, height], ...]; the largest k whose width fits
  // the slot and whose profile stays under the room everywhere is drawn, so the tallest part stands where there is room.
  const fit = dev => {
    for (let k = 3; k > .15; k *= .99) { const d = dev(k);
      if (d.w <= slot.wMax && d.prof.every(([x, ht]) => ht <= slot.room(x, d.w))) return GEO.thumb || d.h >= 64 ? d : null; }
    return GEO.thumb ? dev(.15) : null;
  };
  const arc = (x0, x1, fn, st = 4) => { const v = []; for (let x = x0; x <= x1 + .01; x += st) v.push([x, fn(x)]); return v; };

  // ---- follow.the.money: three stacks of paper coins, one, two and four: each stack twice the one before it ----
  const coinStacks = k => {
    // tall: thinner coins with broad faces, spread across the band; wide: chunkier coins, close, to fill its height
    const rx = 40 * k, ry = rx * .29, th = rx * (tall ? .36 : .5), gs = tall ? 44 : 9, sl = tall ? 16 : 10, kw = tall ? 2.4 : 2.2;
    const face = hx(P.cream, P.col, .55), ring = hx(P.cream, P.col, .92), band = T[2];
    const coin = (x, y) => {
      const sil = `M${f(x - rx)},${f(y)}A${f(rx)},${f(ry)} 0 0 1 ${f(x + rx)},${f(y)}L${f(x + rx)},${f(y + th)}A${f(rx)},${f(ry)} 0 0 1 ${f(x - rx)},${f(y + th)}Z`;
      const side = `M${f(x - rx)},${f(y)}A${f(rx)},${f(ry)} 0 0 0 ${f(x + rx)},${f(y)}L${f(x + rx)},${f(y + th)}A${f(rx)},${f(ry)} 0 0 1 ${f(x - rx)},${f(y + th)}Z`;
      const ell = (k1, ox = 0, oy = 0) => `M${f(x + ox - rx * k1)},${f(y + oy)}A${f(rx * k1)},${f(ry * k1)} 0 1 0 ${f(x + ox + rx * k1)},${f(y + oy)}A${f(rx * k1)},${f(ry * k1)} 0 1 0 ${f(x + ox - rx * k1)},${f(y + oy)}Z`;
      const ribs = [...Array(tall ? 11 : 9)].map((_, q, a) => { const t = Math.PI * (q + .5) / a.length, px = x - rx * Math.cos(t), py = y + ry * Math.sin(t);
        return `M${f(px)},${f(py + th * .24)}L${f(px)},${f(py + th * .76)}`; }).join('');
      return `<g filter="url(#pcObj)">` +
        `<path d="${sil}" fill="${rimC(P.deep)}" stroke="${rimC(P.deep)}" stroke-width="${f(kw * 2)}" transform="translate(${f(rimOff[0] * 1.5)} ${f(rimOff[1] * 1.5)})"/>` +   // the cream fibre, upper left
        `<path d="${sil}" fill="${P.deep}" stroke="${P.deep}" stroke-width="${f(kw * 2)}" stroke-linejoin="round"/>` +   // the deep keyline, half outside
        `<path d="${side}" fill="${band}"/>` +
        `<path d="${ribs}" stroke="${P.deep}" stroke-width="${f(tall ? 3 : 2.6)}" stroke-linecap="round" fill="none"/>` +   // the reeding, deep
        `<path d="${ell(1)}" fill="${rimC(face)}"/>` + `<path d="${ell(.985, 1.6 * u, 1.4 * u)}" fill="${face}"/>` +     // the face's fibre, upper left
        `<path d="${ell(.86)}${ell(.72)}" fill="${ring}" fill-rule="evenodd"/>` +
        `<path d="M${f(x - rx)},${f(y)}A${f(rx)},${f(ry)} 0 0 0 ${f(x + rx)},${f(y)}" stroke="${P.deep}" stroke-width="${f(kw * .9)}" fill="none"/>` +   // the face's lower lip
        `</g>`;
    };
    const offs = [0, -.08, .06, -.05];
    let svg = '', prof = [];
    [1, 2, 4].forEach((n, j) => {
      const sx = sl / 2 + rx + j * (2 * rx + gs), R = rx + kw + 4;
      for (let q = 0; q < n; q++) svg += coin(sx + offs[q] * rx * (j % 2 ? -1 : 1), -th - ry - q * th);
      prof = prof.concat(arc(sx - R, sx + R, x => n * th + ry + ry * Math.sqrt(Math.max(0, 1 - ((x - sx) / R) ** 2)) + kw + 4));
    });
    return {w: 6 * rx + 2 * gs + sl, h: 4 * th + 2 * ry, svg, prof};
  };

  // ---- under.the.hood: an exploded cog: the parts slid apart along their axis, each casting its own shadow ----
  // The gear stands at the right end; the washer, the pinion and (on the tall) the hex nut have slid off to the left.
  // The axis shows only in the gaps between the parts and never through a hole, so the parts read as slid apart.
  const cogRow = k => {
    // [radius, teeth (count, depth) or a hex nut, hole, tone], from the gear outward
    const L0 = tall ? [[84, [12, .085], 30, T[3]], [68, null, 33, T[1]], [70, [9, .14], 20, T[2]], [44, 'hex', 17, T[3]]]
                    : [[84, [12, .085], 30, T[3]], [66, null, 32, T[1]], [62, [9, .14], 18, T[2]]];
    const out = ([r, t]) => r * (Array.isArray(t) ? 1 + t[1] : 1), g = tall ? 30 : 9, sl = 8;
    const L = L0.map(([r, t, hr, c]) => [r * k * .55, t, hr * k * .55, c]);
    const cy = -out(L[0]) - 2, D = [];
    let d = sl / 2 + out(L[0]);
    L.forEach((q, j) => { if (j) d += out(L[j - 1]) + g + out(q); D.push(d); });
    const w = D[D.length - 1] + out(L[L.length - 1]) + sl / 2, X = D.map(v => w - v);   // the gear on the right
    const ringP = (x, y, rr, teeth, rot) => { const pts = [], n = 360;
      for (let q = 0; q <= n; q++) { const a = q / n * 6.2832 + rot; let r = rr;
        if (Array.isArray(teeth)) r = rr * (1 + teeth[1] * clamp(Math.sin(a * teeth[0]) * 3.2, -1, 1));
        if (teeth === 'hex') { const s6 = Math.PI / 3, a6 = ((a % s6) + s6) % s6 - s6 / 2; r = rr * Math.cos(Math.PI / 6) / Math.cos(a6); }
        pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
      return line(pts) + 'Z'; };
    const hole = (x, y, rr) => `M${f(x + rr)},${f(y)}A${f(rr)},${f(rr)} 0 1 1 ${f(x - rr)},${f(y)}A${f(rr)},${f(rr)} 0 1 1 ${f(x + rr)},${f(y)}Z`;
    const aw = tall ? 4.5 : 4;
    let svg = '', prof = [];
    for (let j = 0; j + 1 < L.length; j++) {   // the axis, gap by gap, its ends hidden under the parts' bodies
      const xa = X[j + 1] + L[j + 1][0] * .8, xb = X[j] - L[j][0] * .8;
      svg += `<path d="M${f(xa)},${f(cy - aw)}H${f(xb)}V${f(cy + aw)}H${f(xa)}Z" fill="${P.deep}"/>`;
    }
    L.forEach(([r, teeth, hr, c], j) => {
      svg += `<g filter="url(#pcObj)">${cutPart(ringP(X[j], cy, r, teeth, .1 + j * .35) + hole(X[j], cy, hr), c)}</g>`;
      const R = out(L[j]) + 3; prof = prof.concat(arc(X[j] - R, X[j] + R, x => -cy + Math.sqrt(Math.max(0, R * R - (x - X[j]) ** 2))));
    });
    return {w, h: -cy + out(L[0]), svg, prof};
  };

  // ---- mind.the.gap: the gap itself: two ends of one torn sheet of layered card, pulled apart, and a cream strip
  //      pushed out from the far side over the gap, reaching across but not there yet ----
  // Each end is a little stack of three torn layers, like the stage's own stack: the back layer tallest and palest, the
  // front layer lowest and deepest. The layers' inner ends are one tear line on both sides, so they read as one sheet
  // torn in two; the gap between them stays open to the floor.
  const gapPiece = k => {
    const h = 90 * k, w = h * (tall ? 4.4 : 2.6);
    const pt = h * .24, lh = h - pt - (tall ? 5 : 4);                // the strip's thickness; the back layers' height
    const gW = Math.max(64, w * .30), lw = (w - gW) / 2, gL = lw, gR = lw + gW;
    const tones = [T[3], P.cut, hx(P.cut, P.shadow, .45)];          // back to front: the stack's deepest card, the deep tone, deeper
    const tops = [lh, lh * .70, lh * .40];                             // back, middle, front
    const tear = (y, j) => .10 * (lh + y) + u * (4.5 * Math.sin(-y / 7.3 + 1 + j * 1.9) + 2.6 * Math.sin(-y / 3.1 + 2 + j) + 1.4 * Math.sin(-y / 1.6 + j));
    const fib = (y, i) => (tall ? 1.8 : 1.3) + (tall ? 4 : 2.8) * Math.max(0, Math.sin(-y / 9 + i * 2.2));
    const ys = (a, b) => xs(Math.min(a, b), Math.max(a, b), SP * .6);
    const px0 = gR - gW * .6, px1 = gR + lw * .55;
    const layer = (left, j) => {
      const xo = left ? 0 : w, sgn = left ? 1 : -1, th = tops[j], i = j * 2 + (left ? 0 : 1);
      const step = j * (tall ? 7 : 5);                                 // each layer in front stops a little nearer the gap
      const inner = ys(-th, 0).map(y => [(left ? gL : gR) + tear(y, j) + sgn * (step - 6), y]);   // top to floor
      const xiT = inner[0][0];
      const topPts = xs(Math.min(xo, xiT), Math.max(xo, xiT)).map(x => [x, -th + 1.2 * Math.sin(x / 21 + i), x * 1.3 + 50 * i]);
      if (!left) topPts.reverse();                                    // always from the outer end to the gap
      const outer = ys(-th, 0).reverse().map(y => [xo + sgn * 1.5 * Math.sin(-y / 8), y, y * 1.7 + 90 * i]);   // floor to top
      const [oJ] = jag(outer, [-sgn, 0], i + 20, 0);
      const [tJ, tR] = jag(topPts, [0, -1], i + 22, .24);
      if (!left && j === 0) tJ.forEach((q, n) => { if (q[0] >= gR - 4 && q[0] <= px1 + 6) { q[1] = -th - .5 + .6 * Math.sin(q[0] / 5); tR[n][1] = q[1]; } });   // level, and no fibre, where the strip lies
      const iR = inner.map(([x, y]) => [x + sgn * fib(y, i), y]);
      const fl = [[inner[inner.length - 1][0], 0], [xo, 0]];
      const body = [...oJ, ...tJ, ...inner, ...fl], rim = [...oJ, ...tR, ...iR, ...fl];
      return `<g filter="url(#pcObj)"><path d="${line(rim)}Z" fill="${rimC(tones[j])}"/><path d="${line(body)}Z" fill="${tones[j]}"/></g>`;
    };
    let svg = '';
    for (let j = 0; j < 3; j++) svg += layer(true, j) + layer(false, j);
    // the strip lies on the far side's back layer and reaches out over the gap past halfway
    const rest = lh + .8, y1 = -rest, y0 = y1 - pt;
    const [lJ] = jag(xs(y0, y1).reverse().map(y => [px0, y, y * 3 + 500]), [-1, 0], 30, 0);
    const [rJ] = jag(xs(y0, y1).map(y => [px1, y, y * 3 + 700]), [1, 0], 31, 0);
    const strip = line([...lJ, [px0 + 2, y0], [px1 - 2, y0], ...rJ, [px1 - 2, y1], [px0 + 2, y1]]) + 'Z';
    svg += `<g filter="url(#pcObj)"><path d="${strip}" fill="${P.col}" transform="translate(${f(rimOff[0] * 1.2)} ${f(rimOff[1] * 1.2)})"/><path d="${strip}" fill="${P.cream}"/></g>`;
    const top = lh + JAG + (tall ? 7 : 5);
    const prof = arc(0, gL + 12, () => top).concat(arc(gR - 12, w, () => top)).concat(arc(px0 - 4, px1 + 4, () => rest + pt + 4));
    return {w, h: rest + pt, svg, prof};
  };

  const obj = fit({mon: coinStacks, wed: cogRow, fri: gapPiece}[day]);
  if (obj) put(obj);
  parts.sort((a, b) => a.z - b.z);

  // ---- tiles: the scene seen through rectangles that keep clear of every kept part ----
  const box = (r, mx, my) => [Math.floor(r.left - mx), Math.floor(r.top - my), Math.ceil(r.right + mx), Math.ceil(r.bottom + my)];
  const kept = ['.wmp', '.logos', '.pill', '.tag'].flatMap(q => [...document.querySelectorAll(q)]).map(e => e.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0).map(r => box(r, MG, MG))
    .concat([hb, ...marks].filter(r => r.width > 0 && r.height > 0).map(r => box(r, 3, MG)));
  const cl = v => clamp(v, 0, W), ch = v => clamp(v, 0, H);
  const xb = [...new Set([0, W, ...kept.flatMap(k => [cl(k[0]), cl(k[2])])])].sort((a, b) => a - b);
  const yb = [...new Set([0, H, ...kept.flatMap(k => [ch(k[1]), ch(k[3])])])].sort((a, b) => a - b);
  const free = (x0, y0, x1, y1) => !kept.some(k => x0 < k[2] && x1 > k[0] && y0 < k[3] && y1 > k[1]);
  const tiles = [];
  for (let j = 0; j < yb.length - 1; j++) {
    const spans = []; let s = null;
    for (let i = 0; i < xb.length - 1; i++) {
      if (free(xb[i], yb[j], xb[i + 1], yb[j + 1])) { if (s) s[1] = xb[i + 1]; else s = [xb[i], xb[i + 1]]; }
      else if (s) { spans.push(s); s = null; }
    }
    if (s) spans.push(s);
    for (const sp of spans) {
      const t = [sp[0], yb[j], sp[1], yb[j + 1]];
      const up = tiles.find(v => v[0] === t[0] && v[2] === t[2] && Math.abs(v[3] - t[1]) < .01);
      if (up) up[3] = t[3]; else tiles.push(t);
    }
  }
  const dsvg = document.createElementNS(NS, 'svg');
  dsvg.setAttribute('class', 'deco'); dsvg.setAttribute('width', '0'); dsvg.setAttribute('height', '0');
  dsvg.style.left = '0px'; dsvg.style.top = '0px'; dsvg.innerHTML = `<defs>${defs}</defs>`;
  card.insertBefore(dsvg, safe);
  for (const [x0, y0, x1, y1] of tiles) {
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    const body = parts.filter(p => p.bbox[0] < x1 && p.bbox[2] > x0 && p.bbox[1] < y1 && p.bbox[3] > y0).map(p => p.svg).join('');
    if (!body) continue;
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'deco');
    s.setAttribute('width', f(x1 - x0)); s.setAttribute('height', f(y1 - y0));
    s.setAttribute('viewBox', `${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}`);
    s.style.left = f(x0) + 'px'; s.style.top = f(y0) + 'px';
    s.innerHTML = body;
    card.insertBefore(s, safe);
  }
}"""
