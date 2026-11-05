"""What a series skin is handed: the house colours, a colour mixer, images as data URIs and the generated stills.

A skin is `skin(html, facts, shape, look, kit) -> html` (the contract is in skins/__init__.py). The kit holds:
  INK, CREAM, SAGE, MINT   the house colours (config/studio.json's tokens, and the Receipt's sage)
  mix(a, b, t)             colour a moved toward colour b by t (0 to 1)
  data_uri(path, width)    an image as a data: URI, scaled down to width (brand.data_uri)
  art(concept, day, shape) the generated still for that skin, series day and shape, fetched and checked, or None
and, for each drawing, tall (every shape but wide), W and H (the shape's size), day ('mon', 'wed' or 'fri', the
series the piece belongs to) and concept (the skin's id).

The stills are media and never live in the repository (AGENTS.md): config/series-art.json names each one by its
URL and sha256, art() fetches it once into .cache/series-art/ and refuses it when its bytes are not the ones
recorded, and refuses to draw at all when there is neither the network nor a checked copy.
"""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT / 'scripts' / 'pages') not in sys.path:
    sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
import brand  # noqa: E402

ART = ROOT / 'config' / 'series-art.json'
ART_CACHE = ROOT / '.cache' / 'series-art'

INK, CREAM, SAGE, MINT = '#0C1512', '#F4EFE4', '#B9D3C3', '#7EF0C0'
# The series each subchannel's weekly piece belongs to, by its day.
DAY_OF = {'follow.the.money': 'mon', 'under.the.hood': 'wed', 'mind.the.gap': 'fri'}


def mix(a, b, t):
    """Colour a moved toward colour b by t (0 to 1)."""
    pa = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    pb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x + (y - x) * t):02X}' for x, y in zip(pa, pb))


def art_table():
    """config/series-art.json: each still's key to its url, sha256, job_id and model."""
    try:
        table = json.loads(ART.read_text(encoding='utf-8'))
    except (OSError, ValueError) as e:
        brand.fail(f'the series stills cannot be read from {ART} ({e})')
    return {k: v for k, v in table.items() if not k.startswith('_')}


def sha256(body):
    return hashlib.sha256(body).hexdigest()


def fetch_art(key, table=None):
    """The still named `key` in config/series-art.json, as a checked local file in .cache/series-art/.

    A copy already there is used only when its sha256 is the recorded one; otherwise it is fetched again. A fetch
    that fails, or bytes that are not the recorded ones, stop the drawing: a cover never wears a still nobody
    checked (the way brand.fetch keeps the wordmark, but closed)."""
    table = art_table() if table is None else table
    if key not in table:
        brand.fail(f'no series still is named {key!r} in {ART}')
    want = str(table[key].get('sha256') or '').lower()
    url = table[key].get('url')
    if not (len(want) == 64 and isinstance(url, str) and url.startswith('https://')):
        brand.fail(f'the series still {key!r} in {ART} needs an https "url" and its "sha256"')
    path = ART_CACHE / f'{key}{Path(url).suffix or ".png"}'
    if path.is_file() and sha256(path.read_bytes()) == want:
        return path
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'makeyourmindup-pages/1'})
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
    except Exception as e:  # noqa: BLE001
        brand.fail(f'could not fetch the series still {key} from {url} ({e}), and there is no checked copy in {ART_CACHE}')
    if sha256(body) != want:
        brand.fail(f'the series still {key} fetched from {url} is not the one recorded in {ART} (its sha256 differs), so it is refused')
    ART_CACHE.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return path


def art(concept, day, shape):
    """The generated still for this skin, series day and shape (config/series-art.json "<concept>-<day>-<tall|wide>"),
    fetched and checked, or None when that skin has no still."""
    key = f'{concept}-{day}-{"tall" if shape != "wide" else "wide"}'
    table = art_table()
    return fetch_art(key, table) if key in table else None


class Kit:
    """The helpers a skin is handed; skins.kit_for() sets the per-drawing ones (tall, W, H, day, concept)."""
    INK, CREAM, SAGE, MINT = INK, CREAM, SAGE, MINT
    mix = staticmethod(mix)
    data_uri = staticmethod(brand.data_uri)
    art = staticmethod(art)
