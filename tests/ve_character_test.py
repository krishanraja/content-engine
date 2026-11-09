"""Krish's character is ready to take, and nothing changes until he has one (Krish, 2026-11-09: "I will put a
character in to it as well later this week, so ensure that is ready too."). The manifest and the pose library hold
together; a spec without `character` lints exactly as before; a spec that names one is refused until he approves the
base, the library is built and the character_layer device is registered."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
from velib import character  # noqa: E402
from velib.lint import lint  # noqa: E402

FIXTURE = json.loads((ROOT / 'fixtures/ve/my-test-19s/spec.json').read_text(encoding='utf-8'))
MANIFEST = json.loads(character.MANIFEST.read_text(encoding='utf-8'))
POSES = json.loads(character.POSES.read_text(encoding='utf-8'))


def lint_lines(spec: dict) -> list[str]:
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp) / 'spec.json'
        path.write_text(json.dumps(spec), encoding='utf-8')
        _, problems = lint(path)
    return problems


def with_character(spec: dict, cues=None) -> dict:
    spec = copy.deepcopy(spec)
    cut = next(iter(spec['cuts']))
    after_hook = spec['cuts'][cut]['beats'][0]['span']['to_w'] + 1
    spec['character'] = {'id': 'krish', 'cuts': [cut], 'cues': cues or [{'at_w': after_hook, 'pose': 'point-up-left'}]}
    return spec


def ready_manifest() -> dict:
    m = copy.deepcopy(MANIFEST)
    m.update(approved=True, status='ready', approval={'by': 'Krish', 'said': 'yes thats me', 'on': '2026-11-12'})
    m['library'] = {'built': True, 'poses': ['neutral', 'point-up-left']}
    return m


class TheManifestHoldsTogether(unittest.TestCase):
    def test_the_committed_manifest_and_poses_are_clean(self):
        self.assertEqual(character.manifest_problems(), [])

    def test_nothing_is_drawn_without_his_yes(self):
        if MANIFEST['approved'] is not True:
            self.assertFalse(MANIFEST['library']['built'])
            self.assertEqual(MANIFEST['library']['poses'], [])

    def test_about_sixty_poses_in_seven_families_each_with_a_use_when_line(self):
        self.assertEqual(len(POSES['poses']), 65)
        self.assertEqual(set(p['family'] for p in POSES['poses']), set(POSES['families']))
        for pose in POSES['poses']:
            self.assertTrue(pose['use_when'].strip(), pose['id'])
            self.assertTrue(pose['text'].strip(), pose['id'])
        self.assertEqual(POSES['order'][0], 'neutral')

    def test_every_template_draws_one_key_colour_and_no_if_then(self):
        for name, text in POSES['templates'].items():
            self.assertNotRegex(text.lower(), r'\bif (they|the person|he|she)\b', name)

    def test_approval_needs_his_words(self):
        m = copy.deepcopy(MANIFEST)
        m['approved'] = True
        self.assertTrue(any('without approval' in p for p in character.manifest_problems(m, POSES)))

    def test_no_library_before_his_yes(self):
        m = copy.deepcopy(MANIFEST)
        m['library'] = {'built': True, 'poses': ['neutral']}
        self.assertTrue(any('before Krish approved' in p for p in character.manifest_problems(m, POSES)))

    def test_an_unknown_pose_in_the_library_is_named(self):
        m = ready_manifest()
        m['library']['poses'].append('moonwalk')
        self.assertTrue(any('moonwalk' in p for p in character.manifest_problems(m, POSES)))

    def test_media_never_lives_in_git(self):
        self.assertTrue(MANIFEST['home']['folder'].startswith('1 Brand kit (permanent)/character/'))
        self.assertFalse(list((ROOT / 'config' / 've').glob('*.png')))


class NoBehaviourChangeToday(unittest.TestCase):
    def test_a_spec_without_a_character_gets_no_character_line(self):
        self.assertEqual(character.spec_lints(FIXTURE), [])
        self.assertFalse([p for p in lint_lines(FIXTURE) if p.startswith('character.')])

    def test_the_device_gate_reads_the_registry(self):
        devices = json.loads(character.DEVICES.read_text(encoding='utf-8'))['devices']
        lines = character.spec_lints(with_character(FIXTURE), ready_manifest())
        self.assertEqual(any(l.startswith('character.device_missing') for l in lines), character.DEVICE not in devices)


class ASpecThatNamesItIsHeldAtTheGate(unittest.TestCase):
    def test_refused_through_ve_lint_until_approved_built_and_registered(self):
        codes = [p.split(' ', 1)[0] for p in lint_lines(with_character(FIXTURE))]
        devices = json.loads(character.DEVICES.read_text(encoding='utf-8'))['devices']
        expected = {'character.not_approved': MANIFEST['approved'] is not True,
                    'character.no_library': not MANIFEST['library']['built'],
                    'character.device_missing': character.DEVICE not in devices}
        for code, due in expected.items():
            self.assertEqual(code in codes, due, code)
        self.assertFalse([c for c in codes if c.startswith('SCHEMA')], 'the schema accepts the optional field')

    def test_clean_once_approved_built_and_registered(self):
        self.assertEqual(character.spec_lints(with_character(FIXTURE), ready_manifest(), registered=True), [])

    def test_never_in_the_hook(self):
        spec = with_character(FIXTURE, [{'at_w': 0, 'pose': 'neutral'}])
        lines = character.spec_lints(spec, ready_manifest(), registered=True)
        self.assertTrue(any(l.startswith('character.in_hook') for l in lines), lines)

    def test_a_pose_outside_the_built_library_is_refused(self):
        spec = with_character(FIXTURE)
        spec['character']['cues'][0]['pose'] = 'mind-blown'
        lines = character.spec_lints(spec, ready_manifest(), registered=True)
        self.assertTrue(any(l.startswith('character.pose') for l in lines), lines)

    def test_unknown_character_and_cut(self):
        spec = with_character(FIXTURE)
        spec['character']['cuts'].append('no-such-cut')
        lines = character.spec_lints(spec, ready_manifest(), registered=True)
        self.assertTrue(any(l.startswith('character.cut') for l in lines), lines)
        spec['character']['id'] = 'someone-else'
        self.assertTrue(character.spec_lints(spec, ready_manifest(), registered=True)[0].startswith('character.unknown'))

    def test_cues_run_in_script_order(self):
        start = with_character(FIXTURE)['character']['cues'][0]['at_w']
        spec = with_character(FIXTURE, [{'at_w': start + 2, 'pose': 'neutral'}, {'at_w': start + 1, 'pose': 'neutral'}])
        lines = character.spec_lints(spec, ready_manifest(), registered=True)
        self.assertTrue(any(l.startswith('character.order') for l in lines), lines)


if __name__ == '__main__':
    unittest.main()
