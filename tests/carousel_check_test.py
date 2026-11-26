"""The ten-second swipe (scripts/carousel_check.py; Krish, 2026-11-13: "a complete layperson is swiping through these
cards at light speed and needs to be able to follow the story within 10 seconds. This cannot ever happen again in any
future carousel."). The Git deck as it went out on 12 Nov fails, and so does the deck redrawn on 13 Nov: on 15 Nov
Krish named its cards hard to follow ("12x more code in 4 months" should be something like: "12 times more code is
being produced per month because of AI doing more coding"; Ruling, Krish, 2026-11-15: a carousel body card carries
one full plain sentence of 8 to 20 words a stranger can follow). The worked example is now FOLLOWABLE, synthetic, in
the shape he asked for. The drawn cards are held by --cards (scripts/carousel_layout.py), on synthetic PNGs here."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import carousel_check  # noqa: E402

REDRAWN = json.loads((ROOT / 'docs/plans/2026-11-09-week/git-carousel/deck.json').read_text(encoding='utf-8'))
# The 13 Nov deck ended on "Follow for more". From 14 Nov the last card is the palette's close (Ruling, Krish,
# 2026-11-18: the carousel ends on the takeaway, then "Follow for more" with the wordmark centred under it), so the
# reference deck is held to it with that one card's foot changed and its story untouched.
REDRAWN['cards'][-1]['line'] = "That's your new traffic jam. Fix it before AI floods it."
REDRAWN['cards'][-1]['cta'] = 'Follow for more'
# The worked example (synthetic words in the shape he asked for on 15 Nov; the facts are the Git deck's own five whys).
FOLLOWABLE = json.loads(json.dumps(REDRAWN))
FOLLOWABLE['cards'] = [
    {'headline': "Anthropic's AI wrote so much code it broke Git", 'line': 'Git is where every programmer saves their work.',
     'picture': 'the cover scene'},
    {'headline': '12 times more code is being saved each day because AI now writes most of it.',
     'line': 'About 2,500 changes a day in May, over 30,000 a day by September.', 'picture': 'two bars to scale'},
    {'headline': 'Git was built for people who save their work a few times a day.',
     'line': 'AI saves changes all day and all night.', 'picture': 'changes piling up at a narrow funnel'},
    {'headline': 'Anthropic built its own replacement for Git so its AI could keep working.',
     'line': 'Seven engineers built it in five months.', 'picture': 'a wide new road beside a jammed lane'},
    {'headline': 'The hold-up has now moved to the people who check what the AI made.',
     'line': 'Writing got faster; checking did not.', 'picture': 'a long queue at one desk'},
    {'headline': 'Teams using AI finished 21% more work but waited 91% longer for checks, by Faros AI.',
     'line': 'The same jam shows up far beyond Anthropic.', 'picture': 'two bars: work done, waiting time',
     'source': 'Faros AI, 2025 study of engineering teams'},
    {'headline': 'Every business has sign-offs that will jam the same way when AI speeds up the work.',
     'line': 'Approvals, legal reviews, the boss inbox.', 'picture': 'an inbox overflowing'},
    {'headline': 'Find the steps where AI work waits for a person to say yes.',
     'line': 'That is where your new traffic jam will form.', 'picture': 'a map with one red bottleneck'},
    {'headline': 'Check work by how risky it is, never out of habit.', 'line': 'Not every piece needs the same check.',
     'cta': 'Follow for more', 'picture': 'the wordmark centred under it'}]
FOLLOWABLE['arc'] = {'what': 1, 'happened': [1, 2], 'why': 3, 'so_what': [5, 6, 7], 'do': [8, 9]}
AS_SENT = {'schema': 'carousel-deck/1', 'cards': [
    {'headline': "Its AI wrote so much code, Git couldn't keep up", 'line': "Git is the tool almost every programmer uses to save and share code.", 'picture': 'the cover scene'},
    {'headline': 'CODE CHANGES ANTHROPIC MERGED PER DAY', 'line': 'Twelve times as much, in four months. Most of it written by Claude.', 'picture': ''},
    {'headline': '7 ENGINEERS 5 MONTHS', 'line': 'They built Scion, a replacement for Git made for AI agents, with Claude writing most of its code.', 'picture': ''},
    {'headline': "IT'S NOT JUST ANTHROPIC", 'line': "Entire, GitButler and GitHub.", 'picture': ''},
    {'headline': 'THE NEXT SOFTWARE YOU BUY IS BUILT FOR ROBOTS TO USE AND PEOPLE TO CHECK.', 'line': 'Ask who your next tool was built for.', 'picture': ''}]}


class TenSecondSwipe(unittest.TestCase):
    def test_the_followable_deck_passes(self):
        self.assertEqual(carousel_check.problems(FOLLOWABLE), [])

    def test_the_redrawn_git_deck_he_criticised_fails(self):
        # Krish, 15 Nov: the cards "assume that people have a working knowledge of what we're talking about and use too
        # few words". Each fault is named on its card.
        found = ' | '.join(carousel_check.problems(REDRAWN))
        self.assertIn('card 2: "12x" is shorthand', found)
        self.assertIn('card 2: the headline has no verb', found)
        self.assertIn('card 4: the headline opens on "So"', found)
        self.assertIn('card 5: the headline opens on "But"', found)
        self.assertIn('card 6: stacked fragments', found)
        self.assertIn('card 8: the headline has 5 words', found)

    def test_his_example_sentence_passes_and_the_shorthand_fails(self):
        good = carousel_check.followable_problems(
            2, '12 times more code is being produced per month because of AI doing more coding.', '')
        self.assertEqual(good, [])
        bad = ' | '.join(carousel_check.followable_problems(2, '12x more code in four months.', ''))
        self.assertIn('shorthand', bad)
        self.assertIn('no verb', bad)

    def test_a_number_needs_its_unit_and_its_cause(self):
        found = ' | '.join(carousel_check.followable_problems(2, 'Anthropic now saves 30,000 code changes.', ''))
        self.assertIn('no unit or comparator', found)
        self.assertIn('no cause', found)

    def test_a_paragraph_on_a_card_fails(self):
        deck = json.loads(json.dumps(FOLLOWABLE))
        deck['cards'][2]['headline'] = ('Git was built for people who save their work a few times a day and it was '
                                        'never meant for machines that save all night long.')
        self.assertTrue(any('card 3: the headline has 26 words' in p for p in carousel_check.problems(deck)))

    def test_a_deck_without_the_so_what_fails(self):
        # The 13 Nov redraw: five clear cards that never said why it happened, what trend it shows or what to do.
        deck = json.loads(json.dumps(FOLLOWABLE))
        deck['cards'] = deck['cards'][:4] + [deck['cards'][-1]]
        deck.pop('five_whys'); deck['arc'] = {'what': 1, 'happened': 2}
        found = ' | '.join(carousel_check.problems(deck))
        self.assertIn('ask why five times', found)
        self.assertIn('the wider trend it points to', found)
        self.assertIn('what a business person should do', found)

    def test_more_than_ten_cards_or_no_palette_close_fails(self):
        deck = json.loads(json.dumps(FOLLOWABLE))
        deck['cards'] = deck['cards'] + [{'headline': 'One more.', 'picture': 'x'}] * 2
        found = ' | '.join(carousel_check.problems(deck))
        self.assertIn('at most 10', found)
        self.assertIn('"Follow for more" with the wordmark', found)

    def test_the_subscribe_close_is_retired(self):
        # Krish, 2026-11-18: "Follow for more" over the centred wordmark, never "an amateur call to action".
        deck = json.loads(json.dumps(FOLLOWABLE))
        deck['cards'][-1]['cta'] = 'Subscribe free (makeyourmindup.ai)'
        found = ' | '.join(carousel_check.problems(deck))
        self.assertIn('"Follow for more" with the wordmark', found)
        self.assertIn('not "Subscribe free"', found)
        deck['cards'][-1]['cta'] = 'Follow for more'
        self.assertEqual(carousel_check.problems(deck), [])

    def test_the_close_carries_the_takeaway(self):
        deck = json.loads(json.dumps(FOLLOWABLE))
        deck['cards'][-1] = {'cta': 'Follow for more', 'picture': 'the wordmark'}
        self.assertIn('takeaway', ' | '.join(carousel_check.problems(deck)))

    def test_saturday_good_news_keeps_its_fixed_close(self):
        deck = json.loads(json.dumps(FOLLOWABLE))
        deck['good_news'] = True
        self.assertIn('good-news close', ' | '.join(carousel_check.problems(deck)))
        deck['cards'][-1]['cta'] = ('If this inspires you to MAKE THE WORLD BETTER by combining your ideas + AI, '
                                    'follow for more')
        self.assertEqual(carousel_check.problems(deck), [])

    def test_a_trend_without_evidence_fails(self):
        deck = json.loads(json.dumps(FOLLOWABLE))
        for c in deck['cards']:
            c.pop('source', None)
        self.assertTrue(any('names its evidence' in p for p in carousel_check.problems(deck)))

    def test_the_git_deck_as_sent_fails_on_each_fault(self):
        found = ' | '.join(carousel_check.problems(AS_SENT))
        self.assertIn('card 2: the headline is not a whole sentence', found)
        self.assertIn('"merged" is jargon', found)
        self.assertIn('card 3: no picture of its point', found)
        self.assertIn('card 4: the headline opens on "IT"', found)
        self.assertIn('fresh readers', found)

    def test_a_long_story_or_a_long_line_fails(self):
        deck = json.loads(json.dumps(FOLLOWABLE))
        deck['cards'][2]['line'] = ' '.join(['word'] * 21)
        for c in deck['cards'][1:-1]:
            c['headline'] = c['headline'][:-1] + ' because the work that waits for people keeps on growing.'
        found = ' | '.join(carousel_check.problems(deck))
        self.assertIn('card 3: the line under the headline has 21 words', found)
        self.assertIn('at most 160, one plain sentence a card', found)

    def test_jargon_explained_in_the_deck_passes(self):
        deck = json.loads(json.dumps(FOLLOWABLE))
        deck['cards'][1]['headline'] = 'Anthropic merged 12 times more code each day because AI writes it.'
        self.assertTrue(any('"merged"' in p for p in carousel_check.problems(deck)))
        deck['explains']['merged'] = 'saved into the shared copy everyone works from'
        self.assertEqual(carousel_check.problems(deck), [])


class WhyLadderDeck(unittest.TestCase):
    """carousel-deck/2 (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of everything that
    suggests predictions, calls, dated, odds or scores): the why-ladder before any card, every Why with its source.
    A carousel-deck/1 deck keeps its five whys with no source each."""

    LADDER = [{'q': f'Why does step {n} happen?', 'a': f'Because cause {n} came first, the filings show.',
               'source': f'Anthropic engineering blog, 2026-11-0{n}'} for n in range(1, 6)]

    # The worked why-ladder deck: FOLLOWABLE's story, landing on what it shows and an open question, with no "do" card.
    LANDED = json.loads(json.dumps(FOLLOWABLE))
    LANDED['schema'] = 'carousel-deck/2'
    LANDED['cards'][7] = {'headline': 'Every step where AI work waits for a person to say yes is where the jam now forms.',
                          'line': 'The hold-up moved from doing the work to checking it.',
                          'picture': 'a map with one red bottleneck'}
    LANDED['cards'][8] = {'headline': 'Where in your own work does AI already wait for a person to say yes?',
                          'cta': 'Follow for more', 'picture': 'the wordmark centred under it'}
    LANDED['arc'] = {'what': 1, 'happened': [1, 2], 'why': 3, 'so_what': [5, 6, 7], 'landing': [8, 9]}
    for reader in LANDED['read_back']:
        reader['answers'].pop('do')
        reader['answers']['landing'] = 'The jam sits wherever a person has to say yes, so where is that for me?'

    @classmethod
    def deck(cls, whys):
        deck = json.loads(json.dumps(cls.LANDED))
        deck['five_whys'] = whys
        return deck

    def test_the_ladder_lands_on_an_open_question_with_no_do_card(self):
        deck = self.deck(self.LADDER)
        self.assertNotIn('do', deck['arc'])
        self.assertEqual(carousel_check.problems(deck), [])

    def test_a_landing_that_tells_business_people_what_to_do_fails(self):
        deck = self.deck(self.LADDER)
        deck['cards'][7]['headline'] = 'Find the steps where AI work waits for a person to say yes.'
        found = ' | '.join(carousel_check.problems(deck))
        self.assertIn('card 8: the landing tells business people what to do ("Find")', found)
        deck = self.deck(self.LADDER)
        deck['cards'][8]['headline'] = 'Business leaders should check every piece of AI work by how risky it is.'
        found = ' | '.join(carousel_check.problems(deck))
        self.assertIn('card 9: the landing tells business people what to do ("leaders should")', found)
        self.assertIn('the landing hands the viewer no open question', found)

    def test_a_ladder_deck_keeps_no_do_step_and_its_readers_answer_the_landing(self):
        old = self.deck(self.LADDER)
        old['arc'] = dict(FOLLOWABLE['arc'])
        found = ' | '.join(carousel_check.problems(old))
        self.assertIn('name the card "landing" in the arc, not "do"', found)
        self.assertIn('no card says what this shows, ending on the open question', found)
        unread = self.deck(self.LADDER)
        for reader in unread['read_back']:
            reader['answers'].pop('landing')
        self.assertIn('what it shows and the question it leaves them with (0 given)',
                      ' | '.join(carousel_check.problems(unread)))

    def test_the_stop_is_one_of_the_contract_stops_and_ends_the_ladder(self):
        bad = self.deck(self.LADDER[:1] + [dict(self.LADDER[1], stop='gave_up')])
        self.assertIn('Why 2\'s stop is "gave_up", not one of evidence_exhausted', ' | '.join(carousel_check.problems(bad)))
        early = self.deck([dict(self.LADDER[0], stop='cap')] + self.LADDER[1:3])
        self.assertIn('Why 1 stops the ladder (cap) but Why 2 climbs past it', ' | '.join(carousel_check.problems(early)))
        for stop in carousel_check.LADDER_STOPS:
            self.assertEqual(carousel_check.problems(self.deck(self.LADDER[:1] + [dict(self.LADDER[1], stop=stop)])), [], stop)

    def test_a_source_on_every_why_passes(self):
        self.assertEqual(carousel_check.problems(self.deck(self.LADDER)), [])
        linked = [dict(w, source={'label': 'Faros AI', 'url': 'https://faros.ai/report'}) for w in self.LADDER[:3]]
        self.assertEqual(carousel_check.problems(self.deck(linked)), [])

    def test_a_why_without_its_source_fails(self):
        whys = json.loads(json.dumps(self.LADDER))
        whys[2]['source'] = ''
        del whys[4]['source']
        found = ' | '.join(carousel_check.problems(self.deck(whys)))
        self.assertIn('Why 3 names no source', found)
        self.assertIn('Why 5 names no source', found)
        self.assertNotIn('Why 1 names no source', found)

    def test_three_to_seven_whys_and_an_honest_stop(self):
        self.assertEqual(carousel_check.problems(self.deck(self.LADDER[:3])), [])
        self.assertIn('fewer than 3 needs the "stop"', ' | '.join(carousel_check.problems(self.deck(self.LADDER[:2]))))
        stopped = self.deck(self.LADDER[:1] + [dict(self.LADDER[1], stop='evidence_exhausted')])
        self.assertEqual(carousel_check.problems(stopped), [])
        self.assertIn('8 Whys: merge sub-steps', ' | '.join(carousel_check.problems(self.deck(self.LADDER + self.LADDER[:3]))))
        self.assertIn('climb the Whys before writing a card', ' | '.join(carousel_check.problems(self.deck([]))))
        thin = self.deck([dict(w, a='Yes.') for w in self.LADDER])
        self.assertIn('Why 1 has no answer of at least 4 words', ' | '.join(carousel_check.problems(thin)))

    def test_a_carousel_deck_1_still_validates_without_sources(self):
        self.assertEqual(FOLLOWABLE['schema'], 'carousel-deck/1')
        self.assertTrue(all('source' not in w for w in FOLLOWABLE['five_whys']))
        self.assertEqual(carousel_check.problems(FOLLOWABLE), [])
        deck = json.loads(json.dumps(FOLLOWABLE))
        deck['schema'] = 'carousel-deck/3'
        self.assertIn('not a carousel-deck/1 or carousel-deck/2 file', carousel_check.problems(deck))


if __name__ == '__main__':
    unittest.main()
