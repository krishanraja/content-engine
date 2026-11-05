"""His lexicon: the names and terms he says, what the transcriber mishears them as, and the words he adds when he talks.

Krish, 5 Nov 2026: "kind of like Wispr Flow, it should also learn me as well as the common words that I say."

One file, config/voice/lexicon.json, text only (never media). The engine learns facts into it by itself:

  terms        names and terms from his signed scripts (ByteDance, Higgsfield, Opus 5.5), with how often they came up;
  fixes        what the transcriber heard against what the script spells ("Bike Dance" for ByteDance). The seeded rows
               came from quick-edit's DEFAULT_FIXES; a learned row is applied to captions only once two takes heard it;
  hesitations  the sounds that are never words (um, uh, er) and how often he makes each;
  habits       the words he adds that the script does not have (his "So", "Right", "Look"), counted.

It is read in three places: the transcriber's prompt and hotwords (ve ingest, scripts/transcribe.py, quick-edit), the
caption fixes (quick-edit), and the fumble pass (velib/hear.py reads the hesitations).

What it never does: decide taste. Counting that he opens with "So" is a fact; keeping or cutting it is Krish's call
(AGENTS.md: a durable taste rule needs his approval), so learn() writes such a thing to `proposals` and nothing reads
a proposal. His own name is never a term, a fix or a prompt word (Krish, 2026-10-28: no content refers to him).
"""
from __future__ import annotations

import difflib
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / 'config' / 'voice' / 'lexicon.json'
SCHEMA = 'voice-lexicon/1'

