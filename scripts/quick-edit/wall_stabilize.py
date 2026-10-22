"""Rigid camera stabilisation using a wall region, before graphics.

The speaker and hands are excluded from motion estimation. A smoothed
camera path preserves deliberate movement, with a single static crop.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np


def digest(p):
    with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def camera(source):
    return cv2.VideoCapture(str(source),cv2.CAP_FFMPEG,[cv2.CAP_PROP_N_THREADS,2])


def analyse(source,out,start=0,frames=None,fps=24,expected_frames=None):
    cv2.setNumThreads(2)
    source=Path(source).resolve();out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    cap=camera(source);width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    source_fps=cap.get(cv2.CAP_PROP_FPS)
    if (width,height)!=(1080,1920) or (abs(source_fps-fps)>.001 and expected_frames is None):
        cap.release()
        raise ValueError('This wall-region profile requires 1080x1920 camera footage at 24 fps; assess other framing separately')
    cap.set(cv2.CAP_PROP_POS_FRAMES,start)
    scale=540/width;centre=np.array([width/2,height/2,1.]);previous=None;paths=[];fits=[];current=np.eye(3)
    while frames is None or len(paths)<frames:
        ok,frame=cap.read()
        if not ok:break
        gray=cv2.cvtColor(cv2.resize(frame,(540,round(height*scale))),cv2.COLOR_BGR2GRAY)
        if previous is not None:
            mask=np.zeros_like(gray);mask[25:300,25:515]=255
            points=cv2.goodFeaturesToTrack(previous,220,.015,10,mask=mask)
            if points is None:raise ValueError('The wall region has no usable features')
            nxt,status,_=cv2.calcOpticalFlowPyrLK(previous,gray,points,None)
            valid=status.ravel()==1
            matrix,inliers=cv2.estimateAffinePartial2D(points[valid]/scale,nxt[valid]/scale,method=cv2.RANSAC,ransacReprojThreshold=2.4)
            if matrix is None or int(inliers.sum())<12:raise ValueError('Camera path lost the wall')
            angle=np.arctan2(matrix[1,0],matrix[0,0]);r=np.array([[np.cos(angle),-np.sin(angle)],[np.sin(angle),np.cos(angle)]])
            mapped=matrix@centre;matrix=np.c_[r,mapped-r@centre[:2]]
            step=np.vstack([matrix,[0,0,1]]);current=step@current;fits.append(int(inliers.sum()))
        paths.append(current.copy());previous=gray
    cap.release();assert len(paths)>10
    if expected_frames is not None:assert len(paths)==expected_frames,'Decoded frames differ from the accepted composition clock'
    if start==0 and frames is None:
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_packets','-select_streams','v:0',
            '-show_entries','stream=nb_read_packets','-of','json',str(source)],text=True))['streams'][0]
        assert len(paths)==int(probe['nb_read_packets']),'Camera decode did not preserve every source frame'
    raw=np.array([[*(p@centre)[:2],np.arctan2(p[1,0],p[0,0])] for p in paths]);raw[:,2]=np.unwrap(raw[:,2])
    smooth=np.column_stack([cv2.GaussianBlur(raw[:,i].reshape(-1,1),(1,0),sigmaX=0,sigmaY=18,borderType=cv2.BORDER_REPLICATE).ravel() for i in range(3)])
    corrections=[]
    for p,s in zip(paths,smooth):
        a=s[2];r=np.array([[np.cos(a),-np.sin(a)],[np.sin(a),np.cos(a)]])
        wanted=np.vstack([np.c_[r,s[:2]-r@centre[:2]],[0,0,1]])
        corrections.append(wanted@np.linalg.inv(p))
    # A single crop for the whole shot avoids a zoom that breathes. Dampen
    # all corrections uniformly only if the crop would exceed twelve percent.
    corners=np.array([[0,0,1],[width-1,0,1],[0,height-1,1],[width-1,height-1,1]]).T
    def matrices(strength,zoom):
        result=[];z=np.array([[zoom,0,centre[0]*(1-zoom)],[0,zoom,centre[1]*(1-zoom)],[0,0,1.]])
        for c in corrections:
            a=np.arctan2(c[1,0],c[0,0])*strength;r=np.array([[np.cos(a),-np.sin(a)],[np.sin(a),np.cos(a)]])
            mapped=c@centre;delta=(mapped[:2]-centre[:2])*strength
            corrected=np.vstack([np.c_[r,centre[:2]+delta-r@centre[:2]],[0,0,1]])
            result.append(z@corrected)
        return result
    def fits_all(ms):
        for m in ms:
            p=np.linalg.inv(m)@corners
            if p[0].min()<0 or p[1].min()<0 or p[0].max()>width-1 or p[1].max()>height-1:return False
        return True
    strength=1.
    if not fits_all(matrices(strength,1.12)):
        lo,hi=0.,1.
        for _ in range(14):
            mid=(lo+hi)/2
            if fits_all(matrices(mid,1.12)):lo=mid
            else:hi=mid
        strength=lo
    lo,hi=1.,1.12
    for _ in range(14):
        mid=(lo+hi)/2
        if fits_all(matrices(strength,mid)):hi=mid
        else:lo=mid
    zoom=hi+.002;warps=matrices(strength,zoom)
    receipt={'source_sha256':digest(source),'start_frame':start,'frame_limit':frames,'frame_count':len(paths),
        'fps':fps,'source_reported_fps':source_fps,'expected_frames':expected_frames,'static_zoom':zoom,'correction_strength':strength,'smoothing_sigma_frames':18,
        'detection_region_scaled':[25,25,515,300],'minimum_inliers':min(fits),'graphics_processed':False,'audio_processed':False,
        'method':'Rigid wall-feature camera path, Gaussian smoothing, constant crop; no face or gesture tracking'}
    np.savez_compressed(out/'camera-path.npz',raw=raw,smooth=smooth,warps=np.array(warps))
    receipt['camera_path_sha256']=digest(out/'camera-path.npz')
    (out/'path-checkpoint.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps({'stage':'path_checkpoint','frames':len(paths)}),flush=True)
    return receipt,np.array(warps)


def run(source,out,start=0,frames=None,fps=24,expected_frames=None,preset='veryfast',crf=14):
    cv2.setNumThreads(2);source=Path(source).resolve();out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    checkpoint=out/'path-checkpoint.json';receipt=None
    if checkpoint.is_file():
        receipt=json.loads(checkpoint.read_text(encoding='utf-8'))
        assert receipt['source_sha256']==digest(source) and receipt['start_frame']==start and receipt['frame_limit']==frames and receipt['fps']==fps and receipt.get('expected_frames')==expected_frames,'Camera checkpoint has different inputs'
        assert receipt['camera_path_sha256']==digest(out/'camera-path.npz'),'Camera path checkpoint changed'
        warps=np.load(out/'camera-path.npz')['warps'];assert len(warps)==receipt['frame_count']
        print('Reusing verified camera-path checkpoint',flush=True)
    else:receipt,warps=analyse(source,out,start,frames,fps,expected_frames)
    final=out/'camera-stable.mkv';completed=out/'stabilisation.json'
    if completed.is_file():
        prior=json.loads(completed.read_text(encoding='utf-8'))
        assert prior['source_sha256']==receipt['source_sha256'] and prior['output_sha256']==digest(final),'Completed camera footage changed'
        print(json.dumps(prior),flush=True);return
    cap=camera(source);cap.set(cv2.CAP_PROP_POS_FRAMES,start);width,height=1080,1920
    target=out/'camera-stable.encoding.mkv';log=(out/'encode.log').open('w',encoding='utf-8')
    progress=(out/'encode-progress.log').open('w',encoding='utf-8')
    encoder=subprocess.Popen(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','warning','-threads','4',
        '-f','rawvideo','-pixel_format','bgr24','-video_size',f'{width}x{height}','-framerate',str(fps),'-i','pipe:0',
        '-an','-c:v','libx264','-preset',preset,'-crf',str(crf),'-pix_fmt','yuv420p','-threads','4','-progress','pipe:1',str(target)],stdin=subprocess.PIPE,stdout=progress,stderr=log)
    try:
        for index,m in enumerate(warps):
            ok,frame=cap.read();assert ok,'Camera decode ended before its measured path'
            fixed=cv2.warpAffine(frame,m[:2],(width,height),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT)
            encoder.stdin.write(fixed.tobytes())
            if index%240==0:(out/'heartbeat.json').write_text(json.dumps({'stage':'encode','frames_supplied':index+1,'total_frames':len(warps)}),encoding='utf-8')
        encoder.stdin.close();assert encoder.wait()==0,'Camera encoder failed'
    finally:
        cap.release()
        if encoder.poll() is None:
            if encoder.stdin and not encoder.stdin.closed:encoder.stdin.close()
            encoder.terminate();encoder.wait(timeout=15)
        log.close();progress.close()
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','json',str(target)],text=True))
    assert int(probe['streams'][0]['nb_read_frames'])==len(warps),'Encoded camera frame count changed'
    if final.exists():
        interrupted=out/'camera-stable.interrupted.mkv'
        assert not interrupted.exists(),'Preserve the previous interrupted file before resuming'
        final.rename(interrupted)
    target.replace(final);receipt['output_sha256']=digest(final);receipt['encoding']={'codec':'libx264','preset':preset,'crf':crf,'role':'High-quality camera intermediate before the native final compositor'}
    (out/'stabilisation.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps(receipt),flush=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--start-frame',type=int,default=0);ap.add_argument('--frames',type=int);ap.add_argument('--expected-frames',type=int)
    ap.add_argument('--preset',choices=['fast','veryfast'],default='veryfast');ap.add_argument('--crf',type=int,choices=range(0,19),default=14)
    a=ap.parse_args();run(a.source,a.out,a.start_frame,a.frames,expected_frames=a.expected_frames,preset=a.preset,crf=a.crf)
