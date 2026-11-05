"""One production round (plan 2026-11-04): the moving proof, the style pick on his take, the expectations sheet, the
packet's plain summary and the rounds count. Closes F04 ("stills stood in for motion proof") and F13 ("scaled
unproven approach"): a whole cut of a piece from 9 Nov renders only after Krish approves its hardest beat moving.

The renderer is mocked here (no Chromium in CI for this file): every render_fn writes bytes, so the window choice,
the hashes, the refusals and the records are tested, never a real frame."""
import copy
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
os.environ['VE_GATES_OFFLINE'] = '1'  # never reach the engine from a test; the record is exercised with a stand-in call

import creative_direction  # noqa: E402
import ve  # noqa: E402
from velib import expect, gates, guards, packet, proof, refgate, styles  # noqa: E402
from velib.common import sha256_file  # noqa: E402

FIXTURE = json.loads((ROOT / 'fixtures/ve/my-test-19s/spec.json').read_text(encoding='utf-8'))
CUT = 'proof-tall'


def whole(spec=None, day='2026-11-13'):
    """The fixture as a whole cut of a piece published after MOTION_FROM."""
    spec = copy.deepcopy(spec or FIXTURE)
    spec['publish_day'] = day
    spec['cuts'][CUT]['excerpt'] = False
    spec.setdefault('style', {})['motion'] = {'module': 'data-story', 'reason': 'the deletion count lands as a drawn number'}
    return spec


def props_for(spec, cut=CUT, seconds=(4, 3, 5, 4, 3)):
    """Compiled props on the 30 fps clock, one beat after another, with an ending band, like compile_cut writes."""
    beats, start = [], 0
    for beat, length in zip(spec['cuts'][cut]['beats'], seconds):
        end = start + length * 30
        beats.append({'id': beat['id'], 'role': beat['role'], 'layout': beat['layout'], 'fromFrame': start, 'toFrame': end,
                      'uses': list(beat.get('uses', [])), 'transitionOut': 'cut', 'sectionBeat': not beats,
                      'keyFrame': start + int((end - start) * 0.8)})
        start = end
    duration = start
    objects = [{'obj': o['obj'], 'device': o['device'], 'meaning': 'm', 'fromFrame': 0, 'toFrame': duration + 105,
                'variants': {}, 'params': {}} for o in spec['objects']]
    events = [{'id': f'{b["id"]}-0', 'obj': b['uses'][0], 'verb': 'enter', 'toState': 'on', 'atFrame': b['fromFrame'] + 3}
              for b in beats]
    captions = [{'fromFrame': f, 'toFrame': f + 30, 'words': [{'text': 'word', 'atFrame': f}], 'swipeIndex': None}
                for f in range(0, duration, 30)]
    return {'pieceId': spec['piece_id'], 'cutId': cut, 'format': spec['format'], 'aspect': '9:16', 'fps': 30,
            'durationFrames': duration + 105, 'beats': beats, 'objects': objects, 'events': events, 'captions': captions,
            'segments': [{'src': 'take.mp4', 'trimBeforeFrames': 0, 'fromFrame': 0, 'durationFrames': duration}],
            'audio': {'stem': {'src': 'audio.wav', 'trimBeforeFrames': 0}, 'sfx': [{'src': 's.wav', 'atFrame': 100, 'gainDb': -6}]},
            'ending': {'fromFrame': duration, 'url': 'makeyourmindup.ai'}}


def fake_render(marker='proof'):
    def render(props_path, out, *_):
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_bytes((marker + Path(props_path).read_text(encoding='utf-8')).encode())
    return render


def approve(spec, sha, verdict='approve'):
    out = copy.deepcopy(spec)
    if verdict == 'approve':
        out['approvals'].append({'gate': 'proof', 'by': 'Krish', 'said': 'yes that moves', 'on': '2026-11-12', 'artifact_hash': sha})
    return out


