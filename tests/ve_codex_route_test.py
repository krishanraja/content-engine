"""The command ve dispatch starts Codex with (scripts/velib/codex_route.py). From 16:24 UTC on 15 Nov every lane build on
his PC failed before Codex started ("failed to initialize sqlite state runtime under /mnt/c/Users/krish/.codex"): the
lane builds in WSL and ran the Linux codex against his Windows home. These tests simulate WSL (wslpath, cmd.exe /c
where) and never start node or Codex."""
import subprocess
import sys
import unittest
import unittest.mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import cards, codex_route  # noqa: E402

SCRIPT = '/home/krish/dev/content-engine/scripts/codex_thread.mjs'
WT = '/home/krish/worktrees/content-engine/ve-card/fri-plates'
PROMPT = '/home/krish/dev/content-engine/.cache/ve-dispatch/fri-plates.prompt.md'
WIN_HOME = '/mnt/c/Users/krish/.codex'
OPTIONS = ['--cwd', WT, '--sandbox', 'workspace-write', '--model', 'm', '--effort', 'medium', '--prompt-file', PROMPT]


def to_windows(path: str) -> str:
    if path.startswith('/mnt/c/'):
        return 'C:\\' + path[len('/mnt/c/'):].replace('/', '\\')
    return '\\\\wsl.localhost\\Ubuntu' + path.replace('/', '\\')


class FakeWsl:
    """wslpath and cmd.exe as WSL answers them; records every call."""

    def __init__(self, node=('C:\\Program Files\\nodejs\\node.exe',), codex=('C:\\Users\\krish\\AppData\\Roaming\\npm\\codex.cmd', 'C:\\Program Files\\Codex\\codex.exe'),
                 interop=True):
        self.node, self.codex, self.interop, self.calls = list(node), list(codex), interop, []

    def __call__(self, args, **kw):
        self.calls.append(args)
        if not self.interop and args[0] == 'cmd.exe':
            raise FileNotFoundError(2, 'No such file or directory', 'cmd.exe')
        if args[0] == 'wslpath':
            flag, path = args[1], args[2]
            if flag == '-w':
                out = to_windows(path)
            else:
                out = '/mnt/c/' + path[3:].replace('\\', '/')
            return subprocess.CompletedProcess(args, 0, out + '\n', '')
        if args[:3] == ['cmd.exe', '/c', 'where']:
            found = {'node': self.node, 'codex': self.codex}[args[3]]
            if not found:
                return subprocess.CompletedProcess(args, 1, '', 'INFO: Could not find files for the given pattern(s).\r\n')
            return subprocess.CompletedProcess(args, 0, ''.join(f + '\r\n' for f in found), '')
        raise AssertionError(f'unexpected command {args}')


def no_codex(_name):
    return None


class RouteChoiceTest(unittest.TestCase):
    def test_a_windows_home_seen_from_wsl_is_a_mnt_drive_path(self):
        self.assertTrue(codex_route.is_windows_home('/mnt/c/Users/krish/.codex'))
        self.assertTrue(codex_route.is_windows_home('/mnt/d'))
        self.assertFalse(codex_route.is_windows_home('/home/krish/.codex'))
        self.assertFalse(codex_route.is_windows_home('/mnt/wsl/x'))

    def test_the_route_follows_the_platform_and_the_home(self):
        self.assertEqual(codex_route.route(WIN_HOME, platform='linux', wsl=True), 'wsl-windows')
        self.assertEqual(codex_route.route('/home/krish/.codex', platform='linux', wsl=True), 'linux')
        self.assertEqual(codex_route.route(WIN_HOME, platform='linux', wsl=False), 'linux')
        self.assertEqual(codex_route.route('C:\\Users\\krish\\.codex', platform='win32', wsl=False), 'windows')


