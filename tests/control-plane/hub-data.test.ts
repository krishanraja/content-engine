import { describe, expect, it, vi } from 'vitest'
import { parseFeed, feeds, feedHealth, onBeat } from '../../apps/control-plane/lib/hub/feeds.js'
import { articleText } from '../../apps/control-plane/lib/hub/articles.js'
import { buildMarkets, equalWeight, parseYahoo, validSymbol } from '../../apps/control-plane/lib/hub/markets.js'
import { chooseImage, commonsImage, parseViews, wikiClient } from '../../apps/control-plane/lib/hub/wiki.js'
import { dayMs, isoDay, optional, type Draft } from '../../apps/control-plane/lib/hub/types.js'

const now = Date.parse('2026-11-26T15:00:00Z')
const google = feeds.find(f => f.outlet === 'Google News')!
const trade = feeds[0]!
const entity = { name: 'Example', wiki_title: 'Example' }
describe('edition inputs', () => {
  it('reads RSS CDATA, the original Google outlet, its URL and the two-day window', () => {
    const xml = '<rss><channel><item><title><![CDATA[AI music & rights - Trade]]></title><link>https://news.google.com/rss/articles/123</link><source url="https://www.trade.example">Trade</source><description>&lt;b&gt;Licensing&lt;/b&gt;</description><pubDate>25 Nov 2026 18:00:00 GMT</pubDate></item><item><title>Old</title><pubDate>20 Nov 2026</pubDate></item></channel></rss>'
    const [row] = parseFeed(xml,google,now)
    expect(row).toMatchObject({ title: 'AI music & rights', summary:'Licensing', outlet:'Trade', domain:'trade.example', sector:'music' })
    expect(parseFeed(xml,google,now + 2 * dayMs)).toEqual([])
    expect(feeds.filter(f => f.outlet === 'Google News')).toHaveLength(6)
    expect(feeds).toHaveLength(18)
    expect(new URL(google.url).searchParams.get('q')).toBe('AI music when:2d')
  })
  it('reads alternate Atom links and rejects malformed XML', () => {
    const xml = '<feed><entry><title>Games &amp; art</title><link rel="alternate" href="https://publisher.example/game"/><updated>2026-11-26</updated></entry></feed>'
    expect(parseFeed(xml,trade,now)[0]).toMatchObject({ title:'Games & art',url:'https://publisher.example/game' })
    expect(() => parseFeed('<rss><item></rss>',trade,now)).toThrow()
  })
  it('uses sport keywords and their false-positive exceptions', () => {
    const row = { summary:'',title:'Premier League clubs test AI' } as any
    expect(onBeat(row)).toBe(true)
    expect(onBeat({ ...row,title:'New sports car revealed' })).toBe(false)
  })
  it('rests an empty feed after seven dates, without counting retries as another day', () => {
    const first = feedHealth(trade.url,'2026-11-20',false)
    expect(feedHealth(trade.url,'2026-11-20',false,first)).toEqual(first)
    let state = first
    for (let day = 21; day <= 25; day++) state = feedHealth(trade.url,'2026-11-' + day,false,state)
    expect(state.retry_on).toBeNull()
    expect(feedHealth(trade.url,'2026-11-26',false,first).empty_since).toBe('2026-11-26')
    const dead = feedHealth(trade.url,'2026-11-26',false,state)
    expect(dead.retry_on).toBe('2026-12-03')
    expect(feedHealth(trade.url,'2026-12-03',true,dead)).toMatchObject({ retry_on:null, empty_since:null })
  })
  it('extracts publisher paragraphs without scripts, navigation or article photos', () => {
    const text = 'A studio announced that it would license the recordings to film producers.'
    expect(articleText('<nav><p>irrelevant menu</p></nav><article><p>' + text + '</p><figure><img src="photo.jpg"></figure></article>')).toBe(text)
  })
})

