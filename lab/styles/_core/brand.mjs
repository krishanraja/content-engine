// The brand skin every library style wears (docs/plans/2026-11-10-video-style-system/STYLE-CATALOGUE.md, 2a).
// Krish, 2026-11-10: "everything in the style library needs to be skinned slightly in my branding".
// Read from the house configs at build time; no colour is copied into a style.
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))

const FONT_DIR = 'assets/fonts/makeyourmindup'
const FONTS = [
  ['Anton', 'Anton-Regular.ttf', 'normal', '400'],
  ['Archivo', 'Archivo-Variable.ttf', 'normal', '100 900'],
  ['Fraunces', 'Fraunces-Upright-Variable.ttf', 'normal', '100 900'],
  ['Fraunces', 'Fraunces-Italic-Variable.ttf', 'italic', '100 900'],
  ['IBM Plex Mono', 'IBMPlexMono-Regular.ttf', 'normal', '400'],
  ['IBM Plex Mono', 'IBMPlexMono-Medium.ttf', 'normal', '500'],
  ['IBM Plex Mono', 'IBMPlexMono-SemiBold.ttf', 'normal', '600'],
  ['IBM Plex Mono', 'IBMPlexMono-Bold.ttf', 'normal', '700'],
]

/** The masthead mark and wordmark live in Control Center's brand folder; each hash must match studio.json. */
function findMark(theme, which = 'mark') {
  const want = theme.publication[which]
  const candidates = [process.env[`MYMU_${which.toUpperCase()}`], join(ROOT, '..', 'control-center', want.source_path)].filter(Boolean)
  for (const p of candidates) {
    if (existsSync(p) && createHash('sha256').update(readFileSync(p)).digest('hex') === want.sha256) return p
  }
  throw new Error(`masthead ${which} not found with sha256 ${want.sha256.slice(0, 12)}; set MYMU_${which.toUpperCase()} to its path`)
}

export function skin(series = 'follow_the_money') {
  const studio = readJson('config/studio.json')
  const theme = studio.brand_themes.find((t) => t.theme_id === 'makeyourmindup-video-v1')
  const tokens = readJson('config/ve/brand-tokens.json')
  const safe = readJson('config/channel-safe-zones.json')
  const anchors = JSON.stringify(theme).match(/"channel_colors":(\{[^}]*\})/)
  const channels = JSON.parse(anchors[1])
  const channel = channels[series]
  if (!channel) throw new Error(`no series colour for ${series}`)
  const c = theme.colors
  return {
    series,
    channels,
    colors: { ink: c.ink, inkSoft: c.surface, line: c.line, cream: c.text, creamSoft: c.secondary_text, muted: c.muted_text, mint: c.mint, onMint: c.mint_ink, channel },
    type: { display: 'Anton', structure: 'Archivo', dek: 'Fraunces', data: 'IBM Plex Mono' },
    grain: tokens.finish.grain_opacity,
    motion: tokens.motion,
    safe: { tall: safe.channels, wide: tokens.geometry.wide_title_safe, tallKey: tokens.geometry.tall_safe_key_text },
    mark: pathToFileURL(findMark(theme)).href,
    logo: pathToFileURL(findMark(theme, 'logo')).href,
    paper: pathToFileURL(join(ROOT, 'assets/plates/two-passports/paper.jpg')).href,
    seriesName: series.replaceAll('_', '.'),
    close: ['BUILT TO', 'HELP YOU', 'DECIDE.'],
    fontCss: FONTS.map(([fam, file, style, weight]) =>
      `@font-face{font-family:'${fam}';src:url('${pathToFileURL(join(ROOT, FONT_DIR, file)).href}');font-style:${style};font-weight:${weight};}`).join('\n'),
  }
}
