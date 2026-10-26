"""Reject wrong media clocks before mixing a continuous voiceover."""
import importlib.util,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts/quick-edit'))
import motion_compose as m

class MotionClockTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.base=Path(self.tmp.name)
        self.cfg={'captions':False,'motion_composition':{'frames':2262,'speed':1.12}}
        for key in ('audio','picture','intro','outro','words','original'):
            file=self.base/key;file.write_text(json.dumps({'words':[{'w':'Hi','s':0,'e':1}]}))
            self.cfg['motion_composition'][key]={'path':key,'sha256':m.quality.digest(file)}
    def tearDown(self): self.tmp.cleanup()
    def probe(self,p):
        key=p.name
        frames={'picture':2262,'intro':105,'outro':180}
        if key in frames:return {'streams':[{'codec_type':'video','nb_frames':str(frames[key]),'r_frame_rate':'30/1','width':1080,'height':1920}]}
        return {'streams':[{'codec_type':'audio'}],'format':{'duration':str(84.41426 if key=='original' else 75.369875)}}
    def verify(self):
        with patch.object(m,'probe',side_effect=self.probe),patch.object(m.quality,'transcript_identity',return_value={}),patch.object(m.quality,'checked_words',return_value=[{'w':'Hi','s':0,'e':1}]):
            return m.verify(self.cfg,self.base)
    def test_continuous_clock_accepted(self): self.assertEqual(self.verify()[1]['frames'],2262)
    def test_changed_audio_rejected(self):
        (self.base/'audio').write_text('changed')
        with self.assertRaisesRegex(ValueError,'audio differs'):self.verify()
    def test_second_speed_clock_rejected(self):
        self.cfg['motion_composition']['speed']=1.2544
        with self.assertRaisesRegex(ValueError,'duration'):self.verify()
    def test_motion_duration_mismatch_rejected(self):
        self.cfg['motion_composition']['frames']=2300
        with self.assertRaisesRegex(ValueError,'clocks differ'):self.verify()
    def test_speech_cuts_rejected(self):
        self.cfg['remove_words']=['Hi']
        with self.assertRaisesRegex(ValueError,'speech edits'):self.verify()

if __name__=='__main__':unittest.main()
