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


if __name__ == '__main__':
    unittest.main()
