import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { askVoiceCheck, type VoiceChannel } from '../_controlCenter.js'

// POST /api/voice/check { text, channel } -> { ok, checked, hard, distance, source }
//
// The engine's door to Control Center's one voice check, for its sessions and
// scripts (scripts/post-pack/voice_gate.py): they hold the engine key, and this
// route holds the access code Control Center's route takes (Ruling, Krish,
// 2026-11-09: every word written for Krish, Jonny or the publication passes the
// one voice check). It judges words and stores nothing; checked false means
// Control Center could not be asked, never a pass.

const CHANNELS: readonly VoiceChannel[] = ['article', 'script', 'caption', 'carousel', 'substack', 'linkedin', 'x', 'threads', 'substack_note', 'instagram', 'comment', 'email']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  const b = (req.body ?? {}) as Record<string, unknown>
  const text = typeof b.text === 'string' ? b.text : ''
  const channel = b.channel as VoiceChannel
  if (!text.trim() || text.length > 60_000) return res.status(400).json({ ok: false, error: 'text must be 1 to 60,000 characters' })
  if (!CHANNELS.includes(channel)) return res.status(400).json({ ok: false, error: `channel must be one of ${CHANNELS.join(', ')}` })
  const v = await askVoiceCheck(text, channel)
  if (!v) return res.status(200).json({ ok: true, checked: false, hard: [], distance: null, source: null })
  return res.status(200).json({ ok: true, checked: true, ...v })
}
