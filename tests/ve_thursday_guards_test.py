"""The guards built from the Thursday 5 Nov failure report (docs/learning/2026-11-04-thursday-killed.md, F31 to F35).

Krish, 4 Nov 2026: "Okay, this is shit. I'm going to kill this completely. The visuals are tacky. The subtitles are
all over the place typographically." Each test refuses the bad case Thursday showed and passes a good one shaped like
Monday 2 Nov ("The Ladder", docs/plans/2026-11-02-monday/motion-system.md). The renderer is mocked: no frame is drawn."""
import copy
import io
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
sys.path.insert(0, str(ROOT / 'tests'))
os.environ['VE_GATES_OFFLINE'] = '1'
os.environ['VE_GOLDEN'] = 'off'  # the house golden test is never run from here; a test passes its own answer

import ve  # noqa: E402
from velib import guards, lint as ve_lint, proof  # noqa: E402
from ve_proof_test import CUT, V5_FIXTURE, approve, fake_render, props_for, whole  # noqa: E402

LADDER = {
    'object': 'One career ladder; every number is drawn on, beside or instead of a rung',
    'moves': [{'move': 'the drop', 'means': 'the junior rung thins as 27% falls to 9%'},
              {'move': 'the missing rung', 'means': 'the ladder returns taller with no bottom rung'}],
    'never': ['No figures or icons acting out a sentence', 'No on-screen words that repeat what he says'],
    'real_artifacts': [{'asset': 'deepseek-xinjiang-recording', 'text': 'the recording as it played'}],
}
CHAT = 'Which of these should need your yes before you send it'


def with_idea(spec, idea=None):
    out = copy.deepcopy(spec)
    out.setdefault('style', {})['idea'] = copy.deepcopy(LADDER if idea is None else idea)
    for beat in out['cuts'][CUT]['beats'][:1]:
        beat['plate'] = {'source': 'asset:deepseek-xinjiang-recording'}
    return out


def codes(lines):
    return sorted({line.split(' ', 1)[0] for line in lines})


class NoIdeaNoProduction(unittest.TestCase):
    def test_a_spec_with_no_named_idea_is_refused_from_9_nov(self):
        self.assertEqual(codes(guards.idea_problems(whole())), ['idea.required'])
        self.assertEqual(guards.idea_problems(whole(day='2026-11-08')), [], 'pieces before 9 Nov are not held')

    def test_each_part_of_the_idea_is_required(self):
        bare = {'object': 'a', 'moves': [{'move': 'x', 'means': 'y'}], 'never': [], 'real_artifacts': []}
        self.assertEqual(codes(guards.idea_problems(with_idea(whole(), bare))),
                         ['idea.moves', 'idea.never', 'idea.object', 'idea.real'])

    def test_the_ladder_passes_and_its_real_artifact_must_be_on_screen(self):
        self.assertEqual(guards.idea_problems(with_idea(whole())), [])
        hidden = with_idea(whole())
        hidden['cuts'][CUT]['beats'][0]['plate'] = {'source': 'take'}
        self.assertEqual(guards.idea_problems(hidden), [], 'the evidence card plays the recording by its src')
        for obj in hidden['objects']:
            (obj.get('params') or {}).pop('src', None)
        self.assertTrue(any('never on screen' in p for p in guards.idea_problems(hidden)))
        none = with_idea(whole(), dict(LADDER, real_artifacts=[], real_none='a pure opinion piece with no document'))
        self.assertEqual(guards.idea_problems(none), [])

    def test_ve_lint_refuses_it(self):
        found = ve_lint.crew_lints(whole())
        self.assertTrue(any(line.startswith('idea.required') for line in found), found[:5])


