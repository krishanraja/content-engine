"""The calibrated cut gates (scripts/cutgates, plan W2.4) on synthetic stand-ins.

Floor never 3, Krish 19 Oct: "my words randomly chop out, making the video incomprehensible". Every stand-in is a
few seconds of ffmpeg tones with caption boxes drawn in a caption zone; the aligner and the OCR are fixtures, so
no model runs and no paid service is ever called (there is none). These prove the gates fail as they should on
each mutation and pass the intact cut; the calibration on the real cuts stays open (config/gate-calibration.json).
"""
import io
import json
import os
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(1, str(ROOT / 'scripts/quick-edit'))
sys.path.insert(2, str(ROOT / 'scripts/post-pack'))
from cutgates import aligners, calibrate, captions, gaps, joins_reel, receipt, settings, synthetic  # noqa: E402
import board_materials  # noqa: E402
import quality  # noqa: E402
import words_gate  # noqa: E402

FW = settings.FIRST


def never(*_args, **_kwargs):
    raise AssertionError('the paid service was called')


class Stand(unittest.TestCase):
    """One stand-in a test, in its own folder."""

    def build(self, kind):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.folder = Path(tmp.name)
        return synthetic.build(self.folder, kind)

    def checks(self, case, aligned=None):
        return receipt.cut_checks(case['video'], joins=case['joins'], aligners=aligned or {FW: case['heard']},
                                  captions=[(case['region'], case['pages'])], fps=case['fps'], ocr=case['ocr'])


class MutationTests(Stand):
    def test_the_intact_stand_in_passes_every_gate(self):
        case = self.build('intact')
        words = words_gate.check_aligners(case['script'], case['take'], {FW: case['heard']})
        self.assertEqual(words['status'], 'pass', words_gate.summary(words))
        self.assertEqual(words['agreement'], 'single aligner')
        checks = self.checks(case)
        self.assertEqual({k: v['status'] for k, v in checks.items()},
                         {'joins': 'pass', 'captions_clock': 'pass', 'captions_render': 'pass'})
        sha = receipt.digest(case['video'])
        self.assertTrue(all(v['video_sha256'] == sha for v in checks.values()))

    def test_a_deleted_content_word_fails_naming_it(self):
        case = self.build('lost_word')
        words = words_gate.check_aligners(case['script'], case['take'], {FW: case['heard']})
        self.assertEqual(words['status'], 'fail')
        self.assertEqual([r['word'] for r in words['lost']], ['lawsuits'])
        self.assertIn('"lawsuits" is lost', words_gate.summary(words))

    def test_a_join_moved_into_speech_fails_naming_the_time_and_the_words(self):
        case = self.build('join_in_speech')
        joins = self.checks(case)['joins']
        self.assertEqual(joins['status'], 'fail')
        self.assertEqual(len(joins['failed']), 1)
        message = joins['failed'][0]['message']
        self.assertIn('0:02.910', message)
        self.assertIn('inside "sixty"', message)
        self.assertIn('after "hiring"', message)
        self.assertIn('single aligner', joins['reason'])

    def test_joins_ten_ms_after_a_word_fail_as_the_rejected_reel_did(self):
        joins = self.checks(self.build('tight_joins'))['joins']
        self.assertEqual(joins['status'], 'fail')
        self.assertEqual(len(joins['failed']), 3)
        self.assertIn('10 ms after the word before, under 30 ms', joins['failed'][0]['message'])

    def test_captions_drawn_from_a_stale_clock_fail_the_clock_truth(self):
        clock = self.checks(self.build('stale_captions'))['captions_clock']
        self.assertEqual(clock['status'], 'fail')
        self.assertIn('frames late on "Disney"', clock['failed'][0]['message'])
        self.assertFalse(clock['independent'])
        self.assertIn('single aligner', clock['agreement'])

    def test_pages_burned_on_an_old_clock_fail_the_renderer_truth(self):
        render = self.checks(self.build('burned_late'))['captions_render']
        self.assertEqual(render['status'], 'fail')
        self.assertIn('no change in the caption zone within 3 frames', render['failed'][0]['message'])

    def test_ocr_that_reads_other_words_fails_and_ocr_outside_the_window_is_never_asked(self):
        case = self.build('intact')
        asked = []

        def wrong(frame, expected):
            asked.append(frame)
            return {'text': expected.replace('Disney', 'Dizzy'), 'score': 0.9}

        render = captions.renderer_truth(case['video'], case['pages'], case['region'], ocr=wrong)
        self.assertEqual(render['status'], 'fail')
        self.assertIn('not "Disney is building its"', render['failed'][0]['message'])
        starts = [p['fromFrame'] for p in case['pages']]
        self.assertTrue(all(any(abs(f - s) <= 3 for s in starts) for f in asked), asked)

    def test_the_tesseract_reader_decodes_every_frame_it_reads_in_one_pass(self):
        case = self.build('intact')
        drawn = {}
        for k, page in enumerate(case['drawn']):
            drawn.update({f: (synthetic.shade(k), captions.page_text(page)) for f in range(page['fromFrame'], page['toFrame'])})
        passes = []

        def by_shade(_exe, pixels, _expected):
            # Stands in for tesseract: names the page whose box shade these decoded pixels show.
            shade = float(pixels[10:50, 10:310].mean())
            text = next((t for s, t in sorted(set(drawn.values())) if abs(s - shade) < 12), '')
            return {'text': text, 'agreement': 1.0 if text else 0.0}

        real_run = captions.subprocess.run

        def counted(args, **kwargs):
            passes.append(args)
            return real_run(args, **kwargs)

        reader = captions.TesseractReader('tesseract', case['video'], case['region'])
        with patch.object(reader.qc_captions, '_read_candidates', side_effect=by_shade), \
                patch.object(captions.subprocess, 'run', side_effect=counted):
            render = captions.renderer_truth(case['video'], case['pages'], case['region'], ocr=reader)
        self.assertEqual(render['status'], 'pass', captions.summary(render))
        self.assertEqual(sum(1 for a in passes if 'select' in ' '.join(map(str, a))), 1)

    def test_without_tesseract_the_renderer_check_is_missing_and_holds(self):
        case = self.build('intact')
        with patch('cutgates.captions.shutil.which', return_value=None):
            render = captions.renderer_truth(case['video'], case['pages'], case['region'])
        self.assertEqual(render['status'], 'missing')
        self.assertIn('tesseract is not on PATH', render['reason'])


