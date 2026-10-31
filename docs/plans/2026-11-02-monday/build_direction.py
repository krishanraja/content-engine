#!/usr/bin/env python3
"""Builds Monday 2 November's creative-direction.json from the sentence beats the template wrote.

The beats below group the script's sentences (indexes into the template's one-sentence beats) and say what each group
shows. Timing comes from the take's own word clock (takes/<cut>.words.json), lined up with the script word by word,
so every beat's window is where he said those words. Run from the repository root:

    python3 docs/plans/2026-11-02-monday/build_direction.py
"""
import difflib
import json
import re
from pathlib import Path

PLAN = Path('docs/plans/2026-11-02-monday')
REPORT = 'https://www-cdn.anthropic.com/72628f1863c53432195db83279252dfd2cb53158/Employment%20at%20Anthropic.pdf'
IMF = 'https://www.imf.org/external/pubs/ft/fandd/2015/03/bessen.htm'
NPR = 'https://www.npr.org/sections/money/2015/02/25/389027988/episode-606-spreadsheets'
STANFORD = ('https://digitaleconomy.stanford.edu/event/seyed-m-hosseini-and-guy-lichtinger-generative-ai-as-'
            'seniority-biased-technological-change-evidence-from-u-s-resume-and-job-posting-data/')
LOGOS = 'docs/plans/2026-11-02-monday/logos/'
MOTION = 'docs/plans/2026-11-02-monday/motion-system.md'
R_LABEL = 'ANTHROPIC · OCT 2026'

FACE_LONG = {'kind': 'face', 'what': 'him to camera, his portrait in the full-height column, room treated (darkened and softened behind him)', 'source': '', 'source_label': ''}
FACE_SHORT = {'kind': 'face', 'what': 'him to camera, full frame, room treated (darkened and softened behind him)', 'source': '', 'source_label': ''}


def pic(kind, what, source, label=''):
    return {'kind': kind, 'what': what, 'source': source, 'source_label': label}