class HardestBeat(unittest.TestCase):
    def test_most_distinct_devices_wins(self):
        # b5-every uses grid, deletion and runs: three devices, more than any other beat.
        self.assertEqual(proof.hardest_beat(FIXTURE, CUT)[0], 'b5-every')

    def test_named_beat_wins(self):
        spec = copy.deepcopy(FIXTURE)
        spec['style'] = {'proof': {'beat': 'b2-key'}}
        self.assertEqual(proof.hardest_beat(spec, CUT), ('b2-key', 'named in the spec (proof.beat)'))
        spec['style'] = {'proof': {'beat': 'nope'}}
        with self.assertRaises(ValueError):
            proof.hardest_beat(spec, CUT)

    def test_tie_goes_to_a_split_beat_with_a_card_then_length(self):
        spec = copy.deepcopy(FIXTURE)
        for beat in spec['cuts'][CUT]['beats']:
            beat['uses'] = ['grid', 'chip']
        spec['cuts'][CUT]['beats'][3]['uses'] = ['grid', 'deletion']  # evidence_card
        spec['cuts'][CUT]['beats'][3]['layout'] = 'SPLIT'
        beat, rule = proof.hardest_beat(spec, CUT)
        self.assertEqual(beat, 'b4-watch')
        self.assertIn('SPLIT', rule)
        spec['cuts'][CUT]['beats'][3]['layout'] = 'F1'
        props = props_for(spec, seconds=(4, 9, 5, 4, 3))
        self.assertEqual(proof.hardest_beat(spec, CUT, props)[0], 'b2-key', 'the longest beat breaks the last tie')

    def test_window_is_eight_to_fifteen_seconds_inside_the_content(self):
        props = props_for(FIXTURE)
        start, end = proof.window(props, 'b5-every')  # a 3 s beat at the end: grown back into its neighbour
        self.assertEqual(end - start, 240)
        self.assertLessEqual(end, props['ending']['fromFrame'])
        long = props_for(FIXTURE, seconds=(4, 3, 20, 4, 3))
        start, end = proof.window(long, 'b3-pass')
        self.assertEqual((start, end - start), (210, 450))

    def test_window_props_cut_on_the_same_clock(self):
        props = props_for(FIXTURE)
        start, end = proof.window(props, 'b5-every')
        out = proof.window_props(props, start, end)
        self.assertEqual(out['durationFrames'], end - start)
        self.assertNotIn('ending', out, 'the window stops before the ending band')
        self.assertEqual(out['segments'][0]['trimBeforeFrames'], start, 'the take is trimmed to the window')
        self.assertEqual(out['audio']['stem']['trimBeforeFrames'], start, 'the dialogue is trimmed with it')
        self.assertTrue(all(0 <= b['fromFrame'] < b['toFrame'] <= out['durationFrames'] for b in out['beats']))
        self.assertTrue(out['beats'][0]['sectionBeat'])
        self.assertTrue(all(e['atFrame'] >= 0 for e in out['events']))
        self.assertFalse(out['audio']['sfx'], 'a hit outside the window is not in it')
        self.assertTrue(out['captions'])

    def test_a_window_of_a_stinged_cut_has_no_sting_and_its_stem_skips_it(self):
        # The wide whole cut opens on the 56-frame intro sting (Krish, 2026-11-05: "I think it should go at the start
        # of the longer wide videos 100%,"), and ve premix lays his voice after it. A window is never a whole cut: it
        # opens on no sting, and its stem is trimmed past the sting's frames to the window's start.
        plain = dict(props_for(FIXTURE), aspect='16:9')
        props = dict(plain, sting={'src': 'sting.mp4', 'series': 'mind_the_gap', 'frames': 56, 'sha256': 'a' * 64})
        start, end = proof.window(props, 'b5-every')
        out = proof.window_props(props, start, end)
        self.assertNotIn('sting', out)
        self.assertEqual(out['audio']['stem']['trimBeforeFrames'], start + 56, 'cut frame f is stem frame f + 56')
        self.assertEqual(out['segments'][0]['trimBeforeFrames'], start, 'the take stays on the cut\'s own clock')
        unstinged = proof.window_props(plain, start, end)
        self.assertEqual(unstinged['audio']['stem']['trimBeforeFrames'], start)
        self.assertEqual({k: v for k, v in out.items() if k != 'audio'}, {k: v for k, v in unstinged.items() if k != 'audio'},
                         'the sting moves no frame in the window')
        self.assertIn('sting', props, 'the cut\'s own props are not changed')


class StructuralHash(unittest.TestCase):
    def test_caption_and_reason_edits_keep_the_proof(self):
        spec = whole()
        before = proof.structural_hash(spec, CUT)
        edited = copy.deepcopy(spec)
        edited['cuts'][CUT]['captions']['emphasis'] = [1]
        edited['cuts'][CUT]['beats'][0]['point'] = 'a different sentence about the same beat entirely'
        edited['cuts'][CUT]['beats'][0]['events'][0]['to_state'] = 'other words'
        edited['style']['motion']['reason'] = 'another reason in his words'
        self.assertEqual(proof.structural_hash(edited, CUT), before)

    def test_style_device_and_layout_changes_break_it(self):
        spec = whole()
        before = proof.structural_hash(spec, CUT)
        for change in (lambda s: s['style']['motion'].update(module='dark-keynote'),
                       lambda s: s['objects'][3].update(device='stat_strip'),
                       lambda s: s['cuts'][CUT]['beats'][1].update(layout='F1'),
                       lambda s: s['cuts'][CUT]['beats'][1]['uses'].append('runs')):
            changed = copy.deepcopy(spec)
            change(changed)
            self.assertNotEqual(proof.structural_hash(changed, CUT), before)
        changed = copy.deepcopy(spec)
        changed['style']['motion']['module'] = 'dark-keynote'
        self.assertEqual(proof.changes(proof.structure(spec, CUT), proof.structure(changed, CUT)),
                         ['style.motion data-story -> dark-keynote'])


