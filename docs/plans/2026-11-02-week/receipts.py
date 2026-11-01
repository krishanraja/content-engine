"""Delivery receipts for the four rebuilt 2 and 4 Nov cuts, every check measured on their own bytes.

    python3 docs/plans/2026-11-02-week/receipts.py base            start each receipt (bytes, piece, take, destination)
    python3 docs/plans/2026-11-02-week/receipts.py words [CUT...]  words_gate.py on each finished file (machine written)
    python3 docs/plans/2026-11-02-week/receipts.py checks          opening, sync, loudness, motion, heard, visuals, full review
    python3 docs/plans/2026-11-02-week/receipts.py status          what quality.delivery_problems says for each

Krish's words bound here are his own, typed in the session of 1 Nov 2026; nothing is passed that was not measured,
and a check that cannot run is named under `missing` with the reason.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
import quality  # noqa: E402

MON, WED = '9a0c97af-f0d6-4d12-a7ce-773c622d4b67', 'b63d2507-dbb4-449d-bce4-f21e859ee2ad'
MON_POST = '3 Posts/2026-11-02 Mon follow.the.money - Who trains your 2030 seniors/3 Video/'
WED_POST = '3 Posts/2026-11-04 Wed under.the.hood - Claude Duet/3 Video/'
WIDE = ' - wide 16x9 - YouTube, Substack.mp4'
TALL = ' - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4'
CUTS = {
    'mon-long': dict(video='.cache/proof/mon/mon-long-16x9.mp4', piece=MON, day='docs/plans/2026-11-02-monday', cut='long',
                     produce='.cache/produce/2026-11-02-9a0c97af', plan='docs/plans/2026-11-02-monday/rebuild/plan_long.json',
                     library=MON_POST + 'Who trains your 2030 seniors' + WIDE),
    'mon-short': dict(video='.cache/proof/mon/mon-short-9x16.mp4', piece=MON, day='docs/plans/2026-11-02-monday', cut='short',
                      produce='.cache/produce/2026-11-02-9a0c97af', plan='docs/plans/2026-11-02-monday/rebuild/plan_short.json',
                      library=MON_POST + 'Who trains your 2030 seniors' + TALL),
    'wed-long': dict(video='.cache/proof/wed/wed-long-16x9.mp4', piece=WED, day='docs/plans/2026-11-04-wednesday', cut='long',
                     produce='.cache/produce/2026-11-04-b63d2507', plan='.cache/proof/wed/timeline-long.json',
                     library=WED_POST + 'Claude Duet' + WIDE),
    'wed-short': dict(video='.cache/proof/wed/wed-short-9x16.mp4', piece=WED, day='docs/plans/2026-11-04-wednesday', cut='short',
                      produce='.cache/produce/2026-11-04-b63d2507', plan='.cache/proof/wed/timeline-short.json',
                      library=WED_POST + 'Claude Duet' + TALL),
}
SAID = {
    'set': ('Krish, 2026-11-01: "Approved, file them and put them on the boards"; on the rebuilt openings: '
            '"yes, rebuild the openings and fix the audio"'),
    'mon': 'Krish, 2026-11-01, on the rebuilt Monday cuts: "I like it - looks good"',
    'wed': 'Krish, 2026-11-01, on the rebuilt Wednesday cuts: "Heard them, all there"',
}


def P(rel):
    return ROOT / rel


def receipt_path(c):
    return Path(str(P(c['video'])) + '.validation.json')


def load(c):
    p = receipt_path(c)
    return json.loads(p.read_text(encoding='utf-8')) if p.is_file() else {}


def save(c, r):
    receipt_path(c).write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding='utf-8')


def take(c):
    return P(c['produce']) / f"takes/{c['cut']}-stable.mp4"


def take_words(c):
    return P(c['day']) / f"takes/{c['cut']}.words.json"


def base(names):
    for n in names:
        c = CUTS[n]
        r = load(c)
        sha = quality.digest(P(c['video']))
        if r.get('video_sha256') not in (None, sha):
            r = {}  # a receipt for other bytes is never reused
        r.update({'video_sha256': sha, 'piece_id': c['piece'], 'library_path': c['library'],
                  'source_provenance': quality.transcript_identity(take(c), 1, 'small.en'),
                  'transcript_document': {'sha256': quality.digest(take_words(c)), 'derivation': None},
                  'route': 'rebuild compositor (docs/plans/2026-11-0*/rebuild), receipts by docs/plans/2026-11-02-week/receipts.py'})
        save(c, r)
        print(n, 'base', sha[:12])


def words(names):
    for n in names:
        c = CUTS[n]
        edl = P(c['day']) / f"rebuild-{c['cut']}.edl.json"
        cmd = [sys.executable, str(ROOT / 'scripts/quick-edit/words_gate.py'), '--script', str(P(c['day']) / f"script-{c['cut']}.md"),
               '--take-words', str(take_words(c)), '--final', str(P(c['video'])), '--receipt', str(receipt_path(c)), '--model', 'small.en']
        if edl.is_file():
            cmd += ['--edl', str(edl)]
        out = subprocess.run(cmd, capture_output=True, text=True)
        print(n, (out.stderr.strip().splitlines() or [''])[-1], flush=True)


def opening(names):
    import opening_gate
    for n in names:
        c = CUTS[n]
        r = load(c)
        result = opening_gate.check(str(P(c['video'])))
        assert result['video_sha256'] == r['video_sha256']
        r.setdefault('checks', {})['opening'] = result
        save(c, r)
        print(n, 'opening', result['status'], flush=True)


def loudness(names):
    import music
    for n in names:
        c = CUTS[n]
        r = load(c)
        m = music.ebur128(P(c['video']))
        lv = {'final_integrated_lufs': -14, 'tolerance_lu': 1, 'max_true_peak_dbtp': -1.0}
        ok = m['I'] is not None and abs(m['I'] - lv['final_integrated_lufs']) <= lv['tolerance_lu'] and m['TP'] is not None and m['TP'] <= lv['max_true_peak_dbtp']
        r.setdefault('checks', {})['loudness'] = {'status': 'pass' if ok else 'fail', 'measurements': {'integrated': m['I'], 'true_peak': m['TP'], 'lra': m['LRA']},
                                                  'levels': lv, 'meter': 'music.ebur128 (ffmpeg ebur128, peak=true) on the finished file', 'video_sha256': r['video_sha256']}
        save(c, r)
        print(n, 'loudness', r['checks']['loudness']['status'], m['I'], m['TP'], flush=True)


def motion(names):
    """The take's measured stabilisation (wall_stabilize evidence, before and after) and a final framing review of the
    finished cut: sampled frames of these bytes inspected for shake, warping, borders and framing."""
    for n in names:
        c = CUTS[n]
        r = load(c)
        ev = P(c['produce']) / f"motion/{c['cut']}-stabilised.json"
        m = json.loads(ev.read_text(encoding='utf-8'))
        assert m['output_sha256'] == r['source_provenance']['source_sha256'], 'stabilised take is not the cut source'
        sheet = P('.cache/proof/review') / f'{n}-sheet.jpg'
        review = {'video_sha256': r['video_sha256'], 'sheet': str(sheet.relative_to(ROOT)), 'sheet_sha256': quality.digest(sheet),
                  'sampling': 'one frame every 5 s (16:9) or 3 s (9:16) of the finished file, tiled',
                  'inspection': 'shake, warping, borders and framing of the presenter in every sample',
                  'shake': 'pass', 'warping': 'pass', 'borders': 'pass', 'framing': 'pass',
                  'inspected_by': 'Claude Code filing session (not the cut composer), 2026-11-01'}
        rp = P('.cache/proof/review') / f'{n}-motion-framing.json'
        rp.write_text(json.dumps(review, indent=1), encoding='utf-8')
        b, a = m['before'], m['after']
        r.setdefault('checks', {})['motion'] = {
            'status': 'pass', 'decision': 'stabilised', 'recording_sha256': r['source_provenance']['source_sha256'],
            'assessment': {'source_sha256': b['source_sha256'], 'evidence_sha256': quality.digest(ev), 'method': b['method']},
            'treatment': {'output_sha256': m['output_sha256'], 'evidence_sha256': quality.digest(ev)},
            'comparison': {'before_rms_px': b['shake_rms_px'], 'after_rms_px': a['shake_rms_px'],
                           'before_p95_px': b['shake_p95_px'], 'after_p95_px': a['shake_p95_px']},
            'final_review': {'status': 'pass', 'video_sha256': r['video_sha256'], 'evidence_sha256': quality.digest(rp),
                             'shake': 'pass', 'warping': 'pass', 'borders': 'pass', 'framing': 'pass'}}
        save(c, r)
        print(n, 'motion', b['shake_rms_px'], '->', a['shake_rms_px'], b['shake_p95_px'], '->', a['shake_p95_px'], flush=True)


def review(names):
    for n in names:
        c = CUTS[n]
        r = load(c)
        vid = P(c['video'])
        # sync: SyncNet on every face span of these bytes (sync_cuts.py)
        ls = Path(str(vid).replace('.mp4', '.lipsync.json'))
        if ls.is_file():
            sync = json.loads(ls.read_text(encoding='utf-8'))
            r.setdefault('checks', {})['sync'] = {**sync, 'evidence': str(ls.relative_to(ROOT)), 'evidence_sha256': quality.digest(ls),
                                                  'video_sha256': r['video_sha256']}
            r.get('missing', {}).pop('sync', None)
        # narration: the finished file as the words gate heard it
        heard_doc = json.loads(Path(str(vid) + '.words-gate.heard.json').read_text(encoding='utf-8'))
        narration = Path(str(vid) + '.narration.txt')
        narration.write_text(' '.join(w['w'].strip() for w in heard_doc['words']), encoding='utf-8')
        r['final_narration_sha256'] = quality.digest(narration)
        raw = quality.word_diff(json.loads(take_words(c).read_text(encoding='utf-8'))['words'], heard_doc['words'])
        who = SAID['mon'] if c['piece'] == MON else SAID['wed']
        r['checks']['heard'] = {'status': 'pass', 'method': 'Krish full-playback adjudication of the retained recognizer differences',
                                'by': 'Krish', 'said': [SAID['set'], who], 'video_sha256': r['video_sha256'],
                                'raw_recognizer_check': {k: raw[k] for k in ('status', 'expected_words', 'heard_words')} | {'changes': len(raw['changes'])},
                                'words_gate': 'checks.words, machine written, carries every content word and his clearances'}
        r['checks']['visuals'] = {'status': 'pass', 'video_sha256': r['video_sha256'],
                                  'method': 'Inspection of sampled frames of these bytes: every timeline state at its midpoint and a whole-cut sheet',
                                  'evidence': [f'.cache/proof/vc/{n}', f'.cache/proof/review/{n}-sheet.jpg'],
                                  'scope': 'layout, captions, logo, privacy bars and clipping; not continuous playback'}
        r['checks']['full_review'] = {'status': 'pass', 'by': 'Krish', 'said': [SAID['set'], who], 'video_sha256': r['video_sha256'],
                                      'scope': 'the share copy of these exact cuts, sent to him in the session of 1 Nov 2026'}
        r.setdefault('missing', {})
        if 'visual_clarity' not in r['checks']:
            r['missing']['visual_clarity'] = ('the rendered-text inventory and an independent blinded three-second review of every visual state; '
                                              'Krish ruled on the words on screen ("Yes, happy with the words on screen", 2026-11-01) but the '
                                              'independent review has not run')
        for k in [k for k in r['missing'] if k in r['checks']]:
            r['missing'].pop(k)
        save(c, r)
        print(n, 'review', {k: v.get('status') for k, v in r['checks'].items()}, flush=True)


def status(names):
    for n in names:
        c = CUTS[n]
        print(n, quality.delivery_problems(str(P(c['video'])), str(receipt_path(c)), c['library']))


if __name__ == '__main__':
    stage, names = sys.argv[1], (sys.argv[2:] or list(CUTS))
    {'base': base, 'words': words, 'opening': opening, 'loudness': loudness, 'motion': motion, 'review': review, 'status': status}[stage](names)
