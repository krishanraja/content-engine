"""ve voice clone: his approved ElevenLabs clone reads the signed script of an off-day voiceover short.

Ruling (Krish, 2026-11-15): off-day voiceover shorts may be voiced with his approved ElevenLabs clone; hero cuts stay on
his real takes. Where it saves him a recording, the clone reads what he signed, and everything after it is the route
his own recorded voiceover takes.

Two steps, and the first spends nothing:

  plan        (the default, `--plan`) checks the route (ve lint's voice.clone_route: published on an off day, the
              voiceover master, every cut a 9:16 short taking one voice), reads the clone from krish-clone's registry
              (its platform_ref is the voice id; nothing in this repository keeps one), requires the spec to carry his
              approval of that clone (approvals[gate=synthetic], as ve lint's voice.synthetic does), takes the text word
              for word from the signed script words (<ve dir>/script.words.json, the words conform holds every take to),
              and prints and writes the exact text, voice id, model, output format, characters and the credit estimate,
              bound by plan_sha256 (clone-voice.plan.json).
  --generate  runs that plan and only that plan (--plan-sha256 is the digest the plan printed), on a machine that holds
              ELEVENLABS_API_KEY, once the session has booked it with Control Center (reserve_credit_spend; its spend_id
              is --spend-id). It reserves the estimate in the credit ledger `ve ledger <piece> reserve` writes (provider
              elevenlabs_credits, refused over Control Center's cap), makes one request, settles the reservation with
              what ElevenLabs reports it charged (its character-cost header; 0 when the request fails), keeps the
              provider's file and writes the voice as <take>.wav (48 kHz mono) in the assets folder, and writes
              clone-voice.json: the receipt and the exact asset to add to the spec.

Then, as for his own recording (docs/ve/RUNBOOK.md S3 to S8): ve ingest the .wav as the take the spec names, ve hear,
ve said against the signed script, ve conform, ve premix, ve compile (which refuses a clone-voiced cut that is not an
off-day 9:16 voiceover, an EDL drawn from other bytes than the clone's, or a word the signed script does not hold),
ve proof and his Approve proof press, ve qc and the receipt's words gate. Word times never come from ElevenLabs (Krish,
2026-10-29: "do not use eleven labs for this"): the two local aligners time the clone as they time him. Nothing here
publishes, and nothing generates without --generate.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .common import CONFIG, ffmpeg, load_json, sha256_file

CONFIG_PATH = CONFIG / 'clone-voice.json'
PLAN_SCHEMA = 've-clone-voice-plan/1'
RECEIPT_SCHEMA = 've-clone-voice/1'
PLAN_FILE = 'clone-voice.plan.json'
RECEIPT_FILE = 'clone-voice.json'
SLUG = re.compile(r'^[a-z0-9][a-z0-9_-]{0,63}$')
VOICE_ID = re.compile(r'^[A-Za-z0-9]{8,64}$')
SPEND_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


def config(path: str | Path | None = None) -> dict:
    cfg = load_json(path or CONFIG_PATH)
    if not str(cfg.get('output_format', '')).startswith('mp3_'):
        raise ValueError(f"{CONFIG_PATH.name}: output_format must be an mp3_ format (ffmpeg makes the .wav ve ingests)")
    if not (isinstance(cfg.get('credits_per_character'), (int, float)) and cfg['credits_per_character'] > 0):
        raise ValueError(f'{CONFIG_PATH.name}: credits_per_character must be a positive number')
    return cfg


def digest(doc: dict) -> str:
    """The sha256 a plan is bound to: the whole plan but its own digest, keys sorted."""
    body = {k: v for k, v in doc.items() if k != 'plan_sha256'}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()


def signed_text(script_path: str | Path) -> tuple[str, str, int]:
    """The words the clone reads: the signed script words in order, exactly as signed, one space between each. Returns
    the text, the script file's sha256 and its word count."""
    from .conform import load_script  # noqa: PLC0415
    words, sha = load_script(Path(script_path))
    return ' '.join(word['word'] for word in words), sha, len(words)


