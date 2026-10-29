"""One local layout (Wave 2, W2.11): config/studio.json local_roots is the only place the home computers' folders are
written; velib/common.py, cards.py (ve card and ensure_worktree) and ve-env.sh resolve from it, and
scripts/check_local_paths.py fails on a planted hard-coded path. Synthetic paths only."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import cards, common  # noqa: E402
import check_local_paths as guard  # noqa: E402

# Built in pieces so this file never carries the path it plants (the guard scans tests too).
DEV = 'C:' + '/Users/' + 'krish' + '/dev'
SPELLINGS = [DEV + '/mindmake/toolchain', DEV.replace('/', '\\') + '\\makeyourmindup\\x',
             DEV.replace('/', '\\\\') + '\\\\makeyourmindup', '/c/Users/' + 'krish/dev/mindmake', 'c:/users/' + 'KRISH/Dev/x']
ENV = ('MINDMAKE_LOCAL_REPOS', 'MINDMAKE_LOCAL_WORKTREES', 'MINDMAKE_LOCAL_RUNTIME', 'VE_TOOLCHAIN')


def plant(root: Path, rel: str, text: str) -> str:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')
    return rel


class TheGuardFailsOnAPlantedPath(unittest.TestCase):
    def test_every_spelling_in_code_is_found(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for n, spelling in enumerate(SPELLINGS):
                for suffix in ('py', 'ts', 'sh', 'ps1', 'json', 'yml'):
                    rel = plant(root, f'scripts/planted_{n}.{suffix}', f'x = "{spelling}"\n')
                    found = guard.scan(root, [rel])
                    self.assertEqual(len(found), 1, f'{spelling} in .{suffix} was not refused')

    def test_docs_markdown_the_config_and_vendor_are_allowed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            files = [plant(root, rel, f'"{SPELLINGS[0]}"\n') for rel in
                     ('AGENTS.md', 'docs/DRIVE.md', 'docs/plans/2026-10-26-monday/receipt.json', 'config/studio.json',
                      'vendor/makeyourmindup/kill-list/x.mjs', '.agents/skills/produce-video/SKILL.md')]
            files.append(plant(root, 'scripts/clean.py', 'ROOT = local_root("repos")\n'))
            self.assertEqual(guard.scan(root, files), [])

    def test_lookalikes_are_not_findings(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            rel = plant(root, 'scripts/near.ts', "const a = 'C:/Users/someone/dev'; const b = '/c/Users/krish/devices'\n"
                                                  "const c = 'C:\\\\Users\\\\Krish\\\\raw.mov'\n")
            self.assertEqual(guard.scan(root, [rel]), [])

    def test_the_repository_itself_is_clean(self):
        self.assertEqual(guard.scan(ROOT), [])

    def test_the_readers_carry_no_path(self):
        readers = ['scripts/velib/common.py', 'scripts/velib/cards.py', 'scripts/ve-env.sh', 'scripts/overnight/preflight.ps1']
        self.assertEqual(guard.scan(ROOT, readers), [])
        for rel in readers:
            self.assertIn('local_root', (ROOT / rel).read_text(encoding='utf-8'), f'{rel} does not read local_roots')


class EveryReaderResolvesFromConfig(unittest.TestCase):
    def studio(self, temp: Path, **roots) -> Path:
        base = {'repos': 'D:\\work\\{repo}', 'worktrees': 'D:\\work\\.worktrees\\{repo}\\{branch}',
                'runtime': '%LOCALAPPDATA%\\makeyourmindup\\', 'toolchain': 'D:\\tools'}
        base.update(roots)
        path = temp / 'studio.json'
        path.write_text(json.dumps({'local_roots': base}), encoding='utf-8')
        return path

    def test_an_absent_key_falls_back_beside_the_checkout_with_no_typed_path(self):
        with tempfile.TemporaryDirectory() as temp:
            studio = Path(temp) / 'studio.json'
            studio.write_text('{}', encoding='utf-8')
            parent = str(common.main_checkout().parent)
            env = {'LOCALAPPDATA': 'E:\\Local'}
            self.assertEqual(common.local_roots(studio), {})
            self.assertEqual(common.local_root('repos', 'content-watcher', environ=env, studio=studio), parent + '\\content-watcher')
            self.assertEqual(common.local_root('worktrees', branch='b/c', environ=env, studio=studio),
                             parent + '\\.worktrees\\content-engine\\b\\c')
            self.assertEqual(common.local_root('runtime', environ=env, studio=studio), 'E:\\Local\\makeyourmindup\\')
            self.assertEqual(common.local_root('toolchain', environ=env, studio=studio), parent + '\\toolchain')

    def test_the_main_checkout_is_found_from_a_worktree(self):
        self.assertTrue((common.main_checkout() / '.git').exists())

    def test_templates_fill_and_expand(self):
        with tempfile.TemporaryDirectory() as temp:
            studio = self.studio(Path(temp))
            env = {'LOCALAPPDATA': 'E:\\Local'}
            self.assertEqual(common.local_root('repos', 'growth-makeyourmindup', environ=env, studio=studio), 'D:\\work\\growth-makeyourmindup')
            self.assertEqual(common.local_root('worktrees', branch='ve-card/x-1', environ=env, studio=studio),
                             'D:\\work\\.worktrees\\content-engine\\ve-card\\x-1')
            self.assertEqual(common.local_root('runtime', environ=env, studio=studio), 'E:\\Local\\makeyourmindup\\')
            with self.assertRaises(ValueError):
                common.local_root('worktrees', environ=env, studio=studio)
            with self.assertRaises(ValueError):
                common.local_root('elsewhere', environ=env, studio=studio)

    def test_an_environment_override_wins(self):
        with tempfile.TemporaryDirectory() as temp:
            studio = self.studio(Path(temp))
            env = {'MINDMAKE_LOCAL_WORKTREES': '/srv/wt', 'MINDMAKE_LOCAL_REPOS': '/srv/{repo}-checkout', 'VE_TOOLCHAIN': '/opt/tc'}
            self.assertEqual(common.local_root('worktrees', branch='b', environ=env, studio=studio), '/srv/wt\\content-engine\\b')
            self.assertEqual(common.local_root('repos', 'x', environ=env, studio=studio), '/srv/x-checkout')
            self.assertEqual(common.local_root('toolchain', environ=env, studio=studio), '/opt/tc')
            if sys.platform != 'win32':
                self.assertEqual(str(common.native_path('/srv/wt\\content-engine\\b')), '/srv/wt/content-engine/b')

    def test_a_malformed_root_is_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'studio.json'
            path.write_text(json.dumps({'local_roots': {'repos': 7}}), encoding='utf-8')
            with self.assertRaises(ValueError):
                common.local_root('repos', studio=path)
            path.write_text(json.dumps({'local_roots': ['x']}), encoding='utf-8')
            with self.assertRaises(ValueError):
                common.local_root('repos', studio=path)

    def test_shell_form(self):
        self.assertEqual(common.shell_path('D:\\tools\\tc'), '/d/tools/tc')
        self.assertEqual(common.shell_path('/opt/tc'), '/opt/tc')

    def test_ve_card_fills_cwd_from_the_layout(self):
        with tempfile.TemporaryDirectory() as temp:
            fields = Path(temp) / 'fields.json'
            card = Path(temp) / 'card.md'
            fields.write_text(json.dumps({'path': str(card), 'card_id': 'w-1', 'kind': 'device', 'title': 't', 'goal': 'g',
                                          'contract': 'c', 'acceptance': 'python tests/x.py', 'write_allow': '[a/*]',
                                          'read': 'a'}), encoding='utf-8')
            env = {**os.environ, 'MINDMAKE_LOCAL_WORKTREES': temp, 'PYTHONIOENCODING': 'utf-8'}
            got = subprocess.run([sys.executable, 'scripts/ve.py', 'card', str(fields)], cwd=ROOT, env=env, capture_output=True, text=True)
            self.assertEqual(got.returncode, 0, got.stdout + got.stderr)
            meta = cards.parse_card(card)
            self.assertTrue(meta['cwd'].startswith(temp))
            self.assertTrue(meta['cwd'].endswith('content-engine\\ve-card\\w-1'))

    def test_ensure_worktree_refuses_a_typed_path_and_makes_nothing(self):
        with tempfile.TemporaryDirectory() as temp, mock.patch.dict(os.environ, {'MINDMAKE_LOCAL_WORKTREES': temp}), \
                mock.patch.object(cards.subprocess, 'run') as run:
            with self.assertRaises(SystemExit) as stop:
                cards.ensure_worktree(Path(temp) / 'somewhere-else' / 'w-2', 'w-2')
            self.assertIn('local_roots.worktrees', str(stop.exception))
            run.assert_not_called()
            existing = Path(temp) / 'existing'
            existing.mkdir()
            cards.ensure_worktree(existing, 'w-3')  # an existing worktree is used where it is
            run.assert_not_called()

    def test_ensure_worktree_makes_the_configured_one(self):
        with tempfile.TemporaryDirectory() as temp, mock.patch.dict(os.environ, {'MINDMAKE_LOCAL_WORKTREES': temp}), \
                mock.patch.object(cards.subprocess, 'run') as run, mock.patch.object(cards.os, 'symlink'):
            target = common.native_path(cards.card_worktree('w-4'))
            cards.ensure_worktree(target, 'w-4')
            added = [call.args[0] for call in run.call_args_list if call.args[0][:3] == ['git', 'worktree', 'add']]
            self.assertEqual(len(added), 1)
            self.assertEqual(added[0][-2], str(target))
            self.assertEqual(added[0][5], 've-card/w-4')

    @unittest.skipIf(sys.platform == 'win32' and not os.environ.get('BASH'), 'needs bash')
    def test_ve_env_sh_reads_the_toolchain_from_the_config(self):
        script = '. scripts/ve-env.sh; printf %s "$TOOLCHAIN"'
        clean = {k: v for k, v in os.environ.items() if k not in ENV}
        got = subprocess.run(['bash', '-c', script], cwd=ROOT, env=clean, capture_output=True, text=True)
        self.assertEqual(got.returncode, 0, got.stderr)
        self.assertEqual(got.stdout, common.shell_path(common.local_root('toolchain', environ=clean)))
        got = subprocess.run(['bash', '-c', script], cwd=ROOT, env={**clean, 'VE_TOOLCHAIN': '/opt/tc'}, capture_output=True, text=True)
        self.assertEqual(got.stdout, '/opt/tc')


if __name__ == '__main__':
    unittest.main()
