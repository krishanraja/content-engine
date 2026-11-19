"""Filing is ungated, publishing is not (Ruling, Krish, 2026-11-19: filing to his own post folder needs no approval;
his one final Approve press on the board, bound to the file shas, gates publishing only).

A cut whose machine checks pass files with no Krish field on its receipt; the manifest Growth publishes from is never
sealed without his Approve for publish bound to the draft that names the files' sha256."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
for path in (ROOT / 'scripts' / 'quick-edit', ROOT / 'scripts' / 'post-pack', ROOT / 'scripts'):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import quality  # noqa: E402
import piece_manifest  # noqa: E402

PIECE = '11111111-2222-4333-8444-555555555555'


class FilingNeedsNoKrishTest(unittest.TestCase):
    def test_a_qc_passed_receipt_with_no_full_review_is_not_held(self):
        with tempfile.TemporaryDirectory() as temp:
            video = Path(temp) / 'cut.mp4'
            video.write_bytes(b'synthetic cut')
            receipt = Path(temp) / 'cut.mp4.validation.json'
            receipt.write_text(json.dumps({
                'video_sha256': quality.digest(video),
                'checks': {k: {'status': 'pass'} for k in ('heard', 'sync', 'loudness', 'visuals')},
                'missing': {'full_review': 'Krish playing these bytes through at full size'}}), encoding='utf-8')
            with patch('bed_shape.receipt_problems', return_value=[]), \
                    patch('words_gate.delivery_problems', return_value=[]), \
                    patch.object(quality, 'cut_gate_problems', return_value=[]), \
                    patch('opening_gate.delivery_problems', return_value=[]), \
                    patch.object(quality, 'motion_problems', return_value=[]), \
                    patch('visual_clarity.delivery_problems', return_value=[]), \
                    patch('media_standard.enforced', return_value=False):
                self.assertEqual(quality.delivery_problems(str(video), str(receipt)), [])

    def test_a_failed_machine_check_still_holds(self):
        with tempfile.TemporaryDirectory() as temp:
            video = Path(temp) / 'cut.mp4'
            video.write_bytes(b'synthetic cut')
            receipt = Path(temp) / 'cut.mp4.validation.json'
            checks = {k: {'status': 'pass'} for k in ('heard', 'sync', 'visuals')}
            checks['loudness'] = {'status': 'fail'}
            receipt.write_text(json.dumps({'video_sha256': quality.digest(video), 'checks': checks}), encoding='utf-8')
            with patch('bed_shape.receipt_problems', return_value=[]), \
                    patch('visual_clarity.delivery_problems', return_value=[]), \
                    patch('media_standard.enforced', return_value=False):
                self.assertIn('loudness is not passed', quality.delivery_problems(str(video), str(receipt)))


class StatusNeverShowsAnUncheckedApprovalTest(unittest.TestCase):
    def test_a_readiness_error_never_reads_as_his_approval(self):
        from velib import packet
        with patch.object(packet, 'mechanical', side_effect=ValueError('no qc')):
            state = packet.readiness({'cuts': {}}, 'long', Path('.'))
        self.assertEqual(state['mechanical'], ['no qc'])
        self.assertTrue(state['final'], 'an empty final prints as "publish: APPROVED" in ve status')


class PublishStillNeedsHisApproveTest(unittest.TestCase):
    def setUp(self):
        spec = {'piece_id': PIECE, 'qa': {'state': 'passed', 'checked_at': '2026-11-19T07:00:00Z'},
                'assets': [{'name': 'short_video', 'drive_id': 'a' * 25, 'sha256': '1' * 64},
                           {'name': 'vertical_cover', 'drive_id': 'b' * 25, 'sha256': '2' * 64}],
                'channels': {'tiktok': {'words': 'Synthetic caption.', 'alt_text': None, 'assets': ['short_video'],
                                        'cover': {'asset': 'vertical_cover', 'sha256': '2' * 64, 'cover_offset_ms': None}}}}
        self.draft = piece_manifest.encode(piece_manifest.draft(spec))
        self.approval = {'id': 'mon-publish', 'updated_by': 'Krish',
                         'body': {'kind': 'approve_publish', 'day': 'mon', 'piece_id': PIECE, 'approved': True,
                                  'manifest_sha256': piece_manifest.sha256(self.draft), 'at': '2026-11-19T07:40:00Z'}}

    def test_seals_on_his_approve_bound_to_these_files(self):
        sealed = piece_manifest.seal(self.draft, self.approval)
        self.assertEqual({a['sha256'] for a in sealed['assets']}, {'1' * 64, '2' * 64})

    def test_refuses_with_no_approve(self):
        for approval in (None, {}, {**self.approval, 'updated_by': 'engine_operator'},
                         {**self.approval, 'body': {**self.approval['body'], 'approved': False}},
                         {**self.approval, 'body': {**self.approval['body'], 'manifest_sha256': '0' * 64}}):
            with self.assertRaises(piece_manifest.ManifestError):
                piece_manifest.seal(self.draft, approval)


if __name__ == '__main__':
    unittest.main()