def take_of(spec: dict) -> str:
    """The one take every cut names: the clone voice's asset id, and the take id ve ingest gives its file."""
    takes = sorted({cut['take'] for cut in spec['cuts'].values()})
    if len(takes) != 1:
        raise ValueError(f"every cut of a clone-voiced short takes the one voice; the cuts name {', '.join(takes)}")
    if not SLUG.match(takes[0]):
        raise ValueError(f'the cuts take {takes[0]!r}; the clone voice is an asset, so its id is a slug (a-z, 0-9, _ and -)')
    return takes[0]


def registry_entry(cfg: dict, fetch=None, name: str | None = None) -> dict:
    """The clone's active entry in krish-clone's registry, read live (lint.read_synthetic_registry); refuses one that is
    missing, withdrawn or names no voice id. name is the bank voice's registry_name (default: the config's clone)."""
    from . import lint  # noqa: PLC0415
    name = name or cfg['clone']
    entries = lint.read_synthetic_registry(fetch)
    entry = next((e for e in entries if e['name'] == name and e['kind'] == 'voice'
                  and e['platform'] == cfg['platform']), None)
    if entry is None:
        raise ValueError(f"{name} is not an approved voice from {cfg['platform']} in krish-clone's registry "
                         f'({lint.SYNTHETIC_REGISTRY}); nothing is generated until he approves it')
    if not VOICE_ID.match(str(entry.get('platform_ref') or '')):
        raise ValueError(f"{name}'s registry entry names no platform_ref, the voice id the clone is called by")
    return entry


def stock_voice(voice: str, bank: dict | None = None) -> dict:
    """An approved stock voice from the voice bank (config/voice-bank.json), as the plan names it; refuses his own voice
    (that is the clone route, held to krish-clone's registry) and any voice he has not approved on the board."""
    from . import voice_bank  # noqa: PLC0415
    bank = bank or voice_bank.load()
    entry = voice_bank.voice(bank, voice)
    problem = voice_bank.stock_problem(voice_bank.stock_tool(entry), bank) if entry['kind'] == 'stock' else None
    if problem:
        raise ValueError(f'--voice {problem}; nothing is generated')
    return {'name': entry['id'], 'platform': 'elevenlabs', 'voice_id': entry['voice_id'], 'kind': 'stock',
            'approved_sha256': None, 'approved_on': entry.get('approved_on'), 'model': entry['model']}


