# Krish's universe as one building

Asked for by Krish on 18 Nov 2026 ("build a version of this that describes my universe"), after a LinkedIn post
(Tim Scheuer, "Build your AI-native firm") that shows a six-layer firm as an animated cutaway building, day to night.

This one draws Krish's own universe: Mindmake as the one company, a floor per layer of how it runs, and the agents
that work each floor. Facts were read live on 18 Nov 2026 from Control Center's `PORTFOLIO.md` and `KRISH.md` and every
repository's North Star (`get_venture_state` fleet). Change the floors and cards in `universe.html` (`FLOORS`,
`CARDS`) when the universe changes; never from memory.

| Floor | What works there |
|---|---|
| 00 Roof: Control Center | Krish (every send, spend and post), the live board, the taste ledger, the North Stars, credits |
| 01 Watch | content-watcher, inspirationhouse, divergent-thinker, the AEO probes, Hunter |
| 02 Make | the Sunday room, the script desk, ve, Codex, carousels and covers; Mon, Wed, Fri |
| 03 Grow | one growth engine each for the publication, Mindmake, Heartside, Full Time and Legibility |
| 04 Sell: Mindmake | call prep, the room, keynotes, outbound he sends, the 30-day paid proof |
| 05 Products | the ladder: Heartside and Full Time (1), Legibility (2), CTRL and Pulse (3), Circle dormant |
| 06 Basement | ai-harness, the Claude archive, the media archive, the brand kit, the learnings |

Render (Playwright and ffmpeg): `node lab/universe/render.cjs lab/universe/out` writes `universe-day.png`,
`universe-night.png` (2x) and `universe.mp4` (8 s, 1080x1350). The outputs are media and are not committed.

Compound is left out on purpose: it is personal and its figures are never published.

## Version 4 (the 3D scene) on a fresh machine

`render3d.cjs` and `figurines/lineup.cjs` need three things the repository does not keep: `vendor/three.module.js`
(three r170, `node_modules/three/build/three.module.js`), the ten logo files in `logos/` (fetched from Brandfetch:
`claude-symbol.png` and the `icon` of openai, github, vercel, supabase, elevenlabs, runway, buffer, gmail and canva, named
as in `scene/scene.js` `LOGO`), and `three` resolvable from `lab/universe` for `figurines/check.mjs`.

