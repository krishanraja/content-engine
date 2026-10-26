"""Real-media regressions for the continuous speed-up, including voiceovers."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/quick-edit'))
import episode


class EpisodeSpeedTests(unittest.TestCase):
    def test_continuous_audio_and_camera_sources_keep_pitch_and_duration(self):
        import numpy as np
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for camera in (False, True):
                with self.subTest(camera=camera):
                    src = root / ('camera.mkv' if camera else 'voice.wav')
                    args = ['ffmpeg', '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2.24:sample_rate=48000']
                    if camera:
                        args += ['-f', 'lavfi', '-i', 'testsrc2=size=128x72:rate=30:duration=2.24', '-c:v', 'libx264', '-threads', '1']
                    subprocess.run(args + ['-c:a', 'pcm_s16le', str(src)], check=True)
                    out = episode.sped_source(src, root/'sped', 1.12)
                    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(out)]))
                    self.assertEqual(any(s['codec_type']=='video' for s in info['streams']), camera)
                    pcm = subprocess.check_output(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(out), '-map', '0:a', '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'])
                    samples = np.frombuffer(pcm, dtype='<f4')
                    self.assertLess(abs(len(samples)/48000 - 2.0), .04)
                    # Pitch stays at 440 Hz, rather than rising to 492.8 Hz.
                    middle = samples[12000:60000]
                    frequency = np.fft.rfftfreq(len(middle), 1/48000)[np.argmax(abs(np.fft.rfft(middle)))]
                    self.assertLess(abs(frequency-440), 2)
                    if camera:
                        self.assertLess(abs(float(info['format']['duration']) - len(samples)/48000), .04)
                    before = out.stat().st_mtime_ns
                    self.assertEqual(episode.sped_source(src, root/'sped', 1.12), out)
                    self.assertEqual(out.stat().st_mtime_ns, before)

    def test_silent_video_is_rejected_before_render(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = root/'silent.mkv'
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-f', 'lavfi', '-i',
                'color=size=64x64:rate=30:duration=0.2', '-c:v', 'libx264', '-threads', '1', str(src)], check=True)
            with self.assertRaisesRegex(episode.EpisodeError, 'no audio'):
                episode.sped_source(src, root/'sped', 1.12)


if __name__ == '__main__':
    unittest.main()
