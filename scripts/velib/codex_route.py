"""How a Codex thread is started on this machine: the command line ve dispatch runs scripts/codex_thread.mjs with.

Three routes, chosen by where the dispatch runs and which Codex home it runs under:

  windows      native Windows (Claude Code or the lane on his PC's Windows side): node runs codex_thread.mjs directly.
  linux        Linux, or WSL with a Linux home (VE_CODEX_DESKTOP_HOME=~/.codex): node and codex from this machine.
  wsl-windows  WSL with a Windows home (/mnt/c/Users/<you>/.codex, the one his Codex Desktop app reads, which is what
               dispatch picks by default inside WSL since PR #714): the Windows node.exe runs codex_thread.mjs through
               WSL interop with every path in its Windows form (wslpath -w), and codex_thread.mjs starts the Windows
               codex.exe (its folder first on PATH) with CODEX_HOME=C:\\Users\\<you>\\.codex.

codex_thread.mjs is ai-harness's canonical copy, byte for byte, so this module changes nothing in it. Two things follow.
Windows node is given a byte-identical copy of it on a Windows drive (beside the Codex home, .ve-codex\\codex_thread.mjs),
because the script finds out it is the main script from its URL's pathname, which drops the host of a
\\\\wsl.localhost path, so run from there it would exit having done nothing. And the Windows codex must be codex.exe,
because the script starts `codex` without a shell, which never reaches the npm codex.cmd shim.

Why wsl-windows exists: from 16:24 UTC on 15 Nov every lane build on his PC failed before Codex started with "failed to
initialize sqlite state runtime under /mnt/c/Users/krish/.codex". The lane builds in WSL, and the Linux codex binary
cannot open its sqlite state on a Windows filesystem reached through WSL. Windows-native Codex on that same home works
and shows in his Desktop app (proved on 15 Nov through codex_thread.mjs). So the Linux codex is never run against a
/mnt/<drive> home: the Windows route is taken, and when Windows node or codex cannot be found the dispatch stops in one
line naming the fix, never falling back.

The card's worktree stays on the WSL filesystem and Windows Codex reaches it as \\\\wsl.localhost\\<distro>\\...
(wslpath -w): verify-card, git and the acceptance commands keep running in WSL on the same files at full speed, and the
worktree's node_modules link (a Linux symlink) keeps working for them. Moving the worktree to /mnt/c would make every
WSL step slow and put git and node on the same Windows-through-WSL mount that broke the sqlite state.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

# Options of codex_thread.mjs whose value is a path; on the wsl-windows route each goes over in its Windows form.
PATH_OPTIONS = ('--cwd', '--prompt-file', '--home', '--log')
WINDOWS_MOUNT = re.compile(r'^/mnt/([A-Za-z])(/|$)')

NO_NODE = ('ve dispatch: the Codex home {home} is a Windows home, so Codex must run as Windows Codex, and Windows node '
           'was not found from WSL ({why}). Fix: install Node.js on Windows (in PowerShell: winget install '
           'OpenJS.NodeJS.LTS), then run the dispatch again. Linux codex is never run against a /mnt home.')
NO_CODEX = ('ve dispatch: the Codex home {home} is a Windows home, so Codex must run as Windows Codex, and no Windows '
            'codex.exe was found from WSL ({why}). Fix: put the folder holding codex.exe (the one Codex Desktop ships, or '
            'the native build of the npm @openai/codex package) on the Windows PATH, so that where codex in PowerShell '
            'lists a codex.exe, then run the dispatch again. Linux codex is never run against a /mnt home.')
NO_INTEROP = ('ve dispatch: the Codex home {home} is a Windows home, and WSL cannot run Windows programs here ({why}). '
              'Fix: turn WSL interop on ([interop] enabled=true in /etc/wsl.conf, then wsl --shutdown), or set '
              'VE_CODEX_DESKTOP_HOME to a Linux home. Linux codex is never run against a /mnt home.')


class RouteError(RuntimeError):
    """The route this dispatch needs cannot be taken; the message is the one line to show, with the fix."""


def is_windows_home(home) -> bool:
    """A Codex home on a Windows drive as WSL sees it (/mnt/c/...)."""
    return bool(WINDOWS_MOUNT.match(str(home).replace('\\', '/')))


def in_wsl(env=None) -> bool:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'overnight'))
    import codex_home
    return codex_home.in_wsl(env)


def route(home, *, platform: str | None = None, wsl: bool | None = None) -> str:
    platform = sys.platform if platform is None else platform
    if platform == 'win32':
        return 'windows'
    if (in_wsl() if wsl is None else wsl) and is_windows_home(home):
        return 'wsl-windows'
    return 'linux'


def _run(args, run=subprocess.run, **kw):
    try:
        return run(args, capture_output=True, text=True, timeout=20, **kw)
    except FileNotFoundError as error:
        raise RouteError(NO_INTEROP.format(home='{home}', why=f'{args[0]} not found: {error}')) from error
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RouteError(NO_INTEROP.format(home='{home}', why=f'{args[0]} failed: {error}')) from error


def drvfs_windows(path) -> str | None:
    """A /mnt/<drive>/... path in its Windows form (C:\\...), worked out without wslpath, which may answer a path that does
    not exist yet with its \\\\wsl.localhost form; None for any other path."""
    text = str(path).replace('\\', '/')
    match = WINDOWS_MOUNT.match(text)
    if not match:
        return None
    rest = text[match.end():].strip('/')
    return f'{match.group(1).upper()}:\\' + rest.replace('/', '\\')


def wslpath(path, flag: str = '-w', run=subprocess.run) -> str:
    if flag == '-w':
        known = drvfs_windows(path)
        if known:
            return known
    done = _run(['wslpath', flag, str(path)], run)
    out = (done.stdout or '').strip()
    if done.returncode != 0 or not out:
        raise RouteError(f've dispatch: wslpath {flag} {path} failed ({(done.stderr or "").strip() or done.returncode}); '
                         'the WSL to Windows path translation is needed for the Windows Codex route')
    return out


def windows_where(name: str, run=subprocess.run) -> list[str]:
    """Where Windows finds a command (cmd.exe /c where NAME), as Windows paths; [] when it finds none."""
    cwd = '/mnt/c' if Path('/mnt/c').is_dir() else None
    done = _run(['cmd.exe', '/c', 'where', name], run, cwd=cwd)
    if done.returncode != 0:
        return []
    return [line.strip() for line in (done.stdout or '').splitlines() if re.match(r'^[A-Za-z]:\\', line.strip())]


def pick_exe(found: list[str]) -> str | None:
    """The first .exe: codex_thread.mjs (and node) start a program without a shell, which never reaches a .cmd shim."""
    return next((path for path in found if path.lower().endswith('.exe')), None)


def staged_script(home) -> Path:
    """Where Windows node runs codex_thread.mjs from on the wsl-windows route: a byte-identical copy beside the Windows
    Codex home, on the Windows drive (see the module's head for why not the \\\\wsl.localhost path)."""
    return Path(str(home).replace('\\', '/')).parent / '.ve-codex' / 'codex_thread.mjs'


def stage(script, home) -> Path:
    """Copy codex_thread.mjs to its Windows place when it differs; the copy is the same bytes, never an edit."""
    target = staged_script(home)
    data = Path(script).read_bytes()
    if not target.is_file() or target.read_bytes() != data:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return target


def thread_command(script, sub: str, options: list, home, *, platform: str | None = None, wsl: bool | None = None,
                   run=subprocess.run, which=shutil.which) -> tuple[list[str], str, dict]:
    """(argv, route, extra) for `node codex_thread.mjs <sub> <options>`. options is a flat list of codex_thread.mjs
    options (flags and their values), --home included. extra, on the wsl-windows route: stage (the script and the
    Windows place to copy it to before launch) and path (the WSL form of codex.exe's folder, put first on PATH, which
    WSL hands to Windows node in Windows form). Raises RouteError with the one-line fix when the route cannot be taken."""
    chosen = route(home, platform=platform, wsl=wsl)
    if chosen != 'wsl-windows':
        if not which('codex'):
            raise RouteError('ve dispatch: the codex command is not on PATH (install Codex, or open Codex Desktop once)')
        return ['node', str(script), sub, *[str(o) for o in options]], chosen, {}
    try:
        node = pick_exe(windows_where('node', run))
        if not node:
            raise RouteError(NO_NODE.format(home=home, why='cmd.exe /c where node found no node.exe'))
        found = windows_where('codex', run)
        codex = pick_exe(found)
        if not codex:
            raise RouteError(NO_CODEX.format(home=home, why='where codex found ' + (', '.join(found) or 'nothing')))
        target = staged_script(home)
        argv = [wslpath(node, '-u', run), wslpath(target, '-w', run), sub]
        values = iter([str(o) for o in options])
        for opt in values:
            argv.append(opt)
            if opt in PATH_OPTIONS:
                argv.append(wslpath(next(values), '-w', run))
            elif opt.startswith('--') and opt not in ('--json', '--detach'):
                argv.append(next(values))
        codex_dir = wslpath(codex.rsplit('\\', 1)[0], '-u', run)
    except RouteError as error:
        raise RouteError(str(error).replace('{home}', str(home))) from None
    return argv, chosen, {'stage': (str(script), str(target)), 'path': codex_dir, 'codex': codex}


def smoke(argv: list[str], env: dict, cwd, run=subprocess.run) -> None:
    """Start Windows node on the staged codex_thread.mjs with no command, as the launch will (same node, script, cwd and
    environment): it prints its usage and starts no Codex. On 15 Nov the first card on this route came back with only
    node's MODULE_NOT_FOUND, its own line cut off, so a failure here stops in one line with node's error and the paths."""
    try:
        done = run(argv[:2], capture_output=True, text=True, timeout=60, cwd=cwd, env=env)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RouteError(f've dispatch: Windows node could not be started ({argv[0]}): {error}') from error
    text = (done.stdout or '') + (done.stderr or '')
    if 'MODULE_NOT_FOUND' in text or 'Cannot find module' in text or 'usage' not in text.lower():
        said = next((line.strip() for line in text.splitlines() if 'Error' in line or 'Cannot find' in line), '')
        raise RouteError(f've dispatch: Windows node {argv[0]} could not run {argv[1]} from {cwd} (exit {done.returncode}'
                         f'{": " + said if said else ""}). Check that file exists in Windows Explorer; '
                         f'its copy is made from scripts/codex_thread.mjs on every dispatch.')


def linux_form(path: str) -> str:
    """A cwd Windows Codex logged for a worktree on the WSL filesystem (\\\\wsl.localhost\\Ubuntu\\home\\...) in the
    form WSL gives it (/home/...), so verify-card finds the card's session by its worktree; any other path unchanged."""
    text = str(path).replace('\\', '/')
    match = re.match(r'^//(?:wsl\.localhost|wsl\$)/[^/]+(/.*)?$', text, re.I)
    return (match.group(1) or '/') if match else text


def describe(argv: list[str], chosen: str, extra: dict | None = None) -> str:
    """The command as one line, for --dry-run and ve codex route."""
    line = f'route {chosen}: ' + ' '.join(a if re.fullmatch(r'[\w./:=@,+-]+', a) else repr(a) for a in argv)
    if extra and extra.get('codex'):
        line += f" (codex {extra['codex']} first on PATH; codex_thread.mjs copied unchanged to {extra['stage'][1]})"
    return line


def environ_for(chosen: str, env: dict, extra: dict | None = None) -> dict:
    """The environment for the launch. On wsl-windows CODEX_HOME goes as --home in its Windows form, so a WSL CODEX_HOME
    is dropped, and codex.exe's folder goes first on PATH, which WSL translates for Windows node."""
    if chosen == 'wsl-windows':
        env = {k: v for k, v in env.items() if k != 'CODEX_HOME'}
        if extra and extra.get('path'):
            env['PATH'] = extra['path'] + (':' + env['PATH'] if env.get('PATH') else '')
    return env
