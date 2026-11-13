"""The ingredients chosen per piece apart from the motion style (docs/ve/INGREDIENTS.md): compile turns style.captions,
style.transitions, style.camera and style.energy into props, and none of them means none (Krish, 2026-11-13: "the
captions should be decoupled from the animation styles")."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.compile import LAYOUTS, caption_props, ingredient_props  # noqa: E402


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


if __name__ == '__main__':
    unittest.main()
