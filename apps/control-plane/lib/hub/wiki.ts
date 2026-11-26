import { plain } from './feeds.js'
import { dayMs, isoDay, optional, userAgent, type Attention, type Draft, type Entity, type Image } from './types.js'

const none = (): Image => ({ kind: null, url: null })
export function commonsImage(info: any, kind: 'person' | 'company', accusation = false): Image | null {
  const meta = info?.extmetadata
  const licence = plain(String(meta?.LicenseShortName?.value ?? '')).trim()
  if (!/^(?:public domain|CC0(?: 1\.0)?|CC BY(?:-SA)? \d\.\d(?: [A-Z]{2})?)$/i.test(licence)) return null
  if (meta.Restrictions?.value || /(?:^|[-/ ])(?:nc|nd)(?:[-/ ]|$)/i.test(String(meta.LicenseUrl?.value || ''))) return null
  const artist = plain(String(meta.Artist?.value || meta.Attribution?.value || ''))
  if (!artist) return null
  if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/i.test(info.descriptionurl) ||
      !/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//i.test(info.url) || !/^image\/(?:jpeg|webp|png)$/i.test(info.mime)) return null
  const subject = plain(String(meta.ObjectName?.value || '') + ' ' + String(meta.ImageDescription?.value || '') + ' ' + String(meta.Categories?.value || ''))
  if (/\b(?:logo|logos|wordmark|screenshot|illustration|painting|drawing|rendering)\b/i.test(subject + ' ' + info.descriptionurl.replace(/[_-]/g,' '))) return null
  // Company pages often lead with the founder, the company logo or a product render.
  if (kind === 'company') {
    const property = /\b(?:headquarters|head office|facade|façade|building|campus|exterior|offices|storefront|stadium)\b/i.test(subject)
    const object = /\b(?:products?|console|equipment|cameras?|recording studio|signage|venues?|hardware|factory)\b/i.test(subject)
    if (/\b(?:portraits?|headshots?|CEO|founders?|speakers?)\b/i.test(subject) || !(property || (!accusation && object))) return null
  }
  return { kind, url: info.url, credit: 'Photo: ' + artist + ', ' + licence + ', via Wikimedia Commons', file_page: info.descriptionurl }
}

export function parseViews(entity: Entity, payload: any, end: string): Attention | null {
  const rows = new Map<string, number>()
  for (const row of Array.isArray(payload?.items) ? payload.items : []) {
    if (!/^\d{8}00$/.test(row.timestamp) || !Number.isSafeInteger(row.views) || row.views < 0) continue
    const t = row.timestamp
    rows.set(t.slice(0,4) + '-' + t.slice(4,6) + '-' + t.slice(6,8), row.views)
  }
  const today = rows.get(end)
  if (today === undefined) return null
  let total = 0
  for (let i = 1; i <= 30; i++) {
    const value = rows.get(isoDay(Date.parse(end) - i * dayMs))
    if (value === undefined) return null
    total += value
  }
  return { ...entity, as_of: end, views_today: today, avg_30d: total / 30, spiking: total > 0 && today * 30 >= 3 * total }
}

export function wikiClient(deadline = Infinity) {
  let next = 0
  const cache = new Map<string, Promise<any>>()
  function json(url: string): Promise<any> {
    const hit = cache.get(url)
    if (hit) return hit
    const start = Math.max(Date.now(), next)
    if (start + 5500 > deadline) return Promise.reject(Error('wiki_time_budget'))
    next = start + 1050
    const request = (async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, start - Date.now())))
      const res = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw Error('wiki_' + res.status)
      const data: any = await res.json()
      if (data.error) throw Error('wiki_query_failed')
      return data
    })()
    cache.set(url, request)
    return request
  }
  async function query(host: string, params: Record<string, string>) {
    const data = await json('https://' + host + '/w/api.php?' + new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', redirects: '1', ...params }))
    return data?.query?.pages || []
  }
  async function image(entity: Entity, kind: 'person' | 'company', accusation = false) {
    const [found] = await query('en.wikipedia.org', { titles: entity.wiki_title, prop: 'pageimages|pageprops' + (kind === 'company' ? '|images' : ''),
      piprop: 'name', pilicense: 'free', imlimit: '40' })
    const page = found && !found.missing && found.ns === 0 && found.pageprops?.disambiguation === undefined ? found : null
    if (kind === 'person') {
      const id = page?.pageprops?.wikibase_item
      if (!/^Q\d+$/.test(id || '')) return null
      const data = await json('https://www.wikidata.org/w/api.php?' + new URLSearchParams({
        action: 'wbgetclaims', format: 'json', entity: id, property: 'P31' }))
      if (!data.claims?.P31?.some((c: any) => c.mainsnak?.datavalue?.value?.id === 'Q5')) return null
    }
    const names: string[] = page?.pageimage ? ['File:' + page.pageimage] : []
    if (kind === 'company') {
      names.push(...(page?.images || []).map((im: any) => String(im.title)).filter((t: string) =>
        /headquarter|head.office|building|campus|stadium|office|exterior/i.test(t)).slice(0,8))
    }
    const properties = { prop: 'imageinfo', iiprop: 'url|mime|extmetadata' }
    const files = names.length ? await query('commons.wikimedia.org', { titles: names.join('|'), ...properties }) : []
    for (const name of names) {
      const file = files.find((p: any) => p.title?.replace(/_/g,' ') === name.replace(/_/g,' '))
      const result = commonsImage(file?.imageinfo?.[0], kind, accusation)
      if (result) return result
    }
    if (kind === 'company') {
      const companyId = page?.pageprops?.wikibase_item
      const subject = /^Q\d+$/.test(companyId || '') ? 'haswbstatement:P180=' + companyId :
        'incategory:"' + entity.name.replace(/["|]/g,'') + '"'
      const matches = await query('commons.wikimedia.org', { generator: 'search', gsrnamespace: '6', gsrlimit: '6',
        gsrsearch: subject + ' filetype:bitmap', ...properties })
      for (const file of matches) {
        const photo = commonsImage(file.imageinfo?.[0],kind,accusation)
        if (photo) return photo
      }
    }
    return null
  }
  async function attention(entity: Entity, now: number) {
    // The current UTC day is incomplete. Give the most recent completed day its actual date.
    const end = isoDay(now - dayMs)
    const date = (ms: number) => isoDay(ms).replace(/-/g,'')
    const url = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/' +
      encodeURIComponent(entity.wiki_title.replace(/ /g,'_')) + '/daily/' + date(now - 31 * dayMs) + '/' + date(now - dayMs)
    return parseViews(entity, await json(url), end)
  }
  return { image, attention }
}

export function generateStill(brief: string): Image {
  return { kind: 'generated', url: null, brief }
}

export async function chooseImage(draft: Draft, index: number, lookup: ReturnType<typeof wikiClient>['image']) {
  if (!draft.accusation) {
    for (const person of draft.people) {
      const photo = await optional('person photo', null, () => lookup(person,'person'))
      if (photo) return photo
    }
  }
  for (const company of draft.organisations) {
    const photo = await optional('company photo', null, () => lookup(company,'company',draft.accusation))
    if (photo) return photo
  }
  if (draft.organisations.length || index >= 3 || !draft.subject) return none()
  return generateStill('Photoreal editorial photojournalism. Photograph ' + draft.subject +
    ' in natural light. No people, readable logos or text.')
}
