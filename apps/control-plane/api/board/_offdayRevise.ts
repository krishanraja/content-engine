// A revised off-day card when Krish presses Improve (Ruling, Krish, 2026-11-01, locking the off-day mock: Improve
// sends his words back "and a revised card returns in its place"). The board asks GitHub to run
// .github/workflows/offday-revise.yml (a repository_dispatch of type `offday-revise`), where Claude Code revises that
// one option on his subscription from his exact words and rebuilds the week's board. That job has no schedule: this
// dispatch, or a press of Run workflow, is the only way it starts (Ruling, Krish, 2026-10-29: "I want zero Claude
// routines").
//
// The dispatch needs a GitHub token allowed to start a workflow in this repository: OFFDAY_REVISE_DISPATCH_TOKEN, or
// the place-takes token PLACE_TAKES_DISPATCH_TOKEN, which has the same scope (docs/INTEGRATIONS.md). Without one
// nothing is sent and the press says so; his words are kept either way and the next Sunday reads them.

export const OFFDAY_REVISE_EVENT = 'offday-revise'
export const OFFDAY_REVISE_REPO = 'krishanraja/content-engine'

export type ReviseDispatch = { sent: true } | { sent: false; reason: 'not_configured' | 'failed'; error?: string }
type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; text(): Promise<string> }>

export async function dispatchOffdayRevise(
  payload: { week: string; option: string; side: string; words: string },
  env: Record<string, string | undefined> = process.env,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<ReviseDispatch> {
  const token = String(env.OFFDAY_REVISE_DISPATCH_TOKEN || env.PLACE_TAKES_DISPATCH_TOKEN || '').trim()
  if (!token) return { sent: false, reason: 'not_configured' }
  const repo = String(env.CONTENT_ENGINE_REPO || '').trim() || OFFDAY_REVISE_REPO
  try {
    const r = await fetcher(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ event_type: OFFDAY_REVISE_EVENT, client_payload: payload }),
    })
    if (r.status === 204) return { sent: true }
    const text = await r.text().catch(() => '')
    return { sent: false, reason: 'failed', error: `github ${r.status}: ${text.slice(0, 120)}` }
  } catch (e: unknown) {
    return { sent: false, reason: 'failed', error: (e as Error)?.message?.slice(0, 120) || 'dispatch failed' }
  }
}
