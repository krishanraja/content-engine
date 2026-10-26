import type { Making } from './_making.js'
import { MediaQualityError, qualifyMedia, readMediaRef } from './_mediaQuality.js'
import { mediaQualityEnforced } from '../../../packages/core/src/media-rollout.js'

/** Recompute readiness from current evidence; persisted review JSON is a cache. */
export async function verifiedMaking(db: any, pieceId: string, making: Making | null): Promise<Making | null> {
  if (!mediaQualityEnforced()) return making
  if (!making?.video_assets?.length) return making
  const cache = new Map(), assets = []
  for (const asset of making.video_assets) {
    const projected = { ...asset }
    try {
      if (!asset.sha256 || !asset.quality_receipt) throw new MediaQualityError('quality evidence missing')
      await qualifyMedia(db, { piece_id: pieceId, role: 'video', cut: asset.cut, artifact: { path: asset.path, sha256: asset.sha256 }, receipt: asset.quality_receipt }, cache)
      projected.quality_review = JSON.parse((await readMediaRef(db, asset.quality_receipt, cache, true)).text!)
    } catch { delete projected.quality_review }
    assets.push(projected)
  }
  return { ...making, video_assets: assets }
}
