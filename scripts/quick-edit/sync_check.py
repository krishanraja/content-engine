#!/usr/bin/env python3
"""Measure decoded frame/sample alignment with a pinned, local SyncNet model.

No timestamp seeks, media uploads, or automatic corrections. The caller supplies
the independently installed SyncNet checkout and model. Low confidence is never
a pass. Diagnostic windows and their measurements are retained for inspection.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

SYNCNET_REVISION = '907c0b579c2e2d83f0eae1b2ac9e720cde4e5623'
MODEL_SHA256 = '961e8696f888fce4f3f3a6c3d5b3267cf5b343100b238e79b2659bff2c605442'


def result_status(points, calibrated, speech_span):
    if any(p.get('status')=='fail' for p in points):
        return 'fail'
    if not calibrated or len(points)<6 or any(p.get('status')!='pass' for p in points):
        return 'inconclusive'
    a,b=speech_span
    starts=sorted(set(p['at_s'] for p in points))
    if b<=a or len(starts)<6 or starts[0]>a+(b-a)*.15 or starts[-1]<a+(b-a)*.85:
        return 'inconclusive'
    if any(y-x>(b-a)*.25 for x,y in zip(starts,starts[1:])):
        return 'inconclusive'
    return 'pass'


def sha256(path):
    with open(path, 'rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def inspect(path):
    data = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
    video = next(s for s in data['streams'] if s['codec_type'] == 'video')
    a, b = map(int, video['avg_frame_rate'].split('/'))
    return min((24, 25, 30, 50, 60), key=lambda rate: abs(rate - a / b)), data


def extract(path, starts, seconds, out):
    import cv2
    import numpy as np
    fps, metadata = inspect(path)
    windows = [(round(s * fps), round((s + seconds) * fps)) for s in starts]
    video = next(s for s in metadata['streams'] if s['codec_type'] == 'video')
    width, height = 480, round(video['height'] * 480 / video['width'] / 2) * 2
    select = '+'.join(f'between(n,{a},{b-1})' for a, b in windows)
    command = ['ffmpeg', '-v', 'error', '-threads', '2', '-i', str(path), '-an', '-vf',
               f"select='{select}',scale={width}:{height}", '-fps_mode', 'passthrough',
               '-pix_fmt', 'bgr24', '-f', 'rawvideo', 'pipe:1']
    decoder = subprocess.Popen(command, stdout=subprocess.PIPE)
    detector = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    clips, detection_rates = [], []
    for a, b in windows:
        frames, boxes = [], []
        for _ in range(b-a):
            raw = decoder.stdout.read(width * height * 3)
            if len(raw) != width * height * 3:
                raise RuntimeError('Sequential decode ended before all diagnostic windows')
            frame = np.frombuffer(raw, np.uint8).reshape(height, width, 3)
            found = detector.detectMultiScale(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY),
                                             scaleFactor=1.1, minNeighbors=5, minSize=(35, 35))
            boxes.append(max(found, key=lambda box: box[2]*box[3]) if len(found) else None)
            frames.append(frame)
        good = [box for box in boxes if box is not None]
        detection_rates.append(len(good) / len(boxes))
        if not good:
            clips.append(None)
            continue
        # Match the upstream face crop geometry; a stable crop avoids jitter.
        x, y, w, h = np.median(good, axis=0)
        size = max(w, h) / 2
        cx, cy = x+w/2, y+h/2
        pad = int(size*2)
        crops = []
        for frame in frames:
            padded = cv2.copyMakeBorder(frame, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(110,110,110))
            crop = padded[int(cy+pad-size):int(cy+pad+size*1.8),
                          int(cx+pad-size*1.4):int(cx+pad+size*1.4)]
            crops.append(cv2.resize(crop, (224,224)))
        # One conversion to SyncNet's 25 Hz analysis clock, from frame indices.
        indices = np.minimum((np.arange(round(seconds*25))*fps/25).astype(int), len(crops)-1)
        clips.append(np.stack(crops)[indices])
        print(f'extracted frame window {a}:{b}, face detection {len(good)/len(boxes):.1%}', flush=True)
    decoder.stdout.close()
    if decoder.wait() != 0:
        raise RuntimeError('Sequential video decoder failed')
    audio = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-vn',
                                    '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'])
    audio = np.frombuffer(audio, np.int16)
    for i, (start, clip) in enumerate(zip(starts, clips)):
        if clip is not None:
            np.savez_compressed(out/f'window-{i}.npz', frames=clip,
                                audio=audio[round(start*16000):round((start+seconds)*16000)])
            cv2.imwrite(str(out/f'face-{i}.jpg'), clip[len(clip)//2])
    return fps, detection_rates


def measure(model, frames, audio, shift=25):
    import numpy as np
    import torch
    import python_speech_features
    from SyncNetInstance import calc_pdist
    network = model.__S__
    network.eval()
    images = torch.from_numpy(frames.transpose(3,0,1,2).copy()).unsqueeze(0).float()
    mfcc = python_speech_features.mfcc(audio, 16000).T
    sound = torch.from_numpy(mfcc.copy()).unsqueeze(0).unsqueeze(0).float()
    count = min(len(frames), len(audio)//640)-5
    vf, af = [], []
    # Calibration changes only sound. Reuse the identical picture embeddings
    # across the two injected-offset runs, without changing the measurement.
    picture_key = (hashlib.sha256(frames.tobytes()).hexdigest(),count)
    prior = getattr(model,'_diagnostic_picture_cache',None)
    cached = prior is not None and prior[0] == picture_key
    with torch.inference_mode():
        for i in range(0, count, 16):
            ends = range(i, min(count, i+16))
            if not cached:
                vf.append(network.forward_lip(torch.cat([images[:,:,j:j+5] for j in ends])).cpu())
            af.append(network.forward_aud(torch.cat([sound[:,:,:,j*4:j*4+20] for j in ends])).cpu())
        pictures = prior[1] if cached else torch.cat(vf)
        model._diagnostic_picture_cache = (picture_key,pictures)
        distances = torch.mean(torch.stack(calc_pdist(pictures, torch.cat(af), vshift=shift),1),1)
        minimum, index = torch.min(distances,0)
    return {'offset_ms': int(shift-index)*40,
            'confidence': round(float(torch.median(distances)-minimum),4),
            'distance': round(float(minimum),4)}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('video', type=Path)
    ap.add_argument('--syncnet-root', type=Path, required=True)
    ap.add_argument('--model', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--at', type=float, nargs='+', required=True)
    ap.add_argument('--seconds', type=float, default=6)
    ap.add_argument('--calibrate', action='store_true')
    ap.add_argument('--speech-span',type=float,nargs=2,help='First and last speech seconds in the finished cut')
    args = ap.parse_args()
    if args.seconds <= 0 or any(x < 0 for x in args.at):
        ap.error('Sync windows need nonnegative starts and a positive duration')
    if any(b < a + args.seconds for a,b in zip(args.at,args.at[1:])):
        ap.error('Sequential sync windows must be ordered and must not overlap')
    revision = subprocess.check_output(['git','-C',str(args.syncnet_root),'rev-parse','HEAD'],text=True).strip()
    if revision != SYNCNET_REVISION:
        ap.error('SyncNet checkout does not match the pinned revision')
    if sha256(args.model) != MODEL_SHA256:
        ap.error('SyncNet model does not match the pinned digest')
    import numpy as np
    import torch
    torch.set_num_threads(4)
    sys.path.insert(0,str(args.syncnet_root.resolve()))
    from SyncNetInstance import SyncNetInstance
    model = SyncNetInstance(device='cpu')
    model.loadParameters(str(args.model))
    args.out.mkdir(parents=True, exist_ok=True)
    identity = {'video_sha256': sha256(args.video), 'starts':args.at,'seconds':args.seconds}
    stamp = args.out/'extraction.json'
    previous = json.loads(stamp.read_text()) if stamp.exists() else {}
    if previous.get('identity') != identity:
        # Never reuse a former visible-face window when a new file has no face.
        for stale in args.out.glob('window-*.npz'):
            stale.unlink()
        fps, rates = extract(args.video,args.at,args.seconds,args.out)
        previous = {'identity':identity,'fps':fps,'detection_rates':rates}
        stamp.write_text(json.dumps(previous,indent=2))
    results = []
    for i, at in enumerate(args.at):
        cache = args.out/f'window-{i}.npz'
        if not cache.exists():
            results.append({'at_s':at,'status':'inconclusive','reason':'no visible face'})
            continue
        data = np.load(cache)
        result = {'at_s':at, **measure(model,data['frames'],data['audio']),
                  'face_detection_rate':previous['detection_rates'][i]}
        if args.calibrate:
            calibration = []
            for delta in (-5,5):
                # Advance/delay sound by known sample counts; compare with the unshifted observation.
                sound = np.roll(data['audio'],delta*640)
                measured = measure(model,data['frames'],sound)
                error = abs((measured['offset_ms']-result['offset_ms']) + delta*40)
                calibration.append({'injected_audio_delay_ms':delta*40,**measured,'error_ms':error})
            result['calibration'] = calibration
        reliable = result['confidence'] >= 3 and result['face_detection_rate'] >= .8
        if args.calibrate:
            reliable = reliable and all(x['error_ms'] <= 40 and x['confidence']>=3 for x in result['calibration'])
        result['status'] = ('pass' if abs(result['offset_ms']) <= 40 else 'fail') if reliable else 'inconclusive'
        results.append(result)
        print(json.dumps(result),flush=True)
    span=args.speech_span or (0,float(inspect(args.video)[1]['format']['duration']))
    report = {**identity,'speech_span':span,'syncnet_revision':revision,'model_sha256':sha256(args.model),
              'analysis_resolution_ms':40,'source_frame_period_ms':1000/previous['fps'],
              'method':'sequential frame-index and decoded sample extraction',
              'calibrated_this_run':args.calibrate,'points':results,
              'status':result_status(results,args.calibrate,span)}
    (args.out/'sync-report.json').write_text(json.dumps(report,indent=2))
    return 0 if report['status']=='pass' else 2


if __name__ == '__main__':
    raise SystemExit(main())
