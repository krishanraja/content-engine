"""scripts/post-pack/idea_checks.py and its use in board_feed.py cover and gate (the ideas quality plan, Wave 1): a
subject Krish refused fails the run, refusing words in another press warn and never lead a day, a return comes back
deeper, an option is his only when it points to his own words, and from the 23 Nov board every option opens on one
plain question. Every sentence here is invented: none is his."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import board_feed  # noqa: E402
import idea_checks as ic  # noqa: E402

IDEA = '11111111-2222-4333-8444-555555555555'
OTHER = '22222222-3333-4444-8555-666666666666'
ASK = '33333333-4444-4555-8666-777777777777'


def outcome(kind, said, *, idea=IDEA, doc='queue/fri-3', week='2026-11-16', at='2026-11-17T09:00:00+00:00', idea_text=None):
    return {'week': week, 'day': doc.split('/')[-1].split('-')[0] if 'off-' not in doc else doc.split('-')[1], 'idea_id': idea,
            'option': None, 'doc': doc, 'said': said, 'at': at, 'idea': idea_text}


def sources(*answers, asks=(), cues=None, unvetoed=()):
    block = {'filed': [], 'rejected': [], 'trend': [], 'improved': []}
    for kind, o in answers:
        block[kind].append(o)
    return {'week_start': '2026-11-23', 'outcomes': block, 'asks': list(asks), 'cues': cues or {}, 'must_cover': [], 'unvetoed': list(unvetoed),
            'house_rules': [{'id': 'BIG_PICTURE', 'text': 'x'}, {'id': 'STORY_ARC', 'text': 'y'}], 'recent_posts': [], 'earlier_options': []}


FEED_POST = 'https://www.instagram.com/p/feedpost1/'
# What every option carries from the 23 Nov board (Krish, 2026-11-16): its shape, aim, humorous angle and lookalike.
AIMED = {'shape': 'story', 'dive': 'How the saving moves from the supplier to the buyer, step by step.', 'aim': 'interest',
         'funny': 'The robot did the work and the client kept the tip.',
         'lookalike': {'pattern': 'p1', 'beats': FEED_POST, 'our_take': 'We show who keeps the saving, which the post never did.'}}


def reviewed(ideas, verdicts=None):
    """The plan with a fresh reader's same-story verdict on every option (ideas.json repeat_review, from REVIEW_FROM)."""
    out = json.loads(json.dumps(ideas))
    out['repeat_review'] = {'reader': 'a fresh reader', 'checked': [{'ref': ref, 'verdict': (verdicts or {}).get(ref, 'new'), 'of': None, 'why': ''}
                                                                    for ref, *_ in ic.board_raw(out)]}
    return out


def main_option(**kw):
    o = dict({'id': OTHER, 'source_kind': 'engine', 'so_what': 'A thing happened.', 'story': 'Headline: x.', 'covers': []}, **AIMED)
    o.update(kw)
    if 'source' not in kw:  # its own page, so two options on one board are never one story by accident
        o['source'] = {'label': 'A paper, 20 Nov 2026', 'url': f'https://example.com/{ic.short_hash(o["id"] + o["so_what"])}'}
    return o


def write_look(folder):
    """The week's lookalike files, as lookalike.py prepare and the session write them."""
    (folder / 'lookalike-input.json').write_text(json.dumps({'posts': [{'url': FEED_POST, 'headline': 'A post'}], 'warnings': []}))
    (folder / 'lookalike.json').write_text(json.dumps({'patterns': [{'id': 'p1'}]}))


def findings(ideas, src, p6=False):
    opts = ic.board_options(ideas)
    refused = ic.refusals_from(src)
    return ic.refused_findings(opts, refused, ic.his_ids(src), ic.his_words(src), src.get('unvetoed') or [], p6)


class TextTest(unittest.TestCase):
    def test_a_mixed_sentence_splits_into_its_refusing_and_wishing_halves(self):
        words = '"Who pays the bill?" is a great trend to queue. Acme is boring as hell but "where does the margin go?" is a really interesting topic.'
        self.assertEqual(ic.refusing(words), ['Acme is boring as hell'])
        self.assertEqual(ic.questions(words), ['Who pays the bill?', 'where does the margin go?'])
        self.assertEqual(ic.subjects_of(' '.join(ic.refusing(words)), 'Acme cut its forecast as clients took the AI saving.'), ['Acme'])
        self.assertEqual(set(ic.parts_of(words)), {'refuse', 'wish'})

    def test_names_keep_whole_names_and_drop_openers_days_and_general_words(self):
        self.assertEqual(ic.names('Told you already. Acme Corp is boring on Monday, and AI is everywhere.'), ['Acme Corp'])
        self.assertEqual(ic.names("Widget.AI went bust. Big Shop's AIs mark homework."), ['Widget.AI', 'Big Shop'])
        self.assertEqual(ic.sentences('Widget.AI went bust. Here is who got what.'), ['Widget.AI went bust.', 'Here is who got what.'])

    def test_a_question_is_a_sentence_or_a_quoted_phrase_ending_in_a_question_mark(self):
        self.assertEqual(ic.questions('The real question is how will they close the gap? What next?'),
                         ['The real question is how will they close the gap?', 'What next?'])
        self.assertEqual(ic.questions('Give me a research prompt.'), [])


class RefusedTest(unittest.TestCase):
    def test_his_reject_fails_the_run_on_any_option_on_that_subject(self):
        src = sources(('rejected', outcome('rejected', 'Told you already. Acme is boring.', idea_text='Acme cut its forecast.')))
        ideas = {'days': {'mon': [main_option(so_what='Acme says clients want the AI saving.')]}}
        got = findings(ideas, src)
        self.assertEqual([f['code'] for f in got], ['refused'])
        self.assertEqual(got[0]['subject'], 'Acme')

    def test_a_reject_with_no_named_subject_keys_on_that_idea_only(self):
        src = sources(('rejected', outcome('rejected', 'I do not see the point of this.', idea_text='Acme and Qux built a gadget.')))
        self.assertEqual([f['code'] for f in findings({'days': {'mon': [main_option(id=IDEA)]}}, src)], ['refused'])
        self.assertEqual(findings({'days': {'mon': [main_option(so_what='Qux shipped a model.')]}}, src), [],
                         'a name the refused option carried is not the subject he refused')

    def test_refusing_words_in_another_press_warn_and_never_lead_the_day(self):
        src = sources(('trend', outcome('trend', 'Acme is boring as hell but who keeps the margin is interesting.', idea_text='Acme cut its forecast.')))
        first = findings({'days': {'mon': [main_option(so_what='Acme says buyers keep the saving.')]}}, src)
        self.assertEqual([f['code'] for f in first], ['warned', 'warned_first'])
        second = findings({'days': {'mon': [main_option(id=ASK.replace('3', '9')), main_option(so_what='Acme says buyers keep the saving.')]}}, src)
        self.assertEqual([f['code'] for f in second], ['warned'])
        self.assertEqual([f['code'] for f in findings({'days': {'mon': [main_option(so_what='Acme says buyers keep it.')]}}, src, p6=True)], ['refused'],
                         'once he approves P6 the soft refusal blocks')

    def test_answering_his_ask_raising_it_again_or_his_undo_lets_it_through(self):
        reject = ('rejected', outcome('rejected', 'Acme is boring.', idea_text='Acme cut its forecast.'))
        ask = {'id': ASK, 'his_words': {'why_here': 'Do a piece on how software edits itself'}, 'words_at': '2026-11-18T10:00:00+00:00'}
        on = {'days': {'mon': [main_option(so_what='Acme models now edit other models.', covers=[ASK])]}}
        self.assertEqual(findings(on, sources(reject, asks=[ask])), [], 'an option that answers his own ask passes')
        again = dict(ask, his_words={'why_here': 'Now Acme is worth a look: their new deal'})
        plain = {'days': {'mon': [main_option(so_what='Acme models now edit other models.')]}}
        self.assertEqual(findings(plain, sources(reject, asks=[again])), [], 'a subject he raised again after refusing it passes')
        older = dict(again, words_at='2026-11-01T10:00:00+00:00')
        self.assertTrue(findings(plain, sources(reject, asks=[older])), 'naming it before the refusal is not raising it again')
        undo = [{'subject': 'Acme', 'at': '2026-11-18T10:00:00Z'}]
        self.assertEqual(findings(plain, sources(reject, unvetoed=undo)), [], 'his Offer it again press gives the subject back')

    def test_a_next_week_press_after_the_refusal_sends_it_to_the_depth_check_instead(self):
        trend = ('trend', outcome('trend', 'Acme is boring as hell.', at='2026-11-17T09:00:00+00:00', idea_text='Acme cut its forecast.'))
        filed = ('filed', outcome('filed', None, idea=None, doc='queue/off-sat-acme', at='2026-11-17T09:05:00+00:00'))
        ideas = {'days': {}, 'offdays': {'tue': [{'id': 'acme', 'hook': 'Acme clients took the savings.', 'copy': 'Four cards.'}]}}
        self.assertEqual(findings(ideas, sources(trend, filed)), [])
        found = ic.returns_findings(ic.board_options(ideas), ic.answers_of(sources(trend, filed)), lambda a: None)
        self.assertEqual([f['code'] for f in found], ['return'])