class WslWindowsHomeTest(unittest.TestCase):
    def test_wsl_with_a_windows_home_runs_windows_node_with_windows_paths(self):
        fake = FakeWsl()
        argv, chosen, extra = codex_route.thread_command(SCRIPT, 'open', [*OPTIONS, '--home', WIN_HOME], WIN_HOME,
                                                         platform='linux', wsl=True, run=fake, which=no_codex)
        self.assertEqual(chosen, 'wsl-windows')
        self.assertEqual(argv, [
            '/mnt/c/Program Files/nodejs/node.exe',
            'C:\\Users\\krish\\.ve-codex\\codex_thread.mjs', 'open',
            '--cwd', '\\\\wsl.localhost\\Ubuntu\\home\\krish\\worktrees\\content-engine\\ve-card\\fri-plates',
            '--sandbox', 'workspace-write', '--model', 'm', '--effort', 'medium',
            '--prompt-file', '\\\\wsl.localhost\\Ubuntu\\home\\krish\\dev\\content-engine\\.cache\\ve-dispatch\\fri-plates.prompt.md',
            '--home', 'C:\\Users\\krish\\.codex'])
        # Never the Linux codex, and never a /mnt path handed to Windows.
        self.assertNotIn('codex', argv)
        self.assertNotEqual(argv[0], 'node')
        self.assertFalse(any(a.startswith('/mnt/') for a in argv[1:]))
        # codex_thread.mjs runs unchanged from a Windows drive, and codex.exe (never the npm .cmd shim) is first on PATH.
        self.assertEqual(extra['stage'], (SCRIPT, '/mnt/c/Users/krish/.ve-codex/codex_thread.mjs'))
        self.assertEqual(extra['codex'], 'C:\\Program Files\\Codex\\codex.exe')
        self.assertEqual(extra['path'], '/mnt/c/Program Files/Codex')
        env = codex_route.environ_for(chosen, {'CODEX_HOME': WIN_HOME, 'PATH': '/usr/bin'}, extra)
        self.assertEqual(env, {'PATH': '/mnt/c/Program Files/Codex:/usr/bin'})

    def test_the_staged_script_is_the_same_bytes(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp) / 'Users' / 'krish' / '.codex'
            target = codex_route.stage(ROOT / 'scripts' / 'codex_thread.mjs', home)
            self.assertEqual(target, Path(tmp) / 'Users' / 'krish' / '.ve-codex' / 'codex_thread.mjs')
            self.assertEqual(target.read_bytes(), (ROOT / 'scripts' / 'codex_thread.mjs').read_bytes())

    def test_a_background_card_keeps_its_flags_and_its_log_goes_over_in_windows_form(self):
        argv, _, _ = codex_route.thread_command(SCRIPT, 'open', [*OPTIONS, '--detach', '--log', '/home/krish/dev/content-engine/.ve-work/dispatch/x.log',
                                                              '--home', WIN_HOME], WIN_HOME,
                                             platform='linux', wsl=True, run=FakeWsl(), which=no_codex)
        self.assertIn('--detach', argv)
        log = argv[argv.index('--log') + 1]
        self.assertEqual(log, '\\\\wsl.localhost\\Ubuntu\\home\\krish\\dev\\content-engine\\.ve-work\\dispatch\\x.log')

    def test_only_the_npm_shim_is_refused_with_its_fix(self):
        fake = FakeWsl(codex=('C:\\Users\\krish\\AppData\\Roaming\\npm\\codex.cmd',))
        with self.assertRaises(codex_route.RouteError) as stop:
            codex_route.thread_command(SCRIPT, 'open', ['--home', WIN_HOME], WIN_HOME,
                                       platform='linux', wsl=True, run=fake, which=no_codex)
        self.assertIn('codex.cmd', str(stop.exception))
        self.assertIn('codex.exe', str(stop.exception))

    def test_no_windows_node_stops_in_one_line_with_the_fix_and_never_falls_back(self):
        with self.assertRaises(codex_route.RouteError) as stop:
            codex_route.thread_command(SCRIPT, 'open', ['--home', WIN_HOME], WIN_HOME, platform='linux', wsl=True,
                                       run=FakeWsl(node=()), which=lambda _n: '/usr/bin/codex')
        message = str(stop.exception)
        self.assertNotIn('\n', message)
        self.assertIn('winget install OpenJS.NodeJS.LTS', message)
        self.assertIn(WIN_HOME, message)
        self.assertIn('Linux codex is never run against a /mnt home', message)

    def test_no_windows_codex_stops_with_its_fix(self):
        with self.assertRaises(codex_route.RouteError) as stop:
            codex_route.thread_command(SCRIPT, 'open', ['--home', WIN_HOME], WIN_HOME, platform='linux', wsl=True,
                                       run=FakeWsl(codex=()), which=lambda _n: '/usr/bin/codex')
        self.assertIn('on the Windows PATH', str(stop.exception))
        self.assertNotIn('{home}', str(stop.exception))

    def test_interop_off_stops_with_its_fix(self):
        with self.assertRaises(codex_route.RouteError) as stop:
            codex_route.thread_command(SCRIPT, 'open', ['--home', WIN_HOME], WIN_HOME, platform='linux', wsl=True,
                                       run=FakeWsl(interop=False), which=lambda _n: '/usr/bin/codex')
        self.assertIn('/etc/wsl.conf', str(stop.exception))
        self.assertIn(WIN_HOME, str(stop.exception))

    def test_a_wsl_codex_home_is_not_carried_to_windows(self):
        env = codex_route.environ_for('wsl-windows', {'CODEX_HOME': WIN_HOME, 'PATH': '/usr/bin'}, {})
        self.assertEqual(env, {'PATH': '/usr/bin'})
        self.assertEqual(codex_route.environ_for('linux', {'CODEX_HOME': '/h'}), {'CODEX_HOME': '/h'})


