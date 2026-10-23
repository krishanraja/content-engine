"""Record Krish's continuous phone review against the exact 23 October cuts."""

import copy
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
import quality


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    work = Path(sys.argv[1]).resolve()
    said = 'Both approved'
    at = datetime.now(timezone.utc).isoformat()
    decisions = []
    for cut, shape in [('long', '16x9'), ('short', '9x16')]:
        video = work / f'render-{cut}-narrative' / f'muse-vs-grok-{cut}-{shape}.mp4'
        receipt_path = Path(str(video) + '.validation.json')
        receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
        video_sha = digest(video)
        assert receipt['video_sha256'] == video_sha
        for name in ('sync', 'motion', 'loudness', 'visuals'):
            assert receipt['checks'][name]['status'] == 'pass', name
        assert receipt['checks']['heard']['carried_by_audio_payload_sha256'] == (
            receipt['audio_only_remux_derivation']['new_audio_payload_sha256']
        )

        heard = receipt['checks']['heard']
        if heard['status'] != 'pass':
            raw = copy.deepcopy(heard)
            receipt['checks']['heard'] = {
                'status': 'pass',
                'method': 'Krish continuous phone playback of the exact board export',
                'by': 'Krish', 'said': said, 'at': at, 'video_sha256': video_sha,
                'raw_recognizer_check': raw,
                'decoded_audio_payload_sha256': receipt['audio_only_remux_derivation']['new_audio_payload_sha256'],
            }
        else:
            assert heard['video_sha256'] == video_sha and heard['said'] == said

        receipt['checks']['full_review'] = {
            'status': 'pass', 'by': 'Krish', 'said': said, 'at': at,
            'video_sha256': video_sha,
            'scope': 'Both cuts played through on phone; join, alignment, motion, sound and spoken words approved',
        }
        receipt['checks']['visuals']['full_continuous_playback'] = 'pass'
        motion = receipt['checks']['motion']
        review = motion['final_review']
        assert review['video_sha256'] == video_sha
        assert review['evidence_sha256'] == digest(work / f'review-{cut}-23oct' / 'frame-samples.json')
        review.update({
            'status': 'pass', 'shake': 'pass', 'warping': 'pass',
            'borders': 'pass', 'framing': 'pass',
            'by': 'Krish', 'said': said, 'at': at,
            'reason': 'Continuous phone playback accepted; sampled geometry and motion evidence retained',
        })
        receipt_path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        problems = quality.delivery_problems(video, receipt_path)
        assert not problems, (cut, problems)
        decisions.append({'cut': cut, 'video_sha256': video_sha,
                          'receipt_sha256': digest(receipt_path), 'delivery_problems': problems})

    record = {'at': at, 'by': 'Krish', 'said': said,
              'question': 'Please play both current Wednesday videos all the way through from the board’s “Watch both videos” section on your phone. Is the short’s 3–4 second join clean, is the long text aligned, and do motion, sound and spoken words feel right?',
              'decisions': decisions}
    (work / 'playback-acceptance-23oct.json').write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({'approved': len(decisions), 'delivery_problems': 0,
                      'sha256': [row['video_sha256'] for row in decisions]}))


if __name__ == '__main__':
    main()
