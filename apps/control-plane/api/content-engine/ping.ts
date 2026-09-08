import type { VercelRequest, VercelResponse } from '@vercel/node'
import { envReadiness } from './_required.js'

// Is this deployment alive, and is it configured enough to work?
//
// Unauthenticated on purpose and deliberately thin: the deploy commit and one
// boolean. It exists because every other route is fail-closed, so a fresh
// deployment with no secrets yet is indistinguishable from a broken one, and
// "did it deploy" should never require credentials the deployment does not
// have. It names nothing: which variables are missing is on the guarded
// health route.

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const { ready } = envReadiness()
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    ok: true,
    engine: 'content-engine/control-plane',
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    ready,
    server_time: new Date().toISOString(),
  })
}
