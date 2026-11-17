// His takes are in the Inbox (view contract 1.23.0; Krish, 2026-11-17: "whenever I press approve script, the new board
// state should be waiting for me to confirm the videos are in the Inbox, at which point it will fetch the name of the
// video(s) and integrate them in the piece on the board so the next post production prompt does a completely accurate
// job, with all the research, motion styles etc being in one place and decided as well, the post production should always
// be one shot - and can decide where to bring in logos, real visuals, social posts, screen shots, motion design, cinematic
// generation, my face etc etc.").
//
// - Once his scripts are approved (and in his Teleprompter), every card holding the piece waits on one press of his:
//   My takes are in the Inbox (POST /api/board/<Monday>/takes-in).
// - The press reads the Video Engine Inbox by its Drive ID (library/_inboxDrive.ts listInbox), takes the recordings that
//   arrived since he approved the scripts and that no other piece of the week holds (newTakes), and writes their names,
//   Drive ids, sizes and checksums on the piece (meta.takes_in). It then asks GitHub to place them on their cuts by their
//   words (place-takes.yml, library/_placeTakes.ts), as the Inbox job does.
// - From then on the card names the takes, and its next action is the one post-production prompt (productionBrief):
//   every decision in one place, the takes by name with how to fetch them, and the creative calls it makes itself. A
//   production pick still missing comes first, as his press, so the session never decides one for him.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export const TAKES_OP = 'takes-in'
/** A take recorded a little before his approval still counts (he may record as the approval lands). */
export const TAKES_SLACK_MS = 3 * 60 * 60 * 1000
/** A take is a video or an audio recording: a voiceover short recorded in his Teleprompter arrives as audio only, an
 *  .aac named after the script (17 Nov: "Which of your habits will cost you your job once AI is at work__ short cut.aac"
 *  was skipped by a video-only rule, and the press said no take was there). */
const TAKE = /\.(mp4|mov|m4v|webm|mkv|aac|m4a|wav|mp3)$/i
const TAKE_MIME = /^(video|audio)\//

/** The words that say nothing about which piece a file is: joining words, cut and file words, and "AI", which every
 *  piece has. */
const FILLER = new Set(('a an and are as at be by can do does for from has have how i in is it its my of on once or our the this to '
  + 'was we what when where which who why will with you your ai cut cuts short long take takes final video audio voiceover vo '
  + 'mp4 mov aac m4a wav mp3 copy edit editor export dji mimo glamour minute second seconds').split(' '))

/** The words of a name or title that can tell one piece from another, stemmed to a plain root. */
export function nameWords(text: string): Set<string> {
  return new Set(String(text || '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').split(/[^a-z0-9]+/)
    .filter(w => w.length > 1 && !FILLER.has(w) && !/^\d+$/.test(w)).map(w => w.replace(/(ies|es|s)$/, m => (m === 'ies' ? 'y' : '')).replace(/ing$/, '')))
}

/** How many of a file name's telling words a title holds. */
function shared(file: Set<string>, title: Set<string>): number {
  let n = 0
  for (const w of file) if (title.has(w)) n += 1
  return n
}

/** Whether a file name names a title: two telling words in common, or one when the name has only one. */
function names(file: Set<string>, title: Set<string>): boolean {
  const n = shared(file, title)
  return n >= 2 || (n === 1 && file.size === 1)
}

export interface InboxTake { name: string; drive_id: string; bytes: number | null; sha256: string | null; md5: string | null; modified: string }
export interface TakesIn { confirmed_at: string; by: string; since: string | null; files: InboxTake[] }

/** His takes on the piece, as the press wrote them; null when he has not pressed. */
export function takesInOf(meta: unknown): TakesIn | null {
  const t = isObj(meta) && isObj(meta.takes_in) ? meta.takes_in : null
  if (!t || typeof t.confirmed_at !== 'string' || !Array.isArray(t.files)) return null
  const files = t.files.filter(isObj).map(f => ({ name: String(f.name || ''), drive_id: String(f.drive_id || ''), bytes: typeof f.bytes === 'number' ? f.bytes : null,
    sha256: str(f.sha256), md5: str(f.md5), modified: String(f.modified || '') })).filter(f => f.name && f.drive_id)
  return { confirmed_at: t.confirmed_at, by: String(t.by || ''), since: str(t.since), files }
}

/** The Inbox files that are his takes for this piece: video or audio recordings, changed since he approved its scripts
 *  (less the slack), and not already held by another piece. The oldest first, so the order is the order he recorded.
 *  When `own` names this piece (its title, its script titles) and `others` the week's other pieces, a file whose name
 *  names this piece is its take, and only those count once one does; a file whose name names another piece and not this
 *  one is never taken (17 Nov: the build-or-buy takes, dropped minutes after his habits take, would otherwise have gone
 *  on the habits post). A name that names no piece (dji_export_...) still counts when nothing names this piece. */
