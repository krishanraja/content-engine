#!/usr/bin/env python3
"""The Codex home ve dispatch runs Codex under: a settings folder of its own, so Krish's everyday Codex keeps every
MCP server and plugin he uses while the Codex that runs cards has none.

Krish, 30 Oct, on the Buffer and Teleprompter servers the preflight flagged on LORIMER: "no, we need those", then "do
the separate settings folder fix". Codex reads its settings from CODEX_HOME (default ~/.codex), so this folder is a
second home beside the Studio runtime (Documents\\MindmakeVideoStudio\\runtime\\codex-home):

  config.toml  written from config/codex-profile.json's codex_config alone, with the features that bring tools the
               profile does not allow turned off (FEATURES_OFF): no MCP server, no plugin, no app or connector, no
               browser or computer use, no notify hook. Nothing from ~/.codex/config.toml is copied, so a server or
               plugin added there never reaches it. On LORIMER (30 Oct) ~/.codex had 38 enabled plugins, GitHub,
               Supabase, Stripe, Vercel and Gmail among them, and the ChatGPT account's own connectors (Gmail, Google
               Drive) show in any home until apps and remote_plugin are off.
  auth.json    a hard link to ~/.codex/auth.json: one sign-in, and a token refresh by either Codex is seen by both. A
               copy would not do: a refresh in one home spends the refresh token the other still holds.
  sessions     a junction (a symlink off Windows) to ~/.codex/sessions, so the allowance reading and card usage
               (scripts/velib/cards.py, scripts/session_token_audit.py) see every run, whichever home made it.

  build   make or remake the folder (config.toml rewritten, links made or repaired). Never touches ~/.codex.
  check   the folder is still that: prints {ok, home, problems}; exit 1 on a problem. ve dispatch refuses to start
          Codex under a home that fails it, and the preflight's codex_profile check runs it.
  where   prints the folder's path.

    python scripts/overnight/codex_home.py build|check|where [--home DIR] [--main DIR]

ve dispatch uses this home when its config.toml is there and ~/.codex when it is not, so a computer that has not
built it runs as before and its preflight reads ~/.codex's servers as before.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import codex_profile

HOME = Path.home() / 'Documents' / 'MindmakeVideoStudio' / 'runtime' / 'codex-home'
# Krish's everyday Codex home: CODEX_HOME when it names another folder (a Codex running under this home sets it here).
MAIN = Path(os.environ['CODEX_HOME']) if os.environ.get('CODEX_HOME') and Path(os.environ['CODEX_HOME']) != HOME     else Path.home() / '.codex'
# What the config may carry: the profile's own settings. A table or key outside these is a problem.
TABLES = ('mcp_servers', 'plugins', 'marketplaces')
# Codex features that bring tools outside the profile's allowed_tools (codex features list names them).
FEATURES_OFF = ('apps', 'plugins', 'remote_plugin', 'browser_use', 'browser_use_external', 'computer_use')


def config_text(profile: dict) -> str:
    """config.toml from the profile's codex_config: top-level keys, then dotted keys as their tables."""
    top, tables = [], {}
    for key, value in profile.get('codex_config', {}).items():
        table, _, name = key.rpartition('.')
        line = f'{name} = {json.dumps(value)}'
        (tables.setdefault(table, []) if table else top).append(line)
    tables['features'] = [f'{name} = false' for name in FEATURES_OFF]
    head = ['# Written by scripts/overnight/codex_home.py from config/codex-profile.json. Rebuild it; never edit it.']
    body = top + [line for table, lines in tables.items() for line in ['', f'[{table}]'] + lines]
    return '\n'.join(head + body) + '\n'


def _same(a: Path, b: Path) -> bool:
    try:
        return os.path.samefile(a, b)
    except OSError:
        return False


def _link_dir(link: Path, target: Path) -> None:
    if sys.platform == 'win32':
        # A junction needs no administrator, which a symlink on Windows does.
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(target)], check=True, capture_output=True)
    else:
        link.symlink_to(target, target_is_directory=True)


def build(home: Path = HOME, main: Path = MAIN, profile: dict | None = None) -> list[str]:
    profile = profile or codex_profile.load()
    if codex_profile.audit(profile):
        return ['config/codex-profile.json fails its audit, so no home is built from it']
    if _same(home, main) or home.resolve() == main.resolve():
        return [f"{home} is Codex's everyday home; the Studio's home must be a folder of its own"]
    auth, sessions = main / 'auth.json', main / 'sessions'
    if not auth.is_file():
        return [f'{auth} is missing: sign in to Codex first (codex login)']
    home.mkdir(parents=True, exist_ok=True)
    (home / 'config.toml').write_text(config_text(profile), encoding='utf-8')
    link = home / 'auth.json'
    if not _same(link, auth):
        if link.exists() or link.is_symlink():
            link.unlink()
        os.link(auth, link)
    sessions.mkdir(parents=True, exist_ok=True)
    mine = home / 'sessions'
    if not _same(mine, sessions):
        if mine.is_dir() and not mine.is_symlink() and any(mine.iterdir()):
            return [f'{mine} holds session logs of its own; move them into {sessions}, then build again']
        if mine.exists() or mine.is_symlink():
            mine.rmdir() if mine.is_dir() else mine.unlink()
        _link_dir(mine, sessions)
    return check(home, main, profile)


def check(home: Path = HOME, main: Path = MAIN, profile: dict | None = None) -> list[str]:
    profile = profile or codex_profile.load()
    config = home / 'config.toml'
    if not config.is_file():
        return [f'{config} is missing: run codex_home.py build']
    problems = []
    if config.read_text(encoding='utf-8') != config_text(profile):
        problems.append('config.toml is not what config/codex-profile.json writes: run codex_home.py build')
    for line in config.read_text(encoding='utf-8').splitlines():
        name = line.strip().strip('[]').split('.')[0]
        if line.startswith('[') and name in TABLES:
            problems.append(f'config.toml has a [{line.strip("[]")}] table')
    if not _same(home / 'auth.json', main / 'auth.json'):
        problems.append('auth.json is not the same file as ~/.codex/auth.json (a copy goes stale on the first token '
                        'refresh): run codex_home.py build')
    if not _same(home / 'sessions', main / 'sessions'):
        problems.append('sessions is not ~/.codex/sessions, so the allowance and card usage would miss its runs: '
                        'run codex_home.py build')
    return problems


def active(home: Path = HOME) -> Path | None:
    """The home ve dispatch runs Codex under: this one once built, else None (Codex's own default)."""
    return home if (home / 'config.toml').is_file() else None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('command', choices=['build', 'check', 'where'])
    ap.add_argument('--home', type=Path, default=HOME)
    ap.add_argument('--main', type=Path, default=MAIN)
    a = ap.parse_args(argv)
    if a.command == 'where':
        print(a.home)
        return 0
    problems = build(a.home, a.main) if a.command == 'build' else check(a.home, a.main)
    print(json.dumps({'ok': not problems, 'home': str(a.home), 'problems': problems}))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