def plan(spec: dict, script_path: str | Path, *, cfg: dict | None = None, fetch=None, voice: str | None = None,
         bank: dict | None = None) -> dict:
    """The exact generation, checked and costed, spending nothing. Raises with every reason it is refused. voice is the
    voice bank id he picked on the Content Board (config/voice-bank.json); none, or his own (krish-remix), is his
    approved clone from krish-clone's registry, as before; a stock voice must be one he approved."""
    from . import lint, voice_bank  # noqa: PLC0415
    if voice == voice_bank.RECORD_MYSELF:
        raise ValueError('he picked Record it myself on the board: no voice is generated. Send the approved script to his '
                         'Teleprompter (scripts/post-pack/teleprompter_send.py) and ingest his take from the Video Engine Inbox '
                         '(docs/ve/RUNBOOK.md S3), as for any recording')
    cfg = cfg or config()
    problems = list(lint.clone_route_problems(spec))
    for index, asset in lint.clone_voices(spec):
        problem = lint.clone_tool_problem(asset)
        if problem:
            problems.append(f'voice.clone_route assets.{index}.tool: {problem}')
    if problems:
        raise ValueError('; '.join(problems))
    take = take_of(spec)
    bank = bank or voice_bank.load()
    stock = voice is not None and voice_bank.voice(bank, voice)['kind'] == 'stock'
    if stock:
        clone = stock_voice(voice, bank)
        tool = f"elevenlabs.stock_voice:{clone['name']}"
    else:
        # His own voice: the one he picked, else the bank's default (Krish v2 since 17 Nov 2026), read from the registry.
        mine = voice_bank.krish(bank, voice)
        entry = registry_entry(cfg, fetch, mine['registry_name'])
        # His own voice picked on the board: the voice he heard there (the bank's) is the one the registry approves.
        mismatch = voice_bank.registry_problems(bank, [entry], voice) if voice is not None else []
        if mismatch:
            raise ValueError('; '.join(mismatch))
        if not any(lint._synthetic_match(entry, approval) for approval in spec.get('approvals') or []):
            raise ValueError(f"the spec carries no approval of {entry['name']}: add approvals[gate=synthetic] with by Krish, and "
                             f"said, on and artifact_hash copied exactly from its registry entry (artifact_hash "
                             f"{entry['approved_sha256']})")
        clone = {'name': entry['name'], 'platform': entry['platform'], 'voice_id': entry['platform_ref'],
                 'approved_sha256': entry['approved_sha256'], 'approved_on': entry['approved_on']}
        tool = f"{cfg['platform']}.{cfg['capability']}:{entry['name']}"
        # His voice is read on the model the bank pins for it (Krish, 2026-11-17: "v3 sounds right"), when the bank's
        # voice is the one the registry approves; otherwise on the engine's default model.
        if mine['voice_id'] == entry['platform_ref']:
            clone['model'] = mine['model']
            # Krish, 2026-11-17: "yes, 15% is right" (Krish v2 read 15% faster, pitch kept, after generation).
            if mine.get('speed') and mine['speed'] != 1:
                clone['speed'] = mine['speed']
    text, script_sha, words = signed_text(script_path)
    characters = len(text)
    # Whether the voice has held on a whole script (config/voice-bank.json whole_script); printed with the plan.
    bank_entry = next((v for v in bank['voices'] if v['voice_id'] == clone['voice_id']), None)
    caution = voice_bank.whole_script_warning(bank_entry) if bank_entry else None
    doc = {
        'schema': PLAN_SCHEMA, 'ruling': cfg['ruling'], 'piece': spec['piece_id'], 'publish_day': spec.get('publish_day'),
        'take': take, 'cuts': sorted(spec['cuts']),
        **({'caution': caution} if caution else {}),
        'clone': clone,
        'tool': tool,
        **({'speed': clone['speed']} if clone.get('speed') else {}),
        'model': clone.get('model') or cfg['model'], 'output_format': cfg['output_format'], 'endpoint': cfg['endpoint'],
        'script': {'file': Path(script_path).name, 'sha256': script_sha, 'words': words},
        'text': text, 'text_sha256': hashlib.sha256(text.encode('utf-8')).hexdigest(), 'characters': characters,
        'credits': {'provider': cfg['provider'], 'per_character': cfg['credits_per_character'],
                    'estimate': math.ceil(characters * cfg['credits_per_character'])},
    }
    doc['plan_sha256'] = digest(doc)
    return doc


def request(url: str, payload: dict, key: str, timeout: float) -> tuple[bytes, dict]:
    """One POST to ElevenLabs; the audio and the response headers (lower-cased). urllib honours the proxy settings."""
    import urllib.request  # noqa: PLC0415
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), method='POST',
                                 headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    with urllib.request.urlopen(req, timeout=timeout) as response:  # noqa: S310 - the endpoint is the config's https URL
        return response.read(), {k.lower(): v for k, v in response.headers.items()}


def charged(headers: dict, estimate: int) -> tuple[float, str]:
    """What ElevenLabs reports it charged (character-cost), else the estimate, and which it was."""
    value = headers.get('character-cost')
    try:
        cost = float(value)
        if math.isfinite(cost) and cost >= 0:
            return cost, 'character-cost'
    except (TypeError, ValueError):
        pass
    return float(estimate), 'estimate (no character-cost header)'


