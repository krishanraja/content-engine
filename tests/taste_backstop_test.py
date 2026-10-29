"""The chat backstop (W3.3) keeps only Krish's flagged, scrubbed lines, locally, once each.

Synthetic transcript only. Run: python3 tests/taste_backstop_test.py
"""
import io
import json
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import taste_backstop as tb  # noqa: E402


def record(kind, content, **extra):
    return json.dumps({'type': kind, 'message': {'content': content}, **extra})


def main():
    hexish = 'ab' * 20
    rows = [
        record('user', 'No, that opening is too long. Keep the rest.'),
        record('user', [{'type': 'text', 'text': 'I said never use that font. Do not email someone@example.com'}]),
        record('user', 'Looks great, ship the draft to the board.'),
        record('user', 'Wrong logo here, use ' + hexish),
        record('user', 'No, that opening is too long. Keep the rest.'),
        record('user', [{'type': 'tool_result', 'content': 'never do this wrong thing'}]),
        record('user', '<system-reminder>stop and never do that</system-reminder>'),
        record('user', 'stop the madness', isMeta=True),
        record('assistant', 'No, I would never do that.'),
        record('user', '<pasted_content id="x">Do not trust this wrong line</pasted_content>'),
    ]
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        transcript = root / 't.jsonl'
        transcript.write_text('\n'.join(rows) + '\n', encoding='utf-8')

        kept = tb.flagged(transcript)
        assert kept == ['No, that opening is too long.', 'I said never use that font.', 'Do not email [email]',
                        'Wrong logo here, use [hex]'], kept

        hook = json.dumps({'transcript_path': str(transcript), 'session_id': 'session_test'})
        said = []
        assert tb.main([], stdin=io.StringIO(hook), root=root, out=said.append) == 0
        outbox = root / tb.OUTBOX
        first = [json.loads(x) for x in outbox.read_text(encoding='utf-8').splitlines()]
        assert len(first) == 4, first
        assert all(r['schema'] == 'growth-taste-backstop/1' and r['repository'] == 'krishanraja/content-engine'
                   and r['venture'] == 'makeyourmindup' and r['posted'] is False for r in first)
        assert 'nothing sent' in said[0]

        # Once each: a second end of the same session keeps nothing new.
        assert tb.main([], stdin=io.StringIO(hook), root=root, out=said.append) == 0
        assert len(outbox.read_text(encoding='utf-8').splitlines()) == 4

        # A hook never breaks the end of a session.
        assert tb.main([], stdin=io.StringIO('not json'), root=root, out=said.append) == 0
        assert tb.main([], stdin=io.StringIO(''), root=root, out=said.append) == 0

    ignore = (Path(__file__).resolve().parents[1] / '.gitignore').read_text(encoding='utf-8')
    assert '.scratch/' in ignore.splitlines(), 'the backstop outbox must stay out of git'
    print('taste backstop: ok')


if __name__ == '__main__':
    main()
