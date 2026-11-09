"""Sunburst (series skin "sunburst", concept c06): a game-show title card in the series colour.

One family on Mon, Wed and Fri, each in its own colour:
- the ground is the series colour, the picked hex on every show; rays burst from the ringed number on the proof (the
  frame's centre when there is no ring), the way a TV title card bursts from behind the prize, turned with the pin's
  tilt, so every ray points at the number the cover is about;
- the burst is one field coming out from behind the proof, printed flat: hard-edged rays, no feather, no
  vignette, the house grain on top. The words sit on one calm piece of the plain ground with straight edges, run
  off the card's top edge, and every edge of it the eye sees is one of the frame's own edges carried on: on the
  tall shape everything above the frame's top edge, that edge carried across the card (so the top of the card,
  under the platform's bar and outside Instagram's 3:4 grid crop, is plain ground and the rays come out from
  behind the proof); on the wide shape the right of the card down to the highlight's slap shadow, its left edge the
  frame's right edge carried up to the card's top (so the pill sits on the calm and down the proof the edge runs
  inside the frame), its bottom edge turned with the pin, parallel to the frame's top and bottom edges, touching
  the bottom of the slap shadow at its lowest corner. The ink plates (wordmark, pill, tag) and YouTube's
  length-badge corner sit on the rays: solid ink reads on anything;
- any scrap a cut leaves is cleared back to the ground: a visible piece of ray under 900 px square or under 16 px
  thick, a needle (a ray a cut ran along, tapering into the ground past the last radius where it shows 85% of its
  width for more than 1.25 times that width; a taper toward the centre is a ray coming out from behind the proof
  and is kept), a stub (under 60 px long along the ray, 100 px on Wednesday, whose ring cuts every ray into
  pieces), and on Wednesday a chip: a piece the ring and the calm both cut that is under 2.5 times its width long,
  or a piece the ring and the card's edge both cut that shows less than its width of length on the card. The
  finder sees the burst 160 px past the card's edges, so a ray that runs off the card is never taken for a scrap;
- the ground between the rays is the series colour itself, the same colour as the calm, so the calm never glows;
  the contrast is in the lit ray only, a lighter tint of the same hue (OKLCH): about 1.4:1 to the ground on
  Friday and 1.5:1 on Wednesday, whose lilac needs the extra step to punch as hard at phone size. Butter cannot be
  lit 1.4:1 above itself (white on #FFD84D is 1.38), so Monday's ray is a warm white at 1.36:1 and Monday's grain
  is lighter, so the ground reads butter, the #FFD84D of the pill's words beside it, not mustard;
- one rhythm for the family, 16 rays round the circle, about 11.25 degrees of lit ray in each 22.5 degree slot,
  each show its own cut:
  follow.the.money: the rays come in three gauges, 22, 6, 14 and 6 degrees round the circle, the width is the
  amount (the money map);
  under.the.hood: the even burst broken by one concentric ring of ground round the ringed number (460 px out and
  40 px wide on the tall shape, 400 and 26 on the wide), so the burst comes apart in two, the product taken
  apart: every cut is an arc at right angles to the rays, no notches and no chips;
  mind.the.gap: every ray is split down its centre by one line of ground of constant width (14 px on the tall
  shape, 16 on the wide: 4.6 px at a 358 px phone column), so the gap reads as a gap all the way out from behind
  the frame; each ray is 13 degrees, so the lit ray per slot is about 11.25 degrees where the rays show;
- the proof stands on the burst with a hard ink shadow; the highlight is cream with ink words and the old house
  slap shadow (a 7 px hard ink offset, cast by the highlight as one shape so its steps are clean); the tag and
  the pill are the colour on ink; the wordmark plate is untouched.
The rays are painted into the ground itself (no element). PLACE_JS records in <html data-rays-behind> the share
of each word plate's box that has a lit ray behind it (the headline is 0 by construction; the ink plates may not be),
the calm's polygon in data-calm (drawn 160 px past the card's edges) and, on the wide shape, its bottom edge in
data-calm-edge, the scraps it cleared in data-scraps, Wednesday's ring in data-ring, Friday's split in data-split
and the laid-out boxes in data-boxes.
"""

GRAIN = ("<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'>"
         "<feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .05  0 0 0 0 .08  0 0 0 0 .07  0 0 0 1.6 -.55'/></filter>"
         "<rect width='260' height='260' filter='url(#n)' opacity='.16'/></svg>")