class ReturnsTest(unittest.TestCase):
    def setUp(self):
        self.said = 'Keep this for later. How will they pay for it?'
        self.src = sources(('filed', outcome('filed', self.said, at='2026-11-17T09:00:00+00:00')))
        self.was = ic.short_hash(ic.norm('A thing happened. Headline: x.'))

    def answers(self):
        return ic.answers_of(self.src)

    def test_a_return_that_came_back_unchanged_with_old_sources_is_held(self):
        opts = ic.board_options({'days': {'mon': [main_option(id=IDEA, source={'label': 'Paper, 2 Nov 2026', 'url': 'https://e.com'})]}})
        got = ic.returns_findings(opts, self.answers(), lambda a: self.was)
        self.assertEqual(got[0]['why'], ['unchanged', 'no_newer_source', 'no_returns', 'unanswered', 'no_research_prompt'])

    def test_a_return_with_all_four_and_a_research_prompt_passes(self):
        o = main_option(id=IDEA, so_what='Who pays now: the buyer.', research_prompt='Find every source since 17 Nov 2026 on who pays. ' * 4,
                        returns={'said': self.said, 'answers': [{'q': 'How will they pay for it?', 'a': 'Out of the buyer\'s contract.'}],
                                 'sources': [{'url': 'https://e.com/n', 'date': '2026-11-19'}]})
        self.assertEqual(ic.returns_findings(ic.board_options({'days': {'mon': [o]}}), self.answers(), lambda a: self.was), [])

    def test_his_words_must_be_exact_and_every_question_answered(self):
        o = main_option(id=IDEA, so_what='Changed.', research_prompt='p' * 160,
                        returns={'said': 'Keep this for later.', 'answers': [], 'sources': [{'date': '2026-11-20'}]})
        got = ic.returns_findings(ic.board_options({'days': {'mon': [o]}}), self.answers(), lambda a: self.was)
        self.assertEqual(got[0]['why'], ['said_not_exact', 'unanswered'])


class HalvesTest(unittest.TestCase):
    def test_a_press_that_refuses_the_subject_never_counts_as_his(self):
        src = sources(('trend', outcome('trend', 'Acme is boring as hell but who keeps the margin is interesting.', idea_text='Acme cut its forecast.')))
        ideas = {'week_start': '2026-11-23', 'days': {'mon': [main_option(id=IDEA, source_kind='his', from_press='2026-11-16/queue/fri-3',
                                                                          so_what='Acme says buyers keep it.'), main_option()]}}
        codes = [f['code'] for f in ic.halves_findings(ic.board_options(ideas), src, ideas, ic.refusals_from(src))]
        self.assertEqual(codes, ['press_refuses', 'his_empty'])

    def test_a_stated_empty_half_passes_and_an_option_pointing_to_his_ask_is_his(self):
        src = sources(asks=[{'id': ASK, 'his_words': {'why_here': 'x'}, 'words_at': '2026-11-10T00:00:00Z'}])
        stated = {'days': {'mon': [main_option()]}, 'his_empty': {'mon': 'Nothing he typed this fortnight fits a Monday money story.'}}
        self.assertEqual(ic.halves_findings(ic.board_options(stated), src, stated, ic.refusals_from(src)), [])
        his = {'days': {'mon': [main_option(source_kind='his', covers=[ASK]), main_option()]}}
        self.assertEqual(ic.halves_findings(ic.board_options(his), src, his, ic.refusals_from(src)), [])
        claim = {'days': {'mon': [main_option(source_kind='his'), main_option()]}}
        self.assertEqual([f['code'] for f in ic.halves_findings(ic.board_options(claim), src, claim, ic.refusals_from(src))], ['not_his', 'his_empty'])


class ShapeTest(unittest.TestCase):
    def test_the_question_is_one_plain_sentence_naming_no_company(self):
        self.assertEqual(ic.question_problems('Who keeps the money when AI does the work?'), [])
        self.assertTrue(ic.question_problems('Why is Acme borrowing $20 billion?'))
        self.assertTrue(ic.question_problems('Who keeps the money.'))
        self.assertTrue(ic.question_problems(''))

    def test_from_the_23_nov_board_every_option_leads_with_its_question_prompt_and_tag(self):
        bare = {'days': {'mon': [main_option()]}, 'offdays': {'tue': [{'id': 'x', 'hook': 'h'}]}}
        self.assertEqual(ic.shape_findings(bare, '2026-11-16'), [])
        self.assertEqual([f['code'] for f in ic.shape_findings(bare, '2026-11-23')], ['pitch', 'research_prompt', 'source_tag', 'source_tag'])
        whole = {'days': {'mon': [main_option(pitch={'question': 'Who pays when AI does the work?'}, research_prompt='r' * 150, source_tag='engine_research')]},
                 'offdays': {'tue': [{'id': 'x', 'source_tag': 'his_card'}]}}
        self.assertEqual(ic.shape_findings(whole, '2026-11-23'), [])


class VetoTest(unittest.TestCase):
    def test_the_board_lists_exactly_the_vetoes_that_stand_with_his_words(self):
        src = sources(('rejected', outcome('rejected', 'Acme is boring.', idea_text='Acme cut its forecast.')))
        vetoes = ic.active_vetoes(ic.refusals_from(src))
        self.assertEqual([v['subject'] for v in vetoes], ['Acme'])
        self.assertEqual([f['code'] for f in ic.vetoes_findings({}, vetoes)], ['veto_line'])
        ok = {'vetoes': [{'subject': 'Acme', 'said': 'Acme is boring.', 'at': '2026-11-17'}]}
        self.assertEqual(ic.vetoes_findings(ok, vetoes), [])
        self.assertEqual([f['code'] for f in ic.vetoes_findings({'vetoes': ok['vetoes'] + [{'subject': 'Qux'}]}, vetoes)], ['veto_invented'])
        self.assertEqual(ic.active_vetoes(ic.refusals_from(src), unvetoed=[{'subject': 'acme', 'at': '2026-11-20T00:00:00Z'}]), [])

    def test_a_warned_option_carries_his_refusing_words_exactly(self):
        src = sources(('trend', outcome('trend', 'Acme is boring as hell but the margin is interesting.', idea_text='Acme cut it.')))
        ideas = {'days': {'mon': [main_option(), main_option(so_what='Acme again.')]}}
        opts, refused = ic.board_options(ideas), ic.refusals_from(src)
        warned = [f for f in ic.refused_findings(opts, refused, set()) if f['code'] == 'warned']
        said = {r['ref']: r['said'] for r in refused['refusals']}.get
        self.assertEqual([f['code'] for f in ic.warning_findings(opts, warned, said)], ['warning_line'])
        ideas['days']['mon'][1]['warning'] = {'subject': 'Acme', 'said': 'Acme is boring as hell', 'at': '2026-11-17'}
        self.assertEqual(ic.warning_findings(ic.board_options(ideas), warned, said), [])


class GateTest(unittest.TestCase):
    def test_gate_reads_the_week_and_names_what_fails_the_run(self):
        src = sources(('rejected', outcome('rejected', 'Acme is boring.', idea_text='Acme cut its forecast.')))
        ideas = {'week_start': '2026-11-23', 'days': {'mon': [main_option(so_what='Acme says buyers keep it.')]}}
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / '2026-11-23-week'
            folder.mkdir()
            (folder / 'sources.json').write_text(json.dumps(src))
            (folder / 'ideas.json').write_text(json.dumps(reviewed(ideas)))
            write_look(folder)
            problems, warned = board_feed.gate('2026-11-23', plans=tmp)
            self.assertEqual(len(problems), 1)
            self.assertTrue(problems[0].startswith('refused: mon-1 is on Acme'))
            ideas['days']['mon'][0]['so_what'] = 'Who keeps the AI saving.'
            (folder / 'ideas.json').write_text(json.dumps(reviewed(ideas)))
            self.assertEqual(board_feed.gate('2026-11-23', plans=tmp)[0], [])

    def test_the_self_test_still_passes(self):
        self.assertEqual(board_feed.self_test(), [])


