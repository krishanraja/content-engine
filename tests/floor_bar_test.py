"""The bar on the real files: config/reference-cuts.json and docs/production/THE_BAR.md agree, and scripts/floor.py
prints the bar before the rejection standards for every video maker and for no other.

Krish, 2026-10-28: "the video production quality standards for the latest Friday (AI Passports) and Monday
(character.ai) pieces are the floor for what I expect", and "the long voiceover video is still being post produced so
dont just assume that the voiceover format only has a 90sec version, you are only to look for production quality
standards". Run by tests/engine-gates.test.ts.
"""
import contextlib
import io
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import floor  # noqa: E402

BAR = json.loads((ROOT / 'config' / 'reference-cuts.json').read_text(encoding='utf-8'))
PAGE = (ROOT / BAR['doc']).read_text(encoding='utf-8')
# The three files Krish named, as the study hashed them on 28 October 2026.
NAMED = {
    'fri23-tall': ('voiceover', '2026-10-19', 'fri-short-video',
                   'e0298c2f91e6a322e00d42d52da5c19fc5dade29cfce33c45a432d110bc6456e'),
    'mon26-wide': ('split_screen', '2026-10-26', 'mon-video-long',
                   '14ccfef0f31e42814db4b4743d35cd75d047d95e0520171f755b9cd31b1a3294'),
    'mon26-tall': ('split_screen', '2026-10-26', 'mon-video-short',
                   '39f1039c810681d1a6776b5a0c9f5f32696931cc47ea21ea4ec3f19b90888ecd'),
}


def run(*args):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = floor.main(list(args))
    return code, out.getvalue()


def bar_section(text):
    return text[: text.index('The rejection floor for')]


