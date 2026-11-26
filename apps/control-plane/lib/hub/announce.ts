// After the daily edition is saved, makeyourmindup.ai is asked to tell IndexNow that today's edition page, the home page
// and the six desks changed. IndexNow reaches Bing, whose index feeds ChatGPT search and Copilot, so a new edition is
// found within minutes instead of on the next crawl. The site holds the IndexNow key and submits only once it can read
// today's published edition itself. This step is additive: an unset secret or a failed call is logged and never fails,
// repeats or delays the edition (Krish, 2026-11-26: make the page the most discoverable by search and AI engines).
export const INDEXNOW_ENDPOINT = 'https://www.makeyourmindup.ai/api/indexnow'

export type Announced = 'accepted' | 'skipped' | 'failed'

export async function announceEdition(): Promise<Announced> {
  const secret = process.env.MAKEYOURMINDUP_INDEXNOW_SECRET
  if (!secret) { console.warn('hub indexnow skipped: secret unset'); return 'skipped' }
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, { method: 'POST', headers: { authorization: 'Bearer ' + secret },
      signal: AbortSignal.timeout(15_000) })
    if (res.ok) return 'accepted'
    console.warn('hub indexnow refused', res.status)
  } catch { console.warn('hub indexnow unreachable') }
  return 'failed'
}
