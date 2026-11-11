// The house layer every style draws through: easing, type, captions, the mark, grain and the close.
// Runs in the browser. Every function draws frame t from t alone, never from state carried between frames.

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const lerp = (a, b, k) => a + (b - a) * k

/** cubic-bezier(x1,y1,x2,y2) as an easing of k in 0..1 (Newton on x). */
export function bezier([x1, y1, x2, y2]) {
  const f = (a1, a2, s) => 3 * a1 * s * (1 - s) ** 2 + 3 * a2 * s * s * (1 - s) + s ** 3
  const df = (a1, a2, s) => 3 * a1 * (1 - s) ** 2 + 6 * (a2 - a1) * s * (1 - s) + 3 * (1 - a2) * s * s
  return (k) => {
    k = clamp(k)
    let s = k
    for (let i = 0; i < 8; i++) { const d = df(x1, x2, s); if (Math.abs(d) < 1e-6) break; s -= (f(x1, x2, s) - k) / d; s = clamp(s) }
    return f(y1, y2, s)
  }
}

/** Progress of an entrance that starts at t0 and lasts dur seconds, on the house enter curve. */
export function enter(env, t, t0, dur) { return env.ease.enter(clamp((t - t0) / (dur ?? env.skin.motion.enter_ms / 1000))) }
export function hero(env, t, t0, dur) { return env.ease.hero(clamp((t - t0) / dur)) }

export function makeEnv(skin, timeline, shape) {
  const W = shape === 'tall' ? 1080 : 1920, H = shape === 'tall' ? 1920 : 1080
  const m = skin.motion
  return {
    skin, timeline, shape, W, H, layout: [], minPx: shape === 'tall' ? 40 : 0, clip: null,
    ease: { enter: bezier(m.enter_bezier), exit: bezier(m.exit_bezier), hero: bezier(m.hero_bezier), utility: bezier(m.utility_bezier) },
    beat: (i) => timeline.beats[i],
    word: (i, needle) => timeline.beats[i].words.find((w) => w.w.toLowerCase().startsWith(needle.toLowerCase())),
    speechEnd: timeline.beats[timeline.beats.length - 1].e,
  }
}

/** Draw text and record where it landed, so the checks can test size, safe zones and repetition. */
export function text(env, ctx, str, x, y, { font, size, color, align = 'left', baseline = 'alphabetic', role = 'label', alpha = 1, weight = 400, style = 'normal', tracking = 0, stretch } = {}) {
  if (alpha <= 0.01 || !str) return 0
  // On the tall canvas a word smaller than 40 px cannot be read on a phone (F44): it is not drawn at all, so an
  // interface seen whole shows its shapes, and its words resolve as the camera comes close enough to read them.
  if (env.minPx && size * Math.hypot(ctx.getTransform().a, ctx.getTransform().b) < env.minPx) return 0
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.fillStyle = color
  ctx.font = `${style} ${weight} ${size}px '${font}'`
  if (stretch) ctx.fontStretch = stretch
  ctx.letterSpacing = `${tracking}px`
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(str, x, y)
  const m = ctx.measureText(str)
  const T = ctx.getTransform()
  ctx.restore()
  const left = align === 'center' ? x - m.width / 2 : align === 'right' ? x - m.width : x
  const top = baseline === 'middle' ? y - size * 0.4 : baseline === 'top' ? y : y - size * 0.75
  // Record the box on the canvas as the viewer sees it (through any stage scale), for the checks.
  const sx = Math.hypot(T.a, T.b)
  let box = [T.a * left + T.c * top + T.e, T.b * left + T.c * 0 + T.d * top + T.f, m.width * sx, size * 0.8 * sx]
  if (env.clip) {
    const [cx, cy, cw, ch] = env.clip
    const x1 = Math.max(box[0], cx), y1 = Math.max(box[1], cy), x2 = Math.min(box[0] + box[2], cx + cw), y2 = Math.min(box[1] + box[3], cy + ch)
    if (x2 <= x1 || y2 <= y1) return m.width
    box = [x1, y1, x2 - x1, y2 - y1]
  }
  if (alpha > 0.5) env.layout.push({ text: str, role, size: Math.round(size * sx), box: box.map(Math.round) })
  return m.width
}

export function grain(env, ctx, t) {
  const s = env.skin
  if (!env._grain) {
    const g = document.createElement('canvas'); g.width = g.height = 256
    const gc = g.getContext('2d'); const d = gc.createImageData(256, 256)
    let seed = 7
    for (let i = 0; i < d.data.length; i += 4) { seed = (seed * 16807) % 2147483647; const v = seed % 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255 }
    gc.putImageData(d, 0, 0); env._grain = g
  }
  const f = Math.floor(t * 30)
  ctx.save(); ctx.globalAlpha = s.grain; ctx.globalCompositeOperation = 'overlay'
  ctx.translate(-((f * 37) % 256), -((f * 91) % 256))
  ctx.fillStyle = ctx.createPattern(env._grain, 'repeat'); ctx.fillRect(0, 0, env.W + 256, env.H + 256)
  ctx.restore()
}