TICK = '44444444-5555-4666-8777-888888888888'
PIECE = '55555555-6666-4777-8888-999999999999'
CARD = '66666666-7777-4888-8999-aaaaaaaaaaaa'


def ticked(**kw):
    """An option as inspiration_act.py place writes it from his ticked card."""
    return main_option(id=PIECE, source_kind='his', covers=[CARD], from_inspiration={'action_id': TICK, 'card_id': CARD, 'card_name': 'a-reel.mp4'}, **kw)


class TickTest(unittest.TestCase):
    """Ruling (Krish, 2026-11-12): his own tick outranks an older refusal; the idea comes to him with the refusal shown, and
    only his Approve places it. Ideas the engine proposes on its own keep the gate exactly as it is."""

    def setUp(self):
        self.src = sources(('rejected', outcome('rejected', 'Told you already. Acme is boring.', idea_text='Acme cut its forecast.')))

    def week(self, tmp, ideas):
        folder = Path(tmp) / '2026-11-23-week'
        folder.mkdir(exist_ok=True)
        (folder / 'sources.json').write_text(json.dumps(self.src))
        (folder / 'ideas.json').write_text(json.dumps(reviewed(ideas)))
        write_look(folder)
        return folder

    def test_an_idea_from_his_tick_on_a_refused_subject_is_noted_never_refused(self):
        got = findings({'days': {'mon': [main_option(), ticked(so_what='Acme staff who ask questions keep their jobs.')]}}, self.src)
        self.assertEqual([f['code'] for f in got], ['his_tick'])
        self.assertEqual(got[0]['note'], {'subject': 'Acme', 'said': 'Acme is boring.', 'at': '2026-11-17',
                                          'via': 'reject', 'ref': '2026-11-16/queue/fri-3'})
        self.assertIn('the name "Acme" is in his refusing words and the option names "Acme"', got[0]['line'])
        self.assertIn('only his Approve places it', got[0]['line'])
        self.assertNotIn('his_tick', ic.GATE_CODES)

    def test_an_engine_idea_on_the_same_subject_is_still_refused(self):
        got = findings({'days': {'mon': [main_option(so_what='Acme staff who ask questions keep their jobs.')]}}, self.src)
        self.assertEqual([f['code'] for f in got], ['refused'])
        self.assertTrue(got[0]['line'].startswith('refused: mon-1 is on Acme, which he refused on 2026-11-17 (reject, 2026-11-16/queue/fri-3): '
                                                  'the name "Acme" is in his refusing words'), got[0]['line'])
        same = findings({'days': {'mon': [main_option(id=IDEA)]}}, sources(('rejected', outcome('rejected', 'No point.', idea_text='x'))))
        self.assertIn('it is the same idea he refused', same[0]['line'])

    def test_the_gate_passes_his_tick_and_prints_the_match_and_why(self):
        ideas = {'week_start': '2026-11-23', 'days': {'mon': [ticked(so_what='Acme staff who ask questions keep their jobs.')]}}
        with tempfile.TemporaryDirectory() as tmp:
            self.week(tmp, ideas)
            report = board_feed.gate_report('2026-11-23', plans=tmp)
            self.assertEqual(report['problems'], [])
            self.assertEqual(len(report['ticks']), 1)
            self.assertTrue(report['ticks'][0].startswith('his tick: mon-1 is on Acme, which he refused on 2026-11-17 (reject, 2026-11-16/queue/fri-3)'))
            self.assertIn('not yet in its refused_before', report['ticks'][0])
            notes = board_feed.tick_notes('2026-11-23', ideas, PIECE, plans=tmp)
            self.assertEqual([n['subject'] for n in notes], ['Acme'])
            ideas['days']['mon'][0]['refused_before'] = notes
            (Path(tmp) / '2026-11-23-week' / 'ideas.json').write_text(json.dumps(reviewed(ideas)))
            self.assertIn('refusal shown beside it (refused_before)', board_feed.gate_report('2026-11-23', plans=tmp)['ticks'][0])
            self.assertEqual(board_feed.tick_notes('2026-11-23', {'days': {'mon': [ticked(so_what='Who keeps the saving?')]}}, PIECE, plans=tmp), [])

    def test_with_base_the_gate_answers_only_for_what_the_run_added(self):
        before = {'week_start': '2026-11-23', 'days': {'mon': [main_option(so_what='Acme says buyers keep it.')]}}
        with tempfile.TemporaryDirectory() as tmp:
            folder = self.week(tmp, before)
            base = Path(tmp) / 'ideas-before.json'
            base.write_text(json.dumps(before))
            after = json.loads(json.dumps(before))
            after['days']['mon'].append(ticked(so_what='Acme staff who ask questions keep their jobs.'))
            (folder / 'ideas.json').write_text(json.dumps(reviewed(after)))
            self.assertEqual(len(board_feed.gate_report('2026-11-23', plans=tmp)['problems']), 1, 'the Sunday gate still sees the week\'s own refusal')
            report = board_feed.gate_report('2026-11-23', plans=tmp, base_path=base)
            self.assertEqual(report['problems'], [])
            self.assertTrue(report['before'][0].startswith('refused: mon-1 is on Acme'))
            self.assertTrue(report['ticks'][0].startswith('his tick: mon-2 is on Acme'))
            # An engine idea the run adds or changes is held as it always was.
            after['days']['mon'].append(main_option(id=IDEA.replace('1', '7'), so_what='Acme again, from the engine.', aim='humour'))
            (folder / 'ideas.json').write_text(json.dumps(reviewed(after)))
            held = board_feed.gate_report('2026-11-23', plans=tmp, base_path=base)['problems']
            self.assertEqual(len(held), 1)
            self.assertTrue(held[0].startswith('refused: mon-3 is on Acme'))

    def test_place_refuses_a_piece_id_the_engine_has_no_record_of(self):
        # 13 Nov: the habits idea was placed as 701a2c55, which the engine never held; every session on it got
        # piece_not_found and its card showed none of their work (Krish, 17 Nov: "the board absolutely does not show that").
        import inspiration_act as act
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / 'docs' / 'plans' / '2026-11-23-week'
            folder.mkdir(parents=True)
            (folder / 'ideas.json').write_text(json.dumps({'week_start': '2026-11-23', 'days': {}, 'offdays': {}}))
            idea = {'action_id': TICK, 'week': '2026-11-23', 'day': 'tue', 'piece_id': PIECE,
                    'option': {'so_what': 'x', 'why_now': 'y', 'source': {'label': 'l', 'url': 'https://x.invalid'}}}
            path = root / 'idea.json'
            path.write_text(json.dumps(idea))

            def ask(method, path_, body=None):
                if path_.startswith('/api/content-ideas'):
                    raise RuntimeError(f'{method} {path_} answered 404: not_found')
                return {'action': {'kind': 'make_piece'}, 'card': {'id': CARD, 'name': 'a-reel.mp4'}}
            saved = (act.ROOT, act.ask)
            act.ROOT, act.ask = root, ask
            try:
                self.assertEqual(act.cmd_place(type('A', (), {'idea_file': str(path)})), 2)
            finally:
                act.ROOT, act.ask = saved
            self.assertEqual(json.loads((folder / 'ideas.json').read_text())['offdays'], {}, 'nothing is placed')

    def test_place_writes_the_refusal_onto_his_idea_and_offer_says_it_first(self):
        import inspiration_act as act
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            plans = root / 'docs' / 'plans'
            plans.mkdir(parents=True)
            folder = plans / '2026-11-23-week'
            folder.mkdir()
            (folder / 'sources.json').write_text(json.dumps(self.src))
            (folder / 'ideas.json').write_text(json.dumps(reviewed({'week_start': '2026-11-23', 'days': {'mon': [main_option()]}})))
            write_look(folder)
            idea = {'action_id': TICK, 'week': '2026-11-23', 'day': 'mon', 'piece_id': PIECE, 'pitch': 'Acme staff who ask questions keep their jobs.',
                    'why_now': 'A report, 20 Nov 2026.', 'option': {'so_what': 'Acme staff who ask questions keep their jobs.', 'story': 'Headline: x.',
                                                                   'why_now': 'A report, 20 Nov 2026.', 'source': {'label': 'l', 'url': 'https://x.invalid'},
                                                                   **{k: v for k, v in AIMED.items() if k != 'lookalike'}}}
            path = root / 'idea.json'
            path.write_text(json.dumps(idea))
            series = {'series': [{'slug': 'follow_the_money', 'cadence': 'Mondays', 'options': [], 'scheduled': []}]}
            answers = {'/api/inspiration/actions': {'action': {'kind': 'make_piece'}, 'card': {'id': CARD, 'name': 'a-reel.mp4'}}, '/api/week/options': series,
                       '/api/content-ideas': {'ok': True, 'idea': {'id': PIECE}}}
            sent = []

            def ask(method, path_, body=None):
                sent.append((method, path_, body))
                return next(v for k, v in answers.items() if path_.startswith(k))
            saved = (act.ROOT, act.ask, board_feed.ROOT)
            act.ROOT, act.ask, board_feed.ROOT = root, ask, root
            try:
                self.assertEqual(act.cmd_place(type('A', (), {'idea_file': str(path)})), 0)
                placed = json.loads((folder / 'ideas.json').read_text())['days']['mon'][1]
                self.assertEqual(placed['id'], PIECE)
                self.assertEqual(placed['refused_before'], [{'subject': 'Acme', 'said': 'Acme is boring.', 'at': '2026-11-17',
                                                             'via': 'reject', 'ref': '2026-11-16/queue/fri-3'}])
                self.assertEqual(board_feed.gate_report('2026-11-23', plans=str(plans))['ticks'][0].count('(refused_before)'), 1)
                self.assertEqual(act.cmd_offer(type('A', (), {'idea_file': str(path)})), 0)
            finally:
                act.ROOT, act.ask, board_feed.ROOT = saved
            body = next(b for m, p_, b in sent if m == 'POST')
            pitch = body['options'][-1]['pitch']
            self.assertTrue(pitch.startswith('Turned down before: on 17 Nov you said "Acme is boring." '
                                             'It is here because you ticked this card, and your Approve decides. Acme staff'), pitch)
            self.assertLessEqual(len(pitch), 700)
            self.assertEqual(body['options'][-1]['inspiration_action'], TICK)
            self.assertNotIn('decided', json.dumps(body))

    def test_a_long_pitch_keeps_his_words_whole_or_names_the_subject(self):
        import inspiration_act as act
        note = {'subject': 'Acme', 'said': 'Acme is boring.', 'at': '2026-11-17', 'via': 'reject', 'ref': 'r'}
        self.assertLessEqual(len(act.tick_pitch('word ' * 139, [note])), 700)
        self.assertIn('you said "Acme is boring."', act.tick_pitch('word ' * 100, [note]))
        long = dict(note, said='Acme ' * 80)
        self.assertIn('you turned down Acme.', act.tick_pitch('Short pitch.', [long]))
        self.assertEqual(act.tick_pitch(' Plain. ', []), 'Plain.')