# Sounds that are never words. A hesitation is a fumble wherever it is heard outside the script.
HESITATIONS = frozenset({'um', 'umm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'ah', 'ahh', 'eh', 'hmm', 'hm', 'mm', 'mmm'})
NEVER = ('krish', 'chris', 'kris', 'raja')   # his name in any hearing: never a term, fix or prompt word
PROMPT_HEAD = 'makeyourmindup.'
APPLY_AFTER = 2           # a learned fix is applied to captions once this many takes heard it
TERM_SKIP = {'The', 'This', 'That', 'And', 'But', 'So', 'Now', 'Our', 'If', 'One', 'First', 'Then', 'When', 'What',
             'How', 'Why', 'It', 'They', 'You', 'We', 'He', 'She', 'Let', 'Back', 'In', 'On', 'I', 'A', 'An', 'Here',
             'There', 'Every', 'Most', 'Nobody', 'Instead', 'Before', 'After', 'Think', 'People', 'Yes', 'No', 'Not',
             'Visit', 'See', 'Look', 'Today', 'Tomorrow', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'}
TERM = re.compile(r"\b(?:[A-Z][a-z]*[A-Z][A-Za-z]*|[A-Z]{2,}[a-z]*|[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)"
                  r"(?:[ -](?:\d+(?:\.\d+)?|[IVX]+))?\b|\b[A-Za-z]+-\d+(?:\.\d+)?\b")


def _empty() -> dict:
    return {'schema': SCHEMA, 'terms': [], 'fixes': [], 'hesitations': {'counts': {}}, 'habits': {'added': {}},
            'proposals': [], 'learned_from': []}


def load(path: Path | str | None = None) -> dict:
    path = Path(path or PATH)
    if not path.is_file():
        return _empty()
    doc = json.loads(path.read_text(encoding='utf-8'))
    if doc.get('schema') != SCHEMA:
        raise ValueError(f'{path}: not a {SCHEMA} lexicon')
    base = _empty()
    base.update(doc)
    return base


def save(doc: dict, path: Path | str | None = None) -> Path:
    path = Path(path or PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc['terms'].sort(key=lambda t: (-t.get('count', 0), t['text'].lower()))
    doc['fixes'].sort(key=lambda f: (f['fixed'].lower(), f['heard'].lower()))
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return path


def _bare(text: str) -> str:
    return re.sub(r"[^0-9a-z]+", '', text.lower().replace('’', "'"))


def names_him(text: str) -> bool:
    """His name anywhere in it, run together or not ("KrishRaja", "content.krishraja.com")."""
    bare = _bare(text)
    return any(n in bare for n in NEVER)


def is_hesitation(text: str) -> bool:
    return _bare(text) in HESITATIONS


def script_terms(text: str) -> list[str]:
    """The names and terms in a script, in order of first use: mixed case, capitals, a capitalised run, a model
    number ("Opus 5.5", "GPT-6"). Sentence openers and his name are left out."""
    out = []
    for match in TERM.finditer(text):
        term = match.group(0).strip()
        if term.split()[0] in TERM_SKIP or names_him(term) or term in out:
            continue
        out.append(term)
    return out


def terms(doc: dict | None = None, script_text: str | None = None, limit: int = 60) -> list[str]:
    """The script's own terms first, then the lexicon's most used."""
    doc = doc if doc is not None else load()
    out = script_terms(script_text) if script_text else []
    for row in doc['terms']:
        if row['text'] not in out and not names_him(row['text']):
            out.append(row['text'])
    return out[:limit]


def prompt(doc: dict | None = None, script_text: str | None = None, limit: int = 60) -> str:
    """The transcriber's hint: the publication and the terms, never his name."""
    names = terms(doc, script_text, limit)
    return PROMPT_HEAD + (' ' + ', '.join(names) + '.' if names else '')


def hotwords(doc: dict | None = None, script_text: str | None = None, limit: int = 40) -> str:
    return ' '.join(terms(doc, script_text, limit)) or ''


def fixes(doc: dict | None = None, script_text: str | None = None) -> list[list[str]]:
    """[[heard, fixed], ...] to apply to captions: every seeded fix; a learned one only for a piece whose script
    spells the fixed term, and once APPLY_AFTER takes heard it. A learned fix is never applied blind: "cloud" heard
    for Claude would otherwise turn every cloud into Claude in a piece about the weather."""
    doc = doc if doc is not None else load()
    script = _bare(script_text or '')
    return [[f['heard'], f['fixed']] for f in doc['fixes']
            if f.get('status') == 'seeded'
            or (f.get('count', 0) >= APPLY_AFTER and script and _bare(f['fixed']) and _bare(f['fixed']) in script)]


def _add_term(doc: dict, text: str, source: str) -> bool:
    for row in doc['terms']:
        if row['text'] == text:
            row['count'] = row.get('count', 0) + 1
            if source not in row['sources']:
                row['sources'] = (row['sources'] + [source])[-5:]
            return False
    doc['terms'].append({'text': text, 'count': 1, 'sources': [source]})
    return True


def _add_fix(doc: dict, heard: str, fixed: str, source: str) -> bool:
    for row in doc['fixes']:
        if row['heard'].lower() == heard.lower() and row['fixed'] == fixed:
            if source not in row.get('sources', []):
                row['count'] = row.get('count', 0) + 1
                row['sources'] = (row.get('sources', []) + [source])[-5:]
            return False
    doc['fixes'].append({'heard': heard, 'fixed': fixed, 'status': 'learned', 'count': 1, 'sources': [source]})
    return True


def misheard(script: str, said: str) -> bool:
    """A script term the transcriber wrote as something that sounds like it: short on both sides, the script side a
    name or a number, and the letters close ("Bike Dance" and "ByteDance", "Entropic" and "Anthropic")."""
    if not script or not said or len(script.split()) > 3 or len(said.split()) > 3:
        return False
    if not (re.search(r'[A-Z]', script[1:]) or re.search(r'\d', script) or script_terms(script)):
        return False
    a, b = _bare(script), _bare(said)
    if not a or not b or a == b:
        return False
    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.6


def learn(doc: dict, script_text: str, said_report: dict, today: str | None = None) -> dict:
    """Fold one take's facts in: the script's terms, the mishearings `ve said` found, his hesitations and added words.
    Each take is learned once (by its media hash). Returns what changed."""
    source = f"{said_report.get('take')}:{str(said_report.get('media_sha256', ''))[:12]}"
    if source in doc['learned_from']:
        return {'source': source, 'skipped': 'already learned from this take'}
    changed = {'source': source, 'terms': [], 'fixes': [], 'hesitations': {}, 'added': {}}
    for term in script_terms(script_text):
        if _add_term(doc, term, source):
            changed['terms'].append(term)
    for dev in said_report.get('differences') or []:
        script, said = (dev.get('script') or '').strip(' .,;:!?'), (dev.get('said') or '').strip(' .,;:!?')
        tags = set(dev.get('tags') or [])
        if dev.get('kind') == 'said differently' and not tags & {'contraction', 'number', 'restart'} and misheard(script, said) \
                and not names_him(script) and not names_him(said):
            if _add_fix(doc, said, script, source):
                changed['fixes'].append([said, script])
        if dev.get('kind') == 'added':
            for word in said.split():
                bare = _bare(word)
                if not bare or names_him(word):
                    continue
                if bare in HESITATIONS:
                    counts = doc['hesitations']['counts']
                    counts[bare] = counts.get(bare, 0) + 1
                    changed['hesitations'][bare] = changed['hesitations'].get(bare, 0) + 1
                elif tags & {'filler', 'signpost', 'hedge', 'intensifier'}:
                    counts = doc['habits']['added']
                    counts[bare] = counts.get(bare, 0) + 1
                    changed['added'][bare] = changed['added'].get(bare, 0) + 1
    doc['learned_from'].append(source)
    doc['updated_on'] = today or date.today().isoformat()
    return changed


def propose(doc: dict, text: str, evidence: str, today: str | None = None) -> dict:
    """A taste rule the counts suggest, for Krish to approve or not. Nothing in the engine reads proposals."""
    row = {'proposal': text, 'evidence': evidence, 'status': 'for Krish', 'on': today or date.today().isoformat()}
    if not any(p['proposal'] == text for p in doc['proposals']):
        doc['proposals'].append(row)
    return row


def summary(doc: dict, top: int = 12) -> list[str]:
    lines = [f"terms: {len(doc['terms'])}; fixes: {len(doc['fixes'])} "
             f"({len(fixes(doc))} applied to captions); takes learned from: {len(doc['learned_from'])}"]
    if doc['terms']:
        lines.append('most said terms: ' + ', '.join(f"{t['text']} ({t['count']})" for t in doc['terms'][:top]))
    learned = [f for f in doc['fixes'] if f.get('status') == 'learned']
    if learned:
        lines.append('learned mishearings: ' + '; '.join(f"\"{f['heard']}\" is {f['fixed']} ({f['count']})" for f in learned[:top]))
    hes = sorted(doc['hesitations']['counts'].items(), key=lambda kv: -kv[1])
    if hes:
        lines.append('hesitations heard: ' + ', '.join(f'{k} {v}' for k, v in hes[:top]))
    added = sorted(doc['habits']['added'].items(), key=lambda kv: -kv[1])
    if added:
        lines.append('words he adds: ' + ', '.join(f'{k} {v}' for k, v in added[:top]))
    for p in doc['proposals']:
        lines.append(f"proposal for Krish: {p['proposal']} ({p['evidence']})")
    return lines
