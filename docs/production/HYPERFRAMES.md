# HyperFrames and Open Generative AI: what was tested, what was kept

Status: evaluated 15 Nov 2026. HyperFrames is installed as an opt-in film backend for quick-edit's kit, off by
default. Open Generative AI was not adopted. Nothing here changes a cut, a palette element or the ve renderer.

## The short answer

| Project | Verdict | Why, in one line |
|---|---|---|
| [HyperFrames](https://github.com/heygen-com/hyperframes) (HeyGen, Apache-2.0, CLI 0.9.54) | Kept, opt-in, as kit's film backend | It renders our own end card page at visual parity, byte-identical run to run, with no key and no spend; it has no job here today that kit or ve does not already do |
| [Open Generative AI](https://github.com/Anil-matcha/Open-Generative-AI) (MIT) | Not adopted | Every cloud call goes through one paid aggregator (api.muapi.ai); the generation contract it would give us is already designed in ve |

## HyperFrames

### What it is

A renderer that turns an HTML page with seekable animation (CSS, Web Animations, GSAP, Lottie, three.js, `<video>`)
into MP4, MOV or a PNG sequence. Each frame is asked for by number and seeked, never played, so the same page gives the
same frames every time. It also writes ProRes 4444 with a real alpha channel, which kit's own stepper cannot.

### Where it fits, and where it does not

quick-edit's kit already films its HTML end card itself: Playwright steps every CSS animation to each frame and
screenshots it (`scripts/quick-edit/kit.py`, `Drawer.film`). That is the one seam where HyperFrames does the same job,
so that is the only place it is wired.

| Use | Fits? | Why |
|---|---|---|
| The house close (`statement_card`, `statement_beat`) | As a second backend for the same page | The palette's close is kit's `endcard.html`; HyperFrames films that same page unchanged (`config/brand-palette.json`) |
| Branded intros | No | Retired for good (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever."); see `docs/production/BRAND_PALETTE.md` |
| Motion graphics inside a cut | No | ve draws every beat through one data-fed composition, its devices and the design lock (`docs/ve/ENGINE.md`); a second motion system is the per-piece code ve exists to stop |
| Text overlays, lower thirds | Not without Krish | The short's body carries captions only (the palette); a new overlay is a new design, proved on his take first (F04, F13) |
| Transparent plates for named slots | A candidate, not built | Codex could author a plate as HTML and HyperFrames render it with alpha for ve to place; that is a ve card and Krish's call |

### What was measured (cloud container, 15 Nov 2026)

`python scripts/quick-edit/hyperframes_film.py check`, which films the house end card (follow.the.money, Monday 16 Nov)
with kit's own `page_endcard`, fonts and masthead, through both backends:

| Shape | Frames | Two HyperFrames runs | Against Playwright's film (SSIM) | Streams | Playwright | HyperFrames |
|---|---|---|---|---|---|---|
| 16:9, 6 s | 180 | 180 of 180 identical | 0.9978 | identical | 15.1 s | 13.8 s |
| 9:16, 2 s | 60 | 60 of 60 identical | 0.9990 | identical | 5.5 s | 8.0 s |

Compared on contact sheets of both shapes and a full-resolution crop of the settled wide frame: the same layout, type
and motion, frame for frame. The difference left is a
sub-pixel shift on the "Subscribe free" and address lines and antialiasing noise on the days row (mean under 2 of 255).
It is not byte-identical to Playwright's film. The default Playwright clip is byte-identical before and after this
change (frame hashes compared).

Also proved in the spike: a page with a transparent background renders to ProRes 4444 (`yuva444p12le`) with alpha 0
outside the drawn box and 255 inside it. A page with no GSAP or other library needs no network at render time; when a
composition names GSAP that is not on disk, the CLI rewrites it to a public CDN, so kit pages keep everything inline.

### How to run it

Once per machine (78 packages, about 120 MB, outside the root workspaces, install scripts off):

```bash
npm ci --prefix vendor/hyperframes
```

Prove it on that machine before using it (exit 0 is a pass; the report is written beside the clips):

```bash
python scripts/quick-edit/hyperframes_film.py check --out .cache/hyperframes-check
```

Film a kit's end cards with it (everything else kit does is unchanged):

```bash
MYMU_FILM=hyperframes python scripts/quick-edit/kit.py POST_JSON --cut short --recording FILE --out DIR
```

- `MYMU_FILM` unset or `playwright` is today's route. Any other value stops the run.
- A clip filmed by HyperFrames carries `:hyperframes` in its kit signature, so neither backend's clip stands in for the other.
- The CLI drives `HYPERFRAMES_BROWSER_PATH`, else the newest Chrome headless shell under `/opt/pw-browsers`, else `MYMU_BROWSER`
  when it names a file. With none of those, the CLI downloads Chrome Headless Shell once.
- Telemetry is always off: the adapter sets `HYPERFRAMES_NO_TELEMETRY=1` and `DO_NOT_TRACK=1` on every call, because the CLI
  sends usage events by default.
- Tests: `python tests/hyperframes_film_test.py` (the render test runs only where the pinned CLI is installed).

### Rules

- Making HyperFrames kit's default is an engine change: Krish's words, a passing `check` on the machine that films, and
  never in the middle of a piece (F33).
- Never use the CLI's `publish`, `share`, cloud render or HeyGen media verbs from this repository. They upload to
  HeyGen's servers; the adapter calls `render` only. Krish publishes (AGENTS.md, start route, step 5).
- Bump the pinned version only by changing `vendor/hyperframes/package.json` and `VERSION` in `hyperframes_film.py`
  together (the test holds them equal), then run `check` again.

### Costs

None measured or expected. The CLI is free and needs no key; the render is local CPU (about 14 s for the 6 s wide card,
8 s for the 2 s tall beat here, against 15 s and 5.5 s for Playwright). Its paid tier (HyperFrames Pro, HeyGen models)
is never called.

### Limits

- Pre-1.0 and moving fast (50 commits on 15 Nov 2026 alone): it is pinned, and `check` is the gate for any bump.
- It still needs Playwright: kit's `CHECK_JS` fits the statement and lists layout problems before HyperFrames films.
- Only the end card is wired. The plate behind his face and the panels are stills, drawn as before.
- Not tried on the Windows home computers.

## Open Generative AI

Read in full by a separate reader on 15 Nov 2026 (shallow clone, nothing installed or run), with the decision-critical
claims checked again in this session.

- **What it is:** a Next.js 15 web app and an Electron 33 desktop app, the open front end of muapi.ai. Its README sells a
  white-label plan and says it has "No content filters, no prompt rejections, no guardrails".
- **Every cloud call goes to one paid aggregator:** `packages/studio/src/muapi.js` posts to `api.muapi.ai` with an
  `x-api-key`, polls `/api/v1/predictions/{id}/result`, and bills in muapi credits. It is the only API host in its
  generation code; the other hosts are muapi's CDN and sample media.
- **The model catalogue** is a 38,764-line JavaScript module of 627 muapi route slugs (image, video, lipsync, audio),
  with each model's inputs but no prices; prices come from muapi's server.
- **The free paths** are desktop-only: stable-diffusion.cpp, a binary downloaded and run with no checksum check, and
  Wan2GP, which needs our own GPU.
- **Upkeep:** 58 commits between 9 Sep and 15 Nov 2026, 35 of them README-only, one main maintainer; its tests cover only
  the desktop local engines.

**Why nothing was imported.** The engine already reaches the same model vendors through its connectors (Higgsfield,
HeyGen, ElevenLabs), and ve already has the request contract: `docs/plans/<piece>/ve/assets.requests.json` (connector,
tool, arguments, estimated credits, a fallback), run verbatim by the `ve-assets` agent into
`assets.responses.json` (`asset_id, status, job_id, url_or_path, credits_used, error`). That is the submit, poll and
normalise pattern Open Generative AI implements for muapi. Taking it would add a second paid billing layer and
browser-only code. What is missing in ve is the writer, `ve assets plan` (`docs/ve/STATUS.md`, "No generated assets
pipeline"), and every run of it spends credits Krish approves at Gate 1.

**The pattern worth keeping** when `ve assets plan` is built: each model's inputs as data (type, enum, default, min,
max, required), a poll limit per kind (its defaults are 2 minutes for an image, 30 for a video), and one function that
turns any provider's reply into one URL or path.
