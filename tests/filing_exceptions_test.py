"""Krish's filing exceptions (config/filing-exceptions.json): one file, one destination, his words; nothing else."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import bed_shape  # noqa: E402

TARGET = '3 Posts/2026-11-16 Mon off.day - Test/3 Video/cut.mp4'


class FilingExceptionsTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.video = self.dir / 'cut.mp4'
        self.video.write_bytes(b'the approved bytes')
        self.other = self.dir / 'other.mp4'
        self.other.write_bytes(b'different bytes')

    def config(self, **entry):
        base = {'video_sha256': bed_shape.sha256(self.video), 'target': TARGET, 'krish_words': 'Yes, I approve as an exception.'}
        base.update(entry)
        path = self.dir / 'exceptions.json'
        path.write_text(json.dumps({'schema': 'filing-exceptions/1', 'exceptions': [base]}), encoding='utf-8')
        return path

    def test_matching_bytes_and_destination_pass(self):
        self.assertIsNotNone(bed_shape.filing_exception(self.video, TARGET, self.config()))

    def test_other_bytes_are_refused(self):
        self.assertIsNone(bed_shape.filing_exception(self.other, TARGET, self.config()))

    def test_other_destination_is_refused(self):
        self.assertIsNone(bed_shape.filing_exception(self.video, TARGET.replace('Test', 'Else'), self.config()))

    def test_no_words_no_exception(self):
        self.assertIsNone(bed_shape.filing_exception(self.video, TARGET, self.config(krish_words='')))

    def test_the_gate_still_refuses_without_an_exception(self):
        bed_shape.EXCEPTIONS_SAVED = bed_shape.EXCEPTIONS
        try:
            bed_shape.EXCEPTIONS = self.dir / 'missing.json'
            self.assertTrue(bed_shape.filing_problems(self.other, TARGET))
        finally:
            bed_shape.EXCEPTIONS = bed_shape.EXCEPTIONS_SAVED

    def test_the_recorded_exception_names_a_real_target(self):
        doc = json.loads((ROOT / 'config' / 'filing-exceptions.json').read_text(encoding='utf-8'))
        for entry in doc['exceptions']:
            self.assertTrue(bed_shape.is_filed_video(entry['target']))
            self.assertRegex(entry['video_sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(entry['krish_words'].strip())


if __name__ == '__main__':
    unittest.main()
