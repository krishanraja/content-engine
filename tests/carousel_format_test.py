"""The v5 3-second carousel format, enforced (config/carousel-format.json; scripts/carousel_format.py, carousel_check.py,
carousel_make.py). Krish, 26 Nov 2026, relayed verbatim: "Tell the Content-engine story intelligence for makeyourmindup
v5 session that it is to enforce carousel formatting." Production sessions do not "just randomly go off piste": every
rule below refuses (and so fails the run), never warns. The worked example is CAROUSEL-FORMAT.md's example A."""
import copy
import hashlib
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import carousel_check  # noqa: E402
import carousel_format as cf  # noqa: E402
import carousel_make  # noqa: E402

FMT = cf.rules()


def el(words, px=96, **kw):
    return dict(words=words, px=px, **kw)


def inside(template, glance, kind='photo', share=0.6, **text):
    return {'template': template, 'text': {'glance': el(glance), **text}, 'visual': {'kind': kind, 'share': share}}


def piece_deck():
    """CAROUSEL-FORMAT.md worked example A, "Why did pop songs get shorter?" (set piece, 6 slides)."""
    return {'schema': 'carousel-deck/3', 'piece': 'docs/plans/2026-11-27', 'set': 'piece', 'slides': [
        {'template': 'carousel-cover', 'made_by': 'make_covers.py', 'title_shape': 'who_did_what',
         'text': {'headline': el("Spotify's 30-second rule is shrinking song intros.", 130),
                  'dek': el('Why did pop songs get shorter?', 96)},
         'visual': {'kind': 'photo', 'share': 0.6}, 'wordmark': 'V4'},
        inside('carousel-chart', '30 seconds.', 'number', 0.55, source=el('Spotify for Artists', 34)),
        inside('carousel-document', 'Skip early and it never counts.', 'screenshot'),
        inside('carousel-why-3', 'Songs now open on the hook.', label=el('SO', 40)),
        inside('carousel-why-1', 'Your skip decides who gets paid.', label=el('FOR YOU', 40)),
        {'template': 'carousel-close', 'text': {'takeaway': el('Hook them in 30 seconds or lose the play.', 90, lines=2),
                                                'site': el('makeyourmindup.ai', 34)},
         'payoff': 'lose the play', 'wordmark': 'S3h'}]}


def good_news_deck(items=4):
    names = ['carousel-good-news-item', 'carousel-good-news-item-2', 'carousel-good-news-item-3', 'carousel-good-news-item-4']
    lines = ['A singer got her voice back with AI.', 'Glide steers blind fans to their seats.',
             "Google's glasses read small print aloud.", 'A drummer scores games with his own model.']
    d = {'schema': 'carousel-deck/3', 'piece': 'docs/plans/2026-11-28', 'set': 'good-news', 'slides': [
        {'template': 'carousel-good-news-cover', 'made_by': 'make_covers.py', 'title_shape': 'order_with_number',
         'text': {'headline': el('AI helped people sing, play and get around.', 130)},
         'visual': {'kind': 'photo', 'share': 0.7}, 'wordmark': 'V4'}]
        + [inside(names[i % 4], lines[i % 4]) for i in range(items)]
        + [{'template': 'carousel-good-news-close', 'text': {'takeaway': el('Sing, play, move: four wins this week.', 90, lines=2),
                                                             'site': el('makeyourmindup.ai', 34)},
            'payoff': 'four wins', 'wordmark': 'S3h'}]}
    return d


def howto_deck(steps=3):
    d = {'schema': 'carousel-deck/3', 'piece': 'docs/plans/2026-11-24', 'set': 'how-to', 'slides': [
        {'template': 'carousel-howto-cover', 'made_by': 'make_covers.py', 'title_shape': 'statement_twist',
         'text': {'headline': el('Your stems are for sale. Claude files takedowns.', 130)},
         'visual': {'kind': 'screenshot', 'share': 0.6}, 'wordmark': 'V4'}]
        + [{'template': 'carousel-howto-step', 'text': {'glance': el(f'0{n} Find every site selling your stems.'),
                                                        'counter': el(f'0{n} / 0{steps}', 34)},
            'visual': {'kind': 'screenshot', 'share': 0.6}} for n in range(1, steps + 1)]
        + [{'template': 'carousel-simple-advice-close', 'text': {'takeaway': el('Fewer sites selling you, one form at a time.', 90, lines=2),
                                                                'site': el('makeyourmindup.ai', 34)},
            'payoff': 'one form at a time', 'wordmark': 'S3h'}]}
    return d


