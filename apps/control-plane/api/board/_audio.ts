import voiceBank from '../../../../config/voice-bank.json' with { type: 'json' }
import musicLibrary from '../../../../config/music-library.json' with { type: 'json' }
import type { PressAction } from './_viewExtras.js'

// The sound of an off-day post, picked by Krish on the Content Board (view contract 1.20.0; docs/PUBLISH_BOARDS.md,
// "The voice and the track"). Krish, 2026-11-17: "for all voiceovers and carousels, I want there to either be an audio
// track over the carousel, or, if it's a voiceover, then I want Eleven Labs voices used to do the voiceovers. I always
// want to be given a few options in my control center. We should have some stock voices approved in Eleven Labs and,
// obviously, my own Krish remix voice too as an option on the control center Content Board. voiceovers would have light
// approved epidemic audio behind the voice."
//
// - A voiceover short offers Pick the voice (config/voice-bank.json: his Krish Remix voice first, then the stock voices,
//   a proposed one marked "proposed", a retired one never) and Pick the track (the bed under the voice).
// - A carousel (supporting, good news, explainer) offers Pick the track (the audio over it).
// - The tracks are the off-day rotation in config/music-library.json ("for": "off-day"), at the one bed shape
//   (config/music-bed.json): light under a voice by the approved levels, never chosen by a session.
// - Each option carries `audio`, a same-site path to hear it (never an outside link in the view): a track is its brand-kit
//   file through GET /api/board/sign-offs?file=<drive id>; a voice is ElevenLabs' own free preview clip through
//   GET /api/board/sign-offs?voice=<bank id>, a redirect to the bank's preview URL only. No sample spends a credit.
//
// His press is one board document, picks/audio-<voice|bed>-<item>, kind audio_pick, the bank or ledger id he chose: his
// press only (the board's save route takes his login), never written by a session. A voice he picks that is still
// proposed in the bank is his choice for this post; it becomes a generated voice only once the bank says approved (a
// session moves it there from his press, and `ve voice clone --voice` refuses anything else).

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export type AudioLayer = 'voice' | 'bed'
export const AUDIO_ID = /^audio-(voice|bed)-([a-zA-Z0-9][a-zA-Z0-9_.:-]{0,139})$/
const PICK = /^[a-z0-9][a-z0-9_.-]{0,79}$/
const DRIVE_ID = /^[A-Za-z0-9_-]{20,80}$/
const PREVIEW_HOSTS = new Set(['storage.googleapis.com', 'api.us.elevenlabs.io', 'api.elevenlabs.io'])

export interface BankVoice { id: string; name: string; kind: 'krish' | 'stock'; default: boolean; voice_id: string; line: string; why: string; preview_url: string; status: string }
export interface Track { id: string; title: string; artist: string; status: string; drive_file_id: string | null; mood: string | null }

/** The voices the board offers: his own first, then the stock voices in bank order; a retired one never. */
export function bankVoices(bank: unknown = voiceBank): BankVoice[] {
  const list = isObj(bank) && Array.isArray(bank.voices) ? bank.voices.filter(isObj) : []
  const voices = list.filter(v => typeof v.id === 'string' && PICK.test(v.id) && (v.kind === 'krish' || v.kind === 'stock') && v.status !== 'retired')
    .map(v => ({ id: String(v.id), name: String(v.name || v.id), kind: v.kind as 'krish' | 'stock', default: v.default === true, voice_id: String(v.voice_id || ''),
      line: String(v.line || ''), why: String(v.why || ''), preview_url: String(v.preview_url || ''), status: String(v.status || 'proposed') }))
  // His default voice first (Krish v2 since 17 Nov 2026), then his other voices, then the stock voices.
  const mine = voices.filter(v => v.kind === 'krish').sort((a, b) => Number(b.default) - Number(a.default))
  return [...mine, ...voices.filter(v => v.kind === 'stock')]
}

/** The off-day rotation (config/music-library.json "for": "off-day"), in ledger order. */
export function offdayTracks(library: unknown = musicLibrary): Track[] {
  const list = isObj(library) && Array.isArray(library.tracks) ? library.tracks.filter(isObj) : []
  return list.filter(t => t.for === 'off-day' && typeof t.id === 'string' && PICK.test(t.id) && t.status !== 'retired')
    .map(t => ({ id: String(t.id), title: String(t.title || t.id), artist: String(t.artist || ''), status: String(t.status || ''),
      drive_file_id: typeof t.drive_file_id === 'string' && DRIVE_ID.test(t.drive_file_id) ? t.drive_file_id : null,
      mood: typeof t.mood === 'string' ? t.mood : null }))
}

