"""The ingredients chosen per piece apart from the motion style (docs/ve/INGREDIENTS.md): compile turns style.captions,
style.transitions, style.camera and style.energy into props, and none of them means none (Krish, 2026-11-13: "the
captions should be decoupled from the animation styles")."""
from __future__ import annotations

import sys
import json
import unittest
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.compile import LAYOUTS, caption_props, ingredient_props, compile_cut, sound_props  # noqa: E402


class IngredientsTest(unittest.TestCase):
    def test_nothing_chosen_means_nothing_in_the_props(self):
        self.assertEqual(caption_props({'style': {'motion': {'module': 'data-story', 'reason': 'x'}}}), {})
        self.assertIsNone(ingredient_props({'style': {'motion': {'module': 'data-story', 'reason': 'x'}}}))
        self.assertIsNone(ingredient_props({}))

    def test_captions_are_chosen_with_their_own_place_whatever_the_motion_style(self):
        spec = {'brand': {'caption_theme': 'pop'}, 'style': {'motion': {'module': 'vertical-captions', 'reason': 'x'},
                'captions': {'theme': 'slam', 'placement': 'centre', 'reason': 'the fast caption over the full frame'}}}
        self.assertEqual(caption_props(spec), {'captionTheme': 'slam', 'captionPlacement': 'centre'})
        with self.assertRaises(ValueError):
            caption_props({'style': {'captions': {'theme': 'slam', 'placement': 'side', 'reason': 'x'}}})

    def test_transitions_camera_and_energy_come_through_with_hits_on_for_a_moving_camera(self):
        spec = {'style': {'transitions': {'kind': 'whip', 'reason': 'x'}, 'camera': {'move': 'phased', 'reason': 'x'},
                          'energy': 'high'}}
        self.assertEqual(ingredient_props(spec), {'energy': 'high', 'transition': 'whip', 'camera': 'phased', 'hits': True})
        self.assertEqual(ingredient_props({'style': {'energy': 'calm'}}),
                         {'energy': 'calm', 'transition': 'cut', 'camera': 'none', 'hits': False})
        with self.assertRaises(ValueError):
            ingredient_props({'style': {'transitions': {'kind': 'spin', 'reason': 'x'}}})

    def test_the_layout_modes_are_the_renderers(self):
        self.assertEqual(LAYOUTS, ('house', 'fill', 'stack', 'band', 'stage', 'tray'))

    def test_no_sound_preserves_serialized_props_with_other_style_ingredients(self):
        fixture = ROOT / 'fixtures/ve/my-test-19s'
        spec = json.loads((fixture / 'spec.json').read_text())
        spec.setdefault('style', {}).update({'camera': {'move': 'phased', 'reason': 'x'}, 'energy': 'high'})
        words = [dict(w, end_s=w['onset_s'] + .2) for w in json.loads((fixture / 'words.frames.json').read_text())]
        props = compile_cut(spec, 'proof-tall', words, fixture)
        before = json.dumps(props).encode()
        props['audio']['sfx'] = sound_props(spec, props, fixture)
        self.assertEqual(json.dumps(props).encode(), before)
        with patch('velib.compile.sound_props', side_effect=AssertionError('sound was not chosen')):
            self.assertEqual(json.dumps(compile_cut(spec, 'proof-tall', words, fixture)).encode(), before)


class TrayTest(unittest.TestCase):
    def test_the_tray_needs_upper_captions(self):
        from velib import compile as c
        src = Path(c.__file__).read_text(encoding='utf-8')
        self.assertIn("layout == 'tray' and props.get('captionPlacement') != 'upper'", src)


if __name__ == '__main__':
    unittest.main()