class TheOpening(unittest.TestCase):
    """Ruling (Krish, 2026-11-12): "Nothing before the hook, ever. Remove the sting exception for good." A spec naming a
    sting, or an episode card where the sting was, is refused on every cut, every day and every date."""

    def wide(self, day='2026-11-13', sting='mind_the_gap'):
        spec = whole(day=day)
        spec['cuts']['proof-wide']['excerpt'] = False
        spec['brand']['intro_sting'] = sting
        return spec

    def test_a_sting_is_refused_even_on_a_series_wide_whole_cut_on_its_own_day(self):
        found = guards.opening_problems(self.wide())
        self.assertEqual(codes(found), ['opening.nothing_before_hook'])
        self.assertIn('Nothing before the hook, ever.', found[0])
        self.assertIn('opening.nothing_before_hook', codes(guards.spec_lints(self.wide())))

    def test_a_sting_is_refused_on_a_tall_only_piece_and_on_an_off_day_at_any_date(self):
        tall_only = whole()  # proof-tall is whole; proof-wide stays an excerpt
        tall_only['brand']['intro_sting'] = 'mind_the_gap'
        self.assertEqual(codes(guards.opening_problems(tall_only)), ['opening.nothing_before_hook'])
        for day in ('2026-11-05', '2026-11-12'):
            self.assertEqual(codes(guards.opening_problems(self.wide(day=day))), ['opening.nothing_before_hook'], day)

    def test_an_episode_card_before_the_hook_is_refused(self):
        from creative_direction import NO_STING  # noqa: PLC0415
        spec = self.wide(sting=NO_STING)
        spec['brand']['opening_exception'] = {'opening': 'episode_card', 'said': 'I want the episode card to come in.', 'on': '2026-11-09'}
        found = guards.opening_problems(spec)
        self.assertEqual(codes(found), ['opening.nothing_before_hook'])
        self.assertIn('brand.opening_exception', found[0])

    def test_no_sting_named_is_never_refused(self):
        from creative_direction import NO_STING  # noqa: PLC0415
        for value in (None, NO_STING):
            spec = whole(day='2026-11-12')
            spec['brand'].pop('intro_sting', None)
            if value:
                spec['brand']['intro_sting'] = value
            self.assertEqual(guards.opening_problems(spec), [], value)

    def test_the_contract_and_the_direction_say_no_sting_in_the_same_words(self):
        import re  # noqa: PLC0415
        from creative_direction import NO_STING  # noqa: PLC0415
        source = (ROOT / 'packages/contracts/src/production-spec.ts').read_text(encoding='utf-8')
        self.assertEqual(re.search(r"export const VE_NO_STING = '([^']*)'", source).group(1), NO_STING)
        self.assertIn('nothing goes before it', NO_STING)
        enum = re.search(r"export const VeStingSchema = z\.enum\(\[([^\]]*)\]\)", source).group(1)
        self.assertEqual(sorted(re.findall(r"'([a-z_]+)'", enum)), sorted(guards.STINGS))


class ShowTheRealThing(unittest.TestCase):
    def spec(self, typed):
        spec = with_idea(whole(), dict(LADDER, real_artifacts=[{'asset': 'deepseek-xinjiang-recording', 'text': CHAT}]))
        chip = next(o for o in spec['objects'] if o['device'] == 'query_chip')
        chip['params'] = {'text': typed}
        return spec

    def test_a_device_that_retypes_his_screenshot_is_refused(self):
        found = guards.retype_problems(self.spec('Which of these should need your yes'))
        self.assertEqual(codes(found), ['real.retyped'])
        self.assertIn('show deepseek-xinjiang-recording itself', found[0])

    def test_a_label_that_adds_a_source_passes(self):
        self.assertEqual(guards.retype_problems(self.spec('OPENAI · CHATGPT · 3 NOV 2026')), [])


