"""One verifier for Python and Studio producers. No local pass bypasses the server."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def check(command, path, piece=None):
    args = ['node', '--import', 'tsx', str(ROOT / 'scripts/media-standard.ts'), command, str(path)]
    if piece:
        args.append(piece)
    run = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if run.returncode:
        return [(run.stderr.strip() or run.stdout.strip() or 'media standard check unavailable')[-3000:]]
    try:
        if json.loads(run.stdout).get('ok') is not True:
            return ['media standard check did not confirm success']
    except (ValueError, TypeError):
        return ['media standard check returned unreadable evidence']
    return []


def preflight(config, base, full_production=False):
    path = config.get('media_brief')
    if not path:
        raise ValueError('Create this piece\'s media brief against docs/MEDIA_STANDARD.md before rendering; previous-piece assets are not a starting kit')
    problems = check('production' if full_production else 'brief', Path(base) / path)
    if problems:
        raise ValueError('; '.join(problems))
