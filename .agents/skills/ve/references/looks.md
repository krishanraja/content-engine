# Looks, caption styles and the tall frame

Read with `docs/ve/ENGINE.md`, "New capabilities", and `docs/ve/MOTION_STANDARD.md`, Channels.

- **Lab styles in the bank.** `ladder` (The Ladder) and `living-screen` (The Living Screen) are `needs_device`
  modules until their cards in `docs/ve/cards/styles-3d/` are built; a spec naming them renders in house motion until
  then. New styles are designed and proved in the style lab first (`lab/styles/README.md`, "From the lab to ve").
- **Captions.** `brand.captions` (`house` or `word`) or a caption style, `brand.caption_theme` (15 names in
  `apps/renderer/src/engine/captions/names.ts`; `art-directed` is his pick, `cinematic` is Audrey's system). A style
  not yet proved on one of his takes is proved there before a cut ships with it: set it in the spec and run `ve proof`.
- **The tall frame.** Nothing he must read sits under any platform's buttons, and no wordmark sits over the content
  (the outro card keeps it). The layouts, `HOUSE.caption` and the design lock's caption zone carry the safe positions,
  and `ve qc` `channel.safe_zones` fails a box that strays. Never place words by hand.
