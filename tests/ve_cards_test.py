"""Removing a card worktree must never follow a link into what it points at (27 Oct 2026: `rm -rf` on a card
folder followed its node_modules junction and emptied the main checkout's node_modules)."""
import os
import subprocess
import sys
from unittest.mock import patch
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.cards import unlink_links  # noqa: E402


def make_link(link: Path, target: Path) -> None:
    if sys.platform == 'win32':
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(target)], check=True, capture_output=True)
    else:
        os.symlink(target, link)


class CardCleanupNeverFollowsLinks(unittest.TestCase):
    def test_the_link_goes_and_its_target_survives(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / 'shared-node-modules'
            (target / 'typescript').mkdir(parents=True)
            (target / 'typescript' / 'package.json').write_text('{}', encoding='utf-8')
            card = root / 'card'
            (card / 'src').mkdir(parents=True)
            make_link(card / 'node_modules', target)
            removed = unlink_links(card)
            self.assertEqual([p.name for p in removed], ['node_modules'])
            self.assertFalse((card / 'node_modules').exists())
            self.assertTrue((target / 'typescript' / 'package.json').exists(), 'the link target was emptied')



class WriteAllowListsMatch(unittest.TestCase):
    """11 Nov 2026: fields written as JSON lists became Python's repr in the card, quotes and all, so verify() matched
    no path and refused a correct Codex build (ve-style-0-three-and-moves) as outside write_allow."""

    def test_a_list_and_the_card_text_both_allow_their_paths(self):
        from velib import cards
        for write_allow in (['apps/renderer/package.json', 'lab/moves/**'], '[apps/renderer/package.json, lab/moves/**]'):
            with self.subTest(form=type(write_allow).__name__), tempfile.TemporaryDirectory() as tmp:
                tmp = Path(tmp)
                card = cards.write_card(tmp / 'c.md', card_id='c', kind='code', title='t', goal='g', contract='c',
                                        acceptance='python3 -c "pass"', write_allow=write_allow,
                                        read=['a/**', 'b.md'], cwd=str(tmp / 'wt'))
                text = card.read_text(encoding='utf-8')
                self.assertIn('write_allow: [apps/renderer/package.json, lab/moves/**]', text)
                self.assertIn('read: [a/**, b.md]', text)
                wt = tmp / 'wt'
                (wt / 'apps' / 'renderer').mkdir(parents=True)
                (wt / 'lab' / 'moves' / 'x').mkdir(parents=True)
                subprocess.run(['git', 'init', '-q'], cwd=wt, check=True)
                (wt / 'apps' / 'renderer' / 'package.json').write_text('{}')
                (wt / 'lab' / 'moves' / 'x' / 'move.mjs').write_text('')
                self.assertEqual([p for p in cards.verify(card, wt) if 'write_allow' in p], [])
                (wt / 'stray.txt').write_text('')
                self.assertIn('outside write_allow: stray.txt', cards.verify(card, wt))

if __name__ == '__main__':
    unittest.main()


class VisualCardsTakeTheOneRoute(unittest.TestCase):
    """Ruling (Krish, 2026-11-13): every carousel is made in a Claude session, as in the other usual workflows; memes
    and Notes images go the same way. Ruling (Krish, 2026-11-26): content-engine makes every asset, from the locked v5
    Library, and Growth only posts it, so a card is written in content-engine for content-engine's own checkout (never
    Growth's retired renderer, render/ in growth-makeyourmindup). A card of one of these kinds is held to the brand
    palette for its day and the inspiration cards Krish ticked. A carousel card is retired (Krish, 2026-11-26): a
    carousel is made only by the v5 Library through scripts/carousel_make.py."""

    DECK = 'docs/plans/2026-11-09-week/git-carousel/deck.json'

    def card(self, tmp, **extra):
        from velib import cards
        fields = dict(card_id='carousel-x', kind='carousel', title='t', goal='g', contract='c',
                      acceptance='python3 -c "pass"', write_allow=['.cache/library/carousel-x/**'],
                      read=['docs/ve/cards/library/LIBRARY-GUIDE.md', 'docs/ve/cards/library/CAROUSEL-FORMAT.md'],
                      cwd=str(Path(tmp) / 'wt'), date='2026-11-17', references=['8ca0bd3d'], deck=self.DECK)
        fields.update(extra)
        return cards.write_card(Path(tmp) / 'c.md', **fields)

    def test_a_carousel_card_is_retired_for_the_library_route(self):
        # Krish, 2026-11-26: "Tell the Content-engine story intelligence for makeyourmindup v5 session that it is to
        # enforce carousel formatting." A Codex-drawn carousel is a second renderer, so the kind refuses and names the route.
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(SystemExit) as stop:
            self.card(tmp)
        said = str(stop.exception.code)
        self.assertIn('a carousel card is retired', said)
        self.assertIn('scripts/carousel_make.py', said)
        self.assertIn('make_piece.py --set', said)

    def test_no_references_no_card(self):
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(SystemExit) as stop:
            self.card(tmp, kind='meme', deck=None, references=[])
        self.assertIn('F26', str(stop.exception.code))

    def test_a_face_cover_card_names_its_channel_and_photos_and_wears_both_cover_sizes(self):
        with tempfile.TemporaryDirectory() as tmp:
            text = self.card(tmp, kind='cover', deck=None, channel='tiktok', date='2026-11-16',
                             photos=['.cache/photos/Denim-jacket headshot on transparent background.png']).read_text(encoding='utf-8')
        self.assertIn('## Brand (thumbnail_wide, series, 2026-11-16', text)
        self.assertIn('## Brand (cover_tall, series, 2026-11-16', text)
        self.assertIn('## Face (channel tiktok', text)
        self.assertIn('never a circle', text)
        self.assertIn('Denim-jacket headshot', text)
        self.assertLessEqual(len(text.encode('utf-8')), 6144)

    def test_a_face_cover_is_refused_for_a_receipt_channel_or_without_photos(self):
        for extra, said in ((dict(channel='instagram', photos=['a.png']), 'Receipt'), (dict(channel='x', photos=[]), 'photos')):
            with self.subTest(said=said), tempfile.TemporaryDirectory() as tmp, self.assertRaises(SystemExit) as stop:
                self.card(tmp, kind='cover', deck=None, date='2026-11-16', **extra)
            self.assertIn(said, str(stop.exception.code))

    def test_a_meme_and_a_notes_image_wear_their_own_palette_and_need_no_deck(self):
        for kind in ('meme', 'notes_image'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                text = self.card(tmp, kind=kind, deck=None, spend_id='f2bfdae8').read_text(encoding='utf-8')
                self.assertIn(f'## Brand ({kind}, off, 2026-11-17', text)
                self.assertIn('"close": "none"', text)
                # Codex is not counted (Ruling, Krish, 2026-11-17): a booking passed in is never written onto the card.
                self.assertNotIn('spend_id', text)
                self.assertNotIn('## Deck', text)
