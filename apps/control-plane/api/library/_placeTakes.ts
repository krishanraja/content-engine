// Takes place themselves (Wave 2, W2.3): once the Inbox job has copied a take
// into the recordings store, it asks GitHub to run
// .github/workflows/place-takes.yml (a repository_dispatch of type
// `take-copied`), which places each new take on its piece with its word clock
// (scripts/post-pack/recording_match.py --record --board --clock). That job
// has no schedule: this dispatch, or a press of Run workflow, is the only way
// it starts.
//
// The dispatch needs a GitHub token allowed to start a workflow in this
// repository (PLACE_TAKES_DISPATCH_TOKEN, docs/INTEGRATIONS.md). Without one
// nothing is sent, the Inbox job says so in its answer, and the home
// computers' pass keeps placing takes as it does today, the fallback until a
// take has gone end to end through the job. A dispatch that fails never fails
// the copy: the take is in the store either way, and the next copy, a press
// or the home pass places it.

export const PLACE_TAKES_EVENT = 'take-copied'
export const PLACE_TAKES_REPO = 'krishanraja/content-engine'

export type PlaceTakesDispatch =
  | { sent: true }
  | { sent: false; reason: 'nothing_new' | 'not_configured' | 'failed'; error?: string }

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; text(): Promise<string> }>

export async function dispatchPlaceTakes(
  takes: number,
  env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<PlaceTakesDispatch> {
  if (!(takes > 0)) return { sent: false, reason: 'nothing_new' }
  const token = String(env.PLACE_TAKES_DISPATCH_TOKEN || '').trim()
  if (!token) return { sent: false, reason: 'not_configured' }
  const repo = String(env.CONTENT_ENGINE_REPO || '').trim() || PLACE_TAKES_REPO
  try {
    const r = await fetcher(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ event_type: PLACE_TAKES_EVENT, client_payload: { takes } }),
    })
    if (r.status === 204) return { sent: true }
    const text = await r.text().catch(() => '')
    return { sent: false, reason: 'failed', error: `github ${r.status}: ${text.slice(0, 120)}` }
  } catch (e: unknown) {
    return { sent: false, reason: 'failed', error: (e as Error)?.message?.slice(0, 120) || 'dispatch failed' }
  }
}
