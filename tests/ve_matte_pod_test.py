"""The GPU matte pod runner (velib/matte_pod.py) against a fake RunPod: it never starts without Krish's yes or over its
cap, refuses a model it has no pin for, and terminates the pod on success, on failure and at the time cap. No network,
no spend."""
from __future__ import annotations

import hashlib
import io
import json
import os
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import matte_pod  # noqa: E402


def bundle() -> bytes:
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w') as tar:
        for name, data in (('mattes/birefnet-hr.alpha.mp4', b'alpha frames'),
                           ('mattes/birefnet-hr.json', json.dumps({'model': 'birefnet-hr', 'state': 'done',
                                                                   'frames': 3}).encode()),
                           ('../escape.txt', b'never written')):
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return raw.getvalue()


TAR = bundle()


class FakeRunPod:
    def __init__(self, job='done', rate=0.27, damaged=False):
        self.calls, self.job, self.rate, self.damaged = [], job, rate, damaged
        self.status_reads, self.body = 0, None

    def __call__(self, method, url, **kw):
        self.calls.append((method, url))
        if method == 'POST' and url.endswith('/pods'):
            self.body = kw['body']
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
                return {'state': 'waiting', 'server': 'matte'}
            if self.job == 'done':
                digest = hashlib.sha256(TAR + (b'x' if self.damaged else b'')).hexdigest()
                return {'state': 'done', 'server': 'matte', 'size': len(TAR), 'sha256': digest}
            if self.job == 'failed':
                return {'state': 'failed', 'server': 'matte', 'code': 2, 'log': 'model birefnet-hr failed'}
            return {'state': 'running', 'server': 'matte'}
        if '/out.tar' in url:
            return TAR
        raise AssertionError(url)

    def deleted(self):
        return ('DELETE', f'{matte_pod.API}/pods/pod123') in self.calls


class Clock:
    def __init__(self, step=1.0):
        self.t, self.step = 0.0, step

    def __call__(self):
        self.t += self.step
        return self.t


class MattePodTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-matte-pod-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.take = self.dir / 'take.mp4'
        self.take.write_bytes(b'his take')

    def go(self, fake, **kw):
        return matte_pod.run(self.take, self.dir / 'out', call=fake, sleep=lambda s: None,
                             clock=kw.pop('clock', Clock()), **{'yes': True, 'api_key': 'test-runpod', **kw})

    def test_nothing_starts_without_his_yes_or_over_the_cap(self):
        fake = FakeRunPod()
        with self.assertRaisesRegex(matte_pod.Refused, "Krish's yes"):
            matte_pod.run(self.take, self.dir / 'out', call=fake, api_key='test-runpod')
        with self.assertRaisesRegex(matte_pod.Refused, 'over the'):
            self.go(fake, max_usd=0.05)
        self.assertEqual(fake.calls, [])

    def test_a_model_without_a_pin_is_refused_before_any_spend(self):
        fake = FakeRunPod()
        with self.assertRaisesRegex(matte_pod.Refused, 'unknown model'):
            self.go(fake, models='birefnet-hr,sam-latest')
        self.assertEqual(fake.calls, [])
        for spec in matte_pod.MODELS.values():                 # every model is pinned to a commit and a weights hash
            self.assertRegex(spec['revision'], r'^[0-9a-f]{40}$')
            self.assertRegex(spec['sha256'], r'^[0-9a-f]{64}$')
            self.assertTrue(spec['licence'])

    def test_the_key_comes_from_the_environment_only(self):
        with mock.patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(matte_pod.Refused, 'environment secret'):
            matte_pod.run(self.take, self.dir / 'out', yes=True, call=FakeRunPod(), api_key=None)

    def test_a_pod_dearer_than_listed_is_refused_and_terminated(self):
        fake = FakeRunPod(rate=5.0)
        with self.assertRaisesRegex(matte_pod.Refused, 'over the'):
            self.go(fake)
        self.assertTrue(fake.deleted())

    def test_success_unpacks_the_checked_mattes_and_terminates_the_pod(self):
        fake = FakeRunPod()
        receipt = self.go(fake, models='birefnet-hr')
        self.assertEqual(receipt['state'], 'done')
        self.assertTrue(fake.deleted())
        self.assertEqual((self.dir / 'out' / 'mattes' / 'birefnet-hr.alpha.mp4').read_bytes(), b'alpha frames')
        self.assertEqual(receipt['mattes']['birefnet-hr']['state'], 'done')
        self.assertFalse((self.dir / 'escape.txt').exists())   # a tar member outside mattes/ is never written
        self.assertEqual(json.loads(fake.body['env']['MATTE_MODELS']), {'birefnet-hr': matte_pod.MODELS['birefnet-hr']})
        saved = json.loads((self.dir / 'out' / 'matte-pod.take.json').read_text())
        self.assertTrue(saved['terminated'])
        self.assertNotIn('test-runpod', json.dumps(saved))      # the key never reaches the receipt
        self.assertNotIn('test-runpod', json.dumps(fake.body))  # nor the pod

    def test_a_failed_job_or_damaged_mattes_still_terminate_the_pod(self):
        for fake in (FakeRunPod(job='failed'), FakeRunPod(damaged=True)):
            with self.assertRaises(matte_pod.Refused):
                self.go(fake)
            self.assertTrue(fake.deleted())
        self.assertFalse((self.dir / 'out' / 'take.mattes.tar').exists())

    def test_the_time_cap_terminates_the_pod(self):
        fake = FakeRunPod(job='running')
        with self.assertRaisesRegex(matte_pod.Refused, 'time cap'):
            self.go(fake, clock=Clock(step=120.0))
        self.assertTrue(fake.deleted())
        saved = json.loads((self.dir / 'out' / 'matte-pod.take.json').read_text())
        self.assertEqual(saved['state'], 'refused')
        self.assertGreater(saved['cost_usd'], 0)

    def test_the_pod_server_serves_the_tar_under_its_own_name(self):
        self.assertIn('/out.tar', matte_pod.SERVER)
        self.assertIn('server="matte"', matte_pod.SERVER)
        self.assertNotIn('/out.mp4', matte_pod.SERVER)

    def test_cleanup_ends_only_matte_pods(self):
        calls = []

        def fake(method, url, **kw):
            calls.append((method, url))
            return {'pods': [{'id': 'a', 'name': 'matte-take'}, {'id': 'b', 'name': 'eyeline-take'}]} if method == 'GET' else {}
        self.assertEqual(matte_pod.cleanup(api_key='test-runpod', call=fake), ['a'])
        self.assertNotIn(('DELETE', f'{matte_pod.API}/pods/b'), calls)


if __name__ == '__main__':
    unittest.main()
