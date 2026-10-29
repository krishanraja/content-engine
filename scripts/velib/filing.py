"""ve file: put a piece's READY cuts in the archive and in the post's `3 Video` folder, bound to its piece_id.

It uses the routes the quick-edit and post-pack tools already use, never a copy of their rules:
  - the archive: scripts/quick-edit/archive.py (archive_root, archive_videos: MINDMAKE_ARCHIVE_ROOT, the
    `Video Engine > Archive` folder on Drive, docs/DRIVE.md);
  - the library: scripts/post-pack/library.py (post_folder, refusal) and plan_files.library_roots
    (MINDMAKE_LIBRARY_ROOT, the `makeyourmindup` library on Drive, whose `3 Posts/<post>/3 Video` Library Sync reads).
Both are local folders that Google Drive for desktop syncs on a home computer, so filing never calls a Drive API,
never shares and never publishes. A cut is filed only when `ve status` would call it READY: QC bound to its hash, a
Critic verdict and Krish's final approval of that exact file. Nothing is overwritten.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

from .common import ROOT, sha256_file, write_json

sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import archive  # noqa: E402
import library  # noqa: E402

SHAPE = {'9:16': 'tall', '16:9': 'wide'}


def readiness(spec: dict, cut: str, directory: Path) -> tuple[list[str], str | None, str | None]:
    """(reasons it is not ready, the QC-bound video, its sha256): the same reasons `ve status` prints."""
    from . import packet  # noqa: PLC0415
    state = packet.readiness(spec, cut, directory)
    return state['mechanical'] + state['design'] + state['final'], state['video'], state['digest']


def library_root(given=None) -> Path:
    if given:
        return Path(given)
    import plan_files  # noqa: PLC0415
    roots = plan_files.library_roots()
    if not roots:
        raise ValueError('no library folder: give --library, or set MINDMAKE_LIBRARY_ROOT to the makeyourmindup library')
    return roots[0].parent


def plan(spec: dict, cuts: list[str], *, subject: str, when: str | None = None) -> dict:
    """What would be written where, checked before anything is: shapes, names, the post folder and its path rule."""
    when = when or spec.get('publish_day')
    if not when:
        raise ValueError('filing needs the publish date: --date, or publish_day in the spec')
    shapes = {}
    for cut in cuts:
        shape = SHAPE[spec['cuts'][cut]['aspect']]
        if shape in shapes:
            raise ValueError(f'cuts {shapes[shape]} and {cut} are both {shape}: one video per shape')
        shapes[shape] = cut
    planned = archive.plan(subject, list(shapes), when)
    post = library.post_folder(when, subject, spec['brand']['series'])
    files = []
    for item in planned['videos']:
        relative = f'{library.POSTS}/{post}/{library.VIDEO}/{item["file"]}'
        refused = library.refusal(relative)
        if refused:
            raise ValueError(f'the library refuses {relative}: {library.explain(refused)}')
        files.append({'cut': shapes[item['shape']], 'shape': item['shape'], 'name': item['file'], 'library': relative})
    return {'date': when, 'subject': subject, 'post_folder': post, 'archive_folder': planned['folder'], 'files': files}


def file(spec: dict, directory: Path, cuts: list[str], *, subject: str, when: str | None = None,
         archive_at=None, library_at=None, dry_run: bool = False, today: str | None = None) -> dict:
    directory = Path(directory)
    planned = plan(spec, cuts, subject=subject, when=when)
    videos, blocked = {}, []
    for item in planned['files']:
        reasons, video, digest = readiness(spec, item['cut'], directory)
        if reasons:
            blocked.append(f'{item["cut"]}: NOT READY (' + '; '.join(reasons) + ')')
            continue
        videos[item['cut']] = (Path(video), digest)
    if blocked:
        raise ValueError('filing refused: ' + ' | '.join(blocked))
    if dry_run:
        return {**planned, 'dry_run': True}
    archive_dir = archive.archive_root(archive_at)
    root = library_root(library_at)
    if not Path(root).is_dir():
        raise ValueError(f'the library folder {root} does not exist: check the path, and that Google Drive is running')
    # Re-hash right before copying: what is filed is exactly the file Krish approved.
    for cut, (video, digest) in videos.items():
        if sha256_file(video) != digest:
            raise ValueError(f'{cut}: {video} changed after its approval')
    sidecar = Path(root) / library.POSTS / planned['post_folder'] / library.VIDEO / f've-{spec["piece_id"]}.json'
    for target in [sidecar] + [Path(root) / item['library'] for item in planned['files']]:
        if target.exists():
            raise ValueError(f'{target} already exists: nothing is overwritten')
    by_shape = {item['shape']: videos[item['cut']][0] for item in planned['files']}
    archived = archive.archive_videos(archive_dir, subject, tall=by_shape.get('tall'), wide=by_shape.get('wide'),
                                      day=planned['date'], find_shares=False)
    record = {'schema': 've-filed/1', 'piece_id': spec['piece_id'], 'filed_on': today or date.today().isoformat(),
              'subject': subject, 'date': planned['date'], 'archive': archived['path'], 'files': []}
    for item in planned['files']:
        video, digest = videos[item['cut']]
        target = Path(root) / item['library']
        archive.copy_new(video, target)
        if sha256_file(target) != digest:
            raise ValueError(f'{target}: the copy does not match the approved file')
        record['files'].append({'cut': item['cut'], 'shape': item['shape'], 'sha256': digest,
                                'library': item['library'],
                                'archive': str(Path(archived['path']) / next(f['file'] for f in archived['files']
                                                                            if f['shape'] == item['shape']))})
    write_json(sidecar, record)
    write_json(directory / 'filed.json', record)
    return record
