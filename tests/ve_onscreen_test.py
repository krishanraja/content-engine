"""On-screen checks (scripts/velib/qc_onscreen.py), each refusing the real case from the week of 2 Nov
(docs/learning/2026-11-07-week-of-2-nov-postmortem.md, causes A to C; Bugs & Issues, 7 Nov).

Krish, 7 Nov: "some issues with how some of the underlining animations work where text is being drawn on or
underlined." And on Wed 4 Nov: "The animations get cut off. They're not full screen, specifically when there's the
hand holding the phone. The screenshots are just not really clear enough in terms of being able to make a clear point."

The real case is the 6 Nov reel's own props (two passports, cut friday-tall), so each test refuses exactly what posted.
"""
import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import guards, qc_onscreen  # noqa: E402

PROPS = ROOT / 'docs/plans/2026-10-23-friday-two-passports-ve/ve/props.friday-tall.json'
SPEC = ROOT / 'docs/plans/2026-10-23-friday-two-passports-ve/ve/spec.json'
BOUND = '2026-11-16'


def props():
    return json.loads(PROPS.read_text(encoding='utf-8'))


def obj(p, name):
    return next(o for o in p['objects'] if o['obj'] == name)


def frame_video(temp, frames=130):
    out = Path(temp) / 'cut.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=gray:s=1080x1920:r=30:d={frames / 30}',
                    '-pix_fmt', 'yuv420p', str(out)], check=True)
    return out


class Binding(unittest.TestCase):
    def test_pieces_in_production_are_shown_not_held(self):
        # Wed 11 and Fri 13 Nov are being made now: the rows are advisory for them (F33), binding from 14 Nov.
        self.assertFalse(qc_onscreen.bound('2026-11-13'))
        self.assertTrue(qc_onscreen.bound('2026-11-14'))
        rows = qc_onscreen.rows(None, props(), '2026-11-13')
        self.assertEqual(rows['captions.repeat_title']['status'], 'advisory')
        self.assertFalse(rows['captions.repeat_title']['pass'])

    def test_bound_rows_count(self):
        rows = qc_onscreen.rows(None, props(), BOUND)
        for name in ('annotation.target', 'captions.phrase_breaks', 'captions.repeat_title'):
            self.assertIs(rows[name]['pass'], False, name)
            self.assertNotIn('status', rows[name], name)
        # No file: the frame rows are not_run, never passed.
        self.assertEqual(rows['annotation.on_target']['status'], 'not_run')

    def test_the_checks_are_outside_the_engine_hash(self):
        # Landing them changes no piece's engine (config/ve/production-guards.json engine.paths; F33).
        paths = guards.config()['engine']['paths']
        for rel in ('scripts/velib/qc_onscreen.py', 'scripts/velib/qc.py', 'scripts/velib/guards.py',
                    'config/ve/onscreen-checks.json', 'scripts/channel_safe.py', 'config/channel-safe-zones.json'):
            self.assertFalse(any(rel == p or rel.startswith(p.rstrip('/') + '/') for p in paths), rel)


class Captions(unittest.TestCase):
    def test_the_caption_that_repeated_does_that_matter_is_refused(self):
        hits = qc_onscreen.title_repeats(props())
        pages = {h['page']: h['title'] for h in hits}
        self.assertEqual(pages.get('Does that matter?'), 'matter_head')
        self.assertEqual(pages.get('a Chinese AI.'), 'hook_head')

    def test_a_caption_that_adds_to_the_title_passes(self):
        p = props()
        obj(p, 'matter_head')['params']['lines'] = ['WHO SEES', 'YOUR DATA?']
        self.assertNotIn('Does that matter?', {h['page'] for h in qc_onscreen.title_repeats(p)})

    def test_using_then_a_chinese_ai_is_a_mid_phrase_break(self):
        hits = qc_onscreen.phrase_breaks(props())
        first = hits[0]
        self.assertEqual((first['page'], first['next']), ('You may already be using', 'a Chinese AI.'))
        self.assertIn({'page': 'questions, and a third of', 'next': 'the time they refused,'},
                      [{'page': h['page'], 'next': h['next']} for h in hits])

    def test_pages_that_end_at_a_phrase_pass(self):
        p = {'captions': [
            {'fromFrame': 0, 'toFrame': 30, 'words': [{'text': 'You', 'atFrame': 0}, {'text': 'may', 'atFrame': 5},
                                                      {'text': 'already', 'atFrame': 9}]},
            {'fromFrame': 30, 'toFrame': 60, 'words': [{'text': 'be', 'atFrame': 30}, {'text': 'using', 'atFrame': 33},
                                                       {'text': 'a', 'atFrame': 37}, {'text': 'Chinese', 'atFrame': 40},
                                                       {'text': 'AI.', 'atFrame': 50}]},
            {'fromFrame': 60, 'toFrame': 90, 'words': [{'text': 'Does', 'atFrame': 60}, {'text': 'it', 'atFrame': 64},
                                                       {'text': 'matter?', 'atFrame': 70}]}]}
        self.assertEqual(qc_onscreen.phrase_breaks(p), [])


