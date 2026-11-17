"""The voice bank: the ElevenLabs voices a voiceover may be read in (config/voice-bank.json).

Krish, 2026-11-17: "for all voiceovers and carousels, I want there to either be an audio track over the carousel, or, if
it's a voiceover, then I want Eleven Labs voices used to do the voiceovers. I always want to be given a few options in my
control center. We should have some stock voices approved in Eleven Labs and, obviously, my own Krish remix voice too".

The bank holds his own voice (kind krish, whose id krish-clone's registry also holds and wins on) and stock voices from
ElevenLabs' library (kind stock), each proposed until his press on the Content Board approves it. Only an approved voice
is generated: `ve voice clone --voice <id>` reads it from here, never a typed id. The board offers every voice, proposed
ones marked, with ElevenLabs' own free preview clip to hear.

The bed under a voiceover, and the track over a carousel, come from the off-day rotation in config/music-library.json
("for": "off-day"; guards.off_day_beds), at the one bed shape (config/music-bed.json, F40): loud open, low and steady
under the voice, louder end. Nothing here picks one for him.
"""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

from .common import CONFIG, load_json

BANK_PATH = CONFIG.parent / 'voice-bank.json'
SCHEMA = 'voice-bank/1'
ID = re.compile(r'^[a-z0-9][a-z0-9-]{0,39}$')
VOICE_ID = re.compile(r'^[A-Za-z0-9]{8,64}$')
KINDS = ('krish', 'stock')
STATUSES = ('approved', 'proposed', 'retired')
# His pick on the board when he records the voiceover himself: Teleprompter, never ElevenLabs (Krish, 2026-11-17: "I should
# be able to choose to record manually myself as well, and then the teleprompter workflow will activate, as opposed to the
# ElevenLabs workflow").
RECORD_MYSELF = 'record-myself'
# The ElevenLabs text-to-speech models a voice may be pinned to (Krish, 2026-11-17, on his Krish Remix voice: "v3 sounds
# right"; on eleven_v4 it did not sound like the voice he made).
MODELS = ('eleven_v3', 'eleven_multilingual_v2', 'eleven_v4', 'eleven_flash_v2_5')
# Where ElevenLabs serves its own preview clips; the board's sample route redirects only to these.
PREVIEW_HOSTS = ('storage.googleapis.com', 'api.us.elevenlabs.io', 'api.elevenlabs.io')
# The tool a stock voice is generated with in a spec: elevenlabs.stock_voice:<bank id>. It is never his voice, so
# voice.synthetic does not hold it to krish-clone's registry; voice.stock holds it to this bank instead.
STOCK_TOOL = re.compile(r'^elevenlabs\.stock[ _-]?voice:\s*([a-z0-9][a-z0-9-]{0,39})\s*$')


def problems(bank: dict) -> list[str]:
    """Everything wrong with the bank, [] when it holds."""
    out: list[str] = []
    if bank.get('schema') != SCHEMA:
        out.append(f'schema is not {SCHEMA}')
    voices = bank.get('voices')
    if not isinstance(voices, list) or not voices:
        return out + ['voices is not a list of voices']
    seen_ids: set[str] = set()
    seen_voice: set[str] = set()
    krish = 0
    for n, v in enumerate(voices):
        where = f'voices[{n}]'
        if not isinstance(v, dict):
            out.append(f'{where} is not an object')
            continue
        vid, kind, status = v.get('id'), v.get('kind'), v.get('status')
        if not isinstance(vid, str) or not ID.match(vid):
            out.append(f'{where}.id {vid!r} is not a slug')
        elif vid in seen_ids:
            out.append(f'{where}.id {vid} is listed twice')
        else:
            seen_ids.add(vid)
        if kind not in KINDS:
            out.append(f'{where}.kind {kind!r} is not one of {", ".join(KINDS)}')
        krish += kind == 'krish'
        if status not in STATUSES:
            out.append(f'{where}.status {status!r} is not one of {", ".join(STATUSES)}')
        voice_id = v.get('voice_id')
        if not isinstance(voice_id, str) or not VOICE_ID.match(voice_id):
            out.append(f'{where}.voice_id is not an ElevenLabs voice id')
        elif voice_id in seen_voice:
            out.append(f'{where}.voice_id {voice_id} is listed twice')
        else:
            seen_voice.add(voice_id)
        if v.get('model') not in MODELS:
            out.append(f'{where}.model {v.get("model")!r} is not one of {", ".join(MODELS)}; each voice pins its own model')
        for key in ('name', 'line', 'why'):
            if not isinstance(v.get(key), str) or not v[key].strip():
                out.append(f'{where}.{key} is missing')
        url = urlparse(str(v.get('preview_url') or ''))
        if url.scheme != 'https' or url.hostname not in PREVIEW_HOSTS:
            out.append(f'{where}.preview_url is not an ElevenLabs preview (https on {", ".join(PREVIEW_HOSTS)})')
        if status == 'approved' and (v.get('approved_by') != 'Krish' or not v.get('approved_on')):
            out.append(f'{where}: an approved voice names approved_by Krish and approved_on')
        if kind == 'krish' and not v.get('registry_name'):
            out.append(f"{where}: his own voice names its krish-clone registry_name")
    defaults = [v for v in voices if isinstance(v, dict) and v.get('kind') == 'krish' and v.get('default') is True]
    if not krish:
        out.append('the bank holds none of his own voices (kind krish)')
    elif len(defaults) != 1:
        out.append(f'{len(defaults)} of his own voices are the default; exactly one is (default: true)')
    for n, v in enumerate(voices):
        if isinstance(v, dict) and 'speed' in v and not (isinstance(v['speed'], (int, float)) and 0.7 <= v['speed'] <= 1.3):
            out.append(f'voices[{n}].speed is not between 0.7 and 1.3')
    return out