class UnchangedRoutesTest(unittest.TestCase):
    def test_wsl_with_a_linux_home_runs_node_and_codex_from_wsl_as_before(self):
        home = '/home/krish/.codex'
        argv, chosen, extra = codex_route.thread_command(SCRIPT, 'open', [*OPTIONS, '--home', home], home, platform='linux', wsl=True,
                                                  run=FakeWsl(), which=lambda _n: '/usr/bin/codex')
        self.assertEqual(chosen, 'linux')
        self.assertEqual(argv, ['node', SCRIPT, 'open', *OPTIONS, '--home', home])
        self.assertEqual(extra, {})

    def test_native_windows_runs_codex_thread_directly(self):
        script = 'C:\\dev\\content-engine\\scripts\\codex_thread.mjs'
        home = 'C:\\Users\\krish\\.codex'
        options = ['--cwd', 'C:\\wt', '--prompt-file', 'C:\\p.md', '--home', home]
        fake = FakeWsl()
        argv, chosen, _ = codex_route.thread_command(script, 'open', options, home, platform='win32', wsl=False,
                                                  run=fake, which=lambda _n: 'C:\\codex.exe')
        self.assertEqual(chosen, 'windows')
        self.assertEqual(argv, ['node', script, 'open', *options])
        self.assertEqual(fake.calls, [])  # no wslpath, no cmd.exe

    def test_without_codex_on_this_machine_it_stops_as_before(self):
        with self.assertRaises(codex_route.RouteError):
            codex_route.thread_command(SCRIPT, 'open', ['--home', '/h'], '/h', platform='linux', wsl=False,
                                       run=FakeWsl(), which=no_codex)


class DispatchUsesTheRouteTest(unittest.TestCase):
    def test_launch_in_wsl_with_his_windows_home_never_names_linux_codex(self):
        fake = FakeWsl()
        real = codex_route.thread_command

        def simulated(script, sub, options, home, **_kw):
            return real(script, sub, options, home, platform='linux', wsl=True, run=fake, which=lambda _n: '/usr/bin/codex')

        with unittest.mock.patch.object(codex_route, 'thread_command', simulated), \
                unittest.mock.patch.object(codex_route, 'stage') as stage, \
                unittest.mock.patch.object(codex_route, 'smoke') as smoke:
            cmd, env, chosen = cards.launch(list(OPTIONS), {'CODEX_HOME': WIN_HOME, 'PATH': '/usr/bin'})
        stage.assert_called_once()
        smoke.assert_called_once()
        self.assertEqual(smoke.call_args.args[0][:2], cmd[:2])
        self.assertEqual(chosen, 'wsl-windows')
        self.assertEqual(cmd[0], '/mnt/c/Program Files/nodejs/node.exe')
        self.assertEqual(cmd[cmd.index('--home') + 1], 'C:\\Users\\krish\\.codex')
        self.assertNotIn('CODEX_HOME', env)
        self.assertTrue(env['PATH'].startswith('/mnt/c/Program Files/Codex:'))

    def test_a_route_that_cannot_be_taken_stops_the_dispatch_with_its_line(self):
        def refused(*_a, **_kw):
            raise codex_route.RouteError('ve dispatch: no Windows node (fix)')

        with unittest.mock.patch.object(codex_route, 'thread_command', refused):
            with self.assertRaises(SystemExit) as stop:
                cards.launch(list(OPTIONS), {'CODEX_HOME': WIN_HOME})
        self.assertEqual(stop.exception.code, 've dispatch: no Windows node (fix)')


