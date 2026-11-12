Status: The live Publish Board carries Approve for publish again, bound to the piece's manifest (view contract 1.8.0): each series day with a draft manifest in its post's library folder shows its exact files with their Drive links and a press bound to the draft's sha256; the route refuses a stale hash (409 manifest_changed) and piece_manifest.py seal accepts the press as the live board saves it.
Next: Control Centre draws the manifest's files beside the press (its pinned copy in control-center tests/fixtures/board-view/).
Changed: apps/control-plane/api/board/_manifest.ts (new), _view.ts, _handler.ts, view.schema.json, fixtures/view.json, docs/PUBLISH_BOARDS.md, docs/GROWTH-HANDOFF.md.
North Star check (2026-11-12): holds.
