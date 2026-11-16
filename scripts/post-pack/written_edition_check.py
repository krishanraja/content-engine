#!/usr/bin/env python3
"""The written edition of a piece, checked before it is filed for Growth (house rule WRITTEN_EDITION).

Ruling (Krish, 2026-11-16), of Growth's audience brief of 16 Nov (Control Center material cbb90470, change 5):
"apply 1 to 6 from the next piece you make this week". Video cross-posted to Threads, X and Facebook reached a median
of 5 to 11 people; the one written Substack Note reached 208 against a Notes median of 4 and brought the only
subscriber of the run. So every piece ships words made to be read, beside its videos. Content-engine writes them;
Growth makes the posts from them (docs/GROWTH-HANDOFF.md).

The file is the piece's plan folder's written-edition.md, two sections:

    ## Post
    three to six short lines for X and Threads, at most 280 characters in all

    ## Note
    a written opinion of 60 to 180 words for Substack Notes

Each opens on the piece's one named, concrete thing (house rule ONE_CONCRETE_THING: refused if its first line names
none) and says what it changes for a business by its second line or sentence (FOR_THE_LEADER: a warning). Neither
holds a link (Growth adds its tagged one), a hashtag, an em dash, an exclamation mark or anything the copy lint
refuses on channel copy (config/copy-lint.json). Facts come only from the article the fact check passed: that is the
session's to keep, and the read-back's to test.

    python3 scripts/post-pack/written_edition_check.py docs/plans/<piece>/written-edition.md
    python3 scripts/post-pack/written_edition_check.py --self-test

Exit 0 ready, 1 not ready, 2 unreadable.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
import copy_lint  # noqa: E402
import story_check  # noqa: E402

POST_LINES = (3, 6)
POST_MOST_CHARS = 280  # X's limit for a post without Premium; Threads allows 500, so X sets it
NOTE_WORDS = (60, 180)
SECTION = re.compile(r'^\s{0,3}#{1,6}\s*(post|note)\s*$', re.I | re.M)
# A real link or the house address; a company named like a domain (Character.AI) is a name, never a link.
LINK = re.compile(r'https?://|\bwww\.|\bmakeyourmindup\.ai\b', re.I)
HASHTAG = re.compile(r'(?:^|\s)#[A-Za-z]\w*')
EM_DASH = re.compile('[—–]|\\s--\\s')


def sections(text):
    """{'post': str, 'note': str} from the file's two headed sections; a missing one is absent."""
    found, marks = {}, list(SECTION.finditer(text or ''))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        found[m.group(1).lower()] = text[m.end():end].strip()
    return found


def _surface_problems(name, body):
    found = []
    if LINK.search(body):
        found.append(f'the {name} holds a link ("{LINK.search(body).group(0)}"): leave it out, Growth adds its tagged one')
    if HASHTAG.search(body):
        found.append(f'the {name} holds a hashtag: leave it out (house copy)')
    if EM_DASH.search(body):
        found.append(f'the {name} holds a dash used as punctuation: use a full stop or a comma (house rule NO_EM_DASH)')
    if '!' in body:
        found.append(f'the {name} holds an exclamation mark (house rule NO_EXCLAMATION)')
    for hit in copy_lint.copy_lint(body, 'channel_copy'):
        found.append(f'the {name} breaks the copy lint ({hit["id"]}: "{hit["match"]}")')
    return found


def problems(text):
    """Plain-words reasons the written edition is not ready, or []."""
    parts, found = sections(text), []
    for name in ('post', 'note'):
        if not parts.get(name):
            found.append(f'no "## {name.title()}" section: the written edition is a post for X and Threads and a Note '
                         'for Substack Notes (house rule WRITTEN_EDITION)')
    post = parts.get('post') or ''
    if post:
        lines = [l.strip() for l in post.splitlines() if l.strip()]
        low, high = POST_LINES
        if not low <= len(lines) <= high:
            found.append(f'the post has {len(lines)} lines: it needs {low} to {high} short lines (house rule WRITTEN_EDITION)')
        chars = len('\n'.join(lines))
        if chars > POST_MOST_CHARS:
            found.append(f'the post runs {chars} characters, over the {POST_MOST_CHARS} X shows: cut a line (house rule WRITTEN_EDITION)')
        if lines and not story_check.names_a_thing(lines[0]):
            found.append(f'the post\'s first line names no concrete thing ("{lines[0][:70]}"): open on the piece\'s one named '
                         'thing (house rule ONE_CONCRETE_THING)')
        found += _surface_problems('post', post)
    note = parts.get('note') or ''
    if note:
        words = note.split()
        low, high = NOTE_WORDS
        if not low <= len(words) <= high:
            found.append(f'the Note is {len(words)} words: it needs {low} to {high}, one opinion a reader can answer '
                         '(house rule WRITTEN_EDITION)')
        first = (story_check.sentences([' '.join(note.split())]) or [''])[0]
        if not story_check.names_a_thing(first):
            found.append(f'the Note\'s first sentence names no concrete thing ("{first[:70]}"): open on the piece\'s one '
                         'named thing (house rule ONE_CONCRETE_THING)')
        found += _surface_problems('Note', note)
    return found


