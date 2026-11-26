// How an off-day post is made, said once for every prompt the board copies out (the week model's "Copy prompt for
// Claude" and the day's make prompt).
//
// Ruling (Krish, 2026-11-26): "I believe that growth should move all asset production to Content Engine. I see no point
// in having a separate repository produce specific assets." content-engine makes every asset and hands Growth the
// finished files with their captions in the piece manifest; Growth posts, schedules and measures, and makes nothing.
// The v5 Library is locked the same day (Krish: "I approve the new cover thumbnail systems, go"): its templates are the
// only artwork. Every asset is still made in a Claude session someone opens (Ruling, Krish, 2026-11-13: "all the
// carousels should now be done in Claude, but using the Codex plug in as per the other usual workflows"; memes, Notes
// images and off-day voiceover shorts the same way), never by a scheduled job, a headless model run or a template engine:
//
//   still    a carousel, a meme image or a Notes image: the session writes the words and the story, fills the Library
//            set with scripts/library/make_piece.py and the cover with scripts/covers/make_covers.py (config/asset-routes.json
//            names the command for each kind; scripts/post-pack/asset_routes.py refuses plainly when the Library is not on
//            the checkout), asks the 10/10 judges itself (scripts/post-pack/judge_assets.py) and writes every channel's
//            caption (scripts/post-pack/channel_captions.py). Codex, through the plugin, builds only a photoreal still of
//            the specific thing when no licensed photograph exists (the Library's imagery order).
//   motion   an off-day voiceover short or a meme video: the ve route (docs/ve/ENGINE.md, docs/ve/RUNBOOK.md); the
//            session writes the script and the signed spec, ve renders, and a separate reviewer watches and listens
//            before it is called ready.
//   reskin   a meme template (an existing clip he picked on the ideas board): NOT a carousel and not a fresh video. The
//            session downloads that exact clip, reskins it to docs/MEME-STANDARD.md, sets his caption and puts the
//            wordmark small at the bottom right (Krish, 2026-11-18: "It tries to produce a carousel, when we actually
//            want to make a meme - download that exact video, reskin it, put our caption, and the wordmark in the
//            bottom right corner").
//
// tests/control-plane/make-route.test.ts holds every prompt and every document that tells a session how one is made to
// these words, and refuses the retired routes by name (Growth's renderer and kit queue among them).

export type MakeRoute = 'still' | 'motion' | 'reskin'

/** Which route makes an off-day post, from its board kind (OFFDAY_KINDS) and the format its plan wrote. Null for a post
 *  neither route makes (a short cut from a past master, by word range). Pure. */
export function makeRoute(kind: string | null | undefined, format: string | null | undefined, template = false): MakeRoute | null {
  const f = String(format ?? '').toLowerCase()
  const k = String(kind ?? '').toLowerCase()
  // A meme that carries a template clip is that clip reskinned, whatever format its plan wrote ("Meme, 1 image" sent it to
  // the carousel route on 18 Nov).
  if (k === 'meme' && template) return 'reskin'
  if (k === 'voiceover' || /voice ?over|voice-over/.test(f)) return 'motion'
  if ((k === 'meme' || /\bmeme/.test(f)) && /\bvideo\b/.test(f)) return 'motion'
  if (k === 'supporting' || k === 'good_news' || k === 'meme') return 'still'
  if (/carousel|meme|infographic|\bimage\b|\bnotes?\b|\bcards?\b/.test(f)) return 'still'
  return null
}

/** The ruling, in the words every prompt carries. */
export const ROUTE_RULING = 'Ruling (Krish, 2026-11-26): content-engine makes every asset in a Claude session, from the locked v5 Library, '
  + 'with its captions; Growth posts it and makes nothing. Carousels, memes, Notes images and off-day voiceover shorts are made in a Claude session (Ruling, Krish, 2026-11-13).'

/** Never made any other way, said once in each route's words. */
export const NEVER_HEADLESS = 'Never a scheduled job, a headless model run or a template engine.'

/** The words a session says when the Library is not on its checkout (config/asset-routes.json `absent`). */
export const LIBRARY_ABSENT = 'the v5 Library is not on this checkout yet'

/** The make flow's own steps after the pictures: the judges and the captions, said once for both picture routes. */
const JUDGE_AND_CAPTIONS = 'Ask the 10/10 judges yourself before anything goes to Growth: python3 scripts/post-pack/judge_assets.py ask REQUEST.json --week <Monday> '
  + '(op judge; every judge must pass, and a hold is never a pass). Then write each channel\'s caption and title: python3 scripts/post-pack/channel_captions.py brief, '
  + 'a separate reviewer who has seen nothing else answers its review-brief blind, and record writes the words into the manifest SPEC (voice check and copy lint included). '

