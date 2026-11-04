"""ve said (Krish, 4 Nov 2026: "listen to what I actually said on the script, as opposed to reading the teleprompter
folders"): what he said against the script, the words the cut should carry, and his pace. No model, no network."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import said  # noqa: E402

THURSDAY = ROOT / 'docs' / 'plans' / '2026-11-05-thursday-no-spending' / 've'


def record(words, take='take-1'):
    return {'take': take, 'media': {'sha256': '0' * 64},
            'aligners': {'a': {'name': 'torchaudio:mms-fa', 'words': [
                {'i': i, 'text': text, 'onset_s': round(start, 3), 'end_s': round(start + 0.25, 3)}
                for i, (text, start) in enumerate(words)]}}}


def timed(text, start=0.5, step=0.3, pause_after=None):
    out, t = [], start
    for i, word in enumerate(text.split()):
        out.append((word, t))
        t += step + (pause_after or {}).get(i, 0)
    return out


class SaidTest(unittest.TestCase):
    def test_thursdays_take_gives_the_words_he_signed_with_the_hand_fixes_made_by_itself(self):
        """Thursday's script.words.json was his heard words with "muse" and "Prompts" fixed by hand."""
        take = json.loads((THURSDAY / 'takes' / 'thursday-take-1.json').read_text())
        signed = json.loads((THURSDAY / 'script.words.json').read_text())
        heard = [w['text'] for w in take['aligners']['a']['words']]
        self.assertIn('muse', heard)
        self.assertIn('Prompts', heard)
        words = said.proposed_words(signed['text'], take)
        self.assertEqual([w['word'] for w in words], [w['word'] for w in signed['words']])
        self.assertEqual([w['w'] for w in words], list(range(len(words))))
        self.assertFalse(any(w.get('heard_only') for w in words))

    def test_his_own_words_are_kept_as_heard_and_marked_and_skipped_script_words_are_not_shown(self):
        script = 'We tested three models today. The answer surprised us.'
        heard = record(timed('so we tested like three models the answer really surprised us'))
        words = said.proposed_words(script, heard)
        text = [w['word'] for w in words]
        self.assertEqual(text[:3], ['so', 'We', 'tested'])
        self.assertIn('like', text)
        self.assertNotIn('today.', text)
        self.assertTrue(next(w for w in words if w['word'] == 'like')['heard_only'])
        self.assertTrue(next(w for w in words if w['word'] == 'really')['heard_only'])
        self.assertEqual(text[-1], 'us.')
        self.assertTrue(any(w['word'].endswith('.') and w['word'] != 'us.' for w in words),
                        'the sentence the script ends inside his own words still ends')

    def test_a_number_said_as_words_shows_as_the_script_writes_it(self):
        script = 'It cost $40 and ran 206 times.'
        heard = record(timed('it cost forty dollars and ran two hundred and six times'))
        words = said.proposed_words(script, heard)
        self.assertEqual([w['word'] for w in words], ['It', 'cost', '$40', 'and', 'ran', '206', 'times.'])
        forty = next(w for w in words if w['word'] == '$40')
        self.assertAlmostEqual(forty['end_s'] - forty['onset_s'], 0.3 + 0.25, places=3)

    def test_pace_flags_a_rushed_line_and_a_long_pause(self):
        quick = [{'word': w, 'onset_s': i * 0.2, 'end_s': i * 0.2 + 0.18} for i, w in enumerate('one two three four five six.'.split())]
        slow = [{'word': 'Then', 'onset_s': 3.0, 'end_s': 3.3}, {'word': 'nothing.', 'onset_s': 4.4, 'end_s': 4.8}]
        rows = said.pace(quick + slow)
        self.assertTrue(rows[0]['rushed'])
        self.assertFalse(rows[1]['rushed'])
        self.assertEqual(rows[1]['pauses'][0]['after'], 'Then')
        self.assertAlmostEqual(rows[1]['pauses'][0]['pause_s'], 1.1, places=2)

    def test_make_writes_the_report_and_the_proposal_never_the_scripts_words(self):
        with tempfile.TemporaryDirectory() as temp:
            ve = Path(temp)
            script = ve / 'teleprompter.txt'
            script.write_text('We tested three models today. The answer surprised us.', encoding='utf-8')
            report = said.make(script, record(timed('so we tested three models the answer surprised us')), ve)
            self.assertTrue((ve / 'said.take-1.md').is_file())
            self.assertIn('Pace, line by line', (ve / 'said.take-1.md').read_text())
            proposal = json.loads((ve / 'script.words.proposed.json').read_text())
            self.assertEqual(proposal['source']['take'], 'take-1')
            self.assertFalse((ve / 'script.words.json').exists())
            self.assertGreaterEqual(report['rates']['differences'], 1)


if __name__ == '__main__':
    unittest.main(verbosity=1)
