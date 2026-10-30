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

    def test_a_word_heard_clipped_is_never_excused(self):
        take = timed('It will not keep the lawsuits.')
        r = wg.check(SCRIPT, take, timed('It will not keep the law.'))
        self.assertEqual(r['status'], 'fail')
        self.assertEqual(r['lost'][0]['word'], 'lawsuits.')

    def test_a_near_homophone_in_the_same_place_is_listed_not_lost(self):
        # Ruling (Krish, 2026-10-30): "yes allow near homophones", on Monday 26's accepted cuts.
        script = 'The star of the show owns the stack and lives at makeyourmindup.ai today.'
        take = timed(script)
        final = timed('The start of the show own the stack and lives at makeyourmindup.io today.', 2.0)
        r = wg.check(script, take, final)
        self.assertEqual(r['status'], 'pass', wg.summary(r))
        near = {x['word'].strip('.'): x['heard'] for x in r['heard_differently'] if x.get('near_homophone')}
        self.assertEqual(near, {'star': 'start', 'owns': 'own', 'makeyourmindup.ai': 'makeyourmindup.io'})
        self.assertEqual(r['counts']['near_homophones'], 3)

    def test_a_word_with_no_room_in_the_final_is_unmeasured_not_lost(self):
        # Ruling (Krish, 2026-10-30): "app is there", Monday 26's short, "app" lost between 0:07.10 and 0:07.10.
        script = 'Character.AI, which is a chat app with millions of users.'
        take = timed(script, 2.0)
        final = [{'w': w, 's': s, 'e': e} for w, s, e in (
            ('Character.AI,', 5.9, 6.4), ('which', 6.45, 6.6), ('is', 6.6, 6.7), ('a', 6.7, 6.75), ('chat', 6.75, 7.10),
            ('with', 7.10, 7.3), ('millions', 7.3, 7.7), ('of', 7.7, 7.8), ('users.', 7.8, 8.2))]
        r = wg.check(script, take, final)
        self.assertEqual(r['status'], 'pass', wg.summary(r))
        self.assertEqual([x['word'] for x in r['unmeasured']], ['app'])
        self.assertEqual(r['unmeasured'][0]['final_between_s'], [7.10, 7.10])
        self.assertEqual(r['counts']['unmeasured'], 1)
        self.assertIn('1 unmeasured: app', wg.summary(r))

    def test_a_word_missing_where_the_final_leaves_room_is_still_lost(self):
        script = 'Character.AI, which is a chat app with millions of users.'
        final = [{'w': w, 's': s, 'e': e} for w, s, e in (
            ('Character.AI,', 5.9, 6.4), ('which', 6.45, 6.6), ('is', 6.6, 6.7), ('a', 6.7, 6.75), ('chat', 6.75, 7.10),
            ('with', 7.40, 7.6), ('millions', 7.6, 8.0), ('of', 8.0, 8.1), ('users.', 8.1, 8.5))]
        r = wg.check(script, timed(script, 2.0), final)
        self.assertEqual(r['status'], 'fail')
        self.assertEqual([x['word'] for x in r['lost']], ['app'])
        self.assertEqual(r['unmeasured'], [])

    def test_a_word_that_changes_what_is_said_is_never_a_near_homophone(self):
        for said, heard in (('not', 'note'), ('no', 'not'), ('only', 'lonly'), ('six', 'sixty'), ('all', 'ball')):
            self.assertFalse(wg.near_homophone(said, heard), (said, heard))
        take = timed('It will not keep the lawsuits.')
        r = wg.check(SCRIPT, take, timed('It will note keep the lawsuits.'))
        self.assertEqual(r['status'], 'fail')
        self.assertEqual(r['lost'][0]['word'], 'not')

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


    def monday(self, cut):
        take = json.loads((FIXTURES / f'monday-26-{cut}.take.words.json').read_text(encoding='utf-8'))['words']
        return (FIXTURES / f'monday-26-{cut}.script.txt').read_text(encoding='utf-8'), take

    def test_numbers_dates_and_split_names_he_said_are_script_words(self):
        # The script says "two hundred", "the twelfth of October", "the first of March" and "OpenAI"; the take was
        # heard as "200", "12th", "1st" and "open AI". Each is a word of the script, so losing it fails.
        script, take = self.monday('long')
        self.assertEqual(wg.check(script, take, take)['status'], 'pass')
        for said in ('200', '12th', '1st', 'open'):
            at = next(k for k, w in enumerate(take) if w['w'].strip().lower().rstrip('.,') == said)
            r = wg.check(script, take, without(take, at))
            self.assertEqual(r['status'], 'fail', said)
            self.assertEqual([x['take_index'] for x in r['lost']], [at], said)

    def test_spelt_numbers_fold_both_ways(self):
        script = 'It cost a hundred dollars on the twenty-first, over two hundred and six times.'
        take = timed('It cost a hundred dollars on the twenty first, over two hundred and six times.')
        final = timed('It cost $100 on the 21st, over 206 times.', 2.0)
        r = wg.check(script, take, final)
        self.assertEqual(r['status'], 'pass', wg.summary(r))
        self.assertEqual(wg.check(script, take, timed('It cost $100 on the 21st, over times.'))['lost'][0]['token'], '206')

    def test_a_removal_of_the_only_time_he_said_a_script_word_needs_his_words(self):
        script, take = self.monday('long')
        first = next(k for k, w in enumerate(take) if w['w'].strip().lower().startswith('bankruptcy'))
        start = max(k for k in range(first) if take[k]['w'].strip().endswith(('.', ',', '?')) ) + 1
        end = next(k for k in range(first, len(take)) if take[k]['w'].strip().endswith('.'))
        final = shifted(without(take, *range(start, end + 1)), 3.2)
        session = {'removals': [{'take_index': [start, end]}]}
        r = wg.check(script, take, final, session)
        self.assertEqual(r['status'], 'fail')
        self.assertEqual(r['lost'], [])
        self.assertIn('bankruptcy', r['unapproved_removals'][0]['only_said_here'])
        self.assertIn('removal 1', wg.summary(r))
        self.assertEqual(wg.unapproved_removals(script, take, session)[0]['only_said_here'], r['unapproved_removals'][0]['only_said_here'])
        his = {'removals': [{'take_index': [start, end], 'krish': 'Krish, 2026-10-28: cut the bankruptcy line'}]}
        r = wg.check(script, take, final, his)
        self.assertEqual(r['status'], 'pass', wg.summary(r))
        self.assertIn('bankruptcy', r['approved_removals'][0]['only_said_here'])
        self.assertEqual(wg.unapproved_removals(script, take, his), [])

    def test_a_mishearing_of_the_final_is_cleared_only_by_his_words(self):
        script = 'The newest Claude model lost to the older one.'
        take = timed(script)
        final = timed('The newest clawed model lost to the older one.', 3.0)
        r = wg.check(script, take, final)
        self.assertEqual(r['status'], 'fail')
        self.assertEqual(r['lost'][0]['final_heard_there'], 'clawed')
        self.assertIn('the final has "clawed" there', r['lost'][0]['message'])
        row = {'said': 'Claude', 'heard': 'clawed', 'krish': 'Krish, 2026-11-01: I said Claude there'}
        r = wg.check(script, take, final, {'removals': [], 'heard_as': [row]})
        self.assertEqual(r['status'], 'pass', wg.summary(r))
        self.assertEqual(r['cleared_by_krish'], [{'word': 'Claude', 'heard': 'clawed', 'take_s': 0.6, 'krish': row['krish']}])
        # It clears that mishearing only: a different word lost in its place still fails.
        self.assertEqual(wg.check(script, take, timed('The newest model lost to the older one.'),
                                  {'removals': [], 'heard_as': [row]})['status'], 'fail')
        for bad in ({'said': 'Claude', 'heard': 'clawed'}, {'said': 'Claude', 'heard': 'clawed', 'krish': 'Claude: fine'},
                    {'said': 'Claude', 'heard': 'Claude', 'krish': 'Krish: yes'}):
            with self.assertRaises(wg.WordsGateError):
                wg.check(script, take, final, {'removals': [], 'heard_as': [bad]})


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

    def test_no_words_check_blocks_a_post_dated_from_the_gate_and_not_an_older_one(self):
        report = self.passing_receipt()
        self.receipt.write_text(json.dumps(report))
        new = '3 Posts/2026-11-09 Mon follow.the.money - Who pays/3 Video/wide 16x9.mp4'
        old = '3 Posts/2026-10-26 Mon follow.the.money - Disney/3 Video/wide 16x9.mp4'
        self.assertEqual(wg.REQUIRED_FROM, '2026-10-27')
        self.assertTrue(any(p.startswith('words gate did not run') for p in wg.delivery_problems(report, new)))
        self.assertEqual(wg.delivery_problems(report, old), [])
        self.assertEqual(wg.delivery_problems(report), [])
        # Without a target, the receipt's own destination decides (making.py with a bare name).
        self.assertTrue(wg.delivery_problems({**report, 'library_path': new}))
        self.receipt.write_text(json.dumps({**report, 'library_path': new}))
        with patch('visual_clarity.delivery_problems', return_value=[]), patch('media_standard.enforced', return_value=False):
            self.assertTrue(any(p.startswith('words gate did not run')
                                for p in quality.delivery_problems(self.video, self.receipt, new)))

    def test_a_words_check_on_other_take_words_than_the_cut_was_made_from_blocks(self):
        take = self.dir / 'take.json'
        take.write_text(json.dumps({'words': TAKE}))
        report = {**self.passing_receipt(), 'transcript_document': {'sha256': quality.digest(take)}}
        report['checks']['words'] = wg.bind(wg.check(SCRIPT, TAKE, TAKE), take=take, video=self.video)
        self.assertEqual(wg.delivery_problems(report), [])
        other = self.dir / 'other.json'
        other.write_text(json.dumps({'words': TAKE[:-1]}))
        report['checks']['words'] = wg.bind(wg.check(SCRIPT, TAKE, TAKE), take=other, video=self.video)
        self.assertEqual(wg.delivery_problems(report), ['words gate result was checked against other take words than the cut was made from'])

    def test_a_check_by_hand_never_changes_the_words_the_cut_is_checked_against(self):
        script, take, other = (self.dir / n for n in ('script.txt', 'take.json', 'other.json'))
        script.write_text(SCRIPT)
        take.write_text(json.dumps({'words': TAKE}))
        other.write_text(json.dumps({'words': without(TAKE, 1)}))
        made = wg.bind(wg.check(SCRIPT, TAKE, without(TAKE, 1)), script=script, take=take, video=self.video)
        wg.record(self.receipt, made)
        forged = wg.bind(wg.check(SCRIPT, without(TAKE, 1), without(TAKE, 1)), script=script, take=other, video=self.video)
        with self.assertRaises(wg.WordsGateError):
            wg.record(self.receipt, forged)
        self.assertEqual(json.loads(self.receipt.read_text())['checks']['words']['status'], 'fail')
        # A receipt that names the take words its cut was made from takes a check only on those.
        self.receipt.write_text(json.dumps({**self.passing_receipt(), 'transcript_document': {'sha256': quality.digest(take)}}))
        with self.assertRaises(wg.WordsGateError):
            wg.record(self.receipt, forged)
        wg.record(self.receipt, made)

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
        self.assertEqual(set(report['inputs']), {'script', 'take_words', 'final_words', 'edl'})
        # A words json is reported, never written into a receipt, even one whose provenance names the cut's bytes:
        # copying the take's words into a json would otherwise forge a machine-written pass (F12).
        final.write_text(json.dumps({'words': TAKE, 'provenance': {'source_sha256': self.sha}}))
        code, report, _ = self.cli('--script', script, '--take-words', take, '--final', final, '--receipt', self.receipt)
        self.assertEqual((code, report['status'], report['receipt']), (0, 'pass', None))
        self.assertIn('never written into a receipt', report['receipt_not_written'])
        self.assertNotIn('words', json.loads(self.receipt.read_text())['checks'])
        code, report, _ = self.cli('--script', self.dir / 'missing.txt', '--take-words', take, '--final', final)
        self.assertEqual(code, 1)
        self.assertIn('could not be made', report['reason'])

    def test_the_command_line_on_the_video_writes_the_receipt_it_heard(self):
        script, take = self.dir / 'script.txt', self.dir / 'take.json'
        script.write_text(SCRIPT)
        take.write_text(json.dumps({'words': TAKE}))
        self.receipt.write_text(json.dumps({**self.passing_receipt(), 'transcript_document': {'sha256': quality.digest(take)}}))
        heard = {'words': shifted(TAKE, 3.2), 'provenance': {'source_sha256': self.sha}}
        with patch.object(wg, 'transcribe', return_value=heard):
            code, report, _ = self.cli('--script', script, '--take-words', take, '--final', self.video, '--no-receipt')
            self.assertEqual((code, report['receipt']), (0, None))
            self.assertNotIn('words', json.loads(self.receipt.read_text())['checks'])
            code, report, _ = self.cli('--script', script, '--take-words', take, '--final', self.video)
        self.assertEqual((code, report['status'], report['receipt']), (0, 'pass', str(self.receipt)))
        written = json.loads(self.receipt.read_text())['checks']['words']
        self.assertEqual((written['machine'], written['video_sha256']), (wg.MACHINE, self.sha))
        self.assertEqual(wg.delivery_problems(json.loads(self.receipt.read_text())), [])
        # Other take words than the cut was made from: the check is reported as not made and nothing is written.
        other = self.dir / 'other.json'
        other.write_text(json.dumps({'words': TAKE[:5]}))
        with patch.object(wg, 'transcribe', return_value={'words': TAKE[:5], 'provenance': {'source_sha256': self.sha}}):
            code, report, _ = self.cli('--script', script, '--take-words', other, '--final', self.video)
        self.assertEqual(code, 1)
        self.assertIn('could not be made', report['reason'])
        self.assertEqual(json.loads(self.receipt.read_text())['checks']['words']['inputs']['take_words']['sha256'], quality.digest(take))

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