def said(deck, lib=None):
    return ' | '.join(cf.deck_problems(deck, FMT, lib))


class TheFormatPasses(unittest.TestCase):
    def test_the_worked_examples_pass(self):
        for name, deck in (('piece', piece_deck()), ('good-news', good_news_deck()), ('how-to', howto_deck())):
            self.assertEqual(cf.deck_problems(deck, FMT, None), [], name)

    def test_the_deck_check_is_the_format(self):
        self.assertEqual(carousel_check.problems(piece_deck()), [])


class SlidesAndOrder(unittest.TestCase):
    def test_four_to_seven_slides(self):
        d = howto_deck(steps=2)
        self.assertIn('2 inside slides: 3 to 5', said(d))
        long = howto_deck(steps=6)
        self.assertIn('8 slides: a carousel is 4 to 7', said(long))
        self.assertIn('6 inside slides: 3 to 5', said(long))

    def test_the_piece_carousel_is_six_slides_in_the_registry_order(self):
        d = piece_deck()
        d['slides'][1], d['slides'][2] = d['slides'][2], d['slides'][1]
        self.assertIn('the piece set runs carousel-chart, carousel-document, carousel-why-3, carousel-why-1', said(d))
        short = piece_deck()
        del short['slides'][3]
        self.assertIn('the piece carousel is 6', said(short))

    def test_a_set_not_in_the_registry_or_another_template_is_refused(self):
        self.assertIn('is not a Library carousel set', said(dict(piece_deck(), set='covers')))
        d = piece_deck()
        d['slides'][2]['template'] = 'carousel-why-2'
        self.assertIn('never another template or order', said(d))
        d = piece_deck()
        d['slides'][-1]['template'] = 'carousel-landing'
        self.assertIn('the piece set closes on carousel-close', said(d))

    def test_the_first_slide_comes_only_from_make_covers(self):
        d = piece_deck()
        d['slides'][0]['made_by'] = 'codex'
        self.assertIn('slide 1 comes from make_covers.py', said(d))

    def test_the_good_news_roundup_carries_four(self):
        self.assertEqual(cf.deck_problems(good_news_deck(4), FMT, None), [])
        self.assertIn('never another template or order', said(good_news_deck(3)))
        self.assertIn('good-news items: the roundup carries 4', said(good_news_deck(3)))

    def test_the_quiz_question_is_the_one_question_slide(self):
        d = {'schema': 'carousel-deck/3', 'piece': 'p', 'set': 'quiz', 'slides': [
            dict(piece_deck()['slides'][0], template='carousel-simple-advice-cover'),
            inside('carousel-quiz-question', 'Which label signed the AI band?'),
            inside('carousel-quiz-answer', 'Universal signed the AI band first.'),
            inside('carousel-quiz-question', 'Which club scouts with AI now?'),
            inside('carousel-quiz-answer', 'Brentford scouts players with a model.'),
            dict(howto_deck()['slides'][-1])]}
        self.assertEqual(cf.deck_problems(d, FMT, None), [])
        d['slides'][2]['text']['glance']['words'] = 'Was it Universal?'
        self.assertIn('slide 3: the glance asks a question', said(d))


