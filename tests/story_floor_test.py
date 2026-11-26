"""scripts/post-pack/story_floor.py, the story engine's floor (the story engine v5 plan, commit 3): the only reader of
Krish's recorded rejections, and it answers pass or refused with reasons, never a number. The 16 Nov options he
rejected are refused once his rejections are known; a veto stands until he lifts it or raises the subject again; a
soft refusal only warns until P6; a format he marked not for us is refused; the repeat guard makes no paid call; and a
check that cannot run is unread, never a pass. Apart from the replay of the real 16 Nov board, every sentence here is
invented: none is his."""
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import board_feed  # noqa: E402
import divergent  # noqa: E402
import idea_checks as ic  # noqa: E402
import story_floor as sf  # noqa: E402

CLEAN = lambda _text: []  # noqa: E731  the kill list, clean (the real one runs in idea_checks_test)
IDEA = '11111111-2222-4333-8444-555555555555'
OTHER = '22222222-3333-4444-8555-666666666666'
NEW = '44444444-5555-4666-8777-888888888888'
ASK = '33333333-4444-4555-8666-777777777777'


def outcome(kind, said, *, idea=IDEA, doc='queue/mon-1', week='2026-11-16', at='2026-11-17T09:00:00+00:00', idea_text=None):
    day = doc.split('/')[-1].split('-')[1] if 'off-' in doc else doc.split('/')[-1].split('-')[0]
    return kind, {'week': week, 'day': day, 'idea_id': idea, 'option': None, 'doc': doc, 'said': said, 'at': at, 'idea': idea_text}


def sources(*answers, asks=(), unvetoed=(), recent=()):
    block = {'filed': [], 'rejected': [], 'trend': [], 'improved': []}
    for kind, o in answers:
        block[kind].append(o)
    return {'week_start': '2026-11-23', 'outcomes': block, 'asks': list(asks), 'cues': {}, 'must_cover': [], 'unvetoed': list(unvetoed),
            'recent_posts': list(recent), 'earlier_options': []}


def option(idea_id, story, **extra):
    return {'id': idea_id, 'so_what': story, 'story': story, 'pitch': {'question': story, 'headline': story}, **extra}


def board(*mon, off=()):
    return {'week_start': '2026-11-23', 'days': {'mon': list(mon), 'wed': [], 'fri': []}, 'offdays': {'tue': list(off)}}


def run(ideas, src, **kw):
    kw.setdefault('kill', CLEAN)
    kw.setdefault('repeat_guard', False)
    kw.setdefault('week', '2026-11-23')
    return sf.floor(sf.board_candidates(ideas), src, **kw)


def by_ref(result):
    return {r['ref']: r for r in result['candidates']}


def numbers(node):
    if isinstance(node, bool):
        return []
    if isinstance(node, (int, float)):
        return [node]
    if isinstance(node, dict):
        return [n for v in node.values() for n in numbers(v)]
    if isinstance(node, list):
        return [n for v in node for n in numbers(v)]
    return []