LONG = [
    ([0], 'The hook: the company that makes the AI is itself hiring far fewer juniors',
     FACE_LONG, 'ANTHROPIC · ITS OWN STAFF', ['treated-background'], 'still; the label types in on "fallen off a cliff"'),
    ([1], 'The question the piece answers, set on the object the whole piece uses',
     pic('card', 'The Ladder appears, drawn in cream line on the ink desk; the top rung lights with 2030, the bottom rung is drawn last and faint', MOTION),
     '2030', ['mechanism-image', 'constant-motion'], 'rungs draw bottom to top; 2030 lands on "2030"'),
    ([2, 3], 'This comes from Anthropic\'s own report on its own staff, not a rumour',
     pic('document', 'The report\'s cover, "How Employment is Changing at Anthropic", The Anthropic Institute', REPORT, R_LABEL),
     '', ['screen-proof'], 'slow push into the title'),
    ([4, 5], 'Early 2025: one in four new technical hires was a junior',
     pic('chart', 'The bottom rung holds four hire marks, one of them butter-underlined: the junior', REPORT, R_LABEL),
     '27% · EARLY 2025', ['one-stat-per-frame', 'number-in-scene'], 'the four marks arrive on "one in four"'),
    ([6], 'The big moment: the junior share of hires fell from 27% to 9%',
     pic('chart', 'The bottom rung\'s number counts down 27 to 9 in one second and the rung thins to a hairline', REPORT, R_LABEL),
     '27% → 9%', ['one-stat-per-frame', 'number-in-scene'], 'the count starts on "27%" and lands on "9%"; the piece\'s big moment'),
    ([7, 8], 'Why: by August AI agents were working six times the hours of the staff',
     pic('chart', 'Two bars side by side, staff hours and agent hours; the agent bar grows to six times the staff bar', REPORT, R_LABEL),
     '6 TO 1 · AUGUST', ['one-stat-per-frame', 'constant-motion'], 'the agent bar grows on "far more hours"'),
    ([9], 'The managers say it out loud: AI is why they hire less',
     pic('document', 'The report\'s line "Around a third of ML and a fifth of SWE managers reported hiring less due to AI", highlighted', REPORT, R_LABEL),
     '1 IN 3 ML MANAGERS', ['screen-proof'], 'highlight sweeps on "hiring less"'),
    ([10], 'The mechanism in one sentence: the first draft was the junior\'s work',
     FACE_LONG, '', ['treated-background'], ''),
    ([11, 12], 'It is not only Anthropic: a study of US firms finds the same',
     pic('document', 'The study\'s page, "Generative AI as Seniority-Biased Technological Change", Stanford Digital Economy Lab', STANFORD, 'HOSSEINI & LICHTINGER · 2025'),
     '', ['screen-proof'], 'slow push into the title'),
    ([13], 'Where firms adopt AI, junior jobs fall while senior jobs keep rising',
     pic('chart', 'Two lines from 2023: senior employment keeps rising, junior employment turns down; no numbers on the axis, only the direction the study reports', STANFORD, 'HOSSEINI & LICHTINGER · 2025'),
     'SINCE 2023 · FIRMS USING AI', ['number-in-scene', 'constant-motion'], 'the two lines part on "while senior jobs kept growing"'),
    ([14, 15], 'It happens through hires that never happen, not layoffs',
     pic('document', 'The study\'s line "The junior decline is driven primarily by slower hiring rather than increased separations", highlighted', STANFORD, 'HOSSEINI & LICHTINGER · 2025'),
     '', ['screen-proof'], 'highlight sweeps on "slower hiring"'),
    ([16, 17], 'The turn: this has happened before, twice',
     FACE_LONG, 'ATMS · SPREADSHEETS', ['treated-background'], 'the label lands on "Twice"'),
    ([18, 19], 'Cash machines cut the tellers a city branch needed from 20 to 13',
     pic('chart', 'A branch drawn as 20 teller marks; seven fade, 13 remain', IMF, 'IMF · BESSEN 2015'),
     '20 → 13 · 1988 TO 2004', ['one-stat-per-frame', 'number-in-scene'], 'marks fade on "20 tellers to 13"'),
    ([20, 21], 'Banks spent the savings on more branches: 43% more in cities',
     pic('chart', 'The branch copies itself across the desk until there are 43% more', IMF, 'IMF · BESSEN 2015'),
     '+43% BRANCHES', ['one-stat-per-frame', 'number-in-scene'], 'copies appear on "more branches", the number on "43%"'),
    ([22, 23], 'The teller job held up and changed: less cash, more people',
     pic('document', 'The IMF article\'s line "cash handling became less important and human interaction more important", highlighted', IMF, 'IMF · BESSEN 2015'),
     '', ['screen-proof'], 'highlight sweeps on "more time with customers"'),
    ([24, 25, 26], 'Spreadsheets took 400,000 clerk jobs and added 600,000 accountant jobs',
     pic('chart', '400,000 clerk marks fall away; 600,000 accountant marks stack up above them, taller', NPR, 'NPR PLANET MONEY · 2015'),
     '−400,000 · +600,000 · SINCE 1980', ['one-stat-per-frame', 'number-in-scene'], 'the fall on "have gone", the stack on "added"'),
    ([27], 'Why the jobs grew back: cheaper work, more of it bought',
     FACE_LONG, '', ['treated-background'], ''),
    ([28], 'The pattern: the tool takes the bottom, the job grows taller',
     pic('card', 'Both scenes fold back into the Ladder, now taller than at the start, a new rung added at the top', MOTION),
     '', ['mechanism-image', 'constant-motion'], 'the ladder grows on "got bigger"'),
    ([29], 'His turn to what worries him this time', FACE_LONG, '', ['treated-background'], ''),
    ([30, 31], 'Back then the bottom rung was still there to start on',
     pic('card', 'The taller Ladder, its bottom rung solid, marked TELLER and CLERK in Plex Mono as the two starting jobs', MOTION),
     '', ['mechanism-image'], 'the bottom rung brightens on "first step"'),
    ([32], 'This time the bottom rung itself goes: the first draft was the learning',
     pic('card', 'The Ladder with no bottom rung: the camera rests on the gap. The frame the cover and thumbnail echo', MOTION),
     '', ['mechanism-image'], 'the bottom rung lifts away on "first draft itself"; hold'),
    ([33], 'Anthropic\'s report says so itself',
     pic('document', 'The report\'s line "In some roles, they are increasingly removed from the object-level work that originally built their skills", highlighted', REPORT, R_LABEL),
     '', ['screen-proof'], 'highlight sweeps on "hands-on work"'),
    ([34], 'His read: juniors feel this most, said as his', FACE_LONG, '', ['treated-background'], ''),
    ([35, 36], 'The cut is invisible: it lands on people never hired',
     pic('document', 'The report\'s line "Employment protections for incumbents will not benefit those not hired to begin with", highlighted', REPORT, R_LABEL),
     '', ['screen-proof'], 'highlight sweeps on "never get hired"'),
    ([37, 38, 39], 'What managers want now is judgement',
     pic('document', 'The report\'s line "Hiring managers increasingly emphasize applicants\' autonomy and judgment relative to specific technical expertise", highlighted', REPORT, R_LABEL),
     '', ['screen-proof'], 'highlight sweeps on "judgement"'),
    ([40, 41], 'Judgement is learned in the junior years', FACE_LONG, '', ['treated-background'], ''),
    ([42, 43], 'Take away the junior rung and judgement has nowhere to grow',
     pic('card', 'The Ladder with its gap; JUDGEMENT sits on a high rung with nothing beneath it to climb from', MOTION),
     'JUDGEMENT', ['mechanism-image'], 'the word lands on "judgement"; hold on the gap'),
    ([44], 'This is every company\'s problem, and Anthropic is only early', FACE_LONG, '', ['treated-background'], ''),
    ([45], 'Anthropic\'s staff expect AI to do 75% of their work by 2030, against 28% for other Americans',
     pic('chart', 'Two numbers, 75% for Anthropic staff and 28% for other Americans, as of August', REPORT, R_LABEL),
     '75% · OTHER AMERICANS 28%', ['one-stat-per-frame', 'number-in-scene'], '75% lands on "75%"; 28% follows'),
    ([46, 47, 48], 'Your 2030 seniors are today\'s juniors: no hire, no training',
     pic('card', 'The Ladder\'s top rung lights mint with 2030; a line runs from it down to the gap where the junior rung was', MOTION),
     '2030', ['mechanism-image', 'constant-motion'], 'the line runs down on "juniors somewhere today"'),
    ([49, 50, 51], 'The dull job, told about a new hire (in both takes he tells it as "picture a new hire given a dull job", not as his own)',
     pic('card', 'A new hire\'s desk drawn on the ink desk: one spreadsheet open, the same task waiting row after row. No company logo, no year, no name', MOTION),
     '', ['one-person-story', 'mechanism-image'], 'the sheet opens on "a new hire"', '3:08.72-3:11.20 in the take (2.5 s)'),
    ([52, 53], 'The same task by hand, for weeks',
     pic('card', 'The sheet\'s rows scroll while the same click repeats; a week counter ticks past week 1, 2, 3', MOTION),
     'WEEK 3', ['constant-motion'], 'the counter ticks on "weeks and weeks"', '3:11.20-3:16.60 in the take (5.4 s)'),
    ([54, 55], 'They spot the repeat and go looking for a better way',
     pic('card', 'The same sheet: one recorded action now repeats itself down the rows; the first two tries stop part way, the third runs to the end', MOTION),
     '', ['constant-motion'], 'the tries fail on "the first attempt doesn\'t work" and "neither does the second"', '3:16.66-3:23.30 in the take (6.6 s)'),
    ([56], 'It was a risk: days that might be wasted', FACE_LONG, '', ['treated-background'], '', '3:23.30-3:27.20 in the take (3.9 s)'),
    ([57], 'Weeks of work shrink to a few hours',
     pic('card', 'The week counter collapses to a few hours on one day', MOTION),
     '', ['constant-motion'], 'the collapse on "shrink to a few hours"', '3:27.30-3:31.20 in the take (3.9 s)'),
    ([58, 59, 60, 61], 'The lesson is the habit, and the dull job is where it forms', FACE_LONG, '', ['treated-background'], '', '3:31.36-3:50.20 in the take (18.8 s)'),
    ([62, 63, 64], 'Two questions for the next hiring meeting',
     pic('card', 'Two mint cards settle on the gap in the Ladder, one on each question', MOTION),
     'NEXT HIRING MEETING', ['mechanism-image'], 'one card per question, each on its question'),
    ([65, 66, 67, 68], 'A word to juniors: ask what you will learn on, then build the fix', FACE_LONG, '', ['treated-background'], ''),
    ([69], 'He turns to what to do, as himself, before the three actions', FACE_LONG, '', ['treated-background'], ''),
    ([70, 71], 'Action one: name each team\'s seniors for 2030 and what they learn on',
     pic('card', 'Action card 1 in mint on the ink desk', MOTION), '1 · EACH TEAM, 4 YEARS OUT', ['better-way'], 'card on "For each team"'),
    ([72, 73], 'Action two: check the last three hiring decisions',
     pic('card', 'Action card 2 in mint on the ink desk', MOTION), '2 · YOUR LAST 3 HIRES', ['better-way'], 'card on "last three"'),
    ([74, 75], 'Action three: give one junior a dull weekly job to own',
     pic('card', 'Action card 3 in mint on the ink desk', MOTION), '3 · ONE DULL WEEKLY JOB', ['better-way'], 'card on "dull weekly job"'),
    ([76], 'Where to read the rest',
     pic('card', 'The one house end card: makeyourmindup.ai', 'config/studio.json'), 'MAKEYOURMINDUP.AI', [], 'one calm close, held long enough to read'),
]