def warnings(text):
    """FOR_THE_LEADER on each surface: a warning, since words cannot judge a stake."""
    parts, found = sections(text), []
    post_lines = [l.strip() for l in (parts.get('post') or '').splitlines() if l.strip()]
    if post_lines and not story_check.LEADER_STAKE.search(' '.join(post_lines[:2])):
        found.append('the post\'s first two lines say nothing about what this changes for a business: say it in a '
                     'leader\'s terms by the second line (house rule FOR_THE_LEADER; a warning, not a refusal)')
    note = parts.get('note') or ''
    if note and story_check.leader_stake_warning([' '.join(note.split())]):
        found.append('the Note\'s first two sentences say nothing about what this changes for a business (house rule '
                     'FOR_THE_LEADER; a warning, not a refusal)')
    return found


GOOD = """## Post
Disney is paying Character.AI to put its films inside a chatbot.
For any brand, fans can now talk to your product, and every chat tells the bot what your customers want.
The question for leaders is who owns those chats.

## Note
Disney is paying Character.AI to put its characters inside a chatbot, and I think most brands are missing what that
means for them. Every conversation a fan has teaches the bot what your customers want, how they talk about you and
what they would pay for. That used to be your market research budget. Now it sits inside someone else's product. If I
ran a brand, I would ask one question before signing any deal like this: who owns the chats, and can we read them?
"""


def self_test():
    failures = []

    def check(label, got, want):
        if got != want:
            failures.append(f'{label}: got {got!r}, want {want!r}')

    check('a post and a Note on one named thing, with the business stake, pass', problems(GOOD), [])
    check('and carry no warning', warnings(GOOD), [])
    check('no Note section is refused', any('## Note' in p for p in problems(GOOD.split('## Note')[0])), True)
    check('a link is refused', any('link' in p for p in problems(GOOD.replace('who owns those chats.', 'who owns those chats. makeyourmindup.ai'))), True)
    check('an abstract first line is refused naming ONE_CONCRETE_THING',
          any('ONE_CONCRETE_THING' in p for p in problems(GOOD.replace('Disney is paying Character.AI to put its films inside a chatbot.', 'Every AI has two passports.'))), True)
    check('a post of one line is refused', any('1 lines' in p for p in problems('## Post\nDisney paid.\n\n## Note\n' + GOOD.split('## Note')[1])), True)
    check('an em dash is refused', any('NO_EM_DASH' in p for p in problems(GOOD.replace('For any brand,', 'For any brand —'))), True)
    check('a short Note is refused', any('60 to 180' in p for p in problems(GOOD.split('## Note')[0] + '## Note\nDisney paid Character.AI.')), True)
    stakeless = GOOD.replace('For any brand, fans can now talk to your product, and every chat tells the bot what your customers want.',
                             'Fans can chat with the heroes now.')
    check('a post with no business stake in two lines is a FOR_THE_LEADER warning', any('FOR_THE_LEADER' in w for w in warnings(stakeless)), True)
    if failures:
        print('written edition self-test FAILED:')
        for f in failures:
            print('  ' + f)
        return 1
    print('written edition self-test passed')
    return 0


def main(argv):
    if argv[1:2] == ['--self-test']:
        return self_test()
    if len(argv) != 2:
        print(__doc__.strip())
        return 2
    try:
        text = Path(argv[1]).read_text(encoding='utf-8')
    except OSError as error:
        print(f'cannot read {argv[1]}: {error}')
        return 2
    found, warned = problems(text), warnings(text)
    print(('NOT READY  ' if found else 'ready      ') + argv[1])
    for p in found:
        print('  - ' + p)
    for w in warned:
        print('  WARN ' + w)
    return 1 if found else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
