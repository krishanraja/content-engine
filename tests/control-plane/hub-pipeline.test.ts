import { afterEach, expect, it, vi } from 'vitest'
import { bodyHash } from '../../apps/control-plane/api/_factGate.js'
import { readSnapshot } from '../../apps/control-plane/lib/hub/snapshot.js'

const io = vi.hoisted(() => {
  vi.stubEnv('SUPABASE_URL','https://fixture.invalid')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fixture-only')
  return { readPage:vi.fn(),readArticle:vi.fn(),model:vi.fn(),facts:vi.fn(),panel:vi.fn(),quotes:vi.fn() }
})
vi.mock('../../apps/control-plane/lib/hub/articles.js', () => ({ readPage:io.readPage,readArticle:io.readArticle }))
vi.mock('../../apps/control-plane/api/_content.js', async load => ({ ...await load<object>(),callClaude:io.model }))
vi.mock('../../apps/control-plane/api/content-ideas/[id]/fact-check.js', () => ({ checkSourcedBody:io.facts }))
vi.mock('../../apps/control-plane/api/_judges/panel.js', async load => ({ ...await load<object>(),runPanel:io.panel }))
vi.mock('../../apps/control-plane/lib/hub/markets.js', async load => ({ ...await load<object>(),fetchMarkets:io.quotes }))
afterEach(() => vi.unstubAllGlobals())

// Supabase's real query builder talks to this offline transport. No model, database or provider account is used.
it('persists the verified edition, serves it publicly, refreshes only prices and survives the next failed edition', async () => {
  const now = Date.parse('2026-11-26T06:00Z')
  const rows: any[] = []
  const read = vi.fn(async (input: any, init: any) => {
    const u = new URL(input)
    expect(u.origin).toBe('https://fixture.invalid')
    const table = u.pathname.split('/').at(-1)
    const body = init.body ? JSON.parse(init.body) : null
    const reply = (data: unknown,status=200) => new Response(JSON.stringify(data),{ status,headers:{ 'Content-Type':'application/json' } })
    if (table === 'hub_claim_run') return reply(true)
    if (table === 'content_ideas') {
      expect(u.searchParams.get('state')).toBe('eq.published')
      expect(u.searchParams.get('limit')).toBe('3')
      return reply([1,2,3].map(i => ({ id:'p'+i,idea:'Published '+i,published_at:'2026-11-25T15:00:00Z',published_url:'https://publisher.example/p/'+i })))
    }
    if (table !== 'hub_snapshots') return reply([])
    if (init.method === 'GET') {
      const before = u.searchParams.get('edition_date')?.slice(3)
      return reply(rows.filter(r => !before || r.edition_date < before).sort((a,b) => b.edition_date.localeCompare(a.edition_date)).slice(0,1))
    }
    if (init.method === 'PATCH') {
      expect(u.searchParams.get('revision')).toBe('eq.'+rows[0].revision)
      rows[0] = body
    } else {
      expect(init.method).toBe('POST')
      rows.push(body)
    }
    return reply({ revision:body.revision,payload:body.payload })
  })
  vi.stubGlobal('fetch',read)
  const trades = ['www.billboard.com','musically.com']
  io.readPage.mockImplementation(async (url: string) => {
    const host = new URL(url).hostname
    const entries = !trades.includes(host) ? [] : Array.from({ length:10 },(_,i) =>
      '<item><title>AI music licensing event '+i+'</title><link>https://'+host+'/story/'+i+'</link><pubDate>25 Nov 2026 16:00 GMT</pubDate></item>')
    return { url,body:'<rss><channel>'+entries.join('')+'</channel></rss>' }
  })
  io.readArticle.mockImplementation(async url => ({ url,text:'Published account of AI music licensing event '+url.split('/').at(-1) }))
  io.model.mockImplementation(async opts => {
    const input = JSON.parse(opts.user)
    if (opts.agent === 'hub-relevance') return JSON.stringify({ stories:input.map((r:any) => ({ ids:[r.id],subsector:'music' })) })
    return JSON.stringify({ headline:input.title,dek:'The publisher documented the offer.',why:'The licence covers studios.',
      companies:[],people:[],accusation:false,subject:'a mixing desk in the studio' })
  })
  io.facts.mockImplementation(async (body: string) => ({
    version:1,body_hash:bodyHash(body),passed:!body.includes('event 8'),independent_checker:'fixture',blocking:0,claims:[{ on_file:{ verdict:'supported' } }],
  }))
  io.panel.mockImplementation(async input => ({ verdicts:[{ score:input.artifact.includes('event 9') ? 4 : 9,verdict:'pass',adversarial:false }] }))
  const chart = (price: number) => ({ SPOT:{ currency:'USD',closes:[{ symbol:'SPOT',day:'2026-11-24',price:90,currency:'USD' }],
    live:{ day:'2026-11-25',price },asOf:'2026-11-25T21:00:00Z' } })
  io.quotes.mockResolvedValue(chart(100))

  const { refresh } = await import('../../apps/control-plane/lib/hub/pipeline.js')
  const { default:handler } = await import('../../apps/control-plane/api/hub/today.js')
  const response = async (method='GET') => {
    const result = { code:0,body:null as any,headers:{} as Record<string,string> }
    const res = { setHeader:(k:string,v:string) => { result.headers[k]=v },status:(n:number) => { result.code=n;return res },json:(data:unknown) => { result.body=data } }
    await handler({method} as any,res as any)
    return result
  }

  expect(await response()).toMatchObject({ code:503,body:{ok:false},headers:{'Cache-Control':'no-store'} })
  expect((await response('POST')).code).toBe(405)
  expect(await refresh('daily',now)).toMatchObject({ edition_date:'2026-11-26',items:8,indexnow:'skipped' })
  const morning = await response()
  expect(morning.code).toBe(200)
  expect(morning.headers).toMatchObject({ 'Access-Control-Allow-Origin':'*','Cache-Control':expect.stringContaining('s-maxage=300') })
  expect(readSnapshot(morning.body)).toEqual(morning.body)
  expect(morning.body.items).toHaveLength(8)
  expect(morning.body.pieces).toHaveLength(3)
  expect(morning.body.items.every((i:any) => i.coverage === 2)).toBe(true)
  expect(morning.body.items.filter((i:any) => i.image.brief)).toHaveLength(3)
  expect(morning.body.subsectors.find((s:any) => s.key === 'music').story_count).toBe(8)
  expect(morning.body.trends.map((t:any) => [t.key,t.items.length,t.moving])).toEqual([['money',0,null],['behaviour',0,null],['technology',0,null]])
  expect(morning.body.ticker.stocks.SPOT.price).toBe(100)
  expect(io.model.mock.calls.filter(([o]) => o.agent === 'hub-relevance')).toHaveLength(1)
  expect(await refresh('daily',now + 1000)).toEqual({ skipped:'already published' })
  const calls = io.model.mock.calls.length
  io.quotes.mockResolvedValue(chart(110))
  await refresh('prices',now + 9 * 3600000)
  const afternoon = await response()
  expect(afternoon.body.ticker.stocks.SPOT.price).toBe(110)
  expect(afternoon.body.items).toEqual(morning.body.items)
  expect(io.model).toHaveBeenCalledTimes(calls)
  io.quotes.mockResolvedValueOnce({})
  await expect(refresh('prices',now + 10 * 3600000)).rejects.toThrow('prices_unavailable')
  expect((await response()).body).toEqual(afternoon.body)
  io.model.mockRejectedValue(Error('provider unavailable'))
  await expect(refresh('daily',now + 86400000)).rejects.toThrow()
  expect((await response()).body).toEqual(afternoon.body)
  await refresh('prices',now + 33 * 3600000)
  const heldEdition = (await response()).body
  expect(heldEdition.edition_date).toBe(morning.body.edition_date)
  expect(heldEdition.items).toEqual(morning.body.items)

  rows.push({ edition_date:'2026-11-27',revision:'bad',payload:{ ok:true,items:[] } })
  expect((await response()).body).toEqual(heldEdition)
  read.mockRejectedValue(Error('database offline'))
  expect(await response()).toMatchObject({ code:503,body:{ ok:false },headers:{ 'Cache-Control':'no-store' } })
},30000)

