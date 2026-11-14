Status: GET /api/library/file?sha256=<hex> (no path, on the engine key) says where those exact bytes already are in the library: the newest ready copy's library, path and storage object (bucket and key), and every other path holding them, so Control Center can mint a SendLinks file link onto the stored object without moving bytes (I-07).
Next: Control Center's SendLinks lane calls it before uploading anything.
North Star check (2026-11-14): holds.
