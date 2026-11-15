"""HyperFrames as kit's opt-in film backend (scripts/quick-edit/hyperframes_film.py; docs/production/HYPERFRAMES.md).

The unit tests need no browser and no install. The one render test runs only where the pinned CLI is installed
(`npm ci --prefix vendor/hyperframes`), with ffmpeg, Playwright for Python and the house fonts; anywhere else it skips.
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))

import hyperframes_film as hf  # noqa: E402
import kit  # noqa: E402

PAGE = '<!doctype html><html><head><style>body{background:#0C1512}</style></head><body class="tall">\n<div class="ec">x</div>\n</body></html>'


class Wrap(unittest.TestCase):
    def test_body_goes_into_one_root_with_its_length_size_and_background(self):
        out = hf.wrap(PAGE, (1080, 1920), 2, 'rgb(12, 21, 18)')
        self.assertIn('<body class="tall"><div id="kit-page" data-composition-id="kit-page" data-start="0" data-duration="2" '
                      'data-width="1080" data-height="1920" ', out)
        self.assertIn('width:1080px;height:1920px;background:rgb(12, 21, 18)">', out)
        self.assertTrue(out.endswith('<div class="ec">x</div>\n</div></body></html>'))
        self.assertEqual(out.count('data-composition-id'), 1)

    def test_fractional_lengths_are_written_plainly(self):
        self.assertIn('data-duration="1.5"', hf.wrap(PAGE, (1920, 1080), 1.5))

    def test_a_page_with_no_body_is_refused(self):
        with self.assertRaises(ValueError):
            hf.wrap('<div>no body</div>', (10, 10), 1)


class Environment(unittest.TestCase):
    def test_telemetry_is_forced_off_whatever_the_caller_set(self):
        env = hf.hf_env({'HYPERFRAMES_NO_TELEMETRY': '0', 'DO_NOT_TRACK': '0', 'PATH': '/bin'})
        self.assertEqual((env['HYPERFRAMES_NO_TELEMETRY'], env['DO_NOT_TRACK'], env['PATH']), ('1', '1', '/bin'))

    def test_no_secret_of_the_session_reaches_the_cli(self):
        env = hf.hf_env({'PATH': '/bin', 'HOME': '/root', 'ENGINE_OPERATOR_TOKEN': 'x', 'SUPABASE_SERVICE_ROLE_KEY': 'x',
                         'HYPERFRAMES_AUDIO_API_KEY': 'x', 'HYPERFRAMES_FFMPEG_PATH': '/usr/bin/ffmpeg'})
        self.assertLessEqual(set(env) - set(hf.NO_TELEMETRY) - {'HYPERFRAMES_BROWSER_PATH'}, set(hf.PASS_ENV))
        self.assertEqual((env['HOME'], env['HYPERFRAMES_FFMPEG_PATH']), ('/root', '/usr/bin/ffmpeg'))
        for secret in ('ENGINE_OPERATOR_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'HYPERFRAMES_AUDIO_API_KEY'):
            self.assertNotIn(secret, env)

    def test_browser_order_is_explicit_then_headless_shell_then_kits_browser(self):
        with tempfile.TemporaryDirectory() as tmp:
            explicit, shell, mine = (Path(tmp) / n for n in ('explicit', 'shell-dir', 'mine'))
            explicit.write_text('x')
            mine.write_text('x')
            shell.mkdir()
            (shell / 'chrome-headless-shell').write_text('x')
            with mock.patch.object(hf, 'HEADLESS_SHELLS', str(shell / 'chrome-headless-shell')):
                self.assertEqual(hf.browser_path({'HYPERFRAMES_BROWSER_PATH': str(explicit), 'MYMU_BROWSER': str(mine)}), str(explicit))
                self.assertEqual(hf.browser_path({'MYMU_BROWSER': str(mine)}), str(shell / 'chrome-headless-shell'))
            with mock.patch.object(hf, 'HEADLESS_SHELLS', str(Path(tmp) / 'none' / '*')):
                self.assertEqual(hf.browser_path({'MYMU_BROWSER': str(mine)}), str(mine))
                self.assertIsNone(hf.browser_path({'MYMU_BROWSER': 'msedge'}))  # a channel word, not a file
                self.assertIsNone(hf.browser_path({}))


class Frames(unittest.TestCase):
    def test_a_contiguous_sequence_becomes_an_ffmpeg_pattern_with_its_first_number(self):
        with tempfile.TemporaryDirectory() as tmp:
            for i in range(1, 4):
                (Path(tmp) / f'frame_{i:06d}.png').write_bytes(b'')
            pattern, first, count = hf.frame_pattern(tmp)
            self.assertEqual((pattern.name, first, count), ('frame_%06d.png', 1, 3))

    def test_gaps_and_empty_folders_are_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                hf.frame_pattern(tmp)
            for i in (1, 3):
                (Path(tmp) / f'frame_{i:06d}.png').write_bytes(b'')
            with self.assertRaises(ValueError):
                hf.frame_pattern(tmp)

    def test_render_without_the_pinned_cli_names_the_install(self):
        with mock.patch.object(hf, 'bin_path', return_value=None):
            with self.assertRaises(RuntimeError) as e:
                hf.render('page', 'frames')
        self.assertIn('npm ci --prefix vendor/hyperframes', str(e.exception))


class Command(unittest.TestCase):
    """The command the adapter runs, with Popen stood in: `render` and nothing else, and every way out of it."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.chrome = self.dir / 'chrome'
        self.chrome.write_text('x')
        self.frames = self.dir / 'frames'
        self.frames.mkdir()
        for i in range(1, 3):
            (self.frames / f'frame_{i:06d}.png').write_bytes(b'')
        self.environ = {'PATH': '/bin', 'HYPERFRAMES_BROWSER_PATH': str(self.chrome), 'ENGINE_OPERATOR_TOKEN': 'x'}

    def tearDown(self):
        self.tmp.cleanup()

    def popen(self, returncode=0, communicate=('', '')):
        proc = mock.Mock(pid=12345, returncode=returncode)
        proc.communicate = mock.Mock(side_effect=communicate if isinstance(communicate, list) else [communicate])
        return mock.patch.object(hf.subprocess, 'Popen', return_value=proc), proc

    def test_only_the_render_verb_runs_with_telemetry_off_and_no_secrets(self):
        patch, _ = self.popen()
        with patch as popen:
            pattern, first, count = hf.render('page', self.frames, binary='hf', environ=self.environ)
        cmd, kw = popen.call_args.args[0], popen.call_args.kwargs
        self.assertEqual(cmd[:2], ['hf', 'render'])
        self.assertEqual(cmd[cmd.index('--format') + 1], 'png-sequence')
        self.assertFalse({'publish', 'share', 'cloud', '--docker'} & set(cmd))
        self.assertEqual((kw['env']['HYPERFRAMES_NO_TELEMETRY'], kw['env']['DO_NOT_TRACK']), ('1', '1'))
        self.assertNotIn('ENGINE_OPERATOR_TOKEN', kw['env'])
        self.assertEqual((pattern.name, first, count), ('frame_%06d.png', 1, 2))

    def test_no_browser_stops_before_the_cli_can_download_one(self):
        with mock.patch.object(hf, 'HEADLESS_SHELLS', str(self.dir / 'none' / '*')), mock.patch.object(hf.subprocess, 'Popen') as popen:
            with self.assertRaises(RuntimeError) as e:
                hf.render('page', self.frames, binary='hf', environ={'PATH': '/bin'})
        self.assertIn('HYPERFRAMES_BROWSER_PATH', str(e.exception))
        popen.assert_not_called()

    def test_a_failed_render_says_why(self):
        patch, _ = self.popen(returncode=1, communicate=('', 'line one\nChrome crashed'))
        with patch, self.assertRaises(RuntimeError) as e:
            hf.render('page', self.frames, binary='hf', environ=self.environ)
        self.assertIn('exit 1', str(e.exception))
        self.assertIn('Chrome crashed', str(e.exception))

    def test_a_render_past_its_time_is_stopped_with_everything_it_started(self):
        patch, proc = self.popen(communicate=[subprocess.TimeoutExpired('hf', 1)])
        with patch, mock.patch.object(hf, '_kill_tree') as kill, self.assertRaises(RuntimeError) as e:
            hf.render('page', self.frames, binary='hf', environ=self.environ, timeout=1)
        kill.assert_called_once_with(proc)
        self.assertIn('longer than 1 s', str(e.exception))