class ScorecardTest(unittest.TestCase):
    """board_feed.py scorecard: his real presses counted, each count by its rule, no words written."""

    def test_counts_his_presses_by_their_rules(self):
        import ideas_scorecard as sc
        ideas = {'days': {'mon': [main_option(id=IDEA, so_what='Acme cut its forecast.'), main_option(so_what='Who keeps the AI saving?')]},
                 'offdays': {'tue': [{'id': 'meme', 'hook': 'h'}, {'id': 'dull', 'hook': 'h'}]}}
        presses = [
            {'doc': 'picks/mon', 'outcome': 'approved', 'via': 'pick', 'idea_id': OTHER, 'words': 'Give me a research prompt for this.', 'at': '2026-11-17T09:00:00Z'},
            {'doc': 'queue/mon-1', 'outcome': 'rejected', 'via': 'press', 'idea_id': IDEA, 'words': 'Told you already, it is boring.', 'at': '2026-11-17T09:02:00Z'},
            {'doc': 'queue/off-tue-dull', 'outcome': 'rejected', 'via': 'offday', 'words': 'The idea is lame.', 'at': '2026-11-17T09:05:00Z'},
            {'doc': 'queue/off-tue-meme', 'outcome': 'approved', 'via': 'offday', 'words': None, 'at': '2026-11-17T09:06:00Z'},
            {'doc': 'queue/off-tue-meme', 'outcome': 'approved', 'via': 'offday', 'words': None, 'at': '2026-11-17T11:00:00Z'},
        ]
        card = sc.score('2026-11-23', ideas, presses)
        c = card['counts']
        self.assertEqual((c['options_main'], c['options_off'], c['picks'], c['rank1_picked'], c['picks_as_written']), (2, 2, 1, 0, 0))
        self.assertEqual((c['wasted_presses'], c['wasted_without_pick_depth'], c['main_rejects'], c['offday_rejects_refusing']), (3, 2, 1, 1))
        self.assertEqual(c['big_question'], {'options': 1, 'picks': 1})
        self.assertEqual(c['minutes'], 6.0, 'a gap over an hour starts a new sitting')
        self.assertEqual(c['pressed_share'], 1.0)
        self.assertEqual(set(card['rules']), set(c), 'every count has its written rule')
        for words in ('Told you already', 'research prompt for this', 'The idea is lame'):
            self.assertNotIn(words, json.dumps(card), 'the scorecard file keeps labels, never his words')

    def test_reads_a_board_from_before_the_ideas_gate(self):
        data = {'outcomes': [], 'history': [], 'triage': [{'id': IDEA, 'from_pick': 'mon-1', 'triage': {'verdict': 'drop', 'decided_by': 'Krish', 'at': '2026-10-26T09:00:00Z'}}],
                'scheduled': [{'id': OTHER, 'week_option': {'series': 'follow_the_money'}, 'picked_at': '2026-10-26T09:05:00Z'}],
                'cues': [{'subject_ref': ASK, 'use': 'not_for_us', 'said': 'Ditch it.', 'said_at': '2026-10-26T09:01:00Z', 'use_origin': 'krish'}]}
        presses = board_feed.presses_from(data, {ASK: 'wed-4'})
        self.assertEqual([(p['doc'], p['outcome']) for p in presses], [('queue/mon-1', 'rejected'), ('queue/wed-4', 'rejected'), ('picks/mon', 'approved')])


