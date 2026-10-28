"""STAGE layout and approved-format handoff contract."""
import copy
import json
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import lint, qc
from velib.compile import compile_cut
from velib.common import load_json


class StageTests(unittest.TestCase):
    def test_canvas_tables_and_multiple_device_cues(self):
        layouts = qc._renderer_layouts()
        for aspect, canvas in [('9:16', (0, 0, 1080, 1920)), ('16:9', (0, 0, 1920, 1080))]:
            with self.subTest(aspect=aspect):
                self.assertEqual(layouts[aspect]['STAGE'], [canvas])
                props = dict(aspect=aspect, beats=[dict(layout='STAGE', uses=['a', 'b', 'c'], fromFrame=0, toFrame=90)],
                             events=[dict(id=name, obj=name, atFrame=30) for name in ['a', 'b', 'c']],
                             captions=[], audio={'stem': {'src': 'dialogue.wav'}}, brand={'mark': {'src': 'mark.png'}})
                self.assertEqual(qc.inputs_from_props(props)['slots'], dict.fromkeys(['a', 'b', 'c'], canvas))

    def test_formats_match_lock_and_refuse_missing_devices(self):
        lock = load_json(ROOT / 'config/ve/design-lock.json')
        base = load_json(ROOT / 'config/ve/formats/voice-led-pictures.json')
        fixture = load_json(ROOT / 'fixtures/ve/my-test-19s/spec.json')
        registered = load_json(ROOT / 'config/ve/devices.json')['devices']
        for ident in ['hand-held-screen', 'two-passports']:
            with self.subTest(format=ident):
                fmt = load_json(ROOT / f'config/ve/formats/{ident}.json')
                self.assertTrue(set(base).issubset(fmt))
                self.assertEqual(fmt['id'], ident)
                self.assertEqual(fmt['design_lock'], ident)
                self.assertEqual(len(fmt['beats']), 5)
                self.assertEqual([b['id'] for b in fmt['beats']], lock['formats'][ident]['beats'])
                self.assertTrue(all(b['layout'] == 'STAGE' for b in fmt['beats']))
                self.assertEqual(fmt['layouts'], ['STAGE'])
                missing = [name for name in fmt['pending_devices'] if name not in registered]
                self.assertTrue(missing)
                expected = f"format {ident} needs devices not built yet: {', '.join(missing)}"
                spec = copy.deepcopy(fixture)
                spec['format'] = ident
                with self.assertRaisesRegex(ValueError, '^' + re.escape(expected) + '$'):
                    compile_cut(spec, next(iter(spec['cuts'])), [], ROOT)
                self.assertEqual(lint.crew_lints(spec), [expected])
                # Registration, including partial progress, is the gate, not the presence of the list itself.
                for available in [missing[:1], missing]:
                    devices = {**registered, **dict.fromkeys(available, {})}
                    with patch.object(lint, 'load_json', return_value={'devices': devices}):
                        rest = [name for name in missing if name not in devices]
                        error = f"format {ident} needs devices not built yet: {', '.join(rest)}" if rest else None
                        self.assertEqual(lint.pending_devices_error(ident, fmt), error)

    def test_legacy_format_has_no_pending_gate(self):
        self.assertIsNone(lint.pending_devices_error('scoreboard-test'))


if __name__ == '__main__':
    unittest.main()
