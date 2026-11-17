"""The voice bank (config/voice-bank.json; Krish, 2026-11-17: "I want Eleven Labs voices used to do the voiceovers. I
always want to be given a few options in my control center. We should have some stock voices approved in Eleven Labs and,
obviously, my own Krish remix voice too").

Held here: the bank holds exactly one of his own voices and ElevenLabs preview clips only; a stock voice is generated only
once he approved it, and never stands in for his own voice; `ve voice clone --voice` plans a stock voice from the bank
(no registry read, no synthetic approval: it is not his voice) and his own from krish-clone's registry, which wins over
the bank; the off-day rotation is what a voiceover's bed and a carousel's track are offered from.

No network and no spend: the registry is stubbed, and ids in stubs are invented."""
from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'tests'))
from velib import clone_voice, voice_bank  # noqa: E402
from velib import lint as ve_lint  # noqa: E402
from velib.common import load_json  # noqa: E402
from ve_clone_voice_test import CLONE, FIXTURE, registry, served, short, voice_asset  # noqa: E402

BANK = load_json(ROOT / 'config' / 'voice-bank.json')
SCRIPT = FIXTURE / 'script.words.json'


def bank_with(**status) -> dict:
    """The real bank with some voices' status changed (and an approval when approved)."""
    out = copy.deepcopy(BANK)
    for v in out['voices']:
        if v['id'] in status:
            v['status'] = status[v['id']]
            if status[v['id']] == 'approved':
                v.update(approved_by='Krish', approved_on='2026-11-18')
    return out


class TheBankHolds(unittest.TestCase):
    def test_the_bank_on_file_holds(self):
        self.assertEqual(voice_bank.problems(BANK), [])
        # His default is Krish v2 (Krish, 2026-11-17: "this is the best choice thus far"); Krish Remix is the backup.
        mine = voice_bank.krish(BANK)
        self.assertEqual((mine['id'], mine['registry_name'], mine['model'], mine['speed']),
                         ('krish-v2', 'krish-voice-elevenlabs-v2', 'eleven_v3', 1.15))
        backup = voice_bank.krish(BANK, 'krish-remix')
        self.assertEqual((backup['registry_name'], backup['status'], backup.get('default')), ('krish-voice-elevenlabs', 'approved', False))
        stock = [v for v in BANK['voices'] if v['kind'] == 'stock']
        self.assertTrue(3 <= len(stock) <= 4, 'three or four stock voices are proposed')
        # Nothing is approved for him: every stock voice waits on his press on the board.
        self.assertTrue(all(v['status'] == 'proposed' for v in stock))

    def test_a_broken_bank_is_refused(self):
        two = copy.deepcopy(BANK)
        next(v for v in two['voices'] if v['id'] == 'krish-remix')['default'] = True
        self.assertTrue(any('exactly one is (default: true)' in p for p in voice_bank.problems(two)))
        fast = copy.deepcopy(BANK)
        fast['voices'][0]['speed'] = 2
        self.assertTrue(any('speed' in p for p in voice_bank.problems(fast)))
        outside = copy.deepcopy(BANK)
        outside['voices'][1]['preview_url'] = 'https://example.com/a.mp3'
        self.assertTrue(any('preview_url' in p for p in voice_bank.problems(outside)))
        unsigned = bank_with(clyde='approved')
        del next(v for v in unsigned['voices'] if v['id'] == 'clyde')['approved_by']
        self.assertTrue(any('approved_by Krish' in p for p in voice_bank.problems(unsigned)))
        unpinned = copy.deepcopy(BANK)
        del unpinned['voices'][2]['model']
        self.assertTrue(any('pins its own model' in p for p in voice_bank.problems(unpinned)))
        dup = copy.deepcopy(BANK)
        dup['voices'][2]['voice_id'] = dup['voices'][1]['voice_id']
        self.assertTrue(any('listed twice' in p for p in voice_bank.problems(dup)))

    def test_the_registry_wins_over_the_bank(self):
        entry = {**CLONE, 'platform_ref': voice_bank.krish(BANK)['voice_id']}
        self.assertEqual(voice_bank.registry_problems(BANK, [entry]), [])
        self.assertIn('the registry wins', voice_bank.registry_problems(BANK, [CLONE])[0])
        self.assertIn('not an active', voice_bank.registry_problems(BANK, [])[0])

    def test_the_off_day_rotation_is_what_beds_and_tracks_are_offered_from(self):
        ids = [t['id'] for t in voice_bank.offday_tracks()]
        ledger = [t['id'] for t in load_json(ROOT / 'config' / 'music-library.json')['tracks'] if t.get('for') == 'off-day']
        self.assertEqual(ids, ledger)
        self.assertTrue(ids)


class AStockVoiceIsNeverHisVoice(unittest.TestCase):
    def test_only_an_approved_stock_voice_passes(self):
        self.assertIn('proposed', voice_bank.stock_problem('elevenlabs.stock_voice:clyde', BANK))
        self.assertIsNone(voice_bank.stock_problem('elevenlabs.stock_voice:clyde', bank_with(clyde='approved')))
        self.assertIn('not in the voice bank', voice_bank.stock_problem('elevenlabs.stock_voice:nobody', BANK))

    def test_his_own_voice_named_as_stock_is_refused(self):
        problem = voice_bank.stock_problem('elevenlabs.stock_voice:krish-remix', BANK)
        self.assertIn('his own voice, never a stock voice', problem)
        self.assertIn('his own voice', voice_bank.stock_problem('elevenlabs.stock_voice:krish-v2', BANK))

    def test_lint_holds_a_stock_voice_to_the_bank_not_the_registry(self):
        asset = voice_asset(tool='elevenlabs.stock_voice:clyde', licence='an approved stock voice (test)')
        spec = short(voice=asset, approve=None)
        self.assertEqual([u for u in ve_lint.synthetic_uses(spec) if u['kind'] == 'voice'], [])
        with patch.object(voice_bank, 'load', return_value=BANK):
            self.assertIn('proposed', ve_lint.clone_tool_problem(asset))
        with patch.object(voice_bank, 'load', return_value=bank_with(clyde='approved')):
            self.assertIsNone(ve_lint.clone_tool_problem(asset))
            self.assertEqual(ve_lint.clone_voice_lints(spec), [])
        # The route still holds: a stock voice voices an off-day short only.
        hero = short('2026-10-23', voice=asset, approve=None)
        with patch.object(voice_bank, 'load', return_value=bank_with(clyde='approved')):
            self.assertTrue(any('hero piece' in p for p in ve_lint.clone_voice_lints(hero)))