# The ground between the rays and the lit ray, per show. The ground is the series colour itself on every show, the
# picked hex; the lit ray is the same OKLCH hue lifted until it stands about 1.4:1 (WCAG luminance) above it,
# Wednesday's lilac one step more (1.53:1). Butter cannot be lit 1.4:1 above itself (white on #FFD84D is 1.38), so
# Monday's ray is a warm white at 1.36:1, and Monday's grain is lighter (GRAIN_OPACITY) so the ground reads butter, the
# same #FFD84D as the pill's words, and not mustard.
GROUND = {}
RAY = {'mon': '#FFFDF5', 'wed': '#DDD6FF', 'fri': '#FF9D88'}
GRAIN_OPACITY = {'mon': .07}
SLAP = 7          # the highlight's hard ink offset, px
RING = {'tall': 460, 'wide': 400}   # Wednesday's ring gap: its radius, px out from the ringed number


def skin(html, facts, shape, look, kit):
    if not look.get('series'):
        return html
    col, ink, cream = look['colour'], kit.INK, kit.CREAM
    ground = GROUND.get(kit.day, col)
    ray = RAY.get(kit.day, kit.mix(col, '#FFFFFF', .35))
    grain = GRAIN.replace("opacity='.16'", f"opacity='{GRAIN_OPACITY.get(kit.day, .16)}'")
    grain = grain.replace('<', '%3C').replace('>', '%3E').replace('#', '%23').replace("'", '%27')
    none = 'linear-gradient(transparent, transparent)'
    css = f"""
:root {{ --col: {col}; --ground: {ground}; --ray: {ray}; --motif: {kit.day}; --slap: {SLAP}; }}
body {{ background: {ground}; }}
#card {{ background:
   url("data:image/svg+xml,{grain}") 0 0 / 260px 260px repeat,
   var(--rays, {none}) 0 0 / 100% 100% no-repeat,
   {ground} !important; }}
h1 {{ color: {ink}; }}
h1 mark {{ background: {cream}; color: {ink}; filter: drop-shadow({SLAP}px {SLAP}px 0 {ink}); }}
.pill {{ background: {ink}; color: {col}; }}
.tag {{ background: {ink}; color: {col}; }}
.frame {{ box-shadow: calc(var(--edge) * 1.5) calc(var(--edge) * 1.8) 0 {ink}; }}
"""
    return html.replace('</style>', css + '</style>', 1)


