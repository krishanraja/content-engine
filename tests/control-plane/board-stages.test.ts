import { describe, expect, it, vi } from 'vitest'
import { STAGES, lockSignedOn, makingDays, stagesOf } from '../../apps/control-plane/api/board/_view'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

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

  it('takes the days for Script and record and After recording from the making record, only once each step is done there', () => {
    const SHA = (c: string) => c.repeat(64)
    const check = { passed: true, problems: [], checked_at: '2026-11-15T10:00:00Z', cuts: ['long', 'short'], hashes: { long: SHA('a'), short: SHA('b') } }
    const take = (cut: string, at: string, sha: string) => ({ cut, path: `recordings/${SHA(cut === 'long' ? 'c' : 'd')}.mp4`, at, script_sha256: sha })
    const file = (cut: string, at: string) => ({ cut, name: `${cut} cut`, path: `3 Video/${cut}.mp4`, at, thumbnail: { path: `3 Video/${cut}.jpg` } })
    const piece = (making: Record<string, unknown>) => ({ id: '8287846b-6618-4a19-9fb8-23ad4eca2718', state: 'drafting', body: '', meta: { making } })
    // Nothing recorded or cut yet: no day.
    expect(makingDays(piece({ script_check: check }))).toEqual({ recordedOn: null, cutOn: null })
    // One cut recorded of two: the Recorded step is not done, so no day yet.
    expect(makingDays(piece({ script_check: check, recordings: [take('long', '2026-11-16T09:00:00Z', SHA('a'))] })).recordedOn).toBeNull()
    // Both recorded: the day of the last take. Both cut with thumbnails: the day of the last file.
    const done = piece({ script_check: check,
      recordings: [take('long', '2026-11-16T09:00:00Z', SHA('a')), take('short', '2026-11-17T08:30:00Z', SHA('b'))],
      video_assets: [file('long', '2026-11-18T07:00:00Z'), file('short', '2026-11-18T19:00:00Z')] })
    expect(makingDays(done)).toEqual({ recordedOn: '2026-11-17', cutOn: '2026-11-18' })
    // The stages show them once each stage is done.
    const s = stagesOf({ ...base, done: { ...none, after_recording: true }, agreedOn: '2026-11-15', fleshedOn: '2026-11-15', ...makingDays(done) })
    expect(s.map(x => x.when)).toEqual(['2026-11-15', '2026-11-15', '2026-11-15', '2026-11-17', '2026-11-18', '2026-11-18'])
  })

  it('reads the day a narrative lock was signed from its last line, and nothing from an unsigned one', () => {
    expect(lockSignedOn('# Lock\n\nThe story.\n\nSigned by Krish: "Yes, this is it", 2026-11-15')).toBe('2026-11-15')
    expect(lockSignedOn('# Lock\n\nSigned by Krish: "<his words>", 2026-11-15')).toBeNull()
    expect(lockSignedOn(null)).toBeNull()
  })
})