class TwoAlignerTests(Stand):
    def test_a_word_lost_on_one_aligner_only_is_listed_never_blocking(self):
        case = self.build('intact')
        lost_once = [w for w in case['heard'] if w['w'].strip() != 'lawsuits']
        r = words_gate.check_aligners(case['script'], case['take'], {FW: case['heard'], 'scribe': lost_once})
        self.assertEqual(r['status'], 'pass')
        self.assertEqual(r['agreement'], '2 aligners')
        self.assertEqual([x['word'] for x in r['heard_by_one_aligner']], ['lawsuits'])
        self.assertEqual(r['heard_by_one_aligner'][0]['lost_by'], ['scribe'])

    def test_a_word_lost_on_both_aligners_fails(self):
        case = self.build('lost_word')
        r = words_gate.check_aligners(case['script'], case['take'], {FW: case['heard'], 'scribe': case['heard']})
        self.assertEqual(r['status'], 'fail')
        self.assertIn('on every aligner\'s pass (faster-whisper, scribe)', r['reason'])

    def test_a_join_both_aligners_do_not_agree_is_clear_fails(self):
        case = self.build('intact')
        # The second aligner hears "own" start 20 ms early, into the first join's gap.
        other = [dict(w, s=round(w['s'] - 0.02, 3)) if w['w'].strip() == 'own' else w for w in case['heard']]
        alone = gaps.joins_in_gaps(case['joins'], {FW: case['heard']})
        both = gaps.joins_in_gaps(case['joins'], {FW: case['heard'], 'scribe': other})
        self.assertEqual(alone['status'], 'pass')
        self.assertEqual(both['status'], 'fail')
        self.assertIn('before "own" (starts 1.580 s, scribe)', both['failed'][0]['message'])

    def test_with_a_second_aligner_the_caption_clock_is_heard_by_the_one_that_did_not_draw_them(self):
        case = self.build('intact')
        checks = self.checks(case, {FW: case['heard'], 'scribe': case['heard']})
        self.assertTrue(checks['captions_clock']['independent'])
        self.assertEqual(checks['captions_clock']['heard_by'], 'scribe')
        self.assertEqual(checks['captions_clock']['drawn_by'], FW)