class TheClose(unittest.TestCase):
    """Ruling (Krish, 2026-11-26): "1 agreed", to retiring the sting close and ending every video on the plain v5 outro
    card. A spec dated from 26 Nov that names an intro sting clip anywhere, or is made in another theme, is refused."""

    def v5(self, day='2026-11-27'):
        spec = whole(copy.deepcopy(V5_FIXTURE), day=day)
        self.assertEqual(spec['theme'], 'makeyourmindup-v5')
        return spec

    def test_a_v5_spec_from_26_nov_passes(self):
        self.assertEqual(guards.close_problems(self.v5()), [])

    def test_a_sting_clip_anywhere_in_the_spec_is_refused(self):
        clip = json.loads((ROOT / 'config' / 'intro-sting.json').read_text(encoding='utf-8'))['clips']['9x16']['mind_the_gap']
        for name, value in (('its library path', clip['library']), ('its file name', clip['library'].rsplit('/', 1)[1]),
                            ('its sha256', clip['sha256']), ('a path in its folder', '1 Brand kit (permanent)/Intro sting/x.mp4')):
            with self.subTest(name):
                spec = self.v5()
                spec['assets'].append({'id': 'close-plate', 'kind': 'clip', 'path': value})
                found = guards.close_problems(spec)
                self.assertEqual(codes(found), ['close.v5_outro'])
                self.assertIn('1 agreed', found[0])
                self.assertIn('close.v5_outro', codes(guards.spec_lints(spec)))

    def test_another_theme_is_refused_from_26_nov(self):
        spec = self.v5()
        spec['theme'] = 'makeyourmindup-video-v1'
        self.assertEqual(codes(guards.close_problems(spec)), ['close.v5_outro'])

    def test_a_piece_dated_before_26_nov_is_not_held(self):
        spec = self.v5(day='2026-11-25')
        spec['theme'] = 'makeyourmindup-video-v1'
        spec['assets'].append({'id': 'close-plate', 'kind': 'clip', 'path': '1 Brand kit (permanent)/Intro sting/x.mp4'})
        self.assertEqual(guards.close_problems(spec), [])


class OneWordmark(unittest.TestCase):
    """Ruling (Krish, 2026-11-27): "agree", to one wordmark per video, S3h on its v5 outro: no V4 in the body or on the
    title card, no series pill and no wordmark on the title. A spec dated from 27 Nov that asks for one is refused."""

    def spec(self, day='2026-11-27'):
        return whole(copy.deepcopy(V5_FIXTURE), day=day)

    def test_a_v5_spec_from_27_nov_passes(self):
        self.assertEqual(guards.marks_problems(self.spec()), [])

    def test_v4_anywhere_in_the_spec_is_refused(self):
        sha = json.loads((ROOT / 'config' / 'brand-palette.json').read_text(encoding='utf-8'))['marks']['wordmark']['sha256']
        for name, value in (('its path', 'assets/brand/makeyourmindup/v5/v4.svg'), ('its ink drawing', r'brand\makeyourmindup\v5\v4-ink.svg'),
                            ('its sha256', sha)):
            with self.subTest(name):
                spec = self.spec()
                spec['assets'].append({'id': 'title-mark', 'kind': 'image', 'path': value})
                found = guards.marks_problems(spec)
                self.assertEqual(codes(found), ['marks.one_wordmark'])
                self.assertIn('agree', found[0])
                self.assertIn('marks.one_wordmark', codes(guards.spec_lints(spec)))

    def test_a_body_logo_a_series_pill_or_a_title_wordmark_is_refused(self):
        for where in ('body_logo', 'series_pill', 'title_wordmark'):
            with self.subTest(where):
                spec = self.spec()
                spec['brand'][where] = True
                self.assertEqual(codes(guards.marks_problems(spec)), ['marks.one_wordmark'])
        spec = self.spec()
        spec.setdefault('title_moment', {})['wordmark'] = True
        self.assertEqual(codes(guards.marks_problems(spec)), ['marks.one_wordmark'])

    def test_a_piece_dated_before_27_nov_is_not_held(self):
        spec = self.spec(day='2026-11-26')
        spec['assets'].append({'id': 'title-mark', 'kind': 'image', 'path': 'assets/brand/makeyourmindup/v5/v4.svg'})
        self.assertEqual(guards.marks_problems(spec), [])


