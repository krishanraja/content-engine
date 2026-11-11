import { createHash } from 'node:crypto'

// The one contract of GET /api/board/<Monday>/view, which Control Centre's Publish Board reads (Ruling, Krish,
// 2026-11-11: "when I make other updates to the publish board and content engine, they do not regress this work, they
// just elegantly upgrade the publish board in the content tab").
//
// The shape is apps/control-plane/api/board/view.schema.json, versioned by its x-contract-version, which every view
// carries as contract_version. The rule (docs/PUBLISH_BOARDS.md, "The view's contract"): add freely; never remove or
// rename a field. An addition is a minor bump and Control Centre draws what it does not know generically; a removal,
// a rename or a widened type is a major bump, and Control Centre falls back to the archive page for a major it does
// not know. tests/control-plane/board-view-contract.test.ts validates every view built against the schema, and
// scripts/check-view-contract.ts (npm run check:view-contract) fails a breaking change that is not a major bump.

export const VIEW_CONTRACT_VERSION = '1.3.0'

/** The view's entity tag: what it says, never when it was read, so a read that finds nothing new answers 304. */
export function viewEtag(view: Record<string, unknown>): string {
  const { as_of: _asOf, ok: _ok, ...rest } = view
  return `"v${VIEW_CONTRACT_VERSION.split('.')[0]}-${createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 32)}"`
}

/** Whether a request's If-None-Match names this tag (a list, or a weak form, counts). */
export function notModified(ifNoneMatch: string | string[] | undefined, etag: string): boolean {
  const raw = Array.isArray(ifNoneMatch) ? ifNoneMatch.join(',') : ifNoneMatch || ''
  if (!raw) return false
  if (raw.trim() === '*') return true
  return raw.split(',').map(t => t.trim().replace(/^W\//, '')).includes(etag)
}