class RenderRefusal(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name) / 've'
        self.dir.mkdir()
        self.spec = whole()
        self.props = props_for(self.spec)
        self.spec_file = self.dir / 'spec.json'
        guards.freeze(self.dir)  # the engine his storyboard signature stands for (ve expect writes it)

    def tearDown(self):
        self.tmp.cleanup()

    def refused(self, spec, props=None):
        self.spec_file.write_text(json.dumps(spec), encoding='utf-8')
        return ve.render_refusal(spec, self.spec_file, props or self.props)

    def test_no_proof_refuses_with_what_to_run(self):
        reasons = self.refused(self.spec)
        self.assertTrue(reasons and 've proof' in reasons[0], reasons)

    def test_unapproved_proof_refuses_then_his_approval_passes(self):
        record = proof.make(self.spec, CUT, self.dir, self.props, fake_render())
        self.assertEqual(record['sha256'], sha256_file(self.dir / 'proof' / f'{CUT}.mp4'))
        self.assertEqual(record['beat'], 'b5-every')
        self.assertTrue(any('has not approved' in r for r in self.refused(self.spec)))
        self.assertEqual(self.refused(approve(self.spec, record['sha256'])), [])

    def test_a_style_change_makes_the_proof_stale(self):
        record = proof.make(self.spec, CUT, self.dir, self.props, fake_render())
        changed = approve(self.spec, record['sha256'])
        changed['style']['motion']['module'] = 'dark-keynote'
        reasons = self.refused(changed)
        self.assertTrue(any('changed since the proof' in r and 'dark-keynote' in r for r in reasons), reasons)

    def test_a_caption_edit_keeps_it_and_a_retime_of_half_a_second_breaks_it(self):
        record = proof.make(self.spec, CUT, self.dir, self.props, fake_render())
        approved = approve(self.spec, record['sha256'])
        approved['cuts'][CUT]['captions']['emphasis'] = [2]
        nudged = copy.deepcopy(self.props)
        for beat in nudged['beats'][-1:]:
            beat['fromFrame'] += 6  # 0.2 s
        self.assertEqual(self.refused(approved, nudged), [])
        moved = copy.deepcopy(self.props)
        moved['beats'][-1]['fromFrame'] += 15  # 0.5 s
        self.assertTrue(any('moved by 0.5 s' in r for r in self.refused(approved, moved)))

    def test_a_changed_proof_file_refuses(self):
        record = proof.make(self.spec, CUT, self.dir, self.props, fake_render())
        (self.dir / 'proof' / f'{CUT}.mp4').write_bytes(b'something else')
        self.assertTrue(any('is not the file' in r for r in self.refused(approve(self.spec, record['sha256']))))

    def test_his_reject_on_the_record_wins_over_a_local_approval(self):
        record = proof.make(self.spec, CUT, self.dir, self.props, fake_render())
        spec = approve(self.spec, record['sha256'])
        answer = {'making': {'gates': {'proof': {'by': 'Krish', 'at': '2026-11-12T10:00:00Z', 'sha256': record['sha256'],
                                                  'verdict': 'reject', 'words': 'too slow on the count'}}}}
        old = os.environ.pop('VE_GATES_OFFLINE')
        try:
            found = gates.load(self.dir, spec, call=lambda *a: (200, json.dumps(answer)))
            self.assertEqual(found['source'], 'record')
            reasons = proof.problems(spec, CUT, self.dir, found['gates'])
            self.assertTrue(any('rejected' in r and 'too slow on the count' in r for r in reasons), reasons)
            offline = gates.load(self.dir, spec, call=lambda *a: (_ for _ in ()).throw(OSError('no network')))
            self.assertTrue(offline['source'].startswith('NOT CHECKED'))
            self.assertEqual(proof.problems(spec, CUT, self.dir, offline['gates']), [])
        finally:
            os.environ['VE_GATES_OFFLINE'] = '1'

    def test_an_excerpt_or_an_earlier_piece_is_not_held(self):
        early = whole(day='2026-11-08')
        self.assertEqual(self.refused(early), [])
        excerpt = copy.deepcopy(self.spec)
        excerpt['cuts'][CUT]['excerpt'] = True
        self.assertEqual(self.refused(excerpt), [])

    def test_ve_proof_verb_renders_the_window_and_records_it(self):
        spec_file = self.dir / 'spec.json'
        spec_file.write_text(json.dumps(FIXTURE), encoding='utf-8')
        (self.dir / f'props.{CUT}.json').write_text(json.dumps(props_for(FIXTURE)), encoding='utf-8')
        args = types.SimpleNamespace(spec=str(spec_file), cut=CUT, beat='b2-key', props=None, assets_dir=None,
                                     scale=1.0, no_qc=True)
        self.assertEqual(ve.cmd_proof(args, render_fn=fake_render()), 0)
        record = json.loads((self.dir / 'proof' / f'{CUT}.json').read_text(encoding='utf-8'))
        self.assertEqual(record['beat'], 'b2-key')
        self.assertEqual(record['spec_sha256'], proof.structural_hash(FIXTURE, CUT), '--beat never changes the hash')
        self.assertTrue(set(record) >= {'beat', 'start', 'end', 'sha256', 'spec_sha256', 'style_module'})
        window = json.loads((self.dir / 'proof' / f'props.{CUT}.json').read_text(encoding='utf-8'))
        self.assertLessEqual(window['durationFrames'], 450)


