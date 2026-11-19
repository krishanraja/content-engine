import { describe, expect, it, vi } from 'vitest'

// POST /api/library/drive-review: a session watches any video Krish points at in his Drive, whatever its size.
// Krish, 2026-11-19: "you need to figure out how to watch the long video".

vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://store.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})

import { REVIEW_TYPES, planDriveReview } from '../../apps/control-plane/api/library/drive-review.js'

const ALLOWED = ['video/mp4', 'video/quicktime', 'image/png']
const ID = '1WpX6eaQPB-LReAkVDlb3bp6OJoc1wbAf'

describe('planDriveReview', () => {
  it('copies a 268 MB long cut into the review area, keyed by its ID and size', () => {
    const plan = planDriveReview(ID, { id: ID, name: 'long-final.mp4', mimeType: 'video/mp4', size: '268679971' }, ALLOWED)
    expect(plan).toEqual({ ok: true, objectKey: `review/drive/${ID}-268679971.mp4`, contentType: 'video/mp4', bytes: 268679971, name: 'long-final.mp4' })
  })

  it('refuses an ID that is not a Drive ID', () => {
    expect(planDriveReview('../etc/passwd', { mimeType: 'video/mp4', size: 1 }, ALLOWED)).toMatchObject({ ok: false, status: 400 })
    expect(planDriveReview(42, null, ALLOWED)).toMatchObject({ ok: false, status: 400 })
  })

  it('says a missing or trashed file is not found', () => {
    expect(planDriveReview(ID, null, ALLOWED)).toMatchObject({ ok: false, status: 404, error: 'drive_file_not_found' })
    expect(planDriveReview(ID, { mimeType: 'video/mp4', size: 5, trashed: true }, ALLOWED)).toMatchObject({ ok: false, status: 404 })
  })

  it('refuses a type it cannot review, and one the bucket does not take', () => {
    expect(planDriveReview(ID, { mimeType: 'application/vnd.google-apps.folder' }, ALLOWED)).toMatchObject({ ok: false, status: 415, error: 'drive_file_type_not_reviewable' })
    expect(planDriveReview(ID, { mimeType: 'video/webm', size: 10 }, ALLOWED)).toMatchObject({ ok: false, status: 415, error: 'library_store_does_not_take_this_type' })
  })

  it('refuses a file with no size or one over the library limit', () => {
    expect(planDriveReview(ID, { mimeType: 'video/mp4' }, ALLOWED)).toMatchObject({ ok: false, status: 422 })
    expect(planDriveReview(ID, { mimeType: 'video/mp4', size: 3 * 1024 ** 3 }, ALLOWED)).toMatchObject({ ok: false, status: 413 })
  })

  it('keeps review copies out of the library and the post folders', () => {
    const plan = planDriveReview(ID, { mimeType: 'video/quicktime', size: 99 }, ALLOWED)
    expect(plan.ok && plan.objectKey.startsWith('review/drive/')).toBe(true)
    expect(Object.values(REVIEW_TYPES)).toContain('mov')
  })
})
