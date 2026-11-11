"""Removing a card worktree must never follow a link into what it points at (27 Oct 2026: `rm -rf` on a card
folder followed its node_modules junction and emptied the main checkout's node_modules)."""
import os
import subprocess
import sys
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