class OffDays(unittest.TestCase):
    """Krish, 2026-11-04: "Yes, give off days their own music and look - Rotate." """

    def thursday(self):
        spec = whole(day='2026-11-12')  # a Thursday; the fixture's series is mind.the.gap (Fridays)
        spec['brand']['intro_sting'] = 'mind_the_gap'
        return spec  # its bed is no-curves-instrumental, the series bed

    def test_an_off_day_on_the_series_bed_and_sting_is_refused(self):
        self.assertTrue(guards.off_day(self.thursday()))
        self.assertEqual(guards.config()['off_day']['status'], 'approved')
        found = guards.offday_problems(self.thursday())
        self.assertEqual(codes(found), ['offday.bed', 'offday.chrome'])
        self.assertIn('aspire', found[0])

    def test_an_off_day_on_a_rotation_track_passes_and_a_series_day_is_not_held(self):
        beds = guards.off_day_beds()
        self.assertGreaterEqual(len(beds), 2, 'the off-day rotation is the ledger\'s "for": "off-day" tracks')
        self.assertNotIn('no-curves-instrumental', beds)
        for bed in beds:
            spec = whole(day='2026-11-12')
            spec['audio']['bed']['ledger_id'] = bed
            self.assertEqual(guards.offday_problems(spec), [], bed)
        friday = whole(day='2026-11-13')
        self.assertFalse(guards.off_day(friday))
        self.assertEqual(guards.offday_problems(friday), [])

    def test_the_no_sting_sentence_is_no_sting(self):
        # creative_direction's NO_STING says a piece wears none; only a named series sting is chrome (Krish, 2026-11-05).
        from creative_direction import NO_STING  # noqa: PLC0415
        spec = self.thursday()
        spec['brand']['intro_sting'] = NO_STING
        self.assertEqual(codes(guards.offday_problems(spec)), ['offday.bed'])
        self.assertIsNone(guards.sting_named(spec))
        self.assertEqual(guards.opening_problems(spec), [])

    def test_compile_draws_an_off_day_in_the_house_mint_without_the_series_promise(self):
        from velib.compile import compile_cut  # noqa: PLC0415
        from velib.common import load_json  # noqa: PLC0415
        folder = ROOT / 'fixtures/ve/my-test-19s'
        words = [dict(w, end_s=w['onset_s'] + 0.2) for w in load_json(folder / 'words.frames.json')]
        friday = compile_cut(whole(V5_FIXTURE, day='2026-11-13'), CUT, words, folder)
        thursday = compile_cut(whole(V5_FIXTURE, day='2026-11-12'), CUT, words, folder)
        self.assertNotEqual(friday['tokens']['channel'], friday['tokens']['mint'])
        self.assertEqual(thursday['tokens']['channel'], thursday['tokens']['mint'])
        self.assertEqual(thursday['series']['label'], 'off.day')
        self.assertEqual(thursday['series']['promise'], thursday['series']['site'])
        self.assertNotEqual(friday['series']['promise'], friday['series']['site'])


class Held(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name) / 've'
        self.dir.mkdir()
        self.spec = whole()
        self.props = props_for(self.spec)
        self.spec_file = self.dir / 'spec.json'
        self.spec_file.write_text(json.dumps(self.spec), encoding='utf-8')
        guards.freeze(self.dir)
        record = proof.make(self.spec, CUT, self.dir, self.props, fake_render())
        self.approved = approve(self.spec, record['sha256'])  # his press on 2026-11-12

    def tearDown(self):
        self.tmp.cleanup()

    def refused(self, spec=None, props=None):
        return ve.render_refusal(spec or self.approved, self.spec_file, props or self.props)