class ThePlanReadsThePickedVoice(unittest.TestCase):
    def test_an_approved_stock_voice_plans_without_the_registry(self):
        bank = bank_with(jackson='approved')
        with patch.object(ve_lint, 'fetch_synthetic_registry', side_effect=AssertionError('no registry read')):
            doc = clone_voice.plan(short(approve=None), SCRIPT, voice='jackson', bank=bank)
        jackson = voice_bank.voice(bank, 'jackson')
        self.assertEqual(doc['clone']['voice_id'], jackson['voice_id'])
        self.assertEqual(doc['clone']['kind'], 'stock')
        self.assertEqual(doc['tool'], 'elevenlabs.stock_voice:jackson')
        self.assertEqual(doc['model'], jackson['model'])
        self.assertEqual(doc['plan_sha256'], clone_voice.digest(doc))

    def test_a_proposed_stock_voice_is_never_generated(self):
        with self.assertRaisesRegex(ValueError, 'proposed in the voice bank'):
            clone_voice.plan(short(approve=None), SCRIPT, voice='jackson', bank=BANK)

    def test_record_it_myself_generates_nothing_and_points_to_teleprompter(self):
        # Krish, 2026-11-17: "I should be able to choose to record manually myself as well, and then the teleprompter
        # workflow will activate, as opposed to the ElevenLabs workflow".
        with patch.object(ve_lint, 'fetch_synthetic_registry', side_effect=AssertionError('no registry read')), \
                self.assertRaisesRegex(ValueError, 'Teleprompter'):
            clone_voice.plan(short(), SCRIPT, voice=voice_bank.RECORD_MYSELF, bank=BANK)

    def test_an_unknown_voice_is_refused(self):
        with self.assertRaisesRegex(ValueError, 'not in the voice bank'):
            clone_voice.plan(short(), SCRIPT, voice='nobody', bank=BANK)

    def test_his_own_voice_picked_must_be_the_one_the_registry_approves(self):
        remix = {**CLONE, 'name': 'krish-voice-elevenlabs'}
        with served(registry(remix)), self.assertRaisesRegex(ValueError, 'the registry wins'):
            clone_voice.plan(short(approve=remix), SCRIPT, voice='krish-remix', bank=BANK)
        mine = {**remix, 'platform_ref': voice_bank.krish(BANK, 'krish-remix')['voice_id']}
        with served(registry(mine)):
            doc = clone_voice.plan(short(approve=mine), SCRIPT, voice='krish-remix', bank=BANK)
        self.assertEqual(doc['tool'], 'elevenlabs.voice_clone:krish-voice-elevenlabs')
        self.assertEqual(doc['clone']['voice_id'], mine['platform_ref'])
        # Krish, 2026-11-17: "v3 sounds right" for his Krish Remix voice; the backup is read at its own speed.
        self.assertEqual(doc['model'], 'eleven_v3')
        self.assertNotIn('speed', doc)

    def test_his_default_is_krish_v2_on_v3_fifteen_percent_faster(self):
        v2 = {**CLONE, 'platform_ref': voice_bank.krish(BANK)['voice_id']}
        with served(registry(v2)):
            doc = clone_voice.plan(short(approve=v2), SCRIPT, bank=BANK)
        self.assertEqual(doc['tool'], 'elevenlabs.voice_clone:krish-voice-elevenlabs-v2')
        self.assertEqual((doc['model'], doc['speed']), ('eleven_v3', 1.15))
        # Until krish-clone's registry holds Krish v2, nothing is generated in it.
        with served(registry({**CLONE, 'name': 'krish-voice-elevenlabs'})), self.assertRaisesRegex(ValueError, 'not an approved voice'):
            clone_voice.plan(short(), SCRIPT, bank=BANK)

    def test_the_wav_is_sped_up_keeping_pitch(self):
        v2 = {**CLONE, 'platform_ref': voice_bank.krish(BANK)['voice_id']}
        with served(registry(v2)):
            doc = clone_voice.plan(short(approve=v2), SCRIPT, bank=BANK)
        runs = []
        def ffmpeg_run(cmd, **_):
            runs.append(cmd)
            Path(cmd[-1]).write_bytes(b'RIFF')
        import tempfile  # noqa: PLC0415
        with tempfile.TemporaryDirectory() as out, patch.object(clone_voice.subprocess, 'run', side_effect=ffmpeg_run):
            receipt = clone_voice.generate(doc, plan_sha256=doc['plan_sha256'], spend_id='00000000-0000-4000-8000-000000000000',
                                           assets_dir=out, env={'ELEVENLABS_API_KEY': 'test'},
                                           post=lambda *a: (b'mp3', {'character-cost': '10'}), reserve=lambda *a: 'r1', settle=lambda *a: None)
        self.assertIn('atempo=1.15', runs[0])
        self.assertEqual(receipt['speed'], 1.15)


if __name__ == '__main__':
    unittest.main()
