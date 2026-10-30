#!/usr/bin/env python3
"""Codex's tool profile: what Codex may use on the home computers, and the checks that hold it.

Failure production-asked-to-publish (config/failures.json): the production session asked Krish for a Substack
sign-in code to publish. Krish: "Codex prepares the board and never publishes directly". Only Claude Code's hook
stops a publish and Codex runs no hooks, so Codex is held by its profile instead (config/codex-profile.json):

  audit      the profile itself: no forbidden tool among what it allows, no MCP server, no network, no escalation
             (approval_policy never) and no full-access sandbox. A profile that fails is never used: the runner and
             ve dispatch refuse to start Codex at all.
  admit      one card's tools against the profile. A card that names a tool the profile does not allow, or any
             publish, share, deploy, TikTok, Buffer or workflow tool, is HELD: recorded as held with the reason,
             never sent.
  installed  the MCP servers this machine's Codex has (the JSON of `codex mcp list --json`): any whose name or
             command is a forbidden kind is a failure, since a card could reach it whatever the card says.

    python3 scripts/overnight/codex_profile.py audit [--profile PATH]
    python3 scripts/overnight/codex_profile.py admit TOOL [TOOL ...] [--profile PATH]
    python3 scripts/overnight/codex_profile.py installed --mcp-json FILE [--profile PATH]

Each prints one JSON line and exits 0 when it passes, 1 when it does not.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROFILE = ROOT / 'config' / 'codex-profile.json'
# The kinds the brief names, which every profile must forbid whatever else it lists (W2.6: "no publish, share, deploy,
# TikTok, Buffer or workflow tools, and no escalation path").
REQUIRED_FORBIDDEN = ('publish', 'share', 'deploy', 'tiktok', 'buffer', 'workflow', 'escalat')
# PowerShell's script-launch switch, which every pwsh-started server carries: it lets Windows run the script and grants
# Codex nothing, so it is taken out of a server's command line before the forbidden terms are read (the Studio's own
# server tripped "bypass" on it, 30 Oct). Only the switch and its Bypass value go; every other word is still read.
LAUNCH_SWITCH = re.compile(r'(?i)(?<!\S)-(?:executionpolicy|ep)\s+bypass(?!\S)')


def load(path: Path | str | None = None) -> dict:
    return json.loads(Path(path or PROFILE).read_text(encoding='utf-8'))


def _tokens(name: str) -> list[str]:
    return [t for t in re.split(r'[^a-z0-9]+', str(name).lower()) if t]


def forbidden_terms(name: str, profile: dict) -> list[str]:
    """The forbidden terms a tool or server name carries: a term of four letters or fewer must be a whole word of the
    name (gh, post, send), a longer one may start a word (escalate, escalation, publishing)."""
    words = _tokens(name)
    joined = '_'.join(words)
    hits = []
    for term in profile.get('forbidden') or []:
        term = str(term).lower().strip()
        if not term:
            continue
        if '_' in term:
            found = term in joined
        elif len(term) <= 4:
            found = term in words
        else:
            found = any(word.startswith(term) for word in words)
        if found:
            hits.append(term)
    return hits


def audit(profile: dict) -> list[str]:
    """Why this profile may not be used, [] when it may."""
    out = []
    if not isinstance(profile, dict) or profile.get('schema') != 'codex-profile/1':
        return ['the profile must be an object with schema codex-profile/1']
    forbidden = [str(t).lower() for t in profile.get('forbidden') or []]
    for term in REQUIRED_FORBIDDEN:
        if term not in forbidden:
            out.append(f'the profile must forbid {term}')
    if profile.get('approval_policy') != 'never':
        out.append('approval_policy must be never: an unattended Codex has no escalation path')
    if profile.get('sandbox_mode') not in ('read-only', 'workspace-write'):
        out.append('sandbox_mode must be read-only or workspace-write, never full access')
    if profile.get('network_access') is not False:
        out.append('network_access must be false')
    if profile.get('allowed_mcp_servers'):
        out.append('allowed_mcp_servers must be empty: Codex reaches no MCP server on a card')
    tools = profile.get('allowed_tools')
    if not isinstance(tools, list) or not tools or any(not isinstance(t, str) or not t.strip() for t in tools):
        out.append('allowed_tools must be a non-empty list of tool names')
        tools = []
    for tool in tools:
        hits = forbidden_terms(tool, profile)
        if hits:
            out.append(f'allowed tool {tool} is a forbidden kind ({", ".join(hits)})')
    config = profile.get('codex_config') or {}
    if config.get('approval_policy') != 'never' or config.get('sandbox_mode') != profile.get('sandbox_mode') \
            or config.get('sandbox_workspace_write.network_access') is not False:
        out.append('codex_config must carry the same approval_policy, sandbox_mode and network_access')
    return out


def admit(tools, profile: dict) -> list[str]:
    """Why a card that needs these tools is held, [] when it may be sent. The profile is audited first."""
    problems = audit(profile)
    if problems:
        return ['the Codex profile fails its audit: ' + '; '.join(problems)]
    allowed = set(profile['allowed_tools'])
    out = []
    for tool in tools:
        tool = str(tool).strip()
        if not tool:
            continue
        hits = forbidden_terms(tool, profile)
        if hits:
            out.append(f'the card needs {tool}, a forbidden kind of tool ({", ".join(hits)})')
        elif tool not in allowed:
            out.append(f'the card needs {tool}, which the Codex profile does not allow')
    return out


def _servers(listing) -> list[dict]:
    """The servers in `codex mcp list --json`, whichever shape it takes: a list, or an object holding one."""
    if isinstance(listing, dict):
        for key in ('servers', 'mcp_servers', 'data'):
            if isinstance(listing.get(key), (list, dict)):
                return _servers(listing[key])
        return [dict(value, name=name) if isinstance(value, dict) else {'name': name} for name, value in listing.items()]
    if isinstance(listing, list):
        return [s if isinstance(s, dict) else {'name': str(s)} for s in listing]
    return []


def installed(listing, profile: dict) -> list[str]:
    """The installed MCP servers that are a forbidden kind, by name (never their command line or settings)."""
    out = []
    for server in _servers(listing):
        name = str(server.get('name') or '')
        transport = server.get('transport') if isinstance(server.get('transport'), dict) else {}
        words = ' '.join(str(x) for x in [name, server.get('command') or '', transport.get('command') or '',
                                         *(server.get('args') or []), *(transport.get('args') or []),
                                         server.get('url') or '', transport.get('url') or ''])
        words = LAUNCH_SWITCH.sub(' ', words)
        if forbidden_terms(words, profile):
            out.append(name or 'unnamed')
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--profile', help='the profile to read (default config/codex-profile.json)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('audit')
    a = sub.add_parser('admit'); a.add_argument('tools', nargs='+')
    i = sub.add_parser('installed'); i.add_argument('--mcp-json', required=True, help='the saved output of codex mcp list --json')
    args = ap.parse_args(argv)
    try:
        profile = load(args.profile)
    except (OSError, ValueError) as error:
        print(json.dumps({'ok': False, 'problems': [f'the Codex profile cannot be read: {error}']}))
        return 1
    if args.cmd == 'audit':
        problems = audit(profile)
    elif args.cmd == 'admit':
        problems = admit(args.tools, profile)
    else:
        try:
            listing = json.loads(Path(args.mcp_json).read_text(encoding='utf-8-sig') or '[]')
        except (OSError, ValueError) as error:
            print(json.dumps({'ok': False, 'problems': [f'the MCP listing cannot be read: {error}']}))
            return 1
        problems = audit(profile) + [f'Codex has the MCP server {name}, a forbidden kind' for name in installed(listing, profile)]
    print(json.dumps({'ok': not problems, 'problems': problems}))
    return 0 if not problems else 1


if __name__ == '__main__':
    sys.exit(main())
