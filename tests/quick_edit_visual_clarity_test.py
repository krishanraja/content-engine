import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/quick-edit'))
import visual_clarity as vc


class ClarityGateTests(unittest.TestCase):
    def fixture(self):
        return {'frames': 90, 'states': [{'id': 'passport', 'start_frame': 0, 'end_frame': 90,
            'takeaway': 'The example AI was made in Canada and runs in the USA.',
            'visual_cues': ['Canadian flag beside Canada', 'US flag beside USA'],
            'text': [{'value': 'EXAMPLE BORN CANADA LIVES USA', 'role': 'relationship',
                      'adds': 'Concrete example countries and field identity.'}]}]}

    def test_compact_example_passes_text_only_without_claiming_comprehension(self):
        r = vc.audit(self.fixture(), 'Every AI has two passports, where it was born and where it lives.')
        self.assertEqual(r['status'], 'pass')
        self.assertEqual(r['three_second_comprehension'], 'not_proved_by_this_audit')

    def test_duplicate_split_across_labels_is_rejected(self):
        m = self.fixture()
        m['states'][0]['text'] = [{'value': t, 'role': 'relationship', 'adds': 'Claim'} for t in ['where it', 'was born']]
        self.assertEqual(vc.audit(m, 'Where it was born shapes its answers.')['status'], 'fail')

    def test_verbose_nonduplicate_and_no_visual_are_rejected(self):
        m = self.fixture()
        m['states'][0]['text'][0]['value'] = 'one two three four five six seven eight nine'
        m['states'][0]['visual_cues'] = []
        problems = vc.audit(m, '')['problems']
        self.assertTrue(any('word budget' in p for p in problems))
        self.assertTrue(any('visual cue' in p for p in problems))

    def test_delivery_cannot_be_passed_by_setting_a_green_status(self):
        self.assertTrue(vc.delivery_problems({'checks': {'visual_clarity': {'status': 'pass'}}}, '.'))

    def test_bound_review_and_stale_video(self):
        # Synthetic test evidence, never used as a production review.
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            (base/'narration.txt').write_text('Every AI has two passports.')
            m = self.fixture(); m['video_sha256'] = 'a'*64
            m['narration_sha256'] = vc.digest(base/'narration.txt')
            (base/'manifest.json').write_text(json.dumps(m))
            review = {'video_sha256': 'a'*64, 'inventory_complete': True, 'semantic_nonduplication': 'pass',
                'reviewer': 'SYNTHETIC TEST FIXTURE', 'reviewer_kind': 'human', 'author_review': False,
                'responses': [{'id': 'passport', 'exposure_seconds': 3, 'sound': False, 'captions': False,
                    'answer': 'Made in Canada, runs in USA', 'correct_subject': True,
                    'correct_point': True, 'misleading_inference': False}]}
            (base/'review.json').write_text(json.dumps(review))
            check = {'status': 'pass'}
            for key, filename in [('manifest','manifest.json'),('review','review.json'),('narration','narration.txt')]:
                check[key] = {'path': filename, 'sha256': vc.digest(base/filename)}
            report = {'video_sha256': 'a'*64, 'final_narration_sha256':check['narration']['sha256'], 'checks': {'visual_clarity': check}}
            self.assertEqual(vc.delivery_problems(report, base), [])
            review['reviewer_kind'] = 'independent_model'
            (base/'review.json').write_text(json.dumps(review))
            check['review']['sha256'] = vc.digest(base/'review.json')
            self.assertTrue(vc.delivery_problems(report, base))
            review.update(blinded=True, evidence_level='prediction_not_human_test')
            review['responses'][0].pop('exposure_seconds')
            review['responses'][0].update(predicted_under_three_seconds=True, rationale='SYNTHETIC TEST: flags identify countries and the two labels define the relation.')
            (base/'review.json').write_text(json.dumps(review))
            check['review']['sha256'] = vc.digest(base/'review.json')
            self.assertEqual(vc.delivery_problems(report, base), [])
            report['video_sha256'] = 'b'*64
            self.assertTrue(vc.delivery_problems(report, base))
            report['video_sha256'] = 'a'*64
            (base/'narration.txt').write_text('changed speech')
            self.assertTrue(vc.delivery_problems(report, base))


    def test_his_ruling_sets_one_videos_word_limits_and_nothing_else(self):
        # Synthetic test evidence, never used as a production review.
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            (base/'narration.txt').write_text('Every AI has two passports.')
            m = self.fixture(); m['video_sha256'] = 'a'*64
            m['states'][0]['text'][0]['value'] = 'alpha bravo charlie delta echo foxtrot golf hotel india'
            m['narration_sha256'] = vc.digest(base/'narration.txt')
            (base/'manifest.json').write_text(json.dumps(m))
            review = {'video_sha256': 'a'*64, 'inventory_complete': True, 'semantic_nonduplication': 'pass',
                'reviewer': 'SYNTHETIC TEST FIXTURE', 'reviewer_kind': 'human', 'author_review': False,
                'responses': [{'id': 'passport', 'exposure_seconds': 3, 'sound': False, 'captions': False,
                    'answer': 'Nine words', 'correct_subject': True, 'correct_point': True, 'misleading_inference': False}]}
            (base/'review.json').write_text(json.dumps(review))
            check = {'status': 'pass'}
            for key, filename in [('manifest', 'manifest.json'), ('review', 'review.json'), ('narration', 'narration.txt')]:
                check[key] = {'path': filename, 'sha256': vc.digest(base/filename)}
            report = {'video_sha256': 'a'*64, 'final_narration_sha256': check['narration']['sha256'], 'checks': {'visual_clarity': check}}
            self.assertTrue(any('word budget' in p for p in vc.delivery_problems(report, base)))
            check['ruling'] = {'by': 'Krish', 'said': 'Happy with the words on screen.', 'date': '2026-10-28', 'max_primary_words': 9, 'max_total_words': 16}
            self.assertEqual(vc.delivery_problems(report, base), [])
            check['ruling']['by'] = 'Claude'
            self.assertEqual(vc.delivery_problems(report, base), ['visual clarity ruling is not in his words'])
            check['ruling'].update(by='Krish', max_primary_words=8)
            self.assertTrue(any('word budget' in p for p in vc.delivery_problems(report, base)))
            (base/'narration.txt').write_text('alpha bravo charlie delta')
            check['narration']['sha256'] = report['final_narration_sha256'] = vc.digest(base/'narration.txt')
            m['narration_sha256'] = check['narration']['sha256']
            (base/'manifest.json').write_text(json.dumps(m)); check['manifest']['sha256'] = vc.digest(base/'manifest.json')
            check['ruling'].update(max_primary_words=9)
            self.assertTrue(any('repeats narration' in p for p in vc.delivery_problems(report, base)))
            check['ruling']['accepted_repeats'] = ['passport']
            self.assertEqual(vc.delivery_problems(report, base), [])
            review['responses'][0].update(correct_point=False)
            (base/'review.json').write_text(json.dumps(review)); check['review']['sha256'] = vc.digest(base/'review.json')
            self.assertEqual(vc.delivery_problems(report, base), ['three-second comprehension failed or lacks actual response evidence'])
            check['ruling']['accepted_states'] = ['elsewhere']
            self.assertTrue(vc.delivery_problems(report, base))
            check['ruling']['accepted_states'] = ['passport']
            self.assertEqual(vc.delivery_problems(report, base), [])


if __name__ == '__main__':
    unittest.main()
