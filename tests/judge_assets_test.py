"""scripts/post-pack/judge_assets.py: the make flow asks the 10/10 judges itself (op judge), Growth keeps bind and live
(Ruling, Krish, 2026-11-26). A fake transport only: nothing is paid."""
import base64
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import judge_assets as ja  # noqa: E402


class Transport:
    def __init__(self, answer=None, error=None):
        self.answer, self.error, self.calls = answer, error, []

    def __call__(self, method, path, body=None, base=None):
        self.calls.append((method, path, body))
        if self.error:
            raise self.error
        return self.answer


class JudgeAssetsTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        for n in (1, 2):
            (self.dir / f'slide-0{n}.png').write_bytes(b'\x89PNG card ' + bytes([n]))
        (self.dir / 'layout.json').write_text(json.dumps({'check': 'carousel_check --cards', 'passed': True, 'assets': []}))
        self.request = {'item': 'off-tue-labels', 'format': 'carousel', 'channel': 'instagram', 'words': 'The words.\nSubscribe: link in bio.',
                        'assets': [{'name': f'carousel_slide_{n}', 'file': f'slide-0{n}.png'} for n in (1, 2)], 'layout': 'layout.json'}
        (self.dir / 'request.json').write_text(json.dumps(self.request))

    def test_the_body_is_op_judge_with_each_cards_bytes_and_sha256(self):
        body = ja.body_of(self.request, self.dir)
        self.assertEqual(body['op'], 'judge')
        data = (self.dir / 'slide-01.png').read_bytes()
        self.assertEqual(body['assets'][0], {'name': 'carousel_slide_1', 'sha256': hashlib.sha256(data).hexdigest()})
        self.assertEqual(base64.b64decode(body['images'][0]['data']), data)
        self.assertEqual(body['layout']['check'], 'carousel_check --cards')
        self.assertNotIn('bind', json.dumps(body))

    def test_a_pass_a_fail_and_a_hold(self):
        t = Transport({'ok': True, 'verdict': 'pass', 'score': 9, 'artifact_sha256': 'a' * 64})
        lines = []
        self.assertEqual(ja.main(['ask', str(self.dir / 'request.json'), '--week', '2026-11-30'], t, lines.append), 0)
        self.assertEqual(t.calls[0][:2], ('POST', '/api/board/2026-11-30/judge'))
        self.assertTrue(lines[0].startswith('PASS'))
        t = Transport({'ok': True, 'verdict': 'fail', 'score': 6, 'band': 'weak', 'reasons': [{'judge': 'reader', 'fix': 'Lead on the deal.'}]})
        lines = []
        self.assertEqual(ja.main(['ask', str(self.dir / 'request.json'), '--week', '2026-11-30'], t, lines.append), 1)
        self.assertIn('  reader: Lead on the deal.', lines)
        for t in (Transport(error=urllib.error.URLError('down')), Transport({'ok': False, 'error': 'judge_cap_reached'}),
                  Transport(error=ValueError('Engine operator credential unavailable'))):
            lines = []
            self.assertEqual(ja.main(['ask', str(self.dir / 'request.json'), '--week', '2026-11-30'], t, lines.append), 2)
            self.assertTrue(lines[0].startswith('NOT ASKED'))

    def test_a_carousel_without_its_layout_receipt_is_not_sent(self):
        t = Transport({'ok': True, 'verdict': 'pass'})
        req = dict(self.request)
        del req['layout']
        (self.dir / 'r2.json').write_text(json.dumps(req))
        self.assertEqual(ja.main(['ask', str(self.dir / 'r2.json'), '--week', '2026-11-30'], t, lambda _: None), 2)
        self.assertEqual(t.calls, [])

    def test_the_route_records_content_engine_as_the_writer_and_growth_keeps_bind_and_live(self):
        handler = (ROOT / 'apps' / 'control-plane' / 'api' / 'board' / '_handler.ts').read_text(encoding='utf-8')
        self.assertIn("actor(req, true) === 'engine_operator' ? 'content-engine' : 'growth'", handler)
        self.assertIn('Growth keeps bind and live', handler)


if __name__ == '__main__':
    unittest.main()