class TheCover(unittest.TestCase):
    def cover(self, **text):
        d = piece_deck()
        d['slides'][0]['text'].update(text)
        return said(d)

    def test_ten_words_fifty_characters_and_120_px(self):
        self.assertIn('the cover headline has 11 words; at most 10', self.cover(headline=el('One two three four five six seven eight nine ten eleven', 130)))
        self.assertIn('the cover headline is 51 characters', self.cover(headline=el("Spotify's 30-second rules are shrinking song intros", 130)))
        self.assertIn('the cover headline is 110 px; at least 120 px', self.cover(headline=el('Spotify shrank the intro.', 110)))
        self.assertIn('the dek has 9 words', self.cover(dek=el('One two three four five six seven eight nine', 96)))

    def test_his_title_shapes_one_hero_and_the_wordmark(self):
        d = piece_deck()
        d['slides'][0].pop('title_shape')
        d['slides'][0]['wordmark'] = None
        d['slides'][0]['visuals'] = 2
        found = said(d)
        self.assertIn('one of his title shapes', found)
        self.assertIn('the cover carries the V4 wordmark', found)
        self.assertIn('the cover is one hero visual plus the wordmark', found)


class TheInsideSlides(unittest.TestCase):
    def test_one_glance_line_of_eight_words_at_96_px(self):
        d = piece_deck()
        d['slides'][2]['text']['glance'] = el('Skip early in the song and the play never counts.')
        self.assertIn('slide 3: the glance line has 10 words; at most 8', said(d))
        d = piece_deck()
        d['slides'][2]['text']['glance'] = el('Skip early and the play never counts.', 90)
        self.assertIn('slide 3: the glance line is 90 px; at least 96 px', said(d))
        d = piece_deck()
        del d['slides'][2]['text']['glance']
        self.assertIn('slide 3: no glance', said(d))

    def test_fifteen_words_a_slide_and_fifty_across_the_inside(self):
        d = piece_deck()
        d['slides'][3]['text']['support'] = el('Writers cut the intro so the hook lands before the skip.', 44)
        self.assertIn('slide 4: 18 words on the slide; at most 15', said(d))
        d = piece_deck()
        for s in d['slides'][1:-1]:
            s['text']['support'] = el('Labels and writers changed the whole song shape this year.', 44)
            s['text'].pop('label', None)
        self.assertIn('words across the inside slides: at most 50', said(d))

    def test_a_statement_never_a_question(self):
        d = piece_deck()
        d['slides'][4]['text']['glance'] = el('Does your skip decide who gets paid?')
        self.assertIn('slide 5: the glance asks a question', said(d))

    def test_one_dominant_visual_on_half_the_slide(self):
        d = piece_deck()
        d['slides'][3]['visual']['share'] = 0.4
        self.assertIn('slide 4: the visual fills 0.4 of the slide; at least 0.5', said(d))
        d = piece_deck()
        d['slides'][3]['visuals'] = 2
        self.assertIn('slide 4: 2 visuals; one dominant visual a slide', said(d))
        d = piece_deck()
        del d['slides'][3]['visual']
        self.assertIn('slide 4: one dominant visual', said(d))

    def test_slide_two_stands_alone(self):
        d = piece_deck()
        d['slides'][1]['text']['glance'] = el('This only counts after 30 seconds.')
        self.assertIn('slide 2 opens on "this"', said(d))

    def test_no_role_the_format_does_not_name(self):
        d = piece_deck()
        d['slides'][2]['text']['badge'] = el('panel-checked', 34)
        found = said(d)
        self.assertIn('"badge" is not a inside role', found)


class TheClose(unittest.TestCase):
    def close(self, **kw):
        d = piece_deck()
        d['slides'][-1].update(kw)
        return said(d)

    def test_the_takeaway_close(self):
        d = piece_deck()
        del d['slides'][-1]['text']['takeaway']
        self.assertIn('slide 6: no takeaway', said(d))
        self.assertIn('a carousel with no takeaway close is refused', said(d))
        long = {'takeaway': el('Hook every listener in thirty seconds or lose it', 90, lines=2), 'site': el('makeyourmindup.ai', 34)}
        self.assertIn('the takeaway is 48 characters; at most 44', self.close(text=long))
        three = {'takeaway': el('Hook them in 30 seconds or lose the play.', 90, lines=3), 'site': el('makeyourmindup.ai', 34)}
        self.assertIn('the takeaway runs 3 lines', self.close(text=three))
        self.assertIn('names its payoff, the words set in mint', self.close(payoff='the skip'))
        self.assertIn('the close carries the S3h wordmark', self.close(wordmark='V4'))

    def test_never_follow_for_more(self):
        text = {'takeaway': el('Follow for more', 90, lines=1), 'site': el('makeyourmindup.ai', 34)}
        self.assertIn('"follow for more": the close never asks to follow', self.close(text=text, payoff='more'))


