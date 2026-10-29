"""The bar on the real files: config/reference-cuts.json and docs/production/THE_BAR.md agree, and scripts/floor.py
prints the bar whole before the rejection standards for the two video cut makers, a one-line pointer for the other
video makers, and nothing for any other maker.

Krish, 2026-10-28: "the video production quality standards for the latest Friday (AI Passports) and Monday
(character.ai) pieces are the floor for what I expect", and "the long voiceover video is still being post produced so
dont just assume that the voiceover format only has a 90sec version, you are only to look for production quality
standards". Later that day he answered the seven questions put to him; his exact words are pinned below, and question 5
stays open. Run by tests/engine-gates.test.ts.
"""
import contextlib
import io
import json
import re
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import floor  # noqa: E402

BAR = json.loads((ROOT / 'config' / 'reference-cuts.json').read_text(encoding='utf-8'))
PAGE = (ROOT / BAR['doc']).read_text(encoding='utf-8')
# The three files the study hashed on 28 October 2026. His answer pointed at the board, and the board read that night
# (23:48 UTC, read only) serves exactly these bytes on the Friday 23 and Monday 26 October tabs, so each is confirmed.
STUDIED = {
    'fri23-tall': ('voiceover', 'e0298c2f91e6a322e00d42d52da5c19fc5dade29cfce33c45a432d110bc6456e', 'confirmed'),
    'mon26-wide': ('split_screen', '14ccfef0f31e42814db4b4743d35cd75d047d95e0520171f755b9cd31b1a3294', 'confirmed'),
    'mon26-tall': ('split_screen', '39f1039c810681d1a6776b5a0c9f5f32696931cc47ea21ea4ec3f19b90888ecd', 'confirmed'),
}
BOARD = {'fri23-tall': ('2026-10-19', 'fri-short-video'), 'mon26-wide': ('2026-10-26', 'mon-video-long'),
         'mon26-tall': ('2026-10-26', 'mon-video-short')}
# His exact typed words, 28 October 2026, character for character.
GENERAL = """In general I think:
- minimal random components and labels
- good motion design
- good animation
- good visuals

Keep it simple but keep it classy and on brand. I'd stick to the brand book for now."""
ANSWERS = {
    1: "Yes I think music should be audible throughout but just lower.",
    2: ("I think that sounds better for number 2. I don't mind those labels. It's just the ones that say \"Krish's read\" "
        "or \"illustrative\" that are stupid because they add no value to the content."),
    3: "I'd stick to the brand book for now.",
    4: "Yes remove those.",
    5: "I think you need to go a bit deeper and ask me proper questions here.",
    6: "I don't really care. I think it depends on the rest of the production.",
    7: ("I think so but I'm not sure. The ones I meant are in the publish board at content.krishraja.com for last Friday "
        "and Monday, just gone."),
}
RULINGS = "## Krish's rulings, 28 October 2026"
READINGS = ('one visual idea per piece', 'one big impact', 'at most one loud transition', 'a sting opens every piece')
FULL = ('short_video', 'long_video')
POINTER = ('motion', 'captions', 'card', 'intro_outro', 'audio')
DRAFT_LINE = ("The qualities below are the engine's reading of the cuts he named. Where he ruled on 28 October, the point "
              "is marked (Krish, 28 Oct) with his words; he has not approved the rest of their wording. Follow them; only "
              "he approves them.")


def run(*args):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = floor.main(list(args))
    return code, out.getvalue()


def flat(text):
    return ' '.join(text.split())


def quality(number):
    """One quality's section of the page, by its number."""
    return PAGE.split(f'\n### {number}. ')[1].split('\n### ')[0]


def ruling_line(n):
    return next(line for line in floor.section(PAGE, RULINGS) if line.startswith(f'{n}. **'))


def items_by_n(n):
    return next(item for item in BAR['rulings']['items'] if item['n'] == n)


def bank_modules(bank):
    """Every module entry of the style bank, wherever the bank keeps its list."""
    found = []
    stack = [bank]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if 'krish_verdict' in node and 'id' in node:
                found.append(node)
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return found


