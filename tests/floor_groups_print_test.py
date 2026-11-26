"""The words Krish decided for a floor group reach the maker (Ruling, Krish, 2026-11-15).

The Rejections engine (krishanraja/inspirationhouse) writes a top-level `groups` array into config/rejection-floor.json:
each group's key, title, standing, decided statement (his amendment, else his correction, else the group's words),
decided_on and members. floor.py --format prints every group touching that maker's standards, its words above its
members, and an older file without the field prints as before."""
import contextlib
import copy
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import floor  # noqa: E402

DOC = {
    'version': 'abc123def4567890', 'as_of': '2026-11-15', 'counts': {},
    'formats': {
        'carousel': {'maker': 'A carousel', 'approved': ['s1'], 'draft': ['s2'], 'rejected': []},
        'short_video': {'maker': 'A short cut', 'approved': ['s3'], 'draft': [], 'rejected': []},
    },
    'standards': {
        's1': {'standing': 'approved', 'never_beneath': 'Never a bland card.', 'weight': 'pattern', 'check_before_delivery': 'Look.'},
        's2': {'standing': 'draft', 'never_beneath': 'Never an off-centre card.', 'weight': 'one', 'check_before_delivery': 'Look.'},
        's3': {'standing': 'approved', 'never_beneath': 'Never captions over the title line.', 'weight': 'one', 'check_before_delivery': 'Look.'},
    },
    'records': {},
}
GROUPS = [
    {'key': 'corner_mark', 'title': 'The corner mark', 'standing': 'reworded',
     'statement': 'On a carousel the wordmark sits small in the bottom-right corner.', 'decided_on': '2026-11-15',
     'members': ['s1', 's2']},
    {'key': 'words_add', 'title': 'Words add', 'standing': 'approved',
     'statement': 'The captions step aside for the title line.', 'decided_on': '2026-11-04', 'members': ['s3']},
]


def run(doc, *args):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'floor.json'
        path.write_text(json.dumps(doc), encoding='utf-8')
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = floor.main(['--file', str(path), '--bar-file', str(Path(tmp) / 'none.json'), *args])
        return code, out.getvalue()


class GroupWords(unittest.TestCase):
    def test_a_makers_floor_prints_its_groups_words_above_their_members(self):
        doc = dict(DOC, groups=GROUPS)
        code, out = run(doc, '--format', 'carousel')
        self.assertEqual(code, 0)
        self.assertIn('The corner mark [corner_mark; reworded by him, 2026-11-15]', out)
        self.assertIn('bottom-right corner', out)
        self.assertIn('Members here: s1, s2', out)
        self.assertNotIn('Words add', out)  # touches no carousel standard
        self.assertLess(out.index('bottom-right corner'), out.index('Approved standards'))

    def test_an_older_file_without_groups_prints_as_before(self):
        code, out = run(copy.deepcopy(DOC), '--format', 'carousel')
        self.assertEqual(code, 0)
        self.assertNotIn('decided groups', out)
        self.assertIn('Approved standards (1)', out)

    def test_check_refuses_a_group_with_an_unknown_member_or_no_words(self):
        bad = dict(DOC, groups=[dict(GROUPS[0], members=['s9']), {'key': 'x', 'standing': 'approved'}])
        problems = floor.check(bad)
        self.assertIn('group corner_mark: member s9 is not in standards', problems)
        self.assertTrue(any("group 'x' needs a key" in p for p in problems))
        self.assertEqual(floor.check(dict(DOC, groups=GROUPS)), [])


if __name__ == '__main__':
    unittest.main()
