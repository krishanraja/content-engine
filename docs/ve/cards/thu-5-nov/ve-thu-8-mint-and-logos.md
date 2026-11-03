---
card: ve-thu-8-mint-and-logos
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/v3home\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-thu-8-mint-and-logos
write_allow: [apps/renderer/src/engine/kit/overlay.ts, apps/renderer/src/engine/devices/stamp/index.tsx, apps/renderer/src/engine/devices/stamp/device.test.ts, apps/renderer/scripts/ve-render.mjs, apps/renderer/src/engine/render-assets.test.ts, apps/renderer/src/engine/devices/logo_card/schema.ts, apps/renderer/src/engine/devices/logo_card/index.tsx, apps/renderer/src/engine/devices/logo_card/device.test.ts, apps/renderer/src/engine/devices/logo_orbit/mark.tsx, apps/renderer/src/engine/devices/logo_orbit/index.tsx, apps/renderer/src/engine/devices/logo_orbit/device.test.ts]
read: apps/renderer/**, config/logo-registry.json, assets/logos/**, docs/plans/2026-11-05-thursday-no-spending/ve/props.short.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Two render faults Thursday showed: block stamps ignore paint, and registry logos never reach the render

## Goal
["Claude rendered Thursday's cut with the placements from ve-thu-7 (merged) and found two engine faults, both against the frozen face-with-proof key frames.\n\n1. A block stamp with `paint: 'mint'` still shows the series colour: stamp/index.tsx sets background to tokens[paint] but then spreads halftone(tokens) (apps/renderer/src/engine/kit/overlay.ts), whose backgroundColor and backgroundImage use tokens.channel. Give halftone the fill colour (halftone(tokens, colour), default tokens.channel so every other caller is unchanged) and have the stamp pass tokens[paint]. Test: a mint block stamp's style names tokens.mint in backgroundColor and backgroundImage and never tokens.channel; the default stamp is unchanged.\n2. logo_card (tiles and row) and logo_orbit draw `<image href={resolveLogo(id)}>`, a repository path such as assets/logos/meta-logo.svg, but apps/renderer/scripts/ve-render.mjs stageRenderAssets stages only src/logoSrc params, the brand, the stem, sfx, segments and plates, so in a real render every mark is blank (Thursday's five tiles render as empty white squares). Stage every registry mark an object names (logos[].id, and logo_orbit's centre when it is a registry id) into the public folder at its own relative path (public/assets/logos/<file>), and have resolveLogo's users draw through Remotion's staticFile so the bundle finds them; keep the schema refusal for unregistered ids. Tests (the staging test lives in apps/renderer/src/engine/render-assets.test.ts, where vitest looks): stageRenderAssets copies exactly the registry files a props' objects name, refuses a registry file that escapes assets/logos, and a logo_card fixture's image hrefs are staticFile paths."]

## Contract
Device rules: apps/renderer/src/engine/devices/CONTRACT.md. One clock (useCurrentFrame only in apps/renderer/src/engine/clock.ts). Pure functions of props, no Math.random, no wall clock. Colour roles from tokens, never raw hex. Change no device.

## Acceptance (every command must exit 0 inside your sandbox)
npx vitest run apps/renderer/src/engine/devices
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-thu-8-mint-and-logos", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
