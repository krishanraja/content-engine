"""Every article figure passes its three checks before anyone sees it, and the renderer draws none that fails.

Krish, 19 Nov 2026 (Fri 20 production session): "these dont look visually good enough and they have the wrong brand mark.
Are these to go inside, in line, in the Substack article? If so, we don't even need the brand mark."
config/failures.json article-figure-typed-mark-and-word-cards; scripts/pages/figure_check.py; config/article-figures.json.

Run: python3 tests/article_figure_test.py
"""
import hashlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
import figure_check  # noqa: E402

FRI20 = ROOT / 'tests' / 'fixtures' / 'article-figures' / 'fri20'
ARTICLE = 'A family was sent a hospital bill for $195,000. It came down to $33,000 after they read it line by line.\n'
HEAD = '<!doctype html><meta charset="utf-8"><meta name="figure-article" content="article.md">'


def figure(body, form='scale', kind=None, article=ARTICLE):
    d = Path(tempfile.mkdtemp())
    meta = (f'<meta name="figure-form" content="{form}">' if form else '') + (f'<meta name="figure-kind" content="{kind}">' if kind else '')
    (d / 'article.md').write_text(article, encoding='utf-8')
    (d / 'fig.html').write_text(HEAD + meta + f'<div class="wrap">{body}</div>', encoding='utf-8')
    return d / 'fig.html'


GOOD = '<h1>The bill came down</h1><div class="lab">The hospital bill</div><div class="bar"><span class="v">$195,000</span></div><div class="lab">After they read it line by line</div><div class="bar"><span class="v">$33,000</span></div>'


class TheMark(unittest.TestCase):
    def test_an_inline_figure_with_a_typed_mark_is_refused(self):
        probs = figure_check.check(figure(GOOD + '<div class="mark">makeyourmindup</div>'))
        self.assertTrue(any('mark element' in p for p in probs), probs)
        self.assertTrue(any('typed words' in p for p in probs), probs)

    def test_an_inline_figure_with_a_wordmark_image_is_refused(self):
        probs = figure_check.check(figure(GOOD + '<img src="brand/makeyourmindup-wordmark.png">'))
        self.assertTrue(any('inline Substack figure carries no mark' in p for p in probs), probs)

    def test_the_same_figure_without_a_mark_passes(self):
        self.assertEqual(figure_check.check(figure(GOOD)), [])

    def test_a_share_card_takes_only_the_palettes_own_wordmark_by_its_sha256(self):
        fig = figure(GOOD + '<img src="wordmark.png">', kind='share-card')
        (fig.parent / 'wordmark.png').write_bytes(b'a typed lookalike')
        self.assertTrue(any("not the palette's own image" in p for p in figure_check.check(fig)))
        real = hashlib.sha256(b'the palette drawing').hexdigest()
        (fig.parent / 'wordmark.png').write_bytes(b'the palette drawing')
        with mock.patch.object(figure_check, 'palette_mark_shas', return_value={real}):
            self.assertEqual(figure_check.check(fig), [])
        # Typed, even on a share card, never.
        self.assertTrue(figure_check.check(figure(GOOD + '<div class="mark">makeyourmindup</div>', kind='share-card')))


class PictureFirst(unittest.TestCase):
    def test_a_figure_with_no_form_is_refused(self):
        probs = figure_check.check(figure(GOOD, form=None))
        self.assertTrue(any('no picture form' in p for p in probs), probs)

    def test_a_card_of_words_is_refused(self):
        words = ' '.join(['they read the hospital bill line by line'] * 6)
        probs = figure_check.check(figure(f'<h1>The bill came down</h1><p class="small">{words}</p>', article=ARTICLE + words))
        self.assertTrue(any('words of running text' in p for p in probs), probs)

    def test_an_unknown_form_is_refused(self):
        self.assertTrue(figure_check.check(figure(GOOD, form='poster')))


class NothingTheArticleDoesNotSay(unittest.TestCase):
    """The Fri 20 figures as they reached Krish: reader test 2 found what they said that the article did not."""

    def test_fri20_billed_twice_is_refused(self):
        probs = figure_check.check(FRI20 / 'bill-found.html')
        self.assertTrue(any('"bill … twice"' in p for p in probs), probs)

    def test_fri20_september_2024_is_refused(self):
        probs = figure_check.check(FRI20 / 'hindsight.html')
        self.assertTrue(any('september 2024' in p for p in probs), probs)

    def test_fri20_a_subtitle_that_does_not_fit_is_refused(self):
        probs = figure_check.check(FRI20 / 'skeletons.html')
        self.assertTrue(any('"bite"' in p for p in probs), probs)

    def test_fri20_small_finds_passes(self):
        self.assertEqual(figure_check.check(FRI20 / 'small-finds.html'), [])

    def test_the_fixed_label_passes(self):
        fixed = (FRI20 / 'bill-found.html').read_text(encoding='utf-8')
        fixed = fixed.replace('Billed twice: about $100,000', 'Billed for a main procedure and every part: about $100,000')
        fixed = fixed.replace('Inpatient codes for emergency care', 'Inpatient codes where emergency codes applied')
        d = Path(tempfile.mkdtemp())
        shutil.copy(FRI20 / 'article.md', d / 'article.md')
        (d / 'bill-found.html').write_text(fixed, encoding='utf-8')
        self.assertEqual(figure_check.check(d / 'bill-found.html'), [])

    def test_a_number_or_date_missing_from_the_article_is_refused(self):
        probs = figure_check.check(figure(GOOD + '<div class="lab">Reported 3 March 2026</div><div class="v">$62,000</div>'))
        self.assertTrue(any('the number 62000' in p for p in probs), probs)
        self.assertTrue(any('march 3' in p for p in probs), probs)

    def test_words_inside_a_source_crop_are_the_sources_own(self):
        body = GOOD + '<div data-source-crop><p>Hospital bill slashed — other violations found, September 2024</p></div>'
        self.assertEqual(figure_check.check(figure(body)), [])

    def test_a_figure_with_no_article_named_is_refused(self):
        d = Path(tempfile.mkdtemp())
        (d / 'fig.html').write_text('<meta name="figure-form" content="scale">' + GOOD, encoding='utf-8')
        self.assertTrue(any('no article named' in p for p in figure_check.check(d / 'fig.html')))


class TheRendererAndTheHouse(unittest.TestCase):
    def test_the_renderer_never_draws_a_refused_figure(self):
        fig = figure(GOOD + '<div class="mark">makeyourmindup</div>')
        out = fig.parent / 'out.png'
        r = subprocess.run(['node', str(ROOT / 'scripts' / 'pages' / 'render_figure.mjs'), str(fig), str(out)],
                           capture_output=True, text=True, cwd=ROOT)
        self.assertEqual(r.returncode, 1, r.stderr)
        self.assertIn('mark element', r.stderr)
        self.assertFalse(out.exists())

    def test_the_house_stylesheet_offers_no_mark(self):
        self.assertNotIn('.mark{', (ROOT / 'scripts' / 'pages' / 'figure.css').read_text(encoding='utf-8'))

    def test_no_figure_page_in_the_plans_carries_a_typed_mark(self):
        typed = [str(p.relative_to(ROOT)) for p in (ROOT / 'docs' / 'plans').rglob('*.html')
                 if '<div class="mark">makeyourmindup</div>' in p.read_text(encoding='utf-8', errors='replace')]
        self.assertEqual(typed, [])


if __name__ == '__main__':
    unittest.main()
