#!/usr/bin/env python3
"""Validate complete Claude exports, reconcile without loss, then explicitly import.

Export format and approval boundary: docs/handovers/board-web-release.md.
The default is a local dry run. An inaccessible collection is never empty.
"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import re
import sys
from board_web import canonical, sha, call, spec, upload

COLLECTIONS = ('ticks', 'links', 'edits', 'picks', 'queue', 'comments')
ROOT = Path(__file__).resolve().parents[2]

def stamp(body):
    try:
        parsed = datetime.fromisoformat(body['at'].replace('Z', '+00:00'))
        return parsed.timestamp() if parsed.tzinfo else None
    except (KeyError, ValueError, TypeError, AttributeError):
        return None

def reconcile(exports, expected, resolutions=None):
    resolutions = resolutions or {}
    groups, records, counts, sources = {}, [], [], set()
    for export in exports:
        week, source = export.get('week'), export.get('source')
        if source not in expected.get(week, []) or (week, source) in sources:
            raise ValueError('Unexpected or duplicate source artifact')
        sources.add((week, source))
        if export.get('version') != 1 or export.get('complete') is not True:
            raise ValueError('Export must explicitly attest completeness')
        if set(export.get('collections', {})) != set(COLLECTIONS):
            raise ValueError('All five collections and comments must be explicitly exported, including empty ones')
        for collection in COLLECTIONS:
            values = export['collections'][collection]
            if not isinstance(values, list): raise ValueError('A collection must be an array')
            comment_roots = {v['id']: v['body'] for v in values} if collection == 'comments' else {}
            counts.append({'week': week, 'source': source, 'collection': collection, 'count': len(values)})
            ids = set()
            for value in values:
                if not isinstance(value, dict) or not isinstance(value.get('id'), str) or not isinstance(value.get('body'), dict) or value['id'] in ids:
                    raise ValueError('Invalid or duplicate source document')
                ids.add(value['id'])
                raw = {'week': week, 'source': source, 'collection': collection, 'id': value['id'], 'body': value['body']}
                raw['source_sha256'] = sha(canonical(raw).encode())
                records.append(raw)
                # Comments are namespaced by source, including thread references.
                # Similar text in two accounts is not proof of the same comment.
                chosen = dict(raw)
                if collection == 'comments':
                    prefix = sha(source.encode())[:12] + '-'
                    def comment_id(original):
                        return prefix + (original if re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,139}', original) else sha(original.encode()))
                    chosen['id'] = comment_id(value['id'])
                    original_anchor = value['body'].get('anchor')
                    parent = comment_roots.get(value['body']['thread_id'])
                    if not parent or parent.get('thread_id') != value['body']['thread_id']:
                        raise ValueError('Source comment reply has no root')
                    parent_anchor = parent.get('anchor')
                    anchor = parent_anchor.removeprefix('#') if isinstance(parent_anchor, str) else ''
                    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}', anchor): anchor = 'board-root'
                    if '_html_ids' in export and anchor not in export['_html_ids']: anchor = 'board-root'
                    metadata = dict(value['body'].get('original_metadata') or {})
                    metadata.update(source_comment_id=value['id'], source_anchor=original_anchor)
                    chosen['body'] = dict(value['body'], thread_id=comment_id(value['body']['thread_id']), anchor=anchor, original_metadata=metadata)
                groups.setdefault((week, collection, chosen['id']), []).append(chosen)
    required = {(week, source) for week, urls in expected.items() for source in urls}
    if sources != required: raise ValueError('Missing source artifacts; refuse partial migration')
    winners, conflicts = [], []
    for key, versions in sorted(groups.items()):
        bodies = {canonical(v['body']) for v in versions}
        selected = None
        if len(bodies) == 1: selected = versions[0]
        else:
            timestamps = [stamp(v['body']) for v in versions]
            if all(t is not None for t in timestamps):
                newest = [v for v,t in zip(versions,timestamps) if t == max(timestamps)]
                if len({canonical(v['body']) for v in newest}) == 1: selected = newest[0]
            resolution = resolutions.get('/'.join(key))
            if resolution:
                selected = next((v for v in versions if v['source_sha256'] == resolution), None)
                if not selected: raise ValueError('Resolution does not name an existing source record')
        if selected: winners.append(selected)
        else: conflicts.append({'key': '/'.join(key), 'sources': [v['source_sha256'] for v in versions]})
    # Parent comments must be created before their replies.
    winners.sort(key=lambda r: (r['collection'] == 'comments' and r['id'] != r['body'].get('thread_id'), r['week'], r['collection'], r['id']))
    return {'records': records, 'winners': winners, 'conflicts': conflicts, 'counts': counts}

def import_plan(plan):
    if plan['conflicts']: raise ValueError('Resolve every ambiguous conflict before import')
    for week in sorted({r['week'] for r in plan['records']}):
        records = [r for r in plan['records'] if r['week'] == week]
        # Archive each source version before changing canonical state.
        for record in records:
            call('POST', f'/api/board/{week}/imports', {'records': [record]})
        archived = call('GET', f'/api/board/{week}/imports')['records']
        hashes = {r['source_sha256'] for r in archived}
        if not {r['source_sha256'] for r in records}.issubset(hashes): raise ValueError('Source archive readback mismatch')
    applied = 0
    for record in plan['winners']:
        week, collection, doc_id, body = (record[k] for k in ('week','collection','id','body'))
        docs = call('GET', f'/api/board/{week}/{collection}')['documents']
        existing = next((d for d in docs if d['id'] == doc_id), None)
        if existing and existing['body'] == body: continue
        if existing:
            old, incoming = stamp(existing['body']), stamp(body)
            if old is None or incoming is None or old == incoming:
                raise ValueError(f'Destination conflict at {week}/{collection}/{doc_id}; no overwrite')
            if old > incoming: continue  # A later web save wins over an old export.
        call('PUT', f'/api/board/{week}/{collection}/{doc_id}', {'body': body, 'revision': existing['revision'] if existing else 0})
        check = call('GET', f'/api/board/{week}/{collection}')['documents']
        if not any(d['id'] == doc_id and d['body'] == body for d in check): raise ValueError('Imported state readback mismatch')
        applied += 1
    return applied

def export_files(path, export):
    path = Path(path).resolve()
    files = []
    for kind, suffix in [('export', '.json'), ('html', '.html'), ('manifest', '.json')]:
        if kind == 'manifest' and export.get('manifest_file') is None:
            missing = export.get('export_evidence', {}).get('manifest', {})
            if missing.get('accessible') is not False or not isinstance(missing.get('reason'), str) or not missing['reason'].strip():
                raise ValueError('Missing original manifest requires explicit source evidence')
            continue
        target = path if kind == 'export' else (path.parent / export[kind + '_file']).resolve()
        if not target.is_relative_to(path.parent) or target.suffix != suffix:
            raise ValueError('Source files must be sibling HTML/JSON files inside the export directory')
        file, data = spec(export['week'], target, 'text/html' if kind == 'html' else 'application/json')
        files.append((kind, file, data))
    return files

def archive_export(path, export):
    files = {}
    for kind, file, data in export_files(path, export):
        files[kind] = file
        upload(export['week'], file, data)
    if export.get('manifest_file') is None:
        files['manifest_unavailable'] = export['export_evidence']['manifest']
    call('POST', f'/api/board/{export["week"]}/sources', {'source': export['source'], 'files': files})
    actual = call('GET', f'/api/board/{export["week"]}/sources')['sources']
    if not any(s['export_sha256'] == files['export']['sha256'] and s['files'] == files for s in actual):
        raise ValueError('Original source-file archive readback mismatch')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('exports', nargs='+'); parser.add_argument('--resolutions'); parser.add_argument('--apply', action='store_true')
    parser.add_argument('--accept-source-limitations', action='store_true', help='Only after explicit approval of the reported missing manifests/comment metadata; never treats missing collections as empty')
    args = parser.parse_args()
    expected = json.loads((ROOT/'config/boards.json').read_text(encoding='utf-8'))['weeks']
    expected = {w: expected[w] for w in ('2026-10-12', '2026-10-19')}
    exports = [json.loads(Path(p).read_text(encoding='utf-8')) for p in args.exports]
    for path, export in zip(args.exports, exports):
        export_files(path, export)
        html = (Path(path).parent / export['html_file']).read_text(encoding='utf-8')
        export['_html_ids'] = set(re.findall(r'\bid=["\x27]([^"\x27]+)["\x27]', html))
    resolutions = json.loads(Path(args.resolutions).read_text()) if args.resolutions else None
    plan = reconcile(exports, expected, resolutions)
    # Validate all source bytes before even the first approved upload.
    for path, export in zip(args.exports, exports): export_files(path, export)
    report = {k: plan[k] for k in ('counts','conflicts')}
    limitations = []
    for export in exports:
        evidence = export.get('export_evidence', {})
        if export.get('manifest_file') is None:
            limitations.append({'source': export['source'], 'missing_original_manifest': evidence['manifest']})
        fidelity = evidence.get('comments_source', {}).get('fidelity_limits', []) or evidence.get('collections', {}).get('comments', {}).get('limitations', [])
        if fidelity: limitations.append({'source': export['source'], 'comment_fidelity_limits': fidelity})
    report['source_limitations'] = limitations
    report.update(source_records=len(plan['records']), canonical_records=len(plan['winners']), dry_run=not args.apply,
                  export_sha256=[sha(Path(p).read_bytes()) for p in args.exports])
    if args.apply:
        if plan['conflicts']: raise ValueError('Resolve conflicts before any write')
        if limitations and not args.accept_source_limitations:
            raise ValueError('Source limitations require explicit approval before import; inspect the dry-run report')
        for path, export in zip(args.exports, exports): archive_export(path, export)
        report['applied'] = import_plan(plan)
    print(json.dumps(report, indent=2))
    return 1 if plan['conflicts'] else 0

if __name__ == '__main__':
    try: sys.exit(main())
    except (ValueError, OSError, KeyError) as error:
        print(f'board import: {error}', file=sys.stderr); sys.exit(1)
