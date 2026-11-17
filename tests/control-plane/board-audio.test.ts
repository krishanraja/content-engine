import { describe, expect, it } from 'vitest'
import voiceBank from '../../config/voice-bank.json' with { type: 'json' }
import { AUDIO_ID, audioBody, audioLayers, audioPick, audioPresses, bankVoices, offdayTracks, trackFiles, voicePreview } from '../../apps/control-plane/api/board/_audio.js'
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

  it('his own Krish Remix voice comes first, then the stock voices, each marked and each with a sample on this site', () => {
    const [voice] = audioPresses({ key: ITEM, kind: 'voiceover' }, [])
    const opts = voice.choose!.options
    expect(opts[0]).toMatchObject({ value: 'krish-v2', label: 'Krish v2 (your voice)' })
    expect(opts[1]).toMatchObject({ value: 'krish-remix', label: 'Krish Remix (backup) (your voice)' })
    expect(opts.length).toBe(bankVoices().length)
    expect(opts.slice(2).every(o => o.label.endsWith('(proposed)'))).toBe(true)
    for (const o of opts) expect(o.audio).toBe(`/api/board/sign-offs?voice=${o.value}`)
    expect(voice).toMatchObject({ collection: 'picks', id: `audio-voice-${ITEM}`, body: { kind: 'audio_pick', layer: 'voice', item: ITEM }, stamp: ['at'] })
  })

  it('the tracks are the off-day rotation, each played from its brand-kit file', () => {
    const [, bed] = audioPresses({ key: ITEM, kind: 'voiceover' }, [])
    expect(bed.choose!.options.map(o => o.value)).toEqual(offdayTracks().map(t => t.id))
    for (const o of bed.choose!.options) expect(o.audio).toMatch(/^\/api\/board\/sign-offs\?file=[A-Za-z0-9_-]{20,80}$/)
    expect(trackFiles().size).toBe(offdayTracks().filter(t => t.drive_file_id).length)
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
