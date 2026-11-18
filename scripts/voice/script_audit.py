#!/usr/bin/env python3
"""script_audit: the engine's draft, the words Krish approved, and what he said, compared three ways.

Krish, 2026-11-18: "I think a really important post-audit is comparing a script that you put into the dashboard versus
the script that went into Teleprompter after my edits versus the actual words I said in the video. The whole system
would learn so much from doing that after every video was produced." And the same day: "It's also the vocabulary she
uses, as opposed to even your latest hospital care script, which used words like "dearest," which I would never say
in a million years." (The draft's word was "dearer", docs/plans/2026-11-20-draft-script-90s.md.)

For one recorded cut of a piece it finds three texts, each bound to where it came from and its sha256 (making.py
script_hash), or names which one is missing and why. It never fills a gap by guessing:

  a  the engine's draft he was shown: the newest script a session filed on the piece (a material of role script,
     the cut told by its title, as the board's newestScripts reads it) before his approval, leaving out any filing of
     words he had already approved (a session re-filing his own edits is not the engine's draft);
  b  the words his Approve sent: the texts of his newest approve_scripts on the piece in the week's board history,
     bound to the take when their hash is the one the making record's recording of that cut was made against;
  c  what he said: the take record ve ingest wrote (<piece>/ve/takes/<take>.json), both forced aligners' words
     (F55: never a whisper transcript), bound to the take when its media sha256 is the recording's on the record.

Then a to b (what he edits before recording: his edit rate), b to c (what he changes saying it: his ad-lib rate) and
a to c (the whole gap): words kept, swapped, cut, added, contracted and expanded, and every word or short phrase he
swapped, with what he put instead. On the take a swap counts only when both aligners heard the same words, so a
mishearing by one transcriber is not taken for his habit. No model call, no paid call: difflib on words_gate's tokens.

    python scripts/voice/script_audit.py report PIECE_ID CUT [--week MONDAY] --take TAKE.json [--json OUT] [--md OUT]
        [--a FILE] [--b FILE] [--record] [--file]
    python scripts/voice/script_audit.py compare FROM.txt TO.txt [--json]
    python scripts/voice/script_audit.py ledger [--json]

ve ingest runs it by itself (auto) as soon as a take's two clocks are written, so every production run audits every
cut it ingests, records it and files the report; SCRIPT_AUDIT_OFFLINE=1 turns that off. report prints the cut's
three-way report (and writes --json / --md). --a or --b give a text by hand when the store
holds none: it is compared and shown, marked by_hand, and the ledger leaves it out. --record writes the audit onto the
piece's making record as script_audit.<cut> (hashes, sources, counts and swaps, never the texts); --file files the
markdown report on the piece (board_session.py add). ledger prints the rolling ledger the engine keeps across every
audited cut (GET /api/learning/script-audit): his edit rate, his ad-lib rate, the words he swaps out with what he said
instead and how often, and the swaps seen in two pieces or more (habits). The learning compiler proposes each habit onto
his list (spoken:swap:<word>); one he keeps reaches the Scripts step through spoken_rules.py. Exit 0, 2 on an error.
"""
import argparse
import difflib
import json
import re
import subprocess
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
sys.path.insert(0, str(ROOT / 'scripts' / 'voice'))
sys.path.insert(0, str(ROOT / 'scripts'))
import words_gate  # noqa: E402
import spoken_delta  # noqa: E402
import making  # noqa: E402

CUTS = ('long', 'short', 'feature')
PAIRS = (('a', 'b'), ('b', 'c'), ('a', 'c'))
SWAP_WORDS = 4          # a swap of at most this many words a side is vocabulary; longer is a rewrite, counted only
SWAPS_KEPT = 40         # per pair on the record (the engine's limit)
SWAP_CHARS = 80
HEARD_ALIKE = 0.8       # on the take, words this alike on paper are a hearing difference, not his choice
BY_HAND = 'by_hand'
# Sources the ledger leaves out: shown on the piece, never counted (learning/_scriptAudit.ts UNBOUND).
UNBOUND = (BY_HAND, 'approval_newest', 'take_unbound')
# Words that carry no vocabulary on their own (learning/_patterns.ts FILLER): a swap whose outgoing words are all of
# these ("a" said as "the", "it" as "that") is how difflib lines up two runs, not a word he chose against.
FILLER = frozenset('the a an and of to in is it that this for on with as at be are was or but by from i you we they he '
                   'she which what who its their his her our your my me us them have has had do does did will would can '
                   'could just there here then than if not no all about up out so now really actually well'.split())