/** A voice's preview to hear, for GET /api/board/sign-offs?voice=<id>: the bank's ElevenLabs preview URL, or null. */
export function voicePreview(id: string, bank: unknown = voiceBank): string | null {
  const v = bankVoices(bank).find(x => x.id === id)
  if (!v) return null
  try {
    const u = new URL(v.preview_url)
    return u.protocol === 'https:' && PREVIEW_HOSTS.has(u.hostname) ? u.toString() : null
  } catch { return null }
}

/** Every Drive id a track sample is served from (GET /api/board/sign-offs?file=), beside the style samples. */
export function trackFiles(library: unknown = musicLibrary): Set<string> {
  return new Set(offdayTracks(library).map(t => t.drive_file_id).filter((x): x is string => Boolean(x)))
}

/** Which layers a post of this kind is offered: a voiceover short the voice and the bed; a carousel the track. */
export function audioLayers(kind: string): AudioLayer[] {
  if (kind === 'voiceover') return ['voice', 'bed']
  if (kind === 'supporting' || kind === 'good_news' || kind === 'explainer') return ['bed']
  return []
}

/** His pick on an item's layer, from the week's picks (his presses only). */
export function audioPick(picks: Array<{ doc_id: string; body: Body; updated_by?: string }>, layer: AudioLayer, item: string): string | null {
  const doc = picks.find(p => p.doc_id === `audio-${layer}-${item}` && p.updated_by === 'Krish')
  const pick = doc && isObj(doc.body) ? doc.body.pick : null
  return typeof pick === 'string' && PICK.test(pick) ? pick : null
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

/** The presses that answer an off-day post's sound: one per layer, each with its options to hear, his pick marked. */
export function audioPresses(item: { key: string; kind: string }, picks: Array<{ doc_id: string; body: Body; updated_by?: string; revision?: number }>,
  bank: unknown = voiceBank, library: unknown = musicLibrary): PressAction[] {
  if (!AUDIO_ID.test(`audio-voice-${item.key}`)) return []
  return audioLayers(item.kind).flatMap(layer => {
    const picked = audioPick(picks, layer, item.key)
    const id = `audio-${layer}-${item.key}`
    const revision = picks.find(p => p.doc_id === id)?.revision ?? 0
    const options = layer === 'voice'
      ? bankVoices(bank).map(v => ({ value: v.id,
        label: `${v.name}${v.id === picked ? ' (picked)' : v.kind === 'krish' ? ' (your voice)' : v.status === 'proposed' ? ' (proposed)' : ''}`,
        line: cut(`${v.line} ${v.why}`, 240), audio: `/api/board/sign-offs?voice=${v.id}` }))
      : offdayTracks(library).map(t => ({ value: t.id, label: `${t.title}${t.artist ? `, ${t.artist}` : ''}${t.id === picked ? ' (picked)' : ''}`,
        line: layer === 'bed' && item.kind === 'voiceover' ? 'Light under the voice: loud open, low and steady under it, louder end (the one bed shape).'
          : 'Over the carousel, from the off-day rotation (Epidemic Sound, licensed).',
        ...(t.drive_file_id ? { audio: `/api/board/sign-offs?file=${t.drive_file_id}` } : {}) }))
    if (!options.length) return []
    // His pick first, then the rest in bank or ledger order.
    options.sort((a, b) => Number(b.value === picked) - Number(a.value === picked))
    const word = layer === 'voice' ? 'the voice' : item.kind === 'voiceover' ? 'the music under the voice' : 'the track'
    return [{ kind: 'press', label: `${picked ? 'Change' : 'Pick'} ${word}`, collection: 'picks', id, revision,
      body: { kind: 'audio_pick', layer, item: item.key },
      choose: { path: 'pick', ask: layer === 'voice' ? 'Which voice? Play each first.' : 'Which track? Play each first.', multi: false, required: true, options },
      stamp: ['at'], done: `Picked. It is ${word} for this post.` } as PressAction]
  })
}

/** His press, checked: picks/audio-<layer>-<item>, the item and layer it names, and a voice in the bank or a track in
 *  the off-day rotation. */
export function audioBody(id: string, body: Body, bank: unknown = voiceBank, library: unknown = musicLibrary): boolean {
  const m = AUDIO_ID.exec(id)
  if (!m || body.kind !== 'audio_pick' || body.layer !== m[1] || body.item !== m[2] || 'send' in body) return false
  if (typeof body.pick !== 'string' || !PICK.test(body.pick)) return false
  if (!(typeof body.at === 'string' && Number.isFinite(Date.parse(body.at)))) return false
  const known = m[1] === 'voice' ? bankVoices(bank).some(v => v.id === body.pick) : offdayTracks(library).some(t => t.id === body.pick)
  return known && Object.keys(body).every(k => ['kind', 'layer', 'item', 'pick', 'at'].includes(k))
}
