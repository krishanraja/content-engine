"""Pure checks shared by quick-edit planning, rendering and delivery."""
import difflib
import hashlib
import importlib.metadata
import json
import math
import re
from pathlib import Path


def digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def transcript_identity(source, speed, model):
    return {'schema': 1, 'source_sha256': digest(source), 'speed': float(speed),
            'clock': 'processing_source', 'model': model,
            'transcriber': 'faster-whisper',
            'version': importlib.metadata.version('faster-whisper')}


def checked_words(document, expected):
    if document.get('provenance') != expected:
        raise ValueError('Transcript provenance is missing or stale; transcribe the actual processing source again')
    words = document.get('words')
    if not isinstance(words, list) or not words:
        raise ValueError('Transcript has no words')
    prior = -1
    for word in words:
        if not isinstance(word.get('w'), str) or not word['w'].strip():
            raise ValueError('Transcript contains an empty word')
        start, end = word['s'], word['e']
        if not all(isinstance(x,(int,float)) and math.isfinite(x) for x in (start,end)) or start < prior or end < start:
            raise ValueError('Transcript word times are invalid')
        prior = start
    return words


def canonical_words(words):
    text = words if isinstance(words,str) else ' '.join(w if isinstance(w,str) else w['w'] for w in words)
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?",text.lower().replace('\u2019',"'"))


def word_diff(expected, heard):
    a, b = canonical_words(expected), canonical_words(heard)
    changes = [{'kind':op,'expected':a[i:j],'heard':b[k:l], 'expected_index':i, 'heard_index':k}
               for op,i,j,k,l in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes() if op!='equal']
    return {'status':'pass' if a and b and not changes else 'fail',
            'expected_words':len(a),'heard_words':len(b),'changes':changes}


def caption_token_digest(words):
    payload=[{k:w[k] for k in ('w','s','e')} for w in words]
    return hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def repaired_caption_words(document, words, source_identity, edited_sha256, duration):
    """Apply evidence-backed word repairs on the edited clock, never retime again."""
    expected={'schema':1,'clock':'edited','source_provenance':source_identity,
              'edited_sha256':edited_sha256,'base_tokens_sha256':caption_token_digest(words)}
    if document.get('provenance')!=expected:
        raise ValueError('Caption repair provenance is missing or stale')
    out=[];cursor=0
    for edit in document.get('edits',[]):
        a,b=edit['start_index'],edit['end_index']
        if not isinstance(a,int) or not isinstance(b,int) or not cursor<=a<b<=len(words):
            raise ValueError('Caption repair ranges overlap or lie outside the retained words')
        if edit.get('before')!=[{k:w[k] for k in ('w','s','e')} for w in words[a:b]]:
            raise ValueError('Caption repair does not match its exact original words')
        if not edit.get('evidence') or not edit.get('reason') or not edit.get('after'):
            raise ValueError('Caption repair needs evidence, a reason and replacement words')
        out.extend(words[cursor:a]);out.extend(edit['after']);cursor=b
    out.extend(words[cursor:])
    prior=-1
    for word in out:
        if not isinstance(word.get('w'),str) or not word['w'].strip():
            raise ValueError('Caption repair contains an empty word')
        a,b=word['s'],word['e']
        if not all(isinstance(x,(int,float)) and math.isfinite(x) for x in (a,b)) or not 0<=a<=b<=duration or a<prior:
            raise ValueError('Caption repair times must stay ordered inside the edited speech')
        prior=a
    return out


def cut_problems(words, segments, removals):
    removed = {i for a,b in removals for i in range(a,b+1)}
    problems = []
    for i,w in enumerate(words):
        full = [s for s in segments if s['a']<=w['s']+1e-6 and s.get('source_end',s['b'])>=w['e']-1e-6]
        touched = [s for s in segments if s['a']<w['e']-1e-6 and s.get('source_end',s['b'])>w['s']+1e-6]
        if i in removed and touched:
            problems.append(f'Removed word {i} ({w["w"].strip()}) still intersects a retained segment')
        elif i not in removed and len(full)!=1:
            problems.append(f'Retained word {i} ({w["w"].strip()}) is clipped, missing or duplicated')
    return problems


def word_pages(cue, pages, words, normalise):
    anchors = cue.get('on')
    if anchors is None:
        return None
    if not isinstance(anchors,list) or len(anchors)!=len(pages):
        raise ValueError(f"{cue['id']}: on must name one phrase per page")
    times = []
    for phrase in anchors:
        want = [normalise(w) for w in phrase.split() if normalise(w)]
        matches = [i for i in range(len(words)-len(want)+1)
                   if cue['s'] <= words[i]['s'] < cue['e']
                   and [normalise(w['w']) for w in words[i:i+len(want)]] == want]
        if not want or len(matches)!=1:
            raise ValueError(f"{cue['id']}: page phrase {phrase!r} must match once inside its cue")
        times.append(words[matches[0]]['s'])
    if any(b<=a for a,b in zip(times,times[1:])):
        raise ValueError(f"{cue['id']}: page phrases must be in spoken order")
    return [cue['s'],*times[1:],cue['e']]


