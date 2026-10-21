// PreToolUse on Write, Edit, MultiEdit and Bash: the publish board's layout is Krish's. Krish, 2026-10-21: "the rest
// of the content engine needs to know how to feed it and not be permitted to change random parts of the UI and UX but
// feed it in the right way consistently. That applies to Claude and to Codex." A session feeds the board through
// week_board.py's inputs (docs/PUBLISH_BOARDS.md, "The fixed layout"); a change to how it looks or is laid out goes
// to him in person. Codex is held by the same files through CI (npm run check:board-layout).
import { decide, readEvent, repoPath } from './lib.mjs'

// The files that draw the board, its one layout, its colours, the snapshot CI holds it to, and this guard.
const BOARD_UI = [
  /^scripts\/post-pack\/week_board\.py$/,
  /^scripts\/post-pack\/week_board\/.+$/,
  /^scripts\/post-pack\/board_materials\.py$/,
  /^scripts\/post-pack\/tokens\.css$/,
  /^config\/board-layout\.json$/,
  /^fixtures\/week-board\/fixed-layout\.json$/,
  /^scripts\/check_board_layout\.py$/,
  /^\.claude\/hooks\/board-ui-guard\.mjs$/,
]
const guarded = (path) => BOARD_UI.some((re) => re.test(path))
const why = (what) => `board-ui-guard: ${what} draws the publish board Krish works in. Its layout is fixed (config/board-layout.json) `
  + 'and the engine only feeds it (docs/PUBLISH_BOARDS.md); a change to it runs only when he approves it in person.'

const event = readEvent()
const input = event.tool_input || {}
if (event.tool_name === 'Bash') {
  const command = String(input.command || '')
  // A command that names a board file and could write it: sed -i, a redirect, tee, a copy or move over it, a
  // checkout or restore of it, a script that writes files, or --update of the layout snapshot.
  const names = command.match(/(?:scripts\/post-pack\/week_board(?:\.py|\/[\w.-]+)|scripts\/post-pack\/board_materials\.py|scripts\/post-pack\/tokens\.css|config\/board-layout\.json|fixtures\/week-board\/fixed-layout\.json|scripts\/check_board_layout\.py|\.claude\/hooks\/board-ui-guard\.mjs)/g) || []
  const writes = /\bsed\s+-i|>{1,2}\s*\S|\btee\b|\b(?:cp|mv|rm)\b|git\s+(?:checkout|restore|apply)|write_text|open\([^)]*['"][wa]|--update/.test(command)
  if (names.length && writes) decide('ask', why(names[0]))
  if (/check_board_layout\.py\b[^|;&]*--update/.test(command)) decide('ask', why('the layout snapshot'))
  process.exit(0)
}
const path = repoPath(input.file_path)
if (guarded(path)) decide('ask', why(path))
process.exit(0)
