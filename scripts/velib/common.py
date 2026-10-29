"""Shared helpers for ve (docs/ve/ENGINE.md). Standard library plus numpy only."""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'config' / 've'
WORK = ROOT / '.ve-work'


def load_json(path: Path | str):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path: Path | str, data) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return path


def sha256_file(path: Path | str) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command; on Windows resolve npx/npm/node shims through the shell."""
    shell = sys.platform == 'win32' and cmd and cmd[0] in ('npx', 'npm')
    text = kwargs.pop('text', True)
    if text:  # Windows would decode child output as cp1252 and turn a quote's ellipsis into mojibake
        kwargs = {'encoding': 'utf-8', 'errors': 'replace', **kwargs}
    return subprocess.run(cmd if not shell else subprocess.list2cmdline(cmd), shell=shell, cwd=kwargs.pop('cwd', ROOT),
                          capture_output=True, text=text, **kwargs)


def ffmpeg() -> str:
    exe = shutil.which('ffmpeg')
    if not exe:
        sys.exit('ve: ffmpeg is not on PATH (ve doctor explains)')
    return exe


def piece_dir(piece: str) -> Path:
    """A piece is its plan folder under docs/plans, or a path to one."""
    candidate = Path(piece)
    if candidate.is_dir():
        return candidate.resolve()
    return (ROOT / 'docs' / 'plans' / piece).resolve()


def crew_for(format_id: str) -> list[str]:
    return load_json(CONFIG / 'formats' / f'{format_id}.json')['crew']


# ---------------------------------------------------------------- the one local layout (config/studio.json local_roots)
# Contract (W2.11): config/studio.json `local_roots` is {"repos": "...\\{repo}", "worktrees": "...\\{repo}\\{branch}",
# "runtime": "...", optional "toolchain": "..."}; %NAME% is a Windows environment variable. Precedence for each kind:
# its environment override, then the config, then the fallback below, which types no home-computer path.
STUDIO = ROOT / 'config' / 'studio.json'
LOCAL_KINDS = ('repos', 'worktrees', 'runtime', 'toolchain')
LOCAL_ENV = {'repos': 'MINDMAKE_LOCAL_REPOS', 'worktrees': 'MINDMAKE_LOCAL_WORKTREES',
             'runtime': 'MINDMAKE_LOCAL_RUNTIME', 'toolchain': 'VE_TOOLCHAIN'}
_TAIL = {'repos': '{repo}', 'worktrees': '{repo}\\{branch}'}  # what a root given without placeholders is given


def main_checkout() -> Path:
    """The main checkout this code belongs to (a worktree's main repository), found from git; this folder otherwise."""
    try:
        out = subprocess.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=ROOT,
                             capture_output=True, text=True, timeout=20)
        if out.returncode == 0 and out.stdout.strip():
            return Path(out.stdout.strip()).parent
    except (OSError, subprocess.SubprocessError):
        pass
    return ROOT


def local_fallback(kind: str) -> str:
    """Where a kind lives when config/studio.json has no local_roots entry for it: beside the main checkout (repos,
    worktrees, and the toolchain, which is where it is today), and %LOCALAPPDATA%\\makeyourmindup\\ for runtime."""
    if kind == 'runtime':
        return '%LOCALAPPDATA%\\makeyourmindup\\'
    parent = str(main_checkout().parent)
    return {'repos': parent + '\\{repo}', 'worktrees': parent + '\\.worktrees\\{repo}\\{branch}',
            'toolchain': parent + '\\toolchain'}[kind]


def local_roots(studio: Path | str | None = None) -> dict:
    """config/studio.json local_roots, or {} when the key is absent (each reader then uses local_fallback)."""
    roots = load_json(studio or STUDIO).get('local_roots') or {}
    if not isinstance(roots, dict):
        raise ValueError('config/studio.json local_roots must be an object')
    return roots


def _expand_windows_vars(text: str, environ) -> str:
    def value(match):
        name = match.group(1)
        if environ.get(name):
            return environ[name]
        if name.upper() == 'LOCALAPPDATA':  # as packages/core/src/paths.ts does off Windows
            return str(Path.home() / 'AppData' / 'Local')
        raise ValueError(f'local_roots names %{name}% and it is not set')
    return re.sub(r'%([A-Za-z_][A-Za-z0-9_]*)%', value, text)


def local_root(kind: str, repo: str = 'content-engine', branch: str | None = None, *, environ=None,
               studio: Path | str | None = None) -> str:
    """One root of the local layout: the kind's environment override, else config/studio.json local_roots, else the
    fallback. A root given without {repo}/{branch} is the folder they go under."""
    if kind not in LOCAL_KINDS:
        raise ValueError(f'unknown local root {kind!r}; one of {", ".join(LOCAL_KINDS)}')
    environ = os.environ if environ is None else environ
    configured = local_roots(studio).get(kind)
    if configured is not None and not isinstance(configured, str):
        raise ValueError(f'config/studio.json local_roots.{kind} must be a string')
    template = environ.get(LOCAL_ENV[kind], '').strip() or configured or local_fallback(kind)
    if kind in _TAIL and '{repo}' not in template:
        template = template.rstrip('\\/') + '\\' + _TAIL[kind]
    if '{branch}' in template and not branch:
        raise ValueError(f'local root {kind} needs a branch')
    filled = template.replace('{repo}', repo).replace('{branch}', (branch or '').replace('/', '\\'))
    return _expand_windows_vars(filled, environ)


def card_worktree(card_id: str) -> str:
    """Where a Codex card's worktree lives: the worktrees root, repo content-engine, branch ve-card/<card>."""
    return local_root('worktrees', repo='content-engine', branch=f've-card/{card_id}')


def shell_path(path: str) -> str:
    r"""C:\Users\... as Git Bash writes it: /c/Users/...; a path that is not a drive path keeps its form, with / only."""
    match = re.match(r'^([A-Za-z]):[\\/]*(.*)$', path)
    if match:
        rest = match.group(2).replace('\\', '/').rstrip('/')
        return f'/{match.group(1).lower()}/{rest}' if rest else f'/{match.group(1).lower()}'
    return path.replace('\\', '/')


def native_path(path: str) -> Path:
    """A local_root path as this machine opens it. A Windows drive path off Windows is refused, never made into a
    folder named C:; elsewhere backslashes become slashes."""
    if sys.platform == 'win32':
        return Path(path)
    if re.match(r'^[A-Za-z]:', path):
        raise ValueError(f'{path} is a Windows path and this is not Windows: set {", ".join(LOCAL_ENV.values())} as needed')
    return Path(path.replace('\\', '/'))


if __name__ == '__main__':  # python scripts/velib/common.py local-root <kind> [--shell]  (scripts/ve-env.sh reads this)
    args = sys.argv[1:]
    if len(args) < 2 or args[0] != 'local-root':
        sys.exit('usage: python scripts/velib/common.py local-root <repos|worktrees|runtime|toolchain> [--shell]')
    root = local_root(args[1], branch='main' if args[1] == 'worktrees' else None)
    print(shell_path(root) if '--shell' in args else root)