def load(path: str | Path | None = None) -> dict:
    bank = load_json(path or BANK_PATH)
    found = problems(bank)
    if found:
        raise ValueError(f'{Path(path or BANK_PATH).name}: ' + '; '.join(found))
    return bank


def voice(bank: dict, voice_id: str) -> dict:
    """The bank's entry by its id, or a refusal naming the ids it holds."""
    entry = next((v for v in bank['voices'] if v['id'] == voice_id), None)
    if entry is None:
        raise ValueError(f"{voice_id!r} is not in the voice bank ({', '.join(v['id'] for v in bank['voices'])})")
    return entry


def krish(bank: dict, voice_id: str | None = None) -> dict:
    """One of his own voices: the one named, else the default (Krish v2 since 17 Nov 2026)."""
    if voice_id is not None:
        entry = voice(bank, voice_id)
        if entry['kind'] != 'krish':
            raise ValueError(f'{voice_id} is not one of his own voices')
        return entry
    return next(v for v in bank['voices'] if v['kind'] == 'krish' and v.get('default') is True)


def registry_problems(bank: dict, entries: list[dict], voice_id: str | None = None) -> list[str]:
    """His own voice in the bank names the registry entry krish-clone approves, with the same voice id. The registry
    wins: a bank that disagrees is refused, never used."""
    mine = krish(bank, voice_id)
    entry = next((e for e in entries if e.get('name') == mine['registry_name'] and e.get('kind') == 'voice'
                  and e.get('platform') == 'elevenlabs'), None)
    if entry is None:
        return [f"{mine['registry_name']} is not an active ElevenLabs voice in krish-clone's registry"]
    if entry.get('platform_ref') != mine['voice_id']:
        return [f"the bank's {mine['id']} is {mine['voice_id']} but krish-clone's registry approves "
                f"{entry.get('platform_ref')} for {mine['registry_name']}; the registry wins: fix the bank"]
    return []


def generatable(entry: dict) -> bool:
    """Only a voice he approved is generated; a proposed one is only heard on the board."""
    return entry.get('status') == 'approved'


def stock_tool(entry: dict) -> str:
    return f"elevenlabs.stock_voice:{entry['id']}"


def stock_name(tool: str) -> str | None:
    """The bank id a spec asset's tool names as a stock voice, or None when it is no stock voice tool."""
    m = STOCK_TOOL.match(str(tool or '').strip().lower())
    return m.group(1) if m else None


def stock_problem(tool: str, bank: dict | None = None) -> str | None:
    """None when the tool names an approved stock voice in the bank; else why it is refused. His own voice is never a
    stock voice: naming it here would dodge voice.synthetic, so it is refused."""
    name = stock_name(tool)
    if name is None:
        return None
    try:
        bank = bank or load()
        entry = voice(bank, name)
    except Exception as failed:  # noqa: BLE001 - an unreadable bank is a refusal, never a pass
        return f'{tool}: {failed}'
    if entry['kind'] != 'stock':
        return f"{tool}: {name} is his own voice, never a stock voice; write it as elevenlabs.voice_clone:{entry.get('registry_name')}"
    if not generatable(entry):
        return f'{tool}: {name} is {entry["status"]} in the voice bank; only a voice he approved on the board is used'
    return None


def offday_tracks() -> list[dict]:
    """The off-day rotation (config/music-library.json "for": "off-day", in ledger order): the light beds a voiceover
    and a carousel are offered, with the Drive file the board plays."""
    from . import guards  # noqa: PLC0415
    ids = guards.off_day_beds()
    tracks = load_json(CONFIG.parent / 'music-library.json').get('tracks') or []
    return [t for i in ids for t in tracks if t.get('id') == i]


def whole_script_warning(entry: dict) -> str | None:
    """Why a voice may not hold on a whole script, or None when it has (Tue 17 Nov 2026: Krish v2 held his voice for a
    ten-second opening and drifted to an accent he does not have on the full script)."""
    test = entry.get('whole_script') or {}
    if test.get('passed') is True:
        return None
    return (f"{entry['name']} is not proven on a whole script ({test.get('note') or 'not yet tested'}); hear the whole "
            'generation before it reaches him, and offer Record it myself if it drifts')


def default_voice(bank: dict) -> str:
    """The voice a voiceover is made in when he has picked none: his default own voice once it has held on a whole script,
    else Record it myself (Ruling, Krish, 2026-11-17: "make Record it myself the default until a voice passes")."""
    mine = krish(bank)
    return mine['id'] if (mine.get('whole_script') or {}).get('passed') is True else RECORD_MYSELF
