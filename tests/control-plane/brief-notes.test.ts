import { describe, expect, it, vi } from 'vitest'

// Standing brief notes have one home since step 3 PR 7: Control Center's
// said_parts notes about 'content', read through the brief_standing_notes view.
// The engine reads them and never writes them.

vi.hoisted(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})

const state: { table: string | null; rows: unknown; error: unknown } = { table: null, rows: [], error: null }
vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    from(table: string) {
      state.table = table
      return { select: async () => ({ data: state.rows, error: state.error }) }
    },
  },
}))

const { loadStandingNotes, standingNotesPrompt } = await import('../../apps/control-plane/api/_briefNotes.js')

describe('standing brief notes', () => {
  it('reads the view, keeps text, drops empty rows', async () => {
    state.rows = [{ id: 'a', text: ' Harder endings. ', at: '2026-10-13T10:00:00Z' }, { id: 'b', text: '  ', at: '' }]
    state.error = null
    const notes = await loadStandingNotes()
    expect(state.table).toBe('brief_standing_notes')
    expect(notes).toEqual([{ id: 'a', text: 'Harder endings.', at: '2026-10-13T10:00:00Z' }])
    expect(standingNotesPrompt(notes)).toContain('- Harder endings.')
  })

  it('a failed read is no notes, so a brief still assembles', async () => {
    state.rows = null
    state.error = { message: 'relation does not exist' }
    expect(await loadStandingNotes()).toEqual([])
    expect(standingNotesPrompt([])).toBe('')
  })
})
