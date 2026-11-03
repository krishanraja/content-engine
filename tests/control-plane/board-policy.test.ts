import { describe, expect, it, vi } from 'vitest'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({}) }))
import { boardPolicy } from '../../apps/control-plane/api/board/_handler.js'

// Krish, 2026-11-03, of the Saturday mock that showed as a broken picture: "Permanently ensure the publish board doesn't
// look as stupid and shitty as this when a carousel is complete". A board asset redirects to a signed file-store link, so
// the page's policy must let pictures and video load from that store, and from nowhere else.
describe('board page policy', () => {
  it('lets board pictures and video load from the file store the asset route redirects to', () => {
    const p = boardPolicy('https://store.example.supabase.co')
    expect(p).toContain("img-src 'self' data: blob: https://store.example.supabase.co;")
    expect(p).toContain("media-src 'self' blob: https://store.example.supabase.co;")
    expect(p).toContain("connect-src 'self';")
    expect(p).toContain("frame-ancestors 'none'")
  })
  it('stays same-site only without an https store', () => {
    for (const url of [undefined, '', 'not a url', 'http://store.example.supabase.co']) {
      const p = boardPolicy(url)
      expect(p).toContain("img-src 'self' data: blob:;")
      expect(p).toContain("media-src 'self' blob:;")
    }
  })
})
