import { get } from 'node:https'
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { plain, webUrl } from './feeds.js'
import { userAgent } from './types.js'

const reserved = new BlockList()
for (const [address, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],
  ['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],
  ['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]] as const) reserved.addSubnet(address,bits)

// Pin each connection to a checked public address, including after a publisher redirect.
export async function readPage(input: string) {
  let url = webUrl(input)
  const signal = AbortSignal.timeout(12_000)
  for (let hop = 0; url && hop < 5; hop++) {
    if (isIP(url.hostname) || !url.hostname.includes('.') || url.hostname.endsWith('.local')) throw Error('invalid_host')
    const { address } = await lookup(url.hostname, { family: 4 })
    if (reserved.check(address)) throw Error('invalid_address')
    const page = await new Promise<{ location?: string; body?: string }>((resolve, reject) => {
      get(url!, { signal, family: 4, agent: false, lookup: (_host, _opts, cb) => cb(null, address, 4),
        headers: { 'User-Agent': userAgent, 'Accept-Encoding': 'identity' } }, res => {
        res.on('error', reject)
        if ([301,302,303,307,308].includes(res.statusCode!) && res.headers.location) {
          resolve({ location: res.headers.location }); res.destroy(); return
        }
        if (res.statusCode !== 200) { reject(Error('http_' + res.statusCode)); res.destroy(); return }
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > 5_000_000) { res.destroy(Error('page_too_large')); return }
          chunks.push(chunk)
        })
        res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8') }))
      }).on('error', reject)
    })
    if (page.body !== undefined) return { url: url.href, body: page.body }
    url = webUrl(page.location!, url.href)
  }
  throw Error('invalid_redirect')
}

export function articleText(html: string) {
  const body = html.replace(/<(script|style|aside|nav|header|footer|figure)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  const main = body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? body
  return [...main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m => plain(m[1])).filter(t => t.length >= 35).join('\n').slice(0, 6500)
}

async function publisherLink(page: { url: string; body: string }) {
  const u = new URL(page.url)
  const id = u.pathname.match(/\/(?:articles|read)\/([\w-]+)$/)?.[1]
  const signature = page.body.match(/data-n-a-sg="([^"]+)"/)?.[1]
  const stamp = Number(page.body.match(/data-n-a-ts="(\d+)"/)?.[1])
  if (!id || !signature || !stamp) throw Error('unresolved_news_link')
  const locale = [['en-GB','GB',['WEB_FRONTEND','EMAIL'],null,null,1,1,'GB:en',null,1,null,null,null,null,null,0,1],
    'en-GB','GB',1,[1,1,1],1,1,null,0,0,null,0]
  const request = JSON.stringify(['garturlreq',locale,id,stamp,signature])
  const response = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST', body: new URLSearchParams({ 'f.req': JSON.stringify([[['Fbv4je',request]]]) }),
    headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw Error('news_lookup_failed')
  const frames = JSON.parse((await response.text()).replace(/^\)\]\}'\s*/, ''))
  const frame = frames.find((f: unknown[]) => f[0] === 'wrb.fr' && f[1] === 'Fbv4je')
  const result = JSON.parse(frame?.[2] ?? 'null')
  if (result?.[0] !== 'garturlres' || !webUrl(result[1])) throw Error('missing_publisher')
  return result[1] as string
}

export async function readArticle(link: string) {
  let page = await readPage(link)
  if (new URL(page.url).hostname === 'news.google.com') page = await readPage(await publisherLink(page))
  const text = articleText(page.body)
  if (text.length < 240 || new URL(page.url).pathname === '/' || /(^|\.)google\.com$/.test(new URL(page.url).hostname)) throw Error('missing_article')
  return { url: page.url, text }
}
