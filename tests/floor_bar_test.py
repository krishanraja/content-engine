"""The bar on the real files: config/reference-cuts.json and docs/production/THE_BAR.md agree, and scripts/floor.py
prints the bar whole before the rejection standards for the two video cut makers, a one-line pointer for the other
video makers, and nothing for any other maker.

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
# The three files the study hashed on 28 October 2026, and whether each is established as the latest cut he meant.
# Only Monday's wide cut matches a recorded master (docs/plans/2026-10-26-monday/video/REVIEW.md).
STUDIED = {
    'fri23-tall': ('voiceover', 'e0298c2f91e6a322e00d42d52da5c19fc5dade29cfce33c45a432d110bc6456e', 'unconfirmed'),
    'mon26-wide': ('split_screen', '14ccfef0f31e42814db4b4743d35cd75d047d95e0520171f755b9cd31b1a3294', 'confirmed'),
    'mon26-tall': ('split_screen', '39f1039c810681d1a6776b5a0c9f5f32696931cc47ea21ea4ec3f19b90888ecd', 'unconfirmed'),
}
FULL = ('short_video', 'long_video')
POINTER = ('motion', 'captions', 'card', 'intro_outro', 'audio')
DRAFT_LINE = ("The qualities below are the engine's reading of the cuts he named; he has not approved their wording. "
              'Follow them; only he approves them.')


def run(*args):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = floor.main(list(args))
    return code, out.getvalue()


def floor_only(maker):
    expected = io.StringIO()
    with contextlib.redirect_stdout(expected):
        floor.show_format(floor.load(), maker, False, 40)
    return expected.getvalue()


class TheBar(unittest.TestCase):
    def test_the_references_and_their_page_are_whole_and_agree(self):
        self.assertEqual(floor.bar_problems(BAR, PAGE), [])
        self.assertEqual(floor.bar_check(BAR), [])
        self.assertEqual([q['name'] for q in BAR['qualities']], floor.bar_headings(PAGE))
        self.assertEqual(len(BAR['qualities']), 15)
        labels = {r['label']: r['id'] for r in BAR['references']}
        moments, unread = floor.page_moments(PAGE, labels)
        self.assertEqual(unread, [])
        self.assertEqual(len(moments), len(BAR['reference_moments']))
        points, unread = floor.page_points(PAGE, labels)
        self.assertEqual(unread, [])
        self.assertEqual(set(points), {q['name'] for q in BAR['qualities']})

    def test_the_reference_files_are_the_ones_the_study_hashed_and_say_whether_they_are_the_latest(self):
        got = {r['id']: (r['format_family'], r['sha256'], r['identity']) for r in BAR['references']}
        self.assertEqual(got, STUDIED)
        for r in BAR['references']:
            self.assertTrue(r['identity_evidence'], r['id'])
        self.assertIn('14ccfef0f31e42814db4b4743d35cd75d047d95e0520171f755b9cd31b1a3294',
                      (ROOT / 'docs/plans/2026-10-26-monday/video/REVIEW.md').read_text(encoding='utf-8'))
        self.assertFalse(BAR['production_input'])
        for label in ('**Friday tall: unconfirmed.**', '**Monday tall: unconfirmed.**', '**Monday wide: confirmed.**'):
            self.assertIn(label, PAGE)

    def test_the_bar_is_a_draft_reading_until_he_approves_it(self):
        self.assertEqual(BAR['standing'], 'draft')
        self.assertEqual(BAR['standing_note'], DRAFT_LINE)
        self.assertLess(PAGE.index(BAR['ruling']['correction']), PAGE.index(DRAFT_LINE))
        self.assertLess(PAGE.index(DRAFT_LINE), PAGE.index('## The principle'))
        self.assertIn('## Open questions for Krish', PAGE)
        for reading in ('one visual idea per piece', 'one big impact', 'at most one loud transition',
                        'a sting opens every piece'):
            self.assertIn(reading, PAGE.split('## Open questions for Krish')[1])

    def test_outside_logos_stay_the_official_marks(self):
        self.assertNotIn('house look', PAGE)
        self.assertNotIn('monochrome', PAGE)
        self.assertNotIn('Google left in full colour', PAGE)
        branding = PAGE.split('### 6. Branding as a system')[1].split('### 7.')[0]
        self.assertIn('official marks, unaltered', branding)
        self.assertIn('Krish\'s decision on rights', branding)

    def test_the_gate_is_his_exact_file_approval(self):
        self.assertNotIn('Monday review', PAGE)
        self.assertEqual(PAGE.count("Krish's exact-file approval (`docs/ve/ENGINE.md`, S7 Gate 3)"), 16)

    def test_sound_is_marked_measured_until_someone_hears_it(self):
        sound = PAGE.split('### 14. Sound finish')[1].split('### 15.')[0]
        refs = sound.split('**In the references.**')[1]
        self.assertTrue(refs.strip().startswith('Measured, not yet heard'))
        self.assertIs([q for q in BAR['qualities'] if q['id'] == 'sound'][0]['heard'], False)
        for m in BAR['reference_moments']:
            if 'sound' in m['shows']:
                self.assertIs(m['heard'], False)
                self.assertIn('not yet heard', m['what'])

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
        # The page names none of the figures measured from the references, so none can be read as a target.
        for figure in ('px', 'BPM', 'kHz', 'y=1000', 'frame snaps', '0.4 s', '2.7 s', '0.3 s', 'half-second'):
            self.assertNotIn(figure, PAGE)

    def test_the_page_keeps_the_house_voice(self):
        self.assertNotIn('—', PAGE, 'no em dashes')
        self.assertNotIn('–', PAGE, 'no en dashes')
        for spelling in ('color ', 'gray ', 'center '):
            self.assertNotIn(spelling, PAGE.lower())
        sections = ('## The principle', '## The qualities', '## What is not the bar', '## Reference moments',
                    '## Open questions for Krish')
        order = [PAGE.index(s) for s in sections]
        self.assertEqual(order, sorted(order))
        for part in ('**The bar.**', '**In the references.**', '**Below the bar.**', '**Compare beside.**',
                     '**How it is checked.**'):
            self.assertEqual(PAGE.count(part), len(BAR['qualities']), part)

    def test_the_two_cut_makers_read_the_bar_whole_first(self):
        self.assertEqual(set(BAR['applies_to_makers']), set(FULL) | set(POINTER))
        self.assertEqual(tuple(BAR['full_bar_for_makers']), FULL)
        for maker in FULL:
            code, text = run('--format', maker)
            self.assertEqual(code, 0, maker)
            self.assertTrue(text.startswith('The bar: the production quality floor for every video'), maker)
            self.assertLess(text.index('In his words:'), text.index('Standing: draft.'))
            self.assertLess(text.index('Standing: draft.'), text.index("The engine's reading of those cuts, a draft:"))
            self.assertLess(text.index('The bar: '), text.index('The rejection floor for'))
            self.assertLess(text.index('The rejection floor for'), text.index('Approved standards'))
            for q in BAR['qualities']:
                self.assertIn(q['name'], text)
            self.assertEqual(text.count('Identity unconfirmed'), 2)
            self.assertIn('never targets', text)
            self.assertIn('Not a reference yet: the long cut (voiceover)', text)
            self.assertTrue(text.endswith(floor_only(maker)), 'the floor after the bar is unchanged')

    def test_the_other_video_makers_get_one_line_pointing_at_it(self):
        for maker in POINTER:
            code, text = run('--format', maker)
            self.assertEqual(code, 0, maker)
            head = ' '.join(text[: text.index('The rejection floor for')].split())
            self.assertTrue(head.startswith(f'The bar: {BAR["doc"]} is the production quality floor for this maker'))
            self.assertIn('--format short_video or --format long_video', head)
            self.assertNotIn(BAR['qualities'][0]['name'], head)
            self.assertLess(len(head), 400, maker)
            self.assertTrue(text.endswith(floor_only(maker)), maker)

    def test_the_printed_bar_carries_no_hashes_file_ids_or_numbers_to_hit(self):
        _, text = run('--format', 'short_video')
        section = text[: text.index('The rejection floor for')]
        self.assertIsNone(re.search(r'\b[0-9a-f]{64}\b', section))
        for ref in BAR['references']:
            self.assertNotIn(ref['drive_file_id'], section)
            self.assertNotIn(ref['piece_id'], section)
        self.assertIsNone(re.search(r'\b\d+(\.\d+)?\s?(s|seconds|BPM|LUFS|fps|px)\b', section))

    def test_other_makers_see_the_floor_unchanged(self):
        doc = floor.load()
        for maker in ('cover', 'thumbnail', 'carousel', 'article', 'script'):
            if maker not in doc['formats']:
                continue
            _, text = run('--format', maker)
            self.assertNotIn('The bar', text, maker)
            self.assertEqual(text, floor_only(maker), maker)
        _, text = run('--format', 'all')
        self.assertTrue(text.startswith(f'The bar: {BAR["doc"]} is the production quality floor for every video maker'))
        self.assertTrue(text.endswith(floor_only('all')))
        _, summary = run()
        self.assertIn(floor.BAR_HINT, summary)
        self.assertNotIn('The bar:', summary)

    def test_a_broken_bar_never_stops_another_makers_floor(self):
        with tempfile.TemporaryDirectory() as tmp:
            broken = Path(tmp) / 'reference-cuts.json'
            broken.write_text('{"not": json', encoding='utf-8')
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                code, text = run('--bar-file', str(broken), '--format', 'cover')
            self.assertEqual(code, 0)
            self.assertEqual(text, floor_only('cover'))
            code, text = run('--bar-file', str(broken))
            self.assertEqual(code, 0)
            self.assertTrue(text.startswith('The rejection floor, version'), 'the summary never reads the bar')
            with contextlib.redirect_stderr(io.StringIO()):
                code, text = run('--bar-file', str(broken), '--format', 'short_video')
            self.assertEqual(code, 0)
            self.assertEqual(text, floor_only('short_video'))
            code, text = run('--check', '--bar-file', str(broken))
            self.assertEqual(code, 1)
            self.assertIn('the bar: reference-cuts.json cannot be read', text)

    def test_with_no_rejection_floor_the_bar_still_prints(self):
        missing = Path(tempfile.gettempdir()) / 'no-such-rejection-floor.json'
        code, text = run('--file', str(missing), '--format', 'long_video')
        self.assertEqual(code, 0)
        self.assertTrue(text.startswith('The bar: '))
        self.assertIn('No rejection floor yet', text)
        code, text = run('--file', str(missing), '--format', 'cover')
        self.assertNotIn('The bar', text)

    def test_check_fails_when_the_page_and_the_references_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            drifted = json.loads(json.dumps(BAR))
            drifted['qualities'][0]['name'] = 'Premium finish'
            drifted['reference_moments'][0]['at'] = '0:2'
            drifted['reference_moments'][1]['what'] = drifted['reference_moments'][1]['what'] + ' Changed.'
            drifted['qualities'][1]['compare_beside'][0]['to'] = '00:37'
            path = Path(tmp) / 'reference-cuts.json'
            path.write_text(json.dumps(drifted), encoding='utf-8')
            code, text = run('--check', '--bar-file', str(path))
            self.assertEqual(code, 1)
            self.assertIn('the bar: the quality names and the headings', text)
            self.assertIn("'0:2' is not a MM:SS(.f) timestamp", text)
            self.assertIn('reference moment fri23-tall 00:08 to 00:16 is in the references only, or its words differ',
                          text)
            self.assertIn('quality motion_explains: the Compare beside points on the page and in the references '
                          'disagree', text)

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