class NoPaidAlignerTests(unittest.TestCase):
    """Krish, 2026-10-29: "do not use eleven labs for this". The paid second aligner is gone, not merely off."""

    def test_the_second_aligner_is_off_whatever_the_environment_says(self):
        for env in ({}, {'MINDMAKE_SECOND_ALIGNER': 'scribe', 'ELEVENLABS_API_KEY': 'test-key-not-real'}):
            off = settings.second_aligner(env)
            self.assertFalse(off['enabled'])
            self.assertTrue(any('do not use eleven labs' in r for r in off['reasons']))
        self.assertFalse(settings.load()['second_aligner']['enabled'])
        self.assertFalse((ROOT / 'scripts' / 'cutgates' / 'scribe.py').exists())

    def test_the_gates_run_on_faster_whisper_alone_and_say_so(self):
        heard = synthetic.words()
        found = aligners.passes('unused.mp4', heard={FW: heard})
        self.assertEqual(list(found['aligners']), [FW])
        self.assertEqual(found['agreement'], 'single aligner')
        self.assertFalse(found['second']['ran'])

    def test_a_second_local_pass_handed_in_is_used_by_name(self):
        heard = synthetic.words()
        found = aligners.passes('unused.mp4', heard={FW: heard, 'faster-whisper-medium': heard})
        self.assertEqual(list(found['aligners']), [FW, 'faster-whisper-medium'])
        self.assertEqual(found['agreement'], '2 aligners')


class ReceiptTests(Stand):
    TARGET = '3 Posts/2026-11-16 Mon follow.the.money - Who pays/3 Video/who-pays-long-16x9.mp4'
    EARLY = '3 Posts/2026-11-02 Mon follow.the.money - Who pays/3 Video/who-pays-long-16x9.mp4'

    def report(self, case, checks=None):
        return {'video_sha256': receipt.digest(case['video']), 'checks': checks if checks is not None else self.checks(case)}

    def test_a_missing_check_holds_a_cut_from_the_first_calibrated_week_and_never_before(self):
        case = self.build('intact')
        report = self.report(case, {})
        report['missing'] = {'joins': 'the joins were not measured on this render'}
        problems = receipt.delivery_problems(report, self.TARGET)
        self.assertIn('joins check is missing: the joins were not measured on this render', problems)
        self.assertEqual(len(problems), 3)
        self.assertEqual(receipt.delivery_problems(report, self.EARLY), [])

    def test_a_check_for_other_bytes_or_written_by_hand_holds(self):
        case = self.build('intact')
        checks = self.checks(case)
        checks['joins'] = dict(checks['joins'], video_sha256='0' * 64)
        checks['captions_clock'] = {'status': 'pass'}
        problems = receipt.delivery_problems(self.report(case, checks), self.TARGET)
        self.assertEqual(problems, ['joins check belongs to different video bytes or was not machine written',
                                    'captions_clock check belongs to different video bytes or was not machine written'])

    def test_a_failed_check_holds_and_a_passed_one_does_not(self):
        bad = self.build('join_in_speech')
        problems = receipt.delivery_problems(self.report(bad), self.TARGET)
        self.assertEqual(len(problems), 1)
        self.assertTrue(problems[0].startswith('joins is not passed: 1 of 3 join(s)'))
        good = self.build('intact')
        self.assertEqual(receipt.delivery_problems(self.report(good), self.TARGET), [])

    def test_quality_names_a_missing_review_check_and_its_reason_instead_of_a_placeholder(self):
        case = self.build('intact')
        report = {'video_sha256': receipt.digest(case['video']),
                  'checks': {k: {'status': 'pass'} for k in ('heard', 'loudness', 'visuals')},
                  'missing': {'sync': 'the lip-sync measure (sync_check.py) on these bytes'}}
        path = self.folder / 'cut.mp4.validation.json'
        path.write_text(json.dumps(report), encoding='utf-8')
        with patch('visual_clarity.delivery_problems', return_value=[]), patch('media_standard.enforced', return_value=False):
            problems = quality.delivery_problems(case['video'], path)
        self.assertIn('sync is missing: the lip-sync measure (sync_check.py) on these bytes', problems)
        self.assertIn('full_review is missing', problems)

    def test_no_render_writes_a_placeholder_status_any_more(self):
        for name in ('scripts/quick-edit/make.py', 'scripts/quick-edit/motion_compose.py'):
            source = (ROOT / name).read_text(encoding='utf-8')
            self.assertIsNone(re.search(r"\{'status':\s*'not_run'", source), name)


