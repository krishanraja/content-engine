# The ideas gate: five outcomes, and only his Approve crosses (Ruling, Krish, 2026-11-11)

Read by every run of `plan-week` before step 1 (the skill, "The ideas gate").

Krish, 2026-11-11: "Once I've completed it, ideas should either be: filed away for later, rejected and learnt from,
saved as a trend for a wider piece, improved for a future piece cue. If they're approved, they should move into the
publish board. ... I shouldn't end up seeing random ideas in the publish board that I never wanted there and that I
didn't approve to move to the publish board."

- **Every idea ends in one of five outcomes**, each his press on the live board, each saying where it sends the idea:
  Approve for <day> (onto the publish board on that day), File for later (back on a later board, or when he asks),
  Reject (his reason, required, is a cue the next ideas run reads and goes to his taste ledger), Save as a trend (the
  trend he names, for a wider piece) and Improve for a future piece (his note, a cue on that idea for a future
  slate). The full table is `docs/PUBLISH_BOARDS.md`, "The ideas gate".
- **You propose; you never place.** Write ideas onto the ideas board (ideas.json, `/api/week/options`) and nothing
  else. Never set a piece's day (`/api/content-ideas/<id>/schedule` answers 409 `not_approved_by_krish`, and the
  database refuses every other placement), never write a pick or a press (the board refuses `pick_is_his`,
  `press_is_his`), and never write `decided` on an option: his words in a session are shown on it and never read as
  his press. His Approve places the idea itself.
- **Read his answers back as cues.** `sources.json` `outcomes` (from `GET /api/week/options?include=sources`) holds his
  answers on the eight weeks of boards before this one: offer a filed idea again where it fits, never offer a rejected
  one again and learn from his reason, gather trends by the name he gave them (propose the wider piece once a trend
  has enough), and carry an improve note into that idea's pitch.
- **Check before you say a piece is on its day**: `python3 scripts/post-pack/board_gate.py <Monday>` lists every piece
  with "Approved by you, <when>" and every held line, and exits 1 when anything is held.
