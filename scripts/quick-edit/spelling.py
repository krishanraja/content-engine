#!/usr/bin/env python3
"""spelling: the British and US spellings of the same word, for quick-edit.

House rule BRITISH_SPELLING: colour, centre, theatre, organise, analyse,
defence, labour, modelling, travelled, grey. The scripts are written that
way, but the transcriber (faster-whisper small.en) often writes what it hears
the US way: "bring your check to court", "one neighbor", "a license can
become evidence". Two things follow, and both live here so make.py and kit.py
agree to the letter:

  fold(word)        one key for both spellings, used wherever a cue, a cut or
                    a restart is matched against the transcript, so a cue
                    that ends on "cheque to court" is found where the
                    transcript says "check to court";
  variant(s, h)     whether the heard word h is the script word s spelt the
                    other way, so make.py can caption it as the script spells
                    it (the script is the truth: the sounds are the same).

  looks_us(word)    a heard word that is the US spelling of a common word
                    (color, center, realize, traveled), for a warning when no
                    script word lines up with it, an ad-lib say.

Only spellings are folded, never a different word: "four" is never "for",
and "check" is "cheque" only where the script says "cheque".

    python spelling.py --self-test
"""
import re
import sys
from functools import lru_cache

# Whole words, British first. The rules below cover the rest.
WORDS = {
    'cheque': 'check', 'cheques': 'checks', 'chequebook': 'checkbook', 'programme': 'program', 'programmes': 'programs',
    'tyre': 'tire', 'tyres': 'tires', 'kerb': 'curb', 'grey': 'gray', 'greyer': 'grayer', 'aluminium': 'aluminum',
    'mum': 'mom', 'mums': 'moms', 'jewellery': 'jewelry', 'plough': 'plow', 'pyjamas': 'pajamas',
    'sceptic': 'skeptic', 'sceptics': 'skeptics', 'sceptical': 'skeptical', 'scepticism': 'skepticism',
    'draught': 'draft', 'enrol': 'enroll', 'enrolment': 'enrollment', 'fulfil': 'fulfill', 'fulfilment': 'fulfillment',
    'skilful': 'skillful', 'wilful': 'willful', 'instalment': 'installment', 'instalments': 'installments',
    'ageing': 'aging', 'judgement': 'judgment', 'judgements': 'judgments', 'acknowledgement': 'acknowledgment',
    'artefact': 'artifact', 'artefacts': 'artifacts', 'mould': 'mold', 'smoulder': 'smolder', 'cosy': 'cozy',
    'sulphur': 'sulfur', 'manoeuvre': 'maneuver', 'manoeuvres': 'maneuvers', 'odour': 'odor', 'odours': 'odors',
    'licence': 'license', 'licences': 'licenses', 'defence': 'defense', 'defences': 'defenses', 'offence': 'offense',
    'offences': 'offenses', 'pretence': 'pretense', 'practise': 'practice', 'practised': 'practiced', 'practising': 'practicing',
    'paediatric': 'pediatric', 'anaemia': 'anemia', 'oestrogen': 'estrogen', 'foetus': 'fetus', 'encyclopaedia': 'encyclopedia',
    'storeys': 'stories',
}
# British to US by rule: (pattern on the British word, its US form).
RULES = [
    (re.compile(r'^([a-z]{3,})our(s|ed|ing|ite|ites|able|ably|ful|fully|less|hood|er|ers)?$'), r'\1or\2'),  # colour, neighbour, favourite
    (re.compile(r'^([a-z]{2,})is(e|es|ed|ing|ation|ations|er|ers)$'), r'\1iz\2'),                      # realise, organisation
    (re.compile(r'^([a-z]{2,})ys(e|es|ed|ing)$'), r'\1yz\2'),                                             # analyse, paralyse
    (re.compile(r'^([a-z]*[aeiou])ll(ed|ing|er|ers)$'), r'\1l\2'),                                       # travelled, modelling
    (re.compile(r'^([a-z]{3,})ogue(s)?$'), r'\1og\2'),                                                     # catalogue, dialogue
    (re.compile(r'^([a-z]{2,}[^aeiou])re(s|d)?$'), r'\1er\2'),                                            # centre, theatre, fibre
]
# US words that are also British words of their own, never flagged by looks_us.
EVERYDAY = {'check', 'checks', 'program', 'programs', 'tire', 'tires', 'curb', 'draft', 'drafts', 'mold', 'practice', 'license',
            'licenses', 'meter', 'meters', 'mom', 'moms', 'analog', 'dialog', 'catalog', 'story', 'stories', 'size', 'sized',
            'sizes', 'seize', 'seized', 'prize', 'prizes', 'citizen', 'citizens', 'capsize', 'filing', 'later', 'order', 'water',
            'paper', 'center', 'centers'}
