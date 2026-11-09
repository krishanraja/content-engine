"""Neon (series skin "neon", concept c05): the series colour as neon light on the ink wall at night.

One family on Mon, Wed and Fri, each lit in its own colour:
- the ground is flat ink, grained like a painted wall (fractal noise at 7.5%, the house grain on dark blocks), with
  no lift, no pool and no gradient; the wall under the grain is a shade darker than ink (#030C09) so the grained wall
  averages exactly the ink of the wordmark plate, which dissolves into it. The only colour on it is light thrown by
  the glass, painted into the ground so no light ever lies on top of a word;
- one neon tube traces the proof frame, mounted off the white mat and tilted with the pin: a single length of
  glass from 12px past the tag, round the frame, up the left side to stop 12px under the tag, the way a
  sign-maker's tube breaks evenly round a plate; where a drawing crosses it, the drawing ducks under;
- behind the proof runs one neon line drawing of the series' own metaphor. On tall it lives in the side margins
  beside the proof (the left one from under the highlight down, beside the tag) and the strip under its foot,
  inside the 3:4 grid crop (y 240 to 1680); on wide it lives in the free ground right of and under the proof, and
  the strip left of it under the wordmark, never in the YouTube length badge corner:
  follow.the.money is a money map, three flows whose width is the amount (48/18/8 tall, 30/13/8 wide; the thinnest
  is 8px so it reads as a flow, not a stray wire, at phone size), the fattest one solid ribbon of the colour with a hot centre line. They pass through the evidence: in from the left card
  edge, behind the proof, and out the other side, sweeping down and away like Sankey ribbons (tall: out through the
  right margin; wide: out of the proof's right edge and its foot, off the bottom), so the widths show twice;
  under.the.hood is the evidence coming apart: copies of the proof's own frame behind it, fanned out like the layers
  of an exploded view. The first is pulled down and to the left (60px on tall, 34px on wide), as deep as the grid
  crop allows on tall (its foot at y 1676 or above) and the 24px edge margin allows on wide; it shows in the left
  margin and under the foot, and its top corner turns and ducks under the front tube beside the tag. On tall a
  second, further back and dimmer, is pulled up and to the right into the free right margin and the band under the
  headline, so the stack shows on all four sides (wide has no room for it: the headline starts 38px right of the
  proof). The copies' glass is thinner than the front's, lit at a thin tube's weight with no wash, and nothing lights
  the band between a copy and the front: that band is the wall, so the gap reads as a gap at phone size;
  mind.the.gap is two timelines, apart, closing: both come in level from the left card edge far apart (on tall a
  proof-height apart), pass behind the proof, and come out of its right edge. On tall they close in the right margin
  as a clean fork 50px off the frame tube (the frame's light is kept off the strip they run down, so dark wall
  separates them), and the merged line runs on down the margin, past the frame's corner, where today's level tick
  (30px) crosses it in the open ground inside the grid crop, then bends off the right edge below the crop. On wide
  the upper leaves just under the highlight's foot and the lower past the proof's bottom-right corner, about 150px
  apart; they close over 250px of open ground under the headline on an upright tick, and the merged line turns
  down off the foot of the card short of the length badge. The glass is 18px on tall (12px on wide) with a crisp
  glow, and the light it throws stays at the weight of a 6px tube on tall (12px on wide), less at the knot, so the
  ground between and round the lines stays dark;
- the headline flips to cream on the ink; the highlight is the one solid block of light, the series colour with
  ink words and one tight halo, a lit sign plate; the tag is a lit label in the colour; the pill is a fine neon
  outline (colour on ink); the wordmark plate is untouched, and on tall, where it dissolves into the wall, its inner
  padding moves to its right so the mark's first pixel sits on the headline's cap edge (the plate's box stays put).
No stickers, no words, no numbers in any decoration, and nothing on the words. Every piece of glass is a .deco
SVG whose box clears the tag, the headline, the pill, the wordmark and any logos; a drawing is cut into a few such
tiles where the free ground is not one rectangle, each tile drawing the same picture so the seams do not show. On tall
the logo plate sits under the proof: the series drawing's band stops above it, and the tube's lower-left window stops
short of it (never short of the glass). On wide the plate sits in the column over the words, and the band under them
runs on to the foot.
"""

GRAIN = ("<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'>"
         "<feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .9 0'/></filter>"
         "<rect width='240' height='240' filter='url(#n)' opacity='.075'/></svg>")


def rgba(hex_, a):
    return f'rgba({int(hex_[1:3], 16)}, {int(hex_[3:5], 16)}, {int(hex_[5:7], 16)}, {a})'


