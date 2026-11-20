"""The quality floor (Krish, 2026-11-19: "Visually, motion, post-production, and everything is a zero out of ten. I'm going
to need you to make sure that this can never happen again."; and of the Wed short: "the card generates over my face, the
captions are awful, and the generated animations are tacky and not art directed well within the space at all").

Each rule is shown refusing its bad case and passing its good one:
- the pace floor holds a cut with any `ve pace` measure below every reference (the rejected long's 2.21 events a second
  and 5% of the frame active), in readiness, so ve status never says READY, prints one held line, and ve file refuses;
- no dead panel on a staged cut for more than 1.5 s;
- the face keep-out compile writes from the take's face track, and its refusal of a caption or a device box on it;
- recipes rated 9 or more (or the one named experiment), captions and generated assets only from the recipe, binding
  pieces frozen from 23 Nov 2026.
Synthetic specs, props and measurements; nothing is rendered."""
from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from argparse import Namespace
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import faceflags, filing, floor, judge, keepout, packet  # noqa: E402
from velib.common import write_json  # noqa: E402

REFS = json.loads((ROOT / 'config' / 've' / 'pace-references.json').read_text(encoding='utf-8'))
ALL_REFS = REFS['references'] + REFS.get('house', [])


def card(**over):
    """A cut measured inside every reference's range, with `over` laid on it."""
    mid = {k: sorted(r[k] for r in ALL_REFS)[len(ALL_REFS) // 2] for k in floor_keys()}
    return {'file': 'cut.mp4', **mid, **over}


def floor_keys():
    from velib import pace
    return pace.SUMMARY


class PaceFloorTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.video = self.dir / 'long.mp4'
        self.video.write_bytes(b'synthetic cut')

    def test_the_rejected_long_is_held_by_name(self):
        rejected = card(events_per_s=2.21, active_frame=0.05, used_frame=0.31)
        found = floor.pace_problems(self.video, 'a' * 64, self.dir, 'long', measure_fn=lambda _v: dict(rejected))
        self.assertEqual(len(found), 1)
        self.assertIn('events/s 2.21', found[0])
        self.assertIn('frame active 0.05', found[0])
        self.assertIn('below every reference', found[0])

    def test_a_cut_inside_his_references_passes(self):
        self.assertEqual(floor.pace_problems(self.video, 'b' * 64, self.dir, 'long', measure_fn=lambda _v: card()), [])

    def test_a_cut_nobody_could_measure_is_held_not_passed(self):
        def broken(_v):
            raise ValueError('under a second of picture decoded')
        found = floor.pace_problems(self.video, 'c' * 64, self.dir, 'long', measure_fn=broken)
        self.assertEqual(len(found), 1)
        self.assertIn('pace not measured', found[0])

    def test_the_measure_is_kept_for_this_file_only(self):
        calls = []

        def measure(_v):
            calls.append(1)
            return card()
        floor.pace_problems(self.video, 'd' * 64, self.dir, 'long', measure_fn=measure)
        floor.pace_problems(self.video, 'd' * 64, self.dir, 'long', measure_fn=measure)
        self.assertEqual(len(calls), 1)
        floor.pace_problems(self.video, 'e' * 64, self.dir, 'long', measure_fn=measure)
        self.assertEqual(len(calls), 2, 'another file is measured again')

    def _ready(self, held):
        with patch.object(packet, 'mechanical', return_value=([], {}, self.video, 'f' * 64)), \
                patch.object(packet, 'design', return_value=[]), \
                patch('velib.codex_minimum.problems', return_value=[]), \
                patch.object(floor, 'held_problems', return_value=held):
            return packet.readiness({'cuts': {'long': {}}}, 'long', self.dir), filing.readiness({'cuts': {'long': {}}}, 'long', self.dir)

    def test_readiness_and_filing_hold_a_cut_below_the_floor(self):
        state, (reasons, _video, _digest) = self._ready(['below the floor: events/s 2.21 (his references 2.87 .. 4.6) is below every reference he keeps'])
        self.assertTrue(state['floor'])
        self.assertTrue(any('below the floor' in r for r in reasons), 've file refuses it')
        state, (reasons, _video, _digest) = self._ready([])
        self.assertEqual(state['floor'], [])
        self.assertEqual(reasons, [])

    def test_status_prints_one_held_line_never_a_list_of_patches(self):
        import ve
        spec = {'piece_id': 'p', 'cuts': {'long': {}}}
        held = {'mechanical': [], 'design': [], 'final': [], 'codex': [], 'video': self.video, 'digest': 'f' * 64,
                'floor': ['below the floor: events/s 2.21 (his references 2.87 .. 4.6) is below every reference he keeps']}
        out = io.StringIO()
        with patch.object(ve, 'spec_path_for', return_value=self.dir / 'spec.json'), \
                patch('velib.lint.lint', return_value=(spec, [])), \
                patch.object(packet, 'readiness', return_value=held), redirect_stdout(out):
            code = ve.cmd_status(Namespace(piece='p'))
        lines = [line for line in out.getvalue().splitlines() if line.startswith('long')]
        self.assertEqual(code, 1)
        self.assertEqual(len(lines), 1, out.getvalue())
        self.assertTrue(lines[0].startswith('long: held: below the floor'))
        self.assertNotIn('READY', out.getvalue().replace('NOT READY', ''))


def beat(bid, frm, to, uses=(), events=(), layout='F1', **extra):
    return {'id': bid, 'role': 'anchor', 'span': {'from_w': frm, 'to_w': to}, 'layout': layout, 'uses': list(uses),
            'events': list(events), 'plate': {'source': 'take'}, **extra}


def staged_spec(beats, mode='pillar', aspect='16:9'):
    return {'style': {'layout': {'mode': mode, 'reason': 'test'}},
            'objects': [{'obj': 'stat', 'device': 'kinetic_stat'}, {'obj': 'tag', 'device': 'stamp'}],
            'cuts': {'long': {'aspect': aspect, 'take': 'take-1', 'beats': beats}}}


class DeadPanelTest(unittest.TestCase):
    def test_a_panel_with_nothing_beside_his_take_is_refused(self):
        found = floor.dead_panel_lints(staged_spec([beat('face', 0, 12)]))
        self.assertEqual(len(found), 1)
        self.assertIn('floor.dead_panel cuts.long.beats.0', found[0])

    def test_a_backdrop_alone_is_still_a_dead_panel(self):
        found = floor.dead_panel_lints(staged_spec([beat('face', 0, 12, backdrop='asset:blur')]))
        self.assertIn('only a backdrop', found[0])

    def test_a_stamp_alone_does_not_fill_the_panel(self):
        spec = staged_spec([beat('face', 0, 12, uses=['tag'], events=[{'at_w': 0, 'obj': 'tag', 'verb': 'stamp'}])])
        self.assertTrue(floor.dead_panel_lints(spec))

    def test_a_device_entering_inside_a_second_and_a_half_passes(self):
        spec = staged_spec([beat('face', 0, 12, uses=['stat'], events=[{'at_w': 2, 'obj': 'stat', 'verb': 'enter'}]),
                            beat('next', 13, 30, uses=['stat'], events=[{'at_w': 20, 'obj': 'stat', 'verb': 'count_to'}])])
        self.assertEqual(floor.dead_panel_lints(spec), [], 'carried into the next beat, it stays on screen')

    def test_a_device_entering_late_is_refused(self):
        spec = staged_spec([beat('face', 0, 20, uses=['stat'], events=[{'at_w': 10, 'obj': 'stat', 'verb': 'enter'}])])
        self.assertIn('about 3.8 s', floor.dead_panel_lints(spec)[0])

    def test_ve_lint_asks_it_only_of_pieces_frozen_from_the_date(self):
        spec = staged_spec([beat('face', 0, 12)])
        directory = Path(tempfile.mkdtemp())
        write_json(directory / 'engine.json', {'at': '2026-11-19T09:00:00Z'})
        with patch.object(floor, 'recipe_lints', return_value=[]), patch.object(keepout, 'missing_lints', return_value=[]), \
                patch('velib.verdict.ve_dir', return_value=directory):
            self.assertEqual(floor.lints(spec, directory / 'spec.json'), [], 'a piece in production is never blocked by it')
            write_json(directory / 'engine.json', {'at': '2026-11-23T09:00:00Z'})
            self.assertTrue(floor.lints(spec, directory / 'spec.json'))

    def test_an_unstaged_cut_and_a_tall_pillar_are_not_asked(self):
        self.assertEqual(floor.dead_panel_lints(staged_spec([beat('face', 0, 12)], mode='fill')), [])
        self.assertEqual(floor.dead_panel_lints(staged_spec([beat('face', 0, 12)], aspect='9:16')), [])


def props_for(aspect='9:16', layout=None, captions=None, style='word'):
    return {'aspect': aspect, 'captionStyle': style, **({'layout': {'mode': layout}} if layout else {}),
            'beats': [{'id': 'hook', 'layout': 'F1', 'fromFrame': 0, 'toFrame': 90}],
            'captions': captions if captions is not None else [{'fromFrame': 0, 'toFrame': 90, 'words': [{'text': 'Hello', 'atFrame': 0}]}]}


def face_spec(uses=(), backdrop=None):
    b = beat('hook', 0, 8, uses=uses)
    if backdrop:
        b['backdrop'] = backdrop
    return {'objects': [{'obj': 'stat', 'device': 'kinetic_stat'}], 'audio': {'master': 'take'},
            'cuts': {'short': {'aspect': '9:16', 'take': 'take-1', 'beats': [b]}}}


TAKE = {'width': 1080, 'height': 1920}


class FaceKeepOutTest(unittest.TestCase):
    def test_compile_writes_the_keep_out_and_lets_a_clear_caption_through(self):
        props = props_for()
        high = [{'t': 0.5, 'box': [0.35, 0.15, 0.3, 0.2]}, {'t': 1.5, 'box': [0.36, 0.16, 0.3, 0.2]}]
        problems, report = keepout.apply(props, face_spec(), 'short', edl=None, tracks={'take-1': high}, take_frame=TAKE)
        self.assertEqual(problems, [])
        box = props['beats'][0]['faceKeepOut']
        self.assertLess(box['top'], 1920 * 0.15)
        self.assertEqual(report['beats'], 1)

    def test_a_caption_on_his_face_is_refused(self):
        low = [{'t': 0.5, 'box': [0.3, 0.55, 0.4, 0.2]}]   # his face low in the frame, where the word caption sits
        problems, _ = keepout.apply(props_for(), face_spec(), 'short', edl=None, tracks={'take-1': low}, take_frame=TAKE)
        self.assertTrue(problems)
        self.assertIn('the caption "Hello"', problems[0])

    def test_a_device_region_on_his_face_is_refused_on_the_tray(self):
        chest = [{'t': 0.5, 'box': [0.1, 0.48, 0.3, 0.2]}]
        problems, _ = keepout.apply(props_for(layout='tray', captions=[]), face_spec(uses=['stat']), 'short', edl=None,
                                    tracks={'take-1': chest}, take_frame=TAKE)
        self.assertTrue(any("devices' region" in p for p in problems))

    def test_the_edl_maps_the_take_to_the_cut(self):
        edl = {'segments': [{'take': 'take-1', 'src_in_s': 10.0, 'src_out_s': 20.0, 'out_in_s': 0.0}]}
        self.assertEqual(keepout.cut_times(11.0, 'take-1', edl, 'take-1'), [1.0])
        self.assertEqual(keepout.cut_times(5.0, 'take-1', edl, 'take-1'), [])

    def test_no_track_writes_nothing_and_says_so(self):
        props = props_for()
        problems, report = keepout.apply(props, face_spec(), 'short', edl=None, tracks=None, take_frame=TAKE)
        self.assertEqual((problems, report['source']), ([], 'missing'))
        self.assertNotIn('faceKeepOut', props['beats'][0])

    def test_a_missing_track_is_named_by_expect_and_refused_from_the_date(self):
        directory = Path(tempfile.mkdtemp())
        spec = face_spec()
        self.assertIn('No face track for take take-1', keepout.missing_line(spec, directory))
        self.assertEqual(keepout.missing_lints(spec, directory, today='2026-11-20'), [])
        self.assertIn('floor.face_track', keepout.missing_lints(spec, directory, today='2026-11-23')[0])
        write_json(directory / 'faces.take-1.json', {'boxes': [{'t': 0.0, 'box': [0.3, 0.2, 0.3, 0.2]}]})
        self.assertEqual(keepout.missing_lints(spec, directory, today='2026-11-23'), [])
        self.assertIsNone(keepout.missing_line(spec, directory))

    def test_the_staged_boxes_are_kit_stagings_own_numbers(self):
        source = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'kit' / 'staging.ts').read_text(encoding='utf-8')
        for literal in ('take: { left: 600, top: 980, width: 420, height: 700', 'const seam = 1000', 'const edge = 1236',
                        '{ left: 60, top: 900, width: 600, height: 600 }', 'const seam = 1152',
                        'take: { left: 1400, top: 560, width: 440, height: 460', 'const edge = 880',
                        '{ left: 96, top: 480, width: 900, height: 540 }', 'left: 96, top: 140, width: seam - 96 - 60, height: 800',
                        'left: 96, top: 120, width: 1260', 'Math.round(1080 * 9 / 16)'):
            self.assertIn(literal, source)
        self.assertEqual(keepout.theme_bands()['9:16']['lower'], (70, 990, 800, 330))
        self.assertEqual(keepout.theme_bands()['16:9']['upper'], (192, 108, 1536, 240))

    def test_the_face_box_comes_from_the_landmarks(self):
        points = [SimpleNamespace(x=0.4, y=0.2), SimpleNamespace(x=0.6, y=0.45), SimpleNamespace(x=0.5, y=0.3)]
        self.assertEqual(faceflags.landmark_box(points), [0.4, 0.2, 0.2, 0.25])
        scanned = {'samples': [{'t': 0.0, 'face': True, 'box': [0.4, 0.2, 0.2, 0.25]}, {'t': 0.2, 'face': False}]}
        self.assertEqual(faceflags.boxes(scanned), [{'t': 0.0, 'box': [0.4, 0.2, 0.2, 0.25]}])


def fake_sheets(_video, frames, motion):
    frames.write_bytes(b'frames')
    motion.write_bytes(b'motion')


class JudgeTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.refs = Path(tempfile.mkdtemp())
        for name in ('igexport-DCHp2RLIxMt.mp4', 'instagram_DeypYeWN5hL.mp4', 'mon02-tall.mp4'):
            (self.refs / name).write_bytes(b'ref')
        self.video = self.dir / 'short.mp4'
        self.video.write_bytes(b'cut')
        self.made = judge.assemble(self.dir, 'short', self.video, 'a' * 64, refs_dir=self.refs, sheet_fn=fake_sheets)
        self.key = json.loads(judge.key_path(self.dir, 'short').read_text())['key']
        self.mine = next(k for k, v in self.key.items() if v == judge.CUT_LABEL)

    def scores(self, cut_score, ref=9):
        return {k: (cut_score if k == self.mine else ref) for k in self.key}

    def test_the_packet_is_blind_and_names_what_is_missing(self):
        packet = json.loads(self.made['packet'].read_text())
        self.assertEqual(len(packet['letters']), 4)
        self.assertNotIn(judge.CUT_LABEL, json.dumps(packet), 'the judge is never told which clip is the cut')
        self.assertNotIn('igexport', json.dumps(packet))
        self.assertIn('stamp-duty-is-stupid-ytshorts.savetube.vip.mp4', self.made['missing'])
        self.assertIn('wed11-tall', self.made['missing'])
        self.assertTrue((judge.packet_dir(self.dir, 'short') / f'{self.mine}.motion.jpg').is_file())

    def test_a_low_score_holds_the_cut_and_a_high_one_passes(self):
        judge.record(self.dir, 'short', 'a' * 64, self.scores(3), by='ve-critic')
        self.assertIn('scored it 3/10', judge.problems(self.dir, 'short', 'a' * 64, bind=False)[0])
        judge.record(self.dir, 'short', 'a' * 64, self.scores(8.5), by='ve-critic')
        self.assertEqual(judge.problems(self.dir, 'short', 'a' * 64, bind=True), [])

    def test_no_record_holds_only_from_the_date_and_a_new_file_needs_a_new_score(self):
        self.assertEqual(judge.problems(self.dir, 'short', 'a' * 64, bind=False), [])
        self.assertIn('no blind judge score', judge.problems(self.dir, 'short', 'a' * 64, bind=True)[0])
        judge.record(self.dir, 'short', 'a' * 64, self.scores(9), by='ve-critic')
        self.assertTrue(judge.problems(self.dir, 'short', 'b' * 64, bind=True), 'the score is bound to the file it judged')

    def test_record_refuses_the_maker_a_missing_score_and_another_file(self):
        with self.assertRaises(ValueError):
            judge.record(self.dir, 'short', 'a' * 64, self.scores(9), by='ve')
        partial = self.scores(9)
        partial.pop(self.mine)
        with self.assertRaises(ValueError):
            judge.record(self.dir, 'short', 'a' * 64, partial, by='ve-critic')
        with self.assertRaises(ValueError):
            judge.record(self.dir, 'short', 'c' * 64, self.scores(9), by='ve-critic')

    def test_readiness_holds_on_the_judge(self):
        judge.record(self.dir, 'short', 'a' * 64, self.scores(2), by='ve-critic')
        with patch.object(floor, 'pace_problems', return_value=[]):
            found = floor.held_problems(self.video, 'a' * 64, self.dir, 'short', today='2026-11-20')
        self.assertIn('blind judge scored it 2/10', found[0])


class RecipeTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        write_json(self.root / 'rated.json', {'rated': {'by': 'Krish', 'score': 9, 'on': '2026-11-22'},
                                               'caption_themes': ['rack-focus'], 'generated_kinds': ['illustration']})
        write_json(self.root / 'unrated.json', {'rated': None})
        self.dir = Path(tempfile.mkdtemp())

    def lints(self, style, assets=(), frozen='2026-11-23'):
        write_json(self.dir / 'engine.json', {'at': f'{frozen}T09:00:00Z'})
        return floor.recipe_lints({'style': style, 'assets': list(assets)}, self.dir, root=self.root)

    def test_nothing_in_flight_breaks(self):
        self.assertEqual(self.lints({'recipe': 'unrated'}, frozen='2026-11-19'), [])

    def test_an_unrated_or_unknown_recipe_is_refused(self):
        self.assertIn('no rating of 9', self.lints({'recipe': 'unrated'})[0])
        self.assertIn('is not a recipe', self.lints({})[0])

    def test_a_rated_recipe_and_the_one_experiment_pass(self):
        self.assertEqual(self.lints({'recipe': 'rated', 'captions': {'theme': 'rack-focus', 'reason': 'x'}}), [])
        self.assertEqual(self.lints({'experiment': {'name': 'athletic-depth', 'reason': 'the named slot'}}), [])

    def test_captions_and_generated_assets_come_only_from_the_recipe(self):
        found = self.lints({'recipe': 'rated', 'captions': {'theme': 'slam', 'reason': 'x'}},
                           assets=[{'id': 'clip', 'kind': 'broll', 'origin': 'generated'},
                                   {'id': 'still', 'kind': 'illustration', 'origin': 'generated'}])
        self.assertEqual(sorted(f.split(' ')[0] for f in found), ['floor.recipe_captions', 'floor.recipe_generated'])

    def test_every_shipped_recipe_is_unrated_or_rated_by_krish_in_his_words(self):
        for path in sorted((ROOT / 'config' / 've' / 'recipes').glob('*.json')):
            recipe = json.loads(path.read_text(encoding='utf-8'))
            self.assertIn('rated', recipe, path.name)
            if recipe['rated'] is not None:
                self.assertEqual(recipe['rated']['by'], 'Krish', path.name)
                self.assertTrue(recipe['rated']['words'].strip(), f'{path.name}: only his words rate a recipe')

    def test_his_approval_with_no_score_passes_the_floor(self):
        write_json(self.root / 'approved.json', {'rated': {'approved': True, 'by': 'Krish', 'on': '2026-11-20', 'words': 'all approved'},
                                                  'caption_themes': ['podcast'], 'generated_kinds': []})
        write_json(self.root / 'wordless.json', {'rated': {'approved': True, 'by': 'Krish', 'on': '2026-11-20', 'words': ' '}})
        self.assertEqual(self.lints({'recipe': 'approved', 'captions': {'theme': 'podcast', 'reason': 'x'}}), [])
        self.assertIn('no rating of 9', self.lints({'recipe': 'wordless'})[0])
        self.assertEqual([f.split(' ')[0] for f in self.lints({'recipe': 'approved'}, assets=[{'id': 'p', 'kind': 'broll', 'origin': 'generated'}])],
                         ['floor.recipe_generated'])


if __name__ == '__main__':
    unittest.main()
