"""The Saturday Note (scripts/post-pack/saturday_note.py): one Note each Saturday pointing at the weekly edition,
made by content-engine, with the edition link at place note and the channel's own subscribe link (Ruling, Krish,
2026-11-26; the edition contract; growth 144 test_an_edition_link_never_stands_in_for_a_channels_own_link)."""
import datetime as dt
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from urllib.parse import parse_qsl, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import saturday_note as sn  # noqa: E402

SAT = dt.date(2026, 11, 28)
WORDS = ('This week the labels stopped giving their catalogues away. The deals are small, the terms are not, and they '
         'decide who gets paid when a model learns from a song. I went through what was signed and what it is worth.')
EDITION = {'schema': 'content-engine-edition/1', 'edition_date': '2026-11-28', 'subject': 'The labels start charging',
           'sections': [{'kind': 'opener', 'text': 'A week of catalogue deals.'},
                        {'kind': 'piece', 'day': 'mon', 'label': 'Monday: who gets paid', 'title': 'The catalogue is the product'}]}


def voice(hard=()):
    def call(method, path, body, token, timeout=30):
        return 200, json.dumps({'ok': True, 'checked': True, 'hard': [{'message': h} for h in hard]})
    return call


def tags(url):
    return dict(parse_qsl(urlsplit(url).query))


class SaturdayNoteTest(unittest.TestCase):
    def test_the_note_carries_both_links_built_to_the_contract(self):
        r = sn.make(SAT, WORDS, EDITION, voice_call=voice(), voice_key='k')
        urls = re.findall(r'https://\S+', r['text'])
        self.assertEqual(len(urls), 2)
        self.assertIn('\n\nRead the week: ' + r['links']['read_the_week'] + '\nSubscribe: ' + r['links']['subscribe'], r['text'])
        self.assertEqual(tags(r['links']['read_the_week']), {'utm_source': 'newsletter', 'utm_medium': 'email', 'utm_campaign': 'weekly',
                                                             'utm_content': 'edition-2026-11-28-note'})
        self.assertEqual(tags(r['links']['subscribe']), {'utm_source': 'substack-notes', 'utm_medium': 'social', 'utm_campaign': 'growth',
                                                         'utm_content': 'saturday-note-2026-11-28'})
        self.assertEqual((r['channel'], r['place'], r['account'], r['made_by']), ('substack-notes', 'note', 'personal', 'content-engine'))
        self.assertEqual(r['week_of'], '2026-11-23')
        self.assertIn('schedules it in Buffer', r['posted_by'])
        self.assertEqual(r['manifest_channel']['substack-notes']['words'], r['text'])
        self.assertIsNone(r['image'])
        self.assertNotIn('Krish', r['text'])

    def test_the_edition_link_can_go_to_the_editions_own_post(self):
        r = sn.make(SAT, WORDS, EDITION, 'https://home.makeyourmindup.ai/p/the-labels-start-charging', voice_call=voice(), voice_key='k')
        self.assertTrue(r['links']['read_the_week'].startswith('https://home.makeyourmindup.ai/p/the-labels-start-charging?utm_source=newsletter'))
        with self.assertRaises(ValueError):
            sn.make(SAT, WORDS, EDITION, 'https://example.com/p/x', voice_call=voice(), voice_key='k')

    def test_refusals(self):
        for words, why in ((WORDS + ' Read it here: https://x.com', 'no links'), (WORDS.replace('.', '!', 1), 'no exclamation marks'),
                           ('Too short.', 'the Note is 2 words'), (WORDS + ' Krish wrote it.', 'copy lint no_name')):
            with self.assertRaises(sn.Refused) as r:
                sn.make(SAT, words, EDITION, voice_call=voice(), voice_key='k')
            self.assertTrue(any(why in x for x in r.exception.reasons), (why, r.exception.reasons))
        with self.assertRaises(sn.Refused) as r:
            sn.make(SAT, WORDS, EDITION, voice_call=voice(['banned word: delve']), voice_key='k')
        self.assertEqual(r.exception.reasons, ['voice banned word: delve'])
        with self.assertRaises(sn.Refused) as r:
            sn.make(SAT, WORDS, EDITION, voice_call=lambda *a, **k: (503, '{}'), voice_key='k')
        self.assertEqual(r.exception.code, 2)
        with self.assertRaises(sn.Refused):
            sn.saturday_of('2026-11-27')

    def test_an_image_comes_only_from_the_library_and_is_refused_while_it_is_a_gap(self):
        with tempfile.TemporaryDirectory() as d:
            img = Path(d) / 'note.png'
            img.write_bytes(b'\x89PNG')
            with self.assertRaises(sn.Refused) as r:
                sn.make(SAT, WORDS, EDITION, image=img, voice_call=voice(), voice_key='k')
        self.assertTrue(any('social-note-image' in x for x in r.exception.reasons), r.exception.reasons)

    def test_the_brief_shows_the_edition_and_the_rules(self):
        b = sn.brief(SAT, EDITION)
        for words in ('The labels start charging', 'Monday: who gets paid: The catalogue is the product', 'Between 30 and 140 words',
                      'No prediction, odds or dated call', 'creative, arts, music'):
            self.assertIn(words, b)

    def test_the_cli_writes_the_note(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / 'words.txt').write_text(WORDS, encoding='utf-8')
            (d / 'edition.json').write_text(json.dumps(EDITION), encoding='utf-8')
            code = sn.main(['make', '--saturday', '2026-11-28', '--words', str(d / 'words.txt'), '--edition', str(d / 'edition.json'),
                            '--out', str(d)], voice_call=voice(), voice_key='k')
            self.assertEqual(code, 0)
            note = json.loads((d / 'saturday-note.json').read_text(encoding='utf-8'))
            self.assertEqual(note['schema'], 'content-engine-saturday-note/1')


if __name__ == '__main__':
    unittest.main()
