"""His approved clone voices off-day voiceover shorts only (Ruling, Krish, 2026-11-15: off-day voiceover shorts may be
voiced with his approved ElevenLabs clone; hero cuts stay on his real takes).

Held here: the spec names a clone voice only on an off-day short whose every cut is a 9:16 voiceover taking it (the
schema and ve lint's voice.clone_route), and voice.synthetic still refuses any clone his registry does not hold or the
spec does not carry his approval of; compile reads a clone-voiced short exactly as one he recorded and refuses it
anywhere else; his Approve proof stands for the voice he heard; and `ve voice clone` plans the generation from the
signed words, spending nothing, and generates only that plan, with its booking and the key, through the credit ledger.

No network and no spend: the registry read and the ElevenLabs request are stubbed in every test, and every name, word,
voice id and hash here is invented."""
from __future__ import annotations

import copy
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from argparse import Namespace
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
from velib import clone_voice, proof  # noqa: E402
from velib import lint as ve_lint  # noqa: E402
from velib.common import load_json, sha256_file  # noqa: E402
from velib.compile import compile_cut  # noqa: E402
import ve  # noqa: E402

FIXTURE = ROOT / 'fixtures/ve/my-test-19s'
SERIES_DAY, OFF_DAY = '2026-10-23', '2026-10-22'   # the fixture is mind.the.gap, a Friday series; Thursday is an off day
TAKE = 'clone-vo'
CLONE = {'name': 'krish-voice-elevenlabs-v2', 'kind': 'voice', 'platform': 'elevenlabs', 'platform_ref': 'TestVoice0000000001',
         'approved_sha256': 'c' * 64, 'approved_words': "test words, not Krish's", 'approved_on': '2026-11-20'}
HEYGEN_VOICE = {**CLONE, 'name': 'krish-voice-heygen', 'platform': 'heygen', 'approved_sha256': 'd' * 64}


def registry(*entries) -> str:
    return json.dumps({'format': ve_lint.SYNTHETIC_FORMAT, 'approvals': list(entries)})


def approval(entry: dict) -> dict:
    return {'gate': 'synthetic', 'by': 'Krish', 'said': entry['approved_words'], 'on': entry['approved_on'],
            'artifact_hash': entry['approved_sha256']}


def served(text: str):
    return patch.object(ve_lint, 'fetch_synthetic_registry', return_value=text)


def unreachable():
    return patch.object(ve_lint, 'fetch_synthetic_registry', side_effect=RuntimeError('curl exited 6'))


def voice_asset(sha: str = 'e' * 64, **extra) -> dict:
    return {'id': TAKE, 'kind': 'voice', 'origin': 'generated', 'path': f'{TAKE}.wav', 'sha256': sha,
            'licence': 'generated with his approved clone (test)', 'tool': 'elevenlabs.voice_clone:krish-voice-elevenlabs-v2',
            **extra}


def short(day: str = OFF_DAY, voice: dict | None = None, approve: dict | None = CLONE) -> dict:
    """The fixture made an off-day voiceover short: one 9:16 cut, taking the clone voice."""
    spec = load_json(FIXTURE / 'spec.json')
    spec['publish_day'] = day
    del spec['cuts']['proof-wide']
    spec['cuts']['proof-tall']['take'] = TAKE
    if voice is not None:
        spec['assets'].append(voice)
    if approve is not None:
        spec['approvals'].append(approval(approve))
    return spec


def recorded(day: str = OFF_DAY) -> dict:
    """The same short, read from his own recorded voiceover."""
    spec = load_json(FIXTURE / 'spec.json')
    spec['publish_day'] = day
    del spec['cuts']['proof-wide']
    return spec


def timed_words():
    return [dict(word, end_s=word['onset_s'] + 0.2) for word in load_json(FIXTURE / 'words.frames.json')]


def lint_codes(spec: dict) -> list[str]:
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp) / 'spec.json'
        path.write_text(json.dumps(spec), encoding='utf-8')
        _, problems = ve_lint.lint(path)
    return [p.split(' ', 1)[0] for p in problems]


