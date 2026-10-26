import json
import sys
import tempfile
import subprocess
import unittest
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts/quick-edit'))
import quality
import make
import music
import segment_clock
import audio_quality
import sync_check


class QualityTests(unittest.TestCase):
    def test_decoder_limits_preserve_stream_order_pixels_and_frame_clock(self):
        args=['-i','camera.mkv','-loop','1','-itsoffset','2','-i','card.png','-i','sound.wav']
        bounded=make.bounded_decode_inputs(args)
        self.assertEqual([bounded[i+1]for i,value in enumerate(bounded)if value=='-i'],['camera.mkv','card.png','sound.wav'])
        self.assertTrue(all(bounded[i-2:i]==['-threads','2']for i,value in enumerate(bounded)if value=='-i'))
        with self.assertRaises(ValueError):make.bounded_decode_inputs(args,0)
        with tempfile.TemporaryDirectory()as temp:
            video=Path(temp)/'fixture.mkv'
            subprocess.run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-i','testsrc=size=64x64:rate=24',
                '-frames:v','6','-c:v','libx264','-threads','1',str(video)],check=True)
            def decoded(inputs):return subprocess.check_output(['ffmpeg','-nostdin','-v','error',*inputs,'-f','framemd5','-'])
            self.assertEqual(decoded(['-i',str(video)]),decoded(make.bounded_decode_inputs(['-i',str(video)])))

    def test_caption_adlibs_are_bound_to_exact_edited_clock_and_original_words(self):
        words=[{'w':'Most','s':1.,'e':1.2},{'w':'of','s':1.2,'e':1.3},{'w':'us','s':1.3,'e':1.5}]
        identity={'source_sha256':'original','speed':1.1,'clock':'processing_source'}
        after=[{'w':'Most','s':.2,'e':.4},{'w':'of','s':.4,'e':.5},{'w':'us,','s':.5,'e':.6},*words]
        doc={'provenance':{'schema':1,'clock':'edited','source_provenance':identity,
             'edited_sha256':'edited','base_tokens_sha256':quality.caption_token_digest(words)},
             'edits':[{'start_index':0,'end_index':3,'before':words,'after':after,
                       'evidence':['bounded source recognition'],'reason':'Preserve a spoken repetition'}]}
        fixed=quality.repaired_caption_words(doc,words,identity,'edited',2.)
        self.assertEqual(fixed,after)
        self.assertEqual(fixed[0]['s'],.2)  # The 1.1x speed is not applied twice.
        for source,edited in [({**identity,'speed':1.},'edited'),(identity,'changed')]:
            with self.assertRaises(ValueError):quality.repaired_caption_words(doc,words,source,edited,2.)
        with self.assertRaises(ValueError):quality.repaired_caption_words(doc,[{**words[0],'w':'All'},*words[1:]],identity,'edited',2.)
        doc['edits'][0]['after'][0]['s']=-.1
        with self.assertRaises(ValueError):quality.repaired_caption_words(doc,words,identity,'edited',2.)

    def test_caption_repairs_refuse_overlapping_or_unsupported_adjudications(self):
        words=[{'w':'a','s':0.,'e':.5},{'w':'word','s':.5,'e':1.}]
        doc={'provenance':{'schema':1,'clock':'edited','source_provenance':{},'edited_sha256':'x',
                          'base_tokens_sha256':quality.caption_token_digest(words)},
             'edits':[{'start_index':0,'end_index':2,'before':words,'after':words,
                       'evidence':[],'reason':'Spelling'}]}
        with self.assertRaises(ValueError):quality.repaired_caption_words(doc,words,{},'x',1.)
        doc['edits'][0]['evidence']=['source'];doc['edits'].append(dict(doc['edits'][0]))
        with self.assertRaises(ValueError):quality.repaired_caption_words(doc,words,{},'x',1.)

    def test_short_phrase_between_removals_keeps_complete_audio(self):
        words=[{'w':'remove','s':0.,'e':.15},{'w':'Formula','s':.15,'e':.47},
               {'w':'One','s':.47,'e':.77},{'w':'remove','s':.77,'e':1.}]
        spans,_=make.segments(words,[(0,0),(3,3)],.9,.18,.25,1,True)
        self.assertEqual(quality.cut_problems(words,spans,[(0,0),(3,3)]),[])
        self.assertEqual(spans[0]['source_end'],.77)
        args=segment_clock.encode_args('source','out',spans[0]['a'],15,24,'null',source_end=.77)
        self.assertIn('atrim=end_sample=29760',args[args.index('-filter_complex')+1])

    def test_sync_needs_distributed_reliable_points_and_calibration(self):
        points=[{'at_s':t,'status':'pass'} for t in (5,21,38,55,72,90)]
        self.assertEqual(sync_check.result_status(points,True,(0,100)),'pass')
        self.assertEqual(sync_check.result_status(points,False,(0,100)),'inconclusive')
        self.assertEqual(sync_check.result_status([{'at_s':t,'status':'pass'} for t in range(6)],True,(0,100)),'inconclusive')
        points[2]['status']='inconclusive'
        self.assertEqual(sync_check.result_status(points,True,(0,100)),'inconclusive')
        points[2]['status']='fail'
        self.assertEqual(sync_check.result_status(points,True,(0,100)),'fail')

    def test_silent_or_overloud_music_cannot_pass(self):
        clean={'points':[{'t':t/10,'S':-31} for t in range(30,100)],'silences':[]}
        self.assertEqual(audio_quality.continuity_report(clean,0,10,[])['status'],'pass')
        clean['silences']=[[4,4.6]]
        self.assertEqual(audio_quality.continuity_report(clean,0,10,[])['status'],'fail')
        loud={'points':[{'t':t/10,'S':-25} for t in range(30,100)],'silences':[]}
        self.assertEqual(audio_quality.continuity_report(loud,0,10,[])['status'],'fail')
        self.assertEqual(audio_quality.continuity_report({'points':[],'silences':[]},0,10,[])['status'],'fail')

    def test_ambiguous_cue_is_not_resolved_by_first_hit(self):
        words=[{'w':w,'s':i,'e':i+.8} for i,w in enumerate('same gear same gear'.split())]
        with self.assertRaises(ValueError):quality.unique_anchor(words,'same gear',make.norm)
        self.assertEqual(quality.unique_anchor(words,'same gear',make.norm,after=2),(2,3))
    def test_clipped_words_and_removed_audio_cannot_pass(self):
        words=[{'w':'complete','s':0.,'e':1.004},{'w':'remove','s':1.1,'e':1.3}]
        self.assertTrue(quality.cut_problems(words,[{'a':0,'b':1.0}],[(1,1)]))
        self.assertTrue(quality.cut_problems(words,[{'a':0,'b':1.4}],[(1,1)]))
        self.assertEqual(quality.cut_problems(words,[{'a':0,'b':1.05}],[(1,1)]),[])
        spans,_=make.segments(words[:1],[],.9,0,0,1.005)
        self.assertGreaterEqual(spans[0]['b'],1.004)

    def test_variable_timing_and_repeated_joins_have_exact_samples(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/'variable.mkv'
            subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i','testsrc2=s=108x192:r=24:d=3',
                            '-f','lavfi','-i','sine=f=220:r=48000:d=3','-vf','setpts=PTS+0.002*sin(N)/TB',
                            '-fps_mode','passthrough','-c:v','libx264','-preset','ultrafast',
                            '-c:a','pcm_s16le',str(source)],check=True)
            files=[];frames=[13,17,24,19,16]
            for i,count in enumerate(frames):
                dest=root/f'{i}.mkv'
                args=segment_clock.encode_args(source,dest,.013+i*.137,count,24,make.conform_filter(24,24))
                self.assertNotIn('-frames:v',args)
                subprocess.run(args,check=True)
                segment_clock.require(dest,count,24)
                files.append("file '"+dest.as_posix()+"'")
            listing=root/'parts.txt';listing.write_text('\n'.join(files))
            joined=root/'joined.mkv'
            subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-c','copy',str(joined)],check=True)
            self.assertEqual(segment_clock.require(joined,sum(frames),24)['sample_error'],0)

    def test_transcript_cannot_change_clock_or_source(self):
        identity = {'source_sha256':'a','speed':1.1,'clock':'processing_source'}
        doc = {'provenance':identity,'words':[{'w':'gear','s':1.,'e':1.3}]}
        self.assertEqual(quality.checked_words(doc,identity),doc['words'])
        for expected in ({**identity,'speed':1},{**identity,'source_sha256':'b'},{**identity,'clock':'raw'}):
            with self.assertRaises(ValueError): quality.checked_words(doc,expected)
        with self.assertRaises(ValueError): quality.checked_words({'words':doc['words']},identity)

    def test_heard_check_keeps_adlibs_and_detects_missing_words(self):
        self.assertEqual(quality.word_diff('So change the gear','So change the gear.')['status'],'pass')
        self.assertEqual(quality.word_diff('So change the gear','change the gear')['status'],'fail')
        self.assertEqual(quality.word_diff('third gear','third again')['status'],'fail')
        self.assertEqual(quality.word_diff('Opus 5.5 C-Class','Opus 5 .5 C -Class')['status'],'pass')
        self.assertEqual(quality.word_diff('','')['status'],'fail')

    def test_pages_follow_words_and_refuse_ambiguous_anchors(self):
        ws = [{'w':w,'s':float(i),'e':i+.8} for i,w in enumerate('Mercedes means Claude C-Class means Opus'.split())]
        cue = {'id':'map','s':0,'e':6,'on':['Mercedes','C-Class'],'pages':{'9x16':['one','two']}}
        pages = make.expand_pages([cue],'9x16',ws)
        self.assertEqual([(p['s'],p['e']) for p in pages],[(0,3.),(3.,6)])
        cue['on'] = ['means','C-Class']
        with self.assertRaises(ValueError): make.expand_pages([cue],'9x16',ws)

    def test_coverage_uses_union_and_keeps_end_gaps(self):
        value = quality.coverage([{'s':1,'e':9},{'s':2,'e':8}],0,10)
        self.assertAlmostEqual(value['fraction'],.8)
        self.assertEqual(value['gaps'],[[0,1],[9,10]])
        self.assertIn('visual coverage is below 90%',quality.coverage_problems(value))
        value = quality.coverage([{'s':0,'e':8}],0,10)
        self.assertIn('a visual gap exceeds 1.5 seconds',quality.coverage_problems(value))

    def test_continuous_bed_restarts_at_cards(self):
        track={'duration_s':190,'measured_lufs':-11,'intro_cue_s':0}
        tl={'total_s':300,'voice_start_s':3.5,'voice_end_s':281}
        levels={'bed_lufs':-31,'chapter_lufs':-22,'intro_lufs':-16,'outro_lufs':-18}
        graph,report = music.continuous_episode_bed(track,tl,levels,[(140,143)])
        self.assertEqual(report['restart_windows'],[(0.,141.),(139.,300.)])
        self.assertIn('acrossfade=d=2',graph)
        points=dict(report['envelope'])
        self.assertEqual(points[140],-11)
        self.assertEqual(points[143.8],-20)
        self.assertEqual(points[139.5],-20)
        with self.assertRaises(music.MusicError): music.continuous_episode_bed(track,tl,levels,[])

    def test_delivery_needs_exact_bytes_and_all_checks(self):
        with tempfile.TemporaryDirectory() as temp:
            video=Path(temp)/'video.mp4'; video.write_bytes(b'first')
            receipt=Path(temp)/'receipt.json'
            self.assertTrue(quality.delivery_problems(video,receipt))
            report={'video_sha256':quality.digest(video),'library_path':'target','checks':{
                key:{'status':'pass'} for key in ('heard','sync','loudness','visuals','full_review')}}
            receipt.write_text(json.dumps(report))
            self.assertIn('motion assessment is not passed',quality.delivery_problems(video,receipt,'target'))
            report['source_provenance']={'source_sha256':'a'*64}
            report['checks']['motion']={
                'status':'pass','recording_sha256':'a'*64,'decision':'not_needed',
                'reason':'Static wall tracked throughout the take; no visible shake.',
                'assessment':{'source_sha256':'b'*64,'evidence_sha256':'c'*64,'method':'Static background tracking'},
                'final_review':{'status':'pass','video_sha256':report['video_sha256'],'evidence_sha256':'d'*64,
                    **{k:'pass' for k in ('shake','warping','borders','framing')}}}
            receipt.write_text(json.dumps(report))
            binding_missing='independent media quality binding missing; create a working candidate and submit it for review'
            self.assertEqual(quality.delivery_problems(video,receipt,'target'),['visual clarity gate is not passed',binding_missing])
            # Each gate remains independently necessary; these scoped mocks do not
            # create a signed receipt or change production verification behavior.
            with patch('media_standard.check', return_value=[]):
                self.assertEqual(quality.delivery_problems(video,receipt,'target'),['visual clarity gate is not passed'])
            with patch('visual_clarity.delivery_problems', return_value=[]):
                self.assertEqual(quality.delivery_problems(video,receipt,'target'),[binding_missing])
            motion=report['checks']['motion']
            motion['recording_sha256']='e'*64
            self.assertIn('different recording',quality.motion_problems(report)[0])
            motion['recording_sha256']='a'*64
            motion['decision']='stabilised'
            motion['treatment']={'output_sha256':'e'*64,'evidence_sha256':'f'*64}
            motion['comparison']={'before_rms_px':10,'after_rms_px':3,'before_p95_px':20,'after_p95_px':7}
            self.assertEqual(quality.motion_problems(report),[])
            motion['comparison']['after_p95_px']=21
            self.assertIn('not reduced',quality.motion_problems(report)[0])
            motion['comparison']['after_p95_px']=float('nan')
            self.assertIn('invalid',quality.motion_problems(report)[0])
            motion['comparison']['after_p95_px']=7
            motion['final_review']['video_sha256']='e'*64
            self.assertIn('stale',quality.motion_problems(report)[0])
            self.assertTrue(quality.delivery_problems(video,receipt,'other'))
            report['checks']['sync']['status']='inconclusive'; receipt.write_text(json.dumps(report))
            self.assertTrue(quality.delivery_problems(video,receipt))
            video.write_bytes(b'changed')
            self.assertIn('different bytes',quality.delivery_problems(video,receipt)[0])

    def test_guarded_video_cannot_be_recorded_or_sent_without_receipt(self):
        sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts/post-pack'))
        import making
        import send
        calls=[]
        def fake(*args):
            calls.append(args)
            raise AssertionError('Must refuse before any network call')
        pid=next(iter(quality.guarded_pieces()))
        self.assertEqual(making.main([pid,'video','long','Replacement','3 Video/new.mp4'],call=fake),1)
        self.assertEqual(calls,[])
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'new.mp4'; path.write_bytes(b'draft')
            target=quality.guarded_pieces()[pid]['library_prefix']+'3 Video/new.mp4'
            with self.assertRaises(send.SendError): send.send([(target,path,'review')],None)


if __name__=='__main__': unittest.main()