US_PATTERNS = [
    re.compile(r'^(col|hon|lab|neighb|behavi|fav|flav|harb|hum|rum|vap|sav|vig|arm|endeav|tum|od|val|ard|parl|splend|rig|clam)or(s|ed|ing|ite|ites|able|ably|ful|less|hood|er|ers)?$'),
    re.compile(r'^[a-z]{4,}iz(e|es|ed|ing|ation|ations)$'),
    re.compile(r'^(anal|paral)yz(e|es|ed|ing)$'),
    re.compile(r'^(theat|cent|lit|fib|calib|somb|spect|lust|sab|meag)er(s|ed)?$'),
    re.compile(r'^(travel|cancel|label|model|fuel|level|signal|counsel|marvel|total|channel|jewel|dial|duel|quarrel|tunnel)(ed|ing|er|ers)$'),
]


def letters(word):
    """The word in lower case, letters only (apostrophes and punctuation gone)."""
    return re.sub(r'[^a-z]', '', str(word).lower().replace('’', "'"))


@lru_cache(maxsize=8192)
def us_form(word):
    """The US spelling of a British word, or the word itself."""
    if word in WORDS:
        return WORDS[word]
    for rule, us in RULES:
        if rule.match(word):
            return rule.sub(us, word)
    return word


def fold(token):
    """One key for both spellings of a normalised token (make.py's norm:
    lower case, letters, digits, % and $). A token with anything but
    letters is left as it is."""
    return us_form(token) if token.isalpha() else token


def variant(script_word, heard_word):
    """True when the heard word is the script's word, spelt the other way."""
    s, h = letters(script_word), letters(heard_word)
    return bool(s and h and s != h and (us_form(s) == h or us_form(h) == s))


def looks_us(word):
    """True for a common word in its US spelling (color, realize, traveled)."""
    w = letters(word)
    if not w or w in EVERYDAY:
        return False
    return w in set(WORDS.values()) - EVERYDAY or any(p.match(w) for p in US_PATTERNS)


def self_test():
    checks = [
        ('cheque and check fold together', fold('cheque') == fold('check'), True),
        ('colour, neighbour, favourite', [fold(w) for w in ('colour', 'neighbours', 'favourite')], ['color', 'neighbors', 'favorite']),
        ('realise, organisation, analyse', [fold(w) for w in ('realise', 'organisation', 'analysed')], ['realize', 'organization', 'analyzed']),
        ('travelled, modelling, centre, theatre, catalogue', [fold(w) for w in ('travelled', 'modelling', 'centre', 'theatre', 'catalogue')],
         ['traveled', 'modeling', 'center', 'theater', 'catalog']),
        ('a US word folds to itself', [fold(w) for w in ('color', 'realize', 'center', 'check', 'license')], ['color', 'realize', 'center', 'check', 'license']),
        ('four is never for, your never yor, more never mor', [fold(w) for w in ('four', 'your', 'more', 'hour')], ['four', 'your', 'more', 'hour']),
        ('numbers and money are left alone', [fold(w) for w in ('150000', '$5', '70%', 'mp4')], ['150000', '$5', '70%', 'mp4']),
        ('variant: the reviewer\'s three', [variant('cheque', 'check'), variant('neighbour', 'neighbor'), variant('licence', 'license')], [True, True, True]),
        ('variant: a word and itself, or two words, are not', [variant('check', 'check'), variant('four', 'for'), variant('Licence,', 'licence')], [False, False, False]),
        ('variant: punctuation and capitals do not count', variant('Cheque.', 'check,'), True),
        ('looks_us: color, realize, traveled, center-ish words', [looks_us(w) for w in ('color', 'realized', 'traveled', 'theater', 'gray')], [True, True, True, True, True]),
        ('looks_us: everyday words that are British too', [looks_us(w) for w in ('check', 'license', 'size', 'four', 'colour', 'program')], [False] * 6),
    ]
    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'spelling self-test passed: {len(checks)} checks')
    return 1 if bad else 0


if __name__ == '__main__':
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    print(__doc__)
