"""The copy lint refuses what Krish named and lets his approved copy through.

Krish, 2026-10-28: "don't add stupid eyebrow text and asterisks and "generated
by AI" and "Krish's take" verbal diahorrea like you tend to. This needs to feel
like a world class media channel". And of the labels on screen: "It's just the
ones that say "Krish's read" or "illustrative" that are stupid because they add
no value to the content."

Run: python3 tests/copy_lint_test.py (tests/control-plane/copy-lint.test.ts runs it on every push).
"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import copy_lint  # noqa: E402

EXAMPLES = json.loads((ROOT / 'tests' / 'fixtures' / 'copy-lint-examples.json').read_text(encoding='utf-8'))['patterns']
CONFIG = json.loads((ROOT / 'config' / 'copy-lint.json').read_text(encoding='utf-8'))

# Monday 26 October (follow.the.money, Character.AI): the copy Krish picked and
# approved on 26 Oct ("All recommended") and the on-screen words he settled on
# 28 Oct ("Happy with the words on screen."), with Monday 19's published
# channel copy, the nearest approved captions and descriptions in the repository.
APPROVED = [
    'docs/plans/2026-10-26-monday/cards.json',
    'docs/plans/2026-10-26-monday/cover-facts.json',
    'docs/plans/2026-10-26-monday/cover-facts-wide.json',
    'docs/plans/2026-10-26-monday/creative-direction.json',
    'docs/plans/2026-10-26-monday/post.json',
    'docs/plans/2026-10-19-monday/release-materials.json',
]


def run(*args):
    return subprocess.run([sys.executable, str(ROOT / 'scripts' / 'post-pack' / 'copy_lint.py'), *args],
                          cwd=ROOT, capture_output=True, text=True, encoding='utf-8')


class ConfigShape(unittest.TestCase):
    def test_shape_is_the_shared_interface(self):
        self.assertEqual(set(CONFIG), {'version', 'ruling', 'patterns'})
        self.assertIn('verbal diahorrea', CONFIG['ruling'])
        ids = [p['id'] for p in CONFIG['patterns']]
        self.assertEqual(len(ids), len(set(ids)), 'pattern ids are unique')
        for p in CONFIG['patterns']:
            self.assertEqual(set(p), {'id', 'regex', 'flags', 'reason', 'applies_to'}, p['id'])
            self.assertTrue(p['applies_to'] and set(p['applies_to']) <= set(copy_lint.SURFACES), p['id'])
            self.assertTrue(set(p['flags']) <= {'i', 'm'}, p['id'])
            self.assertNotIn(chr(0x2014), p['reason'], p['id'])

    def test_every_pattern_has_a_must_hit_and_a_must_pass_example(self):
        self.assertEqual(set(EXAMPLES), {p['id'] for p in CONFIG['patterns']})
        for pid, ex in EXAMPLES.items():
            self.assertTrue(ex['hit'], f'{pid} has no must-hit example')
            self.assertTrue(ex['pass'], f'{pid} has no must-pass example')

    def test_every_surface_he_named_is_covered_by_the_eyebrow_asterisk_ai_and_take_rules(self):
        for pid in ('asterisk', 'eyebrow_label', 'ai_provenance_label', 'ai_illustration_note', 'take_label',
                    'illustration_label'):
            spec = next(p for p in CONFIG['patterns'] if p['id'] == pid)
            self.assertEqual(set(spec['applies_to']), set(copy_lint.SURFACES), pid)


class Examples(unittest.TestCase):
    def test_must_hit(self):
        for pid, ex in EXAMPLES.items():
            for case in ex['hit']:
                ids = [h['id'] for h in copy_lint.copy_lint(case['text'], case['applies_to'])]
                self.assertIn(pid, ids, f'{pid} let through {case["text"]!r} as {case["applies_to"]}')

    def test_must_pass_is_clean_copy(self):
        for pid, ex in EXAMPLES.items():
            for case in ex['pass']:
                hits = copy_lint.copy_lint(case['text'], case['applies_to'])
                self.assertEqual(hits, [], f'{pid} pass example {case["text"]!r} hit {hits}')

    def test_a_pattern_stays_off_the_surfaces_it_does_not_cover(self):
        # The capitals label line is a caption rule; the approved title card kicker is a carousel word.
        self.assertEqual(copy_lint.copy_lint('AI BUDGETS\nGoogle cut its prices.', 'carousel_text'), [])
        self.assertTrue(copy_lint.copy_lint('AI BUDGETS\nGoogle cut its prices.', 'channel_copy'))

    def test_an_unknown_surface_is_refused(self):
        with self.assertRaises(ValueError):
            copy_lint.copy_lint('Plain copy', 'article_body')

    def test_line_ends_read_the_same_either_way(self):
        a = copy_lint.copy_lint('FOLLOW THE MONEY\r\n\r\nGoogle paid first.', 'channel_copy')
        b = copy_lint.copy_lint('FOLLOW THE MONEY\n\nGoogle paid first.', 'channel_copy')
        self.assertEqual([(h['id'], h['index']) for h in a], [(h['id'], h['index']) for h in b])
        for end in ('\u2028', '\u2029', '\u0085'):
            c = copy_lint.copy_lint(f'FOLLOW THE MONEY{end}{end}Google paid first.', 'channel_copy')
            self.assertEqual([(h['id'], h['index']) for h in c], [(h['id'], h['index']) for h in b], repr(end))

    def test_no_reason_asks_for_a_mark_on_screen(self):
        # Krish, 28 Oct 2026: "I hate all these stupid little abbreviations and marks".
        for p in CONFIG['patterns']:
            self.assertNotRegex(p['reason'], r'labelled|"ILLUSTRATION" in the video', p['id'])


class ApprovedCopy(unittest.TestCase):
    def test_monday_26_and_monday_19_approved_copy_has_zero_hits(self):
        for rel in APPROVED:
            fields = copy_lint.fields(json.loads((ROOT / rel).read_text(encoding='utf-8')))
            self.assertTrue(fields, f'{rel} carries no public words the lint reads')
            self.assertEqual(copy_lint.lint_file(ROOT / rel), [], rel)

    def test_the_approved_copy_covers_every_surface(self):
        seen = set()
        for rel in APPROVED:
            seen |= {s for _, _, s in copy_lint.fields(json.loads((ROOT / rel).read_text(encoding='utf-8')))}
        self.assertEqual(seen, set(copy_lint.SURFACES))


class Cli(unittest.TestCase):
    def test_a_hit_exits_1_and_names_id_file_line_and_match(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / 'caption.txt'
            f.write_text('Google paid first.\nMade with AI\n', encoding='utf-8')
            r = run(str(f))
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            self.assertIn(f'ai_provenance_label  {f}:2  "Made with AI"', r.stdout)

    def test_applies_to_never_switches_a_json_fields_rules_off(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / 'materials.json'
            f.write_text(json.dumps({'sections': [{'id': 'substack', 'copy': [
                {'label': 'Caption', 'text': 'follow.the.money\n\nGoogle paid first.'}]}]}), encoding='utf-8')
            for args in ([], ['--applies-to', 'video_onscreen']):
                r = run('--json', *args, str(f))
                self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
                self.assertEqual([h['id'] for h in json.loads(r.stdout)['hits']], ['series_label'], args)
            self.assertIn('--applies-to does not apply', run('--applies-to', 'video_onscreen', str(f)).stderr)

    def test_a_json_file_it_cannot_read_is_never_clean(self):
        with tempfile.TemporaryDirectory() as tmp:
            titles = Path(tmp) / 'titles.json'
            titles.write_text(json.dumps({'long': "Krish's take on Disney"}), encoding='utf-8')
            r = run(str(titles))
            self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
            self.assertIn('not a shape the copy lint reads', r.stderr)
            broken = Path(tmp) / 'cards.json'
            broken.write_text('{"cards": [', encoding='utf-8')
            self.assertEqual(run(str(broken)).returncode, 2)
            quiet = Path(tmp) / 'creative-direction.json'
            quiet.write_text(json.dumps({'cuts': {'long': {'beats': [{'on_screen_text': ''}]}}}), encoding='utf-8')
            self.assertEqual(run(str(quiet)).returncode, 0, 'a known shape with no words yet is clean')

    def test_a_byte_order_mark_is_read_past(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / 'cards.json'
            f.write_text(json.dumps({'cards': [{'kicker': 'AI NEWS: OpenAI halved its price', 'lines': []}]}),
                         encoding='utf-8-sig')
            self.assertEqual([h['id'] for h in copy_lint.lint_file(f)], ['eyebrow_label'])

    def test_applies_to_changes_what_is_checked(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / 'kicker.txt'
            f.write_text('AI BUDGETS\nGoogle cut its prices.\n', encoding='utf-8')
            self.assertEqual(run(str(f)).returncode, 1)
            self.assertEqual(run('--applies-to', 'carousel_text', str(f)).returncode, 0)

    def test_json_fields_and_clean_exit(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / 'materials.json'
            f.write_text(json.dumps({'sections': [{'id': 'youtube', 'copy': [
                {'label': 'Video title', 'text': 'Why is Disney eating the scraps of bankrupt Character.AI?'},
                {'label': 'Description', 'text': "Krish's take on the deal.\n\nMore at makeyourmindup.ai"}]}]}, indent=1),
                encoding='utf-8')
            r = run('--json', str(f))
            self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
            hits = json.loads(r.stdout)['hits']
            self.assertEqual([(h['id'], h['where']) for h in hits], [('take_label', 'sections[0].copy[1] (Description)')])
            self.assertEqual(run(*[str(ROOT / p) for p in APPROVED]).returncode, 0)


if __name__ == '__main__':
    unittest.main()