SHORT = [
    ([0, 1], 'The hook and the question', FACE_SHORT, 'ANTHROPIC · ITS OWN STAFF', ['full-face-vertical'], 'the label types in on "collapsed"'),
    ([2, 3], 'The big moment: junior hires fell from 27% to 9%',
     pic('chart', 'The Ladder above his face; the bottom rung\'s number counts down 27 to 9 and the rung thins to a hairline', REPORT, R_LABEL),
     '27% → 9%', ['one-stat-per-frame', 'number-in-scene'], 'the count starts on "one in four" and lands on "one in ten"'),
    ([4], 'The managers say AI is why',
     pic('document', 'The report\'s line "Around a third of ML and a fifth of SWE managers reported hiring less due to AI", highlighted', REPORT, R_LABEL),
     '1 IN 3 ML MANAGERS', ['screen-proof'], 'highlight sweeps on "AI is why"'),
    ([5, 6], 'Twice before, the job came back bigger',
     pic('chart', 'Two quick frames: the branch copies itself to 43% more; 600,000 accountant marks stack over 400,000 fallen clerk marks', IMF, 'IMF · NPR PLANET MONEY'),
     '+43% BRANCHES · +600,000 ACCOUNTANTS', ['one-stat-per-frame'], 'one frame per tool, each on its name'),
    ([7], 'His turn: why this time may not end like the last two', FACE_SHORT, '', ['full-face-vertical'], ''),
    ([8], 'This time the bottom rung goes',
     pic('card', 'The Ladder with no bottom rung, above his face', MOTION), '', ['mechanism-image'], 'the rung lifts away on "first draft itself"'),
    ([9, 10], 'Nobody is fired, the job never opens',
     pic('document', 'The report\'s line "Employment protections for incumbents will not benefit those not hired to begin with", highlighted', REPORT, R_LABEL),
     '', ['screen-proof'], 'highlight sweeps on "never opens"'),
    ([11, 12], 'The dull job is where the lesson lives',
     pic('card', 'A spreadsheet of rows; the same action repeats itself down them', MOTION), '', ['constant-motion'], 'the action repeats on "repeats"'),
    ([13, 14, 15], 'Two questions before cutting a junior role',
     pic('card', 'Two mint cards settle on the gap in the Ladder; the top rung reads 2030', MOTION), 'BEFORE YOU CUT A JUNIOR ROLE', ['mechanism-image'], 'one card per question'),
    ([16], 'He turns to what to do, before the two actions', FACE_SHORT, '', ['full-face-vertical'], ''),
    ([17, 18], 'Two actions: name the future seniors, and give a junior one dull job',
     pic('card', 'Two mint action cards, one on each sentence', MOTION), '1 · NAME THEM · 2 · ONE DULL JOB', ['better-way'], 'one card per action'),
    ([19], 'Where to read the rest', pic('card', 'The one house end card: makeyourmindup.ai', 'config/studio.json'), 'MAKEYOURMINDUP.AI', [], 'one calm close'),
]


