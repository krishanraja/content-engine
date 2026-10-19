"""Apply Krish's three exact caption decisions to a new delivery version.

The existing MP4, source transcript and recorded scripts remain byte-identical.
Run from the repository root; no network writes or paid calls.
"""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
PLAN = Path(__file__).parent
WORK = ROOT / '.cache/produce/2026-10-19-5b5bfadc'
OUT = ROOT / '.cache/monday-final-captions/files'
DECISIONS = [
    ('around four batch to read words and 20 batch to write a batch to write words.',
     '$4 a batch to read tokens, and $20 a batch to write tokens.'),
    ('Now, there are two ways to bring this down and the build down, sorry.',
     'Two ways to bring the bill down.'),
    ('Find whoever runs AI way work.', 'Find whoever runs AI where you work.'),
]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    stem = WORK / 'long/why-ai-prices-keep-changing-long'
    source = Path(str(stem) + '-16x9.srt')
    original = source.read_text(encoding='utf8')
    blocks = [block.splitlines() for block in original.strip().split('\n\n')]
    by_id = {int(block[0]): block for block in blocks}
    assert ' '.join(by_id[30][2:] + by_id[31][2:]) == "It's now " + DECISIONS[0][0]
    assert ' '.join(by_id[54][2:]) == DECISIONS[1][0]
    assert ' '.join(by_id[104][2:]) == DECISIONS[2][0]
    # Keep the exact combined time interval of cues 30/31 and every other cue.
    by_id[30][1] = by_id[30][1].split(' --> ')[0] + ' --> ' + by_id[31][1].split(' --> ')[1]
    by_id[30][2:] = ["It's now $4 a batch to read tokens,", 'and $20 a batch to write tokens.']
    by_id[54][2:] = [DECISIONS[1][1]]
    by_id[104][2:] = [DECISIONS[2][1]]
    revised = [block for block in blocks if int(block[0]) != 31]
    for index, block in enumerate(revised, 1):
        block[0] = str(index)
    final = '\n\n'.join('\n'.join(block) for block in revised) + '\n'
    # Semantic comparison: only the three declared spans may differ.
    original_words = ' '.join(' '.join(block.splitlines()[2:]) for block in original.strip().split('\n\n'))
    expected_words = original_words
    for before, after in DECISIONS:
        assert expected_words.count(before) == 1
        expected_words = expected_words.replace(before, after)
    actual_words = ' '.join(' '.join(block[2:]) for block in revised)
    assert actual_words == expected_words
    target = OUT / 'Why AI prices keep changing - long - approved captions.srt'
    target.write_text(final, encoding='utf8')
    raw_transcript = Path(str(stem) + '.cut.txt').read_text(encoding='utf8')
    transcript = raw_transcript
    for before, after in DECISIONS:
        assert transcript.count(before) == 1
        transcript = transcript.replace(before, after)
    text_target = OUT / 'Why AI prices keep changing - long - approved transcript.txt'
    text_target.write_text(transcript, encoding='utf8')
    # Versioned caption sources travel with the code; originals remain in place.
    captions = PLAN / 'captions'
    captions.mkdir(exist_ok=True)
    (captions / 'long-approved.srt').write_text(final, encoding='utf8')
    (captions / 'long-approved.txt').write_text(transcript, encoding='utf8')
    report = {
        'approved_by': 'Krish', 'date': '2026-10-19',
        'said': '1) say "$4 a batch to read tokens, and $20 a batch to write tokens. 2) say "two ways to bring the bill down" 3) "where you work".',
        'decisions': [{'before': a, 'after': b} for a, b in DECISIONS],
        'original_srt_sha256': digest(source),
        'files': [{'name': p.name, 'sha256': digest(p), 'bytes': p.stat().st_size} for p in [target, text_target]],
        'video_sha256_unchanged': digest(Path(str(stem) + '-16x9.mp4')),
        'caption_questions_remaining': [],
        'semantic_diff': 'Only the three approved passages; cue 30/31 merged over their original interval; other timings unchanged.',
        'publication_hold': 'One contradicted-category article fact entry remains. No paid run or gate override authorised.',
    }
    assert report['video_sha256_unchanged'] == '90392c47fcec934f3507cf2d7dd5e26a7ddd3fd26c5c70a9988e9cb11c4f0c19'
    (PLAN / 'caption-final-receipt.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'approved_passages': 3, 'files': report['files'], 'video_unchanged': True}))


if __name__ == '__main__':
    main()