NAMES = {'a': "the engine's draft", 'b': 'his approved words', 'c': 'what he said'}
LEDGER_PATH = '/api/learning/script-audit'

# The board's own reading of a filed script's cut (apps/control-plane/api/board/_decisions.ts scriptCuts).
SHORT_WORDS = re.compile(r'\bshort\b|\b\d+[- ]?second|\babout \d+ ?s\b|\bvertical\b')
LONG_WORDS = re.compile(r'\blong\b|\bminute\b|\b\d+-min\b')


class AuditError(Exception):
    """The audit cannot be made (a missing file, an unreadable engine answer)."""


# ---------------------------------------------------------------- comparison (pure)

def text_tokens(text):
    return spoken_delta._keep_contractions(words_gate.script_tokens(text))


def take_tokens(record, aligner):
    """One aligner's words of a ve take record as comparison tokens."""
    try:
        words = record['aligners'][aligner]['words']
    except (KeyError, TypeError):
        raise AuditError(f'the take record has no aligner {aligner!r}')
    timed = [{'w': str(w.get('text', '')), 's': w.get('onset_s'), 'e': w.get('end_s')} for w in words if isinstance(w, dict)]
    toks = spoken_delta._keep_contractions(words_gate.tokens_of(timed))
    if not toks:
        raise AuditError(f'aligner {aligner} heard no words')
    return toks


def _swap_pairs(raw_swaps, heard=True):
    """(from, to) of each short swap; on the take (heard) a swap whose two sides look alike on paper is dropped."""
    out = []
    for frm, to in raw_swaps:
        if not frm or not to or len(frm) > SWAP_WORDS or len(to) > SWAP_WORDS:
            continue
        if all(w in FILLER for w in frm):
            continue
        f, t = ' '.join(frm), ' '.join(to)
        if heard and difflib.SequenceMatcher(a=f, b=t).ratio() >= HEARD_ALIKE:
            continue
        out.append((f[:SWAP_CHARS], t[:SWAP_CHARS]))
    return out


def pair_result(from_tokens, to_tokens, *, also=None, heard=False):
    """Counts and swaps from one text to another. also is the other aligner's tokens for a take: a swap is kept only
    when both aligners heard it. Pure."""
    got = spoken_delta.compare_tokens(from_tokens, to_tokens)
    counts = got['counts']
    swaps = _swap_pairs(got['swaps'], heard=heard)
    if also is not None:
        other = set(_swap_pairs(spoken_delta.compare_tokens(from_tokens, also)['swaps'], heard=heard))
        swaps = [s for s in swaps if s in other]
    changes = sum(counts.values())
    return {
        'words_from': got['words_script'], 'words_to': got['words_said'], 'kept': got['kept'], **counts,
        'changes': changes,
        'changes_per_100_words': round(100 * changes / got['words_script'], 1) if got['words_script'] else None,
        'swaps': [{'from': f, 'to': t} for f, t in swaps],
        'examples': got['examples'],
    }


def audit(texts):
    """The three-way audit of one cut. texts maps a, b, c to {'tokens': ..., 'also': (c only), ...meta} or
    {'missing': why}. Every pair whose two texts are present is compared. Pure."""
    pairs = {}
    for x, y in PAIRS:
        tx, ty = texts.get(x) or {}, texts.get(y) or {}
        if tx.get('missing') or ty.get('missing') or 'tokens' not in tx or 'tokens' not in ty:
            continue
        on_take = y == 'c'
        pairs[f'{x}_{y}'] = pair_result(tx['tokens'], ty['tokens'], also=ty.get('also') if on_take else None, heard=on_take)
    return pairs


# ---------------------------------------------------------------- finding the texts (pure, on data already read)

def _t(value):
    """A timestamp as an aware datetime (UTC when it names no zone), or None: compared as times, never as strings."""
    try:
        d = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def script_cuts(title):
    t = str(title or '').lower()
    return [c for c, rx in (('long', LONG_WORDS), ('short', SHORT_WORDS)) if rx.search(t)]


