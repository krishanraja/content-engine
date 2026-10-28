"""ve lint must refuse every Friday 23 Oct failure class that a spec can carry (docs/plans/2026-10-23-friday/audit-2026-10-27),
and pass the 'my test' proof spec. Each mutation names the failure it reproduces."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.lint import lint  # noqa: E402

FIXTURE = json.loads((ROOT / 'fixtures/ve/my-test-19s/spec.json').read_text(encoding='utf-8'))


def codes_for(spec: dict) -> list[str]:
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp) / 'spec.json'
        path.write_text(json.dumps(spec), encoding='utf-8')
        _, problems = lint(path)
    return [p.split(' ', 1)[0] for p in problems]


def mutate(fn) -> dict:
    spec = copy.deepcopy(FIXTURE)
    fn(spec)
    return spec


def whole_tall(spec):
    """Make the tall cut a whole cut (not a proof excerpt) so whole-cut story rules apply."""
    spec['cuts']['proof-tall']['excerpt'] = False


class FridayFailuresAreRefused(unittest.TestCase):
    def assertRefused(self, spec, code):
        found = codes_for(spec)
        self.assertIn(code, found, f'expected {code}, got {found}')

    def test_the_proof_spec_is_clean(self):
        self.assertEqual(codes_for(FIXTURE), [])

    def test_F08_captions_switched_off(self):
        self.assertRefused(mutate(lambda s: s['brand'].update(captions='none')), 'SCHEMA')

    def test_F07_coral_family_hex_used_as_a_failure_colour(self):
        self.assertRefused(mutate(lambda s: s['cuts']['proof-tall']['beats'][2]['events'][0].update(to_state='fail cells in #ff9b85')), 'brand.no_hex')

    def test_IR48_mind_the_gap_without_a_dated_call(self):
        self.assertRefused(mutate(lambda s: s.pop('call')), 'SCHEMA')

    def test_IR48_whole_cut_without_a_call_beat(self):
        self.assertRefused(mutate(whole_tall), 'story.call')

    def test_R46_generated_picture_used_as_evidence(self):
        asset = {'id': 'fake-shot', 'kind': 'screenshot', 'origin': 'generated', 'path': 'x.png', 'sha256': '0' * 64,
                 'licence': 'generated', 'tool': 'imagegen'}
        self.assertRefused(mutate(lambda s: s['assets'].append(asset)), 'SCHEMA')

    def test_IR49_cc_by_photo_without_its_credit(self):
        asset = {'id': 'musk', 'kind': 'photo', 'origin': 'licensed', 'path': 'musk.jpg', 'sha256': '1' * 64, 'licence': 'CC BY-SA 3.0'}
        self.assertRefused(mutate(lambda s: s['assets'].append(asset)), 'SCHEMA')

    def test_F05_entrance_then_hold(self):
        def hold(s):
            beats = s['cuts']['proof-tall']['beats']
            beats[2]['uses'] = list(beats[1]['uses'])
            beats[2]['events'] = []
        self.assertRefused(mutate(hold), 'creative.no_repeat')
        self.assertRefused(mutate(hold), 'motion.event_cadence')

    def test_F06_number_shown_with_no_data_device(self):
        def bare(s):
            beat = s['cuts']['proof-tall']['beats'][3]
            beat['point'] = 'DeepSeek fails 35% of the time on this prompt'
            beat['uses'] = ['deletion']
            beat['events'] = [e for e in beat['events'] if e['obj'] == 'deletion']
        self.assertRefused(mutate(bare), 'creative.decision_engine')

    def test_F06_data_device_without_a_named_producer(self):
        self.assertRefused(mutate(lambda s: s['objects'][3].pop('dataset')), 'brand.digit_producer')

    def test_IR135_visible_pop_with_no_sound(self):
        self.assertRefused(mutate(lambda s: s['cuts']['proof-tall']['beats'][2]['events'][0].pop('sfx')), 'sound.event_sfx')

    def test_IR102_episode_bed_under_a_voiceover(self):
        self.assertRefused(mutate(lambda s: s['audio']['bed'].update(mode='episode')), 'sound.bed_continuous')

    def test_ducked_bed_under_a_voiceover_is_allowed(self):
        found = codes_for(mutate(lambda s: s['audio']['bed'].update(mode='ducked')))
        self.assertNotIn('sound.bed_continuous', found)
        self.assertNotIn('SCHEMA', found)

    def test_R19_speed_change_without_krish_saying_so(self):
        self.assertRefused(mutate(lambda s: s['cuts']['proof-tall']['edit'].update(speed=1.12)), 'SCHEMA')

    def test_R18_short_over_89_seconds(self):
        self.assertRefused(mutate(lambda s: s['cuts']['proof-tall'].update(max_s=95)), 'dialogue.short_max')

    def test_IR43_hook_lands_late(self):
        def late(s):
            first = s['cuts']['proof-tall']['beats'][0]
            first['events'] = [e for e in first['events'] if e['at_w'] > 4]
        self.assertRefused(mutate(late), 'story.hook_event')

    def test_an_object_that_never_enters(self):
        def no_enter(s):
            beat = s['cuts']['proof-tall']['beats'][4]
            beat['events'] = [e for e in beat['events'] if not (e['obj'] == 'runs' and e['verb'] == 'enter')]
        self.assertRefused(mutate(no_enter), 'motion.enters')

    def test_event_on_an_object_the_beat_does_not_use(self):
        self.assertRefused(mutate(lambda s: s['cuts']['proof-tall']['beats'][0]['uses'].remove('chip')), 'motion.carry')


if __name__ == '__main__':
    unittest.main()