class SecondPartTest(unittest.TestCase):
    """Items 4, 6, 8, 10 and 12, from the 23 Nov board: his words split, his asks at full scope, off days that say what
    they learned, more looked at than shown, and the good news's mix."""

    def src(self):
        press = outcome('trend', 'Acme is boring as hell but who keeps the margin is a really interesting topic. Give me a research prompt.',
                        week='2026-11-16', doc='queue/mon-1', at='2026-11-17T09:00:00Z')
        ask = {'id': ASK, 'state': 'open', 'style_only': False, 'his_words': {'why_here': 'Do a piece on how software edits itself on the fly'},
               'words_at': '2026-11-16T10:00:00Z'}
        verdict = {'week': '2026-11-09', 'option': 'off-tue-memes', 'side': 'idea', 'verdict': 'improve', 'words': 'Make the caption much shorter please', 'at': '2026-11-17T09:10:00Z'}
        s = sources(('trend', press), asks=[ask])
        s['offday_verdicts'] = {'verdicts': [verdict]}
        s['series'] = [{'slug': 'follow_the_money', 'pool': [{'id': '44444444-5555-4666-8777-888888888888', 'source_kind': 'engine'}]}]
        return s

    def test_each_worded_press_is_split_into_exact_quotes_with_its_refusal(self):
        src = self.src()
        none = {'week_start': '2026-11-23'}
        self.assertEqual([f['code'] for f in ic.split_findings(none, src)], ['split'])
        made_up = {'week_start': '2026-11-23', 'split': [{'ref': '2026-11-16/queue/mon-1', 'parts': [{'kind': 'wish', 'quote': 'who keeps the margin'},
                                                                                                    {'kind': 'refuse', 'quote': 'Acme is dull'}]}]}
        self.assertEqual([f['code'] for f in ic.split_findings(made_up, src)], ['split', 'split'])
        honest = {'week_start': '2026-11-23', 'split': [{'ref': '2026-11-16/queue/mon-1', 'parts': [
            {'kind': 'refuse', 'quote': 'Acme is boring as hell'}, {'kind': 'wish', 'quote': 'who keeps the margin is a really interesting topic'},
            {'kind': 'depth', 'quote': 'Give me a research prompt.'}]}]}
        self.assertEqual(ic.split_findings(honest, src), [])
        self.assertEqual(ic.split_findings(dict(none, week_start='2026-11-16'), src), [], 'earlier boards keep their shape')

    def test_his_ask_is_quoted_whole_and_a_held_ask_shows_a_real_reason(self):
        src = self.src()
        narrowed = {'week_start': '2026-11-23', 'days': {'wed': [main_option(covers=[ASK], asks=[{'id': ASK, 'said': 'software edits itself', 'scope': 'as_typed'}])]}}
        self.assertEqual([f['code'] for f in ic.asks_findings(narrowed, src)], ['ask_scope'])
        said = 'Do a piece on how software edits itself on the fly'
        no_why = {'week_start': '2026-11-23', 'days': {'wed': [main_option(covers=[ASK], asks=[{'id': ASK, 'said': said, 'scope': 'narrowed'}])]}}
        self.assertEqual([f['code'] for f in ic.asks_findings(no_why, src)], ['ask_scope'])
        whole = {'week_start': '2026-11-23', 'days': {'wed': [main_option(covers=[ASK], asks=[{'id': ASK, 'said': said, 'scope': 'as_typed'}])]}}
        self.assertEqual(ic.asks_findings(whole, src), [])
        held = {'week_start': '2026-11-23', 'accounted': {ASK: 'Held until a dated move; its row is 0c09087a.'}}
        self.assertEqual([f['code'] for f in ic.asks_findings(held, src)], ['ask_held', 'ask_held'], 'a row that does not exist, and no held line')
        shown = {'week_start': '2026-11-23', 'accounted': {ASK: 'Held: the evidence is thin this week; its row is 44444444.'},
                 'held': [{'ref': f'ask/{ASK}', 'day': 'wed', 'title': said, 'reason': 'The evidence is thin this week.'}]}
        self.assertEqual(ic.asks_findings(shown, src), [])

    def test_an_off_day_quotes_the_verdict_it_learned_from(self):
        src = self.src()
        bare = {'week_start': '2026-11-23', 'offdays': {'tue': [{'id': 'memes', 'hook': 'h'}]}}
        self.assertEqual([f['code'] for f in ic.learned_findings(bare, src)], ['learned_from'])
        paraphrase = {'week_start': '2026-11-23', 'offdays': {'tue': [{'id': 'memes', 'learned_from': ['"keep captions short" (17 Nov)']}]}}
        self.assertEqual([f['code'] for f in ic.learned_findings(paraphrase, src)], ['learned_from'])
        quote = {'week_start': '2026-11-23', 'offdays': {'tue': [{'id': 'memes', 'learned_from': ['"Make the caption much shorter" (17 Nov)']}]}}
        self.assertEqual(ic.learned_findings(quote, src), [])

    def test_more_is_looked_at_than_shown_and_the_good_news_says_its_kind(self):
        days = {'mon': [main_option()] * 4, 'wed': [main_option()] * 4, 'fri': [main_option()] * 4}
        self.assertEqual([f['ref'] for f in ic.considered_findings({'week_start': '2026-11-23', 'days': days, 'considered': {'mon': 8, 'wed': 3, 'fri': 9}})],
                         ['wed', 'fri'])
        self.assertEqual(ic.considered_findings({'week_start': '2026-11-23', 'days': days, 'considered': {'mon': 8, 'wed': 4, 'fri': 8}}), [])
        st = lambda kind=None: dict({'headline': 'h'}, **({'kind': kind} if kind else {}))
        gn = lambda stories: {'week_start': '2026-11-23', 'offdays': {'sat': [{'id': 'goodnews', 'weekly': 'good_news', 'stories': stories}]}}
        self.assertEqual([f['code'] for f in ic.goodnews_mix_findings(gn([st('health'), st(), st('work')]))], ['goodnews_kind'])
        self.assertEqual(ic.goodnews_mix_findings(gn([st('health'), st('lab'), st('work'), st('health'), st('money')])), [])
        self.assertEqual(ic.mix_of([st('health'), st('lab'), st('work'), st('health'), st('money')]), '2 health, 1 lab, 1 money, 1 work')


RECENT = json.loads((ROOT / 'tests' / 'fixtures' / 'recent-posts-2026-11-16.json').read_text(encoding='utf-8'))['recent_posts']
P = '77777777-8888-4999-8aaa-bbbbbbbbbbbb'


def post(key, url, title='A post that went out last week', **kw):
    return dict({'week': '2026-11-16', 'day': 'tue', 'date': '2026-11-17', 'key': key, 'type': 'post', 'kind': 'meme', 'kind_label': 'Meme',
                 'title': title, 'stage': 'live', 'piece_id': None, 'item': None, 'primary': url, 'urls': [url], 'labels': ['A paper, 2 Nov 2026']}, **kw)


def off(oid, url, **kw):
    return dict({'id': oid, 'format': 'Meme, 2 panels', 'hook': f'A hook of its own for {oid}', 'source': {'label': 'A paper, 2 Nov 2026', 'url': url}}, **kw)