class EngineFreeze(Held):
    """Ruling (Krish, 2026-11-19): no approvals during production. A piece proofs and renders on the engine pinned at ve
    expect by itself; nothing asks him to approve an engine hash."""

    def test_the_signed_engine_renders_and_a_changed_one_runs_on_the_pin_with_no_approval_asked(self):
        self.assertEqual(self.refused(), [])
        files = dict(guards.engine_files(), **{'scripts/velib/compile.py': '0' * 64})
        with mock.patch.object(guards, 'engine_files', return_value=files):
            reasons = self.refused()
            self.assertTrue(any('engine changed' in r and 'compile.py' in r and 'pinned at ve expect' in r for r in reasons), reasons)
            self.assertFalse(any('approv' in r for r in reasons if 'engine' in r), reasons)
            yes = copy.deepcopy(self.approved)   # an engine approval he already gave is still honoured
            yes['approvals'].append({'gate': 'exception', 'by': 'Krish', 'said': 'take the new caption build',
                                     'on': '2026-11-12', 'artifact_hash': guards.engine_sha(files)})
            self.assertEqual(self.refused(yes), [])

    def test_an_engine_approval_in_the_piece_folder_binds_and_waives_nothing_else(self):
        files = dict(guards.engine_files(), **{'scripts/velib/audio.py': '2' * 64})
        approval = {'gate': 'exception', 'scope': 'engine', 'by': 'Krish', 'said': 'approve the engine change for Wednesday',
                    'on': '2026-11-10', 'artifact_hash': guards.engine_sha(files)}
        with mock.patch.object(guards, 'engine_files', return_value=files):
            self.assertTrue(any('engine changed' in r for r in self.refused()))
            (self.dir / guards.ENGINE_EXCEPTIONS).write_text(json.dumps({'approvals': [approval]}), encoding='utf-8')
            self.assertEqual(self.refused(), [])
        spec = copy.deepcopy(self.spec)
        spec['approvals'] = [approval]
        self.assertIsNone(guards.last_press(spec, {}), 'an engine approval is not a press on a cut')

    def test_a_standing_engine_follows_main_yes_takes_main_with_no_hash(self):
        files = dict(guards.engine_files(), **{'scripts/velib/compile.py': '3' * 64})
        standing = {'gate': 'exception', 'scope': guards.FOLLOWS_MAIN, 'by': 'Krish', 'said': 'just fix it', 'on': '2026-11-19'}
        with mock.patch.object(guards, 'engine_files', return_value=files):
            (self.dir / guards.ENGINE_EXCEPTIONS).write_text(json.dumps({'approvals': [standing]}), encoding='utf-8')
            self.assertEqual(guards.engine_route(self.approved, self.dir)['route'], 'here')
            self.assertEqual(self.refused(), [])
        spec = copy.deepcopy(self.spec)
        spec['approvals'] = [standing]
        self.assertIsNone(guards.last_press(spec, {}), 'a standing engine yes is not a press on a cut')

    def test_a_renderer_fix_follows_main_only_when_the_house_golden_test_passes(self):
        renderer = dict(guards.engine_files(), **{'apps/renderer/src/engine/chrome/WordCaption.tsx': '4' * 64})
        with mock.patch.object(guards, 'engine_files', return_value=renderer):
            self.assertEqual(guards.engine_route(self.approved, self.dir, golden=lambda _sha: True)['route'], 'here')
            self.assertEqual(guards.engine_route(self.approved, self.dir, golden=lambda _sha: False)['route'], 'pin')
            self.assertEqual(guards.engine_problems(self.approved, CUT, self.dir, golden=lambda _sha: True), [])
        python = dict(guards.engine_files(), **{'scripts/velib/compile.py': '5' * 64})
        with mock.patch.object(guards, 'engine_files', return_value=python):
            # the golden test draws the renderer only: a change outside it stays on the pin whatever the test says
            self.assertEqual(guards.engine_route(self.approved, self.dir, golden=lambda _sha: True)['route'], 'pin')

    def test_a_change_that_rewrites_the_golden_frames_never_follows_main_by_the_golden_test(self):
        # A renderer change that regenerates houseGolden.json passes the test by construction: it proves nothing.
        for name in ('apps/renderer/src/engine/houseGolden.json', 'apps/renderer/src/engine/houseGolden.test.ts'):
            moved = dict(guards.engine_files(), **{'apps/renderer/src/engine/chrome/WordCaption.tsx': '7' * 64, name: '8' * 64})
            with mock.patch.object(guards, 'engine_files', return_value=moved):
                self.assertEqual(guards.engine_route(self.approved, self.dir, golden=lambda _sha: True)['route'], 'pin', name)

    def test_a_rule_change_keeps_a_golden_passing_renderer_fix_on_the_pin(self):
        renderer = dict(guards.engine_files(), **{'apps/renderer/src/engine/chrome/WordCaption.tsx': '9' * 64})
        with mock.patch.object(guards, 'engine_files', return_value=renderer), \
                mock.patch.object(guards, 'rules_changed', return_value=['scripts/velib/lint.py']):
            route = guards.engine_route(self.approved, self.dir, golden=lambda _sha: True)
        self.assertEqual(route['route'], 'pin')
        self.assertIn('scripts/velib/lint.py', route['changed'])

    def test_ve_proof_and_ve_render_go_to_the_pin_before_main_lint_can_refuse(self):
        # main's lint is a rule the frozen piece is not held to: it must never run before the pin is taken.
        (self.dir / f'props.{CUT}.json').write_text(json.dumps(self.props), encoding='utf-8')
        lock = json.loads(guards.lock_path(self.dir).read_text(encoding='utf-8'))
        lock['commit'] = 'abc123'
        guards.lock_path(self.dir).write_text(json.dumps(lock), encoding='utf-8')
        moved = {**lock['rules']['files'], 'scripts/velib/lint.py': '0' * 64}
        args = types.SimpleNamespace(spec=str(self.spec_file), cut=CUT, beat=None, props=None, assets_dir=None,
                                     scale=1.0, no_qc=True)
        with mock.patch.object(guards, 'rules_files', return_value=moved), \
                mock.patch.object(ve_lint, 'lint', side_effect=AssertionError('main lint ran on a frozen piece')), \
                mock.patch.object(guards, 'pin_checkout', return_value=Path('/pins/abc')), \
                mock.patch.object(ve, '_exec_pinned', return_value=0) as run, \
                mock.patch.object(ve, '_ARGV', ['proof', str(self.spec_file)]), mock.patch('sys.stdout'):
            self.assertEqual(ve.cmd_proof(args, render_fn=fake_render()), 0)
            self.assertEqual(run.call_count, 1)
            render_args = types.SimpleNamespace(spec=str(self.spec_file), props=str(self.dir / f'props.{CUT}.json'),
                                                out=str(self.dir / 'cut.mp4'), assets_dir=None, scale=1.0)
            self.assertEqual(ve.cmd_render(render_args), 0)
            self.assertEqual(run.call_count, 2)

    def test_no_engine_record_refuses_and_ve_expect_writes_it(self):
        guards.lock_path(self.dir).unlink()
        self.assertTrue(any('run ve expect' in r for r in self.refused()))
        args = types.SimpleNamespace(spec=str(self.spec_file))
        with mock.patch.object(ve_lint, 'lint', return_value=(self.spec, [])), mock.patch('sys.stdout'):
            self.assertEqual(ve.cmd_expect(args), 0)
        lock = json.loads(guards.lock_path(self.dir).read_text(encoding='utf-8'))
        self.assertTrue(lock['rules']['sha256'] and 'scripts/velib/lint.py' in lock['rules']['files'])
        self.assertEqual(self.refused(), [])

    def pinned_run(self, fn, args):
        """Run a ve command as ve main would, with a renderer file changed on main, and the pinned checkout faked."""
        files = dict(guards.engine_files(), **{'apps/renderer/src/engine/chrome/WordCaption.tsx': '6' * 64})
        out = io.StringIO()
        with mock.patch.object(guards, 'engine_files', return_value=files), \
                mock.patch.object(guards, 'golden_passes', return_value=False), \
                mock.patch.object(ve_lint, 'lint', return_value=(self.spec, [])), \
                mock.patch.object(guards, 'pin_checkout', return_value=Path('/pins/abc')) as checkout, \
                mock.patch.object(ve, '_exec_pinned', return_value=0) as run, \
                mock.patch.object(ve, '_ARGV', [fn.__name__.replace('cmd_', ''), str(self.spec_file)]), \
                mock.patch('sys.stdout', out):
            code = fn(args)
        return code, checkout, run, out.getvalue()

    def test_ve_proof_runs_on_the_pin_when_main_moves_and_asks_nothing(self):
        (self.dir / f'props.{CUT}.json').write_text(json.dumps(self.props), encoding='utf-8')
        args = types.SimpleNamespace(spec=str(self.spec_file), cut=CUT, beat=None, props=None, assets_dir=None,
                                     scale=1.0, no_qc=True)
        lock = json.loads(guards.lock_path(self.dir).read_text(encoding='utf-8'))
        lock['commit'] = 'abc123'
        guards.lock_path(self.dir).write_text(json.dumps(lock), encoding='utf-8')
        code, checkout, run, said = self.pinned_run(lambda a: ve.cmd_proof(a, render_fn=fake_render()), args)
        self.assertEqual(code, 0)
        checkout.assert_called_once_with('abc123', lock['sha256'], lock['rules']['sha256'])
        self.assertEqual(run.call_args[0][0], Path('/pins/abc'))
        self.assertIn(str(self.spec_file.resolve()), run.call_args[0][1])
        self.assertIn('pinned engine', said)
        self.assertNotIn('approv', said)

    def test_ve_render_runs_on_the_engine_of_the_approved_proof(self):
        record = json.loads(proof.record_path(self.dir, CUT).read_text(encoding='utf-8'))
        record.update({'engine_sha256': 'f' * 64, 'engine_commit': 'def456'})
        proof.record_path(self.dir, CUT).write_text(json.dumps(record), encoding='utf-8')
        reasons = self.refused()
        engine = [r for r in reasons if 'engine' in r]
        self.assertTrue(engine and 'def456' in engine[0] and 'approved proof was drawn on' in engine[0], reasons)
        self.assertNotIn('approve the', engine[0])
        props_file = self.dir / f'props.{CUT}.json'
        props_file.write_text(json.dumps(self.props), encoding='utf-8')
        args = types.SimpleNamespace(spec=str(self.spec_file), props=str(props_file), out=str(self.dir / 'cut.mp4'),
                                     assets_dir=None, scale=1.0)
        with mock.patch('velib.render.check_asset_hashes'):
            code, checkout, run, said = self.pinned_run(ve.cmd_render, args)
        self.assertEqual(code, 0)
        lock = json.loads(guards.lock_path(self.dir).read_text(encoding='utf-8'))
        checkout.assert_called_once_with('def456', 'f' * 64, lock['rules']['sha256'])
        self.assertNotIn('approv', said)
        record['engine_sha256'] = guards.engine_sha()   # the engine here is the proof's: it renders here
        proof.record_path(self.dir, CUT).write_text(json.dumps(record), encoding='utf-8')
        self.assertEqual(guards.render_route(self.approved, CUT, self.dir)['route'], 'here')
        self.assertEqual(self.refused(), [])


