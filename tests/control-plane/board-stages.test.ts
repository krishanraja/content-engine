import { describe, expect, it } from 'vitest'
import { STAGES, lockSignedOn, stagesOf } from '../../apps/control-plane/api/board/_view'

// Contract 1.5.0 (approved mock M5): "Steps from idea to publish: Ideas, Agreed, Flesh out, Script and record, After
// recording, Ready to post", each with its day. The day comes from the record or is null; never guessed.

const none = { idea: true, agreed: false, flesh_out: false, script_record: false, after_recording: false, ready_to_post: false }
const base = { done: none, ideasOn: '2026-11-15', agreedOn: null, fleshedOn: null, recordedOn: null, cutOn: null, goesOn: '2026-11-18' }

describe('the steps from idea to publish', () => {
  it('names the six steps in the mock\'s order and starts at the idea', () => {
    expect(STAGES.map(s => s.label)).toEqual(['Ideas', 'Agreed', 'Flesh out', 'Script and record', 'After recording', 'Ready to post'])
    const s = stagesOf(base)
    expect(s.map(x => x.state)).toEqual(['done', 'current', 'todo', 'todo', 'todo', 'todo'])
    expect(s[0].when).toBe('2026-11-15')
    expect(s[5].when).toBe('2026-11-18')
    expect(s.slice(1, 5).every(x => x.when === null)).toBe(true)
  })

  it('a later step done means every one before it is, and a step\'s day shows only once it is done', () => {
    const s = stagesOf({ ...base, done: { ...none, script_record: true }, agreedOn: '2026-11-15', fleshedOn: '2026-11-16' })
    expect(s.map(x => x.state)).toEqual(['done', 'done', 'done', 'done', 'current', 'todo'])
    expect(s.map(x => x.when)).toEqual(['2026-11-15', '2026-11-15', '2026-11-16', null, null, '2026-11-18'])
    expect(stagesOf({ ...base, agreedOn: '2026-11-15' })[1].when).toBeNull()
    expect(stagesOf({ ...base, done: { ...none, ready_to_post: true } }).every(x => x.state === 'done')).toBe(true)
  })

  it('reads the day a narrative lock was signed from its last line, and nothing from an unsigned one', () => {
    expect(lockSignedOn('# Lock\n\nThe story.\n\nSigned by Krish: "Yes, this is it", 2026-11-15')).toBe('2026-11-15')
    expect(lockSignedOn('# Lock\n\nSigned by Krish: "<his words>", 2026-11-15')).toBeNull()
    expect(lockSignedOn(null)).toBeNull()
  })
})
