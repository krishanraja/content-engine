import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts/quick-edit'))
import continuous_edit as edit


class ContinuousEditTests(unittest.TestCase):
    def test_real_media_many_joins_has_no_cumulative_clock_error(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); src=root/'source.mkv'
            subprocess.run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-i',
                'testsrc2=size=128x72:rate=30:duration=8','-f','lavfi','-i',
                'sine=frequency=440:sample_rate=48000:duration=8','-c:v','libx264','-threads','1',
                '-c:a','pcm_s16le',str(src)],check=True)
            ranges=[(i*.4,i*.4+.3) for i in range(20)]
            receipt=edit.render(src,root/'edited.mkv',ranges)
            self.assertEqual(receipt['clock']['sample_error'],0)
            self.assertEqual(receipt['clock']['video_frames'],175)
            self.assertAlmostEqual(receipt['speech_seconds'],5.81)
            # No intermediate encoded video files exist.
            self.assertEqual(sorted(p.name for p in root.glob('*.mkv')),['edited.mkv','source.mkv'])
            pcm=root/'audio.wav'
            subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(src),'-vn','-c:a','pcm_s16le',str(pcm)],check=True)
            voice=edit.render(pcm,root/'voice-edited.mkv',ranges)
            self.assertEqual(voice['clock']['audio_samples'],278880)
            streams=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(root/'voice-edited.mkv')]))['streams']
            self.assertEqual([s['codec_type'] for s in streams],['audio'])

    def test_words_follow_the_crossfade_clock_and_clips_are_refused(self):
        spans,total=edit.timeline([(0,1),(2,3),(4,5)])
        words=[{'w':'one','s':.2,'e':.5},{'w':'removed','s':1.5,'e':1.7},
               {'w':'two','s':2.2,'e':2.5},{'w':'three','s':4.2,'e':4.5}]
        actual=edit.retime(words,spans)
        self.assertEqual([w['w'] for w in actual],['one','two','three'])
        self.assertEqual([w['s'] for w in actual],[.2,1.19,2.18])
        self.assertEqual(total,2.98)
        with self.assertRaisesRegex(ValueError,'intersects'):
            edit.retime([{'w':'clipped','s':.9,'e':1.1}],spans)
        for invalid in ([],[(1,2),(1.5,3)],[(2,1)],[(-1,2)]):
            with self.assertRaises(ValueError): edit.timeline(invalid)


if __name__=='__main__':unittest.main()
