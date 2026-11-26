"""The judge wall for the story score (the story engine v5 plan, commit 5). Ruling (Krish, 2026-11-26): his taste is a
floor only. apps/control-plane/scripts/check-judges.ts section 4 guards the TypeScript judges; this guards the Python
scorer and the probe check, which that wall cannot see.

  - scripts/post-pack/story_score.py and scripts/whys-probe-check.ts never name his taste sources at all (why_here, his
    verdicts and words on formats, his likes sheet, the scorecard, the triage readback, cues);
  - the scorer never imports the floor, the proof harness, the rejection floor or the taste module;
  - no string, name or attribute in the scorer reads his answers, presses, picks or refusals;
  - blind_view never lets a planted taste or provenance key through, at any depth;
  - the floor's public output is pass or refused with reasons: never a number.

Every planted read below must fail the check, so the check is known to bite."""
import ast
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import story_floor as sf  # noqa: E402  the test may read the floor; the scorer may not
import story_score as ss  # noqa: E402

SCORER = ROOT / 'scripts' / 'post-pack' / 'story_score.py'
PROBE = ROOT / 'scripts' / 'whys-probe-check.ts'

# Named nowhere in the scorer or the probe check, not even in a comment.
NEVER_NAMED = ('why_here', 'krish_verdict', 'krish_said', 'what_i_like_sheet', 'scorecard', 'triage-readback', 'triage_readback',
               'story_floor', 'story_proof', 'feedback_cues', '_taste', 'approved_taste', 'taste_')
# Never imported by the scorer.
NEVER_IMPORTED = ('story_floor', 'story_proof', '_taste', 'feedback_cues', 'floor', 'ideas_scorecard', 'feedback', 'learning_loop')
# Never read by the scorer's code (strings, names and attributes; docstrings may explain the rule).
NEVER_READ = re.compile(r'\b(?:answers?|outcomes?|cues|picks?|presses|refusals?|verdicts?|liked|said|taste|reasons|his_words|his_ids|'
                        r'refusals_from|refused_findings|active_vetoes|presses_from|scorecard_from|his_taps|plans_reader|learned_from|'
                        r'read_back|from_press|from_inspiration|recommended_by)\b', re.I)
READ_OK = {'recommended'}  # order() sets the first option's recommended flag; it never reads it to score


def docstrings(tree):
    out = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
            body = getattr(node, 'body', [])
            if body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], 'value', None), ast.Constant) \
                    and isinstance(body[0].value.value, str):
                out.add(id(body[0].value))
    return out