class TheRealSixteenthOfNovember(unittest.TestCase):
    """The 16 Nov board, read with what was known by the 23 Nov gather: each option he rejected is refused with a
    reason; his three picks are not refused on his rejections."""

    def setUp(self):
        self.ideas = json.loads((ROOT / 'docs' / 'plans' / '2026-11-16-week' / 'ideas.json').read_text(encoding='utf-8'))
        self.sources = json.loads((ROOT / 'docs' / 'plans' / '2026-11-23-week' / 'sources.json').read_text(encoding='utf-8'))
        self.scorecard = json.loads((ROOT / 'docs' / 'plans' / '2026-11-16-week' / 'scorecard.json').read_text(encoding='utf-8'))
        shown_text, _ = board_feed.plans_reader()
        self.result = run(self.ideas, self.sources, shown_text=shown_text, week='2026-11-23')

    def test_his_rejected_options_are_refused_with_reasons(self):
        rejected = [l['doc'].split('/', 1)[1] for l in self.scorecard['labels'] if l['outcome'] == 'rejected']
        self.assertEqual(sorted(rejected), ['mon-1', 'off-tue-burntokens', 'off-tue-infosys', 'wed-3'])
        got = by_ref(self.result)
        for ref in rejected:
            self.assertTrue(got[ref]['floored'], ref)
            self.assertTrue(any(r.startswith('refused: ') and 'which he refused on' in r for r in got[ref]['reasons']), ref)

    def test_his_picks_are_not_refused_on_his_rejections(self):
        got = by_ref(self.result)
        for ref in self.scorecard['picks'].values():
            self.assertFalse(any(r.startswith('refused: ') for r in got[ref]['reasons']), ref)

    def test_it_never_scores_and_never_reorders(self):
        self.assertEqual([r['ref'] for r in self.result['candidates']], [ref for ref, *_ in sf.board_candidates(self.ideas)])
        self.assertEqual(numbers(self.result), [], 'pass or refused, never a number')
        self.assertEqual(set(self.result['candidates'][0]), {'ref', 'floored', 'reasons'})


class Refusals(unittest.TestCase):
    def test_a_veto_stands_until_he_lifts_it(self):
        src = sources(outcome('rejected', 'Zentrix is boring.', idea=IDEA, idea_text='Zentrix ships a music model'))
        later = board(option(NEW, 'Zentrix licenses a second music catalogue for its model'))
        self.assertTrue(by_ref(run(later, src))['mon-1']['floored'])
        self.assertEqual(ic.active_vetoes(ic.refusals_from(src))[0]['subject'], 'Zentrix')
        lifted = dict(src, unvetoed=[{'subject': 'Zentrix', 'at': '2026-11-20T09:00:00+00:00'}])
        self.assertFalse(by_ref(run(later, lifted))['mon-1']['floored'], 'his press gives the subject back')
        raised = dict(src, asks=[{'id': ASK, 'his_words': {'what': 'What is Zentrix paying the labels?'}, 'words_at': '2026-11-21T09:00:00+00:00'}])
        self.assertFalse(by_ref(run(later, raised))['mon-1']['floored'], 'he raised the subject again')

    def test_the_idea_he_rejected_is_refused_even_without_a_name(self):
        src = sources(outcome('rejected', 'I do not get the point of this.', idea=IDEA))
        got = by_ref(run(board(option(IDEA, 'a story with no names in it at all'), option(OTHER, 'another plain story')), src))
        self.assertTrue(got['mon-1']['floored'])
        self.assertIn('the same idea he refused', got['mon-1']['reasons'][0])
        self.assertFalse(got['mon-2']['floored'])

    def test_an_off_day_option_he_rejected_is_refused(self):
        src = sources(outcome('rejected', 'This is lame.', idea=None, doc='queue/off-tue-gizmo'))
        later = board(off=[{'id': 'gizmo', 'title': 'The gizmo again', 'hook': 'The gizmo again'}])
        self.assertTrue(by_ref(run(later, src))['off-tue-gizmo']['floored'])

    def test_a_soft_refusal_warns_and_never_floors_until_p6(self):
        src = sources(outcome('trend', 'Zentrix is boring, save it anyway.', idea=IDEA, idea_text='Zentrix ships a music model'))
        later = board(option(NEW, 'Zentrix licenses a second music catalogue for its model'))
        self.assertFalse(by_ref(run(later, src, p6=False))['mon-1']['floored'])
        self.assertTrue(by_ref(run(later, src, p6=True))['mon-1']['floored'])

    def test_an_option_that_answers_his_ask_is_not_refused(self):
        src = sources(outcome('rejected', 'Zentrix is boring.', idea=IDEA, idea_text='Zentrix ships a music model'), asks=[{'id': ASK}])
        later = board(option(NEW, 'Zentrix licenses a second music catalogue for its model', covers=[ASK]))
        self.assertFalse(by_ref(run(later, src))['mon-1']['floored'])

    def test_a_pool_story_on_a_vetoed_subject_is_refused(self):
        src = sources(outcome('rejected', 'Zentrix is boring.', idea=IDEA, idea_text='Zentrix ships a music model'))
        src['unassigned'] = [{'id': NEW, 'idea': 'Zentrix doubles its film budget', 'thesis': 'and pays the extras less'},
                             {'id': OTHER, 'idea': 'A studio pays session singers for AI voice rights', 'thesis': 'a new fee line'}]
        got = by_ref(sf.floor(sf.pool_candidates(src), src, kill=CLEAN, repeat_guard=False, week='2026-11-23'))
        self.assertTrue(got[f'pool/{NEW}']['floored'])
        self.assertFalse(got[f'pool/{OTHER}']['floored'])


