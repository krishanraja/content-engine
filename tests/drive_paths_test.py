"""scripts/drive_paths.py and its readers: runtime folders found by their Drive IDs.

On 11 Nov a rename above the library and music roots broke both home computers,
which found them by path. The library sync now writes drive-paths.json from the
engine's answer (scripts/library-sync.ps1, Write-DrivePaths); music reads it
before its configured path. Fixtures only: nothing reaches Drive.
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
import drive_paths  # noqa: E402
import music  # noqa: E402
from velib import sfx  # noqa: E402


class DrivePathsTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.music = self.dir / 'My Drive' / 'Ventures' / 'Active Ventures' / 'makeyourmindup' / 'Music'
        self.music.mkdir(parents=True)
        self.file = self.dir / 'drive-paths.json'

    def tearDown(self):
        import shutil
        shutil.rmtree(self.dir, ignore_errors=True)

    def write(self, folders, wrap='folders'):
        body = {wrap: folders, 'schema_version': 1} if wrap else folders
        self.file.write_text(json.dumps(body), encoding='utf-8')

    def test_takes_only_a_found_folder_that_is_there(self):
        self.write([
            {'name': 'music_root', 'id': 'm', 'state': 'found', 'path': str(self.music)},
            {'name': 'archive_root', 'id': 'a', 'state': 'not_on_this_machine', 'path': str(self.dir / 'Archive')},
            {'name': 'library_root', 'id': 'l', 'state': 'found', 'path': str(self.dir / 'missing')},
        ])
        self.assertEqual(drive_paths.found_path('music_root', self.file), self.music)
        self.assertIsNone(drive_paths.found_path('archive_root', self.file))
        self.assertIsNone(drive_paths.found_path('library_root', self.file))
        self.assertIsNone(drive_paths.found_path('media_inbox', self.file))

    def test_reads_the_spellings_filearchives_accepts(self):
        self.write([{'name': 'music_root', 'drive_id': 'm', 'state': 'found', 'local_path': str(self.music)}], wrap='entries')
        self.assertEqual(drive_paths.found_path('music_root', self.file), self.music)
        self.write([{'name': 'music_root', 'id': 'm', 'state': 'found', 'path': str(self.music)}], wrap=None)
        self.assertEqual(drive_paths.found_path('music_root', self.file), self.music)

    def test_no_file_or_a_broken_one_gives_none(self):
        self.assertIsNone(drive_paths.found_path('music_root', self.dir / 'none.json'))
        self.file.write_text('{not json', encoding='utf-8')
        self.assertIsNone(drive_paths.found_path('music_root', self.file))
        self.assertIsNone(drive_paths.default_file({'LOCALAPPDATA': ''}) if os.name == 'nt' else drive_paths.default_file({}))
        self.assertEqual(drive_paths.default_file({drive_paths.ENV: str(self.file)}), self.file)

    def test_music_follows_the_rename_its_setting_still_names(self):
        self.write([{'name': 'music_root', 'id': 'm', 'state': 'found', 'path': str(self.music)}])
        stale = str(self.dir / 'My Drive' / 'Ventures' / 'Active' / 'makeyourmindup' / 'Music')
        with patch.dict(os.environ, {'MINDMAKE_MUSIC_ROOT': stale, drive_paths.ENV: str(self.file)}):
            self.assertEqual(music.music_root({}), self.music)
            self.assertEqual(sfx.music_root(), self.music)

    def test_a_setting_that_is_there_wins_and_no_file_changes_nothing(self):
        own = self.dir / 'Own Music'
        own.mkdir()
        self.write([{'name': 'music_root', 'id': 'm', 'state': 'found', 'path': str(self.music)}])
        with patch.dict(os.environ, {'MINDMAKE_MUSIC_ROOT': str(own), drive_paths.ENV: str(self.file)}):
            self.assertEqual(music.music_root({}), own)
            self.assertEqual(sfx.music_root(), own)
        missing = str(self.dir / 'gone')
        with patch.dict(os.environ, {'MINDMAKE_MUSIC_ROOT': missing, drive_paths.ENV: str(self.dir / 'none.json')}):
            self.assertEqual(music.music_root({}), Path(missing))
            self.assertEqual(sfx.music_root(), Path(missing))


if __name__ == '__main__':
    unittest.main()