class TheFloorAndTheWords(unittest.TestCase):
    def test_nothing_below_34_px(self):
        d = piece_deck()
        d['slides'][1]['text']['source'] = el('Spotify for Artists', 33)
        self.assertIn('slide 2: source is set at 33 px; nothing goes below 34 px anywhere', said(d))

    def test_a_size_is_given_until_the_library_is_here(self):
        d = piece_deck()
        del d['slides'][1]['text']['source']['px']
        self.assertIn('the v5 Library is not on this checkout yet, so give its px', said(d))

    def test_badges_names_and_house_marks_are_refused(self):
        for words, why in (('Panel-checked by AI', 'no badges'), ('Krish says hook them', 'never names him'),
                           ('Hook them, then mind/make', 'never names mind/make'), ('Hook them — fast', 'no em dashes'),
                           ('Hook them fast!', 'no exclamation marks')):
            d = piece_deck()
            d['slides'][3]['text']['glance'] = el(words)
            self.assertIn(why, said(d), words)

    def test_how_to_one_step_a_slide_with_its_screenshot(self):
        d = howto_deck()
        d['slides'][1]['visual']['kind'] = 'photo'
        self.assertIn('slide 2: a how-to step shows the real screenshot', said(d))
        d = howto_deck()
        d['slides'][2]['text']['prompt'] = el('"Find every site that sells me"', 40)
        self.assertIn('slide 3: the overlay prompt has 6 words; at most 5', said(d))
        d = howto_deck()
        d['slides'][2]['steps'] = ['one', 'two']
        self.assertIn('2 steps on one slide; one step a slide', said(d))


def fake_library(**slot_over):
    """library.json's shape: the config's sets, and slots for the roles the deck uses."""
    items = {t for s in FMT['sets'].values() for t in [s['cover'], s['close'], *s['inside']]}
    lib = {'carousel_sets': copy.deepcopy(FMT['sets']), 'items': []}
    for t in sorted(items):
        slots = {}
        for role, by in FMT['library_slots'].items():
            if not role.startswith('_') and t in by:
                slots[by[t]] = {'max_chars': {'headline': 50, 'glance': 44, 'takeaway': 44}[role], 'max_lines': 2,
                                'min_size_px': {'headline': 120, 'glance': 96, 'takeaway': 84}[role]}
        slots.update(slot_over.get(t, {}))
        lib['items'].append({'id': t, 'slots': slots})
    return lib