def mp3(path: Path, seconds: float = 1.0) -> Path:
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'sine=frequency=220:duration={seconds}',
                    '-c:a', 'libmp3lame', '-b:a', '64k', str(path)], check=True, capture_output=True)
    return path


class TheSpecNamesTheCloneOnAnOffDayShortOnly(unittest.TestCase):
    """The whole ve lint, schema first, on the fixture made an off-day short."""

    def test_an_off_day_short_voiced_by_his_approved_clone_passes(self):
        with served(registry(CLONE)):
            self.assertEqual(lint_codes(short(voice=voice_asset())), [])

    def test_a_hero_piece_on_its_series_day_is_refused_even_with_his_approval(self):
        with served(registry(CLONE)):
            self.assertEqual(lint_codes(short(SERIES_DAY, voice=voice_asset())), ['voice.clone_route'])

    def test_a_spec_with_no_off_day_to_read_is_refused(self):
        spec = short(voice=voice_asset())
        spec['theme'] = 'not-a-theme'
        self.assertEqual(ve_lint.clone_route_problems(spec)[0].split(' ', 1)[0], 'voice.clone_route')
        self.assertIn('no off day can be read', ve_lint.clone_route_problems(spec)[0])

    def test_the_schema_refuses_every_other_shape(self):
        wide = short(voice=voice_asset())
        wide['cuts']['proof-wide'] = copy.deepcopy(load_json(FIXTURE / 'spec.json')['cuts']['proof-wide'])
        wide['cuts']['proof-wide']['take'] = TAKE
        take_master = short(voice=voice_asset())
        take_master['audio']['master'] = 'take'
        his_take = short(voice=voice_asset())
        his_take['cuts']['proof-tall']['take'] = 'long-vo-master'
        captured = short(voice=voice_asset(origin='capture'))
        undated = short(voice=voice_asset())
        del undated['publish_day']
        two = short(voice=voice_asset())
        two['assets'].append({**voice_asset('f' * 64), 'id': 'clone-vo-2', 'path': 'clone-vo-2.wav'})
        cases = {'a wide cut': wide, 'the take master': take_master, 'a cut on his own take': his_take,
                 'a clone marked as a capture': captured, 'no publish day': undated, 'two clone voices': two}
        with served(registry(CLONE)):
            for why, spec in cases.items():
                with self.subTest(why):
                    self.assertIn('SCHEMA', lint_codes(spec))

    def test_voice_synthetic_still_refuses_an_unregistered_or_unapproved_clone(self):
        with served(registry()):
            self.assertEqual(lint_codes(short(voice=voice_asset(), approve=None)), ['voice.synthetic'])
        with served(registry(CLONE)):  # registered, but the spec carries no approval of it
            self.assertEqual(lint_codes(short(voice=voice_asset(), approve=None)), ['voice.synthetic'])
        with served(registry({**CLONE, 'withdrawn': {'words': 'test: take it back', 'on': '2026-11-22'}})):
            self.assertIn('voice.synthetic', lint_codes(short(voice=voice_asset())))
        with unreachable():
            self.assertIn('voice.synthetic', lint_codes(short(voice=voice_asset())))

    def test_only_the_elevenlabs_clone_the_ruling_names(self):
        heygen = voice_asset(tool='heygen.voice_clone:krish-voice-heygen')
        with served(registry(HEYGEN_VOICE)):  # registered and approved, but not the clone the ruling names
            self.assertEqual(lint_codes(short(voice=heygen, approve=HEYGEN_VOICE)), ['voice.clone_route'])
        likeness = voice_asset(tool='heygen.avatar:krish-avatar-heygen')  # a likeness tool on a voice fails closed
        with served(registry(CLONE)):
            codes = lint_codes(short(voice=likeness))
        self.assertIn('voice.clone_route', codes)
        self.assertIn('voice.synthetic', codes)
        nameless = voice_asset(tool='elevenlabs.voice_clone')
        self.assertIsNotNone(ve_lint.clone_tool_problem(nameless))
        self.assertIsNone(ve_lint.clone_tool_problem(voice_asset()))

    def test_a_spec_without_a_clone_never_reads_the_registry(self):
        with unreachable() as fetch:
            self.assertEqual(ve_lint.clone_voice_lints(recorded()), [])
            self.assertEqual(ve_lint.synthetic_lints(recorded()), [])
        fetch.assert_not_called()


