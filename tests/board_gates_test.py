"""The production gates on a day's tab (docs/PUBLISH_BOARDS.md, "The production gates on a day's tab"; Krish,
2026-11-04: "Can I select a visual style now that we have different style skills? Do I get shown mocks at the right
moment?"): week_board.py draws Storyboard, Style, Proof and Cut on a series day's Record step from --storyboard,
--styles, --proof and --assets, each press bound to the sha256 of what it shows; a day without them is drawn exactly as
before. Run with python3 tests/board_gates_test.py."""
import hashlib
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import week_board as wb  # noqa: E402

WED = wb.WED_ID
REVIEW = {'wed': [('article', 'Article draft', 'Words.'), ('five-minute-script', 'Five-minute script', 'Said long.'),
                  ('90-second-script', '90-second script', 'Said short.')]}
STORY = '# Beat 1\nThe hook, on camera.\n\n# Beat 2\nThe split: the chart beside him.\r\n'
EXPECT = '- Captions sit below the face.\n- No sound effects yet.\n'
CLIP_A, CLIP_B, PROOF = 'a' * 64, 'b' * 64, 'c' * 64
LONG, SHORT = 'd' * 64, 'e' * 64


def stamp_free(page):
    page = re.sub(r'sha256=[0-9a-f]{64}', 'sha256=', page, count=1)
    return re.sub(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z', 'T', page)


class Gates(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.week = wb.LAYOUT_FROM
        wb.use_layout(cls.week)
        cls.tmp = tempfile.TemporaryDirectory()
        d = Path(cls.tmp.name)
        (d / 'storyboard.md').write_text(STORY, encoding='utf-8')
        (d / 'expect.md').write_text(EXPECT, encoding='utf-8')
        styles = {'beat': 4, 'window': [12, 21], 'options': [
            {'module': 'orbit-on-split', 'name': 'Orbit on split', 'how': 'The chart orbits him on the split.', 'file': 'styles/orbit.mp4', 'sha256': CLIP_A},
            {'module': 'paper-cut', 'name': 'Paper cut', 'how': 'Cut-paper layers slide in on each number.', 'file': 'styles/paper.mp4', 'sha256': CLIP_B}],
            'skipped': [{'module': 'neon-grid', 'why': 'needs a device not built yet'}]}
        (d / 'styles.json').write_text(json.dumps(styles), encoding='utf-8')
        (d / 'proof').mkdir()
        (d / 'proof' / 'long.json').write_text(json.dumps({'beat': 4, 'start': 12, 'end': 21.5, 'sha256': PROOF, 'spec_sha256': 'f' * 64,
                                                          'style_module': 'orbit-on-split'}), encoding='utf-8')
        (d / 'creative-direction.json').write_text(json.dumps({'brand': {'references': [
            {'id': '9b1f', 'card': 'Verge split explainer', 'for': ['motion', 'look']}]}}), encoding='utf-8')
        cls.mapping = [{'id': 'style-orbit', 'path': str(d / 'styles' / 'orbit.mp4'), 'source_url': 'https://ve.local/clip/orbit'},
                       {'id': 'style-paper', 'path': str(d / 'styles' / 'paper.mp4'), 'source_url': 'https://ve.local/clip/paper'},
                       {'id': 'proof-long', 'path': str(d / 'proof' / 'long.mp4'), 'source_url': 'https://ve.local/clip/proof'}]
        (d / 'assets.json').write_text(json.dumps(cls.mapping), encoding='utf-8')
        cls.dir = d
        cls.prod = {'wed': {'storyboard': wb.read_storyboard(d / 'storyboard.md'),
                            'styles': wb.read_styles(d / 'styles.json', cls.mapping),
                            'proof': wb.read_proof(d / 'proof' / 'long.json', cls.mapping)}}
        cls.videos = {'wed': [{'cut': 'long', 'name': 'l.mp4', 'path': 'x/l.mp4', 'at': '2026-11-08T10:00:00Z', 'sha256': LONG},
                              {'cut': 'short', 'name': 's.mp4', 'path': 'x/s.mp4', 'at': '2026-11-08T10:00:00Z', 'sha256': SHORT}]}
        cls.page, cls.manifest, cls.warnings = wb.board(cls.week, pieces={'wed': WED}, review=REVIEW, draft={'wed'},
                                                        pending={'wed': 'Why so many AIs'}, videos=cls.videos,
                                                        production=json.loads(json.dumps(cls.prod)))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def card(self):
        return wb.div_at(self.page, self.page.index('<div class="rec gt" id="wed-gates"'))

    def test_a_day_without_gates_is_drawn_exactly_as_before(self):
        plain, man, _ = wb.board(self.week, pieces={'wed': WED}, review=REVIEW, draft={'wed'}, pending={'wed': 'Why so many AIs'})
        again, _, _ = wb.board(self.week, pieces={'wed': WED}, review=REVIEW, draft={'wed'}, pending={'wed': 'Why so many AIs'}, production={})
        self.assertEqual(stamp_free(plain), stamp_free(again))
        shown = re.sub(r'<script\b.*?</script>', '', plain, flags=re.S)
        for hook in ('data-live-gate', 'class="rec gt"', 'data-act="gate"'):
            self.assertNotIn(hook, shown)
        self.assertIsNone(wb.previous_conf(plain, 'production'))
        self.assertNotIn('<day>-storyboard', json.dumps(man))

    def test_the_four_gates_sit_in_order_on_the_record_step(self):
        sub = wb.div_at(self.page, self.page.index('<div class="subpanel" role="tabpanel" id="wed-sub-record"'))
        self.assertIn('id="wed-gates"', sub)
        card = self.card()
        at = [card.index(f'id="wed-gate-{g}"') for g in wb.GATE_ORDER]
        self.assertEqual(at, sorted(at))
        self.assertEqual(wb.verify(self.page), [])
        self.assertEqual(self.warnings, [w for w in self.warnings if 'gate' not in w])

    def test_storyboard_shows_the_text_and_expectations_and_binds_their_hash(self):
        sb = self.prod['wed']['storyboard']
        want = hashlib.sha256(json.dumps({'expect': EXPECT, 'storyboard': STORY.replace('\r\n', '\n')}, sort_keys=True,
                                         separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
        self.assertEqual(sb['sha256'], want)
        sec = self.card()[self.card().index('id="wed-gate-storyboard"'):self.card().index('id="wed-gate-style"')]
        self.assertIn(f'data-gate-sha="{want}"', sec)
        self.assertIn(f'data-live-gate-sha="{want}"', sec)
        self.assertIn('The split: the chart beside him.', sec)
        self.assertIn('<li>Captions sit below the face.</li>', sec)
        self.assertIn('data-act="gate" data-gate="storyboard" data-day="wed"', sec)
        self.assertIn('data-live-gate-note', sec)

    def test_style_shows_each_clip_side_by_side_with_its_name_how_and_pick(self):
        card = self.card()
        sec = card[card.index('id="wed-gate-style"'):card.index('id="wed-gate-proof"')]
        raw = (self.dir / 'styles.json').read_bytes()
        self.assertIn(f'data-gate-sha="{hashlib.sha256(raw).hexdigest()}"', sec)
        for module, name, src, sha in (('orbit-on-split', 'Orbit on split', 'https://ve.local/clip/orbit', CLIP_A),
                                       ('paper-cut', 'Paper cut', 'https://ve.local/clip/paper', CLIP_B)):
            self.assertIn(f'data-style-module="{module}" data-style-name="{name}" data-style-sha="{sha}"', sec)
            self.assertIn(f'src="{src}"', sec)
            self.assertIn(f'data-act="gate" data-gate="style" data-day="wed" data-module="{module}"', sec)
        self.assertIn('data-module=""', sec)
        self.assertIn('data-gate-words="wed-style"', sec)
        self.assertIn('Left out: neon-grid: needs a device not built yet.', sec)
        self.assertNotIn(str(self.dir), self.page)

    def test_proof_shows_the_clip_beside_the_reference_cards(self):
        card = self.card()
        sec = card[card.index('id="wed-gate-proof"'):card.index('id="wed-gate-cut"')]
        self.assertIn(f'data-gate-sha="{PROOF}"', sec)
        self.assertIn('src="https://ve.local/clip/proof"', sec)
        self.assertIn('Verge split explainer (motion, look)', sec)
        self.assertIn('Beat 4, 12 to 21.5 s, in Orbit on split', sec)
        self.assertIn('data-verdict="approve" data-cut="long"', sec)
        self.assertIn('data-verdict="reject" data-cut="long"', sec)
        self.assertIn('data-gate-words="wed-proof"', sec)

    def test_cut_binds_both_cut_files(self):
        card = self.card()
        sec = card[card.index('id="wed-gate-cut"'):]
        both = hashlib.sha256(json.dumps({'long': LONG, 'short': SHORT}, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        self.assertEqual(wb.cut_gate_sha({'long': LONG, 'short': SHORT}), both)
        self.assertEqual(wb.cut_gate_sha({'long': LONG}), LONG)
        self.assertIn(f'data-gate-sha="{both}"', sec)
        self.assertIn(f'data-cut-long="{LONG}" data-cut-short="{SHORT}"', sec)
        # No cut with its file's hash on the record: the section says so and has no press.
        none = wb.cut_gate('wed-', 'wed', [{'cut': 'long', 'path': 'x', 'name': 'l.mp4'}])
        self.assertNotIn('data-act="gate"', none)
        self.assertIn('The cuts are not made yet.', none)

    def test_the_manifest_and_conf_carry_the_gates(self):
        decisions = self.manifest['db']['picks']['decisions']
        self.assertEqual(decisions['<day>-style']['kind'], 'pick_style')
        self.assertEqual(decisions['views']['proof'], 'approve_proof')
        self.assertEqual(self.manifest['production']['wed']['proof'], PROOF)
        carried = wb.previous_conf(self.page, 'production')
        self.assertEqual(carried['wed']['piece_id'], WED)
        self.assertEqual(carried['wed']['styles']['options'][0]['src'], 'https://ve.local/clip/orbit')

    def test_refuses_what_cannot_be_shown(self):
        d = self.dir
        with self.assertRaisesRegex(wb.BoardError, 'has no board asset'):
            wb.read_styles(d / 'styles.json', [])
        with self.assertRaisesRegex(wb.BoardError, 'has no board asset'):
            wb.read_proof(d / 'proof' / 'long.json', [])
        long_expect = d / 'long-expect.md'
        long_expect.write_text('\n'.join(f'line {n}' for n in range(7)), encoding='utf-8')
        with self.assertRaisesRegex(wb.BoardError, 'holds 7 lines'):
            wb.read_storyboard(d / 'storyboard.md', long_expect)
        with self.assertRaisesRegex(wb.BoardError, 'no expectations sheet'):
            wb.read_storyboard(d / 'storyboard.md', d / 'missing.md')
        bad = d / 'bad-styles.json'
        bad.write_text(json.dumps({'options': [{'module': 'Orbit', 'name': 'x', 'how': 'y', 'file': 'a', 'sha256': CLIP_A}]}), encoding='utf-8')
        with self.assertRaisesRegex(wb.BoardError, 'motion style id'):
            wb.read_styles(bad, self.mapping)
        with self.assertRaisesRegex(wb.BoardError, 'has no piece'):
            wb.board(self.week, production=json.loads(json.dumps(self.prod)))

    def test_the_command_line_reads_the_inputs_and_a_rebuild_keeps_them(self):
        d = self.dir
        args = ['--week', self.week.isoformat(), '--piece', f'wed={WED}', '--pending', 'wed=Why so many AIs', '--target', 'artifact',
                '--storyboard', f'wed={d / "storyboard.md"}', '--styles', f'wed={d / "styles.json"}',
                '--proof', f'wed={d / "proof" / "long.json"}', '--assets', str(d / 'assets.json')]
        page, _ = wb.build(wb.parser().parse_args(args))
        self.assertIn('id="wed-gate-proof"', page)
        prev = d / 'prev.html'
        prev.write_text(page, encoding='utf-8')
        again, _ = wb.build(wb.parser().parse_args(['--week', self.week.isoformat(), '--piece', f'wed={WED}', '--pending', 'wed=Why so many AIs',
                                                    '--target', 'artifact', '--previous', str(prev)]))
        self.assertIn('id="wed-gate-style"', again)
        # Another piece on the day: the gates were for the old one, and are dropped.
        other, _ = wb.build(wb.parser().parse_args(['--week', self.week.isoformat(), '--piece', f'wed={wb.FRI_ID}', '--pending', 'wed=Another',
                                                    '--target', 'artifact', '--previous', str(prev)]))
        self.assertNotIn('id="wed-gates"', other)


if __name__ == '__main__':
    unittest.main()