class TheLibrarySlotLimits(unittest.TestCase):
    def test_a_slot_size_stands_in_for_px_and_the_stricter_limit_wins(self):
        d = piece_deck()
        del d['slides'][2]['text']['glance']['px']
        self.assertEqual(cf.deck_problems(d, FMT, fake_library()), [])
        tight = fake_library(**{'carousel-document': {'headline_1': {'max_chars': 20, 'max_lines': 1, 'min_size_px': 96}}})
        self.assertIn('glance is 31 characters; its Library slot headline_1 holds 20', said(d, tight))

    def test_the_rows_and_the_library_agree_or_a_test_fails(self):
        self.assertEqual(cf.library_disagreements(FMT, fake_library()), [])
        loose = fake_library(**{'carousel-cover': {'headline_1': {'max_chars': 66, 'max_lines': 3, 'min_size_px': 33}},
                                'carousel-close': {'label_1': {'max_chars': 32, 'max_lines': 1, 'min_size_px': 26}}})
        found = ' | '.join(cf.library_disagreements(FMT, loose))
        self.assertIn('carousel-cover.headline_1 (headline) holds 66 characters; the format allows 50', found)
        self.assertIn('carousel-cover.headline_1 (headline) may shrink to 33 px; the format floor is 120 px', found)
        self.assertIn('carousel-close.label_1 may shrink to 26 px; nothing goes below 34 px', found)
        other = fake_library()
        other['carousel_sets']['piece']['inside'].append('carousel-why-2')
        self.assertIn('carousel_sets differ', ' | '.join(cf.library_disagreements(FMT, other)))

    def test_this_checkouts_library_agrees_with_the_rows(self):
        lib = cf.library(FMT)
        if lib is None:
            self.assertIn('the v5 Library is not on this checkout yet', cf.library_note(None, FMT))
            return
        found = cf.library_disagreements(FMT, lib)
        known = FMT['library_shrink_known']['lines']
        self.assertEqual([x for x in found if x not in known], [], 'a disagreement not yet named in library_shrink_known')
        self.assertEqual([x for x in known if x not in found], [], 'a known disagreement the Library has fixed: take it off the list')


def fake_root(tmp):
    root = Path(tmp) / 'root'
    for script in ('scripts/library/make_piece.py', 'scripts/covers/make_covers.py'):
        (root / script).parent.mkdir(parents=True, exist_ok=True)
        (root / script).write_text('')
    return root


def fake_run(out, slides=6, cover_bytes=b'cover', record_sha=None):
    calls = []

    def run(argv, cwd=None, capture_output=True, text=True):
        calls.append([str(a) for a in argv])
        script = str(argv[1])
        folder = out / 'carousel'
        folder.mkdir(parents=True, exist_ok=True)
        if script.endswith('make_piece.py'):
            for n in range(1, slides + 1):
                (folder / f'slide-{n:02d}.png').write_bytes(f'slide {n}'.encode())
        else:
            (folder / 'slide-01.png').write_bytes(cover_bytes)
            sha = record_sha or hashlib.sha256(cover_bytes).hexdigest()
            (out / 'covers.json').write_text(json.dumps({'outputs': [{'file': 'carousel/slide-01.png', 'sha256': sha}]}))
        return SimpleNamespace(returncode=0, stdout='', stderr='')
    return run, calls


