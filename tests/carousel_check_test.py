"""The ten-second swipe (scripts/carousel_check.py; Krish, 2026-11-13: "a complete layperson is swiping through these
cards at light speed and needs to be able to follow the story within 10 seconds. This cannot ever happen again in any
future carousel."). The Git deck as it went out on 12 Nov fails; the deck redrawn on 13 Nov passes."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import carousel_check  # noqa: E402

REDRAWN = json.loads((ROOT / 'docs/plans/2026-11-09-week/git-carousel/deck.json').read_text(encoding='utf-8'))
AS_SENT = {'schema': 'carousel-deck/1', 'cards': [
    {'headline': "Its AI wrote so much code, Git couldn't keep up", 'line': "Git is the tool almost every programmer uses to save and share code.", 'picture': 'the cover scene'},
    {'headline': 'CODE CHANGES ANTHROPIC MERGED PER DAY', 'line': 'Twelve times as much, in four months. Most of it written by Claude.', 'picture': ''},
    {'headline': '7 ENGINEERS 5 MONTHS', 'line': 'They built Scion, a replacement for Git made for AI agents, with Claude writing most of its code.', 'picture': ''},
    {'headline': "IT'S NOT JUST ANTHROPIC", 'line': "Entire, GitButler and GitHub.", 'picture': ''},
    {'headline': 'THE NEXT SOFTWARE YOU BUY IS BUILT FOR ROBOTS TO USE AND PEOPLE TO CHECK.', 'line': 'Ask who your next tool was built for.', 'picture': ''}]}


class TenSecondSwipe(unittest.TestCase):
    def test_the_redrawn_git_deck_passes(self):
        self.assertEqual(carousel_check.problems(REDRAWN), [])

    def test_the_git_deck_as_sent_fails_on_each_fault(self):
        found = ' | '.join(carousel_check.problems(AS_SENT))
        self.assertIn('card 2: the headline is not a whole sentence', found)
        self.assertIn('"merged" is jargon', found)
        self.assertIn('card 3: no picture of its point', found)
        self.assertIn('card 5: the headline has 15 words', found)
        self.assertIn('fresh readers', found)

    def test_a_long_story_or_a_long_line_fails(self):
        deck = json.loads(json.dumps(REDRAWN))
        deck['cards'][2]['line'] = ' '.join(['word'] * 21)
        deck['cards'].append({'headline': 'One more card that pushes the story well past ten seconds.', 'picture': 'x'})
        found = ' | '.join(carousel_check.problems(deck))
        self.assertIn('card 3: the line under the headline has 21 words', found)
        self.assertIn('ten seconds or less', found)

    def test_jargon_explained_in_the_deck_passes(self):
        deck = json.loads(json.dumps(REDRAWN))
        deck['cards'][1]['headline'] = 'It merged 12 times more code than in May.'
        self.assertTrue(any('"merged"' in p for p in carousel_check.problems(deck)))
        deck['explains']['merged'] = 'saved into the shared copy everyone works from'
        self.assertEqual(carousel_check.problems(deck), [])


if __name__ == '__main__':
    unittest.main()