/** The masthead mark on its tile. Wide only: never on vertical video (Ruling, Krish, 2026-11-11). */
export function mark(env, ctx, alpha = 1) {
  if (env.shape === 'tall' || !env.markImg?.complete || alpha <= 0) return
  const tall = env.shape === 'tall'
  const x = tall ? 72 : 96, y = tall ? 228 : 64, size = tall ? 120 : 104
  ctx.save(); ctx.globalAlpha = alpha
  ctx.fillStyle = env.skin.colors.cream
  ctx.fillRect(x, y, size, size)
  const im = env.markImg, r = Math.min((size - 28) / im.width, (size - 28) / im.height)
  ctx.drawImage(im, x + (size - im.width * r) / 2, y + (size - im.height * r) / 2, im.width * r, im.height * r)
  ctx.restore()
}

/** House captions: Archivo 900, up to four words a page, the spoken word lit, on an ink plate, above every
 *  channel's handle zone on the tall canvas (y < 1320) and inside the title-safe box on the wide one. */
export function captionPages(timeline, maxWords = 4) {
  const pages = []
  for (const b of timeline.beats) {
    let cur = []
    b.words.forEach((w, i) => {
      cur.push(w)
      const brk = /[.,:?!]$/.test(w.w) || cur.length === maxWords || i === b.words.length - 1
      if (brk) { pages.push(cur); cur = [] }
    })
  }
  return pages.map((ws, i) => ({ words: ws, s: ws[0].s, e: pages[i + 1] ? Math.min(pages[i + 1][0].s, ws[ws.length - 1].e + 0.6) : ws[ws.length - 1].e + 0.6 }))
}

export function captions(env, ctx, t, { y } = {}) {
  // The approved house caption (Mon 2 Nov): Archivo 900, cream on an ink plate with a hard offset shadow in the
  // series colour, built word by word as he says them, centred, inside the readable width.
  env._pages ??= captionPages(env.timeline, env.shape === 'tall' ? 3 : 6)
  const page = env._pages.find((p) => t >= p.s - 0.05 && t < p.e)
  if (!page) return null
  const c = env.skin.colors, tall = env.shape === 'tall'
  const shown = page.words.filter((w) => t >= w.s - 0.03).map((w) => w.w.replace(/[,:]$/, ''))
  if (!shown.length) return null
  const maxW = tall ? 700 : 1400
  let size = tall ? 56 : 50
  ctx.save()
  const str = shown.join(' ')
  for (;;) { ctx.font = `normal 900 ${size}px 'Archivo'`; if (ctx.measureText(str).width <= maxW - 36 || size <= 44) break; size -= 2 }
  const w = ctx.measureText(str).width
  // Tall: as low as a read word may sit; the plate ends just above every channel's handle zone (y 1320).
  // Tall: a style sets env.captionBase directly under its type block (Krish, 11 Nov: position A); else the safe line.
  const cx = tall ? 490 : env.W / 2, base = y ?? (tall ? env.captionBase ?? 1288 : 1010)
  const px = 18, top = base - size * 0.92, h = size * 1.18 + 10
  ctx.fillStyle = c.channel; ctx.fillRect(cx - w / 2 - px + 9, top + 9, w + px * 2, h)
  ctx.fillStyle = c.ink; ctx.fillRect(cx - w / 2 - px, top, w + px * 2, h)
  ctx.restore()
  text(env, ctx, str, cx - w / 2, base, { font: 'Archivo', size, weight: 900, color: c.cream, role: 'caption' })
  return page
}

/** The frame's dress: the masthead wordmark top left, the series name top right in its colour (Mon 9 Nov). Wide only:
 *  vertical video carries no wordmark or series badge (Ruling, Krish, 2026-11-11: "I don't think they're necessary and
 *  should be permanently removed from all templates"). check.mjs fails a tall cut that draws one. */
export function dress(env, ctx, alpha = 1) {
  if (env.shape === 'tall') return
  if (!env.logoImg?.complete || alpha <= 0) return
  const tall = env.shape === 'tall', c = env.skin.colors
  // Tall: below Instagram's profile account row (270 px) and the grid crop (240 px), config/channel-safe-zones.json.
  const x = tall ? 72 : 96, y = tall ? 292 : 64, w = tall ? 330 : 360
  const im = env.logoImg, h = (w * im.height) / im.width
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(im, x, y, w, h); ctx.restore()
  // Record the wordmark's box too, so check.mjs can refuse anything drawn over or under it.
  if (alpha > 0.5) env.layout.push({ text: '(wordmark)', role: 'dress', size: Math.round(h), box: [x, y, Math.round(w), Math.round(h)] })
  text(env, ctx, env.skin.seriesName, tall ? 860 : env.W - 96, y + h * 0.82, { font: 'IBM Plex Mono', size: tall ? 40 : 36, weight: 600, color: c.channel, align: 'right', role: 'dress', alpha })
}
