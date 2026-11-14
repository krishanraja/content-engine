"""Where a runtime folder is on this computer, found in Drive by its folder ID.

The library sync (scripts/library-sync.ps1, Write-DrivePaths) asks the engine
every pass where each folder in config/studio.json drive_ids is now, found by
its Drive ID (apps/control-plane/api/library/_runtimeFolders.ts), maps it onto
this computer's Google Drive for desktop drive and writes the answer to
%LOCALAPPDATA%\\makeyourmindup\\drive-paths.json (local_roots.runtime in
config/studio.json). On 11 Nov a rename above the library and music roots broke
both home computers, which found them by path; this is how every reader here
finds them by ID instead.

The file's shape (krish-clone, content-watcher and filearchives read it too):

    {"schema_version": 1, "written_at": "...", "written_by": "library-sync",
     "folders": [{"name": "music_root", "id": "...", "state": "found",
                  "path": "H:\\\\My Drive\\\\...\\\\Music", "drive_path": "My Drive/...",
                  "reason": null}]}

Only state "found" is used, and only when its path is a folder that is there.
Anything else (no file, an unreadable file, another state) gives None, and the
caller uses its configured path. Standard library only; it never writes.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

FILE_NAME = 'drive-paths.json'
ENV = 'MINDMAKE_DRIVE_PATHS'  # a test or another computer may name the file itself


def default_file(environ=None) -> Path | None:
    """%LOCALAPPDATA%\\makeyourmindup\\drive-paths.json on Windows, or the file
    MINDMAKE_DRIVE_PATHS names. None elsewhere: only the home computers have one."""
    environ = os.environ if environ is None else environ
    named = str(environ.get(ENV) or '').strip()
    if named:
        return Path(named)
    local = str(environ.get('LOCALAPPDATA') or '').strip()
    if os.name == 'nt' and local:
        return Path(local) / 'makeyourmindup' / FILE_NAME
    return None


def read(file: Path | str | None = None, environ=None) -> list[dict]:
    """Every entry in the file, or [] when there is none or it cannot be read."""
    path = Path(file) if file else default_file(environ)
    if path is None:
        return []
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError):
        return []
    entries = data.get('folders', data.get('entries')) if isinstance(data, dict) else data
    return [e for e in entries if isinstance(e, dict)] if isinstance(entries, list) else []


def found_path(name: str, file: Path | str | None = None, environ=None) -> Path | None:
    """The folder's path on this computer when the engine found it by its ID and
    it is there; else None."""
    for entry in read(file, environ):
        if entry.get('name') != name or entry.get('state') != 'found':
            continue
        local = entry.get('path') or entry.get('local_path')
        if isinstance(local, str) and local and Path(local).is_dir():
            return Path(local)
    return None