def _heading_cut(line):
    t = re.sub(r'^#+\s*', '', line.strip())
    t = re.sub(r'[:*_]+$', '', t)
    t = re.sub(r'^[*_]+', '', t).strip()
    if not t or len(t) > 60 or not re.search(r'\bcut\b|^vertical\b|^short\b|^long\b', t, re.I):
        return None
    cuts = script_cuts(t)
    return cuts[0] if len(cuts) == 1 else None


def script_section(text, cut):
    """One cut's words from a material holding both under their headings (_decisions.ts scriptSection), or None."""
    at, out, found = None, [], False
    for line in str(text).splitlines():
        h = _heading_cut(line)
        if h:
            at = h
            found = found or h == cut
            continue
        if at == cut:
            out.append(line)
    body = '\n'.join(out).strip()
    return body if found and body else None


def approvals_of(history, piece_id):
    """His approve_scripts revisions on the piece, oldest first, one per distinct set of words: his press (updated by
    Krish) or his typed words carried from a session (a words document), never withdrawn ones."""
    out, seen = [], set()
    rows = sorted((h for h in history or [] if isinstance(h, dict)), key=lambda h: _t(h.get('updated_at')) or datetime.min.replace(tzinfo=timezone.utc))
    # His take-back (kind take_back, what scripts) withdraws every approval of the piece made at or before it.
    backs = [_t((h.get('body') or {}).get('at')) for h in rows if isinstance(h.get('body'), dict)
             and h['body'].get('kind') == 'take_back' and h['body'].get('what') == 'scripts'
             and str(h['body'].get('piece_id') or '').lower() == piece_id.lower()]
    backs = [b for b in backs if b]
    for h in rows:
        body = h.get('body') if isinstance(h.get('body'), dict) else {}
        if body.get('kind') != 'approve_scripts' or body.get('approved') is not True or body.get('taken_back'):
            continue
        at = _t(body.get('at') or h.get('updated_at'))
        if at and any(at <= b for b in backs):
            continue
        if str(body.get('piece_id') or '').lower() != piece_id.lower() or not isinstance(body.get('texts'), dict):
            continue
        key = json.dumps(body['texts'], sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        out.append({'doc': h.get('doc_id'), 'revision': h.get('revision'), 'by': h.get('updated_by'),
                    'at': body.get('at') or h.get('updated_at'), 'texts': body['texts'],
                    'sent': (body.get('send') or {}).get('status') if isinstance(body.get('send'), dict) else None})
    return out


def pick_b(approvals, cut, recorded_sha=None):
    """(approval, how) of the words he approved for the cut: the one whose words the recording was made against when
    the record says, else his newest. (None, why) when he approved none."""
    have = [a for a in approvals if isinstance(a['texts'].get(cut), str) and a['texts'][cut].strip()]
    if not have:
        return None, f'no Approve scripts of his on the piece holds the {cut} cut'
    if recorded_sha:
        for a in reversed(have):
            if recorded_sha in _hashes(a['texts'][cut]):
                return a, 'take'
    return have[-1], ('only' if len(have) == 1 else 'newest')


def _hashes(text):
    import teleprompter_send  # the words Teleprompter shows: either hash binds them, as on the server
    return {making.script_hash(text), making.script_hash(teleprompter_send.spoken_text(text))}


def pick_a(materials, cut, piece_id, before, approved_hashes, read):
    """(material, text) of the engine's draft he was shown: the newest script material of the cut filed on the piece
    before his approval, leaving out a filing of words he had already approved, made after he approved them (a draft
    he approved unchanged and filed before that approval is still the engine's draft). approved_hashes maps the hash
    of each earlier approval's words to when he approved them; read(material) gives its text.
    (None, why) when there is none."""
    cands = []
    for m in materials or []:
        if not isinstance(m, dict) or m.get('role') != 'script' or m.get('archived_at'):
            continue
        if m.get('where') not in (None, 'piece') or str(m.get('scope') or m.get('piece_id') or '').lower() != piece_id.lower():
            continue
        cuts = script_cuts(m.get('title'))
        filed = _t(m.get('at'))
        if cut not in cuts or not filed or (before and filed >= _t(before)):
            continue
        cands.append((m, len(cuts) > 1))
    if not cands:
        if not any(isinstance(m, dict) and m.get('role') == 'script' for m in materials or []):
            return None, (f'no script of any cut is filed on the piece: its drafts were kept only in the repository, and the '
                          f'making record keeps only the hash of the current words, so the draft he was shown cannot be bound')
        return None, f'no script of the {cut} cut was filed on the piece before his approval' if before else f'no script of the {cut} cut is filed on the piece'
    for m, both in sorted(cands, key=lambda x: _t(x[0].get('at')), reverse=True):
        text = read(m)
        if both:
            text = script_section(text or '', cut)
        if not text or not text.strip():
            continue
        approved_at = [approved_hashes[h] for h in _hashes(text) if h in approved_hashes]
        if any(_t(m.get('at')) > _t(at) for at in approved_at):
            continue  # his own approved words filed again by a session after he approved them: not the engine's draft
        return m, text
    return None, f'every script of the {cut} cut filed before his approval is his own approved words filed again'


def recorded_sha(record, cut):
    """The script sha256 the making record says the cut's recording was made against, and the recording's media sha."""
    for r in reversed(record.get('recordings') or []):
        if isinstance(r, dict) and r.get('cut') == cut:
            path = str(r.get('path') or '')
            media = re.search(r'([0-9a-f]{64})', path)
            return r.get('script_sha256'), (media.group(1) if media else None)
    return None, None


def weeks_of(store):
    """The piece's week and the week before it: his Approve scripts is pressed on the piece's own board, or on Sunday
    on the week before's."""
    from datetime import date, timedelta
    wk = str((store.get('piece') or {}).get('week') or store.get('week') or '') if isinstance(store, dict) else ''
    try:
        monday = date.fromisoformat(wk)
    except ValueError:
        return []
    return [(monday - timedelta(days=7)).isoformat(), monday.isoformat()]


def cut_of_take(take_id, cuts=None):
    """The cut a take is of, from its id (long-1110, short-2, feature-a), else the piece's only cut; None when it
    cannot be told (then the audit waits for a session to name it)."""
    head = re.match(r'^(long|short|feature)(?:[-_]|$)', str(take_id or ''))
    if head:
        return head.group(1)
    cuts = [c for c in (cuts or []) if c in CUTS]
    return cuts[0] if len(cuts) == 1 else None


def auto(piece_id, take_path, cut, out_dir):
    """The audit run by ve ingest as soon as a take's two clocks are written: report, record and file, one line back.
    Never raises: the take is ingested whatever the audit finds."""
    try:
        texts, pairs = report(piece_id, cut, None, take_path)
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        md = out_dir / f'script-audit.{cut}.md'
        md.write_text(markdown(piece_id, cut, texts, pairs), encoding='utf-8')
        making.post(piece_id, record_patch(cut, texts, pairs))
        filed = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'post-pack' / 'board_session.py'), piece_id, 'add', str(md),
                                '--title', f'Script audit, {cut} cut (draft, approved, said)', '--role', 'research', '--kind', 'research'],
                               capture_output=True, text=True, timeout=300)
        gone = [k for k in 'abc' if texts[k].get('missing')]
        return (f"script audit ({cut}): " + ', '.join(f"{k} {p['changes_per_100_words']} changes per 100 words" for k, p in pairs.items())
                + (f"; missing {', '.join(gone)}" if gone else '') + ('' if filed.returncode == 0 else '; the report was not filed'))
    except Exception as error:  # noqa: BLE001 - the audit never holds a take
        return f'script audit ({cut}) not made: {error}'


