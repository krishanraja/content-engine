import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardBearerExport } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { loadConfig, loadVoiceBlock } from '../_content.js'
import { loadCuratedVoices } from '../_creators.js'
import { LANE_SLUG, mondayOf } from '../_growth.js'
import { KRISH_DOMAINS, NOT_OURS, PACKET_FEATURES, brandChecksOf, brandNamesOf, heldProducts, searchSignalsFor, shippedFor, subjectHostsOf, type SearchSignals } from '../_aeo.js'
// The room lane stays in Control Center, so its 293-line helper does not come
// with this route for one column list. Copied deliberately, named so a drift is
// findable: api/_room.ts CONTACT_COLUMNS in krishanraja/control-center.
const CONTACT_COLUMNS = 'id, full_name, first_name, email, company, title, linkedin_url'

// GET /api/aeo/context?subject=<uuid>|all
//
// Everything the AEO engine (krishanraja/AEO-Engine) needs to research one
// week, read from the rows Control Center already holds. Rows only, no model
// call, no writes. The engine holds no venture list of its own: this is where
// the subjects, their domains and their competitors come from, so adding a
// company on the Growth tab is the whole onboarding.
//
// Per subject: the registry row; for a venture its geo touchpoints (the
// buyer questions on the map), the striking-distance keywords keyed through
// LANE_SLUG (the one map between the two venture key spaces), and every probe
// from the last 28 days; for a prospect the linked Room target and the face
// ICP; and the prior week's digest and queries so the engine can carry a
// query_id forward and compute a trend. A venture also carries its
// search_signals: what Search Console, Bing, GA4 and Clarity say about its own
// hosts, as Control Center's site-visits check read them (null until a read
// has worked, with every read's reason beside them).
//
// It also carries the two things Krish has already told the OS once and
// should never have to say again (2026-09-09): the krish-voice block
// (system_config.content_voice_block, the same text every content call is
// grounded in) and the creators he rates with the move he rates them for
// (content_creators, the registry the Tuesday scrape and the editorial lens
// already read). A recommendation the machine writes has to sound like him
// and reach for the moves he admires, and there is one place that says what
// those are. Adding a voice on the Content side improves the AEO digest the
// same week, with nothing to copy across.
//
// Bearer AEO_ENGINE_SECRET, fail-closed and rate-limited (guardBearerExport).

export const config = { maxDuration: 30 }

const PROBE_WINDOW_DAYS = 28
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The face buyer, from docs/icp.json lane room_face (v3, 2026-09-07). Kept
 *  here as text because the machine only needs the who and the who-not. */
const ROOM_FACE = {
  who: 'A senior leader (CEO, founder, MD, CCO, CRO, GM or equivalent) at a PE or VC backed media, adtech, publishing or data business Krish already knows, quietly behind on what is coming and unable to say so inside their organisation',
  who_not: 'Anyone whose employer sells AI tools; anyone with no warm path to Krish',
}

/** Where Krish himself is cited: a hit on any of these counts as being in
 *  the answer for a venture or a prospect read. */
const KRISH = {
  name: 'Krish Raja',
  domains: [...KRISH_DOMAINS],
  // Never ours, whatever a list says (Ruling, Krish, 2026-11-13).
  not_ours: [...NOT_OURS],
}

type Row = Record<string, any>

const SIGNAL_DAYS = 91
const RECENT_SIGNAL_DAYS = 35
const SIGNAL_ROWS = 1000

/**
 * Each venture subject's search signals by subject id, or null when a read
 * failed (Control Center's tables, migration 20261201094000). One subject at
 * a time: its Search Console weeks through growth_search_gsc_weekly, Bing's
 * weekly rows, Bing's recent index, crawl and keyword rows, and the AI
 * referrals, each newest first and at most 1000 rows.
 */