class OtherFloors(unittest.TestCase):
    def test_off_beat_is_refused(self):
        got = by_ref(run(board(option(NEW, 'A new data privacy rule for chatbots')), sources()))
        self.assertTrue(any(r.startswith('off_beat: ') for r in got['mon-1']['reasons']))

    def test_the_kill_list_and_rejected_lines_read_only_our_own_words(self):
        veto = lambda text: ['em dash'] if '—' in text else []  # noqa: E731
        ideas = board(option(NEW, 'A label pays — twice'), option(OTHER, 'The company paid the band for the rights'))
        got = by_ref(run(ideas, sources(), kill=veto))
        self.assertTrue(any(r.startswith('kill list: ') for r in got['mon-1']['reasons']))
        self.assertTrue(any(r.startswith('rejected line ') for r in got['mon-2']['reasons']))
        src = sources()
        src['unassigned'] = [{'id': NEW, 'idea': 'The company paid the band — twice', 'thesis': 'a source headline'}]
        pool = by_ref(sf.floor(sf.pool_candidates(src), src, kill=veto, repeat_guard=False))
        self.assertFalse(pool[f'pool/{NEW}']['floored'], "a source's own headline is not our words")

    def test_a_listed_standard_refuses_on_the_topic(self):
        got = by_ref(run(board(option(NEW, 'Is this the end of music as a new AI tool ships'), option(OTHER, 'A label pays for AI voice rights')), sources()))
        self.assertTrue(any(r.startswith('standard s81a2b228d6: ') for r in got['mon-1']['reasons']))
        self.assertFalse(got['mon-2']['floored'])

    def test_a_missing_or_unapproved_standard_is_unread_never_a_pass(self):
        cfg = sf.config()
        cfg['standards']['rows'] = [dict(cfg['standards']['rows'][0], standard='s000missing')]
        result = run(board(option(NEW, 'Is this the end of music')), sources(), cfg=cfg)
        self.assertTrue(any('s000missing' in u for u in result['unread']))
        doc = {'standards': {'sdraft': {'theme': 'story_angle', 'standing': 'draft', 'never_beneath': 'x'}}}
        cfg['standards']['rows'] = [dict(cfg['standards']['rows'][0], standard='sdraft')]
        self.assertTrue(any('sdraft is draft' in u for u in run(board(), sources(), cfg=cfg, floor_doc=doc)['unread']))

    def test_every_listed_standard_is_in_the_floor_and_approved(self):
        import floor
        doc = floor.load()
        spec = sf.config()['standards']
        for row in spec['rows']:
            s = doc['standards'][row['standard']]
            self.assertIn(s['theme'], spec['themes'], row['standard'])
            self.assertIn(s['standing'], spec['standings'], row['standard'])

    def test_a_not_for_us_format_or_module_is_refused(self):
        styles = {'formats': {'script': [{'id': 'liked-one', 'modules': ['ok-mod']}, {'id': 'gone-one', 'krish_verdict': 'not for us'},
                                         {'id': 'later-one', 'krish_verdict': 'not for us', 'not_for_us_from_week': '2026-12-07'}],
                              'production': [{'id': 'treated', 'modules': ['bad-mod']}]},
                  'bank': [{'id': 'ok-mod', 'krish_verdict': 'untested'}, {'id': 'bad-mod', 'krish_verdict': 'not for us'}]}
        ideas = board(option(NEW, 'A label pays', style={'script': 'gone-one', 'production': 'x'}),
                      option(OTHER, 'A label pays', style={'script': 'liked-one', 'production': 'treated'}),
                      option(IDEA, 'A label pays', style={'script': 'liked-one', 'production': 'x', 'experiment': {'format': 'later-one'}}))
        got = by_ref(run(ideas, sources(), styles=styles))
        self.assertTrue(any('"gone-one" is marked not for us' in r for r in got['mon-1']['reasons']))
        self.assertTrue(any('module "bad-mod"' in r for r in got['mon-2']['reasons']))
        self.assertFalse(got['mon-3']['floored'], 'a verdict binds from its week on')
        self.assertTrue(by_ref(run(ideas, sources(), styles=styles, week='2026-12-07'))['mon-3']['floored'])