class _Page:
    """Just enough of a Playwright page for HyperFramesDrawer.film to reach the render."""

    def set_viewport_size(self, _):
        pass

    def set_content(self, *_, **__):
        pass

    def evaluate(self, js, *_):
        if js == kit.CHECK_JS:
            return []
        if 'outerHTML' in js:
            return '<!doctype html><html><body><p>x</p></body></html>'
        if 'backgroundColor' in js:
            return 'rgb(12, 21, 18)'
        return True


class FilmFailures(unittest.TestCase):
    def test_every_way_the_render_can_fail_reaches_kits_caller_as_a_kit_error(self):
        d = hf.HyperFramesDrawer(kit)
        d._base = mock.Mock(page=mock.Mock(return_value=_Page()))
        for err in (RuntimeError('render failed'), ValueError('gaps'), OSError(8, 'Exec format error')):
            with self.subTest(err=type(err).__name__), mock.patch.object(hf, 'render', side_effect=err):
                with self.assertRaises(kit.KitError) as e:
                    d.film('<html><body></body></html>', (1080, 1920), 'end.mp4', 2)
                self.assertTrue(str(e.exception).startswith('end.mp4: '))

    def test_a_short_sequence_is_refused(self):
        d = hf.HyperFramesDrawer(kit)
        d._base = mock.Mock(page=mock.Mock(return_value=_Page()))
        with mock.patch.object(hf, 'render', return_value=(Path('f%06d.png'), 1, 59)), mock.patch.object(kit, 'encode_frames') as enc:
            with self.assertRaises(kit.KitError) as e:
                d.film('<html><body></body></html>', (1080, 1920), 'end.mp4', 2)
        self.assertIn('59 frames, 60 wanted', str(e.exception))
        enc.assert_not_called()