class Annotation(unittest.TestCase):
    def test_the_at_stake_underline_is_refused_at_lint_and_at_qc(self):
        spec = json.loads(SPEC.read_text(encoding='utf-8'))
        spec['publish_day'] = BOUND
        lint = [line for line in guards.annotation_lints(spec) if line.startswith('annotation.target hook_scribble')]
        self.assertTrue(any('names no target' in line for line in lint), lint)
        self.assertTrue(any('phone_hook' in line and 'tilts and scales' in line for line in lint), lint)
        spec['publish_day'] = '2026-10-23'
        self.assertEqual(guards.annotation_lints(spec), [])

    def test_a_named_mark_on_a_full_frame_element_passes_the_props_check(self):
        mark = {'obj': 'm', 'device': 'scribble', 'meaning': 'underlines "a third of the time"',
                'params': {'shape': 'underline', 'colour': 'cream', 'seed': '1', 'from': [80, 700], 'to': [900, 704]}}
        beats = [{'id': 'third', 'uses': ['third_head', 'm']}]
        self.assertEqual(qc_onscreen.annotation_problems([mark, {'obj': 'third_head', 'device': 'headline'}], beats), [])

    # On the rendered frame: the 6 Nov underline ran from (215, 896) to (700, 916), across the card's bottom border;
    # the words it was meant for sat higher on the tilted card. Word boxes stand in for tesseract's reading.
    UNDERLINE = {'shape': 'underline', 'colour': 'cream', 'seed': '4', 'from': [215, 896], 'to': [700, 916], 'amp': 2.4}
    CARD_WORDS = [('Who', 92.0, (236, 742, 120, 58)), ('sees', 92.0, (372, 738, 130, 58)),
                  ('your', 92.0, (518, 734, 128, 58)), ('data.', 92.0, (660, 730, 150, 58))]

    def test_an_underline_on_the_card_border_misses_its_words(self):
        result = qc_onscreen.landed(self.UNDERLINE, self.CARD_WORDS, qc_onscreen.tokens('Who sees your data'))
        self.assertFalse(result['ok'])

    def test_an_underline_just_under_its_words_lands(self):
        on = dict(self.UNDERLINE, **{'from': [236, 806], 'to': [800, 800]})
        self.assertTrue(qc_onscreen.landed(on, self.CARD_WORDS, qc_onscreen.tokens('Who sees your data'))['ok'])

    def test_a_loop_round_its_words_lands_and_one_beside_them_does_not(self):
        words = [('THIRD', 95.0, (300, 900, 300, 120))]
        round_it = {'shape': 'loop', 'colour': 'cream', 'seed': '1', 'target': {'x': 280, 'y': 880, 'w': 340, 'h': 160}}
        beside = {'shape': 'loop', 'colour': 'cream', 'seed': '1', 'target': {'x': 700, 'y': 880, 'w': 300, 'h': 160}}
        self.assertTrue(qc_onscreen.landed(round_it, words, ['third'])['ok'])
        self.assertFalse(qc_onscreen.landed(beside, words, ['third'])['ok'])

    def test_words_that_cannot_be_read_never_pass(self):
        self.assertFalse(qc_onscreen.landed(self.UNDERLINE, [], ['who', 'sees'])['ok'])

    def test_on_target_reads_the_rendered_frame_after_the_stroke(self):
        p = props()
        mark = obj(p, 'hook_scribble')
        mark['meaning'] = 'underlines "Who sees your data"'
        seen = []

        def read(png):
            seen.append(png.name)
            return self.CARD_WORDS
        with tempfile.TemporaryDirectory() as temp:
            hits = qc_onscreen.on_target(str(frame_video(temp)), p, read=read)
        # The stroke starts at frame 73 and draws for 10 frames; it is read once drawn, at 85.
        self.assertEqual(seen, ['f000085.png'])
        self.assertEqual([h['obj'] for h in hits], ['hook_scribble'])


class Evidence(unittest.TestCase):
    def test_the_quote_on_the_hand_held_phone_too_small_to_read_is_flagged(self):
        p = props()
        p['beats'] = [b for b in p['beats'] if b['id'] == 'airbnb']
        # The quote on the tilted phone screen, read at about 26 px tall on the 1080x1920 frame.
        small = lambda _png: [("We're", 88.0, (300, 820, 70, 26)), ('relying', 88.0, (380, 818, 96, 26)),
                              ("Alibaba's", 88.0, (300, 856, 120, 26)), ('Qwen', 88.0, (430, 856, 70, 26))]
        with tempfile.TemporaryDirectory() as temp:
            video = frame_video(temp, frames=340)
            hits = qc_onscreen.readable(str(video), p, read=small)
            self.assertEqual([(h['obj'], h['word_px']) for h in hits], [('phone_hook', 26)])
            none = qc_onscreen.readable(str(video), p, read=lambda _png: [])
            self.assertEqual(none[0]['why'], 'none of its words can be read on the frame')
            full = lambda _png: [("Alibaba's", 90.0, (80, 700, 420, 84)), ('Qwen', 90.0, (520, 700, 240, 84))]
            self.assertEqual(qc_onscreen.readable(str(video), p, read=full), [])

    def test_only_the_tall_frame_is_held(self):
        p = props()
        p['aspect'] = '16:9'
        self.assertEqual(qc_onscreen.readable('unused.mp4', p, read=lambda _png: []), [])


class InQc(unittest.TestCase):
    def test_run_qc_carries_the_rows_and_counts_them_only_when_bound(self):
        from velib.qc import run_qc
        p = props()
        with tempfile.TemporaryDirectory() as temp:
            video = frame_video(temp, frames=60)
            early = run_qc(str(video), 'hand-held-screen', composition_props=copy.deepcopy(p), aspect='9:16',
                           publish_day='2026-11-13', onscreen_reader=lambda _png: [])
            bound = run_qc(str(video), 'hand-held-screen', composition_props=copy.deepcopy(p), aspect='9:16',
                           publish_day=BOUND, onscreen_reader=lambda _png: [])
        self.assertEqual(early['checks']['captions.repeat_title']['status'], 'advisory')
        self.assertIs(bound['checks']['captions.repeat_title']['pass'], False)
        self.assertFalse(bound['measured_pass'])


if __name__ == '__main__':
    unittest.main()
