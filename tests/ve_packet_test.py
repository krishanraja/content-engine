"""Approval packet gates with temp pieces and pinned-ffmpeg video readback."""
from __future__ import annotations

import json
import io
import shutil
import subprocess
import sys
import tempfile
import unittest
import uuid
from argparse import Namespace
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import ve
from velib import designlock, packet, verdict
from velib.common import sha256_file, write_json
from PIL import Image

PINNED = ROOT.parents[1] / 'toolchain/ffmpeg-n8.1.2-53-g1005b294ff-win64-gpl-8.1/bin/ffmpeg.exe'
# On non-Windows CI the environment supplies the pinned binary on PATH.
FFMPEG = str(PINNED) if PINNED.is_file() else shutil.which('ffmpeg')


class PacketTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.gettempdir()) / ('ve-packet-' + uuid.uuid4().hex)
        self.root.mkdir()
        self.addCleanup(shutil.rmtree, self.root)
        self.directory = self.root / 've'
        self.directory.mkdir()
        self.video = self.directory / 'short.mp4'
        self.video.write_bytes(b'hash-only test media')
        self.spec = {'piece_id': 'test-piece', 'format': 'hand-held-screen', 'approvals': [],
                     'cuts': {'short': {'aspect': '9:16', 'beats': [{'id':'one'}, {'id':'two'}]}}}
        self.spec_file = write_json(self.directory / 'spec.json', self.spec)
        self.qc = {'file':str(self.video), 'sha256':sha256_file(self.video), 'measured_pass':True,
                   'complete':True, 'duration_s':2, 'checks':{
                       'composition':{'pass':True, 'value':{'fill_pct':72, 'smallest_text_px':32}},
                       'keyframe_match':{'pass':True, 'value':{'one':{'ssim':0.98},'two':{'ssim':0.99}}}}}
        self.save_qc()
        write_json(self.directory / 'props.short.json', {'fps':30, 'beats':[
            {'id':'one','fromFrame':0,'toFrame':30}, {'id':'two','fromFrame':30,'toFrame':60}]})
        self.lock = designlock.load()
        self.lock['formats'].pop('voice-led-pictures', None)
        # Freeze real golden fixtures through designlock, then read the temp lock.
        self.lock_path = self.root / 'config/ve/design-lock.json'
        settings = self.lock['formats']['hand-held-screen']
        settings.pop('keyframes', None)
        write_json(self.lock_path, self.lock)
        src = self.root / 'source'
        src.mkdir()
        Image.new('RGB', (1080,1920), 'white').save(src / 'frame.png')
        self.lock = designlock.freeze('hand-held-screen', src,
                    {beat:'frame.png' for beat in settings['beats']}, lock_path=self.lock_path)
        original_frozen = designlock.frozen
        self.enterContext(patch.object(designlock, 'load', return_value=self.lock))
        self.enterContext(patch.object(designlock, 'frozen', side_effect=lambda lock, fmt: original_frozen(lock, fmt, self.root)))
        self.enterContext(patch.object(ve, 'spec_path_for', return_value=self.spec_file))
        self.enterContext(patch('velib.lint.lint', side_effect=lambda path:(self.spec, [])))

    def save_qc(self):
        write_json(self.directory / 'qc.short.json', self.qc)

    def review(self, findings=None, viewed=(0.5,1.5)):
        return verdict.write(self.spec, 'short', self.directory, 'independent-critic', findings or [], viewed)

    def capture(self, fn, args):
        output = io.StringIO()
        with redirect_stdout(output):
            result = fn(args)
        return result, output.getvalue()

    def status(self):
        return self.capture(ve.cmd_status, Namespace(piece='test-piece'))

    def packet(self, legacy=()):
        write_json(self.spec_file, self.spec)
        return self.capture(ve.cmd_packet, Namespace(piece='test-piece', out=str(self.root/'out'), legacy_ok=legacy))

    def test_verdict_write_refusals(self):
        path = self.directory / 'qc.short.json'
        path.unlink()
        with self.assertRaisesRegex(ValueError, 'no qc'):
            self.review()
        self.save_qc()
        self.qc['sha256'] = '0'*64
        self.save_qc()
        with self.assertRaisesRegex(ValueError, 'different file'):
            self.review()
        self.qc['sha256'] = sha256_file(self.video)
        self.save_qc()
        with self.assertRaisesRegex(ValueError, 'frames_viewed'):
            self.review(viewed=())
        del self.qc['checks']['composition']
        self.save_qc()
        with self.assertRaisesRegex(ValueError, 'composition'):
            self.review()

    def test_verdict_hashes_and_blocking(self):
        value = verdict.read(self.review([{'severity':'block','area':'brand','frame_s':0.5,'text':'Logo missing.'}]))
        self.assertEqual(value['sha256'], sha256_file(self.video))
        self.assertEqual(value['lens_sha256'], sha256_file(ROOT/'config/ve/crew/critic.lens.md'))
        self.assertTrue(value['blocking'])
        self.assertEqual(verdict.validate(value), [])
        for reviewer in ('ve',' VE ', ''):
            with self.assertRaises(ValueError):
                verdict.write(self.spec,'short',self.directory,reviewer,[],[0.5,1.5])

    def test_cli_verdict(self):
        findings = write_json(self.root/'findings.json', [])
        args = Namespace(piece='test-piece',cut='short',reviewer='critic',findings=str(findings),viewed='0.5,1.5')
        self.assertEqual(self.capture(ve.cmd_verdict,args)[0],0)
        args.viewed = ''
        self.assertEqual(self.capture(ve.cmd_verdict,args)[0],1)

    def test_status_no_verdict(self):
        code, text = self.status()
        self.assertEqual(code,1)
        self.assertIn('mechanical: VALID',text)
        self.assertIn('design: NOT APPROVED (no Critic verdict for this file)',text)
        self.assertIn('NOT READY',text)

    def test_status_different_hash_and_block(self):
        path = self.review()
        value = verdict.read(path)
        value['sha256'] = '0'*64
        write_json(path,value)
        self.assertIn('Critic verdict is for a different file', self.status()[1])
        self.review([{'severity':'block','area':'composition','frame_s':0.5,'text':'Focal point missing.'}])
        self.assertIn('Critic blocks: Focal point missing.',self.status()[1])

    def test_status_frozen_and_exact_final(self):
        self.review()
        code,text = self.status()
        self.assertEqual(code,1)
        self.assertIn('design: APPROVED',text)
        self.spec['approvals'] = [{'gate':'final','by':'Krish','artifact_hash':sha256_file(self.video)}]
        self.assertEqual(self.status()[0],0)

    def test_status_legacy_proof(self):
        self.spec['format'] = 'voice-led-pictures'
        self.review()
        self.assertIn('legacy format: needs Krish',self.status()[1])
        self.spec['approvals'] = [{'gate':'proof','by':'Krish','artifact_hash':'0'*64}]
        self.assertIn('legacy format: needs Krish',self.status()[1])
        self.spec['approvals'][0]['artifact_hash'] = sha256_file(self.video)
        self.assertIn('design: APPROVED',self.status()[1])

    def test_beat_coverage_and_stale_lens(self):
        self.review(viewed=(0.5,))
        self.assertIn('Critic did not view every beat',self.status()[1])
        self.assertEqual(self.packet()[0],1)
        path = self.review()
        value = verdict.read(path)
        value['lens_sha256'] = '0'*64
        write_json(path,value)
        self.assertIn('different lens',self.status()[1])
        self.assertEqual(self.packet()[0],1)

    def test_packet_lists_all_reasons_and_writes_nothing(self):
        self.qc['checks']['composition'] = {'pass':False,'findings':['Screen mostly empty.']}
        self.qc['sha256'] = '0'*64
        self.save_qc()
        self.lock['formats']['hand-held-screen']['keyframes'] = {}
        code,text = self.packet()
        self.assertEqual(code,1)
        for reason in ('composition fails: Screen mostly empty.','no Critic verdict for this file',
                       'qc is for a different file','has no frozen design lock'):
            self.assertIn(reason,text)
        self.assertFalse((self.root/'out').exists())

    def test_packet_legacy_still_needs_verdict(self):
        self.spec['format'] = 'voice-led-pictures'
        code,text = self.packet(['short'])
        self.assertEqual(code,1)
        self.assertIn('LEGACY: no design lock',text)
        self.assertIn('no Critic verdict',text)
        self.assertFalse((self.root/'out').exists())

    def test_packet_keyframes_and_unfrozen(self):
        self.review()
        self.qc['checks']['keyframe_match'] = {'pass':False,'findings':['one: ssim 0.2 min 0.8']}
        self.save_qc()
        self.assertIn('keyframe_match fails: one: ssim 0.2 min 0.8',self.packet()[1])
        self.lock['formats']['hand-held-screen']['keyframes'] = {}
        self.assertIn('has no frozen design lock',self.packet()[1])

    def test_a_wide_cut_has_no_golden_rows_and_a_tall_cut_still_needs_them(self):
        na = {'pass': None, 'status': 'not applicable', 'value': None}
        self.qc['checks']['composition'] = dict(na)
        self.qc['checks']['keyframe_match'] = dict(na)
        self.save_qc()
        tall_problems = packet.mechanical(self.spec, 'short', self.directory)[0]
        self.assertTrue(any('keyframe_match fails' in p for p in tall_problems), tall_problems)
        wide = json.loads(json.dumps(self.spec))
        wide['cuts']['short']['aspect'] = '16:9'
        self.assertEqual([p for p in packet.mechanical(wide, 'short', self.directory)[0] if 'fails' in p], [])

    def test_packet_video_success(self):
        if not FFMPEG:
            print('SKIP video steps: pinned ffmpeg is missing')
            self.skipTest('pinned ffmpeg is missing')
        subprocess.run([FFMPEG,'-nostdin','-v','error','-y','-f','lavfi','-i',
                        'color=white:s=90x160:r=30:d=2','-c:v','libx264','-pix_fmt','yuv420p',str(self.video)],
                       check=True,capture_output=True)
        self.qc['sha256'] = sha256_file(self.video)
        self.save_qc()
        findings = [{'severity':severity,'area':'copy','frame_s':0.5,'text':text} for severity,text in
                    [('fix','Increase the producer label.'),('note','The second beat lands clearly.')]]
        self.review(findings)
        with patch.object(packet,'ffmpeg',return_value=FFMPEG):
            code,text = self.packet()
        self.assertEqual(code,0,text)
        out = self.root/'out'
        self.assertEqual(sha256_file(out/'short.mp4'),sha256_file(self.video))
        markdown = (out/'PACKET.md').read_text(encoding='utf-8')
        for finding in findings:
            self.assertIn(finding['text'],markdown)
        for text in (packet.APPROVAL_LINE,'fill_pct: 72','smallest_text_px: 32','ssim: 0.98'):
            self.assertIn(text,markdown)
        with Image.open(out/'contact.short.jpg') as image:
            self.assertEqual(image.size,(1080,960))
        self.assertTrue((out/'qc.short.json').is_file())
        self.assertTrue((out/'verdict.short.json').is_file())


if __name__ == '__main__':
    unittest.main()