it('counts each outlet once across repeated links, aliases and coverage on two feeds', async () => {
  const { outletCount } = await import('../../apps/control-plane/lib/hub/editorial.js')
  const members = [['Trade','trade.example'],['Trade UK','trade.example'],['Trade UK','uk.trade.example'],['Another outlet','another.example']]
  expect(outletCount(members.map(([outlet,domain]) => ({ outlet,domain })) as any)).toBe(2)
})

it('picks trend stories by lane, and writes what is moving only from checked stories that pass the fact gate', async () => {
  const ed = await import('../../apps/control-plane/lib/hub/editorial.js')
  const row = (i: number, trend: string) => ({ title: 'AI spending story '+i, url: 'https://news.example/'+trend+'/'+i, summary: 'AI investment rose',
    date: '2026-11-27T10:00:00Z', outlet: 'News '+i, domain: 'news'+i+'.example', sector: '', trend })
  io.model.mockImplementationOnce(async (opts: any) => {
    expect(opts.agent).toBe('hub-trends')
    return JSON.stringify({ stories: [{ trend:'money',ids:[0] },{ trend:'money',ids:[1] },{ trend:'behaviour',ids:[0] },{ trend:'behaviour',ids:[2] },{ trend:'astrology',ids:[2] }] })
  })
  const groups = await ed.classifyTrends([row(1,'money'),row(2,'money'),row(3,'behaviour')])
  expect(groups.map(g => [g.trend,g.members[0].url])).toEqual([
    ['money','https://news.example/money/1'],['money','https://news.example/money/2'],['behaviour','https://news.example/behaviour/3']])

  const items = [{ id:'t1',trend:'money',date:'2026-11-27',source:'News 1',url:'https://news.example/money/1',headline:'Spending rose',dek:'A firm said spending rose.',why:'Because demand grew.',coverage:1 }]
  io.model.mockResolvedValueOnce(JSON.stringify({ moving:'Spending on AI is rising.',why:'The firm says demand grew.' }))
  io.facts.mockImplementationOnce(async (body: string) => ({ version:1,body_hash:bodyHash(body),passed:true,independent_checker:'fixture',blocking:0,claims:[{ on_file:{ verdict:'supported' } }] }))
  expect(await ed.writeTrendLine({ key:'money',label:'Money' },items)).toEqual({ moving:'Spending on AI is rising.',why:'The firm says demand grew.' })
  expect(io.facts.mock.calls.at(-1)![2]).toContain('Because demand grew.')

  io.model.mockResolvedValueOnce(JSON.stringify({ moving:'Spending on AI will triple.',why:'Everyone wants it.' }))
  io.facts.mockImplementationOnce(async (body: string) => ({ version:1,body_hash:bodyHash(body),passed:false,independent_checker:'fixture',blocking:1,claims:[{ on_file:{ verdict:'unsupported' } }] }))
  expect(await ed.writeTrendLine({ key:'money',label:'Money' },items)).toBeNull()
  io.model.mockResolvedValueOnce(JSON.stringify({ moving:null,why:null }))
  expect(await ed.writeTrendLine({ key:'money',label:'Money' },items)).toBeNull()
  expect(await ed.writeTrendLine({ key:'money',label:'Money' },[])).toBeNull()
})
