"""One switch for the tests that read real frames with tesseract (audit ve-9, 14 Nov 2026).

Without tesseract a real-OCR test is skipped, as on a laptop or the quick CI. With VE_REQUIRE_OCR=1 (the full verify's
Linux job, which installs a pinned tesseract) a missing tesseract fails the test instead, so the on-screen text checks
can never pass in CI by skipping their only real reading."""
import os
import shutil
import unittest


def required() -> bool:
    return os.environ.get('VE_REQUIRE_OCR') == '1'


def real_ocr(test):
    if shutil.which('tesseract'):
        return test
    if required():
        def missing(self, *args, **kwargs):
            self.fail('VE_REQUIRE_OCR=1 but tesseract is not on PATH: the real OCR test cannot be skipped here')
        missing.__name__, missing.__doc__ = test.__name__, test.__doc__
        return missing
    return unittest.skip('tesseract is not installed here')(test)