TOP = {
    'publish_day': '2026-11-02',
    'style': {'script': 'fry-explainer', 'production': 'fry-talking-head',
              'experiment': 'data-story: one number per frame on one career ladder, 27 then 9, then six to one '
                            '(his note on the chart he saved: the chart makes a boring research report instantly understandable)'},
    'brand': {
        'series': 'follow.the.money',
        'reference': 'docs/plans/2026-10-26-monday/creative-direction.json (signed 27 Oct, the accepted Monday 26 cuts) and scripts/post-pack/tokens.css',
        'captions': 'burned into every cut, as Monday 26 (Krish, 2026-10-27: captions burned into every cut): the house captions, cream Archivo Black on an ink block, a hard shadow in follow.the.money\'s butter, sentence case, at most one loud word per line. Kinetic: each line lands word by word on the word he says (fry-talking-head)',
        'intro_sting': 'none: the hook is the intro (under test, ruling 8)',
        'route': 'the 19 Oct quick-edit route (kit.py, make.py, quality.py) with the Ladder drawn by the timeline renderer Monday 26 used (docs/plans/2026-10-26-monday/video/motion.py): pictures sit beside his face (16:9) or above it (9:16), every change of picture lands on the word that names it, documents push in slowly',
    },
    'production_choices': {
        'opening': 'hook_is_intro',
        'lead_picture': {
            'series_picture': {'what': 'The money map and the receipt: flows between parties, width is the amount. Here: new technical hires split into senior hires and juniors, the junior flow 9% wide, with 27% struck through',
                               'still': 'docs/plans/2026-11-02-monday/stills/series-picture.png'},
            'story_object': {'what': 'The Ladder with no bottom rung: 2030 lit on the top rung, the junior rung gone, 9% with 27% struck through beside the gap',
                             'still': 'docs/plans/2026-11-02-monday/stills/story-object.png'},
            'proposed': 'story_object',
            'ticked': None,
        },
        'big_moment_sound': 'none',
    },
    'take_edits': {
        'ruling': 'Krish, 2026-10-26: "That\'s just how I talk. Unless you think there are serious flaws in it, they\'re not really slips as much as they are just me talking naturally."',
        'rule': 'Keep everything he said as he said it. Cut only a serious flaw, only where the cut is inaudible, judged by ear at full volume. If it cannot be cut cleanly, keep it.',
        'long': [
            {'at': '0:00.08-0:02.52', 'words': 'So we had one today, and that\'s a', 'why': 'a lead-in before the hook; the cut opens on "Junior hiring at Anthropic" (the hook is the intro)', 'clean': 'yes: it is the head of the file, so nothing is joined', 'recommended': True},
            {'at': '0:05.00', 'words': '"which is the AI company buying Claude" (as transcribed)', 'why': 'listen first: if he said "buying" rather than "behind", the line says Anthropic bought Claude, which is wrong. If it is "behind", keep it', 'clean': 'only if the whole aside lifts out between "Anthropic" and "has fallen off a cliff" without a clipped breath; otherwise keep and correct the caption only if the words are "behind"', 'recommended': False},
        ],
        'short': [],
        'his_story': 'In both takes he tells the dull-job story about "a new hire" instead of his own first job at Microsoft (long 3:08.7 to 3:50.2; short 0:37.2 to 0:44.7). Kept as he said it: the pictures follow his words, so nothing shows Microsoft, Excel or 2008.',
        'heard_check': 'Transcriber words to confirm by ear, not to cut: long 0:14 "its own stuff" (staff), 0:39 "hiring lists" (less), 4:43 "make your mind hop" (makeyourmindup); short 0:21 "start to work" (starter work), 0:24 "lean on" (learn on), 1:00 "so that they learn it with AI" (he may have dropped "then": kept either way, it cannot be added).',
    },
    'production_notes': [
        'Both takes are portrait selfies (1080x1920) named "Documentary VO draft"; they are his on-camera takes of the signed words (matched word by word on 31 Oct and recorded on the piece). The 16:9 cut uses the portrait in a full-height column, as Monday 26.',
        'Assess camera shake on both takes before composing (the media standard); record the decision.',
        'The fact gate still holds one line of the article for his yes (the IMF piece\'s author, James Bessen). The on-screen credit "IMF · BESSEN 2015" rests on the same byline, so it waits on the same yes; if he says no, it reads "IMF · 2015".',
    ],
    'article': {'visuals': [{
        'point': 'The past rungs came back bigger; this one may not',
        'question': 'Is this just another ATM moment?',
        'what': 'One chart from the checked numbers only: tellers per branch 20 to 13 with branches up 43%; bookkeeping clerks down 400,000 and accountants up 600,000; Anthropic\'s junior technical hires 27% to 9%, with the rung that came back left as an empty space',
        'source': [IMF, NPR, REPORT],
    }]},
    'motion_system': {'name': 'The Ladder', 'file': 'docs/plans/2026-11-02-monday/motion-system.md'},
    'do_not': [
        'Never his name, his employer or a year of his life on screen: in both takes he tells the dull-job story about "a new hire", so no Microsoft or Excel logo and no 2008',
        'No on-screen label repeats what he says (the burned captions carry his words); a label adds a number, a date or its producer',
        'No figures or icons acting out a sentence; the Ladder only ever shows a number or the gap',
        'No eyebrow text, asterisks, "our read" tags or AI notes',
        'Never invent a word, number, label or picture; a gap goes back to Claude',
    ],
}


