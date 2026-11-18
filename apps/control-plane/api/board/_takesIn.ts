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

import { SHORT_CAP_SECONDS } from './_productionPlan.js'

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
export function newTakes(files: InboxFile[], since: string | null, claimed: ReadonlySet<string>, own: readonly string[] = [], others: readonly string[] = []): InboxTake[] {
  return pickTakes(files, since, claimed, own, others).files
}

type InboxFile = { id: string; name?: string; mimeType?: string; size?: string; md5Checksum?: string; sha256Checksum?: string; modifiedTime?: string }

/** newTakes with how it chose: `named` when a file's name names this piece, and `groups`, the distinct recordings by
 *  name (a long and a short of one name are one) among the takes it would take when none does. More than one group with
 *  nothing naming this piece is never taken: on 18 Nov the data-centres press took the build-or-buy and skeletons takes
 *  too, because no name matched any piece's stored title (Krish, 2026-11-18: "everything needs to tag to the right
 *  piece"). */
export function pickTakes(files: InboxFile[], since: string | null, claimed: ReadonlySet<string>, own: readonly string[] = [], others: readonly string[] = []):
  { files: InboxTake[]; named: boolean; groups: string[] } {
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
  // The recordings by name: a file whose name holds no telling word (dji_0012.mp4) belongs to no group of its own.
  const groupOf = (n: string) => [...nameWords(n)].sort().join(' ')
  const groups = [...new Set(picked.map(({ f }) => groupOf(String(f.name))).filter(Boolean))]
  return { named: named.length > 0, groups: named.length ? [] : groups,
    files: picked.map(({ f }) => ({ name: String(f.name), drive_id: f.id, bytes: f.size && /^\d+$/.test(f.size) ? Number(f.size) : null,
      sha256: str(f.sha256Checksum)?.toLowerCase() ?? null, md5: str(f.md5Checksum)?.toLowerCase() ?? null, modified: String(f.modifiedTime) }))
      .sort((a, b) => a.modified.localeCompare(b.modified)) }
}

/** Every name each piece and off-day post of the week goes by on the board (its day's title, its card's title), keyed
 *  by piece id and by item key, from the week view the board draws. The stored `idea` can be a piece's first idea long
 *  after the board renamed it (18 Nov: Wed's "Build or buy your tools in an AI world?" was stored as "The labs writing
 *  everyone's code still run Salesforce"), so a take is matched against what Krish sees. */
export function boardNames(view: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const add = (k: unknown, t: unknown) => {
    if (typeof k !== 'string' || !k || typeof t !== 'string' || !t.trim()) return
    const key = k.toLowerCase().replace(/^piece:/, '')
    out.set(key, [...new Set([...(out.get(key) || []), t.trim()])])
  }
  const v = isObj(view) ? view : {}
  for (const d of Array.isArray(v.days) ? v.days.filter(isObj) : []) {
    if (typeof d.piece_id === 'string') add(d.piece_id, d.title)
    for (const p of Array.isArray(d.pieces) ? d.pieces.filter(isObj) : []) add(p.id, p.title)
  }
  const model = isObj(v.model) ? v.model : {}
  for (const d of Array.isArray(model.days) ? model.days.filter(isObj) : []) {
    for (const it of Array.isArray(d.items) ? d.items.filter(isObj) : []) { add(it.key, it.title); if (typeof it.piece_id === 'string') add(it.piece_id, it.title) }
  }
  return out
}

/** The line when the Inbox holds takes for more than one piece and none of their names says which is this one's. */
export function unclearLine(groups: string[]): string {
  return `Your Video Engine Inbox has takes for ${groups.length} different recordings (${groups.map(g => `"${g}"`).join(', ')}) and none of their names says which is this piece's. `
    + 'Rename this piece\'s files with words from its title (or move the others out), then press again.'
}

/** The press on a card: his only, one tap, no words. `item` names an off-day post, whose record the press may link. */
export function takesPress(pieceId: string, item: string | null = null): Body {
  return { kind: 'press', label: 'My takes are in the Inbox', op: TAKES_OP, body: { piece_id: pieceId, ...(item ? { item } : {}) }, stamp: [],
    goes: 'Reads the Video Engine Inbox, puts the takes you recorded since approving the scripts on this piece by name, has them placed on their cuts by their words, and starts your production plan.',
    done: 'Your takes are on the piece. Your production plan is being made from them; open it on the card when it is ready.' }
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
  /** The production plan he reviewed, with his swaps applied (_productionPlan.ts planBrief), when it is on file. */
  plan?: string | null
}