def skin(html, facts, shape, look, kit):
    if not look.get('series'):
        return html
    col, ink, cream = look['colour'], kit.INK, kit.CREAM
    core = kit.mix(col, '#FFFFFF', .38)          # the lit glass: paler than the colour, never white
    hot = kit.mix(col, '#FFFFFF', .78)           # the hottest line down its middle
    # The night wall is the house ink, flat; the glass makes the light. The grain lays white specks at about 3.6% on
    # average, so the wall under it is that much darker than ink and the grained wall averages exactly the ink of the
    # wordmark plate (#0C1512), which then dissolves into it.
    wall = '#030C09'
    grain = GRAIN.replace('<', '%3C').replace('>', '%3E').replace('#', '%23').replace("'", '%27')
    none = 'linear-gradient(transparent, transparent)'
    # On tall the plate dissolves into the wall, so the mark itself is what the eye lines up: its first pixel goes on
    # the headline's cap edge (the plate's inner padding moves to its right side; the plate's box does not move).
    wm = (".wmp { padding-left: calc(var(--wm) * .45 - 11px); padding-right: calc(var(--wm) * .45 + 11px); }"
          if kit.tall else '')
    css = f"""
:root {{ --col: {col}; --core: {core}; --hot: {hot}; --wall: {wall}; --motif: {kit.day}; }}
{wm}
body {{ background: {wall}; }}
#card {{ background:
   url("data:image/svg+xml,{grain}") 0 0 / 240px 240px repeat,
   var(--light, {none}) 0 0 / 100% 100% no-repeat,
   {wall} !important; }}
h1 {{ color: {cream}; position: relative; z-index: 3; }}
h1 mark {{ background: {col}; color: {ink}; }}
.pill {{ background: {ink}; color: {col};
   box-shadow: 0 0 0 2px {ink}, 0 0 0 5px {core}, 0 0 8px 5px {rgba(col, .85)}, 0 0 26px 7px {rgba(col, .42)}; }}
.tag {{ position: relative; z-index: 2; background: {col}; color: {ink};
   box-shadow: 0 0 14px {rgba(col, .6)}, 0 0 40px {rgba(col, .28)}; }}
.frame {{ box-shadow: none; }}
.deco {{ position: absolute; pointer-events: none; }}
"""
    return html.replace('</style>', css + '</style>', 1)