class RepeatTest(unittest.TestCase):
    """Krish, 2026-11-16: "this week's Ideas Board needs to not contain mostly things we published last week"."""

    def test_the_16_nov_board_repeats_what_went_out_and_itself(self):
        # The week of 16 Nov as it stood when this went wrong (frozen 16 Nov): the live plan moves on as its ideas are
        # made again, and a later run took frenemies and ownref off it.
        plan = json.loads((ROOT / 'tests' / 'fixtures' / 'plans' / '2026-11-16-ideas.json').read_text(encoding='utf-8'))
        src = json.loads((ROOT / 'tests' / 'fixtures' / 'plans' / '2026-11-16-sources.json').read_text(encoding='utf-8'))
        found = ic.repeat_findings(plan, dict(src, recent_posts=RECENT), board_feed.earlier_of(src, '2026-11-16'))
        by = {}
        for f in found:
            by.setdefault(f['ref'], set()).add(f['rule'])
        # Friday's Axiom proof was Saturday 14's live carousel; burntokens was Friday 13's live piece (one page each).
        self.assertIn('a', by['fri-1'])
        self.assertIn('a', by['off-tue-burntokens'])
        # frenemies and ownref cite the Home Depot interview, Microsoft's Critique and the NeurIPS study, as beststicker did.
        self.assertEqual(by['off-tue-frenemies'], {'e'})
        self.assertEqual(by['off-thu-ownref'], {'e'})
        # Five stories on the board twice, once as a piece option and once as an off-day carousel tied to that day
        # (ties_to "Mon: ...", "Wed: ...", "Fri: ..."): a carousel that supports a day's piece carries its story by design
        # (Ruling, Krish, 2026-11-13: "we have carousels that support Monday, Wednesday, or Friday"), so rule d leaves them.
        for pair in (('mon-3', 'off-tue-fuelgauge'), ('wed-1', 'off-thu-tinyfix'), ('wed-4', 'off-thu-swarmdeal'),
                     ('fri-4', 'off-thu-fortytoone'), ('mon-1', 'off-tue-infosys')):
            for ref in pair:
                self.assertNotIn('d', by.get(ref, set()), ref)
        self.assertNotIn('wed-2', by, 'an option on its own story is no repeat')
        # A repeat on his own idea or tick is shown with it (NOTE_CODES), every other one fails the run.
        self.assertTrue(all(f['code'] in ic.GATE_CODES + ic.NOTE_CODES for f in found))
        line = next(f['line'] for f in found if f['ref'] == 'off-tue-burntokens')
        self.assertIn('Fri 13 Nov\'s piece "Meta staff were ranked by AI use. They gamed it." (live)', line)

    def test_twins_that_say_no_tie_are_refused_and_his_own_idea_keeps_its_story(self):
        page = {'label': 'The Register, 6 Nov 2026', 'url': 'https://www.theregister.com/a/'}
        tied = {'week_start': '2026-11-23', 'days': {'wed': [{'id': 'aaaaaaaa-0000-0000-0000-000000000001', 'source': page}]},
                'offdays': {'tue': [{'id': 'tied', 'source': page, 'ties_to': 'Wed: under.the.hood, if you pick it'}]}}
        self.assertEqual(ic.repeat_findings(tied, {}, []), [])
        plan = {'week_start': '2026-11-23', 'days': {'wed': [{'id': 'aaaaaaaa-0000-0000-0000-000000000001', 'source': page}]},
                'offdays': {'thu': [{'id': 'untied', 'source': page}]}}
        found = {(f['ref'], f['code']) for f in ic.repeat_findings(plan, {}, [])}
        self.assertIn(('off-thu-untied', 'repeat'), found)
        self.assertIn(('wed-1', 'repeat'), found)
        # His own idea keeps the story: the engine's twin is refused, his is shown with the repeat, never failing.
        plan['days']['wed'][0]['source_kind'] = 'his'
        found = {(f['ref'], f['code']) for f in ic.repeat_findings(plan, {}, [])}
        self.assertIn(('off-thu-untied', 'repeat'), found)
        self.assertNotIn(('wed-1', 'repeat'), found)
        self.assertIn('his_repeat', ic.NOTE_CODES)

    def test_an_off_day_carousel_is_utility(self):
        """Krish, 2026-11-16: "Off day Carousels should have that level of utility"."""
        self.assertTrue(ic.offday_carousel('off-tue-x', {'format': 'Explainer carousel, 4 cards, 4:5'}))
        self.assertFalse(ic.offday_carousel('off-sat-goodnews', {'format': 'Uplifting AI news carousel, 6 cards', 'weekly': 'good_news'}))
        self.assertFalse(ic.offday_carousel('off-tue-m', {'format': 'Meme carousel, 6 cards, 4:5'}))
        self.assertFalse(ic.offday_carousel('mon-1', {'format': 'carousel'}))
        opt = {'id': 'x', 'format': 'Explainer carousel, 4 cards, 4:5', 'shape': 'story', 'aim': 'interest',
               'source': {'url': 'https://example.com/a'}, 'dive': 'How the meter counts the work it does.', 'funny': 'Your AI plan now has a fuel light.'}
        lines = [f['line'] for f in ic.aim_findings({'offdays': {'tue': [opt]}}, '2026-11-23', None, [], ['No lookalike this week: none'])]
        self.assertTrue(any('off-day carousel: its aim is "utility"' in line for line in lines), lines)
        opt['aim'] = 'utility'
        lines = [f['line'] for f in ic.aim_findings({'offdays': {'tue': [opt]}}, '2026-11-23', None, [], ['No lookalike this week: none'])]
        self.assertFalse(any('off-day carousel' in line for line in lines), lines)

    def test_one_name_and_a_year_is_not_one_work(self):
        a = ic.work_marks('The Register, Oct 2026 (Anthropic Scion)')
        b = ic.work_marks('The Register, Oct 2026 (Microsoft layoffs)')
        self.assertFalse(ic.same_work(ic.work_marks('Gartner, 2026 (agent spend)'), ic.work_marks('Gartner press release, 2026 (hype cycle)')))
        self.assertFalse(ic.same_work(a, b))

    def test_a_page_is_compared_without_tracking_www_fragment_or_trailing_slash(self):
        self.assertEqual(ic.canon_url('https://WWW.Example.com/a/b/?utm_source=x&id=7#top'), 'example.com/a/b?id=7')
        self.assertEqual(ic.canon_url('http://edm.com/?p=271236'), 'edm.com?p=271236')
        self.assertIsNone(ic.canon_url('Your saved post'))

    def test_the_same_primary_source_or_words_as_a_post_is_a_repeat(self):
        src = {'recent_posts': [post('off-tue-a', 'https://example.com/story')]}
        same = {'offdays': {'thu': [off('again', 'https://www.example.com/story/?utm_medium=s')]}}
        self.assertEqual([f['rule'] for f in ic.repeat_findings(same, src)], ['a'])
        words = {'offdays': {'thu': [off('words', 'https://example.com/new', hook='A post that went out, last week!')]}}
        self.assertEqual([f['rule'] for f in ic.repeat_findings(words, src)], ['b'])
        self.assertEqual(ic.repeat_findings({'offdays': {'thu': [off('fresh', 'https://example.com/new')]}}, src), [])

    def test_two_posts_may_cite_one_article_but_not_the_same_evidence(self):
        cites = 'Acme Daily, 3 Nov 2026 (the robot); Widget Journal, 5 Nov 2026; Example Labs study, 2024'
        src = {'recent_posts': [post('off-tue-a', 'https://example.com/first', labels=[cites])]}
        one = off('one', 'https://example.com/other', source={'label': 'Gizmo Times, 9 Nov 2026; Acme Daily (the robot, 3 Nov 2026)', 'url': 'https://example.com/other'})
        self.assertEqual(ic.repeat_findings({'offdays': {'thu': [one]}}, src), [], 'one article in common is allowed')
        two = off('two', 'https://example.com/other', source={'label': 'Example Labs, 2024; Acme Daily (3 Nov 2026)', 'url': 'https://example.com/other'})
        self.assertEqual([f['rule'] for f in ic.repeat_findings({'offdays': {'thu': [two]}}, src)], ['e'])
        self.assertFalse(ic.same_work(ic.work_marks('The Register, 21 Oct 2026'), ic.work_marks('The Register, 6 Nov 2026')),
                         'two days of one outlet are two works')

    def test_a_carousel_that_supports_the_days_approved_piece_may_share_its_page(self):
        url = 'https://example.com/piece'
        twin = {'week_start': '2026-11-23', 'days': {'wed': [main_option(source={'label': 'l', 'url': url})]},
                'offdays': {'thu': [off('carry', url)]}}
        self.assertEqual(sorted(f['rule'] for f in ic.repeat_findings(twin, {})), ['d', 'd'])
        locked = {'week_start': '2026-11-23', 'locked': {'wed': {'piece_id': P}},
                  'offdays': {'thu': [off('carry', url, supports='wed'), off('other', url)]}}
        self.assertEqual(ic.repeat_findings(locked, {}), [], 'a supporting carousel of the approved piece is no twin')
        src = {'recent_posts': [post(f'piece:{P}', url, type='piece', piece_id=P, stage='produced')]}
        self.assertEqual(ic.repeat_findings({'week_start': '2026-11-23', 'locked': {'wed': {'piece_id': P}},
                                             'offdays': {'thu': [off('carry', url, supports='wed')]}}, src), [])
        self.assertEqual([f['rule'] for f in ic.repeat_findings({'week_start': '2026-11-23', 'offdays': {'thu': [off('carry', url, supports='wed')]}}, src)],
                         ['a'], 'supports names a day with no approved piece: still a repeat')

    def test_an_earlier_option_comes_back_only_when_he_sent_it_back(self):
        earlier = [{'week': '2026-11-16', 'day': 'sat', 'id': 'acme', 'main': False}, {'week': '2026-11-16', 'day': 'fri', 'id': IDEA, 'main': True}]
        plan = {'week_start': '2026-11-23', 'days': {'mon': [main_option(id=IDEA)]}, 'offdays': {'tue': [off('acme', 'https://example.com/acme')]}}
        self.assertEqual(sorted(f['ref'] for f in ic.repeat_findings(plan, {}, earlier)), ['mon-1', 'off-tue-acme'])
        filed = sources(('filed', outcome('filed', None, idea=None, doc='queue/off-sat-acme')), ('trend', outcome('trend', 'Keep an eye on this.')))
        self.assertEqual(ic.repeat_findings(plan, filed, earlier), [], 'his File for later and Save as a trend send them back')
        mine = {'must_cover': [{'id': IDEA, 'kind': 'his_idea'}]}
        self.assertEqual([f['ref'] for f in ic.repeat_findings(plan, mine, earlier)], ['off-tue-acme'], 'his own open idea is owed a place')
        queued = {'queue': [{'id': IDEA}]}
        self.assertEqual([f['ref'] for f in ic.repeat_findings(plan, queued, earlier)], ['off-tue-acme'], 'an idea in his queue was filed by him')

    def test_the_gate_fails_on_a_repeat_and_on_posts_it_could_not_read(self):
        self.assertIn('repeat', ic.GATE_CODES)
        self.assertEqual([f['code'] for f in ic.repeat_read_findings({'recent_posts': [], 'recent_posts_error': '2026-11-16: HTTP 503'}, '2026-11-23')], ['repeat'])
        self.assertEqual(len(ic.repeat_read_findings({}, '2026-11-23')), 1, 'from 23 Nov a gather without the posts fails the gate')
        self.assertEqual(ic.repeat_read_findings({}, '2026-11-16'), [], 'an older week keeps the shape it was made in')
        src = dict(sources(), recent_posts=[post('off-tue-a', 'https://example.com/went-out')])
        ideas = {'week_start': '2026-11-23', 'days': {'mon': [main_option(source={'label': 'l', 'url': 'https://example.com/went-out'})]}}
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / '2026-11-23-week'
            folder.mkdir()
            (folder / 'sources.json').write_text(json.dumps(src))
            (folder / 'ideas.json').write_text(json.dumps(reviewed(ideas)))
            write_look(folder)
            problems, _ = board_feed.gate('2026-11-23', plans=tmp)
            self.assertEqual(len(problems), 1)
            self.assertTrue(problems[0].startswith('repeat: mon-1'), problems[0])