class TheBar(unittest.TestCase):
    def test_the_references_and_their_page_are_whole_and_agree(self):
        self.assertEqual(floor.bar_problems(BAR, PAGE), [])
        self.assertEqual(floor.bar_check(BAR), [])
        self.assertEqual([q['name'] for q in BAR['qualities']], floor.bar_headings(PAGE))
        self.assertEqual(len(BAR['qualities']), 15)

    def test_the_named_cuts_are_exactly_the_ones_krish_named(self):
        got = {r['id']: (r['format_family'], r['served_from']['board_week'], r['served_from']['asset'], r['sha256'])
               for r in BAR['references']}
        self.assertEqual(got, NAMED)
        self.assertFalse(BAR['production_input'])

    def test_the_long_voiceover_cut_is_not_a_reference_yet(self):
        later = BAR['not_yet_references']
        self.assertEqual([(n['format_family'], n['which_file']) for n in later], [('voiceover', 'the long cut')])
        self.assertIn('post-production', later[0]['status'])
        self.assertIn('still in post-production', PAGE.lower())
        self.assertIn(BAR['ruling']['correction'], PAGE)

    def test_his_words_open_the_page_exactly(self):
        self.assertTrue(PAGE.startswith('# The bar'))
        first = PAGE.index('> "')
        self.assertLess(first, PAGE.index('## The principle'))
        self.assertIn(f'> "{BAR["ruling"]["words"]}"', PAGE)
        self.assertIn(f'> "{BAR["ruling"]["correction"]}"', PAGE)

    def test_no_measured_value_is_a_target(self):
        self.assertEqual(floor.measured_keys(BAR), [])
        made_up = json.loads(json.dumps(BAR))
        made_up['references'][0]['length_s'] = 78.6
        made_up['qualities'][0]['bpm'] = 105
        self.assertEqual(len([p for p in floor.bar_problems(made_up, PAGE) if 'never a target' in p]), 2)
        self.assertIn('## What is not the bar', PAGE)
        self.assertIn('Nothing here says a voiceover piece is 90 seconds or any other length.', PAGE)

    def test_the_page_keeps_the_house_voice(self):
        self.assertNotIn('—', PAGE, 'no em dashes')
        self.assertNotIn('–', PAGE, 'no en dashes')
        for spelling in ('color ', 'gray ', 'center '):
            self.assertNotIn(spelling, PAGE.lower())
        for section in ('## The principle', '## The qualities', '## What is not the bar', '## Reference moments'):
            self.assertIn(section, PAGE)
        order = [PAGE.index(s) for s in ('## The principle', '## The qualities', '## What is not the bar',
                                          '## Reference moments')]
        self.assertEqual(order, sorted(order))
        for part in ('**The bar.**', '**In the references.**', '**Below the bar.**', '**How it is checked.**'):
            self.assertEqual(PAGE.count(part), len(BAR['qualities']), part)

    def test_every_video_maker_reads_the_bar_first(self):
        self.assertEqual(set(BAR['applies_to_makers']),
                         {'short_video', 'long_video', 'motion', 'captions', 'card', 'intro_outro', 'audio'})
        for maker in BAR['applies_to_makers']:
            code, text = run('--format', maker)
            self.assertEqual(code, 0, maker)
            self.assertTrue(text.startswith('The bar (Krish, 2026-10-28)'), maker)
            self.assertLess(text.index('The bar ('), text.index('The rejection floor for'))
            self.assertLess(text.index('The rejection floor for'), text.index('Approved standards'))
            for q in BAR['qualities']:
                self.assertIn(q['name'], text)
            self.assertIn('never targets', text)
            self.assertIn('Not a reference yet: the long cut (voiceover)', text)

    def test_the_printed_bar_carries_no_hashes_file_ids_or_numbers_to_hit(self):
        _, text = run('--format', 'short_video')
        section = bar_section(text)
        self.assertIsNone(re.search(r'\b[0-9a-f]{64}\b', section))
        for ref in BAR['references']:
            self.assertNotIn(ref['drive_file_id'], section)
            self.assertNotIn(ref['piece_id'], section)
        self.assertIsNone(re.search(r'\b\d+(\.\d+)?\s?(s|seconds|BPM|LUFS|fps|px)\b', section))

    def test_other_makers_see_the_floor_unchanged(self):
        doc = floor.load()
        for maker in ('cover', 'thumbnail', 'carousel', 'article', 'script', 'all'):
            if maker not in doc['formats']:
                continue
            _, text = run('--format', maker)
            self.assertNotIn('The bar (', text, maker)
            expected = io.StringIO()
            with contextlib.redirect_stdout(expected):
                floor.show_format(doc, maker, False, 40)
            self.assertEqual(text, expected.getvalue(), maker)
        _, summary = run()
        self.assertNotIn('The bar (', summary)

    def test_with_no_rejection_floor_the_bar_still_prints(self):
        missing = Path(tempfile.gettempdir()) / 'no-such-rejection-floor.json'
        code, text = run('--file', str(missing), '--format', 'long_video')
        self.assertEqual(code, 0)
        self.assertTrue(text.startswith('The bar ('))
        self.assertIn('No rejection floor yet', text)
        code, text = run('--file', str(missing), '--format', 'cover')
        self.assertNotIn('The bar (', text)

    def test_check_fails_when_the_page_and_the_references_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            drifted = json.loads(json.dumps(BAR))
            drifted['qualities'][0]['name'] = 'Premium finish'
            drifted['reference_moments'][0]['at'] = '0:2'
            path = Path(tmp) / 'reference-cuts.json'
            path.write_text(json.dumps(drifted), encoding='utf-8')
            code, text = run('--check', '--bar-file', str(path))
            self.assertEqual(code, 1)
            self.assertIn('the bar: the quality names and the headings', text)
            self.assertIn("'0:2' is not a MM:SS(.f) timestamp", text)

    def test_every_moment_and_comparison_points_inside_a_named_cut(self):
        refs = {r['id'] for r in BAR['references']}
        ids = {q['id'] for q in BAR['qualities']}
        shown = set()
        for m in BAR['reference_moments']:
            self.assertIn(m['ref'], refs)
            shown.update(m['shows'])
        for q in BAR['qualities']:
            self.assertTrue(q['compare_beside'], q['id'])
            for c in q['compare_beside']:
                self.assertIn(c['ref'], refs)
        self.assertLessEqual(shown, ids)
        slips = [m for m in BAR['reference_moments'] if m.get('slip')]
        self.assertTrue(slips and all(m['what'].startswith('SLIP, below the bar, do not copy') for m in slips))


if __name__ == '__main__':
    unittest.main()
