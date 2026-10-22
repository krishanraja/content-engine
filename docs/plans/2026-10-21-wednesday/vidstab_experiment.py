"""Rejected vidstab experiment, retained for diagnostic reproducibility.

This build produced larger jolts in the measured trial. Delivery uses
scripts/quick-edit/wall_stabilize.py instead.

Input is an edited camera-only clip. Preserve its frame sequence and use a
constant crop, with no adaptive zoom. Audio is supplied by the house mixer.
"""
import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path


def digest(path):
    with Path(path).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def stabilise(source,out,fps=24,start=None,seconds=None,wall_height=None):
    source=Path(source).resolve();out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    env={**os.environ,'OMP_NUM_THREADS':'2'}
    base=['ffmpeg','-nostdin','-y','-hide_banner','-threads','4']
    seek=(['-ss',str(start)] if start is not None else [])
    limit=(['-t',str(seconds)] if seconds is not None else [])
    common=[*seek,'-i',str(source),*limit,'-map','0:v:0','-an']
    def run(args,name):
        with (out/name).open('w',encoding='utf-8') as log:
            subprocess.run(args,cwd=out,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
    detection_crop=f'crop=iw:{wall_height}:0:0,' if wall_height else ''
    run([*base,*common,'-vf',f'setpts=N/({fps}*TB),{detection_crop}vidstabdetect=shakiness=7:accuracy=15:result=motion.trf',
         '-fps_mode','passthrough','-f','null','-'],'detect.log')
    settings='smoothing=24:optalgo=gauss:optzoom=1:zoom=0:maxshift=50:maxangle=0.015:crop=black:interpol=bicubic'
    target=out/'camera-stable.mkv'
    run([*base,*common,'-vf',f'setpts=N/({fps}*TB),vidstabtransform=input=motion.trf:{settings}',
         '-fps_mode','passthrough','-enc_time_base',f'1:{fps}','-c:v','libx264','-preset','fast','-crf','16',
         '-pix_fmt','yuv420p','-threads','4',target.name],'transform.log')
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_packets','-select_streams','v:0',
        '-show_entries','stream=nb_read_packets,width,height','-of','json',str(target)],text=True))['streams'][0]
    source_frames=None
    if start is None and seconds is None:
        original=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_packets','-select_streams','v:0',
            '-show_entries','stream=nb_read_packets','-of','json',str(source)],text=True))['streams'][0]
        source_frames=int(original['nb_read_packets'])
        assert int(probe['nb_read_packets'])==source_frames,'Stabilisation changed the camera frame sequence'
    receipt={'source_sha256':digest(source),'output_sha256':digest(target),'frame_count':int(probe['nb_read_packets']),
        'source_frame_count':source_frames,'fps':fps,'filter':settings,'graphics_processed':False,'audio_processed':False,
        'start_s':start,'seconds':seconds,'wall_detection_height':wall_height,'review_status':'measure_motion_and_review_before_delivery'}
    (out/'stabilisation.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps(receipt),flush=True)
    return target


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--fps',type=int,default=24);ap.add_argument('--start',type=float);ap.add_argument('--seconds',type=float)
    ap.add_argument('--wall-height',type=int)
    a=ap.parse_args();stabilise(a.source,a.out,a.fps,a.start,a.seconds,a.wall_height)