class TheOneMakeRoute(unittest.TestCase):
    def deck_file(self, tmp, deck=None):
        p = Path(tmp) / 'deck.json'
        p.write_text(json.dumps(deck or piece_deck()), encoding='utf-8')
        return p

    def test_it_refuses_plainly_while_the_library_is_absent(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(carousel_make.Refused) as r:
                carousel_make.make('docs/plans/2026-11-27', 'piece', self.deck_file(tmp), Path(tmp) / 'out',
                                   run=lambda *a, **k: self.fail('nothing is drawn'), root=Path(tmp))
        self.assertEqual(r.exception.code, 2)
        self.assertIn('the v5 Library is not on this checkout yet', str(r.exception))

    def test_a_deck_that_breaks_the_format_draws_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = piece_deck()
            d['slides'][4]['text']['glance'] = el('Does your skip decide who gets paid?')
            with self.assertRaises(carousel_make.Refused) as r:
                carousel_make.make('docs/plans/2026-11-27', 'piece', self.deck_file(tmp, d), Path(tmp) / 'out',
                                   run=lambda *a, **k: self.fail('nothing is drawn'), root=fake_root(tmp))
        self.assertEqual(r.exception.code, 1)
        self.assertIn('asks a question', str(r.exception))
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(carousel_make.Refused) as r:
                carousel_make.make('docs/plans/2026-11-27', 'good-news', self.deck_file(tmp), Path(tmp) / 'out',
                                   run=lambda *a, **k: self.fail('nothing is drawn'), root=fake_root(tmp))
        self.assertIn('this run makes "good-news"', str(r.exception))

    def test_it_calls_the_library_by_path_and_writes_a_passing_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'out'
            run, calls = fake_run(out)
            rec = carousel_make.make('docs/plans/2026-11-27', 'piece', self.deck_file(tmp), out, run=run, root=fake_root(tmp))
            self.assertTrue(rec['passed'])
            self.assertEqual(len(rec['slides']), 6)
            self.assertEqual((rec['made_by'], rec['set']), ('carousel_make', 'piece'))
            self.assertEqual(rec['first_slide_sha256'], hashlib.sha256(b'cover').hexdigest())
            self.assertTrue(rec['deck_sha256'])
            self.assertTrue(json.loads((out / 'carousel-receipt.json').read_text())['passed'])
        self.assertEqual([c[1] for c in calls], ['scripts/library/make_piece.py', 'scripts/covers/make_covers.py'])
        self.assertEqual(calls[0][2:5], ['docs/plans/2026-11-27', '--set', 'piece'])

    def test_drawn_slides_outside_the_count_or_a_cover_not_from_make_covers_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'out'
            run, _ = fake_run(out, slides=8)
            with self.assertRaises(carousel_make.Refused) as r:
                carousel_make.make('docs/plans/2026-11-27', 'piece', self.deck_file(tmp), out, run=run, root=fake_root(tmp))
            self.assertIn('8 slides drawn: a carousel is 4 to 7', str(r.exception))
            self.assertFalse(json.loads((out / 'carousel-receipt.json').read_text())['passed'])
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'out'
            run, _ = fake_run(out, record_sha='0' * 64)
            with self.assertRaises(carousel_make.Refused) as r:
                carousel_make.make('docs/plans/2026-11-27', 'piece', self.deck_file(tmp), out, run=run, root=fake_root(tmp))
            self.assertIn('is not the slide covers.json records', str(r.exception))

    def test_a_library_refusal_fails_the_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            def run(argv, **kw):
                return SimpleNamespace(returncode=1, stdout='REFUSED headline_1 over max_chars', stderr='')
            with self.assertRaises(carousel_make.Refused) as r:
                carousel_make.make('docs/plans/2026-11-27', 'piece', self.deck_file(tmp), Path(tmp) / 'out', run=run,
                                   root=fake_root(tmp))
        self.assertIn('the Library refused it', str(r.exception))


class NoRouteBypassesTheCheck(unittest.TestCase):
    """Every content-engine carousel route goes through carousel_check: the one make route, the asset routes, the ve
    card kind, the make-flow prompt and the skills. Anything else that would draw a carousel refuses."""

    def test_only_the_make_route_runs_the_library_carousel_command(self):
        runners = []
        for f in (ROOT / 'scripts').rglob('*.py'):
            text = f.read_text(encoding='utf-8', errors='replace')
            if f.parent == ROOT / 'scripts' / 'library':
                continue  # the Library's own command, not a runner of it
            if 'make_piece.py' in text and re.search(r'\bsubprocess\b', text):
                runners.append(f.relative_to(ROOT).as_posix())
        # cards.py names the command only in the refusal of its retired carousel kind (asserted below).
        self.assertEqual(sorted(runners), ['scripts/carousel_make.py', 'scripts/post-pack/asset_routes.py', 'scripts/velib/cards.py'])

    def test_the_make_route_checks_the_deck_before_it_draws(self):
        src = (ROOT / 'scripts' / 'carousel_make.py').read_text(encoding='utf-8')
        self.assertIn('import carousel_check', src)
        self.assertLess(src.index('carousel_check.problems(deck)'), src.index("_run(_argv(route['carousel']"))

    def test_every_carousel_asset_kind_routes_through_the_make_route(self):
        import asset_routes
        routes = asset_routes.load()
        with tempfile.TemporaryDirectory() as tmp:
            root = fake_root(tmp)
            for row in routes['kinds']:
                if row['status'] == 'route' and row.get('command') == 'carousel':
                    argv = asset_routes.command_for(routes, row['kind'], 'p', 'o', root=root, deck='d.json')
                    self.assertEqual(argv[1], 'scripts/carousel_make.py', row['kind'])

    def test_the_codex_carousel_card_and_the_old_decks_refuse(self):
        src = (ROOT / 'scripts' / 'velib' / 'cards.py').read_text(encoding='utf-8')
        self.assertIn("if kind == 'carousel':\n        sys.exit(CAROUSEL_RETIRED)", src)
        self.assertIn('is retired', carousel_check.problems({'schema': 'carousel-deck/1', 'cards': []})[0])

    def test_the_make_prompt_and_the_skills_name_the_route(self):
        for path in ('apps/control-plane/api/board/_makeRoute.ts', '.agents/skills/carousel/SKILL.md',
                     '.claude/skills/carousel/SKILL.md', '.agents/skills/make-piece/references/audience-rules.md'):
            text = (ROOT / path).read_text(encoding='utf-8')
            self.assertIn('scripts/carousel_make.py', text, path)
            self.assertNotIn('carousel-deck/1', text, path)


class APublishReadinessCheck(unittest.TestCase):
    """The manifest draft is what his Approve for publish binds: a carousel that fails the format is not approvable."""

    def spec(self, n=6, passed=True, shas=None):
        import piece_manifest
        assets = [{'name': f'carousel_slide_{i}', 'drive_id': 'a' * 25, 'sha256': f'{i:x}' * 64} for i in range(1, n + 1)]
        slides = shas or [a['sha256'] for a in assets]
        rec = {'schema': 'carousel-receipt/1', 'passed': passed, 'problems': [] if passed else ['slide 3: no glance'],
               'made_by': 'carousel_make', 'set': 'piece', 'deck_sha256': 'd' * 64, 'first_slide_sha256': slides[0],
               'slides': [{'sha256': s} for s in slides]}
        return piece_manifest, {'piece_id': '11111111-2222-4333-8444-555555555555',
                                'qa': {'state': 'passed', 'checked_at': '2026-11-30T07:00:00Z'}, 'assets': assets,
                                'channels': {'instagram': {'words': 'w', 'alt_text': None, 'assets': [a['name'] for a in assets]}},
                                'carousel_receipt': rec}

    def test_a_passing_receipt_for_these_slides_is_approvable(self):
        pm, spec = self.spec()
        self.assertEqual(pm.carousel_problems(spec), [])
        self.assertNotIn('carousel_receipt', pm.draft(spec))

    def test_no_receipt_a_failed_one_the_wrong_slides_or_the_wrong_count_is_refused(self):
        pm, spec = self.spec()
        del spec['carousel_receipt']
        with mock.patch.object(cf, 'absent_refusal', return_value=None):
            with self.assertRaises(pm.ManifestError) as r:
                pm.draft(spec)
        self.assertIn('the carousel is not approvable', str(r.exception))
        self.assertIn('carries no receipt', str(r.exception))
        pm, spec = self.spec(passed=False)
        self.assertIn('a carousel that fails is not approvable', ' | '.join(pm.carousel_problems(spec)))
        pm, spec = self.spec(shas=['0' * 64] * 6)
        self.assertIn('not for these slides', ' | '.join(pm.carousel_problems(spec)))
        pm, spec = self.spec(n=8)
        self.assertIn('8 carousel slides: a carousel is 4 to 7', ' | '.join(pm.carousel_problems(spec)))

    def test_with_the_library_absent_the_refusal_says_so(self):
        pm, spec = self.spec()
        del spec['carousel_receipt']
        with mock.patch.object(cf, 'absent_refusal', return_value='the v5 Library is not on this checkout yet: x'):
            found = pm.carousel_problems(spec)
        self.assertEqual(len(found), 1)
        self.assertIn('the v5 Library is not on this checkout yet', found[0])

    def test_a_deckless_receipt_or_one_from_another_maker_is_refused(self):
        for drop in ('deck_sha256', 'set', 'made_by', 'first_slide_sha256'):
            pm, spec = self.spec()
            spec['carousel_receipt'][drop] = None
            self.assertTrue(pm.carousel_problems(spec), drop)
        pm, spec = self.spec()
        spec['carousel_receipt']['made_by'] = 'carousel_check'
        self.assertIn('not written by python3 scripts/carousel_make.py', ' | '.join(pm.carousel_problems(spec)))
        with tempfile.TemporaryDirectory() as tmp:
            paths = []
            for n in range(1, 6):
                f = Path(tmp) / f'slide-{n:02d}.png'
                f.write_bytes(b'x')
                paths.append(str(f))
            out = Path(tmp) / 'r.json'
            self.assertEqual(carousel_check.main(['--cards', '--receipt', str(out)] + paths), 2)
            self.assertFalse(out.exists(), 'no deck, no receipt')

    def test_a_spec_with_no_carousel_is_untouched(self):
        pm, spec = self.spec()
        spec['assets'], spec['carousel_receipt'] = [], None
        self.assertEqual(pm.carousel_problems(spec), [])


class TheBoardsCarouselOptions(unittest.TestCase):
    """The Saturday good news and the off-day carousel options are held to the format before they are offered (code
    carousel_format, a gate code), from the board config/carousel-format.json names."""

    def findings(self, option, day='tue', week='2026-11-30'):
        import idea_checks as ic
        return [f['line'] for f in ic.carousel_format_findings({'offdays': {day: [option]}}, week)]

    def option(self, n=6, **kw):
        cards = [{'words': 'Spotify shrank the song intro', 'picture': 'p'}] + [
            {'words': 'A play only counts after 30 seconds.', 'picture': 'p'}] * (n - 2) + [
            {'words': 'Hook them in 30 seconds or lose the play.', 'picture': 'p'}]
        return dict({'id': 'intros', 'kind': 'explainer', 'set': 'piece', 'cards': cards}, **kw)

    def test_a_carousel_option_in_the_format_passes_and_the_gate_holds_the_rest(self):
        import idea_checks as ic
        self.assertIn('carousel_format', ic.GATE_CODES)
        self.assertEqual(self.findings(self.option()), [])
        self.assertIn('has 8 cards; a carousel is 4 to 7', ' | '.join(self.findings(self.option(8))))
        self.assertIn('has 3 cards; a carousel is 4 to 7', ' | '.join(self.findings(self.option(3))))
        self.assertIn('names set "covers"', ' | '.join(self.findings(self.option(set='covers'))))

    def test_the_cards_words_hold_the_format(self):
        o = self.option()
        o['cards'][0]['words'] = 'One two three four five six seven eight nine ten eleven'
        o['cards'][2]['words'] = 'Does your skip decide who gets paid?'
        o['cards'][-1]['words'] = 'Follow for more'
        found = ' | '.join(self.findings(o))
        self.assertIn('card 1 has 11 words; the cover headline is 10 or fewer', found)
        self.assertIn('card 3 asks a question', found)
        self.assertIn('card 6 says "follow for more"', found)

    def test_the_saturday_good_news_and_earlier_boards(self):
        gn = {'id': 'goodnews', 'weekly': 'good_news', 'cards': [{'words': 'w'}] * 9}
        self.assertIn('off-sat-goodnews has 9 cards', ' | '.join(self.findings(gn, day='sat')))
        self.assertEqual(self.findings(gn, day='sat', week='2026-11-23'), [])
        self.assertEqual(self.findings({'id': 'm', 'kind': 'meme', 'template': {}}), [], 'a meme template is not a carousel')

    def test_good_news_carries_four_and_a_fifth_is_a_spare(self):
        import week_plan
        story = {'headline': 'h', 'what': 'w', 'why': 'y', 'date': '2026-11-26', 'source': {'label': 'l', 'url': 'https://e.com'},
                 'media': {'kind': 'photo', 'url': 'https://e.com/a.jpg'}}
        self.assertEqual(week_plan.STORY_COUNT, FMT['good_news']['items'])
        self.assertIn('is a list of 4 stories', ' | '.join(week_plan.story_problems([story] * 3)))
        self.assertIn('is a list of 4 stories', ' | '.join(week_plan.story_problems([story] * 6)))


if __name__ == '__main__':
    unittest.main()
