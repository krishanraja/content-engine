"""The story check for a video script, done by rule rather than by a model.

Krish, 2026-10-06, of the Higgsfield launch script (walk log F75): "I can't
even say it out loud as it confuses the hell out of me reading it", then of
the second version: "what does that mean? We've never introduced that concept
yet ... It also barely connects to the next bits, the takeaways ... now it
just ends randomly on 85%, with nothing after that, no outro." He approved the
five-point story check the same evening ("happy with that idea"); the house
rules FOR_THE_EAR and STORY_ARC carry it to every writer and judge.

A model cannot be trusted to grade its own story, so this file checks the
parts a rule can see, and refuses to pack a script that fails one:

  - it opens on a question (in the first 90 spoken words);
  - a script of a minute or more ends with a spoken outro after the call,
    so it never stops dead on the number;
  - it never speaks the article's headings or stamps aloud
    ("The billion: REAL, with small print", "One: the billion.");
  - nothing in it is still marked NOT YET FACT-CHECKED.

Whether every beat follows from the last still needs a reader. The rule
catches the failures that sank the Higgsfield script; reading it aloud once
catches the rest.

    python scripts/post-pack/story_check.py SCRIPT [SCRIPT ...]
    python scripts/post-pack/story_check.py --self-test
"""

import re
import sys
from pathlib import Path

UNCHECKED = 'NOT YET FACT-CHECKED'
OPENING_WORDS = 90
SHORT_WORDS = 160  # under about a minute: no room for an outro
OUTRO = re.compile(r'makeyourmindup', re.I)
META_START = re.compile(r'^\s*(changes from|before you record|the story in one line|#{1,3}\s)', re.I)
SAY_LINE = re.compile(r'^\s*(?:\*\*say:\*\*|say:)\s*(.*)$', re.I)
STAGE = re.compile(r'\\?\[[^\]]*\\?\]')
SPOKEN_STAMP = re.compile(r'\b(REAL|THEATRE)\b')
SPOKEN_LABEL = re.compile(r'(^|[.!?]\s+)(One|Two|Three|Four|Five|Six)\s*:\s*the\s+\w+\s*\.', re.I)
HEADING_MARKUP = re.compile(r'\*\*[^*]+:\*\*|\*\*[^*]+\*\*\s*:')


def spoken_paragraphs(text):
    """The words Krish will say, one entry per beat."""
    lines = text.replace('\r\n', '\n').split('\n')
    said = [m.group(1) for m in (SAY_LINE.match(line) for line in lines) if m]
    if said:
        return [s.strip() for s in said if s.strip()]
    if any(line.strip() == '---' for line in lines):
        lines = lines[[line.strip() for line in lines].index('---') + 1:]
    else:
        first = next((i for i, line in enumerate(lines) if STAGE.search(line)), None)
        if first is not None:
            lines = lines[first:]
    paragraphs, current = [], []
    for line in lines:
        if META_START.match(line):
            break
        words = STAGE.sub(' ', line).strip()
        if not line.strip():
            if current:
                paragraphs.append(' '.join(current))
                current = []
            continue
        if words:
            current.append(words)
        elif current:
            paragraphs.append(' '.join(current))
            current = []
    if current:
        paragraphs.append(' '.join(current))
    return [re.sub(r'\s+', ' ', p).strip() for p in paragraphs if p.strip()]


def problems(text):
    """Plain-words reasons this script is not ready, or [] when it passes."""
    found = []
    if UNCHECKED in text:
        found.append(f'some lines are marked {UNCHECKED}: add those facts to the article and run the fact check, or cut them')
    beats = spoken_paragraphs(text)
    words = ' '.join(beats).split()
    if not words:
        return found + ['no spoken words found: give each spoken line its own paragraph, or start it with "Say:"']
    if '?' not in ' '.join(words[:OPENING_WORDS]):
        found.append('it does not open on a question: say, in the first beat, the one question the script answers')
    if len(words) >= SHORT_WORDS and not OUTRO.search(beats[-1]):
        found.append('it stops without a spoken outro: after the call, say what this was, where the full piece is '
                     '(makeyourmindup.ai) and sign off, so it never ends on the number')
    for beat in beats:
        quote_free = re.sub(r'"[^"]*"|\u201c[^\u201d]*\u201d', '', beat)
        if SPOKEN_STAMP.search(quote_free) or SPOKEN_LABEL.search(quote_free) or HEADING_MARKUP.search(beat):
            found.append(f'it speaks a heading or stamp aloud ("{beat[:70]}..."): say what the claim is and why it matters, '
                         'and leave REAL or THEATRE to the stamp on screen')
            break
    return found


