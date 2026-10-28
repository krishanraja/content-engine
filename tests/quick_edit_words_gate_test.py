"""The words gate (scripts/quick-edit/words_gate.py) on synthetic word lists.

Krish, 24 Oct: "random small cuts and chopped words" in the published
Wednesday long video (config/failures.json, chopped-words-published). These
tests need no model: every final is a words json. The Monday 26 fixtures are
his real takes and scripts (tests/fixtures/words-gate, copied from
docs/plans/2026-10-26-monday/takes and the two scripts its post.json names),
with a final built from the take the way the transcriber writes a finished
cut. They prove the gate's logic, not its calibration on real finished files,
which stays open (chopped-words-published).
"""
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
import quality  # noqa: E402
import words_gate as wg  # noqa: E402
import advisory_qc  # noqa: E402

FIXTURES = ROOT / 'tests/fixtures/words-gate'
SCRIPT = 'So Disney is building its own team, hiring sixty-six staff on sixty million dollars a year. It will not keep the lawsuits.'


def timed(text, start=0.0, step=0.3):
    return [{'w': ' ' + w, 's': round(start + k * step, 3), 'e': round(start + k * step + 0.25, 3)} for k, w in enumerate(text.split())]


def shifted(words, by):
    return [dict(w, s=round(w['s'] + by, 3), e=round(w['e'] + by, 3)) for w in words]


def without(words, *drop):
    """The words with the ones at these take indexes gone, as a cut that lost them would be heard."""
    return [w for k, w in enumerate(words) if k not in drop]


TAKE = timed('So Disney is building its own team, hiring 66 staff on $60 million a year. It will not keep the lawsuits.')