class AimTest(unittest.TestCase):
    """Krish, 2026-11-16: one clear theme or one clear story, for utility, interest or humour, and every suggestion
    tinged with a humorous angle."""

    def test_every_option_from_23_nov_says_its_shape_aim_humour_and_lookalike(self):
        bare = {'week_start': '2026-11-23', 'days': {'mon': [{'id': OTHER, 'source_kind': 'engine', 'source': {'label': 'l', 'url': 'https://e.com/s'}}]}}
        lines = [f['line'] for f in ic.aim_findings(bare, '2026-11-23', ['p1'], [FEED_POST])]
        self.assertEqual(len(lines), 6, lines)
        self.assertTrue(all(f['code'] in ic.GATE_CODES for f in ic.aim_findings(bare, '2026-11-23', ['p1'], [FEED_POST])))
        self.assertEqual(ic.aim_findings({'days': {'mon': [main_option()]}}, '2026-11-23', ['p1'], [FEED_POST]), [])
        self.assertEqual(ic.aim_findings(bare, '2026-11-16', ['p1'], [FEED_POST]), [], 'an older board keeps its shape')

    def test_a_theme_carries_three_sourced_stories_and_a_story_its_dive(self):
        stories = [{'headline': f'S{n}', 'source': {'label': 'L', 'url': f'https://e.com/{n}'}} for n in range(3)]
        theme = main_option(shape='theme', stories=stories[:2])
        self.assertIn('is a theme with 2 sourced stories', ic.aim_findings({'days': {'mon': [theme]}}, '2026-11-23', ['p1'], [FEED_POST])[0]['line'])
        self.assertEqual(ic.aim_findings({'days': {'mon': [dict(theme, stories=stories)]}}, '2026-11-23', ['p1'], [FEED_POST]), [])
        self.assertIn('is a story', ic.aim_findings({'days': {'mon': [main_option(dive='')]}}, '2026-11-23', ['p1'], [FEED_POST])[0]['line'])

    def test_the_lookalike_names_a_pattern_and_a_post_in_the_input_and_his_own_need_none(self):
        wrong = main_option(lookalike={'pattern': 'nope', 'beats': 'https://www.instagram.com/p/elsewhere/', 'our_take': AIMED['lookalike']['our_take']})
        self.assertEqual(len(ic.aim_findings({'days': {'mon': [wrong]}}, '2026-11-23', ['p1'], [FEED_POST])), 2)
        his = main_option(source_kind='his', lookalike=None)
        self.assertEqual(ic.aim_findings({'days': {'mon': [his]}}, '2026-11-23', ['p1'], [FEED_POST]), [])
        self.assertEqual([f['ref'] for f in ic.aim_findings({'days': {}}, '2026-11-23', None, [])], ['lookalike'])

    def test_an_option_may_take_a_posts_idea_but_says_its_own_take_in_its_own_words(self):
        # Krish, 2026-11-16: "You are more than welcome to copy any ideas but we just change the copy, we change the
        # branding, we change the imagery, and ideally we have our own take on the card".
        no_take = main_option(lookalike={'pattern': 'p1', 'beats': FEED_POST})
        lines = [f['line'] for f in ic.aim_findings({'days': {'mon': [no_take]}}, '2026-11-23', ['p1'], [FEED_POST])]
        self.assertEqual(len(lines), 1, lines)
        self.assertIn('lookalike.our_take', lines[0])
        theirs = {ic.canon_url(FEED_POST): 'Your boss is quietly replacing your team with three agents and a spreadsheet. Swipe.'}
        copied = main_option(hook='Your boss is quietly replacing your team with three agents, says a new survey.')
        got = ic.aim_findings({'days': {'mon': [copied]}}, '2026-11-23', ['p1'], [FEED_POST], (), theirs)
        self.assertEqual(len(got), 1, got)
        self.assertIn('"your boss is quietly replacing your team"', got[0]['line'])
        self.assertEqual(got[0]['code'], 'aim')
        ours = main_option(hook='Three agents and a spreadsheet walk into your team meeting.')
        self.assertEqual(ic.aim_findings({'days': {'mon': [ours]}}, '2026-11-23', ['p1'], [FEED_POST], (), theirs), [],
                         'a shared fact or a few shared words are fine')
        card = main_option(cards=[{'words': 'Your boss is quietly replacing your team with three agents', 'picture': 'x'}])
        self.assertEqual(len(ic.aim_findings({'days': {'mon': [card]}}, '2026-11-23', ['p1'], [FEED_POST], (), theirs)), 1)

    def test_copied_run_finds_seven_words_in_a_row_and_nothing_shorter(self):
        self.assertIsNone(ic.copied_run('one two three four five six', 'one two three four five six seven'))
        self.assertEqual(ic.copied_run('A one two three four five six seven b', 'x one two three four five six seven y'),
                         'one two three four five six seven')
        self.assertIsNone(ic.copied_run('one two three four five six eight', 'one two three four five six seven'))
        self.assertIsNone(ic.copied_run('', 'anything at all here in seven words'))

    def test_a_stale_sheet_is_said_in_ideas_about(self):
        warn = 'Stale sheet: the newest row is 2026-11-10.'
        plan = {'days': {'mon': [main_option()]}}
        self.assertEqual(len(ic.aim_findings(plan, '2026-11-23', ['p1'], [FEED_POST], [warn])), 1)
        self.assertEqual(ic.aim_findings(dict(plan, _about=f'The board. {warn}'), '2026-11-23', ['p1'], [FEED_POST], [warn]), [])


class SameStoryTest(unittest.TestCase):
    """Krish, 2026-11-16: '"AI is about to start messaging you first" was posted last week. Why is it on my ideas board
    for this week?' A retold story shares no link and no sentence with the post it retells; a fresh reader judges it."""

    def test_every_option_needs_a_fresh_readers_verdict_and_the_same_story_fails(self):
        plan = {'week_start': '2026-11-16', 'days': {'mon': [main_option()]}, 'offdays': {'tue': [off('proactiveai', 'https://e.com/p')]}}
        lines = [f['line'] for f in ic.review_findings(plan, sources(), '2026-11-16')]
        self.assertEqual(len(lines), 2, lines)
        self.assertTrue(all('no same-story verdict' in x for x in lines))
        self.assertEqual(ic.review_findings(reviewed(plan), sources(), '2026-11-16'), [])
        same = reviewed(plan, {'off-tue-proactiveai': 'same_story'})
        same['repeat_review']['checked'][1].update({'of': 'off-thu-puppy', 'why': 'the No spending, no sending short of Thu 5 Nov'})
        found = ic.review_findings(same, sources(), '2026-11-16')
        self.assertEqual([f['code'] for f in found], ['repeat'])
        self.assertIn('off-tue-proactiveai tells the same story as off-thu-puppy', found[0]['line'])
        self.assertIn('repeat', ic.GATE_CODES)
        self.assertEqual(ic.review_findings(plan, sources(), '2026-11-09'), [], 'an older board keeps its checks')

    def test_a_review_without_a_reader_counts_for_nothing_and_his_own_idea_is_only_shown(self):
        plan = reviewed({'week_start': '2026-11-16', 'days': {'mon': [main_option(source_kind='his')]}}, {'mon-1': 'same_story'})
        found = ic.review_findings(plan, sources(), '2026-11-16')
        self.assertEqual([f['code'] for f in found], ['his_repeat'])
        plan['repeat_review']['reader'] = ''
        self.assertIn('no same-story verdict', ic.review_findings(plan, sources(), '2026-11-16')[0]['line'])

    def test_an_off_day_offers_five_and_a_day_spans_two_aims(self):
        offs = {'tue': [off(f'o{n}', f'https://e.com/{n}', aim='utility') for n in range(4)]}
        plan = {'week_start': '2026-11-23', 'offdays': offs}
        lines = [f['line'] for f in ic.breadth_findings(plan, '2026-11-23')]
        self.assertEqual(len(lines), 2, lines)
        self.assertTrue(any('offers 4 options' in x for x in lines))
        offs['tue'].append(dict(off('o4', 'https://e.com/4'), aim='humour'))
        self.assertEqual(ic.breadth_findings(plan, '2026-11-23'), [])
        self.assertEqual(ic.breadth_findings({'offdays': {'tue': offs['tue'][:2]}}, '2026-11-16'), [], 'an older board keeps its checks')

    def test_a_held_ask_keeps_the_card_he_saved(self):
        link = 'https://youtube.com/shorts/tJwqPQvgQkk'
        card = {'id': 'd16fe9ff-413c-47c4-ac53-c89e40d28489', 'link': link, 'saved_why': 'Lets make a hilarious meme.'}
        src = dict(sources(), inspiration={'fresh': [card]})
        said = 'Lets make a hilarious meme. Reskin this video with the text "POV: your AI agent when you forget to teach it anything"'
        vague = {'held': [{'ref': f'ask/{card["id"]}', 'day': 'tue', 'title': said, 'reason': 'Too close to the meme approved for Fri 13 Nov.'}]}
        lines = [f['line'] for f in ic.held_ask_findings(vague, src, '2026-11-23')]
        self.assertEqual(len(lines), 3, lines)
        good = {'held': [{'ref': f'ask/{card["id"]}', 'day': 'tue', 'said': said, 'source': {'label': 'The YouTube short you saved, 3 Nov', 'url': link},
                          'title': 'A meme on the YouTube short you saved: an AI agent nobody taught', 'reason': 'Too close to the meme approved for Fri 13 Nov.'}]}
        self.assertEqual(ic.held_ask_findings(good, src, '2026-11-23'), [])
        self.assertEqual(ic.held_ask_findings(vague, src, '2026-11-09'), [])