PLACE_JS = r"""([shape, geo]) => {
  const NS = 'http://www.w3.org/2000/svg';
  const card = document.querySelector('#card'), safe = document.querySelector('#safe');
  const W = card.clientWidth, H = card.clientHeight, tall = shape !== 'wide';
  // The shape's platforms (skins.GEO): the profile grid's window on the 9:16 shapes, YouTube's length badge on the wide
  // thumbnail. A cover in the wide design (COVER) has its words in a column down the right, so the drawing lives left
  // of that column and under the proof.
  const GEO = geo || {thumb: true, grid: tall ? [0, 240, 1080, 1680] : null, badge: tall ? null : [968, 548, 1280, 720]};
  const COVER = !tall && !GEO.thumb, gridB = GEO.grid ? GEO.grid[3] : H;
  const css = getComputedStyle(document.documentElement);
  const v = k => css.getPropertyValue(k).trim();
  const col = v('--col'), core = v('--core'), hot = v('--hot'), wall = v('--wall'), day = v('--motif');
  if (!col) return {skipped: 'not a series piece: the plain Receipt'};
  const R = q => { const e = document.querySelector(q); return e ? e.getBoundingClientRect() : null; };
  const h1 = R('h1'), fr = R('.frame'), logos = R('.logos'), wmp = R('.wmp');
  // A cover may leave its tag off ("show_tag": false): stand in a zero-size box where the tag would start, on the
  // proof when the tag is pinned there, else at the top left of the headline's column.
  const pinned = !!document.querySelector('.stack') || !!document.querySelector('.pin .tag') || (!COVER && !tall);
  const at = pinned && fr ? fr : h1;
  const tagR = R('.tag') || {left: at.left, right: at.left, top: at.top, bottom: at.top, width: 0, height: 0};
  const markBot = Math.max(h1.bottom, ...[...document.querySelector('h1 mark').getClientRects()].map(r => r.bottom));
  const f = n => (+n).toFixed(1);
  const KEPT = ['.wmp', 'h1', '.logos', '.pill', '.tag'].flatMap(q => [...document.querySelectorAll(q)]);
  const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const isClear = el => { const r = el.getBoundingClientRect(); return !KEPT.some(k => hits(r, k.getBoundingClientRect())); };
  // The YouTube length badge corner on wide: no glass ever goes there.
  const BADGE = tall || !GEO.badge ? null : [GEO.badge[0], GEO.badge[1], W - GEO.badge[0], H - GEO.badge[1]];

  // The ground's light, in card coordinates, under everything.
  let light = '', lfid = 0;
  const blur = s => { const id = `l${lfid++}`; light += `<filter id="${id}" filterUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><feGaussianBlur stdDeviation="${f(s)}"/></filter>`; return id; };
  // The light a tube throws on the wall: a tight halo round the glass and (unless wash is false) a faint wide wash.
  const halo = (d, w, tf, dash, glow, wash = true) => {
    const a = blur(w * 2.2), b = wash ? blur(w * 6) : '', c = glow ? blur(w * .55) : '', da = dash ? ` stroke-dasharray="${dash}"` : '';
    light += `<g fill="none" stroke="${col}" stroke-linecap="round" stroke-linejoin="round"${tf ? ` transform="${tf}"` : ''}${da}>` +
      (wash ? `<path d="${d}" stroke-width="${f(w * 8)}" opacity=".1" filter="url(#${b})"/>` : '') +
      `<path d="${d}" stroke-width="${f(w * 3)}" opacity=".62" filter="url(#${a})"/>` +
      (glow ? `<path d="${d}" stroke-width="${f(w * 1.9)}" filter="url(#${c})"/>` : '') + `</g>`;
  };
  // The glass itself: a tight glow, the lit tube and its hot centre line. '§' is made unique per tile.
  let gfid = 0;
  const glass = (d, w, dash, bare, gw = 1.9, gb = .55) => {
    const id = `g§${gfid++}`, da = dash ? ` stroke-dasharray="${dash}"` : '';
    return (bare ? '' : `<filter id="${id}" filterUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><feGaussianBlur stdDeviation="${f(w * gb)}"/></filter>`) +
      `<g fill="none" stroke-linecap="round" stroke-linejoin="round"${da}>` +
      (bare ? '' : `<path d="${d}" stroke="${col}" stroke-width="${f(w * gw)}" filter="url(#${id})"/>`) +
      `<path d="${d}" stroke="${core}" stroke-width="${f(w)}"/>` +
      `<path d="${d}" stroke="${hot}" stroke-width="${f(Math.max(1.4, w * .32))}"/></g>`;
  };
  // One picture shown through one honest window: an SVG whose box is exactly the ground it paints.
  let tn = 0;
  const tile = (parent, before, box, inner) => {
    const [x, y, w, h] = box;
    if (!(w > 0 && h > 0)) return null;
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'deco');
    s.setAttribute('width', f(w)); s.setAttribute('height', f(h)); s.setAttribute('viewBox', `${f(x)} ${f(y)} ${f(w)} ${f(h)}`);
    s.style.cssText = `position:absolute;left:${f(x)}px;top:${f(y)}px;width:${f(w)}px;height:${f(h)}px;overflow:hidden;`;
    s.innerHTML = inner.replaceAll('§', `t${tn++}`);
    parent.insertBefore(s, before);
    return s;
  };

  // 1. The tube round the proof frame, in the pin's own (tilted) coordinates: one length of glass, broken round the tag.
  const pin = document.querySelector('.pin'), frame = document.querySelector('.frame'), tag = document.querySelector('.pin .tag');
  const fx = frame.offsetLeft, fy = frame.offsetTop, fw = frame.offsetWidth, fh = frame.offsetHeight;
  const tw = tall ? 11 : 8, dd = tall ? 16 : 14, rr = dd + 8, pad = Math.ceil(tw * 2.4);
  const L = fx - dd, T = fy - dd, Rr = fx + fw + dd, B = fy + fh + dd;
  // The break round the tag is even: the top run starts 12px past its right edge, the left run stops 12px under it.
  const tagEnd = tag ? tag.offsetLeft + tag.offsetWidth + 12 : fx + fw * .3;
  const tagBot = tag ? tag.offsetTop + tag.offsetHeight : T - 40;
  const leftEnd = tag ? tagBot + 12 : T + rr;
  const arc = (x, y) => `A${rr},${rr} 0 0 1 ${f(x)},${f(y)}`;
  const P = `M${f(tagEnd)},${f(T)}H${f(Rr - rr)}${arc(Rr, T + rr)}V${f(B - rr)}${arc(Rr - rr, B)}H${f(L + rr)}${arc(L, B - rr)}V${f(leftEnd)}`;
  const tubeArt = glass(P, tw, null, true);   // the glass only: its glow is light on the wall, painted with the halo
  // Three windows on the one tube: right of the tag (everything from the top run round to the bottom), the bottom
  // left, and the left run up to the tag. They overlap by 2px so no seam shows where the glass crosses from one to the next.
  const mid = Math.round(fy + fh * .55);
  let split = Math.floor(tagEnd - pad);
  let A = tile(pin, pin.firstChild, [split, T - pad, Rr + pad - split, B - T + 2 * pad], tubeArt);
  while (A && !isClear(A) && split < tagEnd - 4) { A.remove(); split += 1; A = tile(pin, pin.firstChild, [split, T - pad, Rr + pad - split, B - T + 2 * pad], tubeArt); }
  // The bottom-left window stops short of anything kept under the proof (the logo plate on tall), never short of the glass.
  let bBot = B + pad;
  let Bw = tile(pin, pin.firstChild, [L - pad, mid, split + 2 - (L - pad), bBot - mid], tubeArt);
  while (Bw && !isClear(Bw) && bBot > B + tw / 2 + 1) { Bw.remove(); bBot -= 1; Bw = tile(pin, pin.firstChild, [L - pad, mid, split + 2 - (L - pad), bBot - mid], tubeArt); }
  let cTop = Math.ceil(tagBot + 1);
  let C = tile(pin, pin.firstChild, [L - pad, cTop, 2 * pad, mid + 2 - cTop], tubeArt);
  while (C && !isClear(C) && cTop < leftEnd - 2) { C.remove(); cTop += 1; C = tile(pin, pin.firstChild, [L - pad, cTop, 2 * pad, mid + 2 - cTop], tubeArt); }
  // Its halo, carried onto the ground with the pin's tilt.
  const m6 = getComputedStyle(pin).transform.match(/matrix\(([^)]+)\)/);
  const ang = m6 ? Math.atan2(+m6[1].split(',')[1], +m6[1].split(',')[0]) * 180 / Math.PI : 0;
  const fc = [(fr.left + fr.right) / 2, (fr.top + fr.bottom) / 2], lc = [fx + fw / 2, fy + fh / 2];
  const tf = `translate(${f(fc[0])} ${f(fc[1])}) rotate(${f(ang)}) translate(${f(-lc[0])} ${f(-lc[1])})`;
  halo(P, tw, tf, null, true);
  // Card coordinates of a path drawn in the pin's frame (tilted) or on the card, sampled, for the spacing below.
  const rad = ang * Math.PI / 180, ca = Math.cos(rad), sa = Math.sin(rad);
  const toCard = ([x, y]) => [fc[0] + ca * (x - lc[0]) - sa * (y - lc[1]), fc[1] + sa * (x - lc[0]) + ca * (y - lc[1])];
  const sample = (d, n) => { const sv = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d); sv.appendChild(p); document.body.appendChild(sv);
    const len = p.getTotalLength(), out = [];
    for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(len * i / n); out.push([q.x, q.y]); }
    sv.remove(); return out; };
  const tubePts = sample(P, 900).map(toCard);
  const gapTo = (pts, x, y) => Math.min(...pts.map(([a, b]) => Math.hypot(a - x, b - y)));
  const meas = {};
  // The glow round the highlight: one tight halo, so the bar reads as a lit sign plate and never spills on the ink.
  const mk = blur(tall ? 10 : 8);
  for (const r of document.querySelector('h1 mark').getClientRects())
    light += `<rect x="${f(r.left)}" y="${f(r.top)}" width="${f(r.width)}" height="${f(r.height)}" fill="${col}" opacity=".55" filter="url(#${mk})"/>`;

  // 2. The series drawing, in the free ground: the band under the tag and the headline (above any logos), and on
  // wide the strip left of the proof's tag, under the wordmark.
  const m = tall ? 26 : 18;
  // The logo plate bounds the band only where it lies under it (tall); on wide it sits in the column over the words.
  const top = Math.ceil(Math.max(tagR.bottom, markBot) + m), bot = Math.floor(logos && logos.top > top ? logos.top - m : H);
  // A cover whose logos sit under its headline ("headline_first") keeps the band left of that column, off the logos.
  const logosUnder = !tall && logos && logos.top >= markBot - 1;
  const tiles = [[0, top, logosUnder ? Math.max(0, Math.floor(Math.min(logos.left, h1.left) - 4)) : W, Math.max(0, (logosUnder ? H : bot) - top)]];
  if (!tall) { const sx = Math.floor(Math.min(tagR.left, h1.left) - 2), sy = Math.ceil(wmp.bottom + m); if (sx > 0 && top > sy) tiles.push([0, sy, sx, top - sy]); }
  // On tall, the left margin beside the tag (under the highlight) is free ground too.
  else { const sx = Math.floor(tagR.left - 4), sy = Math.ceil(markBot + m); if (sx > 0 && top > sy) tiles.push([0, sy, sx, top - sy]); }
  // On tall, the logo plate sits on the column's left edge: the ground right of it, down to the foot, is free too, so
  // a line running down the right margin is not cut off at the plate's top (leaving its light on the wall without its
  // glass, and today's tick unseen).
  if (tall && logos && logos.top > top && bot < H) { const lx = Math.ceil(logos.right + m); if (lx < W) tiles.push([lx, bot, W - lx, H - bot]); }
  const rrect = (x0, y0, x1, y1, r) => `M${f(x0 + r)},${f(y0)}H${f(x1 - r)}A${r},${r} 0 0 1 ${f(x1)},${f(y0 + r)}V${f(y1 - r)}A${r},${r} 0 0 1 ${f(x1 - r)},${f(y1)}H${f(x0 + r)}A${r},${r} 0 0 1 ${f(x0)},${f(y1 - r)}V${f(y0 + r)}A${r},${r} 0 0 1 ${f(x0 + r)},${f(y0)}Z`;
  // Where the frame's tube crosses the drawing, the drawing ducks under it; on wide, the badge corner is kept clear.
  const under = (extra) => `<rect x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}" fill="#fff"/>` +
    `<g transform="${tf}"><path d="${rrect(L, T, Rr, B, rr)}" fill="#000"/>` +
    `<path d="${P}" fill="none" stroke="#000" stroke-width="${f(tw + 10)}" stroke-linecap="round"/>${extra || ''}</g>` +
    (BADGE ? `<rect x="${BADGE[0]}" y="${BADGE[1]}" width="${BADGE[2]}" height="${BADGE[3]}" fill="#000"/>` : '');
  let art = '', defs = '', mkn = 0;
  const layer = (inner, extra) => { const id = `u§${mkn++}`;
    defs += `<mask id="${id}" maskUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}">${under(extra)}</mask>`;
    art += `<g mask="url(#${id})">${inner}</g>`; };
  let base = '';
  const tube = (d, w, dash, tfm) => { base += glass(d, w, dash); halo(d, w, tfm, dash); };

  // A flow of money drawn as one solid ribbon of light: the colour at full strength with a hot centre line, and a
  // tight halo on the wall (no wide wash, which turns muddy on green ink).
  const ribbon = (d, w) => {
    const a = blur(tall ? 9 : 7), b = blur(tall ? 22 : 16);
    light += `<g fill="none" stroke="${col}"><path d="${d}" stroke-width="${f(w + 30)}" opacity=".13" filter="url(#${b})"/>` +
      `<path d="${d}" stroke-width="${f(w + 8)}" opacity=".62" filter="url(#${a})"/></g>`;
    base += `<g fill="none"><path d="${d}" stroke="${col}" stroke-width="${f(w)}"/>` +
      `<path d="${d}" stroke="${hot}" stroke-width="${f(Math.max(3, w * .13))}" stroke-linecap="round"/></g>`;
  };
  // A Sankey bend: level at both ends, one smooth S between (x0, y0) and (x1, y1).
  const sk = (x0, y0, x1, y1) => { const xm = (x0 + x1) / 2; return `C${f(xm)},${f(y0)} ${f(xm)},${f(y1)} ${f(x1)},${f(y1)}`; };

  // The words' column on a cover: everything is drawn left of it.
  const colL = Math.min(tagR.left, h1.left, ...(logos ? [logos.left] : []));
  if (tiles[0][3] >= 90 || COVER) {
    if (day === 'mon') {
      // The money map: three flows whose width is the amount (48/16/5 tall, 30/10/4 wide). They run through the
      // evidence: in from one side, behind the proof, out the other, each bending like a Sankey ribbon.
      const G = tall ? [48, 18, 8] : [30, 13, 8];
      const flow = (d, i) => i ? tube(d, G[i]) : ribbon(d, G[0]);
      if (tall) {
        // In from the left card edge at three heights, levelling as they slip behind the proof, and out through the
        // right margin, where each sweeps down and away as it leaves: one pour of money through the evidence, like a
        // Sankey ribbon. The widths show twice beside the proof, all inside the grid crop.
        const y0 = Math.max(top + 66, fr.top + 84), y1 = Math.min(fr.bottom - 80, gridB - 130), sp = (y1 - y0) / 2;
        const ins = [y0, y0 + sp, y1], fall = 200, rx0 = fr.right - 130;
        const outs = [fr.top + fr.height * .42, fr.top + fr.height * .68, fr.bottom - 50].map(y => Math.min(y, gridB - 80));
        for (let i = 0; i < 3; i++) {
          // (on a shorter cover the drop is cut down, so no flow rises past the band's top edge, out of its window)
          const fl = GEO.thumb ? fall : Math.max(40, Math.min(fall, outs[i] - top - G[i] - 24));
          const a = ins[i], c = outs[i] - fl;
          flow(`M-300,${f(a - 70)}${sk(-240, a - 70, fr.left + 70, a)}L${f(rx0)},${f(c)}${sk(rx0, c, W + 70, c + fl)}L${f(W + 100)},${f(c + fl)}`, i);
        }
      } else if (COVER) {
        // A cover: in level from the left card edge beside the proof, behind it, and out of its foot at three points
        // spread along its bottom edge (the widest furthest right), each sweeping down and right off the card's foot,
        // short of the words' column, so the widths show twice.
        const ins = [fr.top + fr.height * .2, fr.top + fr.height * .5, fr.top + fr.height * .8];
        const xs = [.8, .56, .32].map(k => fr.left + fr.width * k), lim = colL - m - 24;
        for (let i = 0; i < 3; i++) {
          const bx = xs[i], by = fr.bottom - 30, e = Math.max(bx + 20, Math.min(lim - G[i] / 2, bx + 110 - i * 15));
          flow(`M-60,${f(ins[i])}L-20,${f(ins[i])}${sk(-20, ins[i], fr.left + 160, ins[i] + (1 - i) * 24)}L${f(bx)},${f(by - 60)}L${f(bx)},${f(by)}` +
               `C${f(bx)},${f(H - 20)} ${f(e)},${f(H - 50)} ${f(e)},${f(H + 40)}`, i);
        }
      } else {
        // In level from the left card edge beside the proof, behind it, and out of its right edge and its foot at
        // points spread along the frame, sweeping right and down through the free ground and off the bottom before
        // the YouTube length badge corner.
        const ex = [BADGE[0] - 62, BADGE[0] - 162, BADGE[0] - 252];
        const ys = [markBot + 60, markBot + 122], ins = [fr.top + fr.height * .2, fr.top + fr.height * .5, fr.top + fr.height * .8];
        for (let i = 0; i < 2; i++) {
          const xs = fr.right + 12, y = ys[i], e = ex[i];
          flow(`M-60,${f(ins[i])}L-20,${f(ins[i])}${sk(-20, ins[i], fr.left + 160, ins[i] + 40)}L${f(fr.right - 140)},${f(y)}L${f(xs)},${f(y)}` +
               `C${f(xs + (e - xs) * .78)},${f(y)} ${f(e)},${f(y + (H - y) * .3)} ${f(e)},${f(H + 40)}`, i);
        }
        const bx = fr.right - 95, by = fr.bottom - 30, e = ex[2];
        flow(`M-60,${f(ins[2])}L-20,${f(ins[2])}${sk(-20, ins[2], fr.left + 160, ins[2] - 30)}L${f(bx)},${f(by - 60)}L${f(bx)},${f(by)}` +
             `C${f(bx)},${f(H - 20)} ${f(e)},${f(H - 50)} ${f(e)},${f(H + 40)}`, 2);
      }
    } else if (day === 'wed') {
      // The evidence coming apart: copies of the proof's own frame behind it, fanned out like the layers of an
      // exploded view (hidden where the proof covers them). The first is pulled down and to the left, as deep as the
      // grid crop allows on tall (the stack's foot at y 1676) and the 24px edge margin allows on wide; on tall a
      // second, further back and dimmer, is pulled up and to the right into the free right margin and the band under
      // the headline, so the stack shows on all four sides. Their glass is thinner than the front's and lit at a thin
      // tube's weight with no wash, and nothing in front lights the band between an outline and the one in front of
      // it: that band is the wall, so each gap reads as a gap at phone size.
      const w = tall ? 7 : 6, lw = 4, dx = tall ? -60 : -34;
      const lim = tall ? gridB - 4 : H - 24, ys = tubePts.map(p => p[1]), xs = tubePts.map(p => p[0]);
      const dy = Math.floor(Math.min(tall ? 36 : 30, (lim - w / 2 - Math.max(...ys) - sa * dx) / ca));
      // [step x, step y, opacity]
      const steps = [[dx, dy, 1]];
      if (tall) {
        const sy0 = Math.ceil(markBot + m), sx0 = Math.floor(tagR.right + 4);
        const fx = Math.min(60, Math.floor(W - 24 - w / 2 - Math.max(...xs)));
        const fy = -Math.min(30, Math.floor(Math.min(...ys) - tw / 2 - sy0 - w / 2 - 14));
        if (top > sy0 && fx >= 40 && fy <= -20) { steps.push([fx, fy, .72]); tiles.push([sx0, sy0, W - sx0, top - sy0]); }
      }
      let extra = `<path d="${rrect(L, T, Rr, B, rr)}" fill="#000"/>`;
      for (const [sx, sy, so] of steps) {
        const d = rrect(L + sx, T + sy, Rr + sx, B + sy, rr);
        base = glass(d, w, null, true);
        const l0 = light.length;
        halo(d, lw, tf, null, true, false);
        if (so < 1) light = light.slice(0, l0) + `<g opacity="${so}">` + light.slice(l0) + `</g>`;
        // The band between this outline and the front one: the wall, lit by neither (2px of each tube's own glow kept).
        const e1 = tw / 2 + 2, e2 = w / 2 + 1.5, bm = `bm${lfid++}`;
        light += `<filter id="${bm}f" filterUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><feGaussianBlur stdDeviation="1.5"/></filter>` +
          `<mask id="${bm}" maskUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><g filter="url(#${bm}f)"><g transform="${tf}">` +
          `<path d="${rrect(L + sx + e2, T + sy + e2, Rr + sx - e2, B + sy - e2, Math.max(2, rr - e2))}" fill="#fff"/>` +
          `<path d="${rrect(L - e1, T - e1, Rr + e1, B + e1, rr + e1)}" fill="#000"/></g></g></mask>` +
          `<rect x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}" fill="${wall}" mask="url(#${bm})"/>`;
        layer(`<g transform="${tf}"${so < 1 ? ` opacity="${so}"` : ''}>${base}</g>`, extra);
        extra += `<path d="${d}" fill="#000"/><path d="${d}" fill="none" stroke="#000" stroke-width="${f(w + 10)}"/>`;
        const lp = sample(d, 900).map(toCard);
        meas[`layer ${sx},${sy}`] = {top: +f(Math.min(...lp.map(p => p[1])) - w / 2), bottom: +f(Math.max(...lp.map(p => p[1])) + w / 2),
          left: +f(Math.min(...lp.map(p => p[0])) - w / 2), right: +f(Math.max(...lp.map(p => p[0])) + w / 2)};
      }
      meas.front = {bottom: +f(Math.max(...ys) + tw / 2), left: +f(Math.min(...xs) - tw / 2)};
      base = '';
    } else if (day === 'fri') {
      // Two timelines, apart, closing until they run on together as one line, with today's tick across it.
      const w = tall ? 18 : 12, tk = tall ? 30 : 36, mw = tall ? 16 : 12, kw = tall ? 9 : 7;
      // Thick glass, so the lines read at phone size, with a crisp glow and the light they throw kept at the weight of
      // a 6px tube on tall (12px on wide), so the dark ground between and round them stays dark.
      const tube = (d, ww, cap) => { base += glass(d, ww, null, false, tall ? 1.35 : 1.5, .4); halo(d, Math.min(ww, cap)); };
      // The frame tube's outer edge on the right, at a height on the card.
      const rightAt = y => Math.max(...tubePts.filter(p => Math.abs(p[1] - y) < 4).map(p => p[0])) + tw / 2;
      const brc = toCard([Rr, B]);   // the frame tube's bottom-right corner (its bounding corner)
      let tail, tick;
      if (tall) {
        // Both come in level from the left card edge, the whole height of the proof apart (the gap), and pass behind
        // it. The upper comes out of the proof's right edge near its top and runs down the right margin; the lower
        // comes out of the right edge low down; they close the gap in the right margin as a clean fork. The merged
        // line runs on down the margin, past the frame's corner, where today's level tick crosses it in the open
        // ground inside the grid crop, and bends off the right edge below the crop.
        const ym = Math.round(fr.top + fr.height * .62), edge = rightAt(ym), xm = Math.min(Math.round(edge + 50), W - 40);
        const ya = Math.max(top + 60, fr.top + 90), yb = fr.bottom - 40, ye = ym - 104, rx = xm + 2, yr = ya + 110;
        // The frame tube's light is kept off the strip of the right margin the timelines run down (as on Wednesday's
        // bands), so dark wall separates the frame from the fork; it fades in below where the upper line enters the
        // margin and out above the frame's corner.
        const sm = `sm${lfid++}`, sg = `sg${lfid++}`, x0 = Rr + tw / 2 + 4, y0 = T + rr, y1 = B - rr;
        const [c0, c1] = [toCard([Rr, y0]), toCard([Rr, y1])], span = c1[1] - c0[1];
        const fa = (ya + 100 - c0[1]) / span, fb = (ym + 60 - c0[1]) / span, fc = 1 - 60 / span;
        light += `<linearGradient id="${sg}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(y0)}" x2="0" y2="${f(y1)}">` +
          `<stop offset="0" stop-color="#000"/><stop offset="${f(Math.max(0, fa - .12))}" stop-color="#000"/><stop offset="${f(Math.max(.01, fa))}" stop-color="#fff"/>` +
          `<stop offset="${f(Math.min(fc, Math.max(fb, fa + .02)))}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
          `<filter id="${sm}f" filterUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><feGaussianBlur stdDeviation="2"/></filter>` +
          `<mask id="${sm}" maskUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}"><g transform="${tf}" filter="url(#${sm}f)">` +
          `<rect x="${f(x0)}" y="${f(y0)}" width="${f(W)}" height="${f(y1 - y0)}" fill="url(#${sg})"/></g></mask>` +
          `<rect x="${-W}" y="${-H}" width="${3 * W}" height="${3 * H}" fill="${wall}" mask="url(#${sm})"/>`;
        tube(`M-60,${f(ya)}L-20,${f(ya)}${sk(-20, ya, fr.left + 260, ya + 40)}L${f(fr.right - 160)},${f(ya + 40)}` +
             `C${f(fr.right - 40)},${f(ya + 40)} ${f(rx)},${f(yr - 50)} ${f(rx)},${f(yr)}` +
             `L${f(rx)},${f(ym - 110)}C${f(rx)},${f(ym - 60)} ${f(xm)},${f(ym - 56)} ${f(xm)},${f(ym)}`, w, 5);
        tube(`M-60,${f(yb)}L${f(fr.left + 140)},${f(yb)}L${f(fr.right - 200)},${f(ye)}L${f(edge - 10)},${f(ye)}` +
             `C${f(xm - 6)},${f(ye)} ${f(xm)},${f(ym - 64)} ${f(xm)},${f(ym)}`, w, 5);
        const yt = Math.min(gridB - 28, Math.round(brc[1] + 44));   // today's tick, past the frame's corner
        const yo = Math.max(yt + 60, gridB + 10);   // the merged run carries on down, then bends off the right edge below the crop
        tail = `M${f(xm)},${f(ym)}L${f(xm)},${f(yo)}C${f(xm)},${f(yo + 70)} ${f(W - 6)},${f(yo + 110)} ${f(W + 60)},${f(yo + 150)}`;
        tick = `M${f(xm - tk / 2)},${f(yt)}L${f(xm + tk / 2)},${f(yt)}`;
        meas.knot = {fork: [xm, ym], frameEdge: +f(edge), tick: [xm, yt], corner: brc.map(v => +f(v))};
      } else if (COVER) {
        // A cover: the lower timeline comes in level from the left card edge in the band under the proof, open all the
        // way; the upper comes in level beside the proof, a proof's height above it, passes behind the proof and comes
        // out of its foot, falling to close on the lower. The merged line runs on level, today's upright tick across
        // it, and turns down off the card's foot, short of the words' column.
        const fb = Math.max(...tubePts.map(p => p[1])) + tw / 2, room = H - fb;
        const yb = Math.round(fb + room * .5), ua = fr.top + fr.height * .3;
        const xa = fr.left + fr.width * .34, xm = Math.round(fr.left + fr.width * .62), xd = Math.max(xm + 90, Math.min(colL - m - 30, xm + 170));
        tube(`M-60,${f(ua)}L-20,${f(ua)}${sk(-20, ua, fr.left + 120, ua + 30)}L${f(xa)},${f(fr.bottom - 60)}` +
             `C${f(xa)},${f(yb)} ${f(xa + (xm - xa) * .45)},${f(yb)} ${f(xm)},${f(yb)}`, w, 12);
        tube(`M-60,${f(yb)}L${f(xm)},${f(yb)}`, w, 12);
        const kx = Math.round(xm + (xd - 26 - xm) * .5);
        tail = `M${f(xm)},${f(yb)}L${f(xd - 26)},${f(yb)}C${f(xd - 6)},${f(yb)} ${f(xd)},${f(yb + 10)} ${f(xd)},${f(yb + 30)}L${f(xd)},${f(H + 40)}`;
        tick = `M${f(kx)},${f(yb - tk / 2)}L${f(kx)},${f(yb + tk / 2)}`;
        meas.cover = {fb: +f(fb), yb, xa: +f(xa), xm, xd};
      } else {
        // Both come in level from the left card edge, far apart, and pass behind the proof. The upper comes out of its
        // right edge just under the highlight's foot; the lower comes out past its bottom-right corner, low, clear of
        // the canvas foot, about 150px under the upper. They close over the open ground under the headline on an
        // upright tick, and the merged line runs on and bends off the foot of the card before the YouTube length badge.
        const ua = fr.top + fr.height * .3, la = fr.top + fr.height * .78;
        const ya = Math.ceil(Math.max(top + 14, markBot + 34)), yb = Math.min(H - 50, Math.round(brc[1] + 40));
        const xm = Math.min(BADGE[0] - 64, Math.round(fr.right + 290)), ym = Math.round((ya + yb) / 2);
        const xa = rightAt(ya) + 6, k = (xm - xa) * .5, xb = brc[0] + 14;
        tube(`M-60,${f(ua)}L-20,${f(ua)}${sk(-20, ua, fr.left + 120, ua + 30)}L${f(fr.right - 140)},${f(ya)}L${f(xa)},${f(ya)}` +
             `C${f(xa + k)},${f(ya)} ${f(xm - k * .5)},${f(ym)} ${f(xm)},${f(ym)}`, w, 12);
        tube(`M-60,${f(la)}L-20,${f(la)}${sk(-20, la, fr.left + 120, la + 10)}L${f(fr.right - 150)},${f(la + 10)}` +
             `C${f(fr.right - 40)},${f(la + 10)} ${f(xb - 50)},${f(yb)} ${f(xb)},${f(yb)}` +
             `C${f(xb + k)},${f(yb)} ${f(xm - k * .5)},${f(ym)} ${f(xm)},${f(ym)}`, w, 12);
        const xd = Math.min(BADGE[0] - 26, xm + 44);   // where the merged line has turned down, short of the badge corner
        tail = `M${f(xm)},${f(ym)}C${f(xm + (xd - xm) * .8)},${f(ym)} ${f(xd)},${f(ym + 24)} ${f(xd)},${f(ym + 84)}L${f(xd)},${f(H + 40)}`;
        tick = `M${f(xm)},${f(ym - tk / 2)}L${f(xm)},${f(ym + tk / 2)}`;
        meas.wedge = {ya, yb, apart: yb - ya, leave: [+f(xa), +f(xb)], close: [xm, ym], run: +f(xm - Math.max(xa, xb)), turn: xd};
      }
      tube(tail, mw, 6);
      base += glass(tick, kw, null, false, 1.1, .4);
      halo(tick, Math.min(kw, tall ? 2 : 3));
    }
    if (base) layer(base);
    if (art) for (const t of tiles) tile(card, safe, t, `<defs>${defs}</defs>${art}`);
  }
  const lsvg = `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${light}</svg>`;
  card.style.setProperty('--light', `url("data:image/svg+xml,${encodeURIComponent(lsvg)}")`);
  return {tiles, ang, split, cTop, meas};
}"""