class TwoLoops(Held):
    def test_a_third_full_render_waits_for_his_next_press(self):
        for at in ('2026-11-13T09:00:00Z', '2026-11-13T10:00:00Z'):
            self.assertEqual(self.refused(), [], at)
            guards.record_render(self.dir, CUT, self.dir / 'cut.mp4', 'a' * 64, now=at)
        reasons = self.refused()
        self.assertTrue(any('2 full renders' in r and 'bring him' in r for r in reasons), reasons)
        pressed = {'proof': [{'by': 'Krish', 'at': '2026-11-13T11:00:00Z', 'sha256': 'x', 'verdict': 'approve'}]}
        self.assertEqual(guards.loop_problems(self.approved, CUT, self.dir, pressed), [])

    def test_renders_before_his_press_do_not_count(self):
        for at in ('2026-11-11T09:00:00Z', '2026-11-11T10:00:00Z'):
            guards.record_render(self.dir, CUT, self.dir / 'cut.mp4', 'a' * 64, now=at)
        self.assertEqual(self.refused(), [], 'his 12 Nov press came after both renders')

    def test_a_press_later_the_same_day_counts_from_its_hour(self):
        # Render at 09:00, he presses at 15:00 the same day: the two renders after his press are allowed (Wed 18).
        guards.record_render(self.dir, CUT, self.dir / 'cut.mp4', 'a' * 64, now='2026-11-13T09:00:00Z')
        guards.record_render(self.dir, CUT, self.dir / 'cut.mp4', 'a' * 64, now='2026-11-13T10:00:00Z')
        spec = copy.deepcopy(self.approved)
        spec['approvals'].append({'gate': 'final', 'by': 'Krish', 'said': 'go again', 'on': '2026-11-13',
                                  'at': '2026-11-13T15:00:00Z', 'artifact_hash': 'b' * 64})
        for at in ('2026-11-13T15:30:00Z', '2026-11-13T16:00:00Z'):
            self.assertEqual(guards.loop_problems(spec, CUT, self.dir, {}), [], at)
            guards.record_render(self.dir, CUT, self.dir / 'cut.mp4', 'a' * 64, now=at)
        self.assertTrue(guards.loop_problems(spec, CUT, self.dir, {}), 'a third render after his press still waits')

    def test_an_old_date_only_press_is_read_as_midnight_as_before(self):
        guards.record_render(self.dir, CUT, self.dir / 'cut.mp4', 'a' * 64, now='2026-11-13T09:00:00Z')
        guards.record_render(self.dir, CUT, self.dir / 'cut.mp4', 'a' * 64, now='2026-11-13T10:00:00Z')
        spec = copy.deepcopy(self.approved)
        spec['approvals'].append({'gate': 'final', 'by': 'Krish', 'said': 'go again', 'on': '2026-11-13', 'artifact_hash': 'b' * 64})
        self.assertTrue(guards.loop_problems(spec, CUT, self.dir, {}))