describe('Creative 24', () => {
  const at = (s: string) => Date.parse(s)/1000
  const meta = { symbol:'TEST.L',currency:'GBp',regularMarketPrice:250,regularMarketTime:at('2026-11-26T14:55Z'),
    currentTradingPeriod:{ regular:{ start:at('2026-11-26T08:00Z'),end:at('2026-11-26T16:30Z') } } }
  const payload = { chart:{ result:[{ meta,timestamp:['2026-11-23','2026-11-24','2026-11-25','2026-11-26T08:00Z'].map(at),
    indicators:{ quote:[{ close:[200,null,225,247] }] } }] } }
  it('converts GBp quotes and closes, skips missing candles and keeps an open-session quote out of the close table', () => {
    expect(parseYahoo('TEST.L',payload,now)).toMatchObject({ currency:'GBP', live:{ day:'2026-11-26',price:2.5 },
      closes:[{ day:'2026-11-23',price:2 },{ day:'2026-11-25',price:2.25 }] })
    expect(parseYahoo('TEST.L',{ chart:{ result:null } },now)).toBeNull()
    expect(parseYahoo('OTHER',payload,now)).toBeNull()
    expect(validSymbol('SPOT?symbol=BAD')).toBe(false)
  })
  it('equal weights local-currency returns and aligns holiday gaps by date', () => {
    const points = (p: [string,number][]) => p.map(([day,price]) => ({ day,price }))
    const a = points([['2026-10-26',20],['2026-10-27',40],['2026-10-28',30]])
    const b = points([['2026-10-26',200],['2026-10-28',100]])
    expect(equalWeight([a,b])).toEqual({ series:[100,150,100],month_pct:0,day_pct:-33.3333 })
    expect(equalWeight([a,b.slice(1)]).series).toEqual([100])
    expect(equalWeight([])).toEqual({ series:[],month_pct:null,day_pct:null })
  })
  it('retains the dated last good close on a provider miss and exposes missing prices as null', () => {
    const m = buildMarkets(now,[{ day:'2026-11-25',symbol:'SPOT',price:120,currency:'USD' }],{})
    expect(Object.keys(m.ticker.stocks)).toHaveLength(24)
    expect(Object.keys(m.indexes)).toHaveLength(6)
    expect(m.ticker.stocks.SPOT).toMatchObject({ price:120,missing:true,as_of:'2026-11-25',day_pct:null })
    expect(m.ticker.stocks.NFLX).toMatchObject({ price:null,currency:null,missing:true })
    const next = buildMarkets(now + dayMs,[],{},m.ticker)
    expect(next.ticker.stocks.SPOT).toMatchObject({ price:120,missing:true,as_of:'2026-11-25' })
  })
  it('keeps a newer same-day observation when a provider serves an older quote', () => {
    const quote = { currency:'USD',closes:[],live:{ day:'2026-11-26',price:120 },asOf:'2026-11-26T14:55:00Z' }
    const morning = buildMarkets(now,[],{ SPOT:quote })
    const delayed = { ...quote,live:{ ...quote.live,price:112 },asOf:'2026-11-26T13:00:00Z' }
    expect(buildMarkets(now,[],{ SPOT:delayed },morning.ticker).ticker.stocks.SPOT).toMatchObject({ price:120,as_of:quote.asOf })
  })
})

