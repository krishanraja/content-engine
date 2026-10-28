"""Fail closed on verbose/duplicated visuals and unproved comprehension.

Draft audit: python visual_clarity.py MANIFEST --report REPORT
Final delivery additionally binds the manifest and independent review to video bytes.
The text inventory must come from the rendered frames (including legible image text),
not only the fields a renderer happens to expose as strings.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

POLICY = Path(__file__).resolve().parents[2] / 'config/visual-clarity.json'


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def words(text):
    return re.findall(r"[\w]+(?:['’-][\w]+)*", text.casefold())


def audit(manifest, narration, policy=None):
    p = policy or json.loads(POLICY.read_text(encoding='utf-8'))
    failures, counts = [], []
    spoken = words(narration)
    if not spoken:
        failures.append('final narration transcript is empty')
    n = p['repeated_phrase_words']
    accepted = set(p.get('accepted_repeats') or [])   # states whose echo of the speech Krish accepted in words (a ruling)
    spoken_phrases = {tuple(spoken[i:i+n]) for i in range(max(0, len(spoken)-n+1))}
    states = manifest.get('states', [])
    if not states:
        failures.append('rendered text and visual inventory is missing')
    cursor = 0
    for state in states:
        sid = state.get('id', '?')
        if state.get('start_frame') != cursor or not isinstance(state.get('end_frame'), int) or state.get('end_frame', 0) <= cursor:
            failures.append(f'{sid}: invalid/gapped frame coverage')
        cursor = state.get('end_frame', cursor)
        texts = state.get('text', [])
        primary = total = 0
        all_tokens = []
        for item in texts:
            tokens = words(item.get('value', ''))
            total += len(tokens)
            all_tokens.extend(tokens)
            role = item.get('role')
            if role != 'source':
                primary += len(tokens)
            if role not in ('identity', 'quantity', 'relationship', 'source') or not item.get('adds'):
                failures.append(f'{sid}: every label needs its information role and added value')
            if sid not in accepted and any(tuple(tokens[i:i+n]) in spoken_phrases for i in range(max(0, len(tokens)-n+1))):
                failures.append(f'{sid}: phrase repeats narration/captions')
        # Splitting a sentence across multiple labels cannot evade the overlap gate.
        if sid not in accepted and any(tuple(all_tokens[i:i+n]) in spoken_phrases for i in range(max(0, len(all_tokens)-n+1))):
            failures.append(f'{sid}: combined visual text repeats narration/captions')
        if primary > p['max_primary_words'] or total > p['max_total_words']:
            failures.append(f'{sid}: word budget exceeded ({primary} primary, {total} total)')
        if not state.get('visual_cues') or not state.get('takeaway'):
            failures.append(f'{sid}: recognisable visual cue and intended takeaway required')
        counts.append({'id': sid, 'primary_words': primary, 'total_words': total})
    if cursor != manifest.get('frames'):
        failures.append('inventory does not cover the whole video')
    return {'status': 'fail' if failures else 'pass', 'problems': sorted(set(failures)),
            'counts': counts, 'semantic_nonduplication': 'requires_independent_review',
            'three_second_comprehension': 'not_proved_by_this_audit'}


def delivery_problems(report, base, video=None):
    check = report.get('checks', {}).get('visual_clarity', {})
    if check.get('status') != 'pass':
        return ['visual clarity gate is not passed']
    policy = None
    accepted_states = set()
    ruling = check.get('ruling')
    if ruling is not None:
        # The word budget is a conservative default (config/visual-clarity.json), not Krish's number. His own words on
        # a video's words on screen set that video's limits, never more than the counts the manifest shows, and
        # and the repeated-phrase rule only for the states it names: Krish, 2026-10-28, "Happy with the words on screen."
        try:
            defaults = json.loads(POLICY.read_text(encoding='utf-8'))
            if (ruling.get('by') != 'Krish' or not str(ruling.get('said', '')).strip() or not ruling.get('date')
                    or not all(isinstance(ruling.get(k), int) and not isinstance(ruling.get(k), bool) and ruling[k] > 0
                               for k in ('max_primary_words', 'max_total_words'))):
                return ['visual clarity ruling is not in his words']
            policy = {**defaults, 'max_primary_words': max(defaults['max_primary_words'], ruling['max_primary_words']),
                      'max_total_words': max(defaults['max_total_words'], ruling['max_total_words']),
                      'accepted_repeats': [x for x in ruling.get('accepted_repeats', []) if isinstance(x, str)]}
            # Pictures the independent review judged unclear at three seconds, which he accepted as they are after watching the
            # cut in full: named one by one, and the review keeps its finding on each (never a blanket pass).
            accepted_states = {x for x in ruling.get('accepted_states', []) if isinstance(x, str)}
        except (OSError, ValueError, TypeError):
            return ['visual clarity ruling cannot be read']
    try:
        files = {}
        for key in ('manifest', 'narration', 'review'):
            ref = check[key]
            path = Path(base) / ref['path']
            if digest(path) != ref['sha256']:
                return [f'visual clarity {key} evidence changed']
            files[key] = path
        manifest = json.loads(files['manifest'].read_text(encoding='utf-8'))
        review = json.loads(files['review'].read_text(encoding='utf-8'))
        if video is not None:
            probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                '-show_entries', 'stream=nb_frames', '-of', 'json', str(video)]))
            if int(probe['streams'][0]['nb_frames']) != manifest.get('frames'):
                return ['visual text inventory does not cover the actual video frame count']
        if manifest.get('video_sha256') != report.get('video_sha256') or review.get('video_sha256') != report.get('video_sha256'):
            return ['visual clarity evidence belongs to different video bytes']
        if manifest.get('narration_sha256') != check['narration']['sha256']:
            return ['visual clarity narration binding differs']
        if report.get('final_narration_sha256') != check['narration']['sha256']:
            return ['visual clarity does not use the final export transcription']
        result = audit(manifest, files['narration'].read_text(encoding='utf-8'), policy)
        if result['problems']:
            return result['problems']
        if review.get('inventory_complete') is not True or review.get('semantic_nonduplication') != 'pass':
            return ['rendered text inventory or semantic non-duplication is unverified']
        kind = review.get('reviewer_kind')
        if not review.get('reviewer') or kind not in ('human', 'independent_model') or review.get('author_review') is not False:
            return ['independent comprehension review is missing']
        if kind == 'independent_model' and (review.get('blinded') is not True or review.get('evidence_level') != 'prediction_not_human_test'):
            return ['model comprehension review must be blind and explicitly labelled a prediction']
        responses = review.get('responses', [])
        if len(responses) != len(manifest['states']) or {r.get('id') for r in responses} != {s['id'] for s in manifest['states']}:
            return ['three-second responses do not cover every visual state']
        for response in responses:
            if response.get('id') in accepted_states:
                continue
            duration = response.get('exposure_seconds')
            timed = isinstance(duration, (int, float)) and not isinstance(duration, bool) and 0 < duration <= 3
            if kind == 'independent_model':
                timed = response.get('predicted_under_three_seconds') is True and bool(response.get('rationale')) and duration is None
            if (not timed or response.get('sound') is not False or response.get('captions') is not False
                    or not response.get('answer') or response.get('correct_subject') is not True
                    or response.get('correct_point') is not True or response.get('misleading_inference') is not False):
                return ['three-second comprehension failed or lacks actual response evidence']
        return []
    except (KeyError, TypeError, ValueError, OSError, AttributeError, IndexError, subprocess.CalledProcessError):
        return ['visual clarity evidence is missing or malformed']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('manifest')
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    path = Path(args.manifest)
    data = json.loads(path.read_text(encoding='utf-8'))
    result = audit(data, (path.parent / data['narration']).read_text(encoding='utf-8'))
    Path(args.report).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result))
    raise SystemExit(0 if result['status'] == 'pass' else 1)
