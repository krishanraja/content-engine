"""Probability validation; real hair/hand quality remains an operator gate."""
import sys
import unittest
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import numpy as np
from velib.matte import validate_mask


class MatteTest(unittest.TestCase):
    def test_empty_subject_refused(self):
        with self.assertRaisesRegex(ValueError, 'no subject'):
            validate_mask(np.zeros((4, 4)), (4, 4))

    def test_malformed_masks_refused(self):
        for mask in (np.ones((2, 2)), np.full((4, 4), np.nan), np.full((4, 4), 2)):
            with self.assertRaises(ValueError):
                validate_mask(mask, (4, 4))

    def test_confidence_is_not_a_quality_approval(self):
        self.assertEqual(validate_mask(np.ones((4, 4)), (4, 4)), 0)
        self.assertAlmostEqual(validate_mask(np.full((4, 4), .75), (4, 4)), .5)


if __name__ == '__main__':
    unittest.main()