def problems(source):
    """Why some scorer source breaks the wall, or []."""
    out = []
    low = source.lower()
    for word in NEVER_NAMED:
        if word in low:
            out.append(f'names {word}')
    tree = ast.parse(source)
    skip = docstrings(tree)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods = [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            mods = [node.module or '']
        else:
            mods = []
        for m in mods:
            if m.split('.')[0] in NEVER_IMPORTED:
                out.append(f'imports {m}')
        texts = []
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in skip:
            texts.append(node.value)
        elif isinstance(node, ast.Name):
            texts.append(node.id)
        elif isinstance(node, ast.Attribute):
            texts.append(node.attr)
        elif isinstance(node, ast.arg):
            texts.append(node.arg)
        for t in texts:
            m = NEVER_READ.search(t)
            if m and m.group(0).lower() not in READ_OK:
                out.append(f'reads {m.group(0)} ({t[:60]!r})')
    return out


class Wall(unittest.TestCase):
    def test_the_scorer_keeps_the_wall(self):
        self.assertEqual(problems(SCORER.read_text(encoding='utf-8')), [])

    def test_the_probe_check_names_no_taste_source(self):
        low = PROBE.read_text(encoding='utf-8').lower()
        self.assertEqual([w for w in NEVER_NAMED if w in low], [])

    def test_planted_reads_fail(self):
        base = SCORER.read_text(encoding='utf-8')
        planted = [
            "\n\ndef leak(o):\n    return o.get('why_here')\n",
            "\n\ndef leak(o):\n    return o['krish_verdict']\n",
            "\nimport story_floor\n",
            "\nfrom story_proof import reveal\n",
            "\nimport floor\n",
            "\n\ndef leak(s):\n    return ic.refusals_from(s)\n",
            "\n\ndef leak(s):\n    return s.get('answers')\n",
            "\n\ndef leak(s):\n    return s['cues']\n",
            "\n\ndef leak(w):\n    return open('docs/plans/' + w + '/scorecard.json').read()\n",
            "\n\ndef leak(w):\n    return open('triage-readback.md').read()\n",
            "\n\ndef leak(styles):\n    return [b.get('what_i_like_sheet') for b in styles]\n",
            "\n\ndef leak(o):\n    return o.get('learned_from')\n",
            "\n\ndef leak(doc):\n    return [r['reasons'] for r in doc]\n",
        ]
        for plant in planted:
            with self.subTest(plant=plant.strip()[:50]):
                self.assertTrue(problems(base + plant), plant)

    def test_a_docstring_may_explain_the_rule(self):
        self.assertEqual(problems('def f():\n    """Never reads his picks or his answers."""\n    return 1\n'), [])


class BlindView(unittest.TestCase):
    def test_no_planted_key_gets_through_at_any_depth(self):
        drop = ss.RUBRIC['blind_view']['drop_nested']
        plant = {k: 'planted' for k in drop}
        o = {'id': 'x', 'hook': 'A hook', 'pitch': {'hook': 'h', **plant}, 'stories': [{'what': 'w', **plant}],
             'source': {'url': 'https://example.com/a', **plant}, 'from': 'his words', 'why_here': 'close to his taste',
             'krish_verdict': 'not for us', 'learned_from': ['his words'], 'read_back': {'says': []}, **plant}
        view = ss.blind_view(o)
        seen = set()

        def walk(n):
            if isinstance(n, dict):
                for k, v in n.items():
                    seen.add(k)
                    walk(v)
            elif isinstance(n, list):
                for v in n:
                    walk(v)
        walk(view)
        self.assertFalse(seen & set(drop), seen & set(drop))
        self.assertFalse(seen & {'why_here', 'krish_verdict', 'learned_from', 'read_back', 'from'})
        self.assertEqual(view['hook'], 'A hook')
        self.assertNotIn('planted', json.dumps(view))
        self.assertIn('why_here', o, 'the option itself is untouched')

    def test_the_scorer_reads_one_bit_of_the_floor(self):
        ideas = {'days': {'mon': [{'id': 'aa'}, {'id': 'bb'}], 'wed': [], 'fri': []}, 'offdays': {}}
        doc = {'candidates': [{'ref': 'mon-1', 'floored': True, 'reasons': ['he said it was boring']},
                              {'ref': 'mon-2', 'floored': False, 'reasons': []}], 'unread': []}
        self.assertEqual(ss.floored_keys(doc, ideas), {'mon/aa'})


class FloorOutput(unittest.TestCase):
    def test_the_floor_answers_pass_or_refused_never_a_number(self):
        ideas = {'week_start': '2026-11-23', 'days': {'mon': [{'id': '11111111-2222-4333-8444-555555555555', 'so_what': 'A label pays its '
                 'songwriters for AI training', 'pitch': {'question': 'Who gets paid?'}}], 'wed': [], 'fri': []}, 'offdays': {}}
        src = {'week_start': '2026-11-23', 'outcomes': {'filed': [], 'rejected': [], 'trend': [], 'improved': []}, 'asks': [],
               'cues': {}, 'must_cover': [], 'unvetoed': [], 'recent_posts': [], 'earlier_options': []}
        result = sf.floor(sf.board_candidates(ideas), src, week='2026-11-23', kill=lambda _t: [], repeat_guard=False)
        for row in result['candidates']:
            self.assertEqual(set(row), {'ref', 'floored', 'reasons'})
            self.assertIsInstance(row['floored'], bool)
            self.assertTrue(all(isinstance(r, str) for r in row['reasons']))
        nums = []

        def walk(n):
            if isinstance(n, bool):
                return
            if isinstance(n, (int, float)):
                nums.append(n)
            elif isinstance(n, dict):
                [walk(v) for v in n.values()]
            elif isinstance(n, list):
                [walk(v) for v in n]
        walk(result['candidates'])
        self.assertEqual(nums, [])


if __name__ == '__main__':
    unittest.main()