# ---------------------------------------------------------------- the report

def record_patch(cut, texts, pairs, at=None):
    """script_audit.<cut> for the making record: hashes, sources, counts and swaps, never the texts."""
    if cut not in CUTS:
        raise AuditError(f'unknown cut {cut!r}')
    keep = ('words_from', 'words_to', 'kept', 'swapped', 'cut', 'added', 'contracted', 'expanded', 'changes', 'changes_per_100_words')
    out_texts = {}
    for k in 'abc':
        t = texts.get(k) or {}
        if t.get('missing'):
            out_texts[k] = {'missing': str(t['missing'])[:300]}
        else:
            out_texts[k] = {kk: t[kk] for kk in ('sha256', 'source', 'ref', 'at') if t.get(kk)}
    out_pairs = {k: {**{kk: p[kk] for kk in keep}, 'swaps': p['swaps'][:SWAPS_KEPT]} for k, p in pairs.items()}
    return {'script_audit': {cut: {'texts': out_texts, 'pairs': out_pairs,
                                   'at': at or datetime.now(timezone.utc).isoformat(timespec='seconds')}}}


def markdown(piece_id, cut, texts, pairs):
    lines = [f'# Script audit: {cut} cut of {piece_id}', '',
             'The engine\'s draft (a), the words his Approve sent (b) and what he said on the take (c). '
             'Deterministic: words_gate tokens and difflib, no model.', '', '## The three texts', '']
    for k in 'abc':
        t = texts.get(k) or {}
        if t.get('missing'):
            lines.append(f'- **{k}, {NAMES[k]}**: missing. {t["missing"]}')
        else:
            bits = [f'source {t.get("source")}', f'ref {t.get("ref")}' if t.get('ref') else '', f'at {t.get("at")}' if t.get('at') else '',
                    f'sha256 {str(t.get("sha256"))[:12]}', t.get('bound') or '']
            lines.append(f'- **{k}, {NAMES[k]}**: ' + ', '.join(b for b in bits if b))
    lines += ['', '## What moved', '', '| Pair | Words from | Kept | Swapped | Cut | Added | Contracted | Expanded | Changes per 100 words |',
              '|---|---|---|---|---|---|---|---|---|']
    label = {'a_b': 'a to b, his edits', 'b_c': 'b to c, saying it', 'a_c': 'a to c, the whole gap'}
    for k in ('a_b', 'b_c', 'a_c'):
        p = pairs.get(k)
        if not p:
            lines.append(f'| {label[k]} | not compared: a text is missing | | | | | | | |')
            continue
        lines.append(f"| {label[k]} | {p['words_from']} | {p['kept']} | {p['swapped']} | {p['cut']} | {p['added']} | "
                     f"{p['contracted']} | {p['expanded']} | {p['changes_per_100_words']} |")
    for k in ('a_b', 'b_c'):
        p = pairs.get(k)
        if not p or not p['swaps']:
            continue
        lines += ['', f'## Words swapped, {label[k]}', '']
        lines += [f'- "{s["from"]}" became "{s["to"]}"' for s in p['swaps'][:SWAPS_KEPT]]
    lines += ['', 'A swap is a proposal for his list only once it repeats in two pieces (the ledger); nothing here is a rule.', '']
    return '\n'.join(lines)


