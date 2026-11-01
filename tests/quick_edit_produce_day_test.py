"""produce_day.py filing: each cut travels with its own hash-bound receipt, the
delivery gates are checked before anything is sent, and making.py video is
given the exact file. Ruling (Krish, 2026-10-28): "record the entire week on a
Sunday, but it does not go live until the Monday after (8 days later)"; the
run is by hand now, and it fails loudly rather than skipping green.
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts/post-pack'))
import produce_day  # noqa: E402

sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
import quality  # noqa: E402
import words_gate  # noqa: E402

CHECKS = ('heard', 'sync', 'loudness', 'visuals', 'full_review')


class FilingTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.work = Path(tmp.name)
        self.cuts = {}
        for cut, shape in produce_day.SHAPE.items():
            (self.work / cut).mkdir()
            video = self.work / cut / f'piece-{shape}.mp4'
            video.write_bytes(f'{cut} cut bytes'.encode())
            self.cuts[cut] = video
        thumbs = self.work / 'thumbs'
        thumbs.mkdir()
        self.thumb = {}
        for cut in self.cuts:
            self.thumb[cut] = thumbs / f'{cut}.jpg'
            self.thumb[cut].write_bytes(b'jpg')

    def receipt(self, video, passing=True, words='pass'):
        report = {'video_sha256': quality.digest(video), 'piece_id': 'p1',
                  'checks': {k: {'status': 'pass' if passing else 'not_run'} for k in CHECKS}}
        report['checks']['words'] = {'machine': words_gate.MACHINE, 'status': words, 'video_sha256': report['video_sha256'],
                                     'lost': [] if words == 'pass' else [{'message': '"Disney" is lost: said at 0:00.30'}],
                                     'reason': None if words == 'pass' else '1 content word(s) ... missing'}
        Path(str(video) + '.validation.json').write_text(json.dumps(report))

    def file(self, sent):
        def fake_run(args, env=None, ok=(0,), what=''):
            sent.append([str(a) for a in args])
        post = {'subject': 'Who pays for AI', 'files': []}
        with patch.object(produce_day, 'run', side_effect=fake_run), \
                patch.object(produce_day.plan_files, 'load_post', return_value=post), \
                patch.object(produce_day.plan_files, 'pack_folder', return_value='2026-11-02 Mon follow.the.money - Who pays for AI'), \
                patch.object(produce_day, 'review_sheet', side_effect=lambda src, out: Path(out).write_bytes(b'png')), \
                patch('visual_clarity.delivery_problems', return_value=[]), patch('media_standard.enforced', return_value=False), \
                patch('quality.motion_problems', return_value=[]), patch('opening_gate.delivery_problems', return_value=[]):
            return produce_day.file_and_record(self.work / 'post.json', 'p1', self.cuts, self.thumb, self.work)

    def test_a_cut_without_its_receipt_cannot_be_filed(self):
        sent = []
        with self.assertRaises(produce_day.Stop) as stop:
            self.file(sent)
        self.assertIn('no validation receipt', str(stop.exception))
        self.assertEqual(sent, [])

    def test_a_held_cut_stops_the_run_naming_every_reason_and_nothing_is_sent(self):
        self.receipt(self.cuts['long'], passing=False)
        self.receipt(self.cuts['short'], words='fail')
        sent = []
        with self.assertRaises(produce_day.Stop) as stop:
            self.file(sent)
        said = str(stop.exception)
        self.assertIn('nothing sent', said)
        self.assertIn('the long cut: heard is not passed; sync is not passed', said)
        self.assertIn('the short cut: words gate is not passed', said)
        self.assertIn('Disney', said)
        self.assertIn('--file-only', said)
        self.assertNotIn('add the review evidence to each receipt', said)
        self.assertIn('the session that watches both cuts at full size records it', said)
        self.assertEqual(sent, [])
        # On GitHub the runner's folder goes with it: the stop says how to fetch the cuts from the run's artifacts.
        with patch.dict(produce_day.os.environ, {'GITHUB_ACTIONS': 'true', 'GITHUB_RUN_ID': '123'}):
            with self.assertRaises(produce_day.Stop) as stop:
                self.file(sent)
        self.assertIn('gh run download 123 -n produce-day-cuts -n produce-day-reports -D .cache/produce', str(stop.exception))
        flow = (ROOT / '.github/workflows/produce-day.yml').read_text(encoding='utf-8')
        self.assertIn('name: produce-day-cuts', flow)

    def test_a_passing_cut_is_sent_with_its_receipt_and_recorded_from_the_exact_file(self):
        for video in self.cuts.values():
            self.receipt(video)
        sent = []
        folder = self.file(sent)
        send, *record = sent
        self.assertIn('scripts/post-pack/send.py', send)
        self.assertEqual(len(record), 2)
        staged = self.work / 'send'
        for cut, command in zip(self.cuts, record):
            name = produce_day.delivery_names(folder, 'Who pays for AI')[cut]
            target = f'3 Posts/{folder}/3 Video/{name}.mp4'
            self.assertIn(target, command)
            self.assertEqual(command[command.index('--video-file') + 1], str(staged / f'{name}.mp4'))
            receipt = json.loads((staged / f'{name}.mp4.validation.json').read_text())
            # The receipt names where the cut goes and is still bound to the same bytes.
            self.assertEqual(receipt['library_path'], target)
            self.assertEqual(receipt['video_sha256'], quality.digest(staged / f'{name}.mp4'))

    def test_names_leave_room_for_the_receipt_beside_the_cut(self):
        limit = produce_day.library.PATH_MAX
        folder = '2026-11-02 Mon follow.the.money - Who pays'
        # A subject whose cut path fits but whose receipt path would not: the names drop the subject.
        fixed = len(f'3 Posts/{folder}/3 Video/') + len(' - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4')
        subject = 'y' * (limit - fixed - 5)
        self.assertLessEqual(len(f'3 Posts/{folder}/3 Video/{subject} - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4'), limit)
        names = produce_day.delivery_names(folder, subject)
        self.assertEqual(names['short'], 'tall 9x16 - Shorts, Reels, TikTok, LinkedIn')
        for name in names.values():
            self.assertLessEqual(len(f'3 Posts/{folder}/3 Video/{name}.mp4.validation.json'), limit)
        self.assertTrue(produce_day.delivery_names(folder, 'Who pays')['long'].startswith('Who pays - wide 16x9'))
        # The media-quality binding is filed beside the cut too, 3 characters longer than the receipt: Monday 26's
        # folder with a 31-character subject kept the full names and its binding's path ran to 181 (over 180), so
        # send.py refused the whole send.
        folder = '2026-10-26 Mon follow.the.money - Disney, Google and Character.AI'
        subject = 'Disney, Google and Character.AI'
        self.assertEqual(len(subject), 31)
        for name in produce_day.delivery_names(folder, subject).values():
            for beside in ('.mp4', '.jpg', '.mp4.validation.json', '.mp4.media-quality.json'):
                path = f'3 Posts/{folder}/3 Video/{name}{beside}'
                self.assertIsNone(produce_day.library.refusal(path), path)

    def test_file_only_finds_the_cuts_made_here(self):
        self.assertEqual(produce_day.made_cuts(self.work), self.cuts)
        self.cuts['short'].unlink()
        with self.assertRaises(produce_day.Stop):
            produce_day.made_cuts(self.work)


class ScheduleTests(unittest.TestCase):
    def test_the_noon_schedule_is_gone_and_the_button_stays(self):
        flow = (ROOT / '.github/workflows/produce-day.yml').read_text(encoding='utf-8')
        on = flow[flow.index('\non:'):flow.index('\nconcurrency:')]
        self.assertNotIn('\n  schedule:', on)
        self.assertNotIn('cron:', flow)
        self.assertIn('workflow_dispatch', on)
        self.assertNotIn('Not noon in New York', flow)


if __name__ == '__main__':
    unittest.main()
