#!/usr/bin/env python3
"""The meme templates lane's gather: existing meme videos worth reskinning, found for the Sunday ideas run.

Krish, 2026-11-17, of Sat 21 Nov's board: "we are also missing hilarious meme suggestions - we need to build an AI pop
culture roaster in my humour style - you saw the AI Agent using your computer meme and the AI translator meme I liked -
why can we not create a pipeline of existing meme videos that could be good to reskin, and show me those in here? Then I
could think of a funny caption for it thats related to AI."

    python3 scripts/post-pack/meme_templates.py gather 2026-11-30
    python3 scripts/post-pack/meme_templates.py gather 2026-11-30 --reddit-file MemeTemplatesOfficial=saved.json --no-network

gather writes docs/plans/<Monday>-week/meme-template-candidates.json (never committed: .gitignore; other people's
titles and clips), from the free places his answers named:

  (a) his Instagram inspo sheet: the week's lookalike-input.json posts that are videos with a meme or humour signal
      (place "sheet"), and his inspiration cards in sources.json that are videos with one (place "card");
  (b) Reddit's public JSON: r/MemeTemplatesOfficial and r/memes, top of the week, video posts only (place "reddit"),
      read with a generic User-Agent and nothing about him.

Each candidate is the template object the board shows (references/meme-roaster.md) without caption_ideas:
{title, clip {url, page, poster, seconds}, found {place, label, url}, credit, what_happens, why_it_works, mechanism,
moment, date}. what_happens starts as the post's own title or summary, why_it_works and mechanism are empty: the
Sunday session's roaster step writes them, adds the week's pop-culture moments from its web search (place
"pop_culture"), picks 6 to 10, and drafts the caption ideas. A clip page offered on the three boards before is left out.
A source that cannot be read is said in `sources` with why, and never stops the others.

Trending meme videos on TikTok come through Apify, which costs money: --apify runs only with --max-items N (at most
30) and --i-approved-spend, and with APIFY_TOKEN set. One run reads at most N items from one scraper actor, split across
its hashtags, under Apify's own charge cap (APIFY_CHARGE_CAP_USD, the lowest Apify accepts); the first run, 17 Nov 2026,
read 30 items for about $0.09. Ruling (Krish, 2026-11-17): "run Apify weekly in the Sunday ideas run", so the Sunday
ideas workflow passes the flags once a week, in a step of its own before the Claude step, with the key only in that step
(.github/workflows/sunday-ideas.yml); no session passes them on its own. That step's results are also kept in
meme-template-apify.json (never committed), and a later gather without --apify reads them back in, so the Claude
step's own gather keeps them.
"""
import argparse
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import idea_checks  # noqa: E402

USER_AGENT = 'content-engine-meme-templates/1.0'
SUBREDDITS = ('MemeTemplatesOfficial', 'memes')
REDDIT_URL = 'https://www.reddit.com/r/{sub}/top.json?t=week&limit=50'
APIFY_MAX = 30
APIFY_ACTOR = 'clockworks~tiktok-scraper'
APIFY_HASHTAGS = ('memetemplate', 'memetemplates')
# Apify refuses a run whose charge cap is under $0.50; the item cap keeps the real charge far below it (about $0.09).
APIFY_CHARGE_CAP_USD = 0.5
APIFY_FILE = 'meme-template-apify.json'
SHEET_DAYS = 30
# A post that says it is a meme, a joke or a relatable bit: the words meme people use about their own posts.
MEME_SIGNAL = re.compile(r'\b(?:memes?|meme ?template|lol|lmao|funny|humou?r|joke|pov|relatable|when your|me when|nobody:|'
                         r'skit|parody|reaction|green ?screen)\b|\U0001F602|\U0001F923|\U0001F480', re.I)
VIDEO_TYPE = re.compile(r'video|reel|clip|igtv', re.I)


class GatherError(Exception):
    pass


def write_for():
    """Who the captions are for and what a meme may be about, read from config/beat.json (the reader's about line and
    offdays.meme, Krish, 2026-11-26: the memes are aligned to the new positioning), so the roaster step reads the reader's
    world beside the clips. The clips themselves are found as before: a template is any clip; its subject is ours."""
    beat = json.loads((Path(__file__).resolve().parents[2] / 'config' / 'beat.json').read_text(encoding='utf-8'))
    off = beat.get('offdays') or {}
    return {'reader': beat['reader']['audience_short'], 'about': beat['reader']['about'], 'meme': off.get('meme'),
            'worlds': off.get('worlds') or [], 'gate': 'board_feed.py gate (code off_beat) refuses a template whose funny line and '
            'why_it_works name nothing in the focus sectors, from the story score board'}


