"""ve lint must refuse every Friday 23 Oct failure class that a spec can carry (docs/plans/2026-10-23-friday/audit-2026-10-27),
and pass the 'my test' proof spec. Each mutation names the failure it reproduces."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts' / 'post-pack'))
from velib.lint import lint, no_name_pattern  # noqa: E402

FIXTURE = json.loads((ROOT / 'fixtures/ve/my-test-19s/spec.json').read_text(encoding='utf-8'))


def lint_lines(spec: dict) -> list[str]:
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp) / 'spec.json'
        path.write_text(json.dumps(spec), encoding='utf-8')
        _, problems = lint(path)
    return problems


def codes_for(spec: dict) -> list[str]:
    return [p.split(' ', 1)[0] for p in lint_lines(spec)]


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

    def test_a_move_with_no_sound_is_fine_and_a_second_sound_is_refused_from_9_nov(self):
        # THE_BAR ruling 11 (Krish, 29 Oct 2026): "Only the big moment" gets a sound; every other move is silent.
        found = codes_for(mutate(lambda s: s['cuts']['proof-tall']['beats'][2]['events'][0].pop('sfx')))
        self.assertFalse(any(code.startswith('sound.event_sfx') for code in found))
        self.assertFalse(any(code.startswith('sound.one_moment') for code in codes_for(copy.deepcopy(FIXTURE))),
                         'a spec with no publish day from 9 Nov is not bound')
        self.assertRefused(mutate(lambda s: s.update(publish_day='2026-11-11')), 'sound.one_moment')

    def test_IR102_episode_bed_under_a_voiceover(self):
        self.assertRefused(mutate(lambda s: s['audio']['bed'].update(mode='episode')), 'sound.bed_continuous')

    def test_episode_bed_under_a_voiceover_is_allowed(self):
        found = codes_for(mutate(lambda s: s['audio']['bed'].update(mode='episode_bed')))
        self.assertNotIn('sound.bed_continuous', found)
        self.assertNotIn('SCHEMA', found)

    def test_a_long_cut_carries_the_episode_bed(self):
        # Krish, Gate 2, 2026-10-30, of a ducked long cut: "It's not professional at all."
        def long_ducked(s):
            whole_tall(s)
            s['cuts']['proof-tall']['max_s'] = 330
            s['audio']['bed'].update(mode='ducked')
        self.assertRefused(mutate(long_ducked), 'sound.long_cut_bed')

        def long_episode(s):
            long_ducked(s)
            s['audio']['bed'].update(mode='episode_bed')
        self.assertNotIn('sound.long_cut_bed', codes_for(mutate(long_episode)))

    def test_ducked_bed_is_refused_on_a_short_too(self):
        # Krish, Gate 2, 2026-10-30: "Same issue with the 90-second video on that day"
        found = codes_for(mutate(lambda s: s['audio']['bed'].update(mode='ducked')))
        self.assertIn('sound.bed_steady', found)
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


class NoNameOnScreen(unittest.TestCase):
    """Krish, 28 Oct 2026: "Remember, no content refers to Krish, ever." Any Krish on screen is refused, with no
    override (he picked "Yes, block it"); the records that name him by right are never read."""

    def assertNamed(self, fn, where):
        found = [p for p in lint_lines(mutate(fn)) if p.startswith('brand.no_name ')]
        self.assertTrue(any(f' {where}:' in p for p in found), f'expected brand.no_name at {where}, got {found}')

    def test_his_name_in_each_public_field(self):
        self.assertNamed(lambda s: s['datasets'][0].update(producer_label="KRISH'S TEST · 23 OCT"), 'datasets.0.producer_label')
        self.assertNamed(lambda s: s['datasets'][1].update(unit='runs Krish watched'), 'datasets.1.unit')
        self.assertNamed(lambda s: s['datasets'][0]['rows'][0].update(label='Krishan Raja · Xinjiang'), 'datasets.0.rows.0.label')
        self.assertNamed(lambda s: s['objects'][1]['params'].update(text='KRISH’S CONFIDENCE'), 'objects.1.params.text')
        self.assertNamed(lambda s: s['objects'][0]['params']['cols'][0].update(label='@TheRealKrisho'), 'objects.0.params.cols.0.label')
        self.assertNamed(lambda s: s['objects'][2]['params'].update(outlet='krishraja.com'), 'objects.2.params.outlet')
        self.assertNamed(lambda s: s['call'].update(statement='Krish thinks one more country will fund its own model.'), 'call.statement')

    def test_records_files_ids_and_other_names_pass(self):
        def records(s):
            s['objects'][2]['params']['src'] = 'krish-face.mp4'
            s['objects'][0]['params']['rows'][0]['id'] = 'krish'
            s['objects'][0]['meaning'] = "Krish's own test grid"
            s['assets'][0]['licence'] = "Krish's own screen capture"
            s['objects'][1]['params']['text'] = 'ARVIND KRISHNA · RAJA KODURI · OUR TEST'
        self.assertEqual([p for p in lint_lines(mutate(records)) if p.startswith('brand.no_name ')], [])
        self.assertIn('krish-test', [d['id'] for d in FIXTURE['datasets']])

    def test_one_pattern_copy_lints_no_name_once_it_exists(self):
        with tempfile.TemporaryDirectory() as temp:
            (Path(temp) / 'copy-lint.json').write_text(json.dumps({'patterns': [
                {'id': 'no_name', 'regex': r'\bzed\b', 'flags': 'i', 'applies_to': ['video_onscreen']}]}), encoding='utf-8')
            with patch('velib.lint.CONFIG', Path(temp) / 've'):
                pattern = no_name_pattern()
        self.assertTrue(pattern.search('ZED'))
        self.assertFalse(pattern.search('Krish'))


GEORGIA = {'id': '6f1c0a52-3b7e-4c1d-9a8e-0d2f4b6a8c10', 'card': 'instagram_DePHDr_jRed', 'for': ['captions'], 'drive_id': '1Fs7Mq2kiYyAMWgPkLApeMWcfSCBmGNH9',
           'takeaway': 'one word at a time, white, at chest height, never over the face, held yellow title'}
JACK = {'id': '0b9e7d24-5a61-4f3c-8e2d-1c4a6b8d0e21', 'card': 'instagram_DeZuQ7-lATg', 'for': ['look', 'motion'], 'drive_id': '1RgI6ypWidvR_0KbP0LM0igbUEbU-qkWe',
        'takeaway': 'product-UI cards at 80 to 90 percent width with glow, settling in four frames'}


def dated(spec, refs=None):
    spec['publish_day'] = '2026-11-09'
    if refs is not None:
        spec['brand']['references'] = refs


class ReferencesAreRequired(unittest.TestCase):
    """Krish, 2026-11-03: "I even gave literal inspiration in the inspiration board on the quality I expect"."""

    def test_a_new_piece_without_references_is_refused(self):
        found = [p for p in lint_lines(mutate(dated)) if p.startswith('reference.required')]
        self.assertEqual(len(found), 3, found)

    def test_look_motion_and_captions_cards_pass(self):
        found = codes_for(mutate(lambda s: dated(s, [GEORGIA, JACK])))
        self.assertNotIn('reference.required', found)
        self.assertNotIn('reference.id', found)
        self.assertNotIn('reference.offered', found)

    def test_a_caption_card_alone_is_refused_for_look_and_motion(self):
        found = [p for p in lint_lines(mutate(lambda s: dated(s, [GEORGIA]))) if p.startswith('reference.required')]
        self.assertEqual(len(found), 2)
        self.assertTrue(any('for look' in p for p in found) and any('for motion' in p for p in found))

    def test_a_reference_without_a_drive_id_fails_the_schema(self):
        bad = {k: v for k, v in JACK.items() if k != 'drive_id'}
        found = lint_lines(mutate(lambda s: dated(s, [GEORGIA, bad])))
        self.assertTrue(any('drive_id' in line for line in found), found)

    def test_a_new_piece_names_one_motion_style_from_the_bank(self):
        # The same rule the creative direction holds (creative_direction.motion_problems), on the ve route too.
        self.assertIn('motion.required', codes_for(mutate(lambda s: dated(s, [GEORGIA, JACK]))))
        module = next(iter(__import__('creative_direction').motion_modules()))
        good = mutate(lambda s: (dated(s, [GEORGIA, JACK]), s.update(style={'motion': {
            'module': module, 'reason': 'the money moves on screen as he names it'}})))
        self.assertNotIn('motion.required', codes_for(good))
        bad = mutate(lambda s: (dated(s, [GEORGIA, JACK]), s.update(style={'motion': {'module': 'not-a-style', 'reason': 'x y z w'}})))
        self.assertIn('motion.required', codes_for(bad))
    def test_a_motion_style_the_renderer_cannot_draw_is_refused(self):
        # Fleet audit 14 Nov (ve-1): a style waiting on its device rendered in the house motion without a word.
        styled = lambda module: mutate(lambda s: (dated(s, [GEORGIA, JACK]), s.update(style={'motion': {
            'module': module, 'reason': 'the money moves on screen as he names it'}})))
        self.assertIn('motion.not_drawable', codes_for(styled('ladder')))
        self.assertIn('motion.not_drawable', codes_for(styled('living-screen')))
        self.assertNotIn('motion.not_drawable', codes_for(styled('eating-jobs-ladder')))

    def test_a_reference_without_its_board_id_is_refused(self):
        bare = {k: v for k, v in JACK.items() if k != 'id'}
        found = [p for p in lint_lines(mutate(lambda s: dated(s, [GEORGIA, bare]))) if p.startswith('reference.id')]
        self.assertEqual(len(found), 1, found)
        self.assertIn('instagram_DeZuQ7-lATg', found[0])

    def test_a_card_offered_by_ve_init_must_be_confirmed(self):
        offered = dict(JACK, offered=True)
        self.assertIn('reference.offered', codes_for(mutate(lambda s: dated(s, [GEORGIA, offered]))))
        confirmed = dict(JACK, offered=False)
        self.assertNotIn('reference.offered', codes_for(mutate(lambda s: dated(s, [GEORGIA, confirmed]))))

    def test_one_card_id_twice_is_refused(self):
        twin = dict(GEORGIA, card='instagram_Twin1234', **{'for': ['look']})
        found = codes_for(mutate(lambda s: dated(s, [GEORGIA, twin, JACK])))
        self.assertIn('reference.duplicate', found)

    def test_an_id_that_is_no_uuid_fails_the_schema(self):
        bad = dict(JACK, id='instagram_DeZuQ7-lATg')
        found = lint_lines(mutate(lambda s: dated(s, [GEORGIA, bad])))
        self.assertTrue(any('Inspiration card id' in line for line in found), found)

    def test_pieces_in_flight_on_5_nov_are_exempt(self):
        spec = mutate(lambda s: s.update(publish_day='2026-11-05'))
        self.assertNotIn('reference.required', codes_for(spec))


class WordCaptionsByDefault(unittest.TestCase):
    """Signed by Krish, 3 Nov 2026: word captions are the face-with-proof default."""

    def test_face_with_proof_in_house_captions_is_refused_and_word_passes(self):
        house = mutate(lambda s: (dated(s, [GEORGIA, JACK]), s.update(format='face-with-proof'), s['brand'].update(captions='house')))
        word = mutate(lambda s: (dated(s, [GEORGIA, JACK]), s.update(format='face-with-proof'), s['brand'].update(captions='word')))
        self.assertIn('captions.word_default', codes_for(house))
        self.assertNotIn('captions.word_default', codes_for(word))


class StampsNeverCarryTheHero(unittest.TestCase):
    def test_a_stamp_hero_is_refused(self):
        spec = mutate(lambda s: s['signature']['hero'].update(device='stamp'))
        self.assertIn('motion.stamp_not_hero', codes_for(spec))


if __name__ == '__main__':
    unittest.main()