class OneTypeSystem(Held):
    def thursday_props(self):
        props = copy.deepcopy(self.props)
        props['format'], props['captionStyle'], props['title'] = 'face-with-proof', 'word', 'Give your AI two rules'
        props['captions'][0]['swipeIndex'] = 0
        props['beats'][1]['layout'], props['beats'][1]['plate'] = 'STAGE', {'source': 'none'}
        props['objects'].append({'obj': 'headline', 'device': 'headline', 'fromFrame': 0, 'toFrame': 10, 'params': {}})
        props['beats'][1]['uses'] = list(props['beats'][1]['uses']) + ['headline']
        return props

    def test_thursdays_treatments_are_listed_and_never_refused_by_count(self):
        # Krish, 4 Nov 2026: "it needs to look good, and it didn't that time": judged moving, not counted.
        found = guards.type_treatments(self.thursday_props())
        self.assertGreater(len(found), 4, found)
        self.assertIn(['dek', 'loud caption word'], found)
        self.assertIn(['structure', 'held title'], found)
        self.assertEqual(guards.config()['type']['mode'], 'advisory')
        self.assertFalse(any('type treatments' in r for r in self.refused(props=self.thursday_props())))
        self.assertIn('dek as loud caption word', guards.type_note(self.thursday_props()))

    def test_a_limit_mode_would_still_refuse_and_his_yes_admit(self):
        props = self.thursday_props()
        limited = dict(guards.config(), type={'mode': 'limit', 'max_treatments': 4})
        with mock.patch.object(guards, 'config', return_value=limited):
            self.assertTrue(guards.type_problems(self.approved, props))
            yes = copy.deepcopy(self.approved)
            yes['approvals'].append({'gate': 'exception', 'by': 'Krish', 'said': 'keep the serif loud word', 'on': '2026-11-12',
                                     'artifact_hash': guards.canonical_sha(guards.type_treatments(props))})
            self.assertEqual(guards.type_problems(yes, props), [])

    def test_ve_proof_records_the_treatments(self):
        (self.dir / f'props.{CUT}.json').write_text(json.dumps(self.props), encoding='utf-8')
        args = types.SimpleNamespace(spec=str(self.spec_file), cut=CUT, beat=None, props=None, assets_dir=None,
                                     scale=1.0, no_qc=True)
        # Not a test of the F58 comparison (ve_plain_frames_test.py holds that): no approved proof to compare against here,
        # since this file's renders are bytes, not frames.
        from velib import proof as ve_proof
        with mock.patch.object(ve_lint, 'lint', return_value=(self.spec, [])), mock.patch('sys.stdout'), \
                mock.patch.object(ve_proof, 'approved_baseline', return_value=(None, None)), \
                mock.patch.dict('os.environ', {'VE_FRAMES_OFFLINE': '1'}):
            ve.cmd_proof(args, render_fn=fake_render())
        record = json.loads((self.dir / 'proof' / f'{CUT}.json').read_text(encoding='utf-8'))
        self.assertEqual(record['type'], guards.type_treatments(self.props))

    def test_device_roles_are_read_from_the_renderer(self):
        self.assertEqual(guards.device_roles('kinetic_stat'), ['data', 'display'])
        self.assertEqual(guards.device_roles('no_such_device'), [])


if __name__ == '__main__':
    unittest.main()