def monday(text):
    try:
        d = date.fromisoformat(text)
    except ValueError:
        raise GatherError(f'{text!r} is not a date, YYYY-MM-DD')
    if d.weekday() != 0:
        raise GatherError(f'{text} is not a Monday: give the Monday the week starts on')
    return d


def https(v):
    v = html.unescape(str(v or '')).strip()
    return v if re.match(r'^https://[^\s"<>]+$', v) else None


def line(v, cap=300):
    return ' '.join(str(v or '').split())[:cap]


def day_of(v):
    s = str(v or '')
    return s[:10] if re.match(r'^\d{4}-\d{2}-\d{2}', s) else None


def candidate(*, title, url, page, poster=None, seconds=None, place, label, found_url, credit, what, when, extra=None):
    out = {'title': line(title, 140), 'clip': {'url': url, 'page': page, 'poster': poster, 'seconds': seconds},
           'found': {'place': place, 'label': line(label, 200), 'url': found_url}, 'credit': line(credit, 200) or 'Unknown: see the page',
           'what_happens': line(what, 400), 'why_it_works': '', 'mechanism': [], 'moment': None, 'date': when}
    if extra:
        out.update(extra)
    return out


def sheet_candidates(posts, today=None):
    """Candidates from his Instagram inspo sheet (lookalike-input.json posts): videos with a meme or humour signal,
    from the last SHEET_DAYS days when the post says its date."""
    today = today or datetime.now(timezone.utc).date()
    out = []
    for p in posts or []:
        if not isinstance(p, dict):
            continue
        page = https(p.get('url'))
        words = ' '.join(str(p.get(k) or '') for k in ('headline', 'summary', 'caption', 'account'))
        if not page or not VIDEO_TYPE.search(str(p.get('type') or '')) or not MEME_SIGNAL.search(words):
            continue
        when = day_of(p.get('published')) or day_of(p.get('retrieved'))
        if when and date.fromisoformat(when) < today - timedelta(days=SHEET_DAYS):
            continue
        account = line(p.get('account'), 80)
        out.append(candidate(title=p.get('headline') or p.get('summary') or 'A meme video in your sheet', url=page, page=page,
                             place='sheet', label='Your Instagram inspo sheet', found_url=page,
                             credit=f'{account} on Instagram' if account else '', what=p.get('summary') or p.get('headline'), when=when))
    return out


CARD_LISTS = ('routed', 'liked', 'fresh', 'positive', 'study_style')


def card_candidates(sources):
    """Candidates from his inspiration cards (sources.json inspiration): videos with a link whose words, his or the
    card's, carry a meme or humour signal (his "We should reskin this as a hilarious video meme", 29 Oct)."""
    inspo = (sources or {}).get('inspiration') if isinstance((sources or {}).get('inspiration'), dict) else {}
    out, seen = [], set()
    for key in CARD_LISTS:
        for c in inspo.get(key) or []:
            if not isinstance(c, dict) or c.get('kind') != 'video' or c.get('id') in seen:
                continue
            page = https(c.get('link'))
            his = ' '.join(str(c.get(k) or '') for k in ('saved_why', 'why_like', 'endorsed', 'would_do', 'note_for_claude'))
            if not page or not MEME_SIGNAL.search(his + ' ' + str(c.get('name') or '')):
                continue
            seen.add(c.get('id'))
            out.append(candidate(title=line(his, 120) or c.get('name'), url=page, page=page, place='card',
                                 label=f'Your inspiration card ({c.get("platform") or "saved"})', found_url=page,
                                 credit=f'The original poster on {c.get("platform") or "the page"}', what=his,
                                 when=day_of(c.get('created_at')), extra={'card_id': c.get('id'), 'his_words': line(his, 400)}))
    return out


def reddit_candidates(listing, sub):
    """Candidates from one Reddit listing (top.json): video posts only, never one marked adult, stickied or removed."""
    out = []
    children = ((listing or {}).get('data') or {}).get('children') if isinstance(listing, dict) else None
    for ch in children or []:
        d = ch.get('data') if isinstance(ch, dict) else None
        if not isinstance(d, dict) or d.get('over_18') or d.get('stickied') or d.get('removed_by_category'):
            continue
        media = d.get('secure_media') or d.get('media') or {}
        rv = media.get('reddit_video') if isinstance(media, dict) else None
        video = bool(d.get('is_video')) or d.get('post_hint') in ('hosted:video', 'rich:video') or isinstance(rv, dict)
        if not video:
            continue
        page = https('https://www.reddit.com' + str(d.get('permalink') or '')) if d.get('permalink') else None
        clip = https(re.sub(r'\?source=fallback$', '', str((rv or {}).get('fallback_url') or ''))) or https(d.get('url_overridden_by_dest')) or https(d.get('url'))
        if not page or not clip:
            continue
        images = ((d.get('preview') or {}).get('images') or []) if isinstance(d.get('preview'), dict) else []
        poster = https(((images[0] or {}).get('source') or {}).get('url')) if images and isinstance(images[0], dict) else None
        poster = poster or https(d.get('thumbnail'))
        seconds = (rv or {}).get('duration')
        when = datetime.fromtimestamp(float(d['created_utc']), timezone.utc).date().isoformat() if isinstance(d.get('created_utc'), (int, float)) else None
        author = line(d.get('author'), 60)
        out.append(candidate(title=d.get('title') or 'A meme video', url=clip, page=page, poster=poster,
                             seconds=seconds if isinstance(seconds, (int, float)) and not isinstance(seconds, bool) and seconds > 0 else None,
                             place='reddit', label=f'r/{sub}, top of the week', found_url=page,
                             credit=f'Posted by u/{author} on r/{sub}; the original maker is to be confirmed' if author else f'Posted on r/{sub}',
                             what=d.get('title'), when=when, extra={'score': d.get('score') if isinstance(d.get('score'), int) else None}))
    return out


