"""The realistic-board proof for the hard floors (Ruling, Krish, 2026-11-26; learning floors-honest-and-hard): a board
built honestly, with sector-correct heroes chased to where each fact was first reported, passes the Sunday gate's story
lines whole; one option changed to break each floor fails for that floor's reason and no other; and the real 23 Nov
board, scored on fakes, is refused only by hard floors, an off-sector hero by the focus-sector floor. Every option on the
fixture board is invented; every transport is a fake, so nothing is spent and nothing leaves this machine."""
import json
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
sys.path.insert(0, str(ROOT / 'tests'))
import idea_checks as ic  # noqa: E402
import story_score as ss  # noqa: E402
import story_score_test as t  # noqa: E402

WEEK = ic.STORY_FROM
FIT = "a hero's topic is in a focus sector"
PRIMARY = 'a hero has at least one primary source'
SHORT = 'a short is on the beat'
MEME = 'a meme is on the beat'
SHARE = "at least half a good-news carousel's stories are in a focus sector"


def hero(oid, hook, fact, url, first=None):
    o = t.hero(oid, hook, fact, url=url)
    o['source'] = {'label': 'The report', 'url': url}
    if first:
        o['first_reported'] = first
    return o


def short(oid, hook, url):
    return {'id': oid, 'hook': hook, 'copy': hook + '.', 'funny': hook + ', and nobody noticed.', 'aim': 'humour',
            'source': {'label': 'The report', 'url': url}}


def story(n, headline, kind='people'):
    return {'headline': headline, 'kind': kind, 'source': {'url': f'https://example.org/good/{n}'},
            'helps': {'who': 'independent musicians', 'how': 'more successful'}}


def honest_board():
    """Three sector-correct heroes a day, each sourced where the fact was first reported (a trade outlet, or the actor's
    own newsroom), two shorts on the beat and a good-news carousel mostly in the sectors."""
    mbw = 'https://www.musicbusinessworldwide.com/'
    return {'week_start': WEEK, 'days': {
        'mon': [hero('mon-a', 'Warner Music licenses its catalogue to Suno for $40 million',
                     'Warner Music said Suno paid it $40 million for its catalogue.', mbw + 'warner-suno', first=mbw + 'warner-suno'),
                hero('mon-b', 'Spotify raises UK prices by £1 to pay songwriters', 'Spotify said it raised UK prices by £1 a month.',
                     'https://newsroom.spotify.com/uk-prices'),
                hero('mon-c', 'DAZN pays $50 million for AI rights to Premier League clips',
                     'DAZN paid $50 million for the AI rights to Premier League clips.', 'https://www.sportbusiness.com/dazn-ai',
                     first='https://www.sportbusiness.com/dazn-ai')],
        'wed': [hero('wed-a', 'Adobe puts agents inside Photoshop for 30 million designers', 'Adobe said agents now run inside Photoshop.',
                     'https://news.adobe.com/agents'),
                hero('wed-b', 'Ubisoft builds game characters that answer 4 million players', 'Ubisoft said 4 million players talked to them.',
                     'https://news.ubisoft.com/neo-npc'),
                hero('wed-c', 'Netflix used generative VFX on 2 shows to cut a week of work', 'Netflix said 2 shows used generative VFX.',
                     'https://about.netflix.com/vfx')],
        'fri': [hero('fri-a', 'Universal Music says AI songs are 18 percent of uploads, but streams say otherwise',
                     'Universal Music said AI songs were 18 percent of uploads.', 'https://www.universalmusic.com/uploads'),
                hero('fri-b', 'Penguin Random House bars AI training on 3,000 books, yet the books were already scraped',
                     'Penguin Random House barred AI training on 3,000 books.', 'https://www.penguinrandomhouse.com/ai'),
                hero('fri-c', 'Premier League clubs say AI scouting found 12 players, but the clubs signed none',
                     'Premier League clubs said AI scouting found 12 players.', 'https://www.premierleague.com/news/ai-scouting')]},
        'offdays': {
            'tue': [short('djloop', "Spotify's AI DJ played the same song 40 times", 'https://www.theverge.com/spotify-dj'),
                    short('grammyrule', 'The Grammys now ask if a song had 2 AI vocals', 'https://www.billboard.com/grammy-ai')],
            'sat': [{'id': 'gn', 'kind': 'good_news', 'format': 'Good news carousel', 'hook': '5 ways AI helped musicians this week',
                     'stories': [story(1, 'A deaf musician hears her song through AI captions on Spotify'),
                                 story(2, 'A film student cut a short on a free AI editor and sold it to a festival'),
                                 story(3, 'A theatre in Leeds lets blind audiences hear AI audio description'),
                                 story(4, 'A Sunday league football club uses AI to plan its fixtures'),
                                 story(5, 'A village school uses AI to teach maths', kind='learning')]}]}}


