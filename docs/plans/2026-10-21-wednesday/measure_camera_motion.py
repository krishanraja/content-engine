"""Measure static-wall motion independently of the stabilisation filter."""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def measure_windows(path, starts, seconds, fps=24):
    # Seeking by either time or CAP_PROP_POS_FRAMES can consult incorrect
    # average-rate metadata. Count decoded frames once, as the compositor does.
    cap=cv2.VideoCapture(str(path),cv2.CAP_FFMPEG,[cv2.CAP_PROP_N_THREADS,2])
    ranges=[(round(start*fps),round((start+seconds)*fps))for start in starts]
    rows=[[]for _ in starts];previous=None;active=None;i=0
    while i<max(end for _,end in ranges) and cap.grab():
        window=next((k for k,(begin,end)in enumerate(ranges)if begin<=i<end),None)
        if window is None:previous=None;active=None;i+=1;continue
        ok,frame=cap.retrieve()
        if not ok:break
        if active!=window:previous=None;active=window
        grey=cv2.cvtColor(cv2.resize(frame,(540,960)),cv2.COLOR_BGR2GRAY)
        if previous is not None:
            # The upper wall is above the speaker, headphones and gestures.
            mask=np.zeros_like(grey);mask[25:300,25:515]=255
            points=cv2.goodFeaturesToTrack(previous,maxCorners=180,qualityLevel=.02,minDistance=12,mask=mask)
            if points is not None and len(points)>=12:
                following,status,_=cv2.calcOpticalFlowPyrLK(previous,grey,points,None)
                valid=status.ravel()==1
                if valid.sum()>=12:
                    matrix,inliers=cv2.estimateAffinePartial2D(points[valid],following[valid],method=cv2.RANSAC,ransacReprojThreshold=1.2)
                    if matrix is not None and inliers.sum()>=10:
                        rows[window].append({'frame':i-ranges[window][0],'dx_px':float(matrix[0,2]*2),'dy_px':float(matrix[1,2]*2),
                            'angle_deg':float(np.degrees(np.arctan2(matrix[1,0],matrix[0,0]))),'inliers':int(inliers.sum())})
        previous=grey;i+=1
    cap.release()
    return [summarise(path,start,seconds,points)for start,points in zip(starts,rows)]


def measure(path,start,seconds,fps=24):
    return measure_windows(path,[start],seconds,fps)[0]


def summarise(path,start,seconds,rows):
    shifts=np.array([[r['dx_px'],r['dy_px']] for r in rows])
    speed=np.linalg.norm(shifts,axis=1) if len(shifts) else np.array([])
    return {'file':str(path),'start_s':start,'seconds':seconds,'tracked_pairs':len(rows),
        'median_translation_px':float(np.median(speed)) if len(speed) else None,
        'p95_translation_px':float(np.percentile(speed,95)) if len(speed) else None,
        'rms_translation_px':float(np.sqrt(np.mean(speed**2))) if len(speed) else None,
        'median_rotation_deg':float(np.median([abs(r['angle_deg']) for r in rows])) if rows else None,
        'method':'Sequential decoded-frame indices; optical flow and robust affine fit on static upper-wall features',
        'points':rows}


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('video',type=Path);ap.add_argument('--start',type=float,default=20);ap.add_argument('--seconds',type=float,default=10);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args()
    result=measure(a.video,a.start,a.seconds);a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='points'}))