class BoardContract(unittest.TestCase):
    """The board's presses (commit ad90078): the same hashes, the per-cut final, a proof bound to its cut, rounds."""

    def test_storyboard_sha_mirrors_week_board(self):
        import hashlib
        story, exp = 'Beat 1\r\nBeat 2\n', '- No sound effects.\r'
        want = hashlib.sha256('{"expect":"- No sound effects.\\n","storyboard":"Beat 1\\nBeat 2\\n"}'.encode()).hexdigest()
        self.assertEqual(gates.storyboard_sha(story, exp), want)
        try:
            sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
            import week_board  # noqa: PLC0415
        except Exception:  # noqa: BLE001
            week_board = None
        if week_board is not None and hasattr(week_board, 'storyboard_sha'):
            self.assertEqual(week_board.storyboard_sha(story, exp), gates.storyboard_sha(story, exp))

    def test_final_press_binds_each_cut(self):
        cuts = {'long': 'a' * 64, 'short': 'b' * 64}
        self.assertEqual(gates.final_sha({'short': 'b' * 64}), 'b' * 64)
        self.assertEqual(gates.final_sha(cuts), gates.canonical_sha(cuts))
        found = {'final': [{'by': 'Krish', 'at': 't', 'sha256': gates.final_sha(cuts), 'cuts': cuts}]}
        self.assertIsNotNone(gates.for_hash(found, 'final', 'b' * 64, 'short'))
        self.assertIsNone(gates.for_hash(found, 'final', 'c' * 64, 'short'))
        self.assertIsNone(gates.for_hash(found, 'final', 'a' * 64, 'short'), 'the long file is not the short cut')

    def test_a_proof_press_for_another_cut_does_not_count(self):
        found = {'proof': [{'by': 'Krish', 'sha256': 'd' * 64, 'verdict': 'approve', 'cut': 'long'}]}
        self.assertIsNone(gates.for_hash(found, 'proof', 'd' * 64, 'short'))
        self.assertIsNotNone(gates.for_hash(found, 'proof', 'd' * 64, 'long'))

    def test_rounds_go_to_the_making_record(self):
        with tempfile.TemporaryDirectory() as tmp:
            uuid = '0b2a1c3d-1111-4222-8333-444455556666'
            (Path(tmp) / 'post.json').write_text(json.dumps({'piece_id': uuid}))
            directory = Path(tmp) / 've'
            directory.mkdir()
            self.assertIn('NOT RECORDED', gates.write_rounds(directory, 2))  # offline in tests
            sent = []
            old = os.environ.pop('VE_GATES_OFFLINE')
            try:
                line = gates.write_rounds(directory, 2, call=lambda m, p, b: (sent.append((m, p, b)), (200, '{}'))[1])
            finally:
                os.environ['VE_GATES_OFFLINE'] = '1'
            self.assertEqual(line, 'rounds 2 recorded on the making record')
            self.assertEqual((sent[0][0], sent[0][1], sent[0][2]['rounds']), ('POST', f'/api/content-ideas/{uuid}/making', 2))
            self.assertNotIn('gates', sent[0][2], 'a session never writes gates')


class Styles(unittest.TestCase):
    MODULES = {
        'data-story': {'name': 'A', 'how': 'h', 'layer': 'motion', 'formats': ['short_video'], 'point_types': ['number'], 'fits': 'often',
              've_route': ['kinetic_stat'], 'krish_verdict': 'untested'},
        'toy-3d': {'name': 'B', 'how': 'h', 'layer': 'motion', 'formats': ['short_video'], 'point_types': ['number'], 'fits': 'often',
              've_route': ['needs_device'], 'krish_verdict': 'liked'},
        'swiss-kinetic-type': {'name': 'C', 'how': 'h', 'layer': 'motion', 'formats': ['short_video'], 'point_types': ['claim'], 'fits': 'sometimes',
              've_route': ['headline'], 'krish_verdict': 'untested'},
    }

    def test_needs_device_is_left_out_and_named(self):
        options, skipped = styles.shortlist(FIXTURE, CUT, 3, self.MODULES, {'kinetic_stat', 'headline'})
        self.assertEqual([m for m, _ in options], ['data-story', 'swiss-kinetic-type'])
        self.assertEqual([m for m, _ in skipped], ['toy-3d'])

    def test_the_real_bank_never_offers_an_undrawable_style(self):
        options, skipped = styles.shortlist(FIXTURE, CUT, 3)
        bank = creative_direction.motion_modules()
        self.assertEqual(len(options), 3)
        self.assertTrue(all('needs_device' not in bank[m]['ve_route'] for m, _ in options))
        self.assertTrue(skipped and all('needs_device' in bank[m]['ve_route'] for m, _ in skipped))

    def test_one_clip_per_style_on_the_same_window(self):
        with tempfile.TemporaryDirectory() as tmp:
            seen = []

            def render(props_path, out, trial):
                seen.append(((trial.get('style') or {}).get('motion') or {}).get('module', 'house'))
                # The fake renderer writes only what it is handed: any difference between clips is in the props.
                fake_render()(props_path, out)
            doc = styles.make(FIXTURE, CUT, Path(tmp), grounded(props_for(FIXTURE)), render, modules=self.MODULES,
                              devices={'kinetic_stat', 'headline'}, sample=looks({'data-story': 40, 'swiss-kinetic-type': 90}))
            self.assertEqual(seen.pop(0), 'house', 'the house look renders first, on the same window')
            self.assertEqual(seen, ['data-story', 'swiss-kinetic-type'])
            self.assertEqual([o['file'] for o in doc['options']], ['styles/data-story.mp4', 'styles/swiss-kinetic-type.mp4'])
            self.assertEqual(doc['skipped'][0]['module'], 'toy-3d')
            written = json.loads((Path(tmp) / 'styles.json').read_text(encoding='utf-8'))
            self.assertEqual(written['window'], doc['window'])
            motions = [json.loads((Path(tmp) / 'styles' / f'props.{m}.json').read_text(encoding='utf-8'))['motion']
                       for m in seen]
            self.assertEqual([m['style'] for m in motions], seen)
            self.assertNotEqual(motions[0]['profile'], motions[1]['profile'])
            # Apart from the style, each clip draws the same window of the same take.
            stripped = [{k: v for k, v in json.loads((Path(tmp) / 'styles' / f'props.{m}.json').read_text(encoding='utf-8')).items()
                         if k != 'motion'} for m in seen]
            self.assertEqual(stripped[0], stripped[1])
            house = json.loads((Path(tmp) / 'styles' / 'props.house.json').read_text(encoding='utf-8'))
            self.assertNotIn('motion', house)
            self.assertEqual(house, stripped[0])
            self.assertTrue(doc['distinct'])
            # Two styles is all this bank can draw, so two are offered and the sheet says so.
            self.assertIn('only 2 styles look different', doc['note'])