def floor_only(maker):
    expected = io.StringIO()
    with contextlib.redirect_stdout(expected):
        floor.show_format(floor.load(), maker, False, 40)
    return expected.getvalue()


class TheBar(unittest.TestCase):
    def test_the_references_and_their_page_are_whole_and_agree(self):
        self.assertEqual(floor.bar_problems(BAR, PAGE), [])
        self.assertEqual(floor.bar_check(BAR), [])
        self.assertEqual([q['name'] for q in BAR['qualities']], floor.bar_headings(PAGE))
        self.assertEqual(len(BAR['qualities']), 15)
        labels = {r['label']: r['id'] for r in BAR['references']}
        moments, unread = floor.page_moments(PAGE, labels)
        self.assertEqual(unread, [])
        self.assertEqual(len(moments), len(BAR['reference_moments']))
        points, unread = floor.page_points(PAGE, labels)
        self.assertEqual(unread, [])
        self.assertEqual(set(points), {q['name'] for q in BAR['qualities']})

    def test_the_reference_files_are_the_ones_the_study_hashed_and_say_whether_they_are_the_latest(self):
        got = {r['id']: (r['format_family'], r['sha256'], r['identity']) for r in BAR['references']}
        self.assertEqual(got, STUDIED)
        for r in BAR['references']:
            # Confirmed by his words and the board check: the board week, the asset, the sha256 and when it was read.
            evidence = r['identity_evidence']
            self.assertIn(f'"{ANSWERS[7]}"', evidence, r['id'])
            self.assertEqual((r['served_from']['board_week'], r['served_from']['asset']), BOARD[r['id']])
            self.assertEqual(r['served_from']['checked_at'], '2026-10-28T23:48Z')
            for part in (*BOARD[r['id']], r['sha256'], 'GET only'):
                self.assertIn(part, evidence, r['id'])
        self.assertIn('14ccfef0f31e42814db4b4743d35cd75d047d95e0520171f755b9cd31b1a3294',
                      (ROOT / 'docs/plans/2026-10-26-monday/video/REVIEW.md').read_text(encoding='utf-8'))
        self.assertFalse(BAR['production_input'])
        for label in ('**Friday tall: confirmed.**', '**Monday tall: confirmed.**', '**Monday wide: confirmed.**'):
            self.assertIn(label, PAGE)
        # Friday tall reached Drive and the board that evening; whether he had watched it when he named the floor is not known.
        friday = next(r for r in BAR['references'] if r['id'] == 'fri23-tall')['identity_evidence']
        for text in (friday, PAGE):
            self.assertIn('21:28:54', text)
            self.assertIn('21:35:59', text)
            self.assertIn('whether he had watched this file when he first named the floor is not established', text)
        self.assertNotIn('unconfirmed', PAGE)

    def test_the_bar_is_a_draft_reading_until_he_approves_it(self):
        self.assertEqual(BAR['standing'], 'draft')
        self.assertEqual(BAR['standing_note'], DRAFT_LINE)
        self.assertLess(PAGE.index(BAR['ruling']['correction']), PAGE.index(DRAFT_LINE))
        self.assertLess(PAGE.index(DRAFT_LINE), PAGE.index('## The principle'))
        self.assertNotIn('## Open questions for Krish', PAGE)
        self.assertIn(RULINGS, PAGE)

    def test_his_general_words_open_the_page_and_lead_the_printout(self):
        self.assertEqual(BAR['general']['words'], GENERAL)
        self.assertEqual(BAR['general']['on'], '2026-10-28')
        quoted = floor.blockquote(GENERAL)
        self.assertEqual(quoted.splitlines()[0], '> "In general I think:')
        self.assertLess(PAGE.index(quoted), PAGE.index(floor.blockquote(BAR['ruling']['words'])))
        self.assertEqual(PAGE.index('> "'), PAGE.index(quoted))
        principle = floor.section(PAGE, '## The principle')
        lead = next(line for line in principle if line.strip())
        self.assertTrue(lead.startswith('His words lead (Krish, 28 Oct): "minimal random components and labels"'))
        # Under his marker, only his exact words: every quoted phrase in the lead is from his general words.
        self.assertEqual(lead.count('"') % 2, 0)
        for said in lead.split('"')[1::2]:
            self.assertIn(said, GENERAL)
        for maker in ('short_video', 'long_video'):
            _, text = run('--format', maker)
            block = textwrap.indent(f'"{GENERAL}"', '    ')
            self.assertIn(block, text, maker)
            self.assertEqual(text.index(block), text.index('\n', text.index('on how every video should be made')) + 1)
            self.assertLess(text.index(block), text.index('His rulings that bite in production'))
            self.assertLess(text.index('His rulings that bite in production'), text.index('Krish named the pieces'))

    def test_each_ruling_keeps_his_exact_answer(self):
        items = {item['n']: item for item in BAR['rulings']['items']}
        self.assertEqual({n: item['answer'] for n, item in items.items()}, ANSWERS)
        self.assertEqual(BAR['rulings']['section'], RULINGS[3:])
        for n, answer in ANSWERS.items():
            line = ruling_line(n)
            self.assertIn('His answer', line, n)
            self.assertIn(f'"{answer}"', line, n)
            self.assertIn('Still open' if n == 5 else 'Changed:', line, n)
        # The rulings that bite in production print with his words, verbatim, and only those.
        _, text = run('--format', 'short_video')
        bar = flat(text[: text.index('The rejection floor for')])
        for n in (1, 2, 3, 6):
            self.assertEqual(items[n]['status'], 'ruled')
            words = items[n].get('quote') or items[n]['answer']
            self.assertIn(words, items[n]['answer'])
            self.assertIn(f'- {items[n]["topic"]}: {flat(items[n]["production"])}. In his words: "{words}"', bar)
        for n in (4, 7):
            self.assertNotIn('production', items[n])
        # Not sure is an answer, not a ruling: it confirms the bytes, never his approval of them.
        self.assertEqual(items[7]['status'], 'answered')
        self.assertIn('it confirms the bytes, not his approval of them', ruling_line(7))
        self.assertIn('it confirms the bytes, not his approval of them', items[7]['changed'])

    def test_question_five_is_still_open(self):
        five = next(item for item in BAR['rulings']['items'] if item['n'] == 5)
        self.assertEqual(five['status'], 'open')
        self.assertNotIn('production', five)
        self.assertEqual([item['n'] for item in BAR['rulings']['items'] if item['status'] == 'open'], [5])
        line = ruling_line(5)
        self.assertIn('Still open: concrete questions are being put to him.', line)
        self.assertIn('the three readings stay drafts that makers follow but no gate enforces', line)
        for reading in READINGS:
            self.assertIn(reading, line.lower())
        for number in (2, 4, 11, 14):
            self.assertIn('open question 5', quality(number), number)
        _, text = run('--format', 'long_video')
        self.assertIn('- Still open (readings that go further than his words):', text)

    def test_music_is_audible_throughout_every_cut(self):
        sound = quality(14)
        self.assertIn(f'(Krish, 28 Oct: "{ANSWERS[1]}")', sound)
        self.assertIn('audible under the whole of every cut', sound)
        self.assertNotIn('can be heard under', sound)
        self.assertIn(f'(Krish, 28 Oct: "{ANSWERS[1]}")', PAGE.split('## What is not the bar')[1])
        # The references' drop-outs are slips, and no sound comparison point runs into one.
        drops = [m for m in BAR['reference_moments'] if m.get('slip') and 'sound' in m['shows']]
        self.assertEqual({(m['ref'], m['at'], m['to']) for m in drops},
                         {('fri23-tall', '01:05.7', '01:15.6'), ('mon26-tall', '01:06', '01:14.5'),
                          ('mon26-wide', '00:45', '04:31')})
        seconds = lambda stamp: int(stamp[:2]) * 60 + float(stamp[3:])
        point = next(q for q in BAR['qualities'] if q['id'] == 'sound')
        for c in point['compare_beside']:
            for m in drops:
                if m['ref'] == c['ref']:
                    self.assertLessEqual(seconds(c.get('to', c['at'])), seconds(m['at']), c)

    def test_labels_that_add_nothing_are_out_and_labels_that_name_something_stay(self):
        core = ANSWERS[2].split('labels. ', 1)[1]
        self.assertTrue(core.startswith("It's just the ones that say"))
        for number in (1, 7):
            self.assertIn(f'(Krish, 28 Oct: "{core}")', quality(number), number)
        typography = quality(7)
        self.assertIn('(Krish, 28 Oct: "I don\'t mind those labels.")', typography)
        self.assertIn('Labels that name a source, a date, a record or what is on screen are fine', typography)
        # His words rule out a label that tags something as his, never every label that names him.
        narrow = "no label that tags something as Krish's (his read, his take, his test)"
        self.assertIn(narrow, typography)
        self.assertIn(narrow, ruling_line(2))
        self.assertIn("no label that tags something as Krish's: his read, his take, his test", items_by_n(2)['production'])
        self.assertNotIn('label that names Krish', PAGE)
        self.assertNotIn('names Krish', json.dumps(BAR))
        self.assertNotIn('A label names a record, never a process', typography)
        self.assertIn('- Whether a piece uses mono labels.', PAGE)

    def test_the_brand_mark_follows_the_brand_book(self):
        branding = quality(6)
        self.assertIn(f'(Krish, 28 Oct: "{ANSWERS[3]}")', branding)
        for source in ('The book gives each lockup one job (p. 04)', 'hands-off rules (p. 05)', '`docs/STUDIO.md` applies the book',
                       'the placement Krish approved on 26 September 2026, for the job-based Studio', '`docs/brandbooknew/`',
                       "Where a reference departs from them (Monday tall carries no mark tile in its body), the book and "
                       "`docs/STUDIO.md`'s approved placement for a Short win",
                       "whether that every-beat tile binds a quick-edit tall cut such as Monday tall is Krish's decision"):
            self.assertIn(source, branding)
        # The question rested on a premise the book does not support, and the rulings say so.
        self.assertIn("The question's premise was wrong: the book itself does not ask for a mark tile on every beat",
                      ruling_line(3))
        self.assertNotIn('the book wins', PAGE)
        self.assertNotIn('the book wins', items_by_n(3)['production'])
        # The bar's own judgment on where the mark sits is gone.
        for judgment in ('the lockup clearly at the open and the close', "Placement is the brand book's call",
                         'Whether a small brand mark sits on every frame'):
            self.assertNotIn(judgment, PAGE)
        self.assertIn('- Where the references put the brand mark. The brand book places it (quality 6).', PAGE)

    def test_no_illustration_tag_or_test_sticker_is_still_asked_for(self):
        # Krish, 28 Oct 2026, on the ILLUSTRATION tag and the KRISH'S TEST stickers: "Yes remove those."
        removed = re.compile(
            r"ILLUSTRATION present|requires ILLUSTRATION|carries (an|the small) ILLUSTRATION tag because|illustrationLabels"
            r"|illustration_labels|IllustrationLabel|illustration_tag_required|min_tag_px|plates_labelled"
            r"|generated pictures carry|labelled as illustration on screen|P<ILLUSTRATION|>ILLUSTRATION<"
            r"|(producer_label|producerLabel)\"?: \"KRISH'S TEST|provenance sticker slaps|Krish\\?'s test<br>"
            r"|28 px ILLUSTRATION|only for the ILLUSTRATION tag")
        found = []
        for top in ('scripts', 'apps/renderer/src', 'packages', 'config/ve', 'docs/ve', 'assets/plates', 'fixtures/ve'):
            for path in sorted((ROOT / top).rglob('*')):
                if path.suffix not in ('.py', '.ts', '.tsx', '.json', '.md', '.html') or 'node_modules' in path.parts:
                    continue
                for number, line in enumerate(path.read_text(encoding='utf-8', errors='replace').splitlines(), 1):
                    if removed.search(line):
                        found.append(f'{path.relative_to(ROOT)}:{number}')
        self.assertEqual(found, [])
        four = ruling_line(4)
        self.assertIn(f'His answer: "{ANSWERS[4]}"', four)
        self.assertIn('gone for good', four)
        # The treated background is already out of the style bank, in his words; nobody asks him again.
        bank = json.loads((ROOT / 'config' / 'style-references.json').read_text(encoding='utf-8'))
        treated = [m for m in bank_modules(bank) if m.get('id') == 'treated-background']
        self.assertEqual([m['krish_verdict'] for m in treated], ['not for us'])
        self.assertIn(f'"{ANSWERS[4]}"', treated[0]['krish_said'])
        for text in (four, items_by_n(4)['changed']):
            self.assertIn('the style trial refuses it', text)
            self.assertNotIn('in person', text)

    def test_outside_logos_are_the_official_mark_in_full_colour_or_one_colour(self):
        self.assertNotIn('house look', PAGE)
        self.assertNotIn('monochrome', PAGE)
        self.assertNotIn('Google left in full colour', PAGE)
        branding = quality(6)
        self.assertIn("the company's official mark in full colour, or as the company's own published one-colour version of "
                      'it, whichever fits the rest of the production', branding)
        self.assertIn(f'(Krish, 28 Oct: "{ANSWERS[6]}")', branding)
        self.assertIn('We never recolour or redraw a mark ourselves (`docs/MEDIA_STANDARD.md`)', branding)
        # He was asked about each company's own one-colour mark; recolouring a mark ourselves stays his call on rights.
        asked = ("Is a one-colour house treatment allowed, using only each company's own official one-colour mark?")
        self.assertIn(asked, ruling_line(6))
        self.assertIn(asked, items_by_n(6)['question'])
        for text in (branding, ruling_line(6), items_by_n(6)['changed'], BAR['related']['logos']):
            self.assertIn("Krish's decision on rights", text)
            self.assertIn('a house colour the company does not publish', text)
        self.assertNotIn('one-colour version of that same', PAGE)
        self.assertNotIn('one-colour version of that same', json.dumps(BAR))
        self.assertIn('never recoloured or redrawn by us', BAR['related']['logos'])
        self.assertIn('never recoloured or redrawn by us', items_by_n(6)['production'])

    def test_the_gate_is_his_exact_file_approval(self):
        self.assertNotIn('Monday review', PAGE)
        self.assertEqual(PAGE.count("Krish's exact-file approval (`docs/ve/ENGINE.md`, S7 Gate 3)"), 16)

    def test_sound_is_marked_measured_until_someone_hears_it(self):
        sound = PAGE.split('### 14. Sound finish')[1].split('### 15.')[0]
        refs = sound.split('**In the references.**')[1]
        self.assertTrue(refs.strip().startswith('Measured, not yet heard'))
        self.assertIs([q for q in BAR['qualities'] if q['id'] == 'sound'][0]['heard'], False)
        for m in BAR['reference_moments']:
            if 'sound' in m['shows']:
                self.assertIs(m['heard'], False)
                self.assertIn('not yet heard', m['what'])

    def test_the_long_voiceover_cut_is_not_a_reference_yet(self):
        later = BAR['not_yet_references']
        self.assertEqual([(n['format_family'], n['which_file']) for n in later], [('voiceover', 'the long cut')])
        self.assertIn('post-production', later[0]['status'])
        self.assertIn('still in post-production', PAGE.lower())
        self.assertIn(BAR['ruling']['correction'], PAGE)

    def test_his_words_open_the_page_exactly(self):
        self.assertTrue(PAGE.startswith('# The bar'))
        first = PAGE.index('> "')
        self.assertLess(first, PAGE.index('## The principle'))
        self.assertIn(f'> "{BAR["ruling"]["words"]}"', PAGE)
        self.assertIn(f'> "{BAR["ruling"]["correction"]}"', PAGE)

    def test_no_measured_value_is_a_target(self):
        self.assertEqual(floor.measured_keys(BAR), [])
        made_up = json.loads(json.dumps(BAR))
        made_up['references'][0]['length_s'] = 78.6
        made_up['qualities'][0]['bpm'] = 105
        self.assertEqual(len([p for p in floor.bar_problems(made_up, PAGE) if 'never a target' in p]), 2)
        self.assertIn('## What is not the bar', PAGE)
        self.assertIn('Nothing here says a voiceover piece is 90 seconds or any other length.', PAGE)
        # The page names none of the figures measured from the references, so none can be read as a target.
        for figure in ('px', 'BPM', 'kHz', 'y=1000', 'frame snaps', '0.4 s', '2.7 s', '0.3 s', 'half-second'):
            self.assertNotIn(figure, PAGE)

    def test_the_page_keeps_the_house_voice(self):
        self.assertNotIn('—', PAGE, 'no em dashes')
        self.assertNotIn('–', PAGE, 'no en dashes')
        for spelling in ('color ', 'gray ', 'center '):
            self.assertNotIn(spelling, PAGE.lower())
        sections = ('## The principle', '## The qualities', '## What is not the bar', '## Reference moments', RULINGS)
        order = [PAGE.index(s) for s in sections]
        self.assertEqual(order, sorted(order))
        for part in ('**The bar.**', '**In the references.**', '**Below the bar.**', '**Compare beside.**',
                     '**How it is checked.**'):
            self.assertEqual(PAGE.count(part), len(BAR['qualities']), part)

    def test_the_two_cut_makers_read_the_bar_whole_first(self):
        self.assertEqual(set(BAR['applies_to_makers']), set(FULL) | set(POINTER))
        self.assertEqual(tuple(BAR['full_bar_for_makers']), FULL)
        for maker in FULL:
            code, text = run('--format', maker)
            self.assertEqual(code, 0, maker)
            self.assertTrue(text.startswith('The bar: the production quality floor for every video'), maker)
            self.assertLess(text.index('In his words:'), text.index('Standing: draft.'))
            self.assertLess(text.index('Standing: draft.'), text.index("The engine's reading of those cuts, a draft:"))
            self.assertLess(text.index('The bar: '), text.index('The rejection floor for'))
            self.assertLess(text.index('The rejection floor for'), text.index('Approved standards'))
            for q in BAR['qualities']:
                self.assertIn(q['name'], text)
            self.assertEqual(text.count('Identity unconfirmed'), 0)
            self.assertIn('never targets', text)
            self.assertIn('Not a reference yet: the long cut (voiceover)', text)
            self.assertTrue(text.endswith(floor_only(maker)), 'the floor after the bar is unchanged')

    def test_the_other_video_makers_get_one_line_pointing_at_it(self):
        for maker in POINTER:
            code, text = run('--format', maker)
            self.assertEqual(code, 0, maker)
            head = ' '.join(text[: text.index('The rejection floor for')].split())
            self.assertTrue(head.startswith(f'The bar: {BAR["doc"]} is the production quality floor for this maker'))
            self.assertIn('--format short_video or --format long_video', head)
            self.assertNotIn(BAR['qualities'][0]['name'], head)
            self.assertLess(len(head), 400, maker)
            self.assertTrue(text.endswith(floor_only(maker)), maker)

    def test_the_printed_bar_carries_no_hashes_file_ids_or_numbers_to_hit(self):
        _, text = run('--format', 'short_video')
        section = text[: text.index('The rejection floor for')]
        self.assertIsNone(re.search(r'\b[0-9a-f]{64}\b', section))
        for ref in BAR['references']:
            self.assertNotIn(ref['drive_file_id'], section)
            self.assertNotIn(ref['piece_id'], section)
        self.assertIsNone(re.search(r'\b\d+(\.\d+)?\s?(s|seconds|BPM|LUFS|fps|px)\b', section))

    def test_other_makers_see_the_floor_unchanged(self):
        doc = floor.load()
        for maker in ('cover', 'thumbnail', 'carousel', 'article', 'script'):
            if maker not in doc['formats']:
                continue
            _, text = run('--format', maker)
            self.assertNotIn('The bar', text, maker)
            self.assertEqual(text, floor_only(maker), maker)
        _, text = run('--format', 'all')
        self.assertTrue(text.startswith(f'The bar: {BAR["doc"]} is the production quality floor for every video maker'))
        self.assertTrue(text.endswith(floor_only('all')))
        _, summary = run()
        self.assertIn(floor.BAR_HINT, summary)
        self.assertNotIn('The bar:', summary)

    def test_a_broken_bar_never_stops_another_makers_floor(self):
        with tempfile.TemporaryDirectory() as tmp:
            broken = Path(tmp) / 'reference-cuts.json'
            broken.write_text('{"not": json', encoding='utf-8')
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                code, text = run('--bar-file', str(broken), '--format', 'cover')
            self.assertEqual(code, 0)
            self.assertEqual(text, floor_only('cover'))
            code, text = run('--bar-file', str(broken))
            self.assertEqual(code, 0)
            self.assertTrue(text.startswith('The rejection floor, version'), 'the summary never reads the bar')
            with contextlib.redirect_stderr(io.StringIO()):
                code, text = run('--bar-file', str(broken), '--format', 'short_video')
            self.assertEqual(code, 0)
            self.assertEqual(text, floor_only('short_video'))
            code, text = run('--check', '--bar-file', str(broken))
            self.assertEqual(code, 1)
            self.assertIn('the bar: reference-cuts.json cannot be read', text)

    def test_with_no_rejection_floor_the_bar_still_prints(self):
        missing = Path(tempfile.gettempdir()) / 'no-such-rejection-floor.json'
        code, text = run('--file', str(missing), '--format', 'long_video')
        self.assertEqual(code, 0)
        self.assertTrue(text.startswith('The bar: '))
        self.assertIn('No rejection floor yet', text)
        code, text = run('--file', str(missing), '--format', 'cover')
        self.assertNotIn('The bar', text)

    def test_check_fails_when_the_page_and_the_references_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            drifted = json.loads(json.dumps(BAR))
            drifted['qualities'][0]['name'] = 'Premium finish'
            drifted['reference_moments'][0]['at'] = '0:2'
            drifted['reference_moments'][1]['what'] = drifted['reference_moments'][1]['what'] + ' Changed.'
            drifted['qualities'][1]['compare_beside'][0]['to'] = '00:37'
            drifted['general']['words'] = GENERAL.replace('good animation', 'great animation')
            drifted['rulings']['items'][0]['answer'] = ANSWERS[1].replace('lower', 'quieter')
            drifted['rulings']['items'][4]['status'] = 'ruled'
            path = Path(tmp) / 'reference-cuts.json'
            path.write_text(json.dumps(drifted), encoding='utf-8')
            code, text = run('--check', '--bar-file', str(path))
            self.assertEqual(code, 1)
            self.assertIn('does not quote his general words exactly', text)
            self.assertIn('ruling 1: his answer on the page is not the one in the references', text)
            self.assertIn('ruling 5 is ruled in the references but open on the page', text)
            self.assertIn('the bar: the quality names and the headings', text)
            self.assertIn("'0:2' is not a MM:SS(.f) timestamp", text)
            self.assertIn('reference moment fri23-tall 00:08 to 00:16 is in the references only, or its words differ',
                          text)
            self.assertIn('quality motion_explains: the Compare beside points on the page and in the references '
                          'disagree', text)

    def test_every_moment_and_comparison_points_inside_a_named_cut(self):
        refs = {r['id'] for r in BAR['references']}
        ids = {q['id'] for q in BAR['qualities']}
        shown = set()
        for m in BAR['reference_moments']:
            self.assertIn(m['ref'], refs)
            shown.update(m['shows'])
        for q in BAR['qualities']:
            self.assertTrue(q['compare_beside'], q['id'])
            for c in q['compare_beside']:
                self.assertIn(c['ref'], refs)
        self.assertLessEqual(shown, ids)
        slips = [m for m in BAR['reference_moments'] if m.get('slip')]
        self.assertTrue(slips and all(m['what'].startswith('SLIP, below the bar, do not copy') for m in slips))


if __name__ == '__main__':
    unittest.main()
