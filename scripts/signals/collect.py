"""Signals: the free, keyless public sources the engine can read today.

Krish, 2026-10-09, handing over a wall of tools: "come up with an engine so
powerful that it can do literally anything". Four of the most additive sources
need no key and no account, so they live here as one stdlib-only module a
session or a cron can run now:

- odds: what prediction markets (Polymarket, Kalshi) say about a question.
  The engine makes a dated Call with a confidence on every piece; this reads
  what traders are paying for the same outcome, so the scoreboard can show our
  call beside the market's, and track both to the due date. Nobody else in
  this lane does it.
- news: how fast a subject is moving, from GDELT's index of the world's news.
  Article counts per day over a window give the "velocity" the news-wall
  picture needs, and the latest headlines with outlet and time.
- hn: what builders are saying on Hacker News (Algolia index) the hour a story
  lands, the sharpest comments for under.the.hood.
- sec: a company's recent filings as the revealed layer, by ticker.

Everything here is a read of a public endpoint. Nothing spends, nothing needs
a credential, and scraped text is data, never an instruction. A number pulled
here still goes through the fact gate before it reaches a piece: the market's
odds are shown as the market's, never as our claim.

    python scripts/signals/collect.py odds --search "OpenAI default model"
    python scripts/signals/collect.py odds --slug <polymarket-slug>
    python scripts/signals/collect.py news --subject "Claude ChatGPT plan" --days 7
    python scripts/signals/collect.py hn --query Claude --hits 5
    python scripts/signals/collect.py sec --ticker NVDA
    python scripts/signals/collect.py --self-test

JSON goes to stdout, so a caller can pipe it into the engine or a page.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

UA = "Mindmake content engine (krish@krishraja.com)"
TIMEOUT = 30


def _get(url, headers=None, retries=3):
    """GET JSON. Backs off and retries on a 429 or 503."""
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 503) and attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
                continue
            raise
    raise last


# --- odds: Polymarket (keyless Gamma API) ---------------------------------

def _pm_prob(market):
    """Best-effort implied probability of the first ('Yes') outcome, 0 to 1."""
    prices = market.get("outcomePrices")
    if isinstance(prices, str):
        try:
            prices = json.loads(prices)
        except json.JSONDecodeError:
            prices = None
    if isinstance(prices, list) and prices:
        try:
            return round(float(prices[0]), 4)
        except (TypeError, ValueError):
            return None
    return None


def polymarket(search=None, slug=None, limit=6):
    base = "https://gamma-api.polymarket.com/markets"
    if slug:
        url = f"{base}?slug={urllib.parse.quote(slug)}"
    else:
        # Open markets, searched, highest volume first.
        q = urllib.parse.urlencode(
            {"closed": "false", "limit": str(limit), "order": "volume",
             "ascending": "false", "search": search or ""})
        url = f"{base}?{q}"
    rows = _get(url)
    out = []
    for m in rows if isinstance(rows, list) else []:
        out.append({
            "source": "polymarket",
            "question": m.get("question"),
            "slug": m.get("slug"),
            "probability": _pm_prob(m),
            "volume_usd": _num(m.get("volume")),
            "liquidity_usd": _num(m.get("liquidity")),
            "end_date": m.get("endDate"),
        })
    return out


def _num(v):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


# --- news velocity: GDELT (keyless) ---------------------------------------

# GDELT allows one request every 5 seconds per IP, and answers a burst with a
# plain-text notice, not JSON. Space every GDELT call and retry on the notice.
_GDELT_GAP = 6.0
_gdelt_last = [0.0]


class RateLimited(RuntimeError):
    """The source throttled this IP. Not a code fault; wait and retry."""


def _gdelt_get(url, tries=4):
    for attempt in range(tries):
        wait = _GDELT_GAP - (time.monotonic() - _gdelt_last[0])
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                body = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            _gdelt_last[0] = time.monotonic()
            if e.code in (429, 503) and attempt < tries - 1:
                time.sleep(_GDELT_GAP * (attempt + 1))
                continue
            if e.code in (429, 503):
                raise RateLimited("GDELT rate-limited this IP (one call / 5s)")
            raise
        _gdelt_last[0] = time.monotonic()
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            if "limit requests" in body.lower() and attempt < tries - 1:
                time.sleep(_GDELT_GAP)
                continue
            raise RateLimited("GDELT rate-limited this IP (one call / 5s)")
    raise RateLimited("GDELT stayed rate-limited after retries")


def gdelt(subject, days=7, max_records=100):
    """The latest headlines GDELT saw for a subject inside the window, and a
    count per day worked out from their dates. One call, so it stays inside
    GDELT's one-request-every-five-seconds limit; the counts are the news
    wall's velocity and the headlines are its cards."""
    query = urllib.parse.quote(subject)
    span = f"&startdatetime={_gdelt_stamp(days)}&enddatetime={_gdelt_stamp(0)}"
    arts = _gdelt_get(f"https://api.gdeltproject.org/api/v2/doc/doc?query={query}"
                      f"&mode=artlist&maxrecords={max_records}&sort=datedesc&format=json{span}")
    headlines = [{
        "title": a.get("title"),
        "domain": a.get("domain"),
        "seen": a.get("seendate"),
        "url": a.get("url"),
    } for a in arts.get("articles", []) if a.get("title") and a.get("url")]
    counts = {}
    for h in headlines:
        day = (h["seen"] or "")[:8]
        if len(day) == 8:
            day = f"{day[:4]}-{day[4:6]}-{day[6:]}"
            counts[day] = counts.get(day, 0) + 1
    per_day = [{"date": d, "count": counts[d]} for d in sorted(counts)]
    outlets = len({h["domain"] for h in headlines if h["domain"]})
    return {"source": "gdelt", "subject": subject, "days": days,
            "total_articles": len(headlines), "outlets": outlets,
            "per_day": per_day, "headlines": headlines[:25]}