def unique_anchor(words, phrase, normalise, after=0, end_after=False):
    want=[normalise(w) for w in phrase.split() if normalise(w)]
    if not want:
        raise ValueError('Spoken cue cannot be empty')
    hits=[i for i in range(len(words)-len(want)+1)
          if words[i+len(want)-1 if end_after else i]['s']>=after and [normalise(w['w']) for w in words[i:i+len(want)]]==want]
    if not want or len(hits)!=1:
        raise ValueError(f'Spoken cue {phrase!r} must match exactly once; found {len(hits)}')
    return hits[0],hits[0]+len(want)-1


def coverage(windows, start, end):
    if end<=start:
        raise ValueError('Coverage needs a positive speech duration')
    spans = sorted((max(start,c['s']),min(end,c['e'])) for c in windows if c['e']>start and c['s']<end)
    merged = []
    for a,b in spans:
        if b<=a:
            continue
        if merged and a<=merged[-1][1]:
            merged[-1][1] = max(b,merged[-1][1])
        else:
            merged.append([a,b])
    gaps, cursor = [], start
    for a,b in merged:
        if a>cursor:
            gaps.append([cursor,a])
        cursor=b
    if cursor<end:
        gaps.append([cursor,end])
    covered = sum(b-a for a,b in merged)
    changes = len({round(c['s'],4) for c in windows if start<=c['s']<end})
    return {'fraction':covered/(end-start),'max_gap_s':max((b-a for a,b in gaps),default=0),
            'changes_per_minute':changes*60/(end-start),'gaps':gaps}


def coverage_problems(result):
    return [message for failed,message in [
        (result['fraction'] < .9,'visual coverage is below 90%'),
        (result['max_gap_s'] > 1.5+1e-6,'a visual gap exceeds 1.5 seconds'),
        (result['changes_per_minute'] < 20,'fewer than 20 visual changes per minute')]
            if failed]


def guarded_pieces():
    return json.loads((Path(__file__).resolve().parents[2]/'config/video-validation.json').read_text())['pieces']


def is_delivery_video(target):
    parts=Path(target.replace('\\','/')).parts
    if Path(target).suffix.lower() not in ('.mp4','.mov','.mkv','.webm') or '3 Video' not in parts:
        return False
    tail=parts[parts.index('3 Video')+1:]
    # Source and working assets are deliberately filed separately from cuts.
    return bool(tail) and not any(p.lower().startswith('working') for p in tail[:-1])


def delivery_problems(video, receipt, target=None):
    if not Path(receipt).is_file():
        return ['video validation receipt is missing']
    try:
        report = json.loads(Path(receipt).read_text(encoding='utf-8'))
        if report.get('video_sha256') != digest(video):
            return ['video validation receipt belongs to different bytes']
        if target is not None and report.get('library_path') != target:
            return ['video validation receipt names a different library destination']
        required = ('heard','sync','loudness','visuals','full_review')
        problems = [f'{key} is not passed' for key in required
                    if report.get('checks',{}).get(key,{}).get('status')!='pass']
        return problems + motion_problems(report)
    except (OSError, ValueError, TypeError, AttributeError):
        return ['video validation receipt cannot be read']


def motion_problems(report):
    """Every delivery needs an assessed decision, including untreated footage.

    Camera-motion measurements must exclude the presenter's own movement.
    Evidence stays in the working archive; its hashes travel with the receipt.
    """
    check = report.get('checks', {}).get('motion', {})
    sha = lambda value: isinstance(value, str) and bool(re.fullmatch(r'[a-f0-9]{64}', value))
    if check.get('status') != 'pass':
        return ['motion assessment is not passed']
    assessment = check.get('assessment', {})
    review = check.get('final_review', {})
    recording = report.get('source_provenance', {}).get('source_sha256')
    if not sha(recording) or check.get('recording_sha256') != recording:
        return ['motion assessment belongs to a different recording']
    if not all(sha(assessment.get(k)) for k in ('source_sha256', 'evidence_sha256')) or not assessment.get('method'):
        return ['motion assessment evidence is missing']
    if (review.get('status') != 'pass' or review.get('video_sha256') != report.get('video_sha256')
            or not sha(review.get('evidence_sha256'))
            or any(review.get(k) != 'pass' for k in ('shake', 'warping', 'borders', 'framing'))):
        return ['final motion and framing review is incomplete or stale']
    if check.get('decision') == 'not_needed':
        if len(check.get('reason', '').strip()) < 12:
            return ['untreated footage needs an evidence-backed motion decision']
    elif check.get('decision') == 'stabilised':
        treatment = check.get('treatment', {})
        if not sha(treatment.get('output_sha256')) or not sha(treatment.get('evidence_sha256')):
            return ['stabilisation treatment evidence is missing']
        metrics = check.get('comparison', {})
        values = [metrics.get(k) for k in ('before_rms_px', 'after_rms_px', 'before_p95_px', 'after_p95_px')]
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0 for v in values):
            return ['stabilisation comparison is missing or invalid']
        before, after, before95, after95 = values
        if after >= before or after95 > before95:
            return ['stabilisation has not reduced measured camera shake']
    else:
        return ['motion decision must be stabilised or not_needed']
    return []