class CompileReadsTheCloneAsItReadsHim(unittest.TestCase):
    def setUp(self):
        (ROOT / '.cache').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / '.cache', prefix='ve-clone-test-')
        self.assets = Path(self.temp.name)
        self.wav = self.assets / f'{TAKE}.wav'
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=1',
                        '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', str(self.wav)], check=True, capture_output=True)
        self.sha = sha256_file(self.wav)

    def tearDown(self):
        self.temp.cleanup()

    def edl(self, sha: str | None = None, take: str = TAKE, kept=()):
        return {'piece': load_json(FIXTURE / 'spec.json')['piece_id'], 'cut': 'proof-tall', 'edit': {'remove': []}, 'speed': 1,
                'takes': {take: {'media': {'sha256': sha or self.sha}}}, 'segments': [{'take': take}],
                'unscripted_kept': list(kept), 'joins': [], 'duration_frames': 600,
                'conformed': {'picture': 'conformed.proof-tall.mp4', 'dialogue': 'dialogue.proof-tall.wav'}}

    def test_a_clone_voiced_short_compiles_exactly_as_one_he_recorded(self):
        words = timed_words()
        his = compile_cut(recorded(), 'proof-tall', words, self.assets)
        report = {}
        clone = compile_cut(short(voice=voice_asset(self.sha)), 'proof-tall', words, self.assets, report=report)
        self.assertEqual(clone, his)
        self.assertEqual(clone['segments'], [])
        self.assertEqual(report['voice'], {'master': 'clone', 'asset': TAKE, 'tool': 'elevenlabs.voice_clone:krish-voice-elevenlabs-v2',
                                           'sha256': self.sha})
        mine = {}
        compile_cut(recorded(), 'proof-tall', words, self.assets, report=mine)
        self.assertNotIn('voice', mine)
        with_edl = compile_cut(short(voice=voice_asset(self.sha)), 'proof-tall', words, self.assets, edl=self.edl())
        self.assertEqual(with_edl, his)

    def test_compile_refuses_the_clone_anywhere_but_an_off_day_short(self):
        hero = short(SERIES_DAY, voice=voice_asset(self.sha))
        with self.assertRaisesRegex(ValueError, 'hero cuts stay on his real takes'):
            compile_cut(hero, 'proof-tall', timed_words(), self.assets)
        take_master = short(voice=voice_asset(self.sha))
        take_master['audio']['master'] = 'take'
        with self.assertRaisesRegex(ValueError, 'no voiceover master'):
            compile_cut(take_master, 'proof-tall', timed_words(), self.assets)
        wide = short(voice=voice_asset(self.sha))
        wide['cuts']['proof-tall']['aspect'] = '16:9'
        with self.assertRaisesRegex(ValueError, 'not a 9:16 short'):
            compile_cut(wide, 'proof-tall', timed_words(), self.assets)

    def test_compile_binds_the_clone_to_its_bytes(self):
        with self.assertRaisesRegex(ValueError, 'not the bytes the spec names'):
            compile_cut(short(voice=voice_asset('a' * 64)), 'proof-tall', timed_words(), self.assets)
        self.wav.unlink()
        with self.assertRaisesRegex(ValueError, 'missing or not the bytes'):
            compile_cut(short(voice=voice_asset(self.sha)), 'proof-tall', timed_words(), self.assets)

    def test_the_edl_draws_on_the_clone_alone_and_keeps_no_unsigned_word(self):
        spec = short(voice=voice_asset(self.sha))
        with self.assertRaisesRegex(ValueError, 'its EDL draws on'):
            compile_cut(spec, 'proof-tall', timed_words(), self.assets, edl=self.edl('b' * 64))
        with self.assertRaisesRegex(ValueError, 'the signed script does not hold'):
            compile_cut(spec, 'proof-tall', timed_words(), self.assets,
                        edl=self.edl(kept=[{'line': 1, 'take': TAKE, 'word': 'basically', 'src_s': 1.0}]))
        his = recorded()
        his['assets'].append(voice_asset(self.sha))  # a stray clone on a cut that names his take (the schema refuses it too)
        with self.assertRaisesRegex(ValueError, 'his own voice, but its EDL draws on the clone'):
            compile_cut(his, 'proof-tall', timed_words(), self.assets, edl=self.edl(take='long-vo-master'))


