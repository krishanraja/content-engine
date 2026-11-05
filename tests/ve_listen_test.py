"""The listen pass, the fumble pass, his lexicon and his voice profile, on synthetic sound and clocks. No model, no
network, no real take: the ears that write words are given as data, as a model would return them."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import conform, delivery, fumbles, hear, lexicon, takes  # noqa: E402
from velib.common import write_json  # noqa: E402

RATE = hear.RATE
SCRIPT = 'We tested three models. The answer surprised us.'.split()


def tone(seconds, hz=140.0, level=0.25):
    t = np.arange(int(seconds * RATE)) / RATE
    wave = sum(np.sin(2 * np.pi * hz * k * t) / k for k in range(1, 6))
    return (level * wave / np.max(np.abs(wave))).astype(np.float32)


def sound(spans, duration, hz=140.0):
    """Silence (a faint hiss) with a voiced tone in each (start, end)."""
    rng = np.random.default_rng(7)
    out = (rng.normal(0, 3e-4, int(duration * RATE))).astype(np.float32)
    for s, e, *f in spans:
        a = int(s * RATE)
        piece = tone(e - s, f[0] if f else hz)
        out[a:a + len(piece)] += piece
    return out


def clock(words, start=0.5, word_s=0.30, joint_s=0.04, pause_s=0.40):
    out, t = [], start
    for text in words:
        out.append({'word': text, 'onset_s': round(t, 4), 'end_s': round(t + word_s, 4)})
        t += word_s + (pause_s if text.endswith('.') else joint_s)
    return out, round(t + 0.5, 4)


def spec():
    return {'piece_id': 'listen-fixture', 'format': 'face-with-proof',
            'cuts': {'short': {'aspect': '9:16', 'take': 'take-1', 'edit': {'remove': [], 'speed': 1}}}}


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-listen-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.ve = self.dir / 've'
        self.script = [{'w': i, 'word': w} for i, w in enumerate(SCRIPT)]
        self.lexicon = lexicon._empty()

    def ingest(self, take, words, duration):
        a = self.dir / f'{take}.a.json'
        b = self.dir / f'{take}.b.json'
        a.write_text(json.dumps(words))
        b.write_text(json.dumps({'words': [{'text': w['word'], 'start': w['onset_s'], 'end': w['end_s']} for w in words]}))
        media = self.dir / f'{take}.bin'
        media.write_bytes(take.encode())
        takes.ingest(self.ve, 'listen-fixture', take, media, clock_a=a, clock_b=b, aligner_a='faster-whisper:large-v3',
                     aligner_b='faster-whisper:medium.en', duration_s=duration)
        return takes.load_take(self.ve, take)

    def save(self, record):
        write_json(takes.take_path(self.ve, record['take']), record)


class SoundTest(Fixture):
    def test_frames_hear_a_voice_its_pitch_and_the_quiet_between(self):
        samples = sound([(0.5, 1.0)], 1.5)
        fr = hear.frames(samples)
        lv = hear.levels(fr)
        at = lambda t: int(t / hear.HOP_S)  # noqa: E731
        self.assertTrue(lv['voiced'][at(0.75)])
        self.assertAlmostEqual(fr['f0'][at(0.75)], 140.0, delta=6)
        self.assertTrue(lv['quiet'][at(0.2)])
        self.assertFalse(lv['quiet'][at(0.75)])
        spans = hear.quiet_spans(fr, lv)
        self.assertTrue(any(s <= 0.1 and e >= 0.45 for s, e in spans), spans)
        self.assertFalse(hear.is_quiet(spans, 0.75, 0.02))

    def test_voice_no_clock_word_covers_is_unworded_and_guarded(self):
        words, duration = clock(SCRIPT)
        record = {'media': {'sha256': 'x'}, 'aligners': {'a': {'words': words}, 'b': {'words': words}}}
        gap = (words[3]['end_s'] + 0.12, words[3]['end_s'] + 0.27)
        samples = sound([(w['onset_s'], w['end_s']) for w in words] + [(gap[0], gap[1], 115.0)], duration)
        block = hear.listen(record, samples, lexicon_doc=self.lexicon)
        unworded = [e for e in block['events'] if e['kind'] == 'unworded']
        self.assertEqual(len(unworded), 1, block['events'])
        self.assertEqual(unworded[0]['use'], 'guard')
        self.assertAlmostEqual(unworded[0]['s'], gap[0], delta=0.05)
        self.assertEqual(len(block['words']), len(words))


class EventTest(unittest.TestCase):
    def test_hesitations_broken_words_and_stutters_in_one_ear(self):
        ear = [{'text': 'so', 's': 0.0, 'e': 0.2}, {'text': 'um', 's': 0.3, 'e': 0.5}, {'text': 'cl-', 's': 0.6, 'e': 0.7},
               {'text': 'clearly', 's': 0.75, 'e': 1.1}, {'text': 'the', 's': 1.2, 'e': 1.3}, {'text': 'the', 's': 1.4, 'e': 1.5},
               {'text': 'a', 's': 1.6, 'e': 1.65}, {'text': 'about', 's': 1.7, 'e': 2.0}]
        kinds = [(e['kind'], e['text']) for e in hear.word_events(ear, 'ctc')]
        self.assertEqual(kinds, [('hesitation', 'um'), ('partial', 'cl'), ('stutter', 'the')])  # "a about" is two words

    def test_two_ears_on_one_sound_make_one_event_heard_by_both(self):
        merged = hear.merge([{'kind': 'unworded', 's': 1.0, 'e': 1.3, 'text': '', 'sources': ['voicing']},
                             {'kind': 'hesitation', 's': 1.05, 'e': 1.25, 'text': 'uh', 'sources': ['ctc']}])
        self.assertEqual(len(merged), 1)
        self.assertEqual((merged[0]['kind'], merged[0]['sources']), ('hesitation', ['ctc', 'voicing']))

    def test_a_hesitation_folded_into_a_word_is_trimmed_only_when_two_ears_heard_it(self):
        a = [{'text': 'so', 'onset_s': 1.0, 'end_s': 1.6}]
        ev = {'kind': 'hesitation', 's': 1.3, 'e': 1.6, 'text': 'uh'}
        one = {'ctc': [{'text': 'so', 's': 1.0, 'e': 1.25}, {'text': 'uh', 's': 1.3, 'e': 1.6}]}
        two = {**one, 'whisper': [{'text': 'So,', 's': 1.0, 'e': 1.2}, {'text': 'uh,', 's': 1.32, 'e': 1.6}]}
        self.assertEqual(hear.classify([{**ev, 'sources': ['ctc']}], a, one)[0]['use'], 'flag')
        self.assertEqual(hear.classify([{**ev, 'sources': ['ctc', 'whisper']}], a, two)[0]['use'], 'trim')
        # An ear that only heard the word itself (a "th" for "the") makes no event at all.
        self.assertEqual(hear.classify([{'kind': 'partial', 's': 1.0, 'e': 1.5, 'text': 'so', 'sources': ['ctc']}], a,
                                       {'ctc': [{'text': 'so', 's': 1.0, 'e': 1.5}]}), [])


class TrimTest(unittest.TestCase):
    def test_a_sound_in_the_middle_of_a_word_is_never_trimmed_out_of_it(self):
        record = {'take': 't', 'media': {'sha256': 'x', 'duration_s': 3.0},
                  'aligners': {'a': {'words': [{'i': 0, 'text': 'clearly', 'onset_s': 1.0, 'end_s': 1.6}]},
                               'b': {'words': [{'i': 0, 'text': 'clearly', 'onset_s': 1.0, 'end_s': 1.6}]}}}
        record['listen'] = {'schema': hear.SCHEMA, 'media_sha256': 'x', 'quiet': [[0, 3.0]], 'words': [],
                            'events': [{'kind': 'hesitation', 's': 1.30, 'e': 1.40, 'text': 'uh', 'use': 'trim',
                                        'sources': ['ctc', 'whisper']}]}
        heard = fumbles.clocks(record)
        self.assertEqual([(w['text'], w['onset_s'], w['end_s']) for w in heard['a']], [('clearly', 1.0, 1.6)])
        self.assertEqual((heard['b'][0]['onset_s'], heard['b'][0]['end_s']), (1.0, 1.6))
        record['listen']['events'][0].update(s=1.45, e=1.6)       # at the word's end: trimmed, then cut like a flub
        heard = fumbles.clocks(record)
        self.assertEqual([(w['text'], w['end_s']) for w in heard['a']], [('clearly', 1.45), ('<uh>', 1.6)])


class ConformTest(Fixture):
    def _with_uh(self, record, words, ears_hear_it=True):
        """An "uh" in the pause after "models.": voice at the time, and the letter-by-letter ear wrote it down."""
        s = words[3]['end_s'] + 0.13
        e = s + 0.14
        samples = sound([(w['onset_s'], w['end_s']) for w in words] + [(s, e, 120.0)], record['media']['duration_s'])
        ears = {'ctc': [{'text': w['word'].strip('.').lower(), 's': w['onset_s'], 'e': w['end_s']} for w in words[:4]]
                + ([{'text': 'uh', 's': s, 'e': e}] if ears_hear_it else [])
                + [{'text': w['word'].strip('.').lower(), 's': w['onset_s'], 'e': w['end_s']} for w in words[4:]]}
        record['listen'] = hear.listen(record, samples, ears=ears, lexicon_doc=self.lexicon)
        self.save(record)
        return s, e

    def test_an_uh_the_transcript_left_out_is_cut_and_reported(self):
        words, duration = clock(SCRIPT)
        record = self.ingest('take-1', words, duration)
        before = conform.conform(spec(), 'short', self.script, self.ve)
        self.assertEqual(before['flubs_removed'], [])       # plays straight through: the uh is in the cut
        s, e = self._with_uh(record, words)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        self.assertEqual(len(edl['flubs_removed']), 1, edl['flubs_removed'])
        flub = edl['flubs_removed'][0]
        self.assertEqual(flub['unwritten'][0]['kind'], 'hesitation')
        self.assertIn('ctc', flub['unwritten'][0]['heard_by'])
        self.assertLess(edl['duration_s'], before['duration_s'])
        for seg in edl['segments']:                     # no cut point inside the uh
            for t in (seg['src_in_s'], seg['src_out_s']):
                self.assertFalse(s - 0.02 < t < e + 0.02, (t, s, e))
        records = conform.records_for(edl, self.ve)
        self.assertEqual(conform.lint_edl(edl, records, spec()), [])
        self.assertEqual([w['word'] for w in edl['words']], SCRIPT)   # every scripted word kept
        self.assertEqual(edl['listen']['take-1']['events'].get('hesitation:word'), 1)

    def test_voice_alone_is_never_cut(self):
        words, duration = clock(SCRIPT)
        record = self.ingest('take-1', words, duration)
        self._with_uh(record, words, ears_hear_it=False)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        self.assertEqual(edl['flubs_removed'], [])

    def test_no_join_lands_on_sound_and_the_lint_rederives_it(self):
        words, duration = clock(SCRIPT)
        record = self.ingest('take-1', words, duration)
        record['listen'] = {'schema': hear.SCHEMA, 'media_sha256': record['media']['sha256'], 'ears': ['voicing'],
                            'quiet': [], 'events': [], 'words': []}
        self.save(record)
        with self.assertRaisesRegex(ValueError, 'found no quiet anywhere'):
            conform.conform(spec(), 'short', self.script, self.ve)
        record['listen']['quiet'] = [[0.0, 0.1]]       # quiet, but nowhere a line could start
        self.save(record)
        with self.assertRaisesRegex(ValueError, 'agreed gap'):
            conform.conform(spec(), 'short', self.script, self.ve)
        record['listen']['quiet'] = [[0.0, duration]]
        self.save(record)
        edl = conform.conform(spec(), 'short', self.script, self.ve)
        records = conform.records_for(edl, self.ve)
        self.assertEqual(conform.lint_edl(edl, records, spec()), [])
        record['listen']['quiet'] = [[0.0, 0.1]]       # the same EDL, now on a take heard as loud at its cut points
        self.save(record)
        problems = conform.lint_edl(edl, conform.records_for(edl, self.ve), spec())
        self.assertTrue(any('lands on sound' in p for p in problems), problems)
        del record['listen']                            # a listen pass the take no longer has
        self.save(record)
        problems = conform.lint_edl(edl, conform.records_for(edl, self.ve), spec())
        self.assertTrue(any('no longer has' in p for p in problems), problems)

    def test_the_reading_that_sounded_right_wins_over_the_later_take(self):
        words, duration = clock(SCRIPT)
        first = self.ingest('take-1', words, duration)
        later = self.ingest('take-2', words, duration)
        for record, ratio in ((first, 1.0), (later, 3.1)):
            record['listen'] = {'schema': hear.SCHEMA, 'media_sha256': record['media']['sha256'], 'ears': ['voicing'],
                                'quiet': [[0.0, duration]], 'events': [],
                                'words': [{'i': i, 'dur_ratio': ratio if i == 5 else 1.0} for i in range(len(words))]}
            self.save(record)
        edl = conform.conform(spec(), 'short', self.script, self.ve, takes=['take-1', 'take-2'])
        # Without the listen pass the later take wins both lines; "answer" sounded wrong in take 2, so take 1 plays
        # straight through (one reading, no join, no word that sounded wrong).
        self.assertEqual([line['take'] for line in edl['lines']], ['take-1', 'take-1'])
        self.assertEqual(edl['sounded_wrong'], [])
        only = conform.conform(spec(), 'short', self.script, self.ve, takes=['take-2'])
        self.assertEqual([r['word'] for r in only['sounded_wrong']], ['answer'])
        self.assertIn('his usual length', only['sounded_wrong'][0]['why'][0])

    def test_without_a_listen_pass_conform_is_unchanged(self):
        words, duration = clock(SCRIPT)
        record = self.ingest('take-1', words, duration)
        heard = fumbles.clocks(record)
        self.assertIsNone(heard['quiet'])
        self.assertEqual([w['text'] for w in heard['a']], SCRIPT)
        record['listen'] = {'schema': hear.SCHEMA, 'media_sha256': 'another file', 'quiet': [], 'events': [], 'words': []}
        self.assertIsNone(fumbles.clocks(record)['quiet'])     # a pass made from other media is ignored


class LexiconTest(unittest.TestCase):
    def report(self, take, sha, devs):
        return {'take': take, 'media_sha256': sha, 'differences': devs}

    def test_it_learns_names_mishearings_hesitations_and_his_added_words(self):
        doc = lexicon._empty()
        script = 'ByteDance trained Opus 5.5 faster. Krish says Anthropic knows.'
        devs = [{'kind': 'said differently', 'tags': ['rephrase'], 'script': 'ByteDance', 'said': 'Bike Dance'},
                {'kind': 'said differently', 'tags': ['rephrase'], 'script': 'Krish', 'said': 'Chris'},
                {'kind': 'said differently', 'tags': ['rephrase'], 'script': 'faster', 'said': 'quicker'},
                {'kind': 'added', 'tags': ['filler'], 'script': '', 'said': 'um'},
                {'kind': 'added', 'tags': ['filler', 'signpost'], 'script': '', 'said': 'So'}]
        changed = lexicon.learn(doc, script, self.report('take-1', 'aaa', devs))
        self.assertEqual(changed['terms'], ['ByteDance', 'Opus 5.5', 'Anthropic'])   # never his name
        self.assertEqual(changed['fixes'], [['Bike Dance', 'ByteDance']])             # not a rephrase, not his name
        self.assertEqual(doc['hesitations']['counts'], {'um': 1})
        self.assertEqual(doc['habits']['added'], {'so': 1})
        self.assertEqual(lexicon.fixes(doc), [])                                       # one take: not yet applied
        self.assertEqual(lexicon.learn(doc, script, self.report('take-1', 'aaa', devs))['skipped'], 'already learned from this take')
        lexicon.learn(doc, script, self.report('take-2', 'bbb', devs[:1]))
        self.assertEqual(lexicon.fixes(doc), [])                                       # never applied blind
        self.assertEqual(lexicon.fixes(doc, 'ByteDance trains.'), [['Bike Dance', 'ByteDance']])   # two takes, in the script
        self.assertEqual(lexicon.fixes(doc, 'The weather in the cloud.'), [])
        self.assertEqual(doc['proposals'], [])                                         # nothing about taste by itself

    def test_his_name_run_together_is_still_his_name(self):
        for text in ('KrishRaja', 'content.krishraja.com', 'Chris'):
            self.assertTrue(lexicon.names_him(text), text)
        self.assertEqual(lexicon.script_terms('Visit KrishRaja and Anthropic.'), ['Anthropic'])

    def test_the_prompt_names_the_publication_and_terms_never_him(self):
        doc = lexicon._empty()
        doc['terms'] = [{'text': 'Higgsfield', 'count': 3, 'sources': []}]
        text = lexicon.prompt(doc, 'So Krish tried GPT-6 at OpenAI.')
        self.assertTrue(text.startswith('makeyourmindup.'))
        self.assertIn('GPT-6', text)
        self.assertIn('Higgsfield', text)
        self.assertNotIn('Krish', text)

    def test_the_repository_lexicon_carries_quick_edit_fixes_and_no_name(self):
        doc = lexicon.load()
        self.assertIn(['Bike Dance', 'ByteDance'], lexicon.fixes(doc))
        for row in doc['terms'] + doc['fixes']:
            self.assertFalse(lexicon.names_him(json.dumps(row)), row)


class ProfileTest(Fixture):
    def test_measures_and_profile_in_numbers(self):
        words, duration = clock(SCRIPT)
        record = self.ingest('take-1', words, duration)
        samples = sound([(w['onset_s'], w['end_s']) for w in words], duration)
        record['listen'] = hear.listen(record, samples, lexicon_doc=self.lexicon)
        row = record['listen']['words'][0]
        self.assertAlmostEqual(row['f0_hz'], 140, delta=6)
        self.assertGreater(row['voiced_share'], 0.6)
        doc = delivery.profile([record], today='2026-11-05')
        self.assertEqual(doc['schema'], 'voice-profile/1')
        self.assertAlmostEqual(doc['pitch']['median_hz'], 140, delta=6)
        self.assertGreater(doc['pace']['words_per_s_median'], 1)
        self.assertEqual(doc['takes'][0]['take'], 'take-1')
        self.assertNotIn('words', json.dumps(doc['takes']))


if __name__ == '__main__':
    unittest.main()
