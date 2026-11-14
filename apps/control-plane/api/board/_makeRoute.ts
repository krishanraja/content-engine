// How an off-day post is made, said once for every prompt the board copies out (the week model's "Copy prompt for
// Claude" and the day's prompt for Growth).
//
// Ruling (Krish, 2026-11-13): every carousel is made in a Claude session, with the Codex plugin building it, as in the
// other usual workflows. His words: "all the carousels should now be done in Claude, but using the Codex plug in as per
// the other usual workflows". The same day he widened it twice: "memes and Notes images should go the same way", then
// "Off-day voiceover shorts should go the same way too". So two routes, both run from a Claude session someone opens
// (usually from this prompt), never from a scheduled job, a headless model run or a template engine:
//
//   still    a carousel, a meme image or a Notes image: the session writes the words, the story and the direction,
//            then one Codex card (scripts/ve.py card, kinds carousel, meme and notes_image), which Codex builds in code
//            through the plugin; the session verifies the pictures (docs/CAROUSEL-STANDARD.md, "How a carousel is made").
//   motion   an off-day voiceover short or a meme video: the ve route (docs/ve/ENGINE.md, docs/ve/RUNBOOK.md); the
//            session writes the script and the signed spec, Codex builds the devices and plates from cards, ve renders,
//            and a separate reviewer watches and listens before it is called ready.
//
// tests/control-plane/make-route.test.ts holds every prompt and every document that tells a session how one is made to
// these words, and refuses the retired routes by name.

export type MakeRoute = 'still' | 'motion'

/** Which route makes an off-day post, from its board kind (OFFDAY_KINDS) and the format its plan wrote. Null for a post
 *  neither route makes (a short cut from a past master, by word range). Pure. */
export function makeRoute(kind: string | null | undefined, format: string | null | undefined): MakeRoute | null {
  const f = String(format ?? '').toLowerCase()
  const k = String(kind ?? '').toLowerCase()
  if (k === 'voiceover' || /voice ?over|voice-over/.test(f)) return 'motion'
  if ((k === 'meme' || /\bmeme/.test(f)) && /\bvideo\b/.test(f)) return 'motion'
  if (k === 'supporting' || k === 'good_news' || k === 'meme') return 'still'
  if (/carousel|meme|infographic|\bimage\b|\bnotes?\b|\bcards?\b/.test(f)) return 'still'
  return null
}

/** The ruling, in the words every prompt carries. */
export const ROUTE_RULING = 'Ruling (Krish, 2026-11-13): every carousel is made in a Claude session, with the Codex plugin '
  + 'building it, as in the other usual workflows; memes, Notes images and off-day voiceover shorts are made the same way.'

/** Never made any other way, said once in each route's words. */
export const NEVER_HEADLESS = 'Never a scheduled job, a headless model run or a template engine.'

const STILL = `Make it in this Claude session, with the Codex plugin building it. ${ROUTE_RULING} `
  + 'The route is content-engine docs/CAROUSEL-STANDARD.md, "How a carousel is made". '
  + '1. Write the words, the story and the creative direction yourself. A carousel\'s deck comes first, as carousel-deck/1, '
  + 'and passes python3 scripts/carousel_check.py DECK.json: five whys, the wider trend with an outside source, at most 50 '
  + 'headline words, at most 10 cards, ending "Follow for more". '
  + '2. Write one Codex card for the pictures with python3 scripts/ve.py card (kind carousel, meme or notes_image, with the '
  + 'day and the inspiration cards Krish ticked), held to config/brand-palette.json, and send it to Codex through the '
  + 'plugin: ve dispatch, or, for a card in growth-makeyourmindup, its codex/queue/ on your claude/ branch, which the Codex '
  + 'lane builds. '
  + '3. Codex builds the pictures in code. You verify them: the deck check again, the 10/10 judges for a carousel, and a '
  + 'look at every card at phone size. '
  + `4. File them in the post's 3 Posts folder. Krish approves; Growth posts it through its approved route. ${NEVER_HEADLESS}`

const MOTION = `Make it in a Claude session in krishanraja/content-engine on the ve route, with the Codex plugin building its pictures. ${ROUTE_RULING} `
  + 'Read docs/ve/ENGINE.md, then follow docs/ve/RUNBOOK.md. You write the script, the story and the signed spec '
  + '(creative-direction.json, schema_version 2); Codex builds its devices and plates from cards (ve card, ve dispatch, '
  + 've verify-card); ve renders the cut; a separate reviewer watches and listens before it is called ready. The voice '
  + 'comes from where it comes from today. '
  + `File it in the post's 3 Posts folder. Krish approves; Growth posts it through its approved route. ${NEVER_HEADLESS}`

/** The route, in the words a prompt carries. */
export function routeLine(route: MakeRoute): string {
  return route === 'still' ? STILL : MOTION
}