/** The one post-production prompt's head: everything decided, the takes by name, and the creative calls it makes. */
export function productionBrief(b: BriefInputs): string {
  // Each take by name, by its Drive link and by how to fetch it (Krish, 2026-11-18: "The My takes Are In button should
  // already have fetched the right video URL from the Inbox and loaded it in to the prompt").
  const fetches = b.takes.files.map(f => `   ${f.name}: https://drive.google.com/file/d/${f.drive_id}/view\n      python scripts/post-pack/recording.py get "${f.name}"${f.sha256 ? `   (or --sha256 ${f.sha256})` : ''}`).join('\n')
  const words = Object.entries(b.scripts).map(([c, w]) => `--- ${c} cut, as he approved it ---\n${w}`).join('\n\n')
  return `This is the one post-production session for "${b.title}" (piece_id ${b.pieceId}). It makes the finished `
    + `${b.offday ? 'short' : 'long cut and the short cut'} in one go from Krish's takes, with nothing left to ask him: every decision is below. `
    + 'The repository is krishanraja/content-engine: read AGENTS.md and CLAUDE.md once, then docs/ve/ENGINE.md and docs/ve/RUNBOOK.md. '
    + `Before anything else run python3 scripts/check_failures.py and python3 scripts/floor.py --format ${b.offday ? 'short_video' : 'long_video and --format short_video'}: `
    + 'every past post-production failure and rejection there (smeared plates, cues timed to a transcript, text cut at the device edge, a known fault '
    + 'rendered with a caveat, glitched speed-ups) is a check this cut must pass, and any production skill added since is followed.\n\n'
    + `His decisions (read live with get_piece_board too; never ask him for one again):\n${b.decisions.map(d => `- ${d}`).join('\n')}\n\n`
    + `His takes, confirmed in the Video Engine Inbox ${b.takes.confirmed_at.slice(0, 16).replace('T', ' ')} UTC (meta.takes_in on the piece):\n${fetches}\n`
    + 'If a take is not in the engine yet, recording.py get NAME --wait 15 waits for the Inbox copy; the take-placing job puts each on its cut by its words.\n\n'
    + (b.research.length ? `The research and materials on file (read each with read_piece_material before you plan):\n${b.research.slice(0, 30).map(r => `- ${r}`).join('\n')}\n\n` : '')
    + (words ? `${words}\n\n` : '')
    + (b.plan ? `${b.plan}\n` : 'No production plan is on file yet: make it first, as docs/production/PRODUCTION_PLAN.md says, then make the cut from it.\n\n')
    + 'Make it in one shot:\n'
    + '1. Fetch every take, check each says the approved words, and measure picture against sound (scripts/av_sync.py) before anything is built on it.\n'
    + `2. The edit pass, before any picture (python3 scripts/post-pack/edit_pass.py on the take's word timings): find every place he restarted a sentence and keep only his last full attempt; cut the empty, awkward silences (leave a breath, about a quarter second); then measure the total. ${b.offday ? `A short must run under ${SHORT_CAP_SECONDS} seconds: if the kept take is longer, speed the whole of it up evenly (pitch kept, never past 1.25x) until it fits.` : `The short cut must run under ${SHORT_CAP_SECONDS} seconds: if its kept take is longer, speed it up evenly (pitch kept, never past 1.25x) until it fits. The long cut has no length limit and is never sped up.`} Listen to every cut and the sped-up result before going on.\n`
    + '3. Plan the cut beat by beat in the signed spec (creative-direction.json, schema_version 2) in his picked look, motion style and captions, on the timings of the edited take. '
    + 'Draw each picture from his own words in the approved script or from the research on the piece (read every research material first; a number, a place, '
    + 'a named person or a real document there is often the strongest picture), and say which. Push each beat\'s picture to the top of one lever, '
    + 'impact, hilarity, absurdity, exaggeration or beauty, never at the cost of clarity: ask what would make it a 100 out of 10 and not a 7, and make that. '
    + 'Say who makes it: Codex in code (motion, a diagram, a device, a plate), a generation, the real thing from its source, or Krish himself when '
    + 'only he can get it (a photo, a prop, a screen recording, a document on his desk); ask him for those once, together, at the start, and build the rest meanwhile. '
    + 'For every beat decide what the picture is: his face on camera, a logo or wordmark (official files only), '
    + 'real visuals (photos or footage of what he is talking about, from their source), a social post or a screenshot (a screenshot of the real page or product he '
    + 'names, or a real viral social post that relates to what he says, captured from the post itself with its link kept), motion design (a ve device or a Codex plate from a card), or a '
    + 'generated scene (cinematic generation). Each choice makes the point land faster (AGENTS.md rule 6), and never repeats the sentence being said. '
    + 'A logo on a beat is the official mark of a company he names; the house logo appears only on the animated title frame and the close card, '
    + 'never in the body (config/brand-palette.json logo_rule, docs/production/BRAND_PALETTE.md; Ruling, Krish, 2026-11-17).\n'
    + '4. Two consultants suggest; this session and Krish decide, and quality comes first (Ruling, Krish, 2026-11-18). Ask divergent-thinker '
    + '(the Control Center connector\'s divergent_run in provoke mode, or krishanraja/divergent-thinker\'s CLI) for pictures outside the obvious on the beats '
    + 'that carry the piece, and the humour engine for the comic readings below; take a suggestion only when it beats your own choice on clarity and its '
    + 'lever, never because it was offered, and record what you used with divergent_record. '
    + 'The humour: ask the humour engine (krishanraja/humour-engine, its README section 4) what comic readings his own words carry, and read his humour '
    + 'style from ai-harness (krish-principles and krish-voice, through get_skill). Where a line holds a gold moment, put a hilarious, absurd picture on '
    + 'it: in the build-or-buy piece he called a software engineer as confident as a crocodile hunter, so the picture is a nerdy engineer creeping up on a '
    + 'crocodile. Never invent a joke his words do not carry, and never point it at the viewer or at a named person\'s competence.\n'
    + '5. Generated stills and motion, with the higgsfield-generator skills (krishanraja/higgsfield-generator; read higgsfield-generate/SKILL.md and its '
    + 'references/model-catalog.md and prompt-engineering.md first). Each generated beat in the plan carries its recipe: make exactly that. Stills before '
    + 'video, always: a still on gpt_image_2_6 by default (soul_cinematic for a cinematic frame, soul_location for a place with no people, recraft_v4_1 for '
    + 'an icon or vector mark, nano_banana_flash for an illustrated character), at 9:16 for the short and 16:9 for the long cut, checked against the beat '
    + 'before anything moves; then motion from that approved still on seedance_2_5 (mode omni_reference, --start-image the still, the beat\'s own length, '
    + '1080p). A clip that exists at the wrong shape goes through the reframe workflow, never a new generation. Price the whole list first with '
    + 'higgsfield generate cost, stay inside the credits he approved, and record each job\'s piece, beat, model and id on the piece. Never Marketing '
    + 'Studio presets or avatars, never Higgsfield audio (music comes only from the licensed library, MINDMAKE_MUSIC_ROOT), and never Soul ID for him. '
    + 'Once the cut is reviewed, run the Virality Predictor (brain_activity --video on the finished short) and give him its hook and sustain scores beside '
    + 'the reviewer\'s verdict, as a signal, never a gate. His face in a generated scene '
    + 'comes only from a likeness approved in krishanraja/krish-clone\'s registry (config/synthetic-approvals.json; krish-avatar-heygen today), never '
    + 'from a new face model; judge every such still or clip with clone likeness against his own photos, and ve lint (voice.synthetic) must pass. '
    + 'Codex builds the devices and plates from cards (ve card, ve dispatch, ve verify-card).\n'
    + '6. Show him mocks along the way, never only at the end (Krish, 2026-11-18: "the prompt should have the session show me mocks along the way"): '
    + 'once the beats are planned, a still of each key beat in his picked look (python3 scripts/post-pack/plan_scene.py on a real frame or a real image); '
    + 'then each generated still and each Codex plate as it is made, before anything moves; then a low-resolution proof of the cut before the full render. '
    + 'Show each in this session as you go, and file each on the piece (board_session.py PIECE add FILE --role plan_scene, with the beat in its title) so it '
    + 'shows on his card. Keep working while he looks; whatever he changes, change before the full render.\n'
    + '7. ve renders the cut; ve qc and ve refs run; a separate reviewer watches and listens at full size against the approved words before it is called ready.\n'
    + '8. The covers: follow the cover-art skill (.agents/skills/cover-art/SKILL.md), which gives each channel its cover by his channel strategy '
    + '(the face-free Receipt from thumbnail-designer on the brand accounts, a face-led cover in the week\'s variant on his own, both on YouTube as its '
    + 'A/B pair; the face-led cards are docs/ve/cards/w-face-covers), a separate critic judging them and his pick in his own words. File the cuts, covers '
    + 'and their records on the piece and in its 3 Posts folder (docs/DRIVE.md). Krish approves; Growth posts.\n'
    + '9. Make the board true before you stop (Krish, 2026-11-18: "when a piece is produced, the session has to be told to file things properly to the drive and then never really bothers to update the board - this is unacceptable"). '
    + 'Putting a file in Drive does not move his card: the card reads the piece\'s making record, so write it for each cut as you finish it: '
    + `python3 scripts/post-pack/making.py ${b.pieceId} video long|short NAME PATH --url <the file's Drive link> --thumb PATH --thumb-file <the local thumbnail>`
    + ` (and making.py ${b.pieceId} drive-link long|short <Drive link> for each cut's link), and file each cover on the piece. Then read the board back, `
    + `with get_piece_board (or board_session.py ${b.pieceId} show and making.py ${b.pieceId} show): the card must now say the cuts are made and filed, with their files in the post folder. `
    + 'If it still shows the old stage, find which record is missing and write it; never call the piece done on the strength of the Drive upload alone. '
    + 'Report done only with the stage the board now shows and where each file is, and report blocked, naming the record, if you cannot write one.\n\n'
}
