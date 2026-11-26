"""scripts/post-pack/touch.py and config/cycle.json, the production cycle's one touchpoint layer (Krish, 2026-11-26:
every system involved at the right moment, reading from it or informing it). The registry's shape, every stage
touched, a run that makes its calls through fakes (nothing is spent and nothing leaves this machine), the outbox when
there is no Control Center key, a check that refuses a missing required touch, skipped always with a reason, exit 2
never done, the caps before a paid touch, and a drain that sends and clears."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import board_feed  # noqa: E402
import idea_checks as ic  # noqa: E402
import making  # noqa: E402
import touch  # noqa: E402

WEEK = '2026-12-07'  # a week after the story score's from (2026-11-30): the gates read the touches from here
EARLY = '2026-11-23'
PIECE = '8287846b-6618-4a19-9fb8-23ad4eca2718'
SYSTEMS = {'file-archives', 'divergence-engine', 'strategist', 'higgsfield', 'growth-makeyourmindup', 'makeyourmindup',
           'krish-clone', 'taste-engine', 'internal-auditor', 'control-center', 'humour-engine'}
TOOLS = {'report_to_taste_engine', 'record_harness_observation', 'find_research', 'get_engine_instruction',
         'ack_engine_instruction', 'get_engine_brief', 'reserve_credit_spend', 'settle_credit_spend', 'divergent_record'}


class Fakes:
    def __init__(self, code=0, post_ok=True, reachable=True):
        self.cmds, self.ghs, self.gets, self.posts = [], [], [], []
        self.code, self.post_ok, self.reachable = code, post_ok, reachable

    def cmd(self, argv):
        self.cmds.append(list(argv))
        return self.code, 'ran: fine\n'

    def gh(self, path):
        self.ghs.append(path)
        if path.endswith('kill-list.v1.json'):
            import base64
            data = (ROOT / 'vendor' / 'makeyourmindup' / 'kill-list' / 'kill-list.v1.json').read_bytes()
            return 0, json.dumps({'path': 'quality/panel/kill-list.v1.json', 'content': base64.b64encode(data).decode()})
        return 0, json.dumps([{'type': 'file', 'name': '2026-11-20-memo.md', 'path': 'docs/x/2026-11-20-memo.md', 'sha': 'a' * 40},
                              {'type': 'file', 'name': '2026-11-27-memo.md', 'path': 'docs/x/2026-11-27-memo.md', 'sha': 'b' * 40}])

    def get(self, url):
        self.gets.append(url)
        return 200, json.dumps({'approvals': [{'id': 'krish-voice-1'}]}).encode()

    def post(self, url, body, key):
        self.posts.append((url, body, key))
        if not self.reachable:
            return None, {'error': {'message': 'URLError'}}
        if self.post_ok:
            return 200, {'jsonrpc': '2.0', 'id': body['id'], 'result': {'content': [{'type': 'text', 'text': 'ok, stored'}]}}
        return 200, {'jsonrpc': '2.0', 'id': body['id'], 'result': {'isError': True, 'content': [{'type': 'text', 'text': 'not on this connection'}]}}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.plans = Path(self.tmp.name) / 'plans'
        self.cfg = copy.deepcopy(touch.cycle())
        self.cfg['files']['outbox'] = str(Path(self.tmp.name) / 'outbox.jsonl')
        self.out = []

    def tearDown(self):
        self.tmp.cleanup()

    def runner(self, fakes, env=None, **kw):
        return touch.Runner(self.cfg, plans=self.plans, cmd=fakes.cmd, gh=fakes.gh, get=fakes.get, post=fakes.post,
                            env={} if env is None else env, out=self.out.append, **kw)

    def log(self, week=WEEK):
        return touch.read_jsonl(self.plans / f'{week}-week' / 'touches.jsonl')

    def outbox(self):
        return touch.read_jsonl(self.cfg['files']['outbox'])

    def folder(self, week=WEEK):
        f = self.plans / f'{week}-week'
        f.mkdir(parents=True, exist_ok=True)
        return f


class RegistryTest(unittest.TestCase):
    def test_every_row_has_its_fields_and_cites_what_exists(self):
        cfg = touch.cycle()
        ids = [r['id'] for r in cfg['rows']]
        self.assertEqual(len(ids), len(set(ids)), 'one id a row')
        stages = {s['id'] for s in cfg['stages']}
        self.assertEqual(stages, set(range(11)))
        for r in cfg['rows']:
            for k in ('id', 'stage', 'system', 'direction', 'what', 'how', 'required', 'when', 'evidence', 'cites'):
                self.assertIn(k, r, f'{r.get("id")} lacks {k}')
            self.assertIn(r['stage'], stages)
            self.assertIn(r['direction'], touch.DIRECTIONS)
            self.assertIn(r['system'], SYSTEMS | {'content-engine'})
            self.assertIn(r['how']['kind'], touch.KINDS)
            self.assertIsInstance(r['required'], bool)
            self.assertTrue(r['cites'].strip())
            kind, call = r['how']['kind'], r['how']['call']
            if kind == 'script':
                self.assertIn(call[0], ('python3', 'node'))
                self.assertTrue((ROOT / call[1]).is_file(), f'{r["id"]}: {call[1]} is not in the repository')
            if kind == 'mcp':
                self.assertIn(call['tool'], TOOLS)
            if kind == 'builtin':
                self.assertIn(call['name'], touch.BUILTINS)
            if kind == 'manual':
                self.assertTrue(call['reason'].strip())
            if r.get('paid'):
                self.assertGreater(r['paid']['usd'], 0)
        self.assertEqual(set(cfg['kinds']), set(touch.KINDS))

    def test_every_stage_has_rows_and_every_system_is_touched(self):
        cfg = touch.cycle()
        for s in range(11):
            self.assertTrue(touch.rows_of(s, cfg), f'stage {s} has no row')
        self.assertTrue(SYSTEMS <= {r['system'] for r in cfg['rows']}, SYSTEMS - {r['system'] for r in cfg['rows']})
        for system in SYSTEMS - {'higgsfield', 'krish-clone'}:
            self.assertTrue(any(r['system'] == system and r['required'] for r in cfg['rows']), f'{system}: no required touch')

    def test_reader_facing_wording_rules(self):
        text = touch.CONFIG.read_text(encoding='utf-8')
        self.assertNotIn('—', text)
        self.assertNotIn('!', text)

    def test_the_kill_list_source_names_its_upstream_hash(self):
        row = next(r for r in touch.cycle()['rows'] if r['id'] == 's1-killlist-drift')
        status, reason, _ = touch.killlist_drift(row['how']['call'], gh=Fakes().gh)
        self.assertEqual((status, reason.split(':')[0]), ('done', 'no drift'))

    def test_the_board_steps_name_real_stages(self):
        cfg = touch.cycle()
        for k, v in cfg['steps'].items():
            if not k.startswith('_'):
                self.assertIn(v, range(11))


class RunTest(Base):
    def test_a_stage_makes_its_calls_through_the_existing_clients(self):
        f = self.folder()
        (f / 'sources.json').write_text('{}', encoding='utf-8')
        (f / 'ideas.json').write_text('{}', encoding='utf-8')
        fakes = Fakes()
        lines = self.runner(fakes).run(1, WEEK, sets={'topic': 'record labels and AI royalties'})
        scripts = [' '.join(c[:3]) for c in fakes.cmds]
        self.assertIn('python3 scripts/post-pack/story_floor.py ' + WEEK, ' | '.join(' '.join(c[:4]) for c in fakes.cmds))
        self.assertTrue(any('divergent.py record' in s for s in scripts), scripts)
        self.assertEqual(fakes.ghs, ['repos/krishanraja/makeyourmindup/contents/quality/panel/kill-list.v1.json'])
        self.assertEqual({x['id']: x['status'] for x in lines},
                         {'s1-research-find': 'queued', 's1-taste-floor': 'done', 's1-killlist-drift': 'done', 's1-divergent-record': 'done'})
        self.assertEqual(len(self.log()), 4)
        for x in self.log():
            self.assertEqual(set(x) >= {'id', 'stage', 'system', 'direction', 'status', 'reason', 'ref', 'at'}, True)

    def test_the_repository_reads_take_the_newest_file(self):
        fakes = Fakes()
        lines = self.runner(fakes).run(0, WEEK)
        memo = next(x for x in lines if x['id'] == 's0-strategist-memo')
        self.assertEqual(memo['status'], 'done')
        self.assertTrue(memo['ref'].startswith('docs/x/2026-11-27-memo.md@bbbb'))
        self.assertIn('repos/krishanraja/strategist/contents/docs/memos', fakes.ghs)
        self.assertIn('repos/krishanraja/growth-makeyourmindup/contents/docs/reviews', fakes.ghs)

    def test_no_key_queues_the_connector_touches_in_the_outbox(self):
        fakes = Fakes()
        lines = self.runner(fakes, env={}).run(0, WEEK)
        self.assertEqual(fakes.posts, [], 'nothing sent without the key')
        queued = [x for x in lines if x['status'] == 'queued']
        self.assertEqual({x['id'] for x in queued}, {'s0-cc-instruction', 's0-cc-brief'})
        box = self.outbox()
        self.assertEqual({e['tool'] for e in box}, {'get_engine_instruction', 'get_engine_brief'})
        self.assertEqual(box[0]['arguments'], {'repository': 'krishanraja/content-engine'})
        self.assertTrue(all('CC_HARNESS_KEY' in x['reason'] for x in queued))
        self.assertTrue(all(x['queued']['tool'] for x in self.log() if x['status'] == 'queued'))

    def test_with_the_key_one_tools_call_goes_to_control_center(self):
        fakes = Fakes()
        lines = self.runner(fakes, env={'CC_HARNESS_KEY': 'k-test'}).run(0, WEEK, only={'s0-cc-instruction'})
        self.assertEqual(lines[0]['status'], 'done')
        url, body, key = fakes.posts[0]
        self.assertEqual(url, 'https://controlcenter.krishraja.com/api/harness/mcp')
        self.assertEqual(key, 'k-test')
        self.assertEqual((body['jsonrpc'], body['method'], body['params']['name']), ('2.0', 'tools/call', 'get_engine_instruction'))
        self.assertEqual(self.outbox(), [])
        self.assertNotIn('k-test', json.dumps(self.log()), 'the key is never logged')

    def test_a_tool_control_center_refuses_is_failed_never_queued(self):
        fakes = Fakes(post_ok=False)
        lines = self.runner(fakes, env={'CC_HARNESS_KEY': 'k'}).run(0, WEEK, only={'s0-cc-brief'})
        self.assertEqual(lines[0]['status'], 'failed')
        self.assertIn('not on this connection', lines[0]['reason'])
        self.assertEqual(self.outbox(), [], 'a refusal is an answer: nothing for drain to send again')
        line = self.runner(fakes, env={'CC_HARNESS_KEY': 'k'}).run(
            7, WEEK, only={'s7-credits-reserve'}, sets={'generation': 'g1', 'pool': 'higgsfield', 'amount': '12', 'asset': 'a still'})[0]
        self.assertEqual(line['status'], 'failed', 'an over_share reservation is never booked later by a drain')
        self.assertEqual(self.outbox(), [])
        rpc = lambda url, body, key: (200, {'jsonrpc': '2.0', 'id': body['id'], 'error': {'code': -32602, 'message': 'invalid_summary_length'}})  # noqa: E731
        outcome, why, _ = touch.mcp_call('record_harness_observation', {}, key='k', url='u', post=rpc)
        self.assertEqual((outcome, 'invalid_summary_length' in why), (touch.REFUSED, True))

    def test_an_unreachable_control_center_queues_for_drain(self):
        lines = self.runner(Fakes(reachable=False), env={'CC_HARNESS_KEY': 'k'}).run(0, WEEK, only={'s0-cc-brief'})
        self.assertEqual(lines[0]['status'], 'queued')
        self.assertEqual(len(self.outbox()), 1)

    def test_numbers_stay_numbers_in_tool_arguments(self):
        fakes = Fakes()
        self.runner(fakes, env={'CC_HARNESS_KEY': 'k'}).run(7, WEEK, only={'s7-credits-reserve'},
                                                            sets={'generation': 'g1', 'pool': 'higgsfield', 'amount': '12', 'asset': '3 stills'})
        args = fakes.posts[0][1]['params']['arguments']
        self.assertEqual(args, {'engine': 'growth-makeyourmindup', 'pool': 'higgsfield', 'amount': 12, 'asset': '3 stills'})

    def test_skipped_always_carries_a_reason(self):
        fakes = Fakes()
        for stage in range(11):
            self.runner(fakes).run(stage, WEEK)
        skipped = [x for x in self.log() if x['status'] == 'skipped']
        self.assertTrue(skipped)
        self.assertTrue(all(str(x['reason']).strip() for x in skipped))
        self.assertTrue(all(x['status'] in touch.STATUSES for x in self.log()))

    def test_exit_2_is_skipped_not_served_never_done(self):
        f = self.folder()
        (f / 'sources.json').write_text('{}', encoding='utf-8')
        fakes = Fakes(code=2)
        line = self.runner(fakes).run(1, WEEK, only={'s1-divergent-record'})[0]
        self.assertEqual(line['status'], 'skipped')
        self.assertTrue(line['reason'].startswith('not served'))

    def test_a_paid_touch_checks_the_caps_first(self):
        import divergent
        fakes = Fakes()
        over = lambda: {'chain_over': True, 'chain_cap_usd': 15, 'chain_usd': 15.2}  # noqa: E731
        line = self.runner(fakes, cap=over).run(6, WEEK, piece=PIECE, only={'s6-humour-long'}, sets={'long': 'long.md'})[0]
        self.assertEqual(line['status'], 'skipped')
        self.assertIn('refused by the cap', line['reason'])
        self.assertEqual(fakes.cmds, [], 'no call over the chain')

        class Full:
            def reserve(self, op, usd, divergent=False, note=None):
                return None, f'{op} would pass the budget: no call made'
        under = lambda: {'chain_over': False, 'chain_cap_usd': 15, 'chain_usd': 2}  # noqa: E731
        line = self.runner(fakes, cap=under, ledger=Full()).run(6, WEEK, piece=PIECE, only={'s6-humour-long'}, sets={'long': 'long.md'})[0]
        self.assertEqual(line['status'], 'skipped')
        self.assertIn('budget', line['reason'])
        self.assertEqual(fakes.cmds, [])
        self.assertTrue(divergent.chain_verdict(under())[0])

        class Open:
            def __init__(self):
                self.settled = []

            def reserve(self, op, usd, divergent=False, note=None):
                return {'id': 'r1', 'usd': usd}, 'reserved'

            def settle(self, entry, usd):
                self.settled.append((entry['id'], usd))
        ledger = Open()
        line = self.runner(Fakes(code=2), cap=under, ledger=ledger).run(6, WEEK, piece=PIECE, only={'s6-humour-long'}, sets={'long': 'long.md'})[0]
        self.assertEqual(line['status'], 'skipped')
        self.assertEqual(ledger.settled, [('r1', 0)], 'a call not served gives its reservation back')

    def test_a_dry_run_writes_nothing_and_calls_nothing(self):
        fakes = Fakes()
        for stage in range(11):
            touch.Runner(self.cfg, plans=self.plans, cmd=fakes.cmd, gh=fakes.gh, get=fakes.get, post=fakes.post,
                         env={'CC_HARNESS_KEY': 'k'}, dry=True, out=self.out.append).run(stage, WEEK, piece=PIECE,
                                                                                          sets={'long': 'a', 'short': 'b'})
        self.assertEqual((fakes.cmds, fakes.ghs, fakes.gets, fakes.posts), ([], [], [], []))
        self.assertEqual(self.log(), [])
        self.assertEqual(self.outbox(), [])


class CheckTest(Base):
    def test_check_refuses_a_missing_required_touch_and_passes_once_run(self):
        found = touch.check(2, WEEK, plans=self.plans, cfg=self.cfg)
        self.assertEqual({f['ref'] for f in found}, {r['id'] for r in touch.rows_of(2, self.cfg) if r['required']})
        self.assertTrue(all(f['code'] == 'touch' for f in found))
        f = self.folder()
        (f / 'story').mkdir()
        for name in ('story/angles.json', 'story/wildcards.json', 'story/reads.json', 'scores.json'):
            (f / name).write_text('{}', encoding='utf-8')
        self.runner(Fakes()).run(2, WEEK)
        self.assertEqual(touch.check(2, WEEK, plans=self.plans, cfg=self.cfg), [])

    def test_a_required_evidence_file_that_is_missing_stays_a_finding(self):
        lines = self.runner(Fakes()).run(2, WEEK)
        score = next(x for x in lines if x['id'] == 's2-story-score')
        self.assertEqual((score['status'], score['skip_kind']), ('skipped', 'not_given'))
        refs = {f['ref'] for f in touch.findings(2, WEEK, plans=self.plans, cfg=self.cfg)}
        self.assertTrue({'s2-story-score', 's2-divergent-angles', 's2-divergent-wildcard', 's2-humour-reads'} <= refs, refs)
        self.assertNotIn('s2-killlist-lines', refs, 'a row another gate enforces (no evidence file) is not_applicable')

    def test_stage_6_with_no_scripts_given_fails_its_check(self):
        lines = self.runner(Fakes()).run(6, WEEK, piece=PIECE)
        self.assertEqual({x['skip_kind'] for x in lines if x['id'] in ('s6-voice', 's6-humour-long', 's6-killlist')}, {'not_given'})
        refs = {f['ref'] for f in touch.check(6, WEEK, piece=PIECE, plans=self.plans, cfg=self.cfg)}
        self.assertTrue({'s6-voice', 's6-humour-long', 's6-killlist'} <= refs, refs)

    def test_a_read_not_served_or_merely_queued_does_not_complete_a_required_row(self):
        class NoGh(Fakes):
            def gh(self, path):
                self.ghs.append(path)
                return 1, 'HTTP 404: Not Found'
        self.runner(NoGh(), env={}).run(0, WEEK)
        refs = {f['ref'] for f in touch.check(0, WEEK, plans=self.plans, cfg=self.cfg)}
        self.assertIn('s0-strategist-memo', refs, 'not served is not read')
        self.assertIn('s0-cc-instruction', refs, 'his instruction queued is not his instruction read')
        row = {'direction': 'inform'}
        self.assertTrue(touch.satisfied({'status': 'queued'}, row), 'an inform queued for drain completes its row')
        self.assertFalse(touch.satisfied({'status': 'skipped', 'reason': 'not given: long', 'skip_kind': 'not_given'}, row))
        self.assertTrue(touch.satisfied({'status': 'skipped', 'reason': 'a manual row', 'skip_kind': 'not_applicable'}, row))

    def test_a_failed_or_reasonless_skip_does_not_complete_a_stage(self):
        f = self.folder()
        row = next(r for r in self.cfg['rows'] if r['id'] == 's2-story-score')
        for r in touch.rows_of(2, self.cfg):
            touch.append_jsonl(f / 'touches.jsonl', {'id': r['id'], 'stage': 2, 'system': r['system'], 'direction': r['direction'],
                                                     'status': 'done', 'reason': 'x', 'ref': None, 'at': 'now'})
        self.assertEqual(touch.check(2, WEEK, plans=self.plans, cfg=self.cfg), [])
        touch.append_jsonl(f / 'touches.jsonl', {'id': row['id'], 'stage': 2, 'status': 'skipped', 'reason': ' ', 'at': 'now'})
        self.assertEqual([x['ref'] for x in touch.check(2, WEEK, plans=self.plans, cfg=self.cfg)], ['s2-story-score'])
        touch.append_jsonl(f / 'touches.jsonl', {'id': row['id'], 'stage': 2, 'status': 'failed', 'reason': 'exit 3', 'at': 'now'})
        self.assertIn('is failed: exit 3', touch.check(2, WEEK, plans=self.plans, cfg=self.cfg)[0]['line'])

    def test_a_piece_row_is_checked_for_that_piece(self):
        self.assertEqual(touch.check(6, WEEK, plans=self.plans, cfg=self.cfg), [], 'no piece: nothing piece-bound to check')
        refs = {f['ref'] for f in touch.check(6, WEEK, piece=PIECE, plans=self.plans, cfg=self.cfg)}
        self.assertTrue({'s6-voice', 's6-humour-long', 's6-killlist'} <= refs)
        self.runner(Fakes()).run(6, WEEK, piece='another-piece', sets={'long': 'a.md', 'short': 'b.md'})
        self.assertTrue({'s6-voice'} <= {f['ref'] for f in touch.check(6, WEEK, piece=PIECE, plans=self.plans, cfg=self.cfg)})
        self.runner(Fakes()).run(6, WEEK, piece=PIECE, sets={'long': 'a.md', 'short': 'b.md'})
        self.assertEqual(touch.check(6, WEEK, piece=PIECE, plans=self.plans, cfg=self.cfg), [])

    def test_findings_start_at_the_story_score_from_week(self):
        self.assertEqual(touch.findings(2, EARLY, plans=self.plans, cfg=self.cfg), [])
        self.assertTrue(touch.findings(2, WEEK, plans=self.plans, cfg=self.cfg))
        self.assertEqual(touch.story_from(), json.loads((ROOT / 'config' / 'story-score.json').read_text(encoding='utf-8'))['from'])

    def test_the_cli_check_exits_1_on_a_missing_touch(self):
        out = []
        self.assertEqual(touch.main(['check', '2', '--week', WEEK, '--plans', str(self.plans)], cfg=self.cfg, out=out.append), 1)
        self.assertIn('s2-story-score', out[0])


    def test_a_higgsfield_generation_reads_the_estimate_and_books_its_credits(self):
        self.runner(Fakes()).run(7, WEEK, piece=PIECE)
        refs = {f['ref'] for f in touch.check(7, WEEK, piece=PIECE, plans=self.plans, cfg=self.cfg)}
        self.assertFalse({'s7-higgsfield-estimate', 's7-credits-reserve', 's7-credits-settle'} & refs, 'no generation: not applicable')
        sets = {'generation': 'still-1', 'pool': 'higgsfield', 'amount': '4', 'asset': 'a still'}
        self.runner(Fakes(), env={}).run(7, WEEK, piece=PIECE, sets=sets)
        refs = {f['ref'] for f in touch.check(7, WEEK, piece=PIECE, plans=self.plans, cfg=self.cfg)}
        self.assertIn('s7-higgsfield-estimate', refs, 'no estimate read from the generator: a finding')
        self.assertIn('s7-credits-settle', refs, 'a booked generation must be settled')
        self.assertNotIn('s7-credits-reserve', refs, 'the reservation is queued for drain (an inform)')
        est = self.folder() / 'higgsfield' / 'still-1.estimate.json'
        est.parent.mkdir()
        est.write_text('{"estimate_credits": 4}', encoding='utf-8')
        self.runner(Fakes(), env={}).run(7, WEEK, piece=PIECE, sets=dict(sets, spend_id='sp-1', settled='4'))
        self.assertEqual(touch.check(7, WEEK, piece=PIECE, plans=self.plans, cfg=self.cfg), [])


class GatesTest(Base):
    def test_the_sunday_gate_fails_on_touch_and_the_frozen_engine_is_untouched(self):
        self.assertIn('touch', board_feed.GATE_CODES)
        self.assertNotIn('touch', ic.GATE_CODES, 'idea_checks.py is frozen for the blind proof')

    def test_the_lock_and_the_scripts_read_their_stage(self):
        f = self.folder()
        lock = f / 'narrative-lock-mon.md'
        lock.write_text('piece_id: ' + PIECE, encoding='utf-8')
        found = making.touch_findings(6, lock, PIECE)
        self.assertTrue({'s6-voice', 's6-killlist'} <= {x['ref'] for x in found})
        self.assertTrue(all(x['code'] == 'touch' for x in found))
        early = self.folder(EARLY) / 'narrative-lock-mon.md'
        early.write_text('x', encoding='utf-8')
        self.assertEqual(making.touch_findings(6, early, PIECE), [])
        self.assertEqual(making.touch_findings(5, Path(self.tmp.name) / 'loose.md', PIECE), [])


class DrainTest(Base):
    def test_drain_sends_and_clears(self):
        self.runner(Fakes(), env={}).run(0, WEEK)
        self.assertEqual(len(self.outbox()), 2)
        fakes = Fakes()
        code, left = self.runner(fakes, env={'CC_HARNESS_KEY': 'k'}).drain()
        self.assertEqual((code, left), (0, []))
        self.assertEqual(sorted(b['params']['name'] for _, b, _ in fakes.posts), ['get_engine_brief', 'get_engine_instruction'])
        self.assertEqual(self.outbox(), [])
        done = [x for x in self.log() if x['status'] == 'done' and x['reason'].startswith('drained')]
        self.assertEqual({x['id'] for x in done}, {'s0-cc-instruction', 's0-cc-brief'})
        self.assertEqual(touch.pending_in_log(WEEK, self.plans), [])

    def test_drain_without_a_key_sends_nothing_and_keeps_all(self):
        self.runner(Fakes(), env={}).run(0, WEEK)
        fakes = Fakes()
        code, left = self.runner(fakes, env={}).drain()
        self.assertEqual((code, len(left), fakes.posts), (2, 2, []))
        self.assertEqual(len(self.outbox()), 2)

    def test_drain_keeps_what_did_not_arrive_and_reads_the_week_log(self):
        self.runner(Fakes(), env={}).run(0, WEEK)
        Path(self.cfg['files']['outbox']).unlink()  # a headless run's outbox is gone; the week's log still holds them
        code, left = self.runner(Fakes(reachable=False), env={'CC_HARNESS_KEY': 'k'}).drain(WEEK)
        self.assertEqual((code, len(left)), (1, 2))
        self.assertEqual(len(self.outbox()), 2)
        code, left = self.runner(Fakes(), env={'CC_HARNESS_KEY': 'k'}).drain(WEEK)
        self.assertEqual((code, left), (0, []))
        self.assertEqual(self.outbox(), [])
        self.assertEqual(touch.pending_in_log(WEEK, self.plans), [])

    def test_drain_drops_a_refusal_and_never_sends_it_again(self):
        self.runner(Fakes(), env={}).run(7, WEEK, only={'s7-credits-reserve'}, sets={'generation': 'g1', 'pool': 'higgsfield', 'amount': '12', 'asset': 'a'})
        code, left = self.runner(Fakes(post_ok=False), env={'CC_HARNESS_KEY': 'k'}).drain(WEEK)
        self.assertEqual((code, left), (0, []))
        self.assertEqual(self.outbox(), [])
        self.assertEqual(self.log()[-1]['status'], 'failed')
        self.assertEqual(touch.pending_in_log(WEEK, self.plans), [], 'a refused reservation is not re-sent when the share frees')

    def test_two_queued_calls_of_one_row_both_survive_a_lost_outbox(self):
        for topic in ('music royalties', 'sports rights'):
            self.runner(Fakes(), env={}).run(1, WEEK, only={'s1-research-find'}, sets={'topic': topic})
        Path(self.cfg['files']['outbox']).unlink()
        pending = touch.pending_in_log(WEEK, self.plans)
        self.assertEqual(sorted(e['arguments']['query'] for e in pending), ['music royalties', 'sports rights'])
        fakes = Fakes()
        code, left = self.runner(fakes, env={'CC_HARNESS_KEY': 'k'}).drain(WEEK)
        self.assertEqual((code, left), (0, []))
        self.assertEqual(sorted(b['params']['arguments']['query'] for _, b, _ in fakes.posts), ['music royalties', 'sports rights'])
        self.assertEqual(touch.pending_in_log(WEEK, self.plans), [])

    def test_drain_sends_a_log_entry_beside_an_outbox_entry_of_the_same_row(self):
        self.runner(Fakes(), env={}).run(1, WEEK, only={'s1-research-find'}, sets={'topic': 'film dubbing'})
        Path(self.cfg['files']['outbox']).unlink()
        self.runner(Fakes(), env={}).run(1, WEEK, only={'s1-research-find'}, sets={'topic': 'stadium tickets'})
        fakes = Fakes()
        self.runner(fakes, env={'CC_HARNESS_KEY': 'k'}).drain(WEEK)
        self.assertEqual(sorted(b['params']['arguments']['query'] for _, b, _ in fakes.posts), ['film dubbing', 'stadium tickets'])

    def test_a_sent_entry_whose_row_is_gone_leaves_the_outbox(self):
        self.runner(Fakes(), env={}).run(0, WEEK, only={'s0-cc-brief'})
        self.cfg['rows'] = [r for r in self.cfg['rows'] if r['id'] != 's0-cc-brief']
        fakes = Fakes()
        code, left = self.runner(fakes, env={'CC_HARNESS_KEY': 'k'}).drain()
        self.assertEqual((code, left, len(fakes.posts)), (0, [], 1))
        self.assertEqual(self.outbox(), [], 'never re-sent on every drain')


if __name__ == '__main__':
    unittest.main()
