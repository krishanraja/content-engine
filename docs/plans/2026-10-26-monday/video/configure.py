"""Monday's two make.py configs: kit.py's starter configs, the signed beats as cues on his heard words.

Every picture beat of creative-direction.json is one cue; a beat that prints, stamps or adds a
logo on a word is shown a page at a time, each page landing on the word that names it ("on").
Face beats with no words on screen have no cue: his face, held. Run after kit.py, draw_panels.py
and prepare_takes.py, from the repository root:

    python docs/plans/2026-10-26-monday/video/configure.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
WORK = ROOT / '.cache/produce/2026-10-26-b358e788'
KIT = WORK / 'kit'
STORY = json.loads((ROOT / 'config/story-intro-outro.json').read_text(encoding='utf-8'))['approved']

W, T = '16x9', '9x16'


def cue(cid, start, end, shape, pages=None, on=None, panel=None, **extra):
    """pages: the drawn page ids in order (draw_panels.py names); a single page needs no `on`."""
    # a page that motion.py has animated plays as its mp4; the still is the fallback
    files = [f'../panels/{p}-{shape}.' + ('mp4' if (WORK / 'panels' / f'{p}-{shape}.mp4').exists() else 'png') for p in (pages or [cid])]
    if panel:
        files = [panel]
    c = {'id': cid, 'panel': files[0], 'start': start, 'end': end, **extra}
    if len(files) > 1:
        c['pages'] = {shape: files}
        c['on'] = on
        assert on and len(on) == len(files), cid
    return c


LONG = [
    # The first picture after the sting: the wall of friends, the statement, and the slam on "bust" (motion.py).
    cue('l01', 'Disney has basically asked', 'business as founders', W, panel='../panels/open-16x9.mp4'),
    cue('l02', 'So why are Disney', 'in the future', W, ['l02-p1', 'l02-p2', 'l02-p3'],
        ['So why are', 'Disney and Google', 'Google both paying']),
    cue('l03', "I've been reading the court", 'papers on Character', W),
    # What the app is: his own screen recording of its home page, pushed in, with hand-drawn rings (whatitis.py).
    cue('l03w', 'the app where millions', 'up characters', W, panel='../panels/whatitis-16x9.mp4'),
    cue('l05', "Let's start with Google", 'behind the app', W),
    cue('l06', 'So in 2024', 'research team away', W, ['l06-p1', 'l06-p2', 'l06-p3'],
        ['So in 2024', 'reportedly paid', 'hired the founders']),
    cue('l08', 'rest of the staff stayed', 'started running low', W),
    cue('l09', 'Disney wanted something else', 'last December', W),
    cue('l10', 'Disney agreed to put', 'retired video app', W, ['l10-p1', 'l10-p2'], ['Disney agreed to', 'over 200']),
    cue('l11', 'but Sora belonged', "someone else's app", W, ['l11-p1', 'l11-p2'], ['but Sora belonged', "someone else's app"]),
    cue('l12', 'Then in March', 'shut Sora down', W, ['l12-p1', 'l12-p2'], ['Then in March', 'shut Sora down']),
    cue('l13', 'the deal died', 'no money changed hands', W, ['l13-p2', 'l13-p3'], ['the deal died', 'no money changed']),
    cue('l15', 'So Disney changed its plan', 'technology chief', W),
    cue('l16', 'And this month', 'for three years', W, ['l16-p1', 'l16-p2'], ['And this month', 'jobs to 66']),
    cue('l17', 'On top of that', 'keeping children safe', W, ['l16-p2', 'l17'], ['On top of that', 'has bid']),
    cue('l19', 'filed for bankruptcy', '12th of October', W, ['l19-p1', 'l19-p2'], ['filed for bankruptcy', '12th of October']),
    cue('l20', 'and Disney made that', 'harmed children', W, ['l20-p1', 'l20-p2', 'l20-p3'],
        ['and Disney made that', 'low on cash', 'faced lawsuits']),
    cue('l21', 'going through to court', 'lawsuits stay behind', W, ['l21-p1', 'l21-p2'], ['going through to court', 'takes the people']),
    cue('l23', 'The people who use the app', 'up to the court', W, ['l23-p1', 'l23-p2', 'l23-p3'],
        ['The people who use', 'the app itself', "anyone's chat"]),
    cue('l24', 'And then there are the people suing', 'sold for parts', W),
    cue('l25', 'See, the money followed', 'holding the empty box', W),
    cue('l26', "And it isn't just Disney", 'an AI firm too', W, ['l26-p1', 'l26-p2'], ["And it isn't just", 'Warner Music bought']),
    cue('l27', 'The big media firms', 'or owning them', W),
    cue('l28', 'First Skydance', 'that owns NBC', W, ['l28-p1', 'l28-p2', 'l28-p3'], ['First Skydance', 'Universal Music and', 'Comcast the American']),
    cue('l29', 'So I reckon by the', 'all three of them will do this', W, ['l29-p1', 'l29-p2'], ['So I reckon', "And I'm 75"]),
    cue('l31', 'It might be a writing tool', 'go with it', W, ['l31-p1', 'l31-p2'], ['It might be a writing', 'switch off overnight']),
    cue('l33', 'First, are its founders', 'before it went bust', W),
    cue('l34', 'Secondly, is your tool', 'it vanished', W),
    cue('l35', 'Number three, is the firm', 'exactly about that', W),
    cue('l36', 'And fourth, is it collecting', 'went through the court', W),
    cue('l37', 'line up with plan B', 'your own data', W, tail=7.0),   # holds to the end: one close, no second branded screen
    # One close (Krish, 28 Oct: "we also don't need three separate outro transitions and screens. Ever."): the
    # branded call-to-action screen that used to sit here repeated the end card, so his face holds over the URL.
]

SHORT = [
    # Beat 1's label above his face, and beat 8's four blank cards: make.py's 9:16 gate needs a picture over
    # 90% of his words, no gap over 1.5 s and 20 changes a minute (creative-direction.json production_notes).
    cue('s01', "I've been having a look", 'on Character', T, panel='../panels/open-9x16.mp4'),
    cue('s01w', 'which is a chat', 'fictional characters', T, panel='../panels/whatitis-9x16.mp4'),
    cue('s01b', 'It ran low on cash', 'went bust', T, panel='../panels/bust-9x16.mp4'),
    cue('s02', 'So why did Google', 'pay for it', T, ['s02-p1', 's02-p2', 's02-p3'], ['So why did', 'Google and now', 'now Disney pay']),
    cue('s03', 'Google went for the brains', 'founders away', T, ['s03-p1', 's03-p2', 's03-p3'],
        ['Google went for', 'reportedly paid', 'hired the founders']),
    cue('s04', 'Well Disney wanted', 'shut Sora down', T, ['s04-p1', 's04-p2'], ['Well Disney wanted', 'shut Sora down']),
    cue('s05', 'So Disney is building', 'in total salary', T, ['s05-p1', 's05-p2', 's05-p3'],
        ['So Disney is building', 'hiring 66', '$60 million']),
    cue('s06', 'and by buying through', 'Google already own', T, ['s06-p1', 's06-p2'], ['and by buying', 'leaves those lawsuits']),
    cue('s07', 'So my prediction', 'all three of these will', T, ['s07-p1', 's07-p2', 's07-p3', 's07-p4', 's07-p5'],
        ['So my prediction', 'Skydance Universal', 'Universal Music and', 'Comcast will', 'around 75']),
    cue('s08', "So here's what I would do", 'your AI tool', T),
    cue('s09', 'Are its founders', 'piling up lawsuits', T, ['s09-p1', 's09-p2', 's09-p3', 's09-p4', 's09-p5'],
        ['Are its founders', 'Is your tool', 'Is it short', 'And is it piling', 'These are the clues'], tail=6.0),   # holds the four questions to the end: one close
]

# Krish's ruling on the takes (creative-direction.json take_edits): keep everything he said; the
# only cut is "which is fair enough", and only if it cuts cleanly (checked by ear after the plan).
LONG_REMOVE = [{'say': 'which is fair enough', 'after': 'harmed children'}]

# Caption words where the transcriber and he differ, each only with its evidence (second-listen.json,
# a second model, or his own words in take_edits); the sound is never touched.
LONG_REPLACE = [['Disney is basically asked', 'Disney has basically asked']]   # large-v3-turbo hears "has"
LONG_REPLACE += [["Character .ai's", "Character.AI's"], ['Character .ai', 'Character.AI'], ['MakeYourMindUp .ai', 'makeyourmindup.ai'],
                 ['first -ever', 'first-ever'], ['now -retired', 'now-retired'], ['made -up', 'made-up'],
                 # medium.en and the script hear "and"; large-v3-turbo "in": the script's words, put to Krish by ear.
                 ['families in U .S. states', 'families and US states'],
                 # Where the take's transcript and a fresh hearing of the finished file differ, the hearing that
                 # agrees with the script (make.py's heard check on the first render).
                 ['Altogether', 'All together'], ["here's a clever bit", "here's the clever bit"],
                 ['made that condition', 'made that a condition'], ['line up with Plan B', 'line up a Plan B']]
# large-v3-turbo hears "I reckon" (Krish, 2026-10-26: "I'm pretty sure I said "I reckon,"") and "if I were you. I'd ask
# four things" as he said them, so those need no fix. Both transcribers hear "haunted"; the script says harm and the
# line means it: captioned "harmed" and put to Krish by ear.
SHORT_REPLACE = [['haunted children', 'harm to children'],   # the finished file is heard as "harm to children", the script's words
                 ["Character .ai's", "Character.AI's"], ['Character .ai', 'Character.AI'], ['makeyourmindup .ai', 'makeyourmindup.ai'],
                 ['billion -dollar', 'billion-dollar']]

CHAPTERS = [
    {'title': 'Why is Disney eating the scraps of bankrupt Character.AI?', 'starts': 'Disney is basically asked'},
    {'title': "Google paid $2.7 billion for Character.AI's tech and founders", 'starts': "Let's start with Google"},
    {'title': "Disney rented space in OpenAI's Sora app", 'starts': 'Disney wanted something else'},
    {'title': "Disney is hiring Character.AI's team", 'starts': 'So Disney changed its plan'},
    {'title': "Disney leaves Character.AI's users and lawsuits behind", 'starts': "So who's left holding"},
    {'title': 'Skydance, Universal and Comcast: who buys AI next', 'starts': 'So my prediction is'},
    {'title': 'Four questions about your AI supplier', 'starts': 'why should you care'},
]


def configure(cut, shape, cues, extra):
    path = KIT / f'{cut}.json'
    cfg = json.loads(path.read_text(encoding='utf-8'))
    cfg.update({
        'source': f'../takes/{cut}-stable.mp4', 'crop': [1080, 1920, 0, 0],
        'intro': {shape: f'../story-io/intro-{shape}.mp4'}, 'endcard': {shape: f'../story-io/outro-one-{shape}.mp4'},
        'intro_override': f"Krish, {STORY['on']}: {STORY['words']}",
        'music': 'auto', 'series': 'follow_the_money', 'voice': 'repair', 'reframe': False,
        'max_gap': 0.9, 'pad_before': 0.2, 'pad_after': 0.3,
        # The burned captions come from this transcript: the stronger model that heard "I reckon" and
        # "if I were you" where small.en and medium.en did not (second-listen.json).
        'model': 'large-v3-turbo', 'captions': True, 'caption_style': 'house', 'cues': cues, **extra})
    path.write_text(json.dumps(cfg, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return cfg


configure('long', W, LONG, {'remove': LONG_REMOVE, 'replacements': LONG_REPLACE, 'strap': False, 'face': [690, 920],
                            'music_mode': 'episode', 'music_seconds': 100, 'chapters': CHAPTERS})
configure('short', T, SHORT, {'remove': [], 'replacements': SHORT_REPLACE, 'face': [690, 920], 'music_seconds': 90,
                              'strap': False})
print(f'configured: long {len(LONG)} cues, short {len(SHORT)} cues')