export function newTakes(files: Array<{ id: string; name?: string; mimeType?: string; size?: string; md5Checksum?: string; sha256Checksum?: string; modifiedTime?: string }>,
  since: string | null, claimed: ReadonlySet<string>, own: readonly string[] = [], others: readonly string[] = []): InboxTake[] {
  const from = since && Number.isFinite(Date.parse(since)) ? Date.parse(since) - TAKES_SLACK_MS : -Infinity
  const mine = own.map(nameWords).filter(t => t.size)
  const theirs = others.map(nameWords).filter(t => t.size)
  const fresh = files
    .filter(f => f.id && f.name && (TAKE.test(f.name) || TAKE_MIME.test(String(f.mimeType || ''))))
    .filter(f => Number.isFinite(Date.parse(String(f.modifiedTime || ''))) && Date.parse(String(f.modifiedTime)) >= from)
    .filter(f => !claimed.has(f.id))
    .map(f => {
      const w = nameWords(String(f.name))
      const best = (ts: Set<string>[]) => ts.reduce((n, t) => Math.max(n, names(w, t) ? shared(w, t) : 0), 0)
      return { f, ours: best(mine), theirs: best(theirs) }
    })
  const named = fresh.filter(x => x.ours > 0 && x.ours >= x.theirs)
  const picked = named.length ? named : fresh.filter(x => x.theirs === 0)
  return picked.map(({ f }) => ({ name: String(f.name), drive_id: f.id, bytes: f.size && /^\d+$/.test(f.size) ? Number(f.size) : null,
      sha256: str(f.sha256Checksum)?.toLowerCase() ?? null, md5: str(f.md5Checksum)?.toLowerCase() ?? null, modified: String(f.modifiedTime) }))
    .sort((a, b) => a.modified.localeCompare(b.modified))
}

/** The press on a card: his only, one tap, no words. `item` names an off-day post, whose record the press may link. */
export function takesPress(pieceId: string, item: string | null = null): Body {
  return { kind: 'press', label: 'My takes are in the Inbox', op: TAKES_OP, body: { piece_id: pieceId, ...(item ? { item } : {}) }, stamp: [],
    goes: 'Reads the Video Engine Inbox, puts the takes you recorded since approving the scripts on this piece by name, and has them placed on their cuts by their words.',
    done: 'Your takes are on the piece. The next Claude production prompt makes the whole cut in one go.' }
}

/** The card's line once his takes are on the piece. */
export function takesLine(t: TakesIn): string {
  const names = t.files.map(f => `"${f.name}"`)
  return `Your take${t.files.length > 1 ? 's are' : ' is'} on the piece: ${names.join(', ')}. Next: one Claude production session makes the finished cut from ${t.files.length > 1 ? 'them' : 'it'}.`
}

export interface BriefInputs {
  pieceId: string
  title: string
  takes: TakesIn
  /** His decisions, each as a line: the story, the look, the motion style, the captions, the scripts. */
  decisions: string[]
  /** The research and materials on file, by title. */
  research: string[]
  /** The approved words, by cut. */
  scripts: Record<string, string>
  /** Whether this is an off-day post (one short) or a series piece (the long cut and the short cut). */
  offday: boolean
}

/** The one post-production prompt's head: everything decided, the takes by name, and the creative calls it makes. */
export function productionBrief(b: BriefInputs): string {
  const fetches = b.takes.files.map(f => `   python scripts/post-pack/recording.py get "${f.name}"${f.sha256 ? `   (or --sha256 ${f.sha256})` : ''}`).join('\n')
  const words = Object.entries(b.scripts).map(([c, w]) => `--- ${c} cut, as he approved it ---\n${w}`).join('\n\n')
  return `This is the one post-production session for "${b.title}" (piece_id ${b.pieceId}). It makes the finished `
    + `${b.offday ? 'short' : 'long cut and the short cut'} in one go from Krish's takes, with nothing left to ask him: every decision is below. `
    + 'The repository is krishanraja/content-engine: read AGENTS.md and CLAUDE.md once, then docs/ve/ENGINE.md and docs/ve/RUNBOOK.md.\n\n'
    + `His decisions (read live with get_piece_board too; never ask him for one again):\n${b.decisions.map(d => `- ${d}`).join('\n')}\n\n`
    + `His takes, confirmed in the Video Engine Inbox ${b.takes.confirmed_at.slice(0, 16).replace('T', ' ')} UTC (meta.takes_in on the piece):\n${fetches}\n`
    + 'If a take is not in the engine yet, recording.py get NAME --wait 15 waits for the Inbox copy; the take-placing job puts each on its cut by its words.\n\n'
    + (b.research.length ? `The research and materials on file (read each with read_piece_material before you plan):\n${b.research.slice(0, 30).map(r => `- ${r}`).join('\n')}\n\n` : '')
    + (words ? `${words}\n\n` : '')
    + 'Make it in one shot:\n'
    + '1. Fetch every take, check each says the approved words, and measure picture against sound (scripts/av_sync.py) before anything is built on it.\n'
    + '2. Plan the cut beat by beat in the signed spec (creative-direction.json, schema_version 2) in his picked look, motion style and captions. '
    + 'For every beat decide, from the research and the words being said, what the picture is: his face on camera, a logo or wordmark (official files only), '
    + 'real visuals (photos, footage, product shots, from their source), a social post or a screenshot (captured from the real page, with its source kept), '
    + 'motion design (a ve device or a Codex plate from a card), or cinematic generation (stills before video, inside the credits he approved). '
    + 'Each choice makes the point land faster (AGENTS.md rule 6), and never repeats the sentence being said.\n'
    + '3. Codex builds the devices and plates from cards (ve card, ve dispatch, ve verify-card); ve renders the cut; ve qc and ve refs run; a separate reviewer '
    + 'watches and listens at full size against the approved words before it is called ready.\n'
    + '4. File the cuts, thumbnails and their records on the piece and in its 3 Posts folder (docs/DRIVE.md). Krish approves; Growth posts.\n\n'
}
