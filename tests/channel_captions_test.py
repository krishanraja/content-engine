"""The captions step (scripts/post-pack/channel_captions.py): per-channel words and titles written at make time into
the manifest SPEC, voice-checked, copy-linted and read blind (Ruling, Krish, 2026-11-26). Fake transports only."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from urllib.parse import parse_qsl, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import channel_captions as cc  # noqa: E402
import piece_manifest  # noqa: E402
import voice_profile  # noqa: E402

PIECE = '11111111-2222-4333-8444-555555555555'
CLAIM = 'Labels now pay for the training data they used to give away.'
FACTS = {'piece_id': PIECE, 'item': 'engine:2026-11-30:labels', 'idea': 'Record labels started charging AI firms for catalogue access.',
         'claim': CLAIM, 'note': {'direction': 'keep it dry', 'on_media': ['Who gets paid']},
         'channels': {'x': {'format': 'text', 'assets': []},
                      'instagram': {'format': 'carousel', 'assets': ['carousel_slide_1', 'carousel_slide_2']},
                      'youtube': {'format': 'short-video', 'assets': ['short_video']}}}
GOOD = {'x': {'words': CLAIM + ' The catalogue is the product now.', 'title': ''},
        'instagram': {'words': CLAIM + ' Swipe through who signed and what it is worth.', 'title': ''},
        'youtube': {'words': CLAIM + ' Here is the money trail.', 'title': 'Why labels now charge AI firms for their catalogues'}}
REVIEW = {ch: {'would_send': True, 'receiver': 'a label head of business affairs', 'why': 'It names the deal she is negotiating.'} for ch in GOOD}


def voice(hard=()):
    """A fake Control Center voice route: every text passes, or fails with `hard`."""
    calls = []

    def call(method, path, body, token, timeout=30):
        calls.append((method, path, body['channel']))
        return 200, json.dumps({'ok': True, 'checked': True, 'hard': [{'rule': h, 'message': h} for h in hard]})
    call.calls = calls
    return call


def down(method, path, body, token, timeout=30):
    return 503, '{}'


class BriefTest(unittest.TestCase):
    def test_the_writer_brief_carries_the_reader_the_rules_and_every_channel(self):
        b = cc.brief(FACTS, {'personal': 'P-STYLE', 'publication': 'PUB-STYLE'})
        self.assertIn('creative, arts, music, entertainment, media and sports', b)
        self.assertIn('Claim: ' + CLAIM, b)
        self.assertIn('never quote it): keep it dry', b)
        self.assertIn('- x: X, his own account', b)
        self.assertIn('P-STYLE', b)
        self.assertIn('- youtube: YouTube Shorts', b)
        self.assertIn('A title of at most 90 characters', b)
        self.assertIn('No prediction, odds or dated call', b)
        self.assertNotIn('Krish', b)
        self.assertIn('(The voice profile could not be read', cc.brief(FACTS, None))

    def test_the_blind_review_brief_shows_only_channel_format_files_and_words(self):
        r = cc.review_brief(FACTS, GOOD)
        self.assertIn('"files": ["file 1", "file 2"]', r)
        for hidden in ('keep it dry', 'Who gets paid', 'carousel_slide_1', FACTS['idea'], 'engine:2026'):
            self.assertNotIn(hidden, r)
        self.assertIn(GOOD['youtube']['title'], r)

    def test_the_voice_profile_parses_and_never_loosens_the_rules(self):
        md = '## Core\n1. **Short sentences** x\n## Channels\n| Channel | base | change |\n|---|---|---|\n| LinkedIn | a | warm |\n| Make Your Mind Up articles | b | we |\n'
        lines = voice_profile.lines(md)
        self.assertIn('warm', lines['personal'])
        self.assertIn('Short sentences', lines['personal'])
        self.assertNotIn('Short sentences', lines['publication'])
        self.assertTrue(lines['publication'].endswith(voice_profile.PRECEDENCE))
        self.assertIsNone(voice_profile.read(lambda url: (_ for _ in ()).throw(OSError('offline'))))


class CheckTest(unittest.TestCase):
    def test_good_words_pass_every_check(self):
        call = voice()
        self.assertEqual(cc.check(FACTS, GOOD, call, 'k'), [])
        self.assertEqual({c[2] for c in call.calls}, {'x', 'caption'})

    def test_each_rule_refuses(self):
        cases = {
            'the claim is not in the words': {'x': {'words': 'Labels now pay for training data.', 'title': ''}},
            'longer than 270': {'x': {'words': CLAIM + ' ' + 'a' * 300, 'title': ''}},
            'no hashtags': {'x': {'words': CLAIM + ' #AI', 'title': ''}},
            'no links': {'x': {'words': CLAIM + ' https://example.com', 'title': ''}},
            'no em dashes': {'x': {'words': CLAIM + ' — really.', 'title': ''}},
            'no exclamation marks': {'x': {'words': CLAIM + ' Wow!', 'title': ''}},
            'never names mind/make': {'x': {'words': CLAIM + ' From mind/make.', 'title': ''}},
            'no prediction, odds or dated call': {'x': {'words': CLAIM + ' Expect it everywhere by 2027.', 'title': ''}},
            'never ask the reader': {'x': {'words': CLAIM + ' Share this with your team.', 'title': ''}},
            'copy lint no_name': {'x': {'words': CLAIM + ' Krish tested it.', 'title': ''}},
            'only YouTube carries a title': {'x': {'words': CLAIM, 'title': 'A title'}},
            'a plain title': {'youtube': {'words': CLAIM, 'title': ''}},
        }
        for why, change in cases.items():
            with self.assertRaises(cc.Refused, msg=why) as r:
                cc.check(FACTS, {**GOOD, **change}, voice(), 'k')
            self.assertTrue(any(why in reason for reason in r.exception.reasons), (why, r.exception.reasons))
            self.assertEqual(r.exception.code, 1)

    def test_a_voice_fail_refuses_and_an_unasked_voice_check_holds(self):
        with self.assertRaises(cc.Refused) as r:
            cc.check(FACTS, GOOD, voice(['US spelling: color']), 'k')
        self.assertEqual(r.exception.code, 1)
        self.assertIn('x: voice US spelling: color', r.exception.reasons)
        with self.assertRaises(cc.Refused) as r:
            cc.check(FACTS, GOOD, down, 'k')
        self.assertEqual(r.exception.code, 2)

    def test_missing_and_extra_channels_are_refused(self):
        with self.assertRaises(cc.Refused) as r:
            cc.check(FACTS, {'x': GOOD['x'], 'tiktok': GOOD['x']}, voice(), 'k')
        self.assertIn('instagram: no words for it', r.exception.reasons)
        self.assertIn('tiktok: not a channel of this piece', r.exception.reasons)


class RecordTest(unittest.TestCase):
    def spec(self):
        return {'piece_id': PIECE, 'qa': {'state': 'passed', 'checked_at': '2026-11-30T07:00:00Z'},
                'assets': [{'name': n, 'drive_id': c * 25, 'sha256': d * 64} for n, c, d in
                           (('carousel_slide_1', 'a', '1'), ('carousel_slide_2', 'b', '2'), ('carousel_slide_3', 'e', '5'),
                            ('carousel_slide_4', 'f', '6'), ('short_video', 'c', '3'), ('vertical_cover', 'd', '4'))],
                # A carousel is approvable only with its passing receipt (Krish, 2026-11-26: enforce the carousel format).
                'carousel_receipt': {'schema': 'carousel-receipt/1', 'passed': True,
                                     'slides': [{'sha256': d * 64} for d in '1256']},
                'channels': {'youtube': {'words': 'placeholder', 'alt_text': None, 'assets': ['short_video'],
                                         'cover': {'asset': 'vertical_cover', 'sha256': '4' * 64, 'cover_offset_ms': 41000}}}}

    def test_record_writes_words_route_lines_and_title_into_the_spec(self):
        spec, receipt = cc.record(FACTS, GOOD, REVIEW, self.spec(), voice(), 'k')
        ch = spec['channels']
        self.assertTrue(ch['x']['words'].startswith(GOOD['x']['words'] + '\nSubscribe: https://home.makeyourmindup.ai/subscribe?'))
        tags = dict(parse_qsl(urlsplit(ch['x']['words'].rsplit(' ', 1)[1]).query))
        self.assertEqual(tags, {'utm_source': 'x', 'utm_medium': 'social', 'utm_campaign': 'growth', 'utm_content': 'engine-2026-11-30-labels-x'})
        self.assertTrue(ch['instagram']['words'].endswith('\nSubscribe: link in bio.'))
        self.assertEqual(ch['youtube']['title'], GOOD['youtube']['title'])
        self.assertEqual(ch['youtube']['cover']['cover_offset_ms'], 41000)
        self.assertNotIn('title', ch['x'])
        self.assertEqual(receipt['made_by'], 'content-engine')
        self.assertIn('blind_review', receipt['checks'])
        # The draft the board binds is minor version 1.1, because a channel carries a title.
        d = piece_manifest.draft(spec)
        self.assertEqual(d['schema'], piece_manifest.SCHEMA_TITLED)
        self.assertEqual(piece_manifest.problems(d, draft=True), [])

    def test_a_blind_no_refuses_and_nothing_is_written(self):
        review = dict(REVIEW, x={'would_send': False, 'receiver': None, 'why': 'It reads as an advert.'})
        with self.assertRaises(cc.Refused) as r:
            cc.record(FACTS, GOOD, review, self.spec(), voice(), 'k')
        self.assertIn('x: the blind reader would not send it (It reads as an advert.)', r.exception.reasons)

    def test_a_spec_for_another_piece_is_refused(self):
        with self.assertRaises(cc.Refused):
            cc.record(FACTS, GOOD, REVIEW, dict(self.spec(), piece_id='other'), voice(), 'k')

    def test_the_cli_writes_both_briefs_offline(self):
        read, cc.voice_profile.read = cc.voice_profile.read, lambda fetch_text=None: None
        self.addCleanup(setattr, cc.voice_profile, 'read', read)
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            for name, value in (('facts.json', FACTS), ('answer.json', GOOD)):
                (d / name).write_text(json.dumps(value), encoding='utf-8')
            self.assertEqual(cc.main(['brief', str(d / 'facts.json'), '--out', str(d)]), 0)
            self.assertTrue((d / 'writer-brief.md').is_file())
            self.assertEqual(cc.main(['review-brief', str(d / 'facts.json'), str(d / 'answer.json'), '--out', str(d)]), 0)


if __name__ == '__main__':
    unittest.main()