class HisApproveProofStandsForTheVoiceHeHeard(unittest.TestCase):
    def test_a_recorded_cut_keeps_its_structure_and_a_clone_adds_its_voice(self):
        his = recorded()
        self.assertNotIn('voice', proof.structure(his, 'proof-tall'))
        clone = short(voice=voice_asset('1' * 64))
        self.assertEqual(proof.structure(clone, 'proof-tall')['voice'],
                         [TAKE, 'elevenlabs.voice_clone:krish-voice-elevenlabs-v2', '1' * 64])
        again = short(voice=voice_asset('2' * 64))
        self.assertNotEqual(proof.structural_hash(clone, 'proof-tall'), proof.structural_hash(again, 'proof-tall'))
        self.assertEqual(proof.changes(proof.structure(clone, 'proof-tall'), proof.structure(again, 'proof-tall')),
                         [f'voice clone {TAKE} (111111111111) -> clone {TAKE} (222222222222)'])
        switched = proof.changes(proof.structure(his, 'proof-tall'), proof.structure(clone, 'proof-tall'))
        self.assertIn(f'voice his own voice -> clone {TAKE} (111111111111)', switched)


class ThePlanSpendsNothingAndReadsTheSignedWords(unittest.TestCase):
    def plan(self, spec, text=None, script=FIXTURE / 'script.words.json'):
        with served(text if text is not None else registry(CLONE)):
            return clone_voice.plan(spec, script)

    def test_the_plan_is_the_signed_words_the_registry_voice_and_the_estimate(self):
        doc = self.plan(short())
        signed = [w['word'] for w in load_json(FIXTURE / 'script.words.json')['words']]
        self.assertEqual(doc['text'].split(' '), signed)
        self.assertEqual(doc['clone']['voice_id'], CLONE['platform_ref'])
        self.assertEqual(doc['take'], TAKE)
        self.assertEqual(doc['tool'], 'elevenlabs.voice_clone:krish-voice-elevenlabs-v2')
        self.assertEqual(doc['model'], clone_voice.config()['model'])
        self.assertEqual(doc['credits'], {'provider': 'elevenlabs_credits', 'per_character': 1, 'estimate': len(doc['text'])})
        self.assertEqual(doc['plan_sha256'], clone_voice.digest(doc))
        self.assertEqual(doc['script']['sha256'], sha256_file(FIXTURE / 'script.words.json'))

    def test_the_plan_is_refused_with_its_reason(self):
        no_day = short()
        no_day['publish_day'] = SERIES_DAY
        two = short()
        two['cuts']['proof-tall-2'] = {**copy.deepcopy(two['cuts']['proof-tall']), 'take': 'another-take'}
        cases = {
            'a hero piece': (no_day, registry(CLONE), 'hero piece'),
            'no approval in the spec': (short(approve=None), registry(CLONE), 'carries no approval'),
            'his approval of another clone': (short(approve=HEYGEN_VOICE), registry(CLONE, HEYGEN_VOICE), 'carries no approval'),
            'not in the registry': (short(), registry(), 'not an approved voice'),
            'no voice id': (short(), registry({**CLONE, 'platform_ref': ''}), 'names no platform_ref'),
            'two takes': (two, registry(CLONE), 'the one voice'),
        }
        for why, (spec, text, said) in cases.items():
            with self.subTest(why), self.assertRaisesRegex(ValueError, said):
                self.plan(spec, text)
        with self.assertRaises(Exception):
            with unreachable():
                clone_voice.plan(short(), FIXTURE / 'script.words.json')