def check_file(path):
    return problems(Path(path).read_text(encoding='utf-8-sig'))


# ---------------------------------------------------------------- self-test

HIGGSFIELD_V1 = '''Higgsfield, taken apart: the video script (about 3 minutes)
Square brackets say what is on screen. Everything else is said to camera.

\\[To camera\\] Before OpenAI shut down Sora, its biggest customer, Tech Times reported, was a company called Higgsfield. Then in September, Higgsfield's founder said it had crossed a billion dollars a year. So we took it apart.

\\[On screen: 4 WEEKS x 13\\] One: the billion. Real, with small print. The founder says they take the last four weeks of sales and multiply by thirteen. It's a pace, worked out from four weeks.

\\[On screen: OUR CALL\\] Our call: by the end of June 2027, Higgsfield raises money at a valuation of ten billion dollars or more. Eighty-five per cent sure.
'''

HIGGSFIELD_V2_END = '''[To camera]
In September, the boss of an AI video company called Higgsfield said it had crossed a billion dollars a year in sales. So is that billion real? Let's take it apart.

[On screen: THEATRE stamp]
Now the one bit that's theatre. On a podcast, the founder was asked, "You don't do paid?" He said, "We don't do paid." That's paid advertising in a nicer jacket. ''' + ' '.join(['More words that fill the middle of the script.'] * 20) + '''

[On screen: OUR CALL, BY 30 JUNE 2027, 85%]
So here's our call. By the end of June 2027, Higgsfield raises money at a valuation of ten billion dollars or more. How sure are we? Eighty-five per cent.

[End card, added in the edit]

Changes from version 1, and why
- No spoken sign-off.
'''

GOOD = '''Title line, not spoken
---

[To camera]
So how do you lose your biggest supplier and keep growing? Let's take it apart.

[On screen: THEATRE stamp]
One claim doesn't stand up. On a podcast, the founder was asked if Higgsfield pays for advertising. "We don't do paid," he said. ''' + ' '.join(['More words that fill the middle of the script.'] * 20) + '''

[On screen: OUR CALL]
So here's our call. We're eighty-five per cent sure, and we'll mark it right or wrong on the day.

[To camera, then end card]
That's under.the.hood for this week. The full teardown is free at makeyourmindup.ai. I'm Krish. Make your mind up.
'''

ONE_OFF = '''# 01 A one-off

## Script

**[0:00]**

**Say:** Why does your AI sound like a stranger? Because it has never met you.

*On screen:* Face.

**[0:10]**

**Say:** ''' + ' '.join(['Words that carry the middle of the script along.'] * 20) + '''

**[2:00]**

**Say:** So, this week: write your five lines. That's makeyourmindup. I'm Krish. Make your mind up.

*On screen:* Full face.

## Before you record

- A note that is never spoken: REAL.
'''


def self_test():
    failures, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            failures.append(f'{label}: got {got!r}, want {want!r}')

    v1 = problems(HIGGSFIELD_V1)
    check('version 1 has no opening question', any('open on a question' in p for p in v1), True)
    check('version 1 speaks a heading', any('heading or stamp' in p for p in v1), True)
    v2 = problems(HIGGSFIELD_V2_END)
    check('version 2 ends on the number', any('spoken outro' in p for p in v2), True)
    check('version 2 opens on a question', any('open on a question' in p for p in v2), False)
    check('a quoted "We don\'t do paid" is no heading', any('heading or stamp' in p for p in v2), False)
    check('version 3 shape passes', problems(GOOD), [])
    check('unchecked facts block it', any(UNCHECKED in p for p in problems(GOOD + '\n[NOT YET FACT-CHECKED]\n')), True)
    check('a one-off in Say: lines passes', problems(ONE_OFF), [])
    check('notes after the script are never spoken', any('heading or stamp' in p for p in problems(ONE_OFF)), False)
    short = '[To camera]\nWhy does it matter? Because the price doubled. That is the whole story.\n'
    check('a short hook needs no outro', problems(short), [])
    if failures:
        print('story check self-test FAILED:\n  ' + '\n  '.join(failures))
        return 1
    print(f'story check self-test passed: {count} checks')
    return 0


def main(argv):
    if argv[1:2] == ['--self-test']:
        return self_test()
    if len(argv) < 2:
        print(__doc__.strip())
        return 2
    worst = 0
    for path in argv[1:]:
        found = check_file(path)
        if found:
            worst = 1
            print(f'NOT READY  {path}')
            for item in found:
                print(f'  - {item}')
        else:
            print(f'ready      {path}')
    return worst


if __name__ == '__main__':
    sys.exit(main(sys.argv))
