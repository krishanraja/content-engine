"""Extruded (series skin "extruded", concept c10): the Receipt's blocks stand up off the page like toy blocks, in the series colour.

One family on Mon, Wed and Fri, each in its own colour; the Receipt's layout changes only where the tall toy needs
its band (below):
- the ground is a clear tint of the series colour (pale butter, cool lilac, pale coral), flat, with the house grain;
  no gradient anywhere, so the depth comes only from the blocks, and the full-strength colour sits only on the
  blocks. It stays a tint, so the bar's face is always clearly brighter than the ground;
- every block stands on a solid 45-degree extrusion, down and to the right, cut into three successively deeper
  steps of the series colour and finished with a thin hard ink edge (the old brand's hard ink shadow): butter to
  gold to amber, lilac to violet, coral to brick. The highlight bar is the loudest block (its two lines extrude as
  one solid stair, never two blocks laid over each other); the proof's frame stands lower than it, then the
  wordmark plate, the pill and the tag (ink, with the colour on it, on a short colour step). The proof's white
  frame carries a 3 px ink keyline on all four sides and is extruded as that outlined block, so it keeps its top
  and left edges on the tinted ground. The frame's steps turn with the pin; the headline's letters never get a
  shadow of their own (the bar is extruded, not the type);
- one extruded toy per series, the series' own metaphor, built from the same square-ended parts (straight bands
  cut square, lines with butt ends and mitred corners, rectangles, discs), every one on the same stepped extrusion
  with the ink edge, so every end shows the blocks' 45-degree chamfer; one ink disc or part is its focus:
  follow.the.money: a stack of three ink coins, the front one with a colour rim ring inset on it (a coin, never a
  ball), the two behind stepped down and right so the stack shows three coin edges; three straight bands of 4:2:1
  gauge leave the stack and split off it in a narrow spread, the widest rising, the middle level, the thinnest
  falling, all three ending square on one line (the money splits by amount);
  under.the.hood: one connected block: the closed body on the left stands taller than the hood line, and the hood,
  hinged on the block's top at the body's front edge, is lifted 25 degrees, still joined at the hinge, with one ink
  gear under it (half of it rises out of the block, the block hides the rest). Every extrusion of the three parts is
  drawn before any face, so no part's extrusion lies over another part's face;
  mind.the.gap: two equal timelines, as heavy as the money bands, that start far apart, run level, then turn
  straight toward each other and meet at an ink disc (today), with nothing after it.
  One composition per series in both shapes; only its box changes. The three toys share one box per shape, so
  they stand at one height on one line.
  Wide: the box is 140 px high on the centre y 600 (530 to 670 with the extrusion: 40 px clear of the bottom edge,
  matching the wordmark's top margin, and 24 px under the bar's extrusion), from the words' left edge to x 940,
  clear of YouTube's length badge (x 968-1280, y 548-720).
  Tall: the page is one left column: the pin (tag and frame) stands on the safe box's left edge, x 72, under the
  wordmark and the bar, and the toy starts on the same edge, in a band of its own under the proof, whole and
  unclipped: 26 px under the frame's extrusion, above the 1660 floor, as long as 2.4 times its height. The band
  comes from the frame: it drops the blank white rows above and below the picture (1.5% kept, the ring never cut),
  the pin's tag sits one gap under the bar's extrusion, and if the band is still under 170 px the picture is drawn
  smaller, never under 75% of the column (the house floor is 74%). If even that leaves under 140 px, the proof goes
  back exactly as the house drew it and the toy is left out. (On a three-line headline the 75% floor leaves about
  141 px: the toy is drawn at that.) A logo plate under the proof (the house sets it on the column's left edge, on
  the floor) is kept clear: the toy stands beside it on the same floor, 26 px right of it, when the rest of the row
  takes a toy 140 px high or more; otherwise over it, one gap above its top, or it is left out. On wide the plates
  sit over the headline and push it down: under 100 px left beneath it, the toy is left out.
The toy is one .deco SVG, placed after the house fit under everything in #safe and clear of every word, the tag,
the pill and the wordmark, 40 px or more from every canvas edge; it carries no words or numbers, and is left out
when the page leaves it too little room. A post outside the three series keeps the plain Receipt.
"""
import json