def grounded(props: dict) -> dict:
    """The props with every beat on a SPLIT stage: a graphic ground, which the dark, paper and hero-type effects need
    (style-distinct.json effects with "ground")."""
    for beat in props['beats']:
        beat['layout'] = 'SPLIT'
    return props


def looks(levels: dict, house: int = 0):
    """A stand-in for the ffmpeg sampler: each clip is six grey frames of 100 pixels averaging its style's level (house at
    `house`; a fractional level lifts that share of pixels by one), so two clips differ by the gap between their levels."""
    def sample(clip, seconds):
        stem = Path(clip).stem
        level = house if stem == 'house' else levels.get(stem, house)
        whole, part = int(level), round((level - int(level)) * 100)
        return [bytes([whole + 1] * part + [whole] * (100 - part))] * 6
    return sample


class DistinctOptions(unittest.TestCase):
    """Only distinct options reach his press (config/ve/style-distinct.json)."""
    def module(self, route):
        return {'name': 'N', 'how': 'h', 'layer': 'motion', 'formats': ['short_video'], 'point_types': ['claim'], 'fits': 'often',
                've_route': [route], 'krish_verdict': 'untested'}

    def bank(self, *ids):
        return {mid: self.module('kinetic_stat') for mid in ids}  # equal scores: the bank's order is the rank

    def run_make(self, tmp, ids, levels, props=None, top=3, rules=None):
        rendered = []

        def render(props_path, out, trial):
            rendered.append(((trial.get('style') or {}).get('motion') or {}).get('module', 'house'))
            fake_render()(props_path, out)
        doc = styles.make(FIXTURE, CUT, Path(tmp), props or grounded(props_for(FIXTURE)), render, top=top, modules=self.bank(*ids),
                          devices={'kinetic_stat'}, sample=looks(levels), rules=rules)
        return doc, rendered

    def test_rules_are_tuned_on_the_381_renders(self):
        rules = styles.distinct_rules()
        self.assertEqual((rules['frames'], rules['width']), (6, 270))
        tuned = rules['tuned_on']['scores_against_house']
        for style in ('dark-keynote', 'riso-halftone'):
            self.assertGreaterEqual(tuned[style], rules['threshold'], f'{style} must pass against the house')
        self.assertLess(tuned['living-ui'], rules['threshold'], 'the old living-ui must fail against the house')

    def test_difference_is_the_mean_absolute_grey_gap(self):
        self.assertEqual(styles.difference([bytes([10, 20])], [bytes([12, 26])]), 4.0)
        self.assertEqual(styles.difference([b'\x05' * 9] * 6, [b'\x05' * 9] * 6), 0.0)
        with self.assertRaises(ValueError):
            styles.difference([], [])

    def test_three_distinct_styles_are_offered_with_their_scores(self):
        with tempfile.TemporaryDirectory() as tmp:
            doc, rendered = self.run_make(tmp, ['data-story', 'swiss-kinetic-type', 'paper-cutout'], {'data-story': 30, 'swiss-kinetic-type': 60, 'paper-cutout': 90})
            self.assertEqual(rendered, ['house', 'data-story', 'swiss-kinetic-type', 'paper-cutout'])
            self.assertEqual([o['module'] for o in doc['options']], ['data-story', 'swiss-kinetic-type', 'paper-cutout'])
            self.assertEqual(doc['options'][2]['differs'], {'house': 90.0, 'data-story': 60.0, 'swiss-kinetic-type': 30.0})
            written = json.loads((Path(tmp) / 'styles.json').read_text(encoding='utf-8'))
            self.assertEqual(written['distinctness']['threshold'], styles.distinct_rules()['threshold'])
            self.assertEqual(len(written['distinctness']['pairs']), 6, 'every pair is scored and recorded')
            self.assertEqual(written['house']['file'], 'styles/house.mp4')
            self.assertNotIn('note', written)

    def test_a_look_alike_gives_way_to_the_next_ranked_style(self):
        with tempfile.TemporaryDirectory() as tmp:
            # paper-cutout looks like the house; vertical-captions looks like data-story; line-boil is distinct.
            doc, rendered = self.run_make(tmp, ['data-story', 'paper-cutout', 'vertical-captions', 'swiss-kinetic-type', 'line-boil', 'riso-halftone'],
                                          {'data-story': 40, 'paper-cutout': 1, 'vertical-captions': 40.5, 'swiss-kinetic-type': 80, 'line-boil': 120, 'riso-halftone': 160})
            self.assertEqual([o['module'] for o in doc['options']], ['data-story', 'swiss-kinetic-type', 'line-boil'])
            self.assertNotIn('riso-halftone', rendered, 'nothing renders once three distinct options are found')
            gone = {s['module']: s for s in doc['skipped']}
            self.assertEqual((gone['paper-cutout']['reason'], gone['paper-cutout']['like'], gone['paper-cutout']['score']), ('look_alike', 'house', 1.0))
            self.assertEqual((gone['vertical-captions']['like'], gone['vertical-captions']['score']), ('data-story', 0.5))
            self.assertIn('next ranked style takes its place', gone['paper-cutout']['why'])

    def test_with_two_distinct_it_offers_two_and_says_so(self):
        with tempfile.TemporaryDirectory() as tmp:
            doc, _ = self.run_make(tmp, ['data-story', 'paper-cutout', 'swiss-kinetic-type'], {'data-story': 40, 'paper-cutout': 0.5, 'swiss-kinetic-type': 80})
            self.assertEqual([o['module'] for o in doc['options']], ['data-story', 'swiss-kinetic-type'])
            self.assertEqual(doc['note'], 'only 2 styles look different on this window, so 2 are offered instead of 3 (the rest are named under skipped)')

    def test_fewer_than_two_distinct_refuses(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, 'fewer than 2 styles look different'):
                self.run_make(tmp, ['data-story', 'paper-cutout'], {'data-story': 40, 'paper-cutout': 0.2})

    def test_a_style_whose_effects_touch_no_device_is_left_out_and_named(self):
        props = props_for(FIXTURE)
        # This window has no typed device: drop the query chip from every beat.
        for beat in props['beats']:
            beat['uses'] = [u for u in beat['uses'] if u != 'chip']
        with tempfile.TemporaryDirectory() as tmp:
            doc, rendered = self.run_make(tmp, ['hud-terminal', 'single-line-drawing', 'swiss-kinetic-type', 'data-story', 'riso-halftone'],
                                          {'data-story': 40, 'riso-halftone': 80}, props=props)
            self.assertNotIn('hud-terminal', rendered, 'left out before it renders')
            self.assertNotIn('single-line-drawing', rendered)
            gone = {s['module']: s for s in doc['skipped']}
            self.assertEqual(gone['hud-terminal']['reason'], 'no_device_in_window')
            self.assertIn('typewriter needs typing_bubble or query_chip or headline', gone['hud-terminal']['why'])
            self.assertIn('followPen needs scribble', gone['single-line-drawing']['why'])
            # Type as hero draws only on a graphic ground; this window shows his take behind every beat.
            self.assertIn('hero needs a SPLIT or graphics-only beat', gone['swiss-kinetic-type']['why'])
            self.assertEqual([o['module'] for o in doc['options']], ['data-story', 'riso-halftone'])

    def test_effects_follow_the_profile(self):
        table = json.loads((ROOT / 'apps/renderer/src/engine/kit/motion-profiles.json').read_text(encoding='utf-8'))['profiles']
        self.assertEqual(styles.signature(table['hud-terminal']), ['typewriter', 'dark', 'brackets'])
        self.assertEqual(styles.signature(table['paper-cutout']), ['paper', 'torn'])
        self.assertEqual(styles.signature(table['vertical-captions']), ['lead'])
        self.assertEqual(styles.signature(table['line-boil']), ['dark', 'boil'])
        self.assertEqual(styles.signature(table['living-ui']), ['typewriter', 'zoomToFocus'])
        self.assertEqual(styles.signature(table['single-line-drawing']), ['followPen'])
        self.assertEqual(styles.signature(table['riso-halftone']), ['halftone'])
        self.assertIn('any', styles.signature(table['dark-keynote']))
        self.assertEqual(styles.signature(table['swiss-kinetic-type']), ['hero'])
        rules = styles.distinct_rules()
        typed = {'objects': [{'obj': 'q', 'device': 'query_chip'}], 'beats': [{'uses': ['q']}]}
        self.assertTrue(styles.touches(table['hud-terminal'], typed, rules)[0])
        take = {'objects': [{'obj': 'g', 'device': 'test_grid'}], 'beats': [{'uses': ['g']}], 'segments': [{'src': 't.mp4'}]}
        self.assertTrue(styles.touches(table['riso-halftone'], take, rules)[0])
        self.assertFalse(styles.touches(table['riso-halftone'], {**take, 'segments': []}, rules)[0])

    @unittest.skipUnless(__import__('shutil').which('ffmpeg'), 'needs ffmpeg')
    def test_the_sampler_reads_real_frames(self):
        with tempfile.TemporaryDirectory() as tmp:
            grey, white = Path(tmp) / 'grey.mp4', Path(tmp) / 'white.mp4'
            for clip, colour in ((grey, 'gray'), (white, 'white')):
                __import__('subprocess').run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'color={colour}:s=540x960:d=2:r=30',
                                              '-pix_fmt', 'yuv420p', str(clip)], check=True)
            a, b = styles.sample_frames(grey, 2.0), styles.sample_frames(white, 2.0)
            self.assertEqual((len(a), len(a[0])), (6, 270 * 480))
            self.assertEqual(styles.difference(a, a), 0.0)
            self.assertGreater(styles.difference(a, b), 100)

    def test_no_take_and_no_earlier_take_refuses(self):
        with tempfile.TemporaryDirectory() as tmp:
            spec = copy.deepcopy(FIXTURE)
            spec['piece_id'] = 'never-recorded'
            self.assertIsNone(styles.last_take(spec, CUT, Path(tmp)))