# Krish, 2026-10-31: "I want way more animation than ever before and movement." Nothing holds still: every beat
# carries a move of its own beneath the one on its word, and no picture rests longer than about 1.5 seconds.
KEEP_MOVING = {
    'face': 'his column breathes: a slow 3% push across the beat, the treated room drifting behind him, and the next picture already sliding in at its edge',
    'document': 'the camera travels down the page to the line and keeps pushing while the highlight sweeps; paper lifts off the desk with a soft shadow; never still over 1.5 s',
    'chart': 'everything keeps moving: the desk drifts, layers part in parallax, numbers count and never cut, marks arrive with a small overshoot; never still over 1.5 s',
    'card': 'everything keeps moving: the desk drifts, layers part in parallax, objects ease in with a small overshoot and settle into a slow float; never still over 1.5 s',
    'logo': 'logos slide in on their names and float, never pasted flat; never still over 1.5 s',
}


def norm(t):
    return re.sub(r"[^a-z0-9%]", '', t.lower().replace('one in four', '1in4'))


def sentence_windows(sentences, words):
    """Each sentence's (start, end) in the take, by lining the script's words up with the take's."""
    s_tok, s_idx = [], []
    for i, s in enumerate(sentences):
        for w in s.split():
            n = norm(w)
            if n:
                s_tok.append(n); s_idx.append(i)
    t_tok = [norm(w['w']) for w in words]
    sm = difflib.SequenceMatcher(None, s_tok, t_tok, autojunk=False)
    hits = {}
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            hits.setdefault(s_idx[a + k], []).append(b + k)
    return {i: (words[min(v)]['s'], words[max(v)]['e']) for i, v in hits.items()}


