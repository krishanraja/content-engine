"""scripts/post-pack/meme_templates.py: the meme templates lane's gather (Krish, 2026-11-17: "why can we not create a
pipeline of existing meme videos that could be good to reskin, and show me those in here?"). Reddit's answers are a
recorded fixture (tests/fixtures/meme-templates); no test reads the network, and none runs Apify. Every post here is
invented."""
import argparse
import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import meme_templates as mt  # noqa: E402

FIXTURE = ROOT / 'tests' / 'fixtures' / 'meme-templates' / 'reddit-top-week.json'
WEEK = '2026-11-30'


def listing():
    return json.loads(FIXTURE.read_text(encoding='utf-8'))


class RedditTest(unittest.TestCase):
    def test_takes_video_posts_only_never_adult_or_pinned(self):
        got = mt.reddit_candidates(listing(), 'MemeTemplatesOfficial')
        self.assertEqual([c['title'] for c in got], ['Dog keeps answering the TV doorbell (template)', 'Green screen: man slowly closing laptop'])

    def test_a_hosted_video_gives_its_file_its_page_its_poster_and_its_length(self):
        c = mt.reddit_candidates(listing(), 'MemeTemplatesOfficial')[0]
        self.assertEqual(c['clip'], {'url': 'https://v.redd.it/abc123/DASH_720.mp4',
                                     'page': 'https://www.reddit.com/r/MemeTemplatesOfficial/comments/abc123/dog_keeps_answering/',
                                     'poster': 'https://preview.redd.it/abc123.jpg?width=640&format=pjpg', 'seconds': 12})
        self.assertEqual(c['found'], {'place': 'reddit', 'label': 'r/MemeTemplatesOfficial, top of the week', 'url': c['clip']['page']})
        self.assertIn('u/templatemaker', c['credit'])
        self.assertEqual(c['date'], '2025-11-28')
        self.assertEqual((c['why_it_works'], c['mechanism'], c['moment']), ('', [], None), 'the roaster step writes these')
        self.assertNotIn('caption_ideas', c)

    def test_an_embedded_video_links_to_its_own_page(self):
        c = mt.reddit_candidates(listing(), 'MemeTemplatesOfficial')[1]
        self.assertEqual(c['clip']['url'], 'https://www.youtube.com/watch?v=xyz')
        self.assertEqual(c['clip']['poster'], 'https://b.thumbs.redditmedia.com/def456.jpg')
        self.assertIsNone(c['clip']['seconds'])

    def test_a_broken_answer_gives_nothing(self):
        self.assertEqual(mt.reddit_candidates({'error': 429}, 'memes'), [])
        self.assertEqual(mt.reddit_candidates(None, 'memes'), [])


class SheetAndCardsTest(unittest.TestCase):
    def test_sheet_videos_with_a_meme_signal_and_recent(self):
        posts = [{'url': 'https://www.instagram.com/reel/AAA/', 'type': 'Video', 'headline': 'POV: your agent clicks everything', 'account': '@funnyai', 'published': '2026-11-25'},
                 {'url': 'https://www.instagram.com/p/BBB/', 'type': 'Sidecar', 'headline': 'Funny carousel', 'published': '2026-11-25'},
                 {'url': 'https://www.instagram.com/reel/CCC/', 'type': 'Video', 'headline': 'A serious keynote', 'published': '2026-11-25'},
                 {'url': 'https://www.instagram.com/reel/DDD/', 'type': 'Video', 'headline': 'Old meme', 'published': '2026-09-01'}]
        got = mt.sheet_candidates(posts, date(2026, 11, 29))
        self.assertEqual([c['clip']['page'] for c in got], ['https://www.instagram.com/reel/AAA/'])
        self.assertEqual(got[0]['found']['place'], 'sheet')
        self.assertEqual(got[0]['credit'], '@funnyai on Instagram')

    def test_his_video_cards_that_ask_for_a_meme(self):
        src = {'inspiration': {'liked': [{'id': 'c1', 'kind': 'video', 'platform': 'instagram', 'link': 'https://www.instagram.com/reel/EEE/',
                                          'saved_why': 'We should reskin this as a hilarious video meme', 'created_at': '2026-11-20T10:00:00Z'},
                                         {'id': 'c2', 'kind': 'video', 'platform': 'youtube', 'link': 'https://youtu.be/x', 'why_like': 'Great lighting'},
                                         {'id': 'c3', 'kind': 'image', 'link': 'https://www.instagram.com/p/FFF/', 'saved_why': 'funny meme'}]}}
        got = mt.card_candidates(src)
        self.assertEqual([c['card_id'] for c in got], ['c1'])
        self.assertEqual(got[0]['found']['place'], 'card')
        self.assertEqual(got[0]['date'], '2026-11-20')


