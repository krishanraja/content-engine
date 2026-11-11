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
            'house_rules': [{'id': 'BIG_PICTURE', 'text': 'x'}, {'id': 'STORY_ARC', 'text': 'y'}]}


def main_option(**kw):
    return dict({'id': OTHER, 'source_kind': 'engine', 'so_what': 'A thing happened.', 'story': 'Headline: x.', 'covers': []}, **kw)


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
            (folder / 'ideas.json').write_text(json.dumps(ideas))
            problems, warned = board_feed.gate('2026-11-23', plans=tmp)
            self.assertEqual(len(problems), 1)
            self.assertTrue(problems[0].startswith('refused: mon-1 is on Acme'))
            ideas['days']['mon'][0]['so_what'] = 'Who keeps the AI saving.'
            (folder / 'ideas.json').write_text(json.dumps(ideas))
            self.assertEqual(board_feed.gate('2026-11-23', plans=tmp)[0], [])

    def test_the_self_test_still_passes(self):
        self.assertEqual(board_feed.self_test(), [])


if __name__ == '__main__':
    unittest.main()


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
