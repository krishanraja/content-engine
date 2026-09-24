import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleWhisper, config as whisperConfig } from '../_whisper.js'
import { guardEngine } from '../_auth.js'

// POST /api/content-ideas/voice — transcribe a spoken content idea.
//
// The same pass-through the other four voice routes are (daily-focus, tasks-
// inbox, pilot, and the two interpreting ones). Content was the gap: the
// mobile speed dial offered a mic on "Task" and not on "Idea", which is the
// wrong way round for a phone, and _whisper.ts already biases decoding toward
// house vocabulary including the format names ("Built, Paid, Teardown").
// Gated here rather than in _whisper.ts, which the other voice routes share.
// Transcription spends on a paid API, so it takes the same gate as the rest of
// /api/content-ideas.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res)) return
  return handleWhisper(req, res)
}
export const config = whisperConfig