describe('Wikimedia', () => {
  const info = { url:'https://upload.wikimedia.org/wikipedia/commons/0/01/portrait.jpg', descriptionurl:'https://commons.wikimedia.org/wiki/File:Portrait.jpg',
    mime:'image/jpeg',extmetadata:{ Artist:{value:'<a>Jane Smith</a>'},LicenseShortName:{value:'CC BY-SA 4.0'} } }
  it('allows only the requested licences and carries the Commons file and credit', () => {
    for (const licence of ['Public domain','CC0','CC BY 4.0','CC BY-SA 3.0']) {
      expect(commonsImage({ ...info,extmetadata:{ ...info.extmetadata,LicenseShortName:{value:licence} } },'person')?.credit)
        .toBe('Photo: Jane Smith, ' + licence + ', via Wikimedia Commons')
    }
    for (const licence of ['CC BY-NC 4.0','CC BY-ND 3.0','fair use','GFDL','']) {
      expect(commonsImage({ ...info,extmetadata:{ ...info.extmetadata,LicenseShortName:{value:licence} } },'person')).toBeNull()
    }
    expect(commonsImage(info,'person')?.file_page).toBe(info.descriptionurl)
    expect(commonsImage({ ...info,url:'https://publisher.example/image.jpg' },'person')).toBeNull()
    expect(commonsImage(info,'company')).toBeNull()
  })
  it('tries people before companies, and bypasses all portraits on an accusation', async () => {
    const draft = { people:[entity],organisations:[entity],accusation:false,subject:'the mixing console in a recording studio' } as Draft
    const lookup = vi.fn(async (_,kind) => commonsImage(info,kind))
    expect((await chooseImage(draft,0,lookup)).kind).toBe('person')
    lookup.mockClear()
    expect((await chooseImage({ ...draft,accusation:true },0,lookup)).kind).toBeNull()
    expect(lookup.mock.calls.map(r => r[1])).toEqual(['company'])
    const absent = vi.fn(async () => null)
    expect((await chooseImage(draft,0,absent)).kind).toBeNull()
    expect(absent.mock.calls).toHaveLength(2)
    const unnamed = { ...draft,people:[],organisations:[] }
    expect(await chooseImage(unnamed,2,absent)).toMatchObject({ kind:'generated',url:null,brief:expect.stringContaining(draft.subject) })
    expect(await chooseImage(unnamed,3,absent)).toEqual({ kind:null,url:null })
  })
  it('can find an attributed company building on Commons without an English Wikipedia page', async () => {
    const photo = { ...info,extmetadata:{ ...info.extmetadata,ImageDescription:{ value:'Example headquarters building' } } }
    const requests: URL[] = []
    vi.stubGlobal('fetch',async (input: string) => {
      const url = new URL(input)
      requests.push(url)
      const pages = url.hostname === 'en.wikipedia.org' ? [{ missing:true }] : [{ imageinfo:[photo] }]
      return Response.json({ query:{ pages } })
    })
    try {
      expect((await wikiClient().image(entity,'company'))?.kind).toBe('company')
      expect(requests[1]?.searchParams.get('gsrsearch')).toContain('incategory:"Example"')
    } finally { vi.unstubAllGlobals() }
  })
  it('compares a completed day to exactly 30 preceding days, independently of row order', () => {
    const end = '2026-11-25'
    const items = Array.from({ length:31 },(_,i) => ({ timestamp:isoDay(Date.parse(end) - i * dayMs).replace(/-/g,'') + '00',views:i === 0 ? 30 : 10 }))
    expect(parseViews(entity,{items},end)).toMatchObject({ views_today:30,avg_30d:10,spiking:true,as_of:end })
    expect(parseViews(entity,{items:items.slice(1)},end)).toBeNull()
    expect(parseViews(entity,{items:items.slice(0,-1)},end)).toBeNull()
  })
})

it('a stage falls back on a hiccup but a budget refusal reaches the run', async () => {
  const warn = vi.spyOn(console,'warn').mockImplementation(() => {})
  expect(await optional('editorial stage',[],async () => { throw Error('provider unavailable') },['editorial_budget_unavailable'])).toEqual([])
  await expect(optional('editorial stage',[],async () => { throw Error('editorial_budget_unavailable') },['editorial_budget_unavailable']))
    .rejects.toThrow('editorial_budget_unavailable')
  expect(await optional('catalogue',['kept'],async () => { throw Error('editorial_budget_unavailable') })).toEqual(['kept'])
  warn.mockRestore()
})