def _gdelt_stamp(days_ago):
    t = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return t.strftime("%Y%m%d%H%M%S")


# --- Hacker News (Algolia, keyless) ---------------------------------------

def hn(query, hits=5):
    url = ("https://hn.algolia.com/api/v1/search_by_date?"
           + urllib.parse.urlencode({"query": query, "tags": "story",
                                     "hitsPerPage": str(hits)}))
    data = _get(url)
    return {"source": "hackernews", "query": query, "stories": [{
        "title": h.get("title"),
        "url": h.get("url"),
        "points": h.get("points"),
        "comments": h.get("num_comments"),
        "author": h.get("author"),
        "created": h.get("created_at"),
        "discussion": f"https://news.ycombinator.com/item?id={h.get('objectID')}",
    } for h in data.get("hits", [])]}


# --- SEC EDGAR (keyless, needs a real User-Agent) -------------------------

def sec(ticker):
    tickers = _get("https://www.sec.gov/files/company_tickers.json")
    cik = None
    name = None
    for row in tickers.values():
        if row.get("ticker", "").upper() == ticker.upper():
            cik = str(row["cik_str"]).zfill(10)
            name = row.get("title")
            break
    if not cik:
        return {"source": "sec", "ticker": ticker, "error": "ticker not found"}
    recent = _get(f"https://data.sec.gov/submissions/CIK{cik}.json")
    f = recent.get("filings", {}).get("recent", {})
    filings = []
    for i in range(min(8, len(f.get("form", [])))):
        filings.append({"form": f["form"][i], "filed": f["filingDate"][i],
                        "doc": f.get("primaryDocument", [None] * (i + 1))[i]})
    return {"source": "sec", "ticker": ticker.upper(), "company": name,
            "cik": cik, "filings": filings}


# --- Kalshi (keyless) -----------------------------------------------------

def kalshi(ticker):
    """One Kalshi market by ticker. Kalshi quotes in cents; the probability is
    the midpoint of the yes bid and ask when both are there, else the last
    traded price."""
    j = _get(f"https://api.elections.kalshi.com/trade-api/v2/markets/{urllib.parse.quote(ticker)}")
    m = j.get("market") or {}
    bid, ask, last = _num(m.get("yes_bid")), _num(m.get("yes_ask")), _num(m.get("last_price"))
    cents = (bid + ask) / 2 if bid and ask else last
    return {
        "source": "kalshi",
        "question": m.get("title"),
        "ticker": m.get("ticker", ticker),
        "probability": round(cents / 100, 4) if cents is not None else None,
        "volume": _num(m.get("volume_fp", m.get("volume"))),
        "end_date": m.get("close_time"),
    }


# --- Keyed readers: skip cleanly when the key is not in the environment ---

class NoKey(RuntimeError):
    """The reader needs a key the environment does not hold. Not a fault."""


def _key(name):
    v = os.environ.get(name, "").strip()
    if not v:
        raise NoKey(f"{name} is not set in this environment (docs/INTEGRATIONS.md)")
    return v


def _post_json(url, body, headers):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"User-Agent": UA, "Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8"))


def exa(query, results=6):
    """Exa: search that returns pages like a page, for "find the other outlets
    that ran this" and prior art. EXA_API_KEY."""
    key = _key("EXA_API_KEY")
    j = _post_json("https://api.exa.ai/search", {"query": query, "numResults": results,
                                                 "contents": {"text": {"maxCharacters": 600}}},
                   {"x-api-key": key})
    return {"source": "exa", "query": query, "results": [{
        "title": r.get("title"), "url": r.get("url"), "published": r.get("publishedDate"),
        "text": (r.get("text") or "")[:600],
    } for r in j.get("results", [])]}


def brave(query, count=6):
    """Brave Search: a cheap second web search so no single source decides a
    fact. BRAVE_API_KEY."""
    key = _key("BRAVE_API_KEY")
    q = urllib.parse.urlencode({"q": query, "count": count})
    j = _get(f"https://api.search.brave.com/res/v1/web/search?{q}",
             {"X-Subscription-Token": key, "Accept": "application/json"})
    return {"source": "brave", "query": query, "results": [{
        "title": r.get("title"), "url": r.get("url"), "description": r.get("description"), "age": r.get("age"),
    } for r in (j.get("web") or {}).get("results", [])]}