class StyleVerdict(unittest.TestCase):
    BANK = {'bank': [{'id': 'x', 'layer': 'motion', 'krish_verdict': 'untested'}, {'id': 'tone', 'layer': 'tone'}]}

    def test_picked_twice_becomes_tested(self):
        once = creative_direction.style_verdict(self.BANK, 'x', 'picked', 'that one, the drawn count', '2026-11-12')
        self.assertEqual(self.BANK['bank'][0]['krish_verdict'], 'untested', 'the input is untouched')
        self.assertEqual((once['bank'][0]['krish_verdict'], once['bank'][0]['trials']), ('liked', 1))
        twice = creative_direction.style_verdict(once, 'x', 'picked', 'again this', '2026-11-19')
        self.assertEqual((twice['bank'][0]['krish_verdict'], twice['bank'][0]['picks']), ('tested', 2))
        self.assertEqual(twice['bank'][0]['verdicts'][-1], {'on': '2026-11-19', 'verdict': 'picked', 'said': 'again this'})

    def test_seen_counts_and_not_for_us_is_never_offered_again(self):
        seen = creative_direction.style_verdict(self.BANK, 'x', 'seen', '', '2026-11-12')
        self.assertEqual((seen['bank'][0]['krish_verdict'], seen['bank'][0]['trials']), ('untested', 1))
        gone = creative_direction.style_verdict(seen, 'x', 'not-for-us', 'too childish', '2026-11-12')
        self.assertEqual(gone['bank'][0]['krish_verdict'], 'not for us')

    def test_refuses_bad_input(self):
        for args in (('tone', 'picked', 'words', '2026-11-12'), ('x', 'maybe', 'w', '2026-11-12'),
                     ('x', 'picked', '', '2026-11-12'), ('x', 'picked', 'words', 'Thursday')):
            with self.assertRaises(creative_direction.DirectionError):
                creative_direction.style_verdict(self.BANK, *args)

    def test_the_cli_rewrites_only_that_module(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'bank.json'
            text = (ROOT / 'config' / 'style-references.json').read_text(encoding='utf-8')
            path.write_text(text, encoding='utf-8')
            code = creative_direction.main(['verdict', '--module', 'data-story', '--verdict', 'picked',
                                            '--said', 'the drawn bar', '--on', '2026-11-12', '--bank', str(path)])
            self.assertEqual(code, 0)
            after = path.read_text(encoding='utf-8')
            data = json.loads(after)
            module = next(m for m in data['bank'] if m['id'] == 'data-story')
            self.assertEqual((module['krish_verdict'], module['trials']), ('liked', 1))
            changed = [line for line in after.splitlines() if line not in set(text.splitlines())]
            self.assertLess(len(changed), 20, 'a verdict is a small diff, not a reformatted bank')
            sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
            import references  # noqa: PLC0415
            self.assertEqual([p for p in references.ledger_problems(data) if 'data-story' in p], [])


class Expect(unittest.TestCase):
    def test_lines_apply_only_when_they_apply(self):
        with tempfile.TemporaryDirectory() as tmp:
            spec = copy.deepcopy(FIXTURE)
            self.assertTrue(any('wide cut' in line for line in expect.lines(spec)), 'an unlocked wide cut is said')
            spec['cuts'].pop('proof-wide')
            (Path(tmp) / 'script.words.json').write_text(json.dumps({'words': [{'w': 0, 'word': 'the'}, {'w': 1, 'word': '15'}]}))
            found = expect.lines(spec, Path(tmp))
            self.assertLessEqual(len(found), expect.MAX_LINES)
            self.assertTrue(any('Channel buttons' in line for line in found), 'a tall cut gets the advisory line')
            self.assertFalse(any('(15)' in line for line in found),
                             'conform reads a number said his own way (velib.words), so no line asks him to say it as written')
            self.assertFalse(any('wide cut' in line for line in found), 'no wide cut, no wide line')
            self.assertTrue(any('muted' in line for line in found), 'the DeepSeek recording plays muted in its card')
            spec['objects'][2]['params'] = {'kind': 'document', 'outlet': 'A PAGE'}
            spec['assets'] = []
            self.assertFalse(any('muted' in line for line in expect.lines(spec, Path(tmp))), 'no outside clip, no line')
            self.assertTrue(any('No sound effects' in line for line in found), 'the fixture marks hits and no kit exists')
            for beat in spec['cuts'][CUT]['beats']:
                for event in beat.get('events') or []:
                    event.pop('sfx', None)
            self.assertFalse(any('No sound effects' in line for line in expect.lines(spec, Path(tmp))))
            spec['cuts'][CUT]['beats'][0]['events'][0]['sfx'] = 'hit'
            spec['audio']['sfx_kit'] = 'no-such-kit'
            self.assertTrue(any('No sound effects' in line for line in expect.lines(spec, Path(tmp))))
            path = expect.write(spec, Path(tmp))
            self.assertLessEqual(len([l for l in path.read_text().splitlines() if l.startswith('- ')]), 6)


class PacketSummary(unittest.TestCase):
    def test_in_short_is_ten_plain_lines_at_most_with_the_proof_first(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            spec = whole()
            record = proof.make(spec, CUT, directory, props_for(spec), fake_render())
            spec = approve(spec, record['sha256'])
            qc = {'checks': {'channel.safe_zones': {'status': 'advisory', 'pass': False, 'value': {'count': 3}}}}
            findings = [{'severity': 'note', 'area': 'motion', 'frame_s': 2.5, 'text': f'Note {i}. More detail.'} for i in range(12)]
            (directory / f'verdict.{CUT}.json').write_text(json.dumps({'findings': findings}))
            lines = packet.in_short(spec, directory, [(CUT, qc, None, 'a' * 64)], rounds=2)
            self.assertLessEqual(len(lines), packet.SHORT_LINES)
            self.assertEqual(lines[0], 'Round 2: full cuts sent to Krish for this piece, this one included')
            self.assertIn('approved by Krish; nothing structural changed since', lines[1])
            self.assertIn('advisory channel.safe_zones (3 found', lines[2])
            self.assertIn('Critic note at 2.5 s: Note 0', lines[3])
            self.assertTrue(lines[-1].startswith('and '))
            changed = copy.deepcopy(spec)
            changed['style']['motion']['module'] = 'dark-keynote'
            line = packet.in_short(changed, directory, [(CUT, {}, None, 'a' * 64)])[0]
            self.assertIn('not approved', line)
            self.assertIn('style.motion data-story -> dark-keynote', line)

    def test_rounds_count_new_whole_cut_files_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            spec = whole()
            n, commit = packet.count_round(spec, Path(tmp), [(CUT, {}, None, 'a' * 64)])
            self.assertEqual(n, 1)
            self.assertEqual(packet.rounds(Path(tmp)), 0, 'nothing is counted until the packet is built')
            commit()
            self.assertEqual(packet.count_round(spec, Path(tmp), [(CUT, {}, None, 'a' * 64)])[0], 1, 'the same file again')
            n, commit = packet.count_round(spec, Path(tmp), [(CUT, {}, None, 'b' * 64)])
            commit()
            self.assertEqual(packet.rounds(Path(tmp)), 2)
            excerpt = copy.deepcopy(spec)
            excerpt['cuts'][CUT]['excerpt'] = True
            self.assertEqual(packet.count_round(excerpt, Path(tmp), [(CUT, {}, None, 'c' * 64)])[0], 2)


class CriticAgainstTheProof(unittest.TestCase):
    def test_missing_proof_is_a_hold_and_a_low_score_holds(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            spec = whole()
            held = refgate.proof_problems(spec, CUT, directory, {}, 'f' * 64)
            self.assertTrue(held and 'no approved moving proof' in held[0])
            record = proof.make(spec, CUT, directory, props_for(spec), fake_render())
            spec = approve(spec, record['sha256'])
            self.assertTrue(any('no proof sheet' in p for p in refgate.proof_problems(spec, CUT, directory, {}, 'f' * 64)))
            refgate.sheet_path(directory, CUT, refgate.PROOF_CARD).write_bytes(b'jpg')
            refgate.stamp_path(directory, CUT, refgate.PROOF_CARD).write_text(json.dumps({'video_sha256': 'f' * 64}))
            low = {'proof': {'card': 'proof', 'score': 6, 'matches': False, 'note': 'the count arrives late'}}
            self.assertTrue(any('falls below the proof' in p for p in refgate.proof_problems(spec, CUT, directory, low, 'f' * 64)))
            good = {'proof': {'card': 'proof', 'score': 8, 'matches': True, 'note': 'moves as the proof did'}}
            self.assertEqual(refgate.proof_problems(spec, CUT, directory, good, 'f' * 64), [])
            self.assertEqual(refgate.proof_problems(whole(day='2026-11-06'), CUT, directory, {}, 'f' * 64), [])


if __name__ == '__main__':
    unittest.main()