def fmt(t):
    return f'{int(t // 60)}:{t % 60:05.2f}'


def build(cut, spec, direction):
    sentences = json.loads((PLAN / 'template-beats.json').read_text())[cut]
    flat = [i for group in spec for i in group[0]]
    assert flat == list(range(len(sentences))), f'{cut}: the beats must cover every sentence once, in order'
    words = json.loads((PLAN / 'takes' / f'{cut}.words.json').read_text())['words']
    win = sentence_windows(sentences, words)
    beats = []
    for group, point, picture, text, modules, motion, *by_hand in spec:
        found = [win[i] for i in group if i in win]
        if by_hand:
            timing = by_hand[0]
        elif found:
            s, e = min(x[0] for x in found), max(x[1] for x in found)
            timing = f'{fmt(s)}-{fmt(e)} in the take ({e - s:.1f} s)'
        else:
            timing = 'not heard in the take: production checks by ear'
        keep_moving = KEEP_MOVING.get(picture['kind'], KEEP_MOVING['card'])
        motion = f'{motion}; {keep_moving}' if motion else keep_moving
        if 'constant-motion' not in modules and picture['kind'] != 'face':
            modules = modules + ['constant-motion']
        beats.append({'words': ' '.join(sentences[i] for i in group), 'point': point, 'picture': picture,
                      'on_screen_text': text, 'modules': modules, 'motion': motion, 'timing': timing})
    direction['cuts'][cut]['beats'] = beats


def main():
    path = PLAN / 'creative-direction.json'
    d = json.loads(path.read_text())
    d.update(TOP)
    build('long', LONG, d)
    build('short', SHORT, d)
    path.write_text(json.dumps(d, indent=1, ensure_ascii=False) + '\n')
    print('wrote', path, len(d['cuts']['long']['beats']), 'long beats,', len(d['cuts']['short']['beats']), 'short beats')


if __name__ == '__main__':
    main()
