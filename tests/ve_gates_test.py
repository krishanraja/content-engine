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


if __name__ == '__main__':
    unittest.main()
