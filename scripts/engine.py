#!/usr/bin/env python3
"""Call the content engine from any agent session: Claude Code, Codex, or a terminal.

Usage:
  python3 scripts/engine.py METHOD PATH [JSON_BODY | @file.json] [--sse] [--full]

Examples:
  python3 scripts/engine.py GET "/api/content-ideas?id=<uuid>"
  python3 scripts/engine.py PATCH /api/content-ideas @body.json
  (On Windows the command is `python`, not `python3`.)

The engine key is read from the environment variable ENGINE_OPERATOR_TOKEN
(Claude Code's cloud environment, or any shell). On Krish's Windows machines it
is read from Windows Credential Manager instead (Mindmake/engine-operator-token,
stored once by scripts/engine-key.ps1), so Codex there needs no setup. It is
never printed, logged or written to a file. ENGINE_BASE_URL overrides the
production address.

--sse   for routes that stream (revise): prints only the last data event.
--full  prints the whole response instead of the first 1,500 characters.
A body field "idempotency_key": "NEW" is replaced with a fresh UUID.

Your own calls are observations. Relay a decision only when Krish made it in
words, with decided_by: 'Krish' (AGENTS.md, docs/CONTENT_ENGINE.md).
"""
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('ENGINE_BASE_URL', 'https://content-engine-flame-nu.vercel.app').rstrip('/')
WINDOWS_TARGET = 'Mindmake/engine-operator-token'


def windows_key() -> str:
    """The key from Windows Credential Manager, or '' when there is none."""
    if os.name != 'nt':
        return ''
    import ctypes
    from ctypes import wintypes

    class FILETIME(ctypes.Structure):
        _fields_ = [('low', wintypes.DWORD), ('high', wintypes.DWORD)]

    class CREDENTIAL(ctypes.Structure):
        _fields_ = [
            ('Flags', wintypes.DWORD), ('Type', wintypes.DWORD),
            ('TargetName', wintypes.LPWSTR), ('Comment', wintypes.LPWSTR),
            ('LastWritten', FILETIME), ('CredentialBlobSize', wintypes.DWORD),
            ('CredentialBlob', ctypes.c_void_p), ('Persist', wintypes.DWORD),
            ('AttributeCount', wintypes.DWORD), ('Attributes', ctypes.c_void_p),
            ('TargetAlias', wintypes.LPWSTR), ('UserName', wintypes.LPWSTR),
        ]

    advapi = ctypes.WinDLL('Advapi32.dll', use_last_error=True)
    cred_read = advapi.CredReadW
    cred_read.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.POINTER(CREDENTIAL))]
    cred_read.restype = wintypes.BOOL
    cred_free = advapi.CredFree
    cred_free.argtypes = [ctypes.c_void_p]
    pointer = ctypes.POINTER(CREDENTIAL)()
    if not cred_read(WINDOWS_TARGET, 1, 0, ctypes.byref(pointer)):
        return ''
    try:
        cred = pointer.contents
        if not cred.CredentialBlob or not cred.CredentialBlobSize:
            return ''
        return ctypes.string_at(cred.CredentialBlob, cred.CredentialBlobSize).decode('utf-16-le')
    finally:
        cred_free(pointer)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    if len(args) < 2:
        print(__doc__)
        return 2
    token = os.environ.get('ENGINE_OPERATOR_TOKEN', '').strip() or windows_key().strip()
    if not token:
        print('No engine key. On a Windows home machine run scripts/engine-key.ps1 once; elsewhere set ENGINE_OPERATOR_TOKEN in this tool\'s environment (WORKBENCH.md, "Pick up from any tool").', file=sys.stderr)
        return 2
    method, path = args[0].upper(), args[1]
    body = None
    if len(args) > 2:
        raw = open(args[2][1:]).read() if args[2].startswith('@') else args[2]
        body = json.loads(raw)
        if isinstance(body, dict) and body.get('idempotency_key') == 'NEW':
            body['idempotency_key'] = str(uuid.uuid4())
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header('Authorization', 'Bearer ' + token)
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    if '--sse' in flags:
        req.add_header('Accept', 'text/event-stream')
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            status, text = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode()
    if '--sse' in flags:
        events = [line[6:] for line in text.splitlines() if line.startswith('data: ')]
        text = events[-1] if events else text
    print(status)
    print(text if '--full' in flags else text[:1500])
    return 0 if 200 <= status < 300 else 1


if __name__ == '__main__':
    sys.exit(main())