GRAIN = ("<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'>"
         "<feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .05  0 0 0 0 .08  0 0 0 0 .07  0 0 0 1.5 -.55'/></filter>"
         "<rect width='240' height='240' filter='url(#n)' opacity='.09'/></svg>")


def _enc(svg):
    return svg.replace('<', '%3C').replace('>', '%3E').replace('#', '%23').replace("'", '%27')


# Per series: the ground (a clear tint of the colour, never the full colour) and three successively deeper steps of
# the colour. The steps stay in the colour's own family (gold and amber, never brown); the ink edge does the
# darkening. Wed's ground is mixed from a cool white, not cream, so it never goes grey.
PAL = {
    'mon': dict(ground='#FAEBB4', ramp=['#FFC424', '#F2AA00', '#D99000']),
    'wed': dict(ground='#E2DAFA', ramp=['#A08BFA', '#8870EE', '#6F55DD']),
    'fri': dict(ground='#F9D6C8', ramp=['#F4502F', '#DE3C1C', '#BF2C12']),
}
KEY = 3   # the proof frame's ink keyline, px


def ramp_px(depth, ramp, ink, ink_px):
    """One colour per pixel of a `depth` px extrusion, nearest first: the ramp in even bands, then `ink_px` of ink."""
    n = depth - ink_px
    return [ramp[min(len(ramp) - 1, i * len(ramp) // n)] for i in range(n)] + [ink] * ink_px


def shadows(px, spread=0):
    """A box-shadow list drawing a solid 45-degree extrusion, one pixel per colour in px (nearest first)."""
    sp = f' {spread}px' if spread else ''
    return ', '.join(f'{i}px {i}px 0{sp} {c}' for i, c in enumerate(px, 1))


def drops(px):
    """The same extrusion as a filter chain. A filter extrudes the element's whole painted shape at once, so a mark
    that breaks over two lines stands on one solid stair (box-shadow paints each line piece on its own, and the
    second line's shadow would lie over the first line's face). Each drop-shadow copies everything drawn so far, so a
    copy moved by o pixels adds a whole band o deep in one step, as long as o is no more than the depth so far plus
    one: a 30 px extrusion takes seven filters, not thirty."""
    out, d, i = [], 0, 0
    while i < len(px):
        j = i
        while j < len(px) and px[j] == px[i]:
            j += 1
        n = j - i
        while n:
            o = min(n, d + 1)
            out.append(f'drop-shadow({o}px {o}px 0 {px[i]})')
            d, n = d + o, n - o
        i = j
    return ' '.join(out)


def skin(html, facts, shape, look, kit):
    if not look.get('series'):
        return html
    col, ink = look['colour'], kit.INK
    pal = PAL[kit.day]
    g, ramp = pal['ground'], pal['ramp']
    tall = kit.tall
    # depth, ink edge (px). The bar is the loudest block; the frame stands lower than it in both shapes.
    D = dict(mark=(30, 4), frame=(28, 4), plate=(14, 3), pill=(12, 3), tag=(9, 3), motif=(14, 3)) if tall else \
        dict(mark=(18, 3), frame=(16, 3), plate=(10, 2), pill=(9, 2), tag=(7, 2), motif=(9, 2))
    px = {k: ramp_px(d, ramp, ink, e) for k, (d, e) in D.items()}
    dims = {k: d for k, (d, e) in D.items()}
    dims['key'] = KEY
    css = f"""
:root {{ --col: {col}; --inkc: {ink}; --motif: {kit.day}; --mface: {ramp[0]};
        --mpx: '{json.dumps(px['motif'])}'; --ramp: '{json.dumps(ramp)}'; --dims: '{json.dumps(dims)}'; }}
body {{ background: {g}; }}
#card {{ background: url("data:image/svg+xml,{_enc(GRAIN)}") 0 0 / 240px 240px repeat, {g} !important; }}
.deco {{ position: absolute; pointer-events: none; overflow: hidden; display: block; }}
h1 {{ color: {ink}; }}
h1 mark {{ background: {col}; color: {ink}; filter: {drops(px['mark'])}; }}
.wmp {{ box-shadow: {shadows(px['plate'])}; }}
.pill {{ background: {col}; color: {ink}; box-shadow: {shadows(px['pill'])}; }}
.tag {{ background: {ink}; color: {col}; box-shadow: {shadows(px['tag'])}; }}
.frame {{ box-shadow: 0 0 0 {KEY}px {ink}, {shadows(px['frame'], KEY)}; }}
"""
    return html.replace('</style>', css + '</style>', 1)


PLACE_JS = r"""([shape, geo]) => {
  const NS = 'http://www.w3.org/2000/svg';
  const card = document.querySelector('#card'), safe = document.querySelector('#safe');
  const W = card.clientWidth, H = card.clientHeight, tall = shape !== 'wide';
  // A cover in the wide design (not one of the two thumbnails, skins.GEO) has its words in a column down to the foot:
  // when there is no room for the toy under them, it stands in the band under the proof, left of that column.
  const GEO = geo || {thumb: true};
  const css = getComputedStyle(document.documentElement);
  const v = k => css.getPropertyValue(k).trim();
  const day = v('--motif');
  if (!day) return;
  const INK = v('--inkc'), FACE = v('--mface');
  const MPX = JSON.parse(v('--mpx').slice(1, -1)), RAMP = JSON.parse(v('--ramp').slice(1, -1));
  const DM = JSON.parse(v('--dims').slice(1, -1));
  const R = q => document.querySelector(q).getBoundingClientRect();
  const f = n => (+n).toFixed(1);
  const d = MPX.length;
  let uid = 0;
  // A shallower extrusion for a small part: the same ramp in even bands, then the ink edge.
  const rampPx = (depth, inkPx) => {
    const n = depth - inkPx, out = [];
    for (let i = 0; i < n; i++) out.push(RAMP[Math.min(RAMP.length - 1, Math.floor(i * RAMP.length / n))]);
    for (let i = 0; i < inkPx; i++) out.push(INK);
    return out;
  };
  // An extruded group: the shapes drawn once per pixel of depth, each a pixel further down and right in that
  // pixel's colour (deepest first), then the face on top. Strokes say fill="none", fills say stroke="none".
  const ext = (shapes, face, px = MPX) => {
    const id = 'g' + (uid++);
    let s = `<defs><g id="${id}">${shapes}</g></defs>`;
    for (let k = px.length; k >= 1; k--) s += `<use href="#${id}" x="${k}" y="${k}" fill="${px[k - 1]}" stroke="${px[k - 1]}"/>`;
    return s + `<use href="#${id}" fill="${face}" stroke="${face}"/>`;
  };
  // Several parts on one plane: every extrusion first, deepest pixel first across all of them, then the faces in
  // order, so no part's extrusion ever lies over another part's face (a face is always in front of any extrusion).
  const extAll = groups => {
    const ids = groups.map(() => 'g' + (uid++));
    let s = '<defs>' + groups.map(([sh], i) => `<g id="${ids[i]}">${sh}</g>`).join('') + '</defs>';
    const deep = Math.max(...groups.map(([, , px = MPX]) => px.length));
    for (let k = deep; k >= 1; k--) groups.forEach(([, , px = MPX], i) => {
      if (k <= px.length) s += `<use href="#${ids[i]}" x="${k}" y="${k}" fill="${px[k - 1]}" stroke="${px[k - 1]}"/>`;
    });
    return s + groups.map(([, face], i) => `<use href="#${ids[i]}" fill="${face}" stroke="${face}"/>`).join('');
  };
  const add = (x0, y0, x1, y1, body) => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'deco');
    s.setAttribute('width', f(x1 - x0)); s.setAttribute('height', f(y1 - y0));
    s.setAttribute('viewBox', `${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}`);
    s.style.left = f(x0) + 'px'; s.style.top = f(y0) + 'px';
    s.innerHTML = body;
    card.insertBefore(s, safe);   // under everything in #safe: the toy never covers the proof, the tag or a word
  };
  // Every part is square-ended, like the blocks: bands are polygons cut square, lines have butt ends and mitred
  // corners, parts are rectangles. The 45-degree extrusion gives every end the same stepped chamfer.
  const pts = p => p.map(([x, y]) => f(x) + ',' + f(y)).join(' ');
  const poly = p => `<polygon points="${pts(p)}" stroke="none"/>`;
  const line = (p, w) => `<polyline points="${pts(p)}" fill="none" stroke-width="${f(w)}" stroke-linejoin="miter" stroke-miterlimit="10" stroke-linecap="butt"/>`;
  const disc = (cx, cy, r) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" stroke="none"/>`;
  const part = (cx, cy, w, h, a) => `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" transform="rotate(${f(a)} ${f(cx)} ${f(cy)})" stroke="none"/>`;

  // The toy, drawn whole in the box x xs..xe, y y0..y1, its extrusion included. One composition per series, the
  // same in both shapes: only the box changes.
  const toy = (xs, xe, y0, y1) => {
    const fw = xe - d - xs, fh = y1 - d - y0, cy = y0 + fh / 2, xr = xe - d;
    if (day === 'mon') {
      // The money map: a stack of three ink coins (the front one with a colour rim ring inset on it, so it reads as
      // a coin, never a ball), each coin behind stepped down and right on its own extrusion, so the stack shows as
      // three coin edges; and three straight bands of 4:2:1 gauge that leave the stack and split off it: the widest
      // rises, the middle runs level, the thinnest falls. All three end square on one line.
      const rc = fh * .42, s = (fh - 2 * rc) / 2, u = fh * .062, g = u * .6, S = 7 * u + 2 * g, cx = xs + rc, ws = [4 * u, 2 * u, u];
      const cs = cy;   // the stack's middle: the bands leave from it
      const ys = [cs - S / 2 + 2 * u, cs - S / 2 + 5 * u + g, cs - S / 2 + 6.5 * u + 2 * g];
      const ye = [y0 + 4 * u, ys[1], y1 - d - 2 * u];
      const bands = ws.map((w, i) => poly([[cx, ys[i] - w / 2], [xr, ye[i] - w / 2], [xr, ye[i] + w / 2], [cx, ys[i] + w / 2]])).join('');
      let out = ext(bands, FACE);
      for (let i = 2; i >= 0; i--) out += ext(disc(cx + i * s, y0 + rc + i * s, rc), INK);
      return out + `<circle cx="${f(cx)}" cy="${f(y0 + rc)}" r="${f(rc * .7)}" fill="none" stroke="${FACE}" stroke-width="${f(rc * .13)}"/>`;
    }
    if (day === 'wed') {
      // Lift the hood: the bar as one block, its top slab cut in two; the slab's right part is the hood, hinged at
      // its left end on the block's top and opened 25 degrees, still joined at the hinge, and under it one ink part
      // (a gear, half sunk in the block) shows. One connected silhouette on the whole box: the closed block on the
      // left, the open hood rising to the box's top on the right. Every extrusion is drawn before any face.
      const th = 25 * Math.PI / 180, co = Math.cos(th), si = Math.sin(th), fl = y1 - d;
      // The gear fills its slot under the open end: its teeth stand a clear gap under the hood's face (its own face
      // covers the hood's extrusion, which lies behind it), its right teeth a margin inside the block's end, and half
      // of it rises above the block's top; the block is just deep enough to hide the other half and its extrusion.
      // Solved together: the gear as large as the box allows, the block never under a fifth of the box's height, the
      // hood never longer than two thirds of the box.
      const tl = fh * .14, k = .5, m = fh * .06, m2 = fh * .05, gap = fh * .045, den = 1 + si + k * co;
      let ro = (fh - m2 - tl * co - m * si - gap) / (den + 1 - k);
      let hb = Math.max(fh * .2, ro * (1 - k) + m2), Lh = (fh - hb - tl * co) / si;
      if (Lh > fw * .66) { Lh = fw * .66; hb = fh - Lh * si - tl * co; }
      ro = Math.min(fh * .4, (Lh * si - m * si - gap) / den, (hb - m2) / (1 - k));
      const yt = fl - hb, xh = xr - Lh;
      // The closed part stands taller than the hood line, like the body behind a car's hood, so the open hood reads
      // as a hood lifted in front of it (never a long arm hinged at the back).
      const yc = Math.min(yt - tl, fl - fh * .7);
      const block = poly([[xs, yc], [xh, yc], [xh, yt], [xr, yt], [xr, fl], [xs, fl]]);
      const rot = ([x, y]) => [xh + (x - xh) * co + (y - yt) * si, yt - (x - xh) * si + (y - yt) * co];
      const hood = poly([[xh, yt - tl], [xr, yt - tl], [xr, yt], [xh, yt]].map(rot));
      const e = k * ro, gx = xr - m - ro, gy = yt - e;
      const n = 8, tw = ro * .24, rr = ro * .72, gp = [];
      for (let i = 0; i < n; i++) {
        const a = i * 2 * Math.PI / n - Math.PI / 2, at = Math.asin(tw / ro), ar = Math.asin(tw / rr), step = Math.PI / n;
        gp.push([gx + rr * Math.cos(a - ar), gy + rr * Math.sin(a - ar)], [gx + ro * Math.cos(a - at), gy + ro * Math.sin(a - at)],
                [gx + ro * Math.cos(a + at), gy + ro * Math.sin(a + at)], [gx + rr * Math.cos(a + ar), gy + rr * Math.sin(a + ar)],
                [gx + rr * Math.cos(a + step), gy + rr * Math.sin(a + step)]);
      }
      // The hub is a face with no extrusion of its own, drawn before the block, so the block hides its lower part too.
      return extAll([[hood, FACE], [poly(gp), INK], [disc(gx, gy, ro * .3), FACE, []], [block, FACE]]);
    }
    // The gap: two thin, equal timelines start far apart at the left, run level, then turn straight toward each
    // other and meet at one point, today (ink). Nothing runs on after it.
    const wl = fh * .14, r = fh * .21, cx = xr - r, ya = y0 + wl / 2, yb = y1 - d - wl / 2, xk = xs + fw * .3;
    return ext(line([[xs, ya], [xk, ya], [cx, cy]], wl) + line([[xs, yb], [xk, yb], [cx, cy]], wl), FACE) + ext(disc(cx, cy, r), INK);
  };

  if (!tall) {
    // Wide: the space under the headline, starting on the words' left edge so the toy lines up with the column, and
    // stopping at x 940, extrusion included (YouTube's length badge owns x 968-1280, y 548-720). Every series' toy
    // sits on one centre, y 600 when the room allows, and nothing goes below H - 50.
    const h1 = R('h1'), marks = [...document.querySelector('h1 mark').getClientRects()];
    const top = Math.max(h1.bottom, ...marks.map(r => r.bottom)) + DM.mark + 24, bot = H - 50, bh = Math.min(140, bot - top);
    const xs = h1.left, xe = 940;
    if ((bh < 100 || xe - xs < 200) && !GEO.thumb) {
      const fr = R('.frame'), lg = document.querySelector('.logos'), tg = document.querySelector('.tag');
      const colL = Math.min(h1.left, ...[lg, tg].filter(Boolean).map(e => e.getBoundingClientRect().left));
      const t2 = fr.bottom + DM.frame + 24, b2 = H - 40, h2 = Math.min(140, b2 - t2), x0 = Math.max(40, fr.left), x1 = colL - 40;
      if (h2 < 100 || x1 - x0 < 200) return;
      const L = Math.min(x1 - x0, 2.4 * h2), c2 = t2 + (b2 - t2) / 2;
      add(x0 - 4, c2 - h2 / 2 - 4, x0 + L + 4, c2 + h2 / 2 + 4, toy(x0, x0 + L, c2 - h2 / 2, c2 + h2 / 2));
      return;
    }
    if (bh < 100 || xe - xs < 200) return;
    const c = Math.min(Math.max(H * 600 / 720, top + bh / 2), bot - bh / 2);
    add(xs - 4, c - bh / 2 - 4, xe + 4, c + bh / 2 + 4, toy(xs, xe, c - bh / 2, c + bh / 2));
    return;
  }

  // Tall: the toy gets a band of its own between the proof and the 1660 floor, 26 px clear of the frame's extrusion.
  // To make that band the frame loses the blank white rows above and below the picture (a 1.5% margin kept, the
  // ring never cut), the pin's tag sits one gap under the bar's extrusion, and if the band is still under 170 px the
  // picture is drawn smaller, never under 75% of the column (the house floor is 74%). If even that cannot give the
  // toy 140 px, the proof goes back exactly as the house drew it and the toy is left out. The pin and the toy both
  // stand on the column's left edge.
  const pin = document.querySelector('.pin'), fr = document.querySelector('.frame'), img = fr.querySelector('img');
  const ringEl = fr.querySelector('.ring'), proofEl = document.querySelector('.proof'), pinTag = pin.querySelector('.tag');
  const sb = R('#safe'), K = DM.key, nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return;
  const lowest = () => {
    const m = new DOMMatrix(getComputedStyle(pin).transform), ang = Math.atan2(m.b, m.a);
    const keep = pin.style.transform; pin.style.transform = 'none';
    const pb = pin.getBoundingClientRect(), fb = fr.getBoundingClientRect();
    pin.style.transform = keep;
    const pcx = (pb.left + pb.right) / 2, pcy = (pb.top + pb.bottom) / 2, co = Math.cos(ang), si = Math.sin(ang);
    const ry = (x, y) => pcy + (x - pcx) * si + (y - pcy) * co;
    return Math.max(ry(fb.left - K, fb.bottom + K), ry(fb.right + K, fb.bottom + K)) + DM.frame * (si + co);
  };
  const ring0 = ringEl ? [parseFloat(ringEl.style.top) / 100 * nh, parseFloat(ringEl.style.height) / 100 * nh] : null;
  let t0 = 0, t1 = nh;
  try {
    const cv = document.createElement('canvas'); cv.width = nw; cv.height = nh;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const D = g.getImageData(0, 0, nw, nh).data;
    const blank = y => { for (let x = 0; x < nw; x += 2) { const i = (y * nw + x) * 4; if (Math.min(D[i], D[i + 1], D[i + 2]) < 236) return false; } return true; };
    let a = 0; while (a < nh && blank(a)) a++;
    let b = nh; while (b > a && blank(b - 1)) b--;
    const pad = Math.round(nh * .015);
    if (b > a) { t0 = Math.max(0, a - pad); t1 = Math.min(nh, b + pad); }
    if (ring0) { t0 = Math.max(0, Math.min(t0, Math.floor(ring0[0] - pad / 2))); t1 = Math.min(nh, Math.max(t1, Math.ceil(ring0[0] + ring0[1] + pad / 2))); }
  } catch (e) { t0 = 0; t1 = nh; }
  const edge = parseFloat(getComputedStyle(fr).borderTopWidth), k0 = parseFloat(img.style.width) / nw;
  const kFloor = Math.min(k0, .75 * sb.width / nw);
  // The pin's top: where the house put it, or one gap under the bar's extrusion if that is higher.
  const marks = [...document.querySelector('h1 mark').getClientRects()], gapPx = parseFloat(css.getPropertyValue('--gap')) || 27;
  const anchor = pinTag || pin, top0 = Math.min(anchor.getBoundingClientRect().top, Math.max(...marks.map(r => r.bottom)) + DM.mark + gapPx);
  const saved = [[img.style, ['width', 'height', 'objectFit', 'objectPosition']], [proofEl.style, ['alignItems', 'justifyContent']], [pin.style, ['marginTop', 'marginLeft']],
                 ...(ringEl ? [[ringEl.style, ['top', 'height']]] : []), ...(pinTag ? [[pinTag.style, ['maxWidth']]] : [])]
    .map(([st, ks]) => [st, ks.map(k => [k, st[k]])]);
  const restore = () => saved.forEach(([st, kv]) => kv.forEach(([k, val]) => { st[k] = val; }));
  const setK = k => {
    img.style.width = f(nw * k) + 'px'; img.style.height = f((t1 - t0) * k) + 'px';
    img.style.objectFit = 'cover'; img.style.objectPosition = `50% ${nh - t1 + t0 > 0 ? f(t0 / (nh - t1 + t0) * 100) : 50}%`;
    if (ring0) { ringEl.style.top = f((ring0[0] - t0) / (t1 - t0) * 100) + '%'; ringEl.style.height = f(ring0[1] / (t1 - t0) * 100) + '%'; }
    if (pinTag) pinTag.style.maxWidth = f(nw * k + 2 * edge) + 'px';
    // The pin stands on the column's left edge, under the wordmark and the bar: its turned outline (the tag's top
    // left corner is its leftmost point) starts at the safe box's left.
    proofEl.style.alignItems = 'flex-start'; proofEl.style.justifyContent = 'flex-start';
    pin.style.marginTop = '0px'; pin.style.marginLeft = '0px';
    pin.style.marginTop = f(top0 - anchor.getBoundingClientRect().top) + 'px';
    pin.style.marginLeft = f(sb.left - pin.getBoundingClientRect().left) + 'px';
  };
  const GAP = 26, BH = 170, BHMAX = 210, BHMIN = 140;
  // A logo plate under the proof (the house sets it on the column's left edge, on the floor) is kept clear: the toy
  // stands beside it on the same floor when the row has room for a toy at least 140 px high, else over it, one gap
  // above its top. With no logo plate the toy has the band to the floor to itself.
  const lg = document.querySelector('.logos'), LG = lg ? lg.getBoundingClientRect() : null;
  const beside = LG && sb.right - (LG.right + GAP) >= 2.4 * BHMIN;
  const floorY = LG && !beside ? LG.top - GAP : sb.bottom - 2, x0 = beside ? Math.ceil(LG.right + GAP) : sb.left;
  const room = () => floorY - lowest() - GAP;
  setK(k0);
  let band = room();
  if (band < BH) {
    setK(kFloor);
    const bf = room();
    if (bf < BHMIN) { restore(); return; }
    if (bf > BH) {
      let lo = kFloor, hi = k0;
      for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; setK(mid); if (room() >= BH) lo = mid; else hi = mid; }
      setK(lo);
    }
    band = room();
  }
  // The toy is 2.4 times as long as it is high (a little longer than the wide toy's 1.9, since the tall page cannot
  // give it more height), on the column's left edge like the proof, the wordmark and the bar (or beside the logo plate).
  const bh = Math.min(BHMAX, band, (sb.right - x0) / 2.4), y0 = floorY - band + (band - bh) / 2;
  const L = Math.min(sb.right - x0, W - 80, 2.4 * bh);
  add(x0 - 4, y0 - 4, x0 + L + 4, y0 + bh + 4, toy(x0, x0 + L, y0, y0 + bh));
}"""
