Status: His notes on a piece can be saved for the Perplexity research prompt, the Claude production prompt or both (contract 1.33.0, the save press's `for`), and every note is kept: each prompt lists all of his notes that feed it (up to 100; the prompt text carries the newest ten), read from every week so a note follows its piece through a move.
Next: control-center reads `notes.saved[].for` and sends `for` with the save (control-center#981); once both are live, a note saved on Fri 20 at Production planned shows on its card for good.
Also: every card carries `notes {save, saved}` at every stage, posts at Made, Scheduled and Live included; each save is a new note; a post's notes follow it to another day.
Changed: apps/control-plane/api/board/_view.ts, _viewContract.ts, view.schema.json, docs/PUBLISH_BOARDS.md, tests/control-plane/board-notes-research.test.ts, board-week-model.test.ts, the view fixtures.

North Star check (2026-11-19): holds.