PLACE_JS = r"""([shape]) => {
  const RING_TALL = __RING_TALL__, RING_WIDE = __RING_WIDE__;
  const card = document.querySelector('#card');
  const W = card.clientWidth, H = card.clientHeight, tall = shape !== 'wide';
  const cr = card.getBoundingClientRect();
  const css = getComputedStyle(document.documentElement);
  const v = k => css.getPropertyValue(k).trim();
  const ray = v('--ray'), ground = v('--ground'), day = v('--motif'), slap = parseFloat(v('--slap'));
  // Every box in card coordinates.
  const B = r => ({left: r.left - cr.left, right: r.right - cr.left, top: r.top - cr.top, bottom: r.bottom - cr.top});
  const R = q => { const e = document.querySelector(q); return e ? B(e.getBoundingClientRect()) : null; };
  const h1 = R('h1'), fr = R('.frame'), ring = R('.ring'), wmp = R('.wmp'), pill = R('.pill'), tag = R('.tag'), logos = R('.logos');
  // The highlight's own boxes (its background overflows the h1's line boxes), and the slap shadow under them.
  const marks = [...document.querySelectorAll('h1 mark')].flatMap(m => [...m.getClientRects()].map(B));
  const wordsBottom = Math.max(h1.bottom, ...marks.map(m => m.bottom + slap));

  // The pin's turn, and the frame's corners (a turned box's bounding box keeps its centre).
  const tilt = -2.5, rad = d => (d + tilt) * Math.PI / 180;
  const fe = document.querySelector('.frame'), edge = parseFloat(getComputedStyle(fe).borderTopWidth);
  const quad = (b, w, h, dx = 0, dy = 0) => { const mx = (b.left + b.right) / 2, my = (b.top + b.bottom) / 2, t = tilt * Math.PI / 180;
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [x + dx, y + dy])
      .map(([x, y]) => [mx + x * Math.cos(t) - y * Math.sin(t), my + x * Math.sin(t) + y * Math.cos(t)]); };
  const frameQ = quad(fr, fe.offsetWidth, fe.offsetHeight), shadowQ = quad(fr, fe.offsetWidth, fe.offsetHeight, edge * 1.5, edge * 1.8);
  const te = document.querySelector('.tag'), tagQ = tag ? quad(tag, te.offsetWidth, te.offsetHeight) : null;

  // The burst's centre: the ringed number, or the frame's centre when there is no ring.
  const at = ring || fr;
  const cx = (at.left + at.right) / 2, cy = (at.top + at.bottom) / 2;
  const far = Math.hypot(W, H) * 1.5;

  // The calm: one straight-edged piece of the plain ground cut out of the burst behind the words, run off the card's
  // top edge, so the burst is one field coming out from behind the proof. Each of its edges either runs behind the
  // frame (TUCK px inside it, so no hairline of ray shows along the frame) or is carried on from one of the frame's
  // own edges, so every edge the eye sees lines up with the proof. It is drawn PAD px past the card's edges, so the
  // scrap finder below sees a ray that runs off the card whole.
  const TUCK = 3, PAD = 160;
  const atY = (p, q, x) => p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]);
  const atX = (p, q, y) => p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]);
  const [ftl, ftr, fbr] = frameQ;
  let calm;
  if (tall) {
    // Tall: everything above the frame's top edge, that edge carried straight across the card.
    calm = [[-PAD, -PAD], [W + PAD, -PAD], [W + PAD, atY(ftl, ftr, W + PAD) + TUCK], [-PAD, atY(ftl, ftr, -PAD) + TUCK]];
  } else {
    // Wide: the right of the card down to the highlight's slap shadow. Its left edge is the frame's right edge carried
    // up to the card's top; down the proof it runs inside the frame. Its bottom edge is turned with the pin, parallel
    // to the frame's top and bottom edges, and touches the bottom of the slap shadow (and of the headline's own box)
    // at its lowest corner, so it clears every word and lines up with the proof.
    const m = Math.tan(tilt * Math.PI / 180);
    const corners = marks.map(b => [b.right + slap, b.bottom + slap]).concat([[h1.right, h1.bottom], [h1.left, h1.bottom]]);
    const c0 = Math.max(...corners.map(([x, y]) => y - m * x));
    const yB = x => c0 + m * x;
    let xi = atX(ftr, fbr, yB(fr.right)) - TUCK;
    for (let k = 0; k < 6; k++) xi = atX(ftr, fbr, yB(xi)) - TUCK;
    calm = [[atX(ftr, fbr, -PAD) - TUCK, -PAD], [W + PAD, -PAD], [W + PAD, yB(W + PAD)], [xi, yB(xi)]];
    document.documentElement.dataset.calmEdge = JSON.stringify({c0: +c0.toFixed(1), at680: +yB(680).toFixed(1), atW: +yB(W).toFixed(1),
      marks: marks.map(b => [Math.round(b.left), Math.round(b.right), Math.round(b.bottom)]), h1: [Math.round(h1.left), Math.round(h1.right), Math.round(h1.bottom)]});
  }

  // One rhythm for the family: 16 slots of 22.5 degrees, a ray centred in each, one slot centred straight down,
  // about 11.25 degrees of lit ray per slot on every show. Monday's gauges (degrees) repeat every four rays.
  const N = 16, slot = 360 / N, start = 90, GAUGE = [22, 6, 14, 6], D = Math.PI / 180;
  // Friday's split: one ground line of constant width down the centre of every ray, SPLIT px wide (4.6 px at a 358 px
  // phone column), so it reads as a gap all the way out from behind the frame; each ray is FRI degrees, so the lit
  // ray per slot is about 11.25 degrees where the rays show.
  const SPLIT = 4.6 * W / 358, FRI = 13;
  // Wednesday's ring: the even burst broken by one concentric gap round the ringed number, RING px out and RINGW px
  // wide, so the burst comes apart in two (the product comes apart); every cut is an arc at right angles to the rays.
  const RING = tall ? RING_TALL : RING_WIDE, RINGW = tall ? 40 : 26;
  const FULL = .85, NEEDLE = 1.25, SHORT = day === 'wed' ? 100 : 60;
  // The width (px) of the lit piece of ray that direction a (degrees, as painted) lies in, r px from the centre.
  const natural = (a, r) => { const i = ((Math.round((a - tilt - start) / slot) % N) + N) % N;
    return day === 'mon' ? GAUGE[i % 4] * D * r : day === 'wed' ? 11.25 * D * r : Math.max(0, (FRI * D * r - SPLIT) / 2); };
  // Paint the burst into context G at scale s.
  const paint = (G, s) => {
    const fill = q => { G.beginPath(); q.forEach(([x, y], i) => i ? G.lineTo(x * s, y * s) : G.moveTo(x * s, y * s)); G.closePath(); G.fill(); };
    const P = (a, r) => [(cx + r * Math.cos(rad(a))) * s, (cy + r * Math.sin(rad(a))) * s];
    const piece = (a0, a1, q0, q1) => {
      G.beginPath();
      if (q0 <= 0) { G.moveTo(cx * s, cy * s); } else { G.moveTo(...P(a0, q0)); }
      G.lineTo(...P(a0, q1));
      G.arc(cx * s, cy * s, q1 * s, rad(a0), rad(a1), false);
      if (q0 > 0) { G.lineTo(...P(a1, q0)); G.arc(cx * s, cy * s, q0 * s, rad(a1), rad(a0), true); }
      G.closePath(); G.fill();
    };
    const wedge = (a0, a1) => piece(a0, a1, 0, far);
    const slots = draw => { for (let i = 0; i < N; i++) draw(start + i * slot, i); };
    G.fillStyle = ground; G.fillRect(-PAD * s, -PAD * s, (W + 2 * PAD) * s, (H + 2 * PAD) * s);
    G.fillStyle = ray;
    if (day === 'mon') {
      // The money map: flows of three gauges, the width is the amount.
      const gauge = GAUGE;
      slots((m, i) => { const w = gauge[i % 4]; wedge(m - w / 2, m + w / 2); });
    } else if (day === 'wed') {
      // The product comes apart: the even burst, broken by one concentric ring of ground.
      const w = 11.25;
      slots(m => wedge(m - w / 2, m + w / 2));
      G.fillStyle = ground; G.beginPath();
      G.arc(cx * s, cy * s, (RING + RINGW / 2) * s, 0, 2 * Math.PI, false);
      G.arc(cx * s, cy * s, (RING - RINGW / 2) * s, 0, 2 * Math.PI, true);
      G.fill('evenodd');
    } else {
      // The gap: every ray is split down its centre by one line of ground of constant width.
      slots(m => wedge(m - FRI / 2, m + FRI / 2));
      G.fillStyle = ground;
      slots(m => { const u = [Math.cos(rad(m)), Math.sin(rad(m))], n = [-u[1], u[0]], h = SPLIT / 2;
        fill([[cx + n[0] * h - u[0] * h, cy + n[1] * h - u[1] * h], [cx + n[0] * h + u[0] * far, cy + n[1] * h + u[1] * far],
              [cx - n[0] * h + u[0] * far, cy - n[1] * h + u[1] * far], [cx - n[0] * h - u[0] * h, cy - n[1] * h - u[1] * h]]); });
    }
    G.fillStyle = ground; fill(calm);
  };

  // The scraps a cut leaves, found at scale s on a canvas PAD px bigger than the card all round, so a ray that runs
  // off the card is seen whole and the card's edge counts as a cut only in Wednesday's edge chip. A piece is a connected patch of visible
  // lit ray (outside the calm, the frame, its shadow and the ink plates). It is a scrap when:
  // - its part on the card is tiny (under 900 px square) or thin (under 16 px);
  // - it is a needle: a ray a cut ran along, so that past the last radius where it still shows FULL of its own
  //   width (as painted there) it tapers into the ground for more than NEEDLE times that width, such as a ray the
  //   calm's edge shaves to a point (a cut that runs along a ray at a shallow angle). A ray that never
  //   shows FULL of its width is a needle too. A taper toward the centre is a ray coming out from behind
  //   the proof, and is kept;
  // - it is a stub: under SHORT px long along the ray;
  // - on Wednesday, it is a chip: a piece the ring and the calm both cut, under 2.5 times its width long (a block with
  //   three cut sides), or a piece the ring and the card's edge both cut that shows less than its width on the card.
  const scraps = s => {
    const w = Math.ceil((W + 2 * PAD) * s), h = Math.ceil((H + 2 * PAD) * s);
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    const G = c2.getContext('2d');
    G.setTransform(1, 0, 0, 1, PAD * s, PAD * s);
    paint(G, s);
    // Where the calm lies, to tell which pieces it cuts.
    const c3 = document.createElement('canvas'); c3.width = w; c3.height = h;
    const M = c3.getContext('2d'); M.setTransform(1, 0, 0, 1, PAD * s, PAD * s); M.fillStyle = '#fff';
    M.beginPath(); calm.forEach(([x, y], i) => i ? M.lineTo(x * s, y * s) : M.moveTo(x * s, y * s)); M.closePath(); M.fill();
    const mk = M.getImageData(0, 0, w, h).data, inCalm = k => mk[k * 4 + 3] > 127;
    G.fillStyle = ground;
    const poly = q => { G.beginPath(); q.forEach(([x, y], i) => i ? G.lineTo(x * s, y * s) : G.moveTo(x * s, y * s)); G.closePath(); G.fill(); };
    poly(frameQ); poly(shadowQ); if (tagQ) poly(tagQ);
    for (const b of [wmp, pill, logos]) if (b) G.fillRect(b.left * s, b.top * s, (b.right - b.left) * s, (b.bottom - b.top) * s);
    const px = G.getImageData(0, 0, w, h).data;
    const g0 = [1, 3, 5].map(i => parseInt(ground.slice(i, i + 2), 16)), r1 = [1, 3, 5].map(i => parseInt(ray.slice(i, i + 2), 16));
    const half = (Math.abs(g0[0] - r1[0]) + Math.abs(g0[1] - r1[1]) + Math.abs(g0[2] - r1[2])) / 2;
    const on = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) on[i] = Math.abs(px[i * 4] - g0[0]) + Math.abs(px[i * 4 + 1] - g0[1]) + Math.abs(px[i * 4 + 2] - g0[2]) > half ? 1 : 0;
    const BIN = 8, bins = new Float64Array(Math.ceil(Math.hypot(W + 2 * PAD, H + 2 * PAD) / BIN) + 2);
    const seen = new Uint8Array(w * h), out = [], stack = new Int32Array(w * h);
    for (let i = 0; i < w * h; i++) { if (!on[i] || seen[i]) continue;
      let top = 0; const cells = []; stack[top++] = i; seen[i] = 1;
      while (top) { const j = stack[--top]; cells.push(j); const x = j % w;
        for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j >= w ? j - w : -1, j < w * (h - 1) ? j + w : -1])
          if (k >= 0 && on[k] && !seen[k]) { seen[k] = 1; stack[top++] = k; } }
      // Its part on the card, in card pixels; and its angle and radius round the centre, whole.
      let n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0, q0 = Infinity, q1 = -Infinity, ref = null, sa = 0, calmCut = false, ringEnd = false, ringCut = false, edgeCut = false, o0 = Infinity, o1 = -Infinity;
      const mine = [], used = [];
      for (const j of cells) { const X = (j % w + .5) / s - PAD, Y = (Math.floor(j / w) + .5) / s - PAD;
        const a = Math.atan2(Y - cy, X - cx) * 180 / Math.PI, q = Math.hypot(X - cx, Y - cy);
        if (X >= 0 && X < W && Y >= 0 && Y < H) { n++; if (X < x0) x0 = X; if (Y < y0) y0 = Y; if (X > x1) x1 = X; if (Y > y1) y1 = Y;
          if (s === 1) mine.push(Math.floor(Y) * W + Math.floor(X));
          if (!calmCut && (inCalm(j - 1) || inCalm(j + 1) || inCalm(j - w) || inCalm(j + w))) calmCut = true;
          if (q < o0) o0 = q; if (q > o1) o1 = q;
          if (X < 1 || Y < 1 || X > W - 1 || Y > H - 1) edgeCut = true;
          if (day === 'wed' && q >= RING - RINGW / 2 - 2) ringEnd = true;
          if (day === 'wed' && Math.abs(q - RING) <= RINGW / 2 + 2) ringCut = true; }
        if (ref === null) ref = a;
        sa += ((a - ref + 540) % 360) - 180;
        if (q < q0) q0 = q; if (q > q1) q1 = q;
        const k = Math.floor(q / BIN); if (!bins[k]) used.push(k); bins[k] += 1 / s / s; }
      if (!n) { for (const k of used) bins[k] = 0; continue; }
      const dir = ref + sa / cells.length;
      // The outermost whole bin where the piece still shows FULL of its ray's width, and the taper past it.
      let full = null;
      for (let k = Math.floor(q1 / BIN) - 1; k > Math.floor(q0 / BIN); k--) {
        const r = (k + .5) * BIN, want = natural(dir, r); if (want > 0 && bins[k] / BIN / want >= FULL) { full = r; break; } }
      for (const k of used) bins[k] = 0;
      const taper = full === null ? Infinity : (q1 - full) / natural(dir, full);
      const area = n / s / s, thick = area / (Math.max(x1 - x0, y1 - y0) + 1), len = q1 - q0;
      const wr = natural(dir, RING);
      const chip = (ringEnd && calmCut && len < 2.5 * wr) || (ringCut && edgeCut && o1 - o0 < wr);
      if (area < 900 || thick < 16 || taper > NEEDLE || len < SHORT || chip)
        out.push({x: Math.round(x0), y: Math.round(y0), area: Math.round(area), thick: Math.round(thick),
                  taper: taper === Infinity ? 'never full' : +taper.toFixed(1), len: Math.round(len), chip, cells: s === 1 ? mine : null}); }
    return out;
  };

  if (day === 'wed') document.documentElement.dataset.ring = JSON.stringify({r: RING, w: RINGW, cx: Math.round(cx), cy: Math.round(cy)});
  if (day === 'fri') document.documentElement.dataset.split = JSON.stringify({px: +SPLIT.toFixed(1), ray: FRI});
  document.documentElement.dataset.boxes = JSON.stringify({fr, ring, wmp, pill, tag, logos, h1, cx, cy}, (k, v) => typeof v === 'number' ? Math.round(v) : v);

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  paint(g, 1);
  // Clear every scrap that is left back to the ground, a pixel past its edge, so no cut leaves a sliver behind.
  const left = scraps(1);
  if (left.length) {
    const img = g.getImageData(0, 0, W, H), q = img.data, g0 = [1, 3, 5].map(i => parseInt(ground.slice(i, i + 2), 16));
    for (const sc of left) for (const j of sc.cells) { const x = j % W, y = (j - x) / W;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(H - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(W - 1, x + 1); xx++) {
        const o = (yy * W + xx) * 4; q[o] = g0[0]; q[o + 1] = g0[1]; q[o + 2] = g0[2]; q[o + 3] = 255; } }
    g.putImageData(img, 0, 0);
  }
  document.documentElement.dataset.scraps = JSON.stringify(left.map(({cells, ...r}) => r));
  document.documentElement.dataset.calm = JSON.stringify(calm.map(q => q.map(Math.round)));

  // For the record: the share of each word plate's box with a lit ray behind it.
  const px = g.getImageData(0, 0, W, H).data;
  const gr = [1, 3, 5].map(i => parseInt(ground.slice(i, i + 2), 16));
  const lit = (x, y) => { const o = (y * W + x) * 4; return Math.abs(px[o] - gr[0]) + Math.abs(px[o + 1] - gr[1]) + Math.abs(px[o + 2] - gr[2]) > 24; };
  const kept = {wmp, pill, tag, h1, logos, badge: tall ? null : {left: 968, right: W, top: 548, bottom: H}}, share = {};
  for (const k in kept) { const b = kept[k]; if (!b) continue; let n = 0, on = 0;
    for (let y = Math.max(0, Math.ceil(b.top)); y < Math.min(H, b.bottom); y += 2)
      for (let x = Math.max(0, Math.ceil(b.left)); x < Math.min(W, b.right); x += 2) { n++; if (lit(x, y)) on++; }
    share[k] = n ? +(on / n).toFixed(3) : 0; }
  document.documentElement.dataset.raysBehind = JSON.stringify(share);
  card.style.setProperty('--rays', `url("${cv.toDataURL('image/png')}")`);
}"""
PLACE_JS = PLACE_JS.replace('__RING_TALL__', str(RING['tall'])).replace('__RING_WIDE__', str(RING['wide']))
