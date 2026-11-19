// Every week's ideas board carries the meme templates (Ruling, Krish, 2026-11-19: "every week's ideas board should include
// the meme templates feature as well"). The Sunday run writes 6 to 10 a week from the 30 Nov board (idea_checks.py
// TEMPLATE_FROM), and a template he has not answered on the week before stays on offer: it is carried onto this week's
// Tuesday and Thursday (where the lane lives) until he answers it, so no week's board is ever without the lane. One he
// answered (any press on its idea), one approved into an item, and one this week already offers (by its clip's page) is
// never carried. Pure.
type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const DAYS = ['tue', 'thu'] as const

const isTemplate = (o: unknown): o is Body => isObj(o) && o.kind === 'meme' && isObj(o.template)
const pageOf = (o: Body) => String(((o.template as Body)?.clip as Body | undefined)?.page ?? '').trim().toLowerCase()

/** This week's ideas with last week's unanswered templates carried onto the same day, each marked carried_from. */
export function carryTemplates(ideas: Body | null, lastWeek: string, lastIdeas: Body | null, lastQueue: Array<{ doc_id: string; body: unknown }>,
  approvedOptionIds: Set<string>): Body | null {
  if (!lastIdeas || !isObj(lastIdeas.offdays)) return ideas
  const answered = new Set(lastQueue.filter(q => isObj(q.body) && isObj((q.body as Body).idea) && ((q.body as Body).idea as Body).verdict).map(q => q.doc_id))
  const base: Body = ideas && isObj(ideas) ? ideas : {}
  const offdays: Body = isObj(base.offdays) ? { ...(base.offdays as Body) } : {}
  const offered = new Set(Object.values(offdays).flatMap(v => (Array.isArray(v) ? v : [])).filter(isTemplate).map(pageOf).filter(Boolean))
  const ids = new Set(Object.values(offdays).flatMap(v => (Array.isArray(v) ? v : [])).filter(isObj).map(o => String(o.id)))
  let carried = 0
  for (const day of DAYS) {
    const from = (lastIdeas.offdays as Body)[day]
    for (const o of Array.isArray(from) ? from : []) {
      if (!isTemplate(o)) continue
      const id = String(o.id)
      const page = pageOf(o)
      if (!id || !page || answered.has(`off-${day}-${id}`) || approvedOptionIds.has(id) || offered.has(page) || ids.has(id)) continue
      offdays[day] = [...(Array.isArray(offdays[day]) ? offdays[day] as unknown[] : []), { ...o, carried_from: lastWeek }]
      offered.add(page); ids.add(id); carried++
    }
  }
  return carried ? { ...base, offdays } : ideas
}