def _store_call(method, path):
    import board_session
    return board_session.call(method, path)


def read_material(m):
    status, answer = _store_call('GET', f"/api/content-ideas/store?op=read&id={urllib.parse.quote(m['id'])}&link=1")
    if status != 200 or not isinstance(answer, dict) or 'content' not in answer:
        raise AuditError(f"material {m.get('id')} could not be read as text (HTTP {status})")
    return answer['content']


def gather(piece_id, cut, week, take_path, a_file=None, b_file=None):
    """Read everything the audit needs and say where each text came from. Network reads only (GET)."""
    record = making.record_of(piece_id)
    rec_script, rec_media = recorded_sha(record, cut)
    texts = {}
    status, store = _store_call('GET', f'/api/content-ideas/store?piece={piece_id.lower()}')
    if status != 200 or not isinstance(store, dict):
        raise AuditError(f'the piece\'s store could not be read (HTTP {status})')
    weeks = [week] if week else weeks_of(store)
    if not weeks and not b_file:
        raise AuditError('the piece names no week: give --week (the Monday his Approve scripts was pressed in)')
    # b: his approval, from the week's board history (every revision, oldest first).
    approvals = []
    if b_file:
        btext = Path(b_file).read_text(encoding='utf-8')
        # A file whose words hash to the script the record's recording of the cut was made against is bound by that
        # hash; any other file given by hand stays by_hand, shown on the piece and left out of the ledger.
        held = bool(rec_script) and rec_script in _hashes(btext)
        texts['b'] = {'text': btext, 'source': 'recorded_script' if held else BY_HAND, 'ref': Path(b_file).name,
                      'bound': 'its hash is the script the recording on the record was made against' if held
                      else 'given by hand: not bound to the record'}
        b_at = None
    else:
        history = []
        for wk in weeks:
            status, hist = _store_call('GET', f'/api/board/{wk}/outcomes')
            if status != 200 or not isinstance(hist, dict) or hist.get('ok') is False:
                raise AuditError(f'the board history of the week of {wk} could not be read (HTTP {status})')
            history += hist.get('history') or []
        approvals = approvals_of(history, piece_id)
        b, how = pick_b(approvals, cut, rec_script)
        if not b:
            texts['b'] = {'missing': how}
            b_at = None
        else:
            btext = b['texts'][cut]
            texts['b'] = {'text': btext, 'source': 'approval_newest' if how == 'newest' else 'approval',
                          'ref': f"picks/{b['doc']} r{b['revision']}", 'at': b['at'],
                          'bound': {'take': 'the recording on the record was made against these words',
                                    'only': 'his only approval of this cut'}.get(how,
                                    'his newest of several approvals, and the record does not say which the recording was made '
                                    'against: shown here, left out of the ledger')}
            b_at = b['at']
    # a: the engine's draft he was shown, before that approval.
    if not a_file and not b_at:
        texts['a'] = {'missing': 'no approval of his with a time to bound the draft he was shown'}
    elif a_file:
        texts['a'] = {'text': Path(a_file).read_text(encoding='utf-8'), 'source': BY_HAND, 'ref': Path(a_file).name}
    else:
        earlier = [ap for ap in approvals if _t(ap['at']) and _t(ap['at']) < _t(b_at)]
        approved = {}
        for ap in earlier:
            if isinstance(ap['texts'].get(cut), str):
                for h in _hashes(ap['texts'][cut]):
                    approved.setdefault(h, ap['at'])
        m, got = pick_a(store.get('materials'), cut, piece_id, b_at, approved, read_material)
        texts['a'] = {'missing': got} if not m else {'text': got, 'source': 'material', 'ref': m['id'], 'at': m.get('at')}
    # c: the take record, both aligners.
    if not take_path:
        texts['c'] = {'missing': 'no take record given (--take <piece>/ve/takes/<take>.json, written by ve ingest)'}
    else:
        rec = json.loads(Path(take_path).read_text(encoding='utf-8'))
        media = (rec.get('media') or {}).get('sha256')
        eyeline = '.eyeline.' in str((rec.get('media') or {}).get('path') or '')
        held = bool(media) and (media == rec_media or (eyeline and bool(rec_media)))
        texts['c'] = {'tokens': take_tokens(rec, 'a'), 'also': take_tokens(rec, 'b'), 'source': 'take' if held else 'take_unbound',
                      'ref': f"{rec.get('take')} ({rec['aligners']['a'].get('name')} and {rec['aligners']['b'].get('name')})",
                      'sha256': media, 'at': rec.get('ingested_on'),
                      'bound': ('the recording on the record' if media and media == rec_media
                                else 'an eyeline copy of a take (ve eyeline keeps its sound), so its bytes are not the recording on the record'
                                if '.eyeline.' in str((rec.get('media') or {}).get('path') or '') and rec_media
                                else 'not the recording on the record (its media sha256 differs)' if rec_media
                                else 'the record holds no recording of this cut')}
    for k in ('a', 'b'):
        t = texts[k]
        if 'text' in t:
            t['sha256'] = making.script_hash(t['text'])
            t['tokens'] = text_tokens(t['text'])
    return texts