def dry_score(ideas):
    """The DryRun path on a copy: fake angles, humour, judges and probes, then score and order. (scored ideas, probes)"""
    plans = Path(tempfile.mkdtemp())
    try:
        folder = plans / f'{WEEK}-week'
        (folder / 'story').mkdir(parents=True)
        (folder / 'ideas.json').write_text(json.dumps(ideas), encoding='utf-8')
        (folder / 'sources.json').write_text(json.dumps({'week_start': WEEK}), encoding='utf-8')
        ids = [str(o.get('id')).lower() for _k, _d, _m, o in ss.board(ideas)]
        probes = {i: t.probe(3, 2) for i in ids}
        (folder / 'story' / 'probes.json').write_text(json.dumps(probes), encoding='utf-8')

        def run(*argv, **kw):
            return ss.main([argv[0], WEEK, '--plans', str(plans), *argv[1:]], kill=t.CLEAN, today='2026-11-29', **kw)
        with redirect_stdout(StringIO()):
            ledger = str(plans / 'spend.jsonl')
            run('angles', '--provoke', '--judge', '--ledger', ledger, poster=t.Poster(), cap=t.UNDER)
            run('humour', '--ledger', ledger, read=lambda req: t.analysis())
            rows = []
            for key, _d, _m, _o in ss.board(ideas):
                rows += [f'## {key}'] + [f'{a}: 6/10 because the facts name it' for a in ('scale', 'fun_consume', 'fun_produce', 'uplift', 'utility')]
            (folder / 'reply.md').write_text('\n'.join(rows), encoding='utf-8')
            run('record', str(folder / 'reply.md'))
            run('score')
            run('order', '--fresh', '--write')
        return json.loads((folder / 'ideas.json').read_text(encoding='utf-8')), probes
    finally:
        shutil.rmtree(plans, ignore_errors=True)


def floor_lines(ideas):
    scored, probes = dry_score(ideas)
    found = ic.story_findings(scored, WEEK, None, probes)
    return scored, found


def failed(scored, oid):
    return next(o['story_score']['floors_failed'] for _k, _d, _m, o in ss.board(scored) if o['id'] == oid)


