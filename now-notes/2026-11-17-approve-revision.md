Status: `board_session.py approve` now finds the picks document's revision by paging the board listing (ten to a page), reads a body encoded twice, and on a revision_conflict writes once more at the revision the board returns; a second approval of the same piece's scripts or lock no longer needs a hand PUT (17 Nov, piece db9f9f6a).
Next: the next typed approval of scripts or a lock goes through `approve` with no hand PUT; if it is refused, file the board's reply on the piece.
Changed: scripts/post-pack/board_session.py, tests/board_session_test.py.

North Star check (2026-11-17): holds.