class Pin(unittest.TestCase):
    def test_the_cli_is_pinned_exactly_and_outside_the_root_workspaces(self):
        pkg = json.loads((ROOT / 'vendor' / 'hyperframes' / 'package.json').read_text(encoding='utf-8'))
        self.assertEqual(pkg['dependencies'], {'hyperframes': hf.VERSION})
        self.assertTrue((ROOT / 'vendor' / 'hyperframes' / 'package-lock.json').exists())
        root = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
        self.assertFalse(any(w.startswith('vendor') for w in root.get('workspaces', [])))
        self.assertNotIn('hyperframes', {**root.get('dependencies', {}), **root.get('devDependencies', {})})

    def test_install_scripts_are_off(self):
        self.assertIn('ignore-scripts=true', (ROOT / 'vendor' / 'hyperframes' / '.npmrc').read_text(encoding='utf-8').splitlines())


class Choice(unittest.TestCase):
    def test_playwright_films_unless_asked(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop(kit.FILM_ENV, None)
            d = kit.default_drawer()
        self.assertIsInstance(d, kit.Drawer)
        self.assertFalse(hasattr(d, 'film_tag'))  # so a kit filmed before this change is still "kept", not filmed again

    def test_hyperframes_when_asked_and_its_clips_carry_their_tag(self):
        with mock.patch.dict(os.environ, {kit.FILM_ENV: 'HyperFrames'}):
            d = kit.default_drawer()
        self.assertIsInstance(d, hf.HyperFramesDrawer)
        self.assertEqual(d.film_tag, ':hyperframes')
        self.assertIs(d.kit, kit)

    def test_an_unknown_backend_stops_the_run(self):
        with mock.patch.dict(os.environ, {kit.FILM_ENV: 'remotion'}):
            with self.assertRaises(kit.KitError):
                kit.default_drawer()


def _can_render():
    if os.environ.get('CI'):
        return 'CI installs neither the pinned CLI nor a browser for this'
    if not hf.bin_path():
        return 'the pinned CLI is not installed (npm ci --prefix vendor/hyperframes)'
    if not (shutil.which('ffmpeg') and shutil.which('ffprobe')):
        return 'ffmpeg is not on the PATH'
    # find_spec, never an import line: scripts/verify-quick.mjs sends a test that imports Playwright to the browser job,
    # and the unit tests above must run in the quick job.
    if importlib.util.find_spec('playwright') is None:
        return 'Playwright for Python is not installed'
    if not (ROOT / 'node_modules' / '@fontsource' / 'anton').exists():
        return 'the house fonts are not installed (npm ci)'
    return None


@unittest.skipIf(_can_render(), _can_render() or '')
class RealRender(unittest.TestCase):
    def test_the_tall_end_card_films_to_kits_own_streams(self):
        st = kit.style_for('follow_the_money', '2026-11-16')
        dot = kit.png_uri(__import__('PIL.Image', fromlist=['Image']).new('RGB', (322, 99), (126, 240, 192)))
        doc = kit.page_endcard(st, '9x16', dot, kit.brand.font_css())
        d = hf.HyperFramesDrawer(kit)
        try:
            with tempfile.TemporaryDirectory() as tmp:
                mp4 = Path(tmp) / 'end.mp4'
                self.assertEqual(d.film(doc, kit.FRAME['9x16'], mp4, 2), [])
                probe = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                                        'stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_read_frames,sample_rate,channels',
                                        '-of', 'json', str(mp4)], capture_output=True, text=True, check=True)
                video, audio = json.loads(probe.stdout)['streams']
                self.assertEqual((video['codec_name'], video['pix_fmt'], video['width'], video['height'], video['r_frame_rate'],
                                  video['nb_read_frames']), ('h264', 'yuv420p', 1080, 1920, '30/1', '60'))
                self.assertEqual((audio['codec_name'], audio['sample_rate'], audio['channels']), ('aac', '48000', 2))
        finally:
            d.close()


if __name__ == '__main__':
    unittest.main()