class JoinsReelTests(Stand):
    def test_the_reel_holds_every_join_and_feeds_the_board_materials(self):
        case = self.build('intact')
        joins = self.checks(case)['joins']['joins']
        index = joins_reel.build(case['video'], joins, self.folder / 'reel')
        self.assertTrue((self.folder / 'reel' / index['reel']).is_file())
        self.assertEqual([j['cut_s'] for j in index['joins']], case['joins'])
        self.assertEqual(index['joins'][0]['reel_s'], 1.5)
        self.assertAlmostEqual(index['seconds'], 3 * (3.0 + 0.6), places=3)
        data = joins_reel.materials('p1', [('long', 'https://drive.google.com/file/d/x', index)])
        board_materials.validate(data, 'p1')
        again = joins_reel.materials('p1', [('long', 'https://drive.google.com/file/d/y', index)], data)
        self.assertEqual([s['id'] for s in again['sections']], ['joins-reel-long'])
        self.assertIn('Every join measured in an agreed gap', again['sections'][0]['note'])
        with self.assertRaises(ValueError):
            joins_reel.materials('p2', [], data)

    def test_a_cut_with_no_joins_says_so(self):
        case = self.build('intact')
        index = joins_reel.build(case['video'], [], self.folder)
        self.assertIn('no joins', index['note'])


class CalibrationTests(unittest.TestCase):
    def test_the_manifest_lists_the_five_cuts_as_the_brief_does(self):
        cuts = {c['id']: c for c in json.loads(calibrate.MANIFEST.read_text(encoding='utf-8'))['cuts']}
        self.assertEqual({k: c['expect'] for k, c in cuts.items()},
                         {'mon26-long': 'pass', 'mon26-short': 'pass', 'wed21-long': 'fail', 'fri23-join-reel': 'fail', 'fri16-90s': 'fail'})
        self.assertTrue(all(c.get('caught_by') for c in cuts.values() if c['expect'] == 'fail'))

    def test_the_harness_on_synthetic_stand_ins_behaves_as_listed(self):
        out = io.StringIO()
        with redirect_stdout(out):
            code = calibrate.main(['--synthetic'])
        self.assertEqual(code, 0, out.getvalue())
        self.assertIn('every cut behaves as listed', out.getvalue())

    def test_a_cut_whose_files_are_not_found_is_incomplete_never_a_pass(self):
        case = {'id': 'x', 'expect': 'pass', 'gates': ['words', 'joins'], 'final': ['no/such/file.mp4']}
        row = calibrate.run_case(case, [ROOT])
        self.assertEqual(row['actual'], 'incomplete')
        self.assertFalse(row['as_listed'])

    def test_joins_come_from_a_receipt_or_the_reel_clip_midpoints(self):
        reel = {'from': 'reel_midpoints', 'file': ['docs/plans/2026-10-23-friday/revisions/motion-v6/rejected-join-reel.json']}
        joins, _ = calibrate.joins_from(reel, [ROOT])
        self.assertEqual(len(joins), 10)  # the ten-join reel
        self.assertAlmostEqual(joins[0], 1.995, places=3)
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, 'cut.mp4.validation.json').write_text(json.dumps({'checks': {'joins': {'joins': [{'at_s': 4.2}]}}}))
            advisory = {'advisory': {'rows': {'joins': {'result': {'join_times_s': [1.0, 2.0]}}}}}
            Path(tmp, 'old.mp4.validation.json').write_text(json.dumps(advisory))
            self.assertEqual(calibrate.joins_from({'file': ['cut.mp4.validation.json']}, [Path(tmp)])[0], [4.2])
            self.assertEqual(calibrate.joins_from({'file': ['old.mp4.validation.json']}, [Path(tmp)])[0], [1.0, 2.0])
            self.assertIsNone(calibrate.joins_from({'file': ['none.json']}, [Path(tmp)])[0])

    def test_caption_pages_are_read_from_an_ass_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            ass = Path(tmp) / 'cut.ass'
            ass.write_text('[Events]\nDialogue: 0,0:00:01.00,0:00:02.50,Cap,,0,0,0,,{\\an2}Disney is\\Nbuilding\n'
                           'Dialogue: 0,0:00:02.50,0:00:04.00,Cap,,0,0,0,,its own team\n', encoding='utf-8')
            pages = captions.pages_from_ass(ass, 30)
        self.assertEqual([(p['fromFrame'], p['toFrame'], captions.page_text(p)) for p in pages],
                         [(30, 75, 'Disney is building'), (75, 120, 'its own team')])


if __name__ == '__main__':
    unittest.main()