def fetch_json(url, headers=None, data=None, timeout=20):
    req = urllib.request.Request(url, data=data, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json', **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def apify_candidates(max_items, token, fetch=fetch_json):
    """Trending meme videos from TikTok through one Apify actor run, at most max_items results. Costed: only gather's
    --apify, with --max-items and --i-approved-spend, ever calls it."""
    if not isinstance(max_items, int) or not 1 <= max_items <= APIFY_MAX:
        raise GatherError(f'--max-items is 1 to {APIFY_MAX}')
    per_tag = -(-max_items // len(APIFY_HASHTAGS))  # the cap is the run's total, not each hashtag's
    body = json.dumps({'hashtags': list(APIFY_HASHTAGS), 'resultsPerPage': per_tag, 'maxItems': max_items,
                       'shouldDownloadVideos': False, 'shouldDownloadCovers': False}).encode('utf-8')
    url = (f'https://api.apify.com/v2/acts/{APIFY_ACTOR}/run-sync-get-dataset-items?maxItems={max_items}'
           f'&maxTotalChargeUsd={APIFY_CHARGE_CAP_USD}')
    items = fetch(url, {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}, body, 300)
    out = []
    for it in (items if isinstance(items, list) else [])[:max_items]:
        page = https(it.get('webVideoUrl') if isinstance(it, dict) else None)
        if not page:
            continue
        author = ((it.get('authorMeta') or {}).get('name') if isinstance(it.get('authorMeta'), dict) else None) or ''
        out.append(candidate(title=it.get('text') or 'A TikTok meme video', url=page, page=page,
                             poster=https((it.get('videoMeta') or {}).get('coverUrl') if isinstance(it.get('videoMeta'), dict) else None),
                             seconds=(it.get('videoMeta') or {}).get('duration') if isinstance(it.get('videoMeta'), dict) else None,
                             place='tiktok', label='TikTok, #memetemplate', found_url=page,
                             credit=f'@{author} on TikTok' if author else 'On TikTok', what=it.get('text'), when=day_of(it.get('createTimeISO'))))
    return out


def earlier_pages(week, plans):
    """Clip pages of the meme templates the three boards before offered (idea_checks.TEMPLATE_WEEKS)."""
    out = set()
    for back in range(1, idea_checks.TEMPLATE_WEEKS + 1):
        path = Path(plans) / f'{(week - timedelta(days=7 * back)).isoformat()}-week' / 'ideas.json'
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        for opts in (data.get('offdays') or {}).values() if isinstance(data.get('offdays'), dict) else []:
            out |= {idea_checks.template_page(o) for o in opts or [] if idea_checks.is_template(o)}
    return {u for u in out if u}


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8')), None
    except FileNotFoundError:
        return None, f'no {Path(path).name}'
    except (OSError, ValueError) as error:
        return None, f'{Path(path).name} cannot be read ({error})'


def gather(week, plans=None, today=None, network=True, reddit_files=None, apify=None, fetch=fetch_json):
    """(path written, summary lines). apify: None, or {'max_items': N, 'token': ...} once every guard has passed."""
    wk = monday(week)
    plans = Path(plans) if plans else ROOT / 'docs' / 'plans'
    folder = plans / f'{wk.isoformat()}-week'
    folder.mkdir(parents=True, exist_ok=True)
    sources, found = [], []

    def took(name, fn):
        try:
            got = fn()
            sources.append({'source': name, 'count': len(got), 'error': None})
            found.extend(got)
        except GatherError as error:
            sources.append({'source': name, 'count': 0, 'error': str(error)})
        except (OSError, ValueError, urllib.error.URLError, TypeError, KeyError) as error:
            sources.append({'source': name, 'count': 0, 'error': f'{type(error).__name__}: {error}'})

    def sheet():
        data, err = read_json(folder / 'lookalike-input.json')
        if err:
            raise GatherError(f'{err}; run lookalike.py prepare <Monday> first')
        return sheet_candidates(data.get('posts'), today)

    def cards():
        data, err = read_json(folder / 'sources.json')
        if err:
            raise GatherError(f'{err}; run board_feed.py gather <Monday> first')
        return card_candidates(data)

    took('sheet', sheet)
    took('cards', cards)
    for sub in SUBREDDITS:
        def reddit(sub=sub):
            if reddit_files and sub in reddit_files:
                data, err = read_json(reddit_files[sub])
                if err:
                    raise GatherError(err)
                return reddit_candidates(data, sub)
            if not network:
                raise GatherError('not read: --no-network')
            return reddit_candidates(fetch(REDDIT_URL.format(sub=sub)), sub)
        took(f'reddit:r/{sub}', reddit)
    kept = folder / APIFY_FILE
    if apify:
        def paid():
            got = apify_candidates(apify['max_items'], apify['token'], fetch)
            kept.write_text(json.dumps({'week_start': wk.isoformat(), 'read_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                                        'max_items': apify['max_items'], 'candidates': got}, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
            return got
        took('apify:tiktok', paid)
    elif kept.exists():
        def earlier():
            data, err = read_json(kept)
            if err:
                raise GatherError(err)
            if data.get('week_start') != wk.isoformat():
                raise GatherError(f'{APIFY_FILE} is for the week of {data.get("week_start")}, not {wk.isoformat()}')
            return [c for c in data.get('candidates') or [] if isinstance(c, dict) and isinstance(c.get('clip'), dict)]
        took('apify:tiktok (read earlier this run)', earlier)
    before = earlier_pages(wk, plans)
    out, seen, dropped = [], set(), 0
    for c in found:
        page = idea_checks.canon_url(c['clip']['page'])
        if not page or page in seen:
            continue
        seen.add(page)
        if page in before:
            dropped += 1
            continue
        out.append(c)
    doc = {'week_start': wk.isoformat(), 'gathered_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
           '_about': 'Meme template candidates for the roaster step (references/meme-roaster.md). Never committed: other '
                     'people\'s titles and clips. Each needs why_it_works, mechanism and caption ideas before it is an option.',
           'write_for': write_for(), 'sources': sources, 'offered_before': dropped, 'candidates': out}
    path = folder / 'meme-template-candidates.json'
    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    lines = [f'{s["source"]}: {s["count"]}' + (f' (not read: {s["error"]})' if s['error'] else '') for s in sources]
    lines.append(f'{len(out)} candidates, {dropped} left out as offered on the last {idea_checks.TEMPLATE_WEEKS} boards')
    return path, lines


def apify_guard(args, env=None):
    """None when --apify is not asked for; the run's settings when every guard passes; GatherError otherwise."""
    if not args.apify:
        return None
    env = os.environ if env is None else env
    if args.max_items is None or not 1 <= args.max_items <= APIFY_MAX:
        raise GatherError(f'--apify needs --max-items N, 1 to {APIFY_MAX}: the hard cap on what one run reads')
    if not args.i_approved_spend:
        raise GatherError('--apify costs money: it needs --i-approved-spend, given only once Krish approved this run and its cap')
    token = env.get('APIFY_TOKEN')
    if not token:
        raise GatherError('--apify needs APIFY_TOKEN in the environment')
    return {'max_items': args.max_items, 'token': token}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    g = sub.add_parser('gather', help='write docs/plans/<Monday>-week/meme-template-candidates.json')
    g.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    g.add_argument('--today', help='YYYY-MM-DD (default: today, UTC)')
    g.add_argument('--no-network', action='store_true', help='read no web source (Reddit only from --reddit-file)')
    g.add_argument('--reddit-file', action='append', default=[], metavar='SUB=PATH', help='read a saved top.json for a subreddit')
    g.add_argument('--apify', action='store_true', help='also read trending TikTok meme videos through Apify (costed; off by default)')
    g.add_argument('--max-items', type=int, help=f'with --apify: the hard cap on items, at most {APIFY_MAX}')
    g.add_argument('--i-approved-spend', action='store_true', help='with --apify: Krish approved this run and its cap')
    args = ap.parse_args(argv)
    try:
        apify = apify_guard(args)
        files = dict(x.split('=', 1) for x in args.reddit_file if '=' in x)
        path, lines = gather(args.week, today=date.fromisoformat(args.today) if args.today else None,
                             network=not args.no_network, reddit_files=files, apify=apify)
    except (GatherError, ValueError) as error:
        print(f'meme_templates {args.cmd}: {error}', file=sys.stderr)
        return 1
    print('\n'.join(lines))
    print(f'wrote {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
