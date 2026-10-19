"""The Claude routing exception must not weaken Codex skill validation."""
import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('validate_skills', Path(__file__).resolve().parents[1] / 'scripts/validate-skills.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class HostExtensionTests(unittest.TestCase):
    def test_only_supported_model_route_is_removed_and_original_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = Path(tmp) / 'example'
            skill.mkdir()
            original = '---\nname: example\ndescription: Example\nmodel: sonnet\nunknown: reject-me\n---\nBody\n'
            path = skill / 'SKILL.md'
            path.write_text(original)

            def strict_check(args, **kwargs):
                copied = (Path(args[-1]) / 'SKILL.md').read_text()
                self.assertNotIn('model:', copied)
                self.assertIn('unknown: reject-me', copied)
                return subprocess.CompletedProcess(args, 1)

            with patch.object(validator.subprocess, 'run', side_effect=strict_check):
                self.assertFalse(validator.validate_with_codex(skill))
            self.assertEqual(path.read_text(), original)

    def test_invalid_or_duplicate_model_route_fails_before_external_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            skill = Path(tmp) / 'example'
            skill.mkdir()
            for route in ('model: arbitrary', 'model: sonnet\nmodel: opus'):
                (skill / 'SKILL.md').write_text(f'---\nname: example\ndescription: Example\n{route}\n---\nBody\n')
                with patch.object(validator.subprocess, 'run') as run:
                    self.assertFalse(validator.validate_with_codex(skill))
                    run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