async function readSearchSignals(subjects: Row[]): Promise<Map<string, SearchSignals> | null> {
  const hostsBy = new Map<string, string[]>()
  for (const s of subjects) {
    if (s.kind !== 'venture') continue
    const hosts = subjectHostsOf(s.domains)
    if (hosts.length) hostsBy.set(String(s.id), hosts)
  }
  if (!hostsBy.size) return new Map()
  const day = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10)
  try {
    const reads = await supabase.from('growth_search_reads').select('source, part, host, last_ok_at, reason, note')
      .in('host', [...new Set([...hostsBy.values()].flat())])
    if (reads.error) throw new Error(reads.error.message)
    const per = await Promise.all([...hostsBy].map(async ([id, hosts]) => {
      const [gsc, bing, recent, referrals] = await Promise.all([
        supabase.rpc('growth_search_gsc_weekly', { p_hosts: hosts, p_days: SIGNAL_DAYS, p_limit: SIGNAL_ROWS }),
        supabase.from('growth_search_signals').select('kind, host, page, query, day, day_to, impressions, clicks, position')
          .eq('source', 'bing').in('kind', ['query', 'page']).in('host', hosts).gte('day', day(SIGNAL_DAYS))
          .order('day', { ascending: false }).limit(SIGNAL_ROWS),
        supabase.from('growth_search_signals').select('kind, host, page, query, day, day_to, indexed, last_crawled, volume, detail')
          .eq('source', 'bing').in('kind', ['url_info', 'crawl_issue', 'keyword']).in('host', hosts).gte('day', day(RECENT_SIGNAL_DAYS))
          .order('day', { ascending: false }).limit(SIGNAL_ROWS),
        supabase.from('growth_search_signals').select('source, host, page, day, ai_source, sessions')
          .in('source', ['ga4', 'clarity']).eq('kind', 'ai_referral').in('host', hosts).gte('day', day(SIGNAL_DAYS))
          .order('day', { ascending: false }).limit(SIGNAL_ROWS),
      ])
      for (const r of [gsc, bing, recent, referrals]) if (r.error) throw new Error(r.error.message)
      return [id, searchSignalsFor(hosts, {
        reads: (reads.data || []) as Row[], gsc: (gsc.data || []) as Row[], bing: (bing.data || []) as Row[],
        recent: (recent.data || []) as Row[], referrals: (referrals.data || []) as Row[],
      })] as const
    }))
    return new Map(per)
  } catch (e: unknown) {
    console.warn('[aeo/context] search signals unread:', (e as Error)?.message?.slice(0, 200))
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardBearerExport(req, res, 'AEO_ENGINE_SECRET', ['GET'])) return

  const want = typeof req.query.subject === 'string' ? req.query.subject : 'all'
  if (want !== 'all' && !UUID.test(want)) return res.status(400).json({ ok: false, error: 'subject must be a uuid or all' })

  try {
    let q = supabase.from('growth_aeo_subjects').select('*').eq('active', true).order('kind').order('name')
    if (want !== 'all') q = q.eq('id', want)
    const subjectsRead = await q
    if (subjectsRead.error) throw new Error(subjectsRead.error.message)
    const subjects = (subjectsRead.data || []) as Row[]
    if (!subjects.length) return res.status(404).json({ ok: false, error: want === 'all' ? 'no active subjects' : 'subject not found or inactive' })

    const ids = subjects.map(s => String(s.id))
    const productSlugs = subjects.map(s => s.product_slug).filter((v): v is string => typeof v === 'string')
    const laneSlugs = productSlugs.map(p => LANE_SLUG[p]).filter((v): v is string => typeof v === 'string')
    const roomIds = subjects.map(s => s.room_target_id).filter((v): v is string => typeof v === 'string')
    const since = new Date(Date.now() - PROBE_WINDOW_DAYS * 86_400_000).toISOString()
    const weekStart = mondayOf(new Date())

    const [voiceBlock, canonConfig, ratedVoices, touchpoints, striking, probes, digests, rooms, engines] = await Promise.all([
      // Told to the OS once, on the Content side, and read here ever since.
      loadVoiceBlock().catch(() => ''),
      loadConfig(['mindmake_canon']).catch(() => ({} as Record<string, unknown>)),
      loadCuratedVoices().catch(() => []),
      productSlugs.length
        ? supabase.from('growth_touchpoints')
          .select('id, product_slug, icp_trigger, watering_hole, coverage_status, cost_efficiency_score')
          .in('product_slug', productSlugs).eq('channel', 'geo').neq('coverage_status', 'retired')
        : Promise.resolve({ data: [], error: null }),
      laneSlugs.length
        ? supabase.from('maya_striking_distance')
          .select('product, query, current_position, previous_position, search_volume, priority, last_checked_at')
          .in('product', laneSlugs)
          .order('priority', { ascending: false, nullsFirst: false })
          .limit(50 * laneSlugs.length)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('growth_geo_probes')
        .select('id, product_slug, subject_id, subject_kind, question, engine, we_cited, competitors_cited, run_at, run_id, query_id')
        .gte('run_at', since)
        // A verify run's probes (an off-week re-check) never stand in for a research week (brief, section I).
        .eq('run_kind', 'research')
        .or(`subject_id.in.(${ids.join(',')})${productSlugs.length ? `,and(subject_id.is.null,subject_kind.eq.venture,product_slug.in.(${productSlugs.join(',')}))` : ''}`)
        .order('run_at', { ascending: false })
        .limit(500 * ids.length),
      supabase.from('growth_aeo_digests')
        .select('id, subject_id, week_start, watch_list, recommendations, competitor_gap, strongest_signal')
        .in('subject_id', ids)
        .lt('week_start', weekStart)
        .order('week_start', { ascending: false })
        .limit(ids.length * 2),
      roomIds.length
        ? supabase.from('room_targets')
          .select(`id, why_face, trigger_signal, trigger_source_url, state, contact:contacts(${CONTACT_COLUMNS})`)
          .in('id', roomIds)
        : Promise.resolve({ data: [], error: null }),
      // Which ventures' growth engines Krish holds: AEO measures them and builds no kit for them (brief, B4).
      supabase.from('growth_engines').select('product_slug, role, activation_state'),
    ])
    for (const r of [touchpoints, striking, probes, digests, rooms, engines]) if (r.error) throw new Error(r.error.message)
    const held = heldProducts((engines.data || []) as Row[])

    // The prior week's queries, one read for every subject's latest digest week.
    const priorBySubject = new Map<string, Row>()
    for (const d of (digests.data || []) as Row[]) if (!priorBySubject.has(String(d.subject_id))) priorBySubject.set(String(d.subject_id), d)
    const priorKeys = [...priorBySubject.values()]
    let priorQueries: Row[] = []
    if (priorKeys.length) {
      const pq = await supabase.from('growth_aeo_queries')
        .select('subject_id, week_start, query_id, query, demand_score, status, trend, panel')
        .in('subject_id', priorKeys.map(d => String(d.subject_id)))
        .in('week_start', [...new Set(priorKeys.map(d => String(d.week_start)))])
        .limit(60 * priorKeys.length)
      if (pq.error) throw new Error(pq.error.message)
      priorQueries = (pq.data || []) as Row[]
    }
    // The cited-pages sheet as AEO last sent it, its own columns only (brief,
    // section J), so the next run can say a mention was acquired or lost.
    let citedPages: Row[] = []
    if (productSlugs.length) {
      const cp = await supabase.from('growth_aeo_cited_pages')
        .select('product_slug, url, host, page_type, questions, engines, times_cited, times_first, mention, mention_ok, checked_at, platform, own')
        .in('product_slug', productSlugs)
        .order('times_first', { ascending: false })
        .limit(60 * productSlugs.length)
      if (cp.error) throw new Error(cp.error.message)
      citedPages = (cp.data || []) as Row[]
    }
    // What each venture's engine says has shipped for its questions (Control
    // Center's growth_answer_shipped, protocol 1.26.0): AEO asks those
    // questions first, and re-checks them in an off week on Krish's approved
    // go-live. Newest first, at most 25 a product.
    let shipped: Row[] = []
    if (productSlugs.length) {
      const sh = await supabase.from('growth_answer_shipped')
        .select('product_slug, question, query_id, url, shipped_at, engine_id, declared_at')
        .in('product_slug', productSlugs)
        .order('declared_at', { ascending: false })
        .limit(25 * productSlugs.length)
      if (sh.error) throw new Error(sh.error.message)
      shipped = (sh.data || []) as Row[]
    }

    // What Search Console, Bing, GA4 and Clarity say about each venture's own
    // hosts (brief, section C), read once a day by Control Center's site-visits
    // check (api/_searchSignals.ts there). AEO-Engine holds none of those keys.
    // A read that fails here leaves every venture's search_signals null:
    // unknown, never zero, and never a failed context.
    const signals = await readSearchSignals(subjects)

    const out = subjects.map(s => {
      const id = String(s.id)
      const product = typeof s.product_slug === 'string' ? s.product_slug : null
      const lane = product ? LANE_SLUG[product] ?? null : null
      const prior = priorBySubject.get(id) || null
      const room = s.room_target_id ? ((rooms.data || []) as Row[]).find(r => r.id === s.room_target_id) || null : null
      const contact = room?.contact && typeof room.contact === 'object' ? room.contact as Row : null
      return {
        id,
        kind: s.kind,
        slug: s.slug,
        name: s.name,
        domains: s.domains || [],
        competitor_domains: s.competitor_domains || [],
        icp_line: s.icp_line ?? null,
        seed_topics: s.seed_topics || [],
        never_say: s.never_say || [],
        product_slug: product,
        lane_slug: lane,
        // A venture's distinctive names and its brand-accuracy checks (brief, B3 and B6), and whether its engine is held (B4).
        brand_names: brandNamesOf(s.brand_names),
        brand_checks: brandChecksOf(s.brand_checks),
        ...(s.kind === 'venture' && product ? { shipped: shippedFor(shipped, product) } : {}),
        ...(s.kind === 'venture' ? { engine_held: !!product && held.has(product) } : {}),
        ...(s.kind === 'venture' ? { search_signals: signals?.get(id) ?? null } : {}),
        room_target: room ? {
          id: room.id,
          // The company and the title, never the person's name or email:
          // the engine's output is read with the anon key.
          company: contact?.company ?? null,
          title: contact?.title ?? null,
          why_face: room.why_face ?? null,
          trigger_signal: room.trigger_signal ?? null,
          trigger_source_url: room.trigger_source_url ?? null,
          state: room.state ?? null,
        } : null,
        touchpoints: product ? ((touchpoints.data || []) as Row[]).filter(t => t.product_slug === product).map(t => ({
          id: t.id, icp_trigger: t.icp_trigger, watering_hole: t.watering_hole ?? null,
          coverage_status: t.coverage_status, cost_efficiency_score: t.cost_efficiency_score ?? null,
        })) : [],
        striking_distance: lane ? ((striking.data || []) as Row[]).filter(r => r.product === lane).map(r => ({
          query: r.query, current_position: r.current_position ?? null, previous_position: r.previous_position ?? null,
          search_volume: r.search_volume ?? null, priority: r.priority ?? null, last_checked_at: r.last_checked_at ?? null,
        })) : [],
        probes_4w: ((probes.data || []) as Row[])
          .filter(p => p.subject_id === id || (p.subject_id == null && p.subject_kind === 'venture' && product && p.product_slug === product))
          .map(p => ({
            id: p.id, question: p.question, engine: p.engine, we_cited: !!p.we_cited,
            competitors_cited: Array.isArray(p.competitors_cited) ? p.competitors_cited : [],
            run_at: p.run_at, run_id: p.run_id ?? null, query_id: p.query_id ?? null,
          })),
        prior: prior ? {
          week_start: prior.week_start,
          strongest_signal: prior.strongest_signal ?? null,
          watch_list: Array.isArray(prior.watch_list) ? prior.watch_list : [],
          recommendations: Array.isArray(prior.recommendations) ? prior.recommendations : [],
          competitor_gap: prior.competitor_gap ?? null,
          queries: priorQueries.filter(q => q.subject_id === id && q.week_start === prior.week_start).map(q => ({
            query_id: q.query_id, query: q.query, demand_score: q.demand_score, status: q.status, trend: q.trend ?? null,
            // The panel exactly as AEO sent it last run, when it sent one.
            ...(q.panel && typeof q.panel === 'object' ? { panel: q.panel } : {}),
          })),
          ...(s.kind === 'venture' && product ? {
            cited_pages: citedPages.filter(c => c.product_slug === product).map(({ product_slug: _p, ...c }) => c),
          } : {}),
        } : null,
      }
    })

    return res.status(200).json({
      ok: true,
      week_start: weekStart,
      generated_at: new Date().toISOString(),
      krish: {
        ...KRISH,
        // How he writes, and the moves he rates. One place, said once, read
        // by the Content engine and by this one. Empty rather than invented
        // when either read fails: a machine writing in a voice it guessed at
        // is worse than one writing plainly.
        voice_block: voiceBlock,
        voices_he_rates: (ratedVoices as Array<{ name: string; why: string }>).map(v => ({ name: v.name, why: v.why })),
        // The business canon: krishanraja/mindmake project-documentation
        // 00_NORTH_STAR.md, the file that repo calls the one to read if you
        // read only one, written so a model arriving with no context can
        // decide on Mindmake's behalf. It is what tells the research machine
        // which answers are worth trying to win. Without it the machine
        // recommends whatever it is absent from, which is a category term a
        // jobs board already owns.
        canon: typeof canonConfig.mindmake_canon === 'string' ? canonConfig.mindmake_canon : '',
      },
      icp: { room_face: ROOM_FACE },
      // The optional packet fields the ingest accepts; the engine sends a field only when it is listed.
      packet_features: [...PACKET_FEATURES],
      subjects: out,
    })
  } catch (e: unknown) {
    return res.status(500).json({ ok: false, error: (e as Error)?.message?.slice(0, 200) || 'context_failed' })
  }
}
