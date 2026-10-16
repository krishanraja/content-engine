import { supabase } from './_supabase.js'

// Standing brief preferences: Krish's recurring editorial notes.
//
// A one-off Cleo instruction ("harder ending") applies once. A STANDING note is
// a recurring preference, folded into the system prompt every time the brief is
// assembled or revised. Since step 3 PR 7 these notes have one home: what he
// says through Control Center's one door, filed as said_parts notes about
// 'content'. The engine only reads them, through the brief_standing_notes view
// (security_invoker, service role only). Adding and removing happen in Control
// Center, where Remember this files through the door and remove is a Purge.

const VIEW = 'brief_standing_notes'
const MAX_NOTES = 20

export interface StandingNote { id: string; text: string; at: string }

/** His standing notes, newest first. A failed read is no notes, never an error. */
export async function loadStandingNotes(): Promise<StandingNote[]> {
  const { data, error } = await supabase.from(VIEW).select('id, text, at')
  if (error || !Array.isArray(data)) return []
  return data
    .filter((r: any) => r && typeof r.text === 'string' && r.text.trim())
    .map((r: any) => ({ id: String(r.id), text: String(r.text).trim(), at: String(r.at || '') }))
    .slice(0, MAX_NOTES)
}

/** The system-prompt block. Empty string when there are no standing notes. */
export function standingNotesPrompt(notes: StandingNote[]): string {
  if (!notes.length) return ''
  return [
    "STANDING PREFERENCES (Krish's recurring editorial notes; honor every one unless a direct instruction overrides it):",
    ...notes.map(n => `- ${n.text}`),
  ].join('\n')
}