const STILL = `Make it in this Claude session in krishanraja/content-engine, from the locked v5 Library. ${ROUTE_RULING} `
  + 'The route is content-engine docs/CAROUSEL-STANDARD.md, "How a carousel is made". '
  + '1. Write the words and the story yourself. A carousel\'s deck comes first, as carousel-deck/1, '
  + 'and passes python3 scripts/carousel_check.py DECK.json: five whys, the wider trend with an outside source, every card '
  + 'after the cover one full plain sentence of 8 to 20 words a stranger can follow, at most 10 cards, ending on the palette\'s close: the takeaway, then "Follow for more" with the Make Your Mind Up wordmark centred under it. '
  + '2. Make the pictures only with the Library: python scripts/library/make_piece.py <piece> --set <set> for the carousel, and its cover and thumbnails only with '
  + 'python scripts/covers/make_covers.py <piece> --out <folder> (it writes covers.json, which post-pack reads as cover_set). '
  + 'python3 scripts/post-pack/asset_routes.py command <kind> --piece <piece> --out <folder> names the command and set for each kind (config/asset-routes.json), '
  + `and refuses a kind the Library has no command for yet. If the command is not on this checkout, stop and say "${LIBRARY_ABSENT}"; never draw it another way. `
  + 'Pictures in the Library\'s order: a licensed Commons photo of a named person in their own story, then the real object, company or venue, then a photoreal still of the specific thing '
  + 'built by Codex through the Codex plugin (no generated people, no readable logos or text). No badges. '
  + '3. Verify: the deck check again, the drawn cards with python3 scripts/carousel_check.py --cards, a look at every card at phone size, '
  + `the inspiration cards Krish ticked held beside them. ${JUDGE_AND_CAPTIONS}`
  + `4. File them in the post's 3 Posts folder. Krish approves; Growth posts it through its approved route. ${NEVER_HEADLESS}`

const MOTION = `Make it in a Claude session in krishanraja/content-engine on the ve route, with the Codex plugin building its pictures. ${ROUTE_RULING} `
  + 'Read docs/ve/ENGINE.md, then follow docs/ve/RUNBOOK.md. You write the script, the story and the signed spec '
  + '(creative-direction.json, schema_version 2); Codex builds its devices and plates from cards (ve card, ve dispatch, '
  + 've verify-card) inside the Library\'s video templates, never a look of its own; ve renders the cut; a separate reviewer watches and listens before it is called ready. '
  + 'Its cover and thumbnails come only from python scripts/covers/make_covers.py <piece> --out <folder>. The voice '
  + 'comes from where it comes from today. '
  + `${JUDGE_AND_CAPTIONS}`
  + `File it in the post's 3 Posts folder. Krish approves; Growth posts it through its approved route. ${NEVER_HEADLESS}`

const RESKIN = 'This is a MEME made from an existing video, not a carousel and not a fresh video: no carousel deck, no carousel_check.py, no Library carousel set. '
  + `Make it in a Claude session in krishanraja/content-engine on the ve route. ${ROUTE_RULING} Read docs/MEME-STANDARD.md and the meme skill (.agents/skills/meme/SKILL.md) first, then python3 scripts/floor.py --format meme. `
  + '1. Download that exact clip (its clip link below; its page is the fallback if the link fails), keep the original file, its sha256 and its length on the piece, and use nothing else: never a re-shoot, a look-alike, a generated stand-in or a different clip. '
  + '2. Reskin it on the ve route to the standard: the original clip at its full frame, never cropped at the sides, on the house ground; his caption in the house type on a clean solid caption band above it, at most two lines, never first person (always "When you realize..." or "POV: you realize..."); '
  + 'the makeyourmindup wordmark small at the bottom right, just under the clip and right-aligned to the clip\'s right edge, never over the clip or in the band, from the house brand files only; a small credit line naming the original; no subchannel colour, no other branding. '
  + 'His caption is his note on this post (below, and in "Your notes for Claude"): set exactly his words, verbatim where he put them in quotation marks. If there is no caption yet, ask him for it once and do nothing else until you have it; the caption ideas on the board are only ideas. '
  + '3. Make both shapes, each laid out for itself: 9:16 (meme_tall, centred: python3 scripts/layout_centre.py FILE) and 4:5. Keep the clip\'s own sound, no music bed, loudness at the house target; every word and mark clear of each channel\'s buttons (config/channel-safe-zones.json). '
  + '4. A separate reviewer who did not make it watches it with sound at full size and phone size before it is called ready. File each cut only with a passing social_clip receipt that names the clip it reskins (scripts/quick-edit/quality.py, with full_frame, caption_band and credit_line). '
  + 'Then write each channel\'s caption: python3 scripts/post-pack/channel_captions.py (his caption on the meme stays his words; the post\'s own words are written and read blind). '
  + `5. File the cuts in the post's 3 Posts folder, then write the board record and read the board back before you stop (the close-the-loop rule below). Krish approves; Growth posts it through its approved route. ${NEVER_HEADLESS}`

/** The route, in the words a prompt carries. */
export function routeLine(route: MakeRoute): string {
  return route === 'still' ? STILL : route === 'reskin' ? RESKIN : MOTION
}