def generate(doc: dict, *, plan_sha256: str, spend_id: str, assets_dir: str | Path, cfg: dict | None = None,
             env: dict | None = None, post=None, reserve=None, settle=None, now: str | None = None) -> dict:
    """Run exactly the plan, once, through the credit route. Returns the receipt; raises before anything is spent when
    the plan is not the one printed, the booking is missing or the key is not on this machine."""
    from . import ledger  # noqa: PLC0415
    cfg = cfg or config()
    if digest(doc) != doc.get('plan_sha256') or plan_sha256 != doc['plan_sha256']:
        raise ValueError(f"--plan-sha256 {plan_sha256 or '(none)'} is not the plan as it stands ({doc.get('plan_sha256')}): "
                         'read the plan again and give the digest it prints; nothing was generated')
    if not SPEND_ID.match(str(spend_id or '')):
        raise ValueError("--spend-id: the spend_id Control Center's reserve_credit_spend returned for this generation (pool "
                         f"elevenlabs, {doc['credits']['estimate']} credits); nothing was generated")
    key = (env if env is not None else os.environ).get(cfg['key_env'])
    if not key:
        raise ValueError(f"this machine holds no {cfg['key_env']}: generate on the machine that does; nothing was generated")
    if assets_dir is None:
        raise ValueError('--assets-dir: where the voice is written; nothing was generated')
    assets = Path(assets_dir)
    assets.mkdir(parents=True, exist_ok=True)
    estimate = doc['credits']['estimate']
    reservation = (reserve or ledger.reserve)(doc['credits']['provider'], estimate, doc['piece'],
                                              f"clone voice {doc['take']}, plan {doc['plan_sha256'][:12]}, spend {spend_id}")
    url = doc['endpoint'].format(voice_id=doc['clone']['voice_id']) + f"?output_format={doc['output_format']}"
    try:
        audio, headers = (post or request)(url, {'text': doc['text'], 'model_id': doc['model']}, key,
                                           float(cfg.get('timeout_s', 180)))
    except BaseException:
        (settle or ledger.settle)(reservation, 0)  # nothing came back, so nothing is charged against the cap
        raise
    cost, source = charged(headers, estimate)
    (settle or ledger.settle)(reservation, cost)
    if not audio:
        raise ValueError('ElevenLabs returned no audio; the reservation is settled at what it reported charging')
    provider_file = assets / f"{doc['take']}.{doc['output_format'].split('_')[0]}"
    provider_file.write_bytes(audio)
    voice = assets / f"{doc['take']}.wav"
    # His voice's speed (Krish v2: 15% faster, pitch kept; the v3 settings have no speed control).
    tempo = ['-filter:a', f"atempo={doc['speed']}"] if doc.get('speed') else []
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(provider_file), *tempo, '-ac', '1',
                    '-ar', str(cfg.get('sample_rate', 48000)), '-c:a', 'pcm_s16le', str(voice)], check=True, capture_output=True)
    voice_sha = sha256_file(voice)
    request_id = headers.get('request-id') or headers.get('x-request-id')
    asset = {'id': doc['take'], 'kind': 'voice', 'origin': 'generated', 'path': voice.name, 'sha256': voice_sha,
             'licence': (f"generated with the approved ElevenLabs stock voice {doc['clone']['name']} (config/voice-bank.json)"
                         if doc['clone'].get('kind') == 'stock' else
                         f"generated with his approved ElevenLabs voice clone ({doc['clone']['name']}, krish-clone's registry)"),
             'tool': doc['tool'], 'prompt_ref': PLAN_FILE, 'credits': cost}
    if request_id:
        asset['job_id'] = str(request_id)
    return {
        'schema': RECEIPT_SCHEMA, 'piece': doc['piece'], 'take': doc['take'], 'plan_sha256': doc['plan_sha256'],
        'text_sha256': doc['text_sha256'], 'script_sha256': doc['script']['sha256'], 'clone': doc['clone']['name'],
        'model': doc['model'], **({'speed': doc['speed']} if doc.get('speed') else {}), 'generated_at': now or datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'credits': {'provider': doc['credits']['provider'], 'estimate': estimate, 'charged': cost, 'charged_from': source,
                    'reservation': reservation, 'spend_id': spend_id},
        'request_id': request_id,
        'provider_file': {'name': provider_file.name, 'sha256': sha256_file(provider_file)},
        'voice': {'name': voice.name, 'sha256': voice_sha},
        'asset': asset,
    }