class RepeatGuard(unittest.TestCase):
    def poster(self, statuses, status=200):
        calls = []

        def post(body):
            calls.append(body)
            return status, {'ok': status == 200, 'results': [{'status': s} for s in statuses]}
        return post, calls

    def test_it_makes_no_paid_call_and_refuses_a_repeat(self):
        post, calls = self.poster(['novel', 'rejected_gravity', 'rejected_archive'])
        ideas = board(option(NEW, 'A label pays'), option(OTHER, 'A studio pays'), option(IDEA, 'The wildcard', divergent={'run_id': 'r', 'spark': 1}))
        src = sources(recent=[{'title': 'A label paid last week', 'point': 'it did'}])
        with mock.patch.object(divergent, 'chain_week', side_effect=AssertionError('a free call never reads the chain')):
            got = by_ref(run(ideas, src, repeat_guard=True, poster=post))
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0]['obvious'])
        self.assertNotIn('judge', calls[0])
        self.assertFalse(divergent.spends(calls[0]))
        self.assertFalse(got['mon-1']['floored'])
        self.assertTrue(any(r.startswith('repeat guard: rejected_gravity') for r in got['mon-2']['reasons']))
        self.assertFalse(got['mon-3']['floored'], "an engine wildcard's own spark is in the archive by design")

    def test_not_served_is_unread_never_a_pass(self):
        post, _ = self.poster([], status=503)
        src = sources(recent=[{'title': 'A label paid last week', 'point': 'it did'}])
        result = run(board(option(NEW, 'A label pays')), src, repeat_guard=True, poster=post)
        self.assertTrue(result['unread'] and result['unread'][0].startswith('repeat guard: '))
        post, calls = self.poster([])
        result = run(board(option(NEW, 'A label pays')), sources(), repeat_guard=True, poster=post)
        self.assertEqual(calls, [], 'nothing to hold against: no call')
        self.assertTrue(result['unread'])

    def test_the_command_exits_two_when_a_check_is_unread(self):
        with mock.patch.object(sys, 'stdout'):
            self.assertEqual(sf.main(['2026-11-23', '--ideas', str(ROOT / 'docs' / 'plans' / '2026-11-16-week' / 'ideas.json'),
                                      '--sources', str(ROOT / 'docs' / 'plans' / '2026-11-23-week' / 'sources.json'), '--no-repeat-guard', '--json']), 2)


class Wall(unittest.TestCase):
    def test_the_scorer_never_imports_the_floor(self):
        scorer = ROOT / 'scripts' / 'post-pack' / 'story_score.py'
        if scorer.exists():
            self.assertNotRegex(scorer.read_text(encoding='utf-8'), r'\bstory_floor\b')

    def test_passed_is_all_the_scorer_may_know(self):
        result = {'candidates': [{'ref': 'mon-1', 'floored': True, 'reasons': ['x']}, {'ref': 'mon-2', 'floored': False, 'reasons': []}], 'unread': []}
        self.assertEqual(sf.passed(result), ['mon-2'])


if __name__ == '__main__':
    unittest.main()
