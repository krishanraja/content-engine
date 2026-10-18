#!/usr/bin/env python3
"""Call the content engine from any agent session: Claude Code, Codex, or a terminal.

Usage:
  python3 scripts/engine.py METHOD PATH [JSON_BODY | @file.json] [--sse] [--full]

Examples:
  python3 scripts/engine.py GET "/api/content-ideas?id=<uuid>"
  python3 scripts/engine.py PATCH /api/content-ideas @body.json
  python3 scripts/engine.py POST /api/content-ideas/<uuid>/package @body.json
      (the YouTube title and description for the piece's video, and the
      piece's Substack title and subtitle; body.json may give thumbnail_text,
      video_seconds and hint, all optional)
  (On Windows the command is `python`, not `python3`.)

The engine key is read from the environment variable ENGINE_OPERATOR_TOKEN
(Claude Code's cloud environment, or any shell). On Krish's Windows machines it
is read from Windows Credential Manager instead (Mindmake/engine-operator-token,
stored once by scripts/engine-key.ps1). It is never printed, logged or written
to a file. ENGINE_BASE_URL overrides the production address.

Codex on Windows runs commands in its sandbox as a separate Windows user
(CodexSandboxOffline or CodexSandboxOnline). That user cannot read Krish's
Credential Manager and has no internet, so this helper must run outside the
sandbox: ask for escalated permissions and Krish approves. When it cannot find
the key, it says which of these is the cause.

--sse   for routes that stream (revise): prints only the last data event.
--full  prints the whole response instead of the first 1,500 characters.
--despite-precheck  run a paid fact check although the free pre-check lists
        numbers on no filed source (POST .../fact-check first reads the free
        GET, prints what the run will check, and refuses until then).
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
# The host the cloud environment's network secret is bound to: the same address, before any override.
PROXY_KEYED_BASE = 'https://content-engine-flame-nu.vercel.app'
WINDOWS_TARGET = 'Mindmake/engine-operator-token'
ERROR_NOT_FOUND = 1168  # Credential Manager has no entry by that name for this user


def windows_user() -> str:
    """The Windows account this process really runs as: the token's user, which
    differs from an inherited USERNAME inside Codex's sandbox."""
    import ctypes
    from ctypes import wintypes
    advapi = ctypes.WinDLL('Advapi32.dll', use_last_error=True)
    advapi.GetUserNameW.argtypes = [wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    advapi.GetUserNameW.restype = wintypes.BOOL
    size = wintypes.DWORD(257)
    buf = ctypes.create_unicode_buffer(size.value)
    if advapi.GetUserNameW(buf, ctypes.byref(size)):
        return buf.value
    return os.environ.get('USERNAME', '')


def windows_key() -> tuple:
    """(key, 0) from Windows Credential Manager, or ('', Windows error code)."""
    if os.name != 'nt':
        return '', 0
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
        return '', ctypes.get_last_error()
    try:
        cred = pointer.contents
        if not cred.CredentialBlob or not cred.CredentialBlobSize:
            return '', ERROR_NOT_FOUND
        return ctypes.string_at(cred.CredentialBlob, cred.CredentialBlobSize).decode('utf-16-le'), 0
    finally:
        cred_free(pointer)


def no_key_message(os_name: str, user: str, error: int) -> str:
    """What to do when there is no key, in words an agent can act on."""
    if os_name != 'nt':
        return ('No engine key. Set ENGINE_OPERATOR_TOKEN in this tool\'s environment '
                '(WORKBENCH.md, "Pick up from any tool").')
    if user.lower().startswith('codexsandbox'):
        return (f"This ran inside Codex's sandbox, as the Windows user {user}. The sandbox "
                "cannot see Krish's engine key and cannot reach the internet. Run the same "
                "command again outside the sandbox: ask for escalated permissions and Krish "
                "approves. Never ask Krish for the key itself.")
    if error == ERROR_NOT_FOUND:
        return (f"This computer has no engine key for the Windows user {user}. Krish runs "
                "scripts/engine-key.ps1 once in his own PowerShell window and pastes the key "
                "from KeePass (the entry \"Mindmake engine key\"). Never ask him to paste it "
                "into a chat.")
    return (f"The engine key could not be read from Windows Credential Manager (Windows user "
            f"{user}, error {error}). If this ran inside a sandbox, run it again outside it. "
            "Otherwise Krish runs scripts/engine-key.ps1 -Check in his own PowerShell window, "
            "which says what is wrong.")


class NoKey(Exception):
    """There is no engine key here; the message says what to do."""


class Unreachable(Exception):
    """The engine could not be reached; the message says why."""


def operator_key() -> str:
    """The engine key: ENGINE_OPERATOR_TOKEN, else (on Krish's Windows
    machines) Windows Credential Manager. Raises NoKey with what to do when
    there is none. The key is never printed, logged or written to a file.
    scripts/post-pack/send.py authenticates through this too."""
    token = os.environ.get('ENGINE_OPERATOR_TOKEN', '').strip()
    if token:
        return token
    # Krish, 2026-10-09: in Claude Code's cloud the key is a network secret
    # (Bearer on the engine's own host, path /api/). The session's proxy adds
    # the real header to every request to that host, and the container never
    # holds the key, so any stand-in value here is replaced on the way out.
    if os.environ.get('CLAUDE_CODE_REMOTE') and BASE == PROXY_KEYED_BASE:
        return 'injected-by-the-session-proxy'
    key, error = windows_key()
    token = key.strip()
    if token:
        return token
    user = windows_user() if os.name == 'nt' else ''
    raise NoKey(no_key_message(os.name, user, error))


def call(method: str, path: str, body=None, token: str = '', sse: bool = False, timeout: int = 300) -> tuple:
    """(status, text) for one call to the engine at BASE, on the engine key.
    Raises Unreachable when the engine cannot be reached."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method.upper())
    req.add_header('Authorization', 'Bearer ' + token)
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    if sse:
        req.add_header('Accept', 'text/event-stream')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except urllib.error.URLError as e:
        raise Unreachable(f'Could not reach the engine at {BASE} ({e.reason}). If this ran inside a '
                          'sandbox with no internet, run it again outside the sandbox.')


def precheck_refusal(answer: dict, flags: set) -> str:
    """Why a paid fact check should wait, from the free GET's answer: numbers
    the piece states that no filed source carries (Krish, 2026-10-15, on the
    model bill; 59 paid runs on 13 and 14 October went round the run-fix-run
    loop this catches for free). Empty when the run may go."""
    listed = ((answer or {}).get('precheck') or {}).get('numbers_not_on_file') or []
    if not listed or '--despite-precheck' in flags:
        return ''
    lines = [f'  {", ".join(x["numbers"])}: {x["sentence"][:140]}' for x in listed]
    return ('Not running the paid fact check: these numbers are on no filed source, so only the '
            'web check could bear them out. File the source that carries each one (or fix the '
            'number), then run again; or pass --despite-precheck when the web check is meant '
            'to carry them.\n' + '\n'.join(lines))


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    if len(args) < 2:
        print(__doc__)
        return 2
    try:
        token = operator_key()
    except NoKey as no_key:
        print(no_key, file=sys.stderr)
        return 2
    method, path = args[0].upper(), args[1]
    body = None
    if len(args) > 2:
        raw = open(args[2][1:]).read() if args[2].startswith('@') else args[2]
        body = json.loads(raw)
        if isinstance(body, dict) and body.get('idempotency_key') == 'NEW':
            body['idempotency_key'] = str(uuid.uuid4())
    if method == 'POST' and path.split('?')[0].rstrip('/').endswith('/fact-check'):
        try:
            gs, gt = call('GET', path.split('?')[0], None, token, timeout=60)
        except Unreachable as unreachable:
            print(unreachable, file=sys.stderr)
            return 3
        try:
            answer = json.loads(gt) if gs == 200 else {}
        except ValueError:
            answer = {}
        scope = answer.get('next_run') or {}
        if scope:
            print(f'This run checks {scope.get("fresh_sentences")} fresh sentences; '
                  f'{scope.get("reusable_sentences")} keep their last result.', file=sys.stderr)
        why = precheck_refusal(answer, flags)
        if why:
            print(why, file=sys.stderr)
            return 4
    try:
        status, text = call(method, path, body, token, sse='--sse' in flags)
    except Unreachable as unreachable:
        print(unreachable, file=sys.stderr)
        return 3
    if '--sse' in flags:
        events = [line[6:] for line in text.splitlines() if line.startswith('data: ')]
        text = events[-1] if events else text
    print(status)
    print(text if '--full' in flags else text[:1500])
    return 0 if 200 <= status < 300 else 1


if __name__ == '__main__':
    sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[0]))
    import quiet_errors  # G7: one line on failure, the traceback to .cache/logs
    sys.exit(quiet_errors.run(main, 'engine'))
