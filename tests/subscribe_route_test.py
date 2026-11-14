"""Growth's subscribe route, vendored byte for byte (audit 2026-11-14, I-09).

vendor/makeyourmindup/subscribe-route.json is growth-makeyourmindup specs/subscribe-route.json. Every subscribe link
content-engine writes is built from it (scripts/post-pack/publish_kit.py); a change starts in Growth's file, and this
copy follows with its new hash in the same pull request as the code.
"""
import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'vendor' / 'makeyourmindup' / 'subscribe-route.json'
SHA256 = '9927b32dbae962a97a3dc8223b08105833197a1e6e5d2ee1a3f2fb3519a5c639'
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import publish_kit  # noqa: E402


class SubscribeRouteTest(unittest.TestCase):
    def test_the_vendored_bytes_are_growths(self):
        self.assertEqual(hashlib.sha256(SPEC.read_bytes()).hexdigest(), SHA256)
        self.assertEqual(publish_kit.SUBSCRIBE_SPEC_SHA256, SHA256)
        self.assertEqual(json.loads(SPEC.read_bytes())['schema'], 'mymu-subscribe-route/1')

    def test_git_never_converts_its_line_endings(self):
        # The hash is of the exact bytes, so a Windows checkout must not turn LF into CRLF (full verify red on
        # windows-latest, 14 Nov 2026): .gitattributes marks the file -text, as it does the vendored kill list.
        import subprocess
        out = subprocess.run(['git', 'check-attr', 'text', '--', 'vendor/makeyourmindup/subscribe-route.json'],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout
        self.assertTrue(out.strip().endswith(': text: unset'), out)

    def test_every_link_the_kit_writes_matches_the_route(self):
        p = {'piece_id': '8287846b-1111-4111-8111-111111111111', 'youtube_description': 'D', 'linkedin_post': 'L', 'comment_question': 'Q?'}
        route = publish_kit.ROUTE
        seen = 0
        for step in publish_kit.steps(p):
            for _, words in step.get('copy') or []:
                for part in str(words or '').split():
                    if part.startswith(route['page'] + '?'):
                        seen += 1
                        tags = dict(kv.split('=', 1) for kv in part.split('?', 1)[1].split('&'))
                        self.assertRegex(tags['utm_content'], route['utm_content_pattern'])
                        self.assertEqual(list(tags), route['post_tags'])
                        self.assertTrue(tags['utm_content'].startswith('8287846b-1111-4111-8111-111111111111-'))
        self.assertGreaterEqual(seen, 3)


if __name__ == '__main__':
    unittest.main()
