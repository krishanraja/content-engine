#!/usr/bin/env python3
"""scripts/voice/script_audit.py: the engine's draft (a), his approved words (b) and what he said (c), three ways.

Krish, 2026-11-18: "I think a really important post-audit is comparing a script that you put into the dashboard versus
the script that went into Teleprompter after my edits versus the actual words I said in the video." Run:
python3 tests/script_audit_test.py
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'voice'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))

import making  # noqa: E402
import script_audit as sa  # noqa: E402

PIECE = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
OTHER = '00000000-0000-4000-8000-000000000001'


def take(words_a, words_b=None):
    def clock(words):
        return {'name': 'x', 'words': [{'i': i, 'text': w, 'onset_s': i * 0.4, 'end_s': i * 0.4 + 0.3} for i, w in enumerate(words.split())]}
    return {'aligners': {'a': clock(words_a), 'b': clock(words_b if words_b is not None else words_a)}}


def material(mid, title, at, piece=PIECE, role='script'):
    return {'id': mid, 'title': title, 'at': at, 'role': role, 'where': 'piece', 'scope': piece}


class Compare(unittest.TestCase):
    def test_his_edits_are_counted_and_his_swaps_listed(self):
        a = 'The mayor was sacked over a small data centre. Seven in ten people said no.'
        b = 'The mayor just got rid of a little data centre. 70 percent of them said no.'
        p = sa.pair_result(sa.text_tokens(a), sa.text_tokens(b))
        self.assertIn({'from': 'small', 'to': 'little'}, p['swaps'])
        self.assertTrue(any(s['from'] == 'was sacked over' or 'sacked' in s['from'] for s in p['swaps']), p['swaps'])
        self.assertEqual(p['words_from'], len(sa.text_tokens(a)))
        self.assertGreater(p['changes_per_100_words'], 0)

    def test_a_swap_of_only_function_words_is_not_vocabulary(self):
        p = sa.pair_result(sa.text_tokens('It is a song about money.'), sa.text_tokens('It is the song about money.'))
        self.assertEqual(p['swapped'], 1)
        self.assertEqual(p['swaps'], [])

    def test_a_long_rewrite_is_counted_but_is_not_a_word_swap(self):
        p = sa.pair_result(sa.text_tokens('Ask one question before you sign anything at all today.'),
                           sa.text_tokens('Ask one question so what does the contract actually let them do with it.'))
        self.assertGreater(p['swapped'], 0)
        self.assertEqual(p['swaps'], [])

    def test_on_the_take_a_swap_counts_only_when_both_aligners_heard_it(self):
        b = 'The price is dearer than you think.'
        texts = {'b': {'tokens': sa.text_tokens(b)},
                 'c': {'tokens': sa.take_tokens(take('the price is higher than you think'), 'a'),
                       'also': sa.take_tokens(take('the price is higher than you think'), 'b')}}
        both = sa.audit(texts)['b_c']
        self.assertEqual(both['swaps'], [{'from': 'dearer', 'to': 'higher'}])
        texts['c']['also'] = sa.take_tokens(take('x', 'the price is hire than you think'), 'b')
        self.assertEqual(sa.audit(texts)['b_c']['swaps'], [])

    def test_a_missing_text_leaves_its_pairs_out(self):
        pairs = sa.audit({'a': {'missing': 'no script filed'}, 'b': {'tokens': sa.text_tokens('one two')},
                          'c': {'tokens': sa.take_tokens(take('one two'), 'a'), 'also': sa.take_tokens(take('one two'), 'b')}})
        self.assertEqual(sorted(pairs), ['b_c'])
        self.assertEqual(pairs['b_c']['changes'], 0)


class FindingTheTexts(unittest.TestCase):
    def test_cut_by_title_as_the_board_reads_it(self):
        self.assertEqual(sa.script_cuts('5-minute cut script, Tue 17 (final, for your Approve)'), ['long'])
        self.assertEqual(sa.script_cuts('90-second cut script, Tue 17'), ['short'])
        self.assertEqual(sa.script_cuts('Wed 18 scripts (5-minute and 90-second)'), ['long', 'short'])
        self.assertEqual(sa.script_cuts('sources.json'), [])
        both = '5-MINUTE CUT\nThe long words.\n\n90-SECOND CUT\nThe short words.'
        self.assertEqual(sa.script_section(both, 'short'), 'The short words.')
        self.assertEqual(sa.script_section(both, 'long'), 'The long words.')
        self.assertIsNone(sa.script_section('no headings', 'short'))

    def test_b_is_his_approval_bound_to_the_take_else_his_newest(self):
        hist = [
            {'doc_id': 'tue-scripts-words-b019dbf8', 'revision': 1, 'updated_by': 'Krish', 'updated_at': '2026-11-17T14:57:04Z',
             'body': {'kind': 'approve_scripts', 'approved': True, 'piece_id': PIECE, 'at': '2026-11-17T14:57:04Z', 'texts': {'long': 'first words'}}},
            {'doc_id': 'tue-scripts-words-b019dbf8', 'revision': 2, 'updated_by': 'Krish', 'updated_at': '2026-11-17T14:57:05Z',
             'body': {'kind': 'approve_scripts', 'approved': True, 'piece_id': PIECE, 'at': '2026-11-17T14:57:04Z', 'texts': {'long': 'first words'},
                      'send': {'status': 'sent'}}},
            {'doc_id': 'tue-scripts-words-b019dbf8', 'revision': 5, 'updated_by': 'Krish', 'updated_at': '2026-11-17T16:20:17Z',
             'body': {'kind': 'approve_scripts', 'approved': True, 'piece_id': PIECE, 'at': '2026-11-17T16:20:17Z', 'texts': {'long': 'his edited words'}}},
            {'doc_id': 'mon-scripts-words-00000000', 'revision': 1, 'updated_by': 'Krish', 'updated_at': '2026-11-17T18:00:00Z',
             'body': {'kind': 'approve_scripts', 'approved': True, 'piece_id': OTHER, 'at': '2026-11-17T18:00:00Z', 'texts': {'long': 'another piece'}}},
        ]
        approvals = sa.approvals_of(hist, PIECE)
        self.assertEqual([a['revision'] for a in approvals], [1, 5])  # the server's send revision repeats words: one entry
        newest, how = sa.pick_b(approvals, 'long')
        self.assertEqual((newest['revision'], how), (5, 'newest'))
        bound, how = sa.pick_b(approvals, 'long', making.script_hash('first words'))
        self.assertEqual((bound['revision'], how), (1, 'take'))
        none, why = sa.pick_b(approvals, 'short')
        self.assertIsNone(none)
        self.assertIn('short', why)

    def test_a_is_the_newest_draft_filed_before_his_approval_never_his_own_words_refiled(self):
        texts = {'m1': 'the first engine draft', 'm2': 'the final engine draft', 'm3': 'his approved words',
                 'm4': 'a draft filed after he approved', 'm5': 'another piece'}
        mats = [material('m1', '5-minute cut script, v1', '2026-11-17T11:30:00Z'),
                material('m2', '5-minute cut script (final, for your Approve)', '2026-11-17T16:04:00Z'),
                material('m3', "5-minute cut script (Krish's edits, approved 16:20)", '2026-11-17T17:35:00Z'),
                material('m4', '5-minute cut script v5', '2026-11-17T18:30:00Z'),
                material('m5', '5-minute cut script', '2026-11-17T17:00:00Z', piece=OTHER),
                material('m6', 'sources.json', '2026-11-17T17:50:00Z', role='research')]
        read = lambda m: texts[m['id']]  # noqa: E731
        approved = {h: '2026-11-17T16:20:16.888Z' for h in sa._hashes('his approved words')}
        m, text = sa.pick_a(mats, 'long', PIECE, '2026-11-17T17:57:40Z', approved, read)
        self.assertEqual((m['id'], text), ('m2', 'the final engine draft'))
        m, _ = sa.pick_a(mats, 'long', PIECE, '2026-11-17T12:00:00Z', {}, read)
        self.assertEqual(m['id'], 'm1')
        m, why = sa.pick_a(mats, 'short', PIECE, '2026-11-17T17:57:40Z', {}, read)
        self.assertIsNone(m)
        self.assertIn('short', why)

    def test_a_draft_he_approved_unchanged_before_editing_is_still_the_draft(self):
        texts = {'m1': 'old draft words', 'm2': 'the final draft'}
        mats = [material('m1', '5-minute cut script v1', '2026-11-17T11:00:00Z'),
                material('m2', '5-minute cut script v2', '2026-11-17T12:00:00+00:00')]
        approved = {h: '2026-11-17T13:00:00Z' for h in sa._hashes('the final draft')}
        m, _ = sa.pick_a(mats, 'long', PIECE, '2026-11-17T15:00:00Z', approved, lambda m: texts[m['id']])
        self.assertEqual(m['id'], 'm2')

    def test_a_withdrawn_approval_does_not_count_and_a_lone_approval_is_bound(self):
        hist = [
            {'doc_id': 'tue-scripts-words-b019dbf8', 'revision': 1, 'updated_by': 'Krish', 'updated_at': '2026-11-17T14:57:04Z',
             'body': {'kind': 'approve_scripts', 'approved': True, 'piece_id': PIECE, 'at': '2026-11-17T14:57:04Z', 'texts': {'long': 'v1'}}},
            {'doc_id': 'tue-scripts-back-b019dbf8', 'revision': 1, 'updated_by': 'engine_operator', 'updated_at': '2026-11-17T17:54:51Z',
             'body': {'kind': 'take_back', 'what': 'scripts', 'approved': False, 'piece_id': PIECE, 'at': '2026-11-17T17:54:51.045Z'}},
            {'doc_id': 'tue-scripts-words-b019dbf8', 'revision': 7, 'updated_by': 'Krish', 'updated_at': '2026-11-17T17:57:40Z',
             'body': {'kind': 'approve_scripts', 'approved': True, 'piece_id': PIECE, 'at': '2026-11-17T17:57:40.285Z', 'texts': {'long': 'v2'}}},
        ]
        approvals = sa.approvals_of(hist, PIECE)
        self.assertEqual([a['revision'] for a in approvals], [7])
        self.assertEqual(sa.pick_b(approvals, 'long')[1], 'only')

    def test_ve_ingest_tells_the_cut_from_the_take_name_or_the_only_cut(self):
        self.assertEqual(sa.cut_of_take('long-1110'), 'long')
        self.assertEqual(sa.cut_of_take('short_2'), 'short')
        self.assertEqual(sa.cut_of_take('thursday-take-1', ['short']), 'short')
        self.assertIsNone(sa.cut_of_take('thursday-take-1', ['long', 'short']))
        self.assertIsNone(sa.cut_of_take('longer-take'))
        self.assertEqual(sa.weeks_of({'piece': {'week': '2026-11-16'}}), ['2026-11-09', '2026-11-16'])

    def test_the_recording_on_the_record(self):
        record = {'recordings': [{'cut': 'long', 'path': 'recordings/' + 'b' * 64 + '.mp4', 'script_sha256': 'c' * 64}]}
        self.assertEqual(sa.recorded_sha(record, 'long'), ('c' * 64, 'b' * 64))
        self.assertEqual(sa.recorded_sha(record, 'short'), (None, None))


class OnTheRecord(unittest.TestCase):
    def test_the_patch_keeps_hashes_and_counts_never_the_words(self):
        a, b = 'The cost is dearer now.', 'The cost is higher now.'
        texts = {'a': {'text': a, 'tokens': sa.text_tokens(a), 'sha256': making.script_hash(a), 'source': 'material', 'ref': 'm2'},
                 'b': {'text': b, 'tokens': sa.text_tokens(b), 'sha256': making.script_hash(b), 'source': 'approval', 'ref': 'picks/x r5'},
                 'c': {'missing': 'no take record given'}}
        patch = sa.record_patch('short', texts, sa.audit(texts), at='2026-11-18T10:00:00+00:00')['script_audit']['short']
        self.assertEqual(patch['texts']['c'], {'missing': 'no take record given'})
        self.assertEqual(patch['texts']['a']['sha256'], making.script_hash(a))
        self.assertNotIn('text', patch['texts']['a'])
        self.assertEqual(sorted(patch['pairs']), ['a_b'])
        self.assertEqual(patch['pairs']['a_b']['swaps'], [{'from': 'dearer', 'to': 'higher'}])
        self.assertNotIn('examples', patch['pairs']['a_b'])
        md = sa.markdown(PIECE, 'short', texts, sa.audit(texts))
        self.assertIn('"dearer" became "higher"', md)
        self.assertIn('missing', md)
        with self.assertRaises(sa.AuditError):
            sa.record_patch('middle', texts, {})


if __name__ == '__main__':
    unittest.main()
