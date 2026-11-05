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
            assert body['cloudType'] == 'SECURE' and body['gpuTypeIds'] == [maxine_pod.GPU]
            assert 'EYE_TOKEN' in body['env']
            return {'id': 'pod123', 'costPerHr': self.rate}
        if method == 'DELETE':
            return {}
        if method == 'PUT':
            return hashlib.sha256(kw['data']).hexdigest().encode()
        if method == 'POST':
            return {}
        if url.endswith('/status'):
            self.status_reads += 1
            if self.status_reads == 1:
                return {'state': 'waiting'}
            if self.job == 'done':
                return {'state': 'done', 'size': len(COPY), 'sha256': hashlib.sha256(COPY + (b'x' if self.damaged else b'')).hexdigest()}
            if self.job == 'failed':
                return {'state': 'failed', 'code': 3, 'log': 'no GazeRedirect sample binary'}
            return {'state': 'running'}
        if url.endswith('/out.mp4'):
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

    def test_a_refused_create_says_what_the_service_said_and_spends_nothing(self):
        def refused(method, url, **kw):
            raise maxine_pod.Refused(f'{method} {url} answered HTTP 403: key lacks pod write permission')
        with self.assertRaisesRegex(maxine_pod.Refused, 'HTTP 403: key lacks'):
            self.go(refused)
        saved = json.loads((self.dir / 'out' / 'maxine-pod.take.json').read_text())
        self.assertIn('HTTP 403', saved['reason'])
        self.assertNotIn('pod', saved)
        self.assertEqual(saved['cost_usd'], 0.0)

    def test_http_sends_an_agent_and_turns_an_http_error_into_its_reason(self):
        import io
        import urllib.error
        from unittest import mock
        seen = {}

        def fake_urlopen(request, timeout):
            seen.update(dict(request.header_items()))
            raise urllib.error.HTTPError(request.full_url, 403, 'Forbidden', {}, io.BytesIO(b'{"error":"forbidden: read-only key"}'))
        with mock.patch('urllib.request.urlopen', fake_urlopen):
            with self.assertRaisesRegex(maxine_pod.Refused, 'HTTP 403: .*read-only key'):
                maxine_pod.http('POST', f'{maxine_pod.API}/pods', key='test-runpod', body={})
        self.assertIn('content-engine-eyeline', seen.get('User-agent', ''))

    def test_keys_come_from_the_environment_only(self):
        with self.assertRaisesRegex(maxine_pod.Refused, 'environment secrets'):
            maxine_pod.run(self.take, self.dir / 'out', yes=True, call=FakeRunPod(), api_key=None, ngc_key=None)


if __name__ == '__main__':
    unittest.main()