class GenerateRunsOnlyThePlanThroughTheCreditRoute(unittest.TestCase):
    SPEND = '0b0e0c1a-0000-4000-8000-000000000001'

    def setUp(self):
        (ROOT / '.cache').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / '.cache', prefix='ve-clone-gen-')
        self.assets = Path(self.temp.name) / 'assets'
        with served(registry(CLONE)):
            self.doc = clone_voice.plan(short(), FIXTURE / 'script.words.json')
        self.calls = []
        self.audio = mp3(Path(self.temp.name) / 'provider.mp3').read_bytes()

    def tearDown(self):
        self.temp.cleanup()

    def reserve(self, provider, amount, piece, note):
        self.calls.append(('reserve', provider, amount))
        return 'rid0001'

    def settle(self, rid, amount):
        self.calls.append(('settle', rid, amount))

    def post(self, url, payload, key, timeout):
        self.calls.append(('post', url, payload, key))
        return self.audio, {'character-cost': '123', 'request-id': 'req-test-1'}

    def run_it(self, **given):
        kwargs = dict(plan_sha256=self.doc['plan_sha256'], spend_id=self.SPEND, assets_dir=self.assets,
                      env={'ELEVENLABS_API_KEY': 'test-key-not-real'}, post=self.post, reserve=self.reserve, settle=self.settle)
        kwargs.update(given)
        return clone_voice.generate(self.doc, **kwargs)

    def test_nothing_is_reserved_or_requested_without_the_plan_the_booking_and_the_key(self):
        cases = {'another plan': {'plan_sha256': 'a' * 64}, 'no booking': {'spend_id': None},
                 'not a booking id': {'spend_id': 'yes'}, 'no key here': {'env': {}}}
        for why, given in cases.items():
            with self.subTest(why), self.assertRaises(ValueError):
                self.run_it(**given)
        edited = dict(self.doc, text=self.doc['text'] + ' extra')
        with self.assertRaisesRegex(ValueError, 'not the plan as it stands'):
            clone_voice.generate(edited, plan_sha256=self.doc['plan_sha256'], spend_id=self.SPEND, assets_dir=self.assets,
                                 env={'ELEVENLABS_API_KEY': 'k'}, post=self.post, reserve=self.reserve, settle=self.settle)
        self.assertEqual(self.calls, [])

    def test_over_the_cap_nothing_is_requested(self):
        def refuse(*_args):
            raise SystemExit('ve: over the credit cap from Control Center')
        with self.assertRaises(SystemExit):
            self.run_it(reserve=refuse)
        self.assertEqual(self.calls, [])

    def test_one_request_of_exactly_the_plan_settled_at_what_was_charged(self):
        receipt = self.run_it()
        self.assertEqual([c[0] for c in self.calls], ['reserve', 'post', 'settle'])
        self.assertEqual(self.calls[0], ('reserve', 'elevenlabs_credits', self.doc['credits']['estimate']))
        _, url, payload, key = self.calls[1]
        self.assertEqual(url, f"https://api.elevenlabs.io/v1/text-to-speech/{CLONE['platform_ref']}?output_format=mp3_44100_128")
        self.assertEqual(payload, {'text': self.doc['text'], 'model_id': self.doc['model']})
        self.assertEqual(self.calls[2], ('settle', 'rid0001', 123.0))
        wav = self.assets / f'{TAKE}.wav'
        self.assertEqual(receipt['voice']['sha256'], sha256_file(wav))
        self.assertEqual(receipt['asset'], {**voice_asset(sha256_file(wav)), 'licence': receipt['asset']['licence'],
                                            'prompt_ref': clone_voice.PLAN_FILE, 'credits': 123.0, 'job_id': 'req-test-1'})
        self.assertEqual(receipt['credits']['charged_from'], 'character-cost')
        self.assertNotIn('test-key-not-real', json.dumps(receipt))
        # The receipt's asset is the one the spec takes: it passes the whole lint and compiles as his recording does.
        spec = short(voice=receipt['asset'])
        with served(registry(CLONE)):
            self.assertEqual(lint_codes(spec), [])
        self.assertEqual(compile_cut(spec, 'proof-tall', timed_words(), self.assets),
                         compile_cut(recorded(), 'proof-tall', timed_words(), self.assets))

    def test_a_failed_request_is_settled_at_nothing(self):
        def broken(*_args):
            raise OSError('connection reset')
        with self.assertRaises(OSError):
            self.run_it(post=broken)
        self.assertEqual(self.calls, [('reserve', 'elevenlabs_credits', self.doc['credits']['estimate']), ('settle', 'rid0001', 0)])
        self.assertFalse((self.assets / f'{TAKE}.wav').exists())

    def test_no_cost_header_settles_at_the_estimate_and_says_so(self):
        receipt = self.run_it(post=lambda *a: (self.audio, {}))
        self.assertEqual(receipt['credits']['charged'], float(self.doc['credits']['estimate']))
        self.assertIn('estimate', receipt['credits']['charged_from'])
        self.assertNotIn('job_id', receipt['asset'])


