"""Raises the motion in every beat of Wednesday's direction (Krish, 31 Oct: "I want way more animation than ever before
and movement"). Only the `motion` field changes; words, points, pictures and sources stay as signed-for.
Run from the repository root: python3 docs/plans/2026-11-04-wednesday/imagery/raise_motion.py"""
import json
from pathlib import Path

P = Path('docs/plans/2026-11-04-wednesday/creative-direction.json')
FACE = ('camera never still: a slow push across the beat (1.00 to 1.06), a punch-in to a tighter frame on his stressed '
        'word, a reframe about every 3 seconds so no framing holds longer than that; the caption lands word by word')
PHONE = 'the phone in his hand drifts and tilts a few degrees (hand-held parallax, the desk behind slower), the recording plays as video, never a still; '
DOC = 'the page arrives on a slide and keeps moving: a slow push and drift towards the line, the mint mark sweeps across the words as he says them, the page settles only after the mark lands; '
CARD = 'everything on the queue desk keeps moving: the rail ticks past, cards sway on their clips, the camera pushes and drifts; '
MORE = {
    ('long', 0): 'the label types in on "early access"; ' + FACE,
    ('long', 3): 'each logo drops onto the rail on its name and rides it towards the lilac line; the counter rolls to 6,000+ on "whatever else"; ' + CARD,
    ('long', 5): 'each action is a paper work order that slides in on its verb and stops at the lilac line, swaying on its clip; the YES slots wait, outlined; ' + CARD,
    ('long', 6): PHONE + 'the second screen wipes the first on the cut, with a push in on "Connect your apps"',
    ('long', 12): PHONE + 'a whip push in on the two tabs on "a bunch of tasks"',
    ('long', 20): 'the chat bubble folds, origami-like, into a tool tile on "ask once"; the tile is used three times, each a tick and a small bounce on "again and again"; ' + CARD,
    ('long', 21): 'each input (thread, invite, notes) flies in and drops into the box on its word, the box lid bumps; ' + CARD,
    ('long', 22): 'the big moment: the queue slides in on "turns up first", the first order stops at the line, the mint YES stamps on "yes" in five frames and the order crosses the line and leaves; ' + CARD,
    ('long', 24): 'the number rolls up to 36 on "a day and a half", each digit on a slot-machine roll, then HOURS slides under it; the desk drifts',
    ('long', 29): 'five plan tiles drop in a row one after another; Pro and Max light on their names, Team and Enterprise slide down and dim on "company pays"; ' + CARD,
    ('long', 31): 'the work email card slides from the company box to the personal box on "connect", the company box\'s lid snaps shut and a lock drops on "doesn\'t control"; ' + CARD,
    ('long', 33): 'step 1 drops on "pick", step 2 wires up to the app logos on "apps", each with a small overshoot; ' + CARD,
    ('long', 34): 'the YES slots stamp in turn on "check every draft", the usage bar fills on "how much"; ' + CARD,
    ('long', 35): 'the close card: the wordmark draws in, the address types on, then a calm hold long enough to read with a gentle drift (one close)',
    ('short', 3): 'each action is a paper work order that slides in on its verb and stops at the lilac line, swaying on its clip; ' + CARD,
    ('short', 10): 'the chat bubble folds into a tool tile on "ask once"; the tile ticks three times; ' + CARD,
    ('short', 12): 'step 1 drops on "pick", step 2 stamps YES on "say yes"; ' + CARD,
    ('short', 13): 'the close card: the wordmark draws in, the address types on, then a calm hold long enough to read with a gentle drift (one close)',
}
d = json.loads(P.read_text())
for cut, cutobj in d['cuts'].items():
    beats = cutobj['beats']
    for i, b in enumerate(beats):
        kind = b['picture']['kind']
        if (cut, i) in MORE:
            b['motion'] = MORE[(cut, i)]
        elif kind == 'face':
            b['motion'] = FACE
        elif kind == 'screen':
            b['motion'] = PHONE + b['motion']
        elif kind == 'document':
            b['motion'] = DOC + b['motion']
        elif kind in ('card', 'chart', 'logo'):
            b['motion'] = b['motion'] + '; ' + CARD.rstrip('; ')
d.setdefault('production_notes', []).append(
    'Krish, 2026-10-31: "I want way more animation than ever before and movement." Every beat now moves for its whole '
    'length: no picture holds still for more than about 1.5 seconds except the close card, his phone screen always plays '
    'as video in the hand-held plate, documents push and drift as the mark sweeps, and the queue desk never stops. '
    'docs/plans/2026-11-04-wednesday/imagery/motion-plan.md; the motion test is imagery/motion-test-queue.mp4.')
P.write_text(json.dumps(d, indent=1, ensure_ascii=False) + '\n')
print('motion raised on', sum(len(c['beats']) for c in d['cuts'].values()), 'beats')
