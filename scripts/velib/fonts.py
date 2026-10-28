"""Offline, hash-checked makeyourmindup brand faces and local CSS."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from .common import CONFIG, ROOT, load_json, sha256_file, write_json

MANIFEST = CONFIG / 'fonts.json'
CSS_FAMILIES = {
    'display': 'MYMU Anton',
    'structure': 'MYMU Archivo',
    'dek': 'MYMU Fraunces',
    'data': 'MYMU Plex Mono',
}


def check() -> tuple[bool, list[str]]:
    """Check the bundled files without needing access to the source kit."""
    lines = []
    ok = True
    try:
        manifest = load_json(MANIFEST)
        folder = ROOT / manifest['dir']
        for family in manifest['families']:
            for face in family['files']:
                path = folder / face['file']
                valid = path.is_file() and sha256_file(path) == face['sha256']
                ok = ok and valid
                lines.append(f"{'PASS' if valid else 'FAIL'} {face['file']}: " +
                             ('sha256 matches' if valid else 'missing or sha256 mismatch'))
            license_path = folder / family['license']
            valid = license_path.is_file() and bool(license_path.read_text(encoding='utf-8').strip())
            ok = ok and valid
            lines.append(f"{'PASS' if valid else 'FAIL'} {family['license']}: " +
                         ('license present' if valid else 'license missing or empty'))
    except (OSError, ValueError, KeyError, TypeError) as error:
        return False, lines + [f'FAIL brand fonts: {error}']
    return ok, lines


def css(rel_dir: str) -> str:
    """Declare the exact kit files under the renderer's isolated MYMU names."""
    rules = []
    for family in load_json(MANIFEST)['families']:
        for face in family['files']:
            rules.append('\n'.join([
                '@font-face {',
                f"  font-family: '{CSS_FAMILIES[family['role']]}';",
                f"  src: url('{rel_dir.rstrip('/')}/{face['file']}') format('truetype');",
                f"  font-weight: {face['weight']};",
                f"  font-style: {face['style']};",
                *(['  font-stretch: 62% 125%;'] if family['role'] == 'structure' else []),
                '  font-display: block;',
                '}',
            ]))
    return '\n\n'.join(rules) + '\n'


def sync(kit_dir: Path | str, update_manifest: bool = False) -> list[str]:
    """Validate the whole source before copying; hash changes need explicit opt-in.

    A refused sync raises SystemExit with a filename and exits the CLI with 1.
    """
    try:
        manifest = load_json(MANIFEST)
        source = Path(kit_dir)
        if not source.is_dir():
            sys.exit(f've fonts sync: kit folder is absent: {source}')
        names = []
        for family in manifest['families']:
            for face in family['files']:
                path = source / face['file']
                if not path.is_file():
                    sys.exit(f"ve fonts sync: missing {face['file']}")
                digest = sha256_file(path)
                if digest != face['sha256'] and not update_manifest:
                    sys.exit(f"ve fonts sync: sha256 mismatch for {face['file']}; use --update-manifest to accept")
                face['sha256'] = digest
                names.append(face['file'])
            license_path = source / family['license']
            if not license_path.is_file() or not license_path.read_text(encoding='utf-8').strip():
                sys.exit(f"ve fonts sync: missing or empty {family['license']}")
            names.append(family['license'])
        destination = ROOT / manifest['dir']
        destination.mkdir(parents=True, exist_ok=True)
        for name in names:
            target = destination / name
            if not target.exists() or not (source / name).samefile(target):
                shutil.copy2(source / name, target)
        if update_manifest:
            write_json(MANIFEST, manifest)
        return [f'synced {name}' for name in names]
    except (OSError, ValueError, KeyError, TypeError) as error:
        sys.exit(f've fonts sync: {error}')