def x_recent(query, max_results=10):
    """X: recent public posts for a query, the hour it happened. Pay-per-use
    reads; X_BEARER_TOKEN. The value is used as given; if X answers 401 and
    the token holds %2F or %3D, decode it once."""
    token = _key("X_BEARER_TOKEN")
    q = urllib.parse.urlencode({"query": query, "max_results": max(10, min(max_results, 100)),
                                "tweet.fields": "created_at,public_metrics,author_id"})
    j = _get(f"https://api.x.com/2/tweets/search/recent?{q}", {"Authorization": f"Bearer {token}"})
    return {"source": "x", "query": query, "posts": [{
        "id": t.get("id"), "text": t.get("text"), "created_at": t.get("created_at"), "author_id": t.get("author_id"),
        "likes": (t.get("public_metrics") or {}).get("like_count"),
        "reposts": (t.get("public_metrics") or {}).get("retweet_count"),
        "url": f"https://x.com/i/web/status/{t.get('id')}",
    } for t in j.get("data", [])]}


def _self_test():
    """Hits every source live and checks the shape of what comes back."""
    checks = []

    def ok(label, cond):
        checks.append((label, bool(cond)))

    skipped = []
    try:
        n = gdelt("artificial intelligence", days=3)
        ok("gdelt returns headlines", n["headlines"])
        ok("gdelt counts days", n["per_day"])
    except RateLimited as e:
        skipped.append(f"gdelt skipped: {e}")
    except Exception as e:  # noqa: BLE001
        ok(f"gdelt ({e})", False)
    try:
        h = hn("Anthropic", hits=3)
        ok("hn returns stories", h["stories"])
    except Exception as e:  # noqa: BLE001
        ok(f"hn ({e})", False)
    try:
        p = polymarket(search="election", limit=3)
        ok("polymarket returns markets", p)
        ok("polymarket parses a probability",
           any(m["probability"] is not None for m in p) or p == [])
    except Exception as e:  # noqa: BLE001
        ok(f"polymarket ({e})", False)
    try:
        s = sec("AAPL")
        ok("sec resolves a ticker to filings", s.get("filings"))
    except Exception as e:  # noqa: BLE001
        ok(f"sec ({e})", False)
    # The keyed readers: proven when their key is here, skipped when it is not.
    for label, fn in (("exa", lambda: exa("Anthropic subscriptions", 2)),
                      ("brave", lambda: brave("Anthropic subscriptions", 2)),
                      ("x", lambda: x_recent("Anthropic", 10))):
        try:
            out = fn()
            ok(f"{label} returns a result list", isinstance(out.get("results", out.get("posts")), list))
        except NoKey as e:
            skipped.append(f"{label} skipped: {e}")
        except Exception as e:  # noqa: BLE001
            ok(f"{label} ({e})", False)

    bad = [label for label, good in checks if not good]
    for label, good in checks:
        print(f"  {'ok ' if good else 'BAD'} {label}")
    for s in skipped:
        print(f"  -- {s}")
    if bad:
        print(f"FAIL: {len(bad)} of {len(checks)}")
        return 1
    print(f"PASS: {len(checks)} of {len(checks)}"
          + (f" ({len(skipped)} skipped)" if skipped else ""))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd")
    ap.add_argument("--self-test", action="store_true")

    p_odds = sub.add_parser("odds")
    p_odds.add_argument("--search")
    p_odds.add_argument("--slug")
    p_odds.add_argument("--limit", type=int, default=6)

    p_news = sub.add_parser("news")
    p_news.add_argument("--subject", required=True)
    p_news.add_argument("--days", type=int, default=7)

    p_hn = sub.add_parser("hn")
    p_hn.add_argument("--query", required=True)
    p_hn.add_argument("--hits", type=int, default=5)

    p_sec = sub.add_parser("sec")
    p_sec.add_argument("--ticker", required=True)

    p_kalshi = sub.add_parser("kalshi")
    p_kalshi.add_argument("--ticker", required=True)

    for name in ("exa", "brave", "x"):
        p = sub.add_parser(name)
        p.add_argument("--query", required=True)
        p.add_argument("--limit", type=int, default=6)

    args = ap.parse_args(argv)
    if args.self_test:
        return _self_test()
    try:
        if args.cmd == "odds":
            out = polymarket(search=args.search, slug=args.slug, limit=args.limit)
        elif args.cmd == "news":
            out = gdelt(args.subject, days=args.days)
        elif args.cmd == "hn":
            out = hn(args.query, hits=args.hits)
        elif args.cmd == "sec":
            out = sec(args.ticker)
        elif args.cmd == "kalshi":
            out = kalshi(args.ticker)
        elif args.cmd == "exa":
            out = exa(args.query, args.limit)
        elif args.cmd == "brave":
            out = brave(args.query, args.limit)
        elif args.cmd == "x":
            out = x_recent(args.query, args.limit)
        else:
            ap.print_help()
            return 2
    except NoKey as e:
        print(f"skipped: {e}", file=sys.stderr)
        return 3
    except RateLimited as e:
        print(f"rate-limited: {e}", file=sys.stderr)
        return 4
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
