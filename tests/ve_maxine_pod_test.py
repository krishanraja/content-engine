"""The Maxine pod runner (velib/maxine_pod.py) against a fake RunPod: it never starts without Krish's yes or over its
cap, and it terminates the pod on success, on failure and at the time cap. No network, no spend."""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import maxine_pod  # noqa: E402

COPY = b'redirected frames'


class FakeRunPod:
    def __init__(self, job='done', rate=0.27, damaged=False):
        self.calls, self.job, self.rate, self.damaged = [], job, rate, damaged
        self.status_reads = 0

    def __call__(self, method, url, **kw):
        self.calls.append((method, url))
        if method == 'POST' and url.endswith('/pods'):
            body = kw['body']
            assert body['cloudType'] == 'SECURE' and body['gpuTypeIds'] == maxine_pod.GPUS and body['gpuTypeIds'][0] == 'NVIDIA RTX A4000'
            assert 'EYE_TOKEN' in body['env']
            return {'id': 'pod123', 'costPerHr': self.rate}
        if method == 'DELETE':
            return {}
        if method == 'POST' and url.endswith('/in.mp4'):
            assert 'X-Offset' in kw.get('headers', {})
            return hashlib.sha256(kw['data']).hexdigest().encode()
        if method == 'POST':
            return {}
        if url.endswith('/status'):
            self.status_reads += 1
            if self.status_reads == 1:
                return b'<html>the proxy, while the pod boots</html>'
            if self.status_reads == 2:
                return {'state': 'waiting', 'server': 'eyeline'}
            if self.job == 'done':
                return {'state': 'done', 'server': 'eyeline', 'size': len(COPY), 'sha256': hashlib.sha256(COPY + (b'x' if self.damaged else b'')).hexdigest()}
            if self.job == 'failed':
                return {'state': 'failed', 'server': 'eyeline', 'code': 3, 'log': 'no GazeRedirect sample binary'}
            return {'state': 'running', 'server': 'eyeline'}
        if '/out.mp4' in url:
            return COPY
        raise AssertionError(url)

    def deleted(self):
        return ('DELETE', f'{maxine_pod.API}/pods/pod123') in self.calls


class Clock:
    def __init__(self, step=1.0):
        self.t, self.step = 0.0, step

    def __call__(self):
        self.t += self.step
        return self.t


class PodTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-maxine-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.take = self.dir / 'take.mp4'
        self.take.write_bytes(b'his take')
        self.keys = {'api_key': 'test-runpod', 'ngc_key': 'test-ngc'}

    def go(self, fake, **kw):
        return maxine_pod.run(self.take, self.dir / 'out', call=fake, sleep=lambda s: None, clock=kw.pop('clock', Clock()),
                              **{'yes': True, **self.keys, **kw})

    def test_nothing_starts_without_his_yes_or_over_the_cap(self):
        fake = FakeRunPod()
        with self.assertRaisesRegex(maxine_pod.Refused, "Krish's yes"):
            maxine_pod.run(self.take, self.dir / 'out', call=fake, **self.keys)
        with self.assertRaisesRegex(maxine_pod.Refused, 'over the'):
            self.go(fake, max_usd=0.10)
        self.assertEqual(fake.calls, [])

    def test_a_pod_dearer_than_listed_is_refused_and_terminated(self):
        fake = FakeRunPod(rate=5.0)
        with self.assertRaisesRegex(maxine_pod.Refused, 'over the'):
            self.go(fake)
        self.assertTrue(fake.deleted())

    def test_success_downloads_the_checked_copy_and_terminates_the_pod(self):
        fake = FakeRunPod()
        receipt = self.go(fake)
        self.assertEqual(receipt['state'], 'done')
        self.assertEqual(Path(receipt['copy']).read_bytes(), COPY)
        self.assertTrue(fake.deleted())
        saved = json.loads((self.dir / 'out' / 'maxine-pod.take.json').read_text())
        self.assertTrue(saved['terminated'])
        self.assertNotIn('test-ngc', json.dumps(saved))      # keys never reach the receipt
        self.assertNotIn('test-runpod', json.dumps(saved))

    def test_a_failed_job_or_a_damaged_copy_still_terminates_the_pod(self):
        for fake in (FakeRunPod(job='failed'), FakeRunPod(damaged=True)):
            with self.assertRaises(maxine_pod.Refused):
                self.go(fake)
            self.assertTrue(fake.deleted())
        self.assertFalse((self.dir / 'out' / 'take.maxine.mp4').exists())

    def test_the_time_cap_terminates_the_pod(self):
        fake = FakeRunPod(job='running')
        with self.assertRaisesRegex(maxine_pod.Refused, 'time cap'):
            self.go(fake, clock=Clock(step=120.0))
        self.assertTrue(fake.deleted())

    def test_keys_come_from_the_environment_only(self):
        with self.assertRaisesRegex(maxine_pod.Refused, 'environment secrets'):
            maxine_pod.run(self.take, self.dir / 'out', yes=True, call=FakeRunPod(), api_key=None, ngc_key=None)

    def test_every_request_names_itself_past_cloudflare(self):
        # Run 42067342305 (5 Nov 2026): Cloudflare refused urllib's default agent with 403 error 1010.
        seen = {}

        class Answer:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return b'{}'

        def opener(request, timeout=None):
            seen.update(request.header_items())
            return Answer()

        real = maxine_pod.urllib.request.urlopen
        maxine_pod.urllib.request.urlopen = opener
        try:
            maxine_pod.http('GET', f'{maxine_pod.API}/pods', key='test-runpod')
        finally:
            maxine_pod.urllib.request.urlopen = real
        self.assertEqual(seen.get('User-agent'), maxine_pod.USER_AGENT)
        self.assertNotIn('urllib', maxine_pod.USER_AGENT.lower())

    def test_a_refused_request_keeps_the_providers_words_in_the_receipt(self):
        import io
        import urllib.error

        def refuse(method, url, **kw):
            raise urllib.error.HTTPError(url, 403, 'Forbidden', {}, io.BytesIO(b'error code: 1010'))

        with self.assertRaises(maxine_pod.Refused):
            self.go(refuse)
        saved = json.loads((self.dir / 'out' / 'maxine-pod.take.json').read_text())
        self.assertEqual(saved['state'], 'refused')
        self.assertIn('HTTP 403', saved['reason'])
        self.assertIn('error code: 1010', saved['reason'])
        self.assertNotIn('terminated', saved)                 # no pod was ever created
        self.assertEqual(saved['cost_usd'], 0.0)

    def test_the_pod_proxy_answering_404_while_booting_is_waited_out(self):
        # RunPod's proxy answers 404/502 until the pod's server is up: that must be retried, not end the run.
        import io
        import urllib.error
        fake = FakeRunPod()
        booting = {'left': 2}

        def proxy(method, url, **kw):
            if url.endswith('/status') and booting['left']:
                booting['left'] -= 1
                raise urllib.error.HTTPError(url, 404, 'Not Found', {}, io.BytesIO(b'pod not ready'))
            return fake(method, url, **kw)

        receipt = self.go(proxy)
        self.assertEqual(receipt['state'], 'done')
        self.assertTrue(fake.deleted())

    def test_no_free_card_on_secure_falls_back_to_community(self):
        import io
        import urllib.error
        fake, clouds = FakeRunPod(), []

        def busy(method, url, **kw):
            if method == 'POST' and url.endswith('/pods'):
                clouds.append(kw['body']['cloudType'])
                if kw['body']['cloudType'] == 'SECURE':
                    raise urllib.error.HTTPError(url, 500, 'x', {}, io.BytesIO(b'{"error":"create pod: There are no instances currently available"}'))
                kw['body'] = dict(kw['body'], cloudType='SECURE')      # the fake only knows SECURE
            return fake(method, url, **kw)

        receipt = self.go(busy)
        self.assertEqual(clouds, ['SECURE', 'COMMUNITY'])
        self.assertEqual((receipt['state'], receipt['cloud']), ('done', 'COMMUNITY'))

    def test_no_card_anywhere_is_asked_again_then_refused_without_a_pod(self):
        import io
        import urllib.error
        asks = []

        def none(method, url, **kw):
            asks.append(kw['body']['cloudType'])
            raise urllib.error.HTTPError(url, 500, 'x', {}, io.BytesIO(b'{"error":"There are no instances currently available"}'))

        with self.assertRaisesRegex(maxine_pod.Refused, 'no RTX card free'):
            self.go(none)
        self.assertEqual(len(asks), maxine_pod.GPU_TRIES * len(maxine_pod.CLOUDS))
        saved = json.loads((self.dir / 'out' / 'maxine-pod.take.json').read_text())
        self.assertEqual(saved['cost_usd'], 0.0)

    def test_the_nim_route_waits_for_ready_runs_the_client_and_terminates(self):
        import io
        import types
        import urllib.error
        calls, polls = [], {'n': 0}

        def api(method, url, **kw):
            calls.append((method, url))
            if url.endswith('/containerregistryauth') and method == 'GET':
                return []
            if url.endswith('/containerregistryauth'):
                assert kw['body']['username'] == '$oauthtoken'
                return {'id': 'auth1'}
            if method == 'POST' and url.endswith('/pods'):
                assert kw['body']['imageName'] == maxine_pod.NIM_IMAGE and kw['body']['containerRegistryAuthId'] == 'auth1'
                return {'id': 'pod9', 'costPerHr': 0.27}
            if method == 'GET' and url.endswith('/pods/pod9'):
                polls['n'] += 1
                return {'publicIp': '1.2.3.4', 'portMappings': {'8001': 40123}} if polls['n'] > 1 else {}
            if url.endswith('/v1/metadata'):
                if polls['n'] < 3:
                    raise urllib.error.HTTPError(url, 503, 'x', {}, io.BytesIO(b''))
                return {}
            if method == 'DELETE':
                return {}
            raise AssertionError(url)

        def client(cmd):
            assert cmd[cmd.index('--target') + 1] == '1.2.3.4:40123'
            Path(cmd[cmd.index('--output') + 1]).write_bytes(b'redirected')
            return types.SimpleNamespace(returncode=0, stdout='ok', stderr='')

        receipt = maxine_pod.run_nim(self.take, self.dir / 'out', '/nim-clients/eye-contact', yes=True, call=api,
                                     sleep=lambda s: None, clock=Clock(), run_client=client,
                                     tcp_open=lambda t: t == '1.2.3.4:40123', **self.keys)
        self.assertEqual(receipt['state'], 'done')
        self.assertIn(('DELETE', f'{maxine_pod.API}/pods/pod9'), calls)
        self.assertNotIn('test-ngc', json.dumps(receipt))


if __name__ == '__main__':
    unittest.main()