class GatherTest(unittest.TestCase):
    def test_writes_every_source_says_why_one_failed_and_drops_what_was_offered(self):
        with tempfile.TemporaryDirectory() as tmp:
            plans = Path(tmp)
            (plans / f'{WEEK}-week').mkdir()
            (plans / f'{WEEK}-week' / 'sources.json').write_text(json.dumps({'inspiration': {}}))
            earlier = plans / '2026-11-23-week'
            earlier.mkdir()
            page = 'https://www.reddit.com/r/MemeTemplatesOfficial/comments/abc123/dog_keeps_answering/'
            earlier.joinpath('ideas.json').write_text(json.dumps({'offdays': {'tue': [{'id': 'dog', 'kind': 'meme', 'template': {'clip': {'page': page}}}]}}))

            def fetch(url, *a, **k):
                if 'r/memes' in url:
                    raise OSError('blocked')
                return listing()
            path, lines = mt.gather(WEEK, plans=plans, today=date(2026, 11, 29), fetch=fetch)
            doc = json.loads(path.read_text())
            by = {s['source']: s for s in doc['sources']}
            self.assertIn('lookalike.py prepare', by['sheet']['error'])
            self.assertEqual(by['cards']['count'], 0)
            self.assertEqual(by['reddit:r/MemeTemplatesOfficial']['count'], 2)
            self.assertIn('blocked', by['reddit:r/memes']['error'])
            self.assertEqual(doc['offered_before'], 1)
            self.assertEqual([c['title'] for c in doc['candidates']], ['Green screen: man slowly closing laptop'])
            self.assertEqual(path.name, 'meme-template-candidates.json')

    def test_no_network_reads_saved_files_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            calls = []
            path, _ = mt.gather(WEEK, plans=tmp, network=False, reddit_files={'memes': str(FIXTURE)}, fetch=lambda *a, **k: calls.append(a))
            doc = json.loads(Path(path).read_text())
            self.assertEqual(calls, [])
            self.assertEqual(len(doc['candidates']), 2)
            self.assertIn('--no-network', {s['source']: s for s in doc['sources']}['reddit:r/MemeTemplatesOfficial']['error'])

    def test_the_file_is_never_committed(self):
        self.assertIn('docs/plans/*-week/meme-template-candidates.json', (ROOT / '.gitignore').read_text())


class ApifyGuardTest(unittest.TestCase):
    """Apify costs money: off by default, and refused without a cap, his approval and a token. Nothing here runs it."""

    def args(self, **kw):
        return argparse.Namespace(**dict({'apify': False, 'max_items': None, 'i_approved_spend': False}, **kw))

    def test_off_by_default(self):
        self.assertIsNone(mt.apify_guard(self.args(), env={'APIFY_TOKEN': 'x'}))

    def test_refused_without_each_guard(self):
        for kw, env, says in (({'apify': True}, {'APIFY_TOKEN': 'x'}, '--max-items'),
                              ({'apify': True, 'max_items': 31, 'i_approved_spend': True}, {'APIFY_TOKEN': 'x'}, '--max-items'),
                              ({'apify': True, 'max_items': 10}, {'APIFY_TOKEN': 'x'}, '--i-approved-spend'),
                              ({'apify': True, 'max_items': 10, 'i_approved_spend': True}, {}, 'APIFY_TOKEN')):
            with self.assertRaises(mt.GatherError) as e:
                mt.apify_guard(self.args(**kw), env=env)
            self.assertIn(says, str(e.exception))
        self.assertEqual(mt.apify_guard(self.args(apify=True, max_items=30, i_approved_spend=True), env={'APIFY_TOKEN': 't'}), {'max_items': 30, 'token': 't'})

    def test_the_run_reads_at_most_its_cap(self):
        sent = {}

        def fetch(url, headers, body, timeout):
            sent.update(url=url, body=json.loads(body))
            return [{'webVideoUrl': f'https://www.tiktok.com/@a/video/{n}', 'text': 'meme', 'authorMeta': {'name': 'a'}} for n in range(50)]
        got = mt.apify_candidates(5, 'token', fetch)
        self.assertEqual(len(got), 5)
        self.assertEqual(sent['body']['resultsPerPage'], 3)  # 5 across two hashtags, rounded up
        self.assertIn('maxItems=5', sent['url'])
        self.assertIn(f'maxTotalChargeUsd={mt.APIFY_CHARGE_CAP_USD}', sent['url'])
        with self.assertRaises(mt.GatherError):
            mt.apify_candidates(31, 'token', fetch)

    def test_a_later_gather_keeps_the_paid_results(self):
        """The workflow's paid step runs first; the Claude step's own gather (no --apify) must not lose what it read."""
        def fetch(url, headers=None, body=None, timeout=None):
            if 'apify' not in url:
                raise mt.GatherError('offline')
            return [{'webVideoUrl': f'https://www.tiktok.com/@a/video/{n}', 'text': 'meme', 'authorMeta': {'name': 'a'}} for n in range(3)]
        with tempfile.TemporaryDirectory() as tmp:
            mt.gather(WEEK, plans=tmp, apify={'max_items': 3, 'token': 't'}, fetch=fetch)
            called = []
            path, lines = mt.gather(WEEK, plans=tmp, fetch=lambda url, *a, **k: called.append(url) or (_ for _ in ()).throw(mt.GatherError('offline')))
            doc = json.loads(Path(path).read_text())
            self.assertFalse([u for u in called if 'apify' in u])
            self.assertEqual(sum(1 for c in doc['candidates'] if c['found']['place'] == 'tiktok'), 3)
            self.assertTrue(any(s['source'].startswith('apify:tiktok (read earlier') and s['count'] == 3 for s in doc['sources']))
        self.assertIn('docs/plans/*-week/meme-template-apify.json', (ROOT / '.gitignore').read_text())


if __name__ == '__main__':
    unittest.main()
