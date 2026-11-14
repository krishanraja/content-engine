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


# The cases that keep lines locally run with no environment and no network. With the session's own environment, a
# cloud container (CLAUDE_CODE_REMOTE=true) sent these invented lines to Krish's real taste ledger as his words
# (4 rows on 14 Nov 2026, reported_at 19:44 UTC). A test never reads os.environ here and never posts.
OFFLINE = {}


def no_network(*_args, **_kwargs):
    raise AssertionError('a test tried to send to the taste ledger')


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
        assert tb.main([], stdin=io.StringIO(hook), root=root, out=said.append, env=OFFLINE, post=no_network) == 0
        outbox = root / tb.OUTBOX
        first = [json.loads(x) for x in outbox.read_text(encoding='utf-8').splitlines()]
        assert len(first) == 4, first
        assert all(r['schema'] == 'growth-taste-backstop/1' and r['repository'] == 'krishanraja/content-engine'
                   and r['venture'] == 'makeyourmindup' and r['posted'] is False for r in first)
        assert 'nothing sent' in said[0]

        # Once each: a second end of the same session keeps nothing new.
        assert tb.main([], stdin=io.StringIO(hook), root=root, out=said.append, env=OFFLINE, post=no_network) == 0
        assert len(outbox.read_text(encoding='utf-8').splitlines()) == 4

        # A hook never breaks the end of a session.
        assert tb.main([], stdin=io.StringIO('not json'), root=root, out=said.append, env=OFFLINE, post=no_network) == 0
        assert tb.main([], stdin=io.StringIO(''), root=root, out=said.append, env=OFFLINE, post=no_network) == 0

    # I-33: with the backstop key the lines post to Control Center's route; the file is only the fallback.
    secret = 'fixture-backstop-key'
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        transcript = root / 't.jsonl'
        transcript.write_text('\n'.join(rows) + '\n', encoding='utf-8')
        hook = json.dumps({'transcript_path': str(transcript), 'session_id': 'session_test'})
        calls, said = [], []

        def accept(url, headers, body):
            calls.append((url, headers, json.loads(body)))
            return 200, {'ok': True}

        env = {'TASTE_BACKSTOP_TOKEN': secret, 'CONTROL_CENTER_ORIGIN': 'https://cc.example/'}
        assert tb.main([], stdin=io.StringIO(hook), root=root, out=said.append, env=env, post=accept) == 0
        assert len(calls) == 1, calls
        url, headers, body = calls[0]
        assert url == 'https://cc.example/api/taste/backstop', url
        assert headers['authorization'] == 'Bearer ' + secret and headers['content-type'] == 'application/json'
        assert body['schema'] == 'growth-taste-backstop/1' and len(body['rows']) == 4, body
        assert {r['kind'] for r in body['rows']} <= {'correction', 'rejection'}, body
        assert all(r['repository'] == 'krishanraja/content-engine' and r['session'] == 'session_test'
                   and len(r['line_sha256']) == 64 for r in body['rows'])
        assert not (root / tb.OUTBOX).exists(), 'a posted line is not also kept locally'
        assert '4 sent' in said[0] and secret not in ''.join(said), said

        # A refused or unreachable post never blocks the session: the lines fall back to the file.
        def refuse(url, headers, body):
            raise OSError('unreachable')

        assert tb.main([], stdin=io.StringIO(hook), root=root, out=said.append, env=env, post=refuse) == 0
        kept_rows = [json.loads(x) for x in (root / tb.OUTBOX).read_text(encoding='utf-8').splitlines()]
        assert len(kept_rows) == 4 and all(r['posted'] is False for r in kept_rows), kept_rows
        assert secret not in (root / tb.OUTBOX).read_text(encoding='utf-8')

        def server_error(url, headers, body):
            return 500, None

        root2 = root / 'again'
        root2.mkdir()
        assert tb.main([], stdin=io.StringIO(hook), root=root2, out=said.append, env=env, post=server_error) == 0
        assert len((root2 / tb.OUTBOX).read_text(encoding='utf-8').splitlines()) == 4

    # A cloud session holds no key: the network proxy injects the backstop secret, so it posts with a placeholder.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        transcript = root / 't.jsonl'
        transcript.write_text('\n'.join(rows) + '\n', encoding='utf-8')
        hook = json.dumps({'transcript_path': str(transcript), 'session_id': 'session_cloud'})
        calls = []
        assert tb.main([], stdin=io.StringIO(hook), root=root, out=lambda _: None, env={'CLAUDE_CODE_REMOTE': 'true'},
                       post=lambda url, headers, body: (calls.append(headers), (200, {'ok': True}))[1]) == 0
        assert len(calls) == 1 and calls[0]['authorization'] == 'Bearer ' + tb.PROXY_PLACEHOLDER, calls
        assert not (root / tb.OUTBOX).exists()
        # Anywhere else with no key, nothing is sent.
        calls.clear()
        assert tb.main([], stdin=io.StringIO(hook), root=root, out=lambda _: None, env={},
                       post=lambda url, headers, body: (calls.append(headers), (200, {'ok': True}))[1]) == 0
        assert calls == [] and len((root / tb.OUTBOX).read_text(encoding='utf-8').splitlines()) == 4

    assert tb.kind_of('I hate that font') == 'rejection'
    assert tb.kind_of('That is wrong, use the other one instead') == 'correction'

    ignore = (Path(__file__).resolve().parents[1] / '.gitignore').read_text(encoding='utf-8')
    assert '.scratch/' in ignore.splitlines(), 'the backstop outbox must stay out of git'
    print('taste backstop: ok')


if __name__ == '__main__':
    main()