def report(piece_id, cut, week, take_path, a_file=None, b_file=None):
    texts = gather(piece_id, cut, week, take_path, a_file, b_file)
    pairs = audit(texts)
    return texts, pairs


# ---------------------------------------------------------------- command line

def _print_pairs(pairs):
    for k, p in pairs.items():
        print(f"{k}: {p['changes']} changes in {p['words_from']} words ({p['changes_per_100_words']} per 100), "
              f"swapped {p['swapped']}, cut {p['cut']}, added {p['added']}, contracted {p['contracted']}")
        for s in p['swaps'][:12]:
            print(f'    "{s["from"]}" -> "{s["to"]}"')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('report', help="one cut's three-way audit")
    r.add_argument('piece_id')
    r.add_argument('cut', choices=CUTS)
    r.add_argument('--week', help='the Monday his Approve was pressed in (default: the piece\'s week and the week before)')
    r.add_argument('--take', help='the take record, <piece>/ve/takes/<take>.json')
    r.add_argument('--a', help='the engine\'s draft by hand (marked by_hand; the ledger leaves it out)')
    r.add_argument('--b', help='his approved words by hand (marked by_hand; the ledger leaves it out)')
    r.add_argument('--json')
    r.add_argument('--md')
    r.add_argument('--record', action='store_true', help='write script_audit.<cut> onto the making record')
    r.add_argument('--file', action='store_true', help='file the markdown report on the piece (needs --md)')
    c = sub.add_parser('compare', help='two texts, word by word')
    c.add_argument('frm')
    c.add_argument('to')
    c.add_argument('--json', action='store_true')
    lg = sub.add_parser('ledger', help='the rolling ledger across every audited cut')
    lg.add_argument('--json', action='store_true')
    args = ap.parse_args(argv)
    try:
        if args.cmd == 'compare':
            p = pair_result(text_tokens(Path(args.frm).read_text(encoding='utf-8')), text_tokens(Path(args.to).read_text(encoding='utf-8')))
            print(json.dumps(p, indent=2) if args.json else '')
            if not args.json:
                _print_pairs({'from_to': p})
            return 0
        if args.cmd == 'ledger':
            status, text = making._engine_call('GET', LEDGER_PATH, None)
            data = json.loads(text) if isinstance(text, (str, bytes)) else text
            if status != 200 or not isinstance(data, dict) or data.get('ok') is not True:
                raise AuditError(f'the engine answered {status}: {str(data)[:160]}')
            led = data['ledger']
            if args.json:
                print(json.dumps(led, indent=2))
                return 0
            for name, key in (('edit rate (draft to approved)', 'edit_rate'), ('ad-lib rate (approved to said)', 'adlib_rate'), ('whole gap (draft to said)', 'whole_gap')):
                r_ = led[key]
                print(f"{name}: {r_['per_100_words']} changes per 100 words over {r_['cuts']} cuts")
            print(f"habits (two pieces or more): {len(led['habits'])}")
            for h in led['habits'][:20]:
                print(f"  \"{h['from']}\" -> " + ', '.join(f"\"{t['to']}\" x{t['n']}" for t in h['to'][:3]) + f" ({len(h['pieces'])} pieces)")
            for m in led['missing'][:20]:
                print(f"  missing {m['text']} on {m['piece_id'][:8]} {m['cut']}: {m['why']}")
            return 0
        texts, pairs = report(args.piece_id, args.cut, args.week, args.take, args.a, args.b)
        for k in 'abc':
            t = texts[k]
            print(f"{k} ({NAMES[k]}): " + (f"MISSING: {t['missing']}" if t.get('missing') else
                                          f"{t['source']} {t.get('ref', '')} sha256 {str(t.get('sha256'))[:12]} {t.get('bound', '')}".rstrip()))
        _print_pairs(pairs)
        patch = record_patch(args.cut, texts, pairs)
        md = markdown(args.piece_id, args.cut, texts, pairs)
        if args.json:
            Path(args.json).write_text(json.dumps({'piece_id': args.piece_id, 'cut': args.cut,
                                                   'texts': {k: {kk: v for kk, v in t.items() if kk not in ('tokens', 'also', 'text')} for k, t in texts.items()},
                                                   'pairs': pairs}, indent=2), encoding='utf-8')
        if args.md:
            Path(args.md).write_text(md, encoding='utf-8')
        if args.record:
            making.post(args.piece_id, patch)
            print(f'recorded on {args.piece_id} as script_audit.{args.cut}')
        if args.file:
            if not args.md:
                raise AuditError('--file files the --md report: give --md')
            out = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'post-pack' / 'board_session.py'), args.piece_id, 'add', args.md,
                                  '--title', f'Script audit, {args.cut} cut (draft, approved, said)', '--role', 'research', '--kind', 'research'],
                                 capture_output=True, text=True, timeout=300)
            print((out.stdout or out.stderr).strip()[:300])
            if out.returncode:
                return 2
        return 0
    except (AuditError, making.MakingError, words_gate.WordsGateError, OSError, ValueError) as error:
        print(f'script_audit: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