class TheCommand(unittest.TestCase):
    def setUp(self):
        (ROOT / '.cache').mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / '.cache', prefix='ve-clone-cli-')
        folder = Path(self.temp.name) / 've'
        folder.mkdir()
        self.spec = folder / 'spec.json'
        self.spec.write_text(json.dumps(short()), encoding='utf-8')
        shutil.copy(FIXTURE / 'script.words.json', folder / 'script.words.json')
        self.folder = folder

    def tearDown(self):
        self.temp.cleanup()

    def call(self, **given):
        args = Namespace(action='clone', pieces=[str(self.spec)], script=None, plan=False, generate=False, plan_sha256=None,
                         spend_id=None, assets_dir=None, out=None)
        for key, value in given.items():
            setattr(args, key, value)
        out, err = io.StringIO(), io.StringIO()
        with served(registry(CLONE)), redirect_stdout(out), redirect_stderr(err):
            code = ve.cmd_voice(args)
        return code, out.getvalue(), err.getvalue()

    def test_the_plan_prints_the_exact_generation_and_spends_nothing(self):
        code, out, err = self.call(plan=True)
        self.assertEqual(code, 0, err)
        doc = load_json(self.folder / clone_voice.PLAN_FILE)
        self.assertIn(doc['text'], out)
        self.assertIn(CLONE['platform_ref'], out)
        self.assertIn(doc['model'], out)
        self.assertIn(f"about {doc['credits']['estimate']} ElevenLabs credits", out)
        self.assertIn(doc['plan_sha256'], out)
        self.assertIn('nothing generated or spent', out)
        self.assertFalse((self.folder / clone_voice.RECEIPT_FILE).exists())

    def test_generate_without_the_key_stops_before_anything_is_spent(self):
        _, out, _ = self.call()
        digest = load_json(self.folder / clone_voice.PLAN_FILE)['plan_sha256']
        with patch.dict('os.environ', {}, clear=False) as env, \
                patch.object(clone_voice, 'request', side_effect=AssertionError('no request')) as request:
            env.pop('ELEVENLABS_API_KEY', None)
            code, _, err = self.call(generate=True, plan_sha256=digest, spend_id=GenerateRunsOnlyThePlanThroughTheCreditRoute.SPEND,
                                     assets_dir=str(Path(self.temp.name) / 'assets'))
        self.assertEqual(code, 1)
        self.assertIn('holds no ELEVENLABS_API_KEY', err)
        request.assert_not_called()

    def test_a_hero_piece_gets_no_plan(self):
        spec = short(SERIES_DAY)
        self.spec.write_text(json.dumps(spec), encoding='utf-8')
        code, _, err = self.call()
        self.assertEqual(code, 1)
        self.assertIn('hero piece', err)
        self.assertFalse((self.folder / clone_voice.PLAN_FILE).exists())


if __name__ == '__main__':
    unittest.main()
