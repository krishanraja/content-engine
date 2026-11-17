import { describe, expect, it } from 'vitest'
import voiceBank from '../../config/voice-bank.json' with { type: 'json' }
import { AUDIO_ID, RECORD_MYSELF, audioBody, defaultVoice, audioLayers, audioPick, audioPresses, bankVoices, offdayTracks, soundLine, trackFiles, voicePreview } from '../../apps/control-plane/api/board/_audio.js'
import { validBody } from '../../apps/control-plane/api/board/_contracts.js'

// The voice and the track on an off-day post (contract 1.20.0; Krish, 2026-11-17: "I always want to be given a few
// options in my control center. We should have some stock voices approved in Eleven Labs and, obviously, my own Krish
// remix voice too as an option on the control center Content Board").

const ITEM = 'off-tue-2026-11-17-habits'
const at = '2026-11-17T10:00:00.000Z'

describe('the options he hears', () => {
  it('a voiceover short offers the voice and the music under it; a carousel the track; a meme nothing', () => {
    expect(audioLayers('voiceover')).toEqual(['voice', 'bed'])
    for (const k of ['supporting', 'good_news', 'explainer']) expect(audioLayers(k)).toEqual(['bed'])
    expect(audioLayers('meme')).toEqual([])
    const presses = audioPresses({ key: ITEM, kind: 'voiceover' }, [])
    expect(presses.map(p => p.label)).toEqual(['Pick the voice', 'Pick the music under the voice'])
    expect(audioPresses({ key: ITEM, kind: 'supporting' }, []).map(p => p.label)).toEqual(['Pick the track'])
    expect(audioPresses({ key: ITEM, kind: 'meme' }, [])).toEqual([])
  })

  it('Record it myself leads, marked default, until a voice holds on a whole script; then his voices, then the stock voices', () => {
    // Ruling (Krish, 2026-11-17): "make Record it myself the default until a voice passes".
    const [voice] = audioPresses({ key: ITEM, kind: 'voiceover' }, [])
    const opts = voice.choose!.options
    expect(defaultVoice()).toBe(RECORD_MYSELF)
    expect(opts[0]).toMatchObject({ value: RECORD_MYSELF, label: 'Record it myself (default)' })
    expect(opts[0].audio).toBeUndefined()
    expect(opts[1]).toMatchObject({ value: 'krish-v2', label: 'Krish v2 (your voice)' })
    expect(opts[2]).toMatchObject({ value: 'krish-remix', label: 'Krish Remix (backup) (your voice)' })
    expect(opts.length).toBe(bankVoices().length + 1)
    expect(opts.slice(3).every(o => o.label.endsWith('(proposed)'))).toBe(true)
    for (const o of opts.slice(1)) expect(o.audio).toBe(`/api/board/sign-offs?voice=${o.value}`)
    // A voice not proven on a whole script says so first (Tue 17 Nov: Krish v2 drifted on the full script).
    expect(opts[1].line).toMatch(/^Not yet proven on a whole script\./)
    expect(voice).toMatchObject({ collection: 'picks', id: `audio-voice-${ITEM}`, body: { kind: 'audio_pick', layer: 'voice', item: ITEM }, stamp: ['at'] })
  })

  it('once his default voice holds on a whole script, it is the default', () => {
    const proven = { ...voiceBank, voices: voiceBank.voices.map(v => (v.id === 'krish-v2' ? { ...v, whole_script: { passed: true, on: '2026-11-20', note: 'held' } } : v)) }
    expect(defaultVoice(proven)).toBe('krish-v2')
    const [voice] = audioPresses({ key: ITEM, kind: 'voiceover' }, [], proven)
    expect(voice.choose!.options[0]).toMatchObject({ value: 'krish-v2', label: 'Krish v2 (your voice) (default)' })
  })

  it('the tracks are the off-day rotation, each played from its brand-kit file', () => {
    const [, bed] = audioPresses({ key: ITEM, kind: 'voiceover' }, [])
    expect(bed.choose!.options.map(o => o.value)).toEqual(offdayTracks().map(t => t.id))
    for (const o of bed.choose!.options) expect(o.audio).toMatch(/^\/api\/board\/sign-offs\?file=[A-Za-z0-9_-]{20,80}$/)
    expect(trackFiles().size).toBe(offdayTracks(undefined, null).filter(t => t.drive_file_id).length)
  })

  it('a good-news carousel is offered the funky-house group, a supporting carousel or explainer the gym group, a meme nothing', () => {
    const good = audioPresses({ key: ITEM, kind: 'good_news' }, [])[0]
    const tips = audioPresses({ key: ITEM, kind: 'supporting' }, [])[0]
    expect(good.choose!.options.map(o => o.value)).toEqual(offdayTracks(undefined, 'good_news').map(t => t.id))
    expect(good.choose!.options.map(o => o.value)).toEqual(expect.arrayContaining(['mojito', 'cheetah-print', 'style', 'make-up-your-mind-instrumental']))
    expect(tips.choose!.options.map(o => o.value)).toEqual(expect.arrayContaining(['coronation', 'gifted-instrumental', 'plenty-bands-instrumental']))
    expect(audioPresses({ key: ITEM, kind: 'explainer' }, [])[0].choose!.options.map(o => o.value)).toEqual(tips.choose!.options.map(o => o.value))
    expect(good.choose!.options.some(o => offdayTracks(undefined, 'tips').some(t => t.id === o.value))).toBe(false)
    expect(audioPresses({ key: ITEM, kind: 'meme' }, [])).toEqual([])
    expect(audioBody(`audio-bed-${ITEM}`, { kind: 'audio_pick', layer: 'bed', item: ITEM, pick: 'mojito', at: '2026-11-17T10:00:00Z' })).toBe(true)
  })

  it('a voice sample is only the bank\'s ElevenLabs preview; anything else is nothing', () => {
    expect(voicePreview('krish-remix')).toMatch(/^https:\/\/storage\.googleapis\.com\//)
    expect(voicePreview('krish-v2')).toMatch(/^https:\/\/api\.us\.elevenlabs\.io\//)
    expect(voicePreview('nobody')).toBeNull()
    const bad = { voices: [{ ...voiceBank.voices[0], preview_url: 'https://example.org/a.mp3' }] }
    expect(voicePreview(voiceBank.voices[0].id, bad)).toBeNull()
  })
})

describe('his press', () => {
  const body = { kind: 'audio_pick', layer: 'voice', item: ITEM, pick: 'clyde', at }

  it('is his pick on the post, a voice in the bank or a track in the rotation', () => {
    expect(AUDIO_ID.test(`audio-voice-${ITEM}`)).toBe(true)
    expect(audioBody(`audio-voice-${ITEM}`, body)).toBe(true)
    expect(validBody('picks', `audio-voice-${ITEM}`, body)).toBe(true)
    expect(validBody('picks', `audio-bed-${ITEM}`, { ...body, layer: 'bed', pick: offdayTracks()[0].id })).toBe(true)
  })

  it('refuses a voice not in the bank, a mismatched item or layer, and anything extra', () => {
    expect(validBody('picks', `audio-voice-${ITEM}`, { ...body, pick: 'nobody' })).toBe(false)
    expect(validBody('picks', `audio-voice-${ITEM}`, { ...body, item: 'another' })).toBe(false)
    expect(validBody('picks', `audio-bed-${ITEM}`, body)).toBe(false)
    expect(validBody('picks', `audio-voice-${ITEM}`, { ...body, approved: true })).toBe(false)
    expect(validBody('picks', `audio-voice-${ITEM}`, { ...body, at: undefined })).toBe(false)
    expect(validBody('picks', 'mon', { ...body })).toBe(false)
  })

  it('counts only his own press, and marks his pick first', () => {
    const picks = [{ doc_id: `audio-voice-${ITEM}`, body, updated_by: 'Krish', revision: 3 }]
    expect(audioPick(picks, 'voice', ITEM)).toBe('clyde')
    expect(audioPick([{ ...picks[0], updated_by: 'engine' }], 'voice', ITEM)).toBeNull()
    const [voice] = audioPresses({ key: ITEM, kind: 'voiceover' }, picks)
    expect(voice.label).toBe('Change the voice')
    expect(voice.revision).toBe(3)
    expect(voice.choose!.options[0]).toMatchObject({ value: 'clyde', label: 'Clyde (picked)' })
  })
})

describe('his pick reaches the session that makes the post', () => {
  const pick = (layer: string, value: string) => ({ doc_id: `audio-${layer}-${ITEM}`, body: { kind: 'audio_pick', layer, item: ITEM, pick: value, at }, updated_by: 'Krish' })

  it('Record it myself is a press he can make, and sends the session to Teleprompter, never ElevenLabs', () => {
    expect(validBody('picks', `audio-voice-${ITEM}`, { kind: 'audio_pick', layer: 'voice', item: ITEM, pick: RECORD_MYSELF, at })).toBe(true)
    const line = soundLine({ key: ITEM, kind: 'voiceover' }, [pick('voice', RECORD_MYSELF)])
    expect(line).toMatch(/records this one himself/)
    expect(line).toMatch(/teleprompter_send\.py/)
    expect(line).not.toMatch(/voice clone/)
  })

  it('an ElevenLabs voice and the track are named for the session; nothing picked says nothing', () => {
    const line = soundLine({ key: ITEM, kind: 'voiceover' }, [pick('voice', 'krish-v2'), pick('bed', offdayTracks()[0].id)])
    expect(line).toMatch(/Krish v2, ElevenLabs/)
    expect(line).toMatch(/--voice krish-v2/)
    expect(line).toMatch(new RegExp(offdayTracks()[0].title))
    // Nothing picked: the default, Record it myself, until a voice holds on a whole script; a session's write is no pick.
    expect(soundLine({ key: ITEM, kind: 'voiceover' }, [])).toMatch(/the default until a voice holds on a whole script/)
    expect(soundLine({ key: ITEM, kind: 'voiceover' }, [{ ...pick('voice', 'clyde'), updated_by: 'engine' }])).toMatch(/records this one himself/)
    expect(soundLine({ key: ITEM, kind: 'supporting' }, [])).toBe('')
  })
})
