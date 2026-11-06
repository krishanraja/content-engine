"""ve qc runs the calibrated cut gates quick-edit runs (scripts/cutgates, plan W2.4), on synthetic stand-ins.

Floor never 3: his words never cut, changed or out of sync. Each stand-in is a few seconds of ffmpeg tones with
caption boxes; the aligner and the OCR are fixtures (no model, no paid call). Without their inputs the rows are
not_run, which `ve status` reads as not ready.
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import qc, qc_gates  # noqa: E402
from cutgates import synthetic  # noqa: E402

FW = 'faster-whisper'
ROWS = ('words.lost', 'joins.in_gaps', 'captions.clock', 'captions.render')


class VeGateTests(unittest.TestCase):
    def test_ve_take_words_reach_the_words_gate_as_its_own_shape(self):
        # ve's words.json carries the index in "w" and the text in "word"; the gate raised on every ve cut before.
        doc = {'clock': 'x', 'words': [{'w': 0, 'word': 'You', 'onset_s': 0.6, 'end_s': 1.1}]}
        self.assertEqual(qc_gates.gate_words(doc)['words'], [{'w': 'You', 's': 0.6, 'e': 1.1}])
        gate = {'words': [{'w': 'You', 's': 0.6, 'e': 1.1}]}
        self.assertIs(qc_gates.gate_words(gate), gate)

    def build(self, kind):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        return synthetic.build(tmp.name, kind)

    def run_qc(self, case, **extra):
        return qc.run_qc(str(case['video']), 'scoreboard-test', joins=case['joins'], pages=case['pages'],
                         region=case['region'], script=case['script'], take_words=case['take'],
                         heard={FW: case['heard']}, caption_ocr=case['ocr'], **extra)['checks']

    def test_the_intact_stand_in_passes_every_gate_row(self):
        checks = self.run_qc(self.build('intact'))
        for name in ROWS:
            self.assertIs(checks[name]['pass'], True, f'{name}: {checks[name].get("summary")}')
        self.assertEqual(checks['joins.in_gaps']['agreement'], 'single aligner')

    def test_each_mutation_fails_its_row(self):
        for kind, row, words in (('lost_word', 'words.lost', '"lawsuits" is lost'),
                                 ('join_in_speech', 'joins.in_gaps', 'inside "sixty"'),
                                 ('stale_captions', 'captions.clock', 'frames late on "Disney"'),
                                 ('burned_late', 'captions.render', 'no change in the caption zone')):
            with self.subTest(kind=kind):
                checks = self.run_qc(self.build(kind))
                self.assertIs(checks[row]['pass'], False)
                self.assertIn(words, checks[row]['summary'])

    def test_without_their_inputs_the_rows_are_not_run_and_the_report_is_incomplete(self):
        case = self.build('intact')
        report = qc.run_qc(str(case['video']), 'scoreboard-test')
        for name in ROWS:
            self.assertEqual(report['checks'][name]['status'], 'not_run', name)
        self.assertFalse(report['complete'])

    def test_without_tesseract_the_render_row_is_not_run_never_a_pass(self):
        case = self.build('intact')
        from unittest.mock import patch
        with patch('cutgates.captions.shutil.which', return_value=None):
            row = qc_gates.captions_render(str(case['video']), case['pages'], case['region'])
        self.assertEqual(row['status'], 'not_run')
        self.assertIsNone(row['pass'])

    def test_a_region_that_fails_fails_the_whole_render_row(self):
        # Thursday 5 Nov: pages read in two zones; the first zone passed, the second failed two pages, and the row
        # copied the first zone's status and reported a pass.
        from unittest.mock import patch
        pages = [{'fromFrame': 0, 'toFrame': 30, 'words': ['a']},
                 {'fromFrame': 30, 'toFrame': 60, 'words': ['b'], 'region': [72, 1460, 900, 180]}]
        results = iter([{'status': 'pass', 'pass': True, 'pages': [{'page': 0, 'status': 'pass'}], 'failed': []},
                        {'status': 'fail', 'pass': False, 'pages': [{'page': 0, 'status': 'fail'}], 'failed': [0]}])
        _, captions, *_ = qc_gates._cutgates()
        with patch.object(captions, 'renderer_truth', side_effect=lambda *a, **k: next(results)), \
                patch.object(captions, 'summary', return_value='summary'):
            row = qc_gates.captions_render('cut.mp4', pages, (72, 1180, 900, 217))
        self.assertFalse(row['pass'])
        self.assertEqual(row['value']['status'], 'fail')
        self.assertEqual(row['value']['failed'], [0])

    def test_the_command_reads_heard_words_and_a_script(self):
        case = self.build('lost_word')
        folder = Path(case['video']).parent
        import argparse
        import ve
        out = folder / 'qc.json'
        args = argparse.Namespace(cut=str(case['video']), format='scoreboard-test', out=str(out), props=None,
                                  script=str(folder / 'script.txt'), take_words=str(folder / 'take.words.json'),
                                  heard=[f'{FW}={folder / "lost_word.heard.json"}'], transcribe=False,
                                  captions_drawn_by=FW)
        self.assertEqual(ve.cmd_qc(args), 1)
        report = json.loads(out.read_text(encoding='utf-8'))
        self.assertIs(report['checks']['words.lost']['pass'], False)


class HandoverInGapsTests(unittest.TestCase):
    """A beat hands over only in a pause he left (keyframes@0.2.13, docs/ve/sources/keyframes.md)."""
    HEARD = {FW: [{'w': 'phones', 's': 0.0, 'e': 0.9}, {'w': 'feel', 's': 1.1, 'e': 1.5},
                  {'w': 'charge', 's': 1.55, 'e': 2.4}]}

    def beats(self, *starts):
        edges = list(starts) + [90]
        return [{'fromFrame': a, 'toFrame': b} for a, b in zip(edges, edges[1:])]

    def test_handover_in_a_pause_passes(self):
        row = qc_gates.handover_in_gaps(self.beats(0, 30), self.HEARD)  # 1.0 s, in the 200 ms pause
        self.assertIs(row['pass'], True)

    def test_handover_inside_a_word_fails_and_names_it(self):
        row = qc_gates.handover_in_gaps(self.beats(0, 60), self.HEARD)  # 2.0 s, inside "charge"
        self.assertIs(row['pass'], False)
        self.assertIn('charge', row['summary'])

    def test_a_pause_under_150_ms_fails(self):
        row = qc_gates.handover_in_gaps(self.beats(0, 46), self.HEARD)  # 1.533 s, in a 50 ms pause
        self.assertIs(row['pass'], False)

    def test_handovers_at_or_after_the_ending_are_not_measured(self):
        self.assertEqual(qc_gates.beat_handovers(self.beats(0, 30, 60), stop_frame=60), [1.0])

    def test_advisory_for_formats_that_do_not_name_it(self):
        from unittest.mock import patch
        import numpy as np
        with patch.object(qc, 'loudness', return_value={'integrated_lufs': -14, 'true_peak_dbtp': -1}), \
                patch.object(qc, 'frame_diffs', return_value=np.full(150, 2.)), \
                patch.object(qc, 'long_silences', return_value=[]), patch.object(qc, 'sha256_file', return_value='x'), \
                patch.object(qc, 'duration_s', return_value=3.), \
                patch('velib.qc_composition.composition_checks', return_value={'applies': False}), \
                patch('velib.qc_keyframes.keyframe_checks', return_value={'applies': False}):
            report = qc.run_qc('unused', 'scoreboard-test', beats=self.beats(0, 60), heard=self.HEARD)
        row = report['checks']['beats.handover_in_gaps']
        self.assertEqual(row['status'], 'advisory')
        self.assertIs(row['pass'], False)


if __name__ == '__main__':
    unittest.main()