class KeepTest(unittest.TestCase):
    """A re-run that makes again only the open options on some days (sunday-ideas.yml days) leaves every answered one
    exactly as it was."""

    def setUp(self):
        self.before = {'days': {'mon': [main_option(id=IDEA), main_option(id=OTHER)]},
                       'offdays': {'tue': [off('kept', 'https://e.com/k')], 'thu': [off('open1', 'https://e.com/o'), off('liked', 'https://e.com/l')]}}
        self.status = {f'idea:{IDEA}': 'approved', f'idea:{OTHER}': 'open', 'off:thu:open1': 'open', 'off:thu:liked': 'revised', 'off:tue:kept': 'open'}

    def test_a_held_option_he_never_pressed_may_be_made_again_too(self):
        # Tue 17's retold No spending short stood as held: words from a session, never his press (Krish, 2026-11-11).
        after = json.loads(json.dumps(self.before))
        after['offdays']['tue'] = []
        self.assertEqual(board_feed.keep_problems(self.before, after, dict(self.status, **{'off:tue:kept': 'held'}), ['tue']), [])
        self.assertEqual(len(board_feed.keep_problems(self.before, after, dict(self.status, **{'off:tue:kept': 'held_piece'}), ['tue'])), 1)

    def test_open_options_on_its_days_may_be_made_again(self):
        after = json.loads(json.dumps(self.before))
        after['offdays']['thu'] = [off('new1', 'https://e.com/n'), self.before['offdays']['thu'][1]]
        after['days']['mon'][1] = main_option(id=ASK, so_what='A new story.')
        self.assertEqual(board_feed.keep_problems(self.before, after, self.status, ['thu', 'mon']), [])

    def test_an_answered_option_or_another_day_must_come_back_as_it_was(self):
        after = json.loads(json.dumps(self.before))
        after['offdays']['thu'][1]['hook'] = 'Rewritten.'
        after['offdays']['tue'] = []
        after['days']['mon'] = [after['days']['mon'][1], after['days']['mon'][0]]
        got = board_feed.keep_problems(self.before, after, self.status, ['thu', 'mon'])
        self.assertEqual(len(got), 3, got)
        self.assertTrue(any(g.startswith('off-thu-liked is revised') for g in got))
        self.assertTrue(any(g.startswith('tue: not one of the days') for g in got))
        self.assertTrue(any(g.startswith('mon-1 is approved') and 'in its place' in g for g in got))
        unknown = board_feed.keep_problems(self.before, json.loads(json.dumps(self.before)) | {'offdays': {'tue': self.before['offdays']['tue'], 'thu': []}}, {}, ['thu'])
        self.assertTrue(all('is unknown' in g for g in unknown) and len(unknown) == 2, 'an option whose status is not known is kept')

    def test_a_day_made_again_leaves_him_a_real_choice(self):
        # The 16 Nov re-run of Tue and Thu left Tue 17 with one open option (Krish, 2026-11-16: "There's not enough
        # quality and breadth of ideas").
        after = json.loads(json.dumps(self.before))
        after['offdays']['tue'] = [off('new1', 'https://e.com/n1')]
        got = board_feed.refill_breadth(self.before, after, self.status, ['tue'])
        self.assertEqual(len(got), 1, got)
        self.assertTrue(got[0].startswith('tue: 1 option(s)'), got)
        after['offdays']['tue'] += [off(f'new{n}', f'https://e.com/n{n}') for n in (2, 3)] + [off('kept', 'https://e.com/k')]
        self.assertEqual(board_feed.refill_breadth(self.before, after, self.status, ['tue']), [], 'a kept open option counts')
        answered = dict(self.status, **{'off:tue:kept': 'rejected'})
        self.assertEqual(len(board_feed.refill_breadth(self.before, after, answered, ['tue'])), 1, 'an answered option is not a choice')
        # Thu keeps one open and one revised: two choices, and the re-run must add two more.
        self.assertEqual(len(board_feed.refill_breadth(self.before, self.before, self.status, ['thu'])), 1)
        self.assertEqual(board_feed.refill_breadth(self.before, self.before, self.status, ['fri']), [], 'a day with no options anywhere is not asked')

    def test_the_status_reads_his_presses_over_the_board(self):
        view = {'model': {'ideas': [{'doc_id': 'off-thu-open1', 'why': 'open'}, {'doc_id': 'off-thu-liked', 'why': 'revised'},
                                    {'doc_id': 'mon-2', 'piece_id': OTHER, 'why': 'open'}, {'doc_id': 'mon-1', 'piece_id': IDEA, 'why': 'open'}],
                          'days': [{'items': [{'key': 'off-tue-kept', 'type': 'post'}, {'key': f'piece:{ASK}', 'type': 'piece', 'piece_id': ASK}]}]}}
        outcomes = {'outcomes': [{'doc': 'queue/mon-1', 'idea_id': IDEA, 'outcome': 'filed', 'decided_at': '2026-11-20T10:00:00Z'},
                                 {'doc': 'queue/off-thu-open1', 'outcome': 'approved', 'decided_at': '2026-11-20T10:00:00Z'},
                                 {'doc': 'queue/off-thu-open1', 'outcome': 'withdrawn', 'decided_at': '2026-11-20T11:00:00Z'}]}
        self.assertEqual(board_feed.option_status(view, outcomes), {'off:thu:open1': 'open', 'off:thu:liked': 'revised', f'idea:{OTHER}': 'open',
                                                                    f'idea:{IDEA}': 'filed', 'off:tue:kept': 'approved', f'idea:{ASK}': 'approved'})


class DaysGateTest(unittest.TestCase):
    """A `days` re-run (sunday-ideas.yml) answers for the open options of its own days only: a problem the board already
    had elsewhere, or on an option he answered, is reported and never fails the run (the week of 16 Nov carried answered
    repeats on Mon and Tue when Thu and Sat were made again)."""

    STATUS = {'off:thu:ownref': 'open', 'off:thu:tinyfix': 'filed', 'idea:a57cf3eb-0000': 'open'}

    def test_only_an_open_option_on_a_re_run_day_is_the_runs(self):
        self.assertTrue(board_feed.remakeable('repeat: off-thu-ownref cites three of the same works', ['thu', 'sat'], self.STATUS))
        self.assertFalse(board_feed.remakeable('repeat: off-thu-tinyfix has the same primary source as wed-1', ['thu', 'sat'], self.STATUS))
        self.assertFalse(board_feed.remakeable('repeat: wed-1 (a57cf3eb) has the same primary source as off-thu-tinyfix', ['thu', 'sat'], self.STATUS))
        self.assertTrue(board_feed.remakeable('repeat: wed-1 (a57cf3eb) x', ['wed'], self.STATUS))

    def test_the_subject_is_the_first_option_named_never_a_press_it_cites(self):
        line = 'return without depth: off-tue-burntokens comes back after his filed press (2026-11-09/queue/off-thu-burntokens, 2026-11-03)'
        self.assertFalse(board_feed.remakeable(line, ['thu'], self.STATUS))

    def test_without_the_status_every_option_on_those_days_counts(self):
        self.assertTrue(board_feed.remakeable('repeat: off-sat-goodnews x', ['sat'], None))
        self.assertFalse(board_feed.remakeable('no subject here', ['sat'], None))


if __name__ == '__main__':
    unittest.main()