class HonestBoard(unittest.TestCase):
    def test_an_honest_board_passes_the_story_gate_whole(self):
        scored, found = floor_lines(honest_board())
        self.assertEqual([f['line'] for f in found], [], 'a board built honestly meets every hard floor')
        for _k, _d, _m, o in ss.board(scored):
            if o.get('weekly'):
                continue
            s = o['story_score']
            self.assertEqual(s['floors_failed'], [], o['id'])
            if s['type'] in ss.HERO:
                self.assertGreaterEqual(s['axes']['fit'], 7, o['id'])

    def break_one(self, day, n, change):
        board = honest_board()
        group = 'days' if day in ('mon', 'wed', 'fri') else 'offdays'
        target = board[group][day][n]
        change(target)
        scored, found = floor_lines(board)
        return target['id'], scored, found

    def test_each_floor_fails_for_its_own_reason(self):
        cases = [
            ('off-sector hero', 'mon', 1, lambda o: o.update(hero('mon-b', 'Microsoft cuts Copilot prices by $5 a seat',
                                                                    'Microsoft said it cut Copilot prices by $5 a seat.',
                                                                    'https://news.microsoft.com/copilot')), [FIT]),
            ('stuffed hero', 'mon', 1, lambda o: o.update(hero('mon-b', 'Microsoft cuts Copilot prices by $5 a seat, which matters for musicians',
                                                                 'Microsoft said it cut Copilot prices by $5 a seat.',
                                                                 'https://news.microsoft.com/copilot')), [FIT]),
            ('aggregator only', 'wed', 1, lambda o: o.update(source={'label': 'Yahoo', 'url': 'https://finance.yahoo.com/ubisoft'},
                                                              first_reported='https://finance.yahoo.com/ubisoft'), [PRIMARY]),
            ('short off the beat', 'tue', 0, lambda o: o.update(short('djloop', 'A bank chatbot approved the same loan 40 times',
                                                                       'https://www.theverge.com/bank-bot')), [SHORT]),
            ('good news off the sectors', 'sat', 0, lambda o: o.update(stories=[story(n, f'A village school uses AI to teach maths {n}', 'learning')
                                                                                 for n in range(1, 6)]), [SHARE]),
        ]
        for name, day, n, change, want in cases:
            with self.subTest(name):
                oid, scored, found = self.break_one(day, n, change)
                self.assertEqual(failed(scored, oid), want, name)
                lines = [f['line'] for f in found if f['code'] == 'story_floor']
                self.assertEqual(len(lines), 1, f'{name}: {lines}')
                self.assertIn(want[0], lines[0])

    def test_a_wildcard_hero_near_the_beat_passes(self):
        def wild(o):
            o.update(hero('wed-b', 'A Lego robot wrote 4 million lines of code for a toy studio', 'A Lego robot wrote 4 million lines of code.',
                          'https://www.lego.com/robot'), wildcard=True)
        oid, scored, found = self.break_one('wed', 1, wild)
        self.assertEqual(failed(scored, oid), [], 'fit 4 is enough for the wildcard slot')

    def test_a_meme_off_the_beat_is_refused(self):
        view = {'id': 'tpl', 'hook': 'A bank chatbot approved the same loan 40 times'}
        axes = {'fit': ss.fit_axis(view, False)[0]}
        checks = {'comic_reading': 'supported', 'needs_explaining': False, 'template_ok': True}
        self.assertEqual(ss.floors_failed('offday_meme', axes, checks), [MEME])
        view = {'id': 'tpl', 'hook': "Spotify's AI DJ played the same song 40 times"}
        self.assertEqual(ss.floors_failed('offday_meme', {'fit': ss.fit_axis(view, False)[0]}, checks), [])


class Real23Nov(unittest.TestCase):
    """The real 23 Nov board, scored on fakes: only hard floors refuse, each by its reason, and a hero refused for the
    focus sector is one whose topic carries no sector in the sentence that carries its fact."""

    def test_only_hard_floors_refuse_and_off_sector_heroes_are_the_fit_refusals(self):
        real = json.loads((ROOT / 'docs' / 'plans' / '2026-11-23-week' / 'ideas.json').read_text(encoding='utf-8'))
        scored, _probes = dry_score(dict(real, week_start=WEEK))
        hard = {f['reason'] for tid in t.RUBRIC['types'] for f in ss.floors_for(tid) if f.get('hard', True)}
        n_fit = 0
        for _k, _d, main, o in ss.board(scored):
            s = o.get('story_score') or {}
            for r in s.get('floors_failed') or []:
                self.assertIn(r.replace(' (not read)', ''), hard)
            if FIT in (s.get('floors_failed') or []):
                n_fit += 1
                self.assertLess(s['axes']['fit'], 7, o['id'])
        self.assertGreater(n_fit, 0, 'the 23 Nov heroes were mostly off the sectors: the floor refuses them')


if __name__ == '__main__':
    unittest.main()