class SmokeTest(unittest.TestCase):
    """On 15 Nov the first card on the Windows route came back with only node's MODULE_NOT_FOUND tail. The launch now
    starts node on the staged script once, with no command, and stops in one line with node's own error."""

    ARGV = ['/mnt/c/Program Files/nodejs/node.exe', 'C:\\Users\\krish\\.ve-codex\\codex_thread.mjs', 'open']

    def test_usage_printed_passes(self):
        ok = lambda args, **kw: subprocess.CompletedProcess(args, 2, '', 'Usage: node codex_thread.mjs open ...\n')
        codex_route.smoke(self.ARGV, {}, None, run=ok)

    def test_module_not_found_stops_with_nodes_line(self):
        err = ("node:internal/modules/cjs/loader:1228\n  throw err;\n\nError: Cannot find module "
               "'C:\\\\Users\\\\krish\\\\.ve-codex\\\\codex_thread.mjs'\n    at node:internal/main/run_main_module:33:47 {\n"
               "  code: 'MODULE_NOT_FOUND',\n}\n\nNode.js v24.19.0\n")
        bad = lambda args, **kw: subprocess.CompletedProcess(args, 1, '', err)
        with self.assertRaises(codex_route.RouteError) as stop:
            codex_route.smoke(self.ARGV, {}, '/home/krish/wt', run=bad)
        self.assertIn('Cannot find module', str(stop.exception))
        self.assertIn(self.ARGV[1], str(stop.exception))

    def test_a_drive_path_is_translated_without_wslpath(self):
        self.assertEqual(codex_route.drvfs_windows('/mnt/c/Users/krish/.ve-codex/codex_thread.mjs'),
                         'C:\\Users\\krish\\.ve-codex\\codex_thread.mjs')
        self.assertIsNone(codex_route.drvfs_windows('/home/krish/wt'))

        def refuse(args, **kw):
            raise AssertionError('wslpath must not be asked about a /mnt path')
        self.assertEqual(codex_route.wslpath('/mnt/d/x', '-w', refuse), 'D:\\x')


class SessionLogTest(unittest.TestCase):
    def test_a_windows_codex_session_is_found_by_its_wsl_worktree(self):
        self.assertEqual(codex_route.linux_form('\\\\wsl.localhost\\Ubuntu\\home\\krish\\wt'), '/home/krish/wt')
        self.assertEqual(codex_route.linux_form('//wsl$/Ubuntu/home/krish/wt'), '/home/krish/wt')
        self.assertEqual(codex_route.linux_form('C:\\Users\\krish'), 'C:/Users/krish')

    def test_card_usage_matches_the_worktree_through_its_unc_form(self):
        import json
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / 'rollout.jsonl'
            log.write_text('\n'.join(json.dumps(r) for r in [
                {'type': 'session_meta', 'timestamp': '2026-11-15T17:00:00Z',
                 'payload': {'cwd': '\\\\wsl.localhost\\Ubuntu\\home\\krish\\worktrees\\ve-card\\x'}},
                {'type': 'response_item', 'timestamp': '2026-11-15T17:03:00Z', 'payload': {'type': 'function_call'}},
            ]), encoding='utf-8')
            usage = cards.card_usage('another-card', '/home/krish/worktrees/ve-card/x', logs=[str(log)])
        self.assertEqual(usage['calls'], 1)
        self.assertEqual(usage['minutes'], 3.0)


if __name__ == '__main__':
    unittest.main()