class WordsGateTests(unittest.TestCase):
    def test_a_clean_cut_passes(self):
        r = wg.check(SCRIPT, TAKE, shifted(TAKE, 3.2))
        self.assertEqual(r['status'], 'pass', wg.summary(r))
        self.assertEqual(r['lost'], [])
        self.assertEqual(r['calibration']['status'], 'uncalibrated')

    def test_a_deleted_content_word_fails_naming_it_and_where(self):
        r = wg.check(SCRIPT, TAKE, shifted(without(TAKE, 1), 3.2))  # "Disney"
        self.assertEqual(r['status'], 'fail')
        self.assertEqual([x['word'] for x in r['lost']], ['Disney'])
        lost = r['lost'][0]
        self.assertEqual(lost['take_index'], 1)
        self.assertEqual(lost['take_s'], 0.3)
        self.assertIn('[Disney]', lost['context'])
        self.assertIn('"Disney" is lost: said at 0:00.30 in the take', lost['message'])
        self.assertIn('Disney', wg.summary(r))

    def test_a_lost_number_and_a_lost_negative_fail(self):
        r = wg.check(SCRIPT, TAKE, without(TAKE, 8, 17))  # "66" and "not"
        self.assertEqual(r['status'], 'fail')
        self.assertEqual(sorted(x['token'] for x in r['lost']), ['66', 'not'])

    def test_an_edl_approved_removal_passes_and_is_listed(self):
        take = timed('So Disney is buil- so Disney is building its own team.')
        final = shifted(without(take, 0, 1, 2, 3), 3.0)
        script = 'So Disney is building its own team.'
        self.assertEqual(wg.check(script, take, final)['status'], 'fail', 'without the EDL the false start is a lost word')
        for edl in ({'removals': [[0, 3]]}, {'removals': [{'take_index': [0, 3], 'krish': 'Krish, 2026-10-26: cut the false start'}]},
                    [{'from_s': 0.0, 'to_s': 1.1}]):
            r = wg.check(script, take, final, edl)
            self.assertEqual(r['status'], 'pass', (edl, wg.summary(r)))
            self.assertEqual(r['approved_removals'][0]['take_index'], [0, 3])
            self.assertIn('disney', r['approved_removals'][0]['script_content_words'])
        self.assertEqual(wg.check(script, take, final, {'removals': [{'take_index': [0, 3], 'krish': 'Krish: yes'}]})
                         ['approved_removals'][0]['krish'], 'Krish: yes')

    def test_a_function_word_miss_is_listed_not_failed(self):
        r = wg.check(SCRIPT, TAKE, without(TAKE, 4))  # "its"
        self.assertEqual(r['status'], 'pass', wg.summary(r))
        self.assertEqual([x['word'] for x in r['function_word_differences']], ['its'])

    def test_a_lost_adlib_is_listed_not_failed(self):
        take = timed('So Disney is building its own team, hiring 66 staff on $60 million a year in total salary.')
        r = wg.check(SCRIPT, take, without(take, 17))  # "salary.", a word he added
        self.assertEqual(r['status'], 'pass', wg.summary(r))
        self.assertEqual([x['word'] for x in r['adlib_losses']], ['salary.'])

    def test_the_transcriber_writing_the_same_words_differently_is_not_a_loss(self):
        script = 'Character.AI paid two point seven billion dollars to Higgsfield for colour, and sixty million dollars.'
        take = timed('Character.AI paid $2.7 billion to Higgsfield for colour, and sixty million dollars.')
        final = timed('Character .ai paid two point seven billion dollars to Higgs field for color, and $60 million.', 4.0)
        r = wg.check(script, take, final)
        self.assertEqual(r['status'], 'pass', wg.summary(r))
        self.assertTrue(any(x['word'] == 'Higgsfield' for x in r['heard_differently']))

    def test_a_word_heard_shorter_is_never_excused(self):
        take = timed('It will not keep the lawsuits.')
        r = wg.check(SCRIPT, take, timed('It will not keep the lawsuit.'))
        self.assertEqual(r['status'], 'fail')
        self.assertEqual(r['lost'][0]['word'], 'lawsuits.')

    def test_it_fails_closed_without_a_script_or_heard_words(self):
        self.assertIn('no signed script', wg.check('', TAKE, TAKE)['reason'])
        self.assertIn('no words', wg.check(SCRIPT, TAKE, [])['reason'])
        self.assertEqual(wg.check(SCRIPT, TAKE, [])['status'], 'fail')
        with self.assertRaises(wg.WordsGateError):
            wg.check(SCRIPT, TAKE, TAKE, {'removals': [{'say': 'um'}]})

    def test_monday_26_style_clean_data_passes_and_a_deleted_word_fails(self):
        for cut in ('short', 'long'):
            take = json.loads((FIXTURES / f'monday-26-{cut}.take.words.json').read_text(encoding='utf-8'))['words']
            script = (FIXTURES / f'monday-26-{cut}.script.txt').read_text(encoding='utf-8')
            # A sentence he added, cut on purpose and listed in the EDL, as a session would.
            aside = next(k for k in range(len(take)) if take[k]['w'].strip() == 'These' and take[k + 1]['w'].strip() == 'are') \
                if cut == 'short' else None
            gone = set(range(aside, aside + 7)) if aside is not None else set()
            edl = {'removals': [[aside, aside + 6]]} if gone else None
            final = []
            for k, w in enumerate(take):
                if k in gone:
                    continue
                # The transcriber writes a finished cut a little differently: "Character .ai" whole, "2 .7" as "2.7".
                if w['w'].strip().startswith('.') and final and final[-1]['w'].strip()[-1:].isalnum():
                    final[-1] = dict(final[-1], w=final[-1]['w'] + w['w'].strip(), e=w['e'])
                    continue
                final.append(dict(w))
            final = shifted(final, 3.2)
            r = wg.check(script, take, final, edl)
            self.assertEqual(r['status'], 'pass', f'{cut}: {wg.summary(r)}')
            self.assertGreater(r['counts']['compared'], 200)
            k = next(k for k, w in enumerate(take) if w['w'].strip().lower().startswith('bankruptcy'))
            mutated = [w for w in final if not w['w'].strip().lower().startswith('bankruptcy')]
            self.assertEqual(len(mutated), len(final) - sum(1 for w in final if w['w'].strip().lower().startswith('bankruptcy')))
            r = wg.check(script, take, mutated, edl)
            self.assertEqual(r['status'], 'fail', cut)
            self.assertIn('bankruptcy', [x['token'] for x in r['lost']])
            self.assertIn(k, [x['take_index'] for x in r['lost']])


class ReceiptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.video = self.dir / 'cut.mp4'
        self.video.write_bytes(b'finished cut bytes')
        self.receipt = self.dir / 'cut.mp4.validation.json'
        self.sha = quality.digest(self.video)

    def passing_receipt(self):
        return {'video_sha256': self.sha, 'checks': {k: {'status': 'pass'} for k in ('heard', 'sync', 'loudness', 'visuals', 'full_review')}}

    def test_the_words_check_blocks_delivery_where_it_travels_and_advisory_rows_never_do(self):
        report = self.passing_receipt()
        report['advisory'] = {'rows': {'brand': {'advisory': True, 'blocking': False, 'status': 'measured', 'pass': False}}}
        self.receipt.write_text(json.dumps(report))
        with patch('visual_clarity.delivery_problems', return_value=[]), patch('media_standard.enforced', return_value=False):
            before = quality.delivery_problems(self.video, self.receipt)
            self.assertFalse(any('words' in p or 'brand' in p for p in before), before)
            failed = wg.bind(wg.check(SCRIPT, TAKE, without(TAKE, 1)), video=self.video)
            wg.record(self.receipt, failed)
            problems = quality.delivery_problems(self.video, self.receipt)
            self.assertTrue(any(p.startswith('words gate is not passed') and 'Disney' in p for p in problems), problems)
            passed = wg.bind(wg.check(SCRIPT, TAKE, TAKE), video=self.video)
            wg.record(self.receipt, passed)
            self.assertEqual(quality.delivery_problems(self.video, self.receipt), before)
            stale = json.loads(self.receipt.read_text())
            stale['checks']['words']['video_sha256'] = 'e' * 64
            self.receipt.write_text(json.dumps(stale))
            self.assertIn('words gate result belongs to different video bytes or was not machine written',
                          quality.delivery_problems(self.video, self.receipt))

    def test_a_receipt_for_other_bytes_is_never_written(self):
        self.receipt.write_text(json.dumps({'video_sha256': 'f' * 64, 'checks': {}}))
        with self.assertRaises(wg.WordsGateError):
            wg.record(self.receipt, wg.bind(wg.check(SCRIPT, TAKE, TAKE), video=self.video))
        self.assertNotIn('words', json.loads(self.receipt.read_text())['checks'])

    def cli(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = wg.main([str(a) for a in args])
        return code, json.loads(out.getvalue()), err.getvalue()

    def test_the_command_line(self):
        script, take, final, edl = (self.dir / n for n in ('script.txt', 'take.json', 'final.json', 'edl.json'))
        script.write_text(SCRIPT)
        take.write_text(json.dumps({'words': TAKE}))
        edl.write_text(json.dumps({'removals': []}))
        final.write_text(json.dumps({'words': without(TAKE, 1), 'provenance': {'source_sha256': self.sha}}))
        self.receipt.write_text(json.dumps(self.passing_receipt()))
        code, report, err = self.cli('--script', script, '--take-words', take, '--final', final, '--edl', edl, '--receipt', self.receipt)
        self.assertEqual(code, 1)
        self.assertEqual(report['lost'][0]['word'], 'Disney')
        self.assertIn('words gate: FAIL', err)
        self.assertEqual(json.loads(self.receipt.read_text())['checks']['words']['status'], 'fail')
        self.assertEqual(set(report['inputs']), {'script', 'take_words', 'final_words', 'edl'})
        final.write_text(json.dumps({'words': TAKE, 'provenance': {'source_sha256': self.sha}}))
        code, report, _ = self.cli('--script', script, '--take-words', take, '--final', final, '--receipt', self.receipt)
        self.assertEqual((code, report['status']), (0, 'pass'))
        self.assertEqual(json.loads(self.receipt.read_text())['checks']['words']['video_sha256'], self.sha)
        # A words json heard from other bytes never goes into this receipt.
        final.write_text(json.dumps({'words': TAKE, 'provenance': {'source_sha256': 'a' * 64}}))
        code, report, _ = self.cli('--script', script, '--take-words', take, '--final', final, '--receipt', self.receipt)
        self.assertEqual(code, 1)
        self.assertIn('could not be made', report['reason'])
        self.assertEqual(json.loads(self.receipt.read_text())['checks']['words']['status'], 'pass')
        code, report, _ = self.cli('--script', self.dir / 'missing.txt', '--take-words', take, '--final', final)
        self.assertEqual(code, 1)


class AdvisoryTests(unittest.TestCase):
    def test_rows_are_advisory_and_say_why_they_did_not_run(self):
        groups = [[{'w': 'So', 's': 0.0, 'e': 0.3}, {'w': 'Disney', 's': 0.3, 'e': 0.6}]]
        pages = advisory_qc.caption_pages(groups, [{'s': 0.0, 'e': 1.0}], '9x16', 3.0, 24)
        self.assertEqual(pages[0]['fromFrame'], 72)
        self.assertEqual(pages[0]['band'], 'over_graphic')
        beats = advisory_qc.beats_of([], 10.0, 3.0, 24)
        self.assertEqual(beats, [{'id': 'main', 'fromFrame': 72, 'toFrame': 312}])
        with patch('shutil.which', return_value=None):
            out = advisory_qc.rows(ROOT / 'missing.mp4', shape='16x9', joins=None, pages=pages, beats=beats, mark=None)
        rows = out['rows']
        self.assertEqual(set(rows), {'joins', 'captions', 'brand', 'composition'})
        self.assertTrue(all(r['advisory'] is True and r['blocking'] is False for r in rows.values()))
        self.assertEqual(rows['composition']['status'], 'not_applicable')
        self.assertIn('tesseract', rows['captions']['reason'])
        self.assertEqual(rows['joins']['status'], 'not_run')
        # A measure that errors is a row that says so, never an exception out of the cut.
        broken = advisory_qc.rows(ROOT / 'missing.mp4', shape='9x16', joins=[1.0], pages=None, beats=beats, mark=ROOT / 'missing.png')
        self.assertEqual(broken['rows']['joins']['status'], 'error')
        self.assertEqual(broken['rows']['brand']['status'], 'error')


if __name__ == '__main__':
    unittest.main()
