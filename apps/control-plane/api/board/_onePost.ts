// One post is one off-day item (docs/PUBLISH_BOARDS.md, "One post, one item"). Ruling (Krish, 2026-11-12): the board
// shows exactly where everything is, and one post is one item that can never sprawl across days or go stale.
//
// Until now an item's identity was the option id it was first offered under (engine:<week>:<option>). A session that
// moved a post by copying it (Tue 17's povteach became Thu 12's agentnotsetup on 11 Nov, by deleting the first and
// writing the second with a new id) left two items for one post: his Approve stood on Tue 17 while the same post was
// put up for Thu 12, and the board showed it on both days. So an off-day option is known by what it is, not by the id
// a session gave it:
//
//   item:<key>       the item it names (an option a re-plan carries says so: `"item": "engine:2026-11-16:povteach"`)
//   hook:<words>     its hook, the post's own headline, in plain lower-case words (12 characters or more); a weekly
//                    option (Saturday's good news, whose hook repeats every week) is known by its week as well
//   drive:<id>       the post's own folder in Drive (3 Posts), which holds one post
//   asset:<site:id>  the one public post or video it reposts (a YouTube Short, an Instagram reel, a TikTok, an X post),
//                    never an article it cites: two posts may cite one article
//
// Two options that share any key are one post. The database computes the same keys from the same option
// (offday_post_keys, supabase/migrations/20261130090000_offday_one_post.sql) and refuses a second item of a post on a
// day; tests/offday-one-post-db.mjs holds the two equal on the same options. Pure.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export const ITEM_REF = /^(engine|growth):(\d{4}-\d{2}-\d{2}):([a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59})$/
/** A hook shorter than this is too plain to name one post ("Good news.", "POV"). */
export const HOOK_MIN = 12

/** A hook in plain lower-case words: every run of anything but a to z and 0 to 9 is one space. Null when it is too
 *  short to name a post. The database's offday_post_keys does exactly this. */
export function hookWords(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const w = v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return w.length >= HOOK_MIN ? w : null
}

/** Whether an option is a weekly one (its hook repeats every week). The database reads it the same way. */
export function isWeekly(o: Body): boolean {
  const w = o.weekly
  return w !== undefined && w !== null && w !== false && w !== ''
}

/** The one public post or video a link names, or null for anything else (an article, a profile, a search). */
export function assetOf(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const u = url.trim()
  let m = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:shorts\/|watch\?(?:[^#]*&)?v=)([A-Za-z0-9_-]{6,20})/i.exec(u)
    || /^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{6,20})/i.exec(u)
  if (m) return `youtube:${m[1]}`
  m = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/i.exec(u)
  if (m) return `instagram:${m[1]}`
  m = /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[A-Za-z0-9_.]+\/(?:video|photo)\/(\d{5,25})/i.exec(u)
  if (m) return `tiktok:${m[1]}`
  m = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]+\/status\/(\d{5,25})/i.exec(u)
  if (m) return `x:${m[1]}`
  return null
}

/** The post folder in Drive an option names, by ID. */
export function driveOf(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{20,80})/.exec(v.trim())
  return m ? m[1] : null
}

/** Every key that names the post an option is (see the header), sorted. `item` is the item the option is (its own key
 *  or a row's); `week` the week it was first offered, for a weekly hook; `drive` a folder the row keeps. */
export function postKeys(o: Body, ctx: { item?: string | null; week?: string | null; drive?: string | null } = {}): string[] {
  const keys = new Set<string>()
  if (ctx.item && ITEM_REF.test(ctx.item)) keys.add(`item:${ctx.item}`)
  if (typeof o.item === 'string' && ITEM_REF.test(o.item)) keys.add(`item:${o.item}`)
  const hook = hookWords(o.hook)
  if (hook) keys.add(isWeekly(o) ? `hook:${ctx.week || ''}:${hook}` : `hook:${hook}`)
  const drive = driveOf(o.drive) || (ctx.drive && /^[A-Za-z0-9_-]{20,80}$/.test(ctx.drive) ? ctx.drive : null)
  if (drive) keys.add(`drive:${drive}`)
  const src = isObj(o.source) ? o.source.url : null
  const asset = assetOf(src)
  if (asset) keys.add(`asset:${asset}`)
  return [...keys].sort()
}

/** Whether two sets of keys name one post. */
export function samePost(a: readonly string[], b: readonly string[]): boolean {
  if (!a.length || !b.length) return false
  const s = new Set(a)
  return b.some(k => s.has(k))
}

/** A row of offday_items, read for the one thing this needs: its keys. */
export interface KeyedRow { item: string; option: Body; origin_week: string; drive_folder: string | null }
export const rowKeys = (r: KeyedRow): string[] => postKeys(r.option, { item: r.item, week: r.origin_week, drive: r.drive_folder })

/** Every pair of options in a set of week plans that are one post under two ids, for the guard (board_truth): the same
 *  post may sit in only one place, unless the second names the first as the item it carries. Pure. */
export function duplicatePosts(plans: Record<string, Body | null>): Array<{ post: string; a: string; b: string }> {
  const seen: Array<{ ref: string; keys: string[]; item: string | null }> = []
  const out: Array<{ post: string; a: string; b: string }> = []
  for (const [week, plan] of Object.entries(plans).sort()) {
    const offdays = isObj(plan) && isObj(plan.offdays) ? plan.offdays : {}
    for (const [day, list] of Object.entries(offdays)) {
      for (const o of Array.isArray(list) ? list.filter(isObj) : []) {
        if (typeof o.id !== 'string') continue
        const own = `engine:${week}:${o.id}`
        const keys = postKeys(o, { week })
        const ref = `${week} ${day} ${o.id}`
        for (const s of seen) {
          if (s.ref.split(' ')[2] === o.id && s.ref.split(' ')[0] !== week) continue // the same idea offered again in a later week: its own id
          const named = (typeof o.item === 'string' && o.item === s.item) || s.keys.includes(`item:${own}`)
          if (!named && samePost(keys, s.keys)) out.push({ post: keys.filter(k => s.keys.includes(k))[0], a: s.ref, b: ref })
        }
        seen.push({ ref, keys, item: own })
      }
    }
  }
  return out
}
