"""Bound each edit segment to the same picture-frame and audio-sample clock."""
import json
import hashlib
import subprocess
from pathlib import Path


def encode_args(source, destination, start, frames, fps, video_filter, source_end=None):
    if frames < 1 or fps <= 0 or start < 0:
        raise ValueError('Invalid segment clock')
    samples = round(frames * 48000 / fps)
    duration = samples / 48000
    content_samples = samples if source_end is None else min(samples,round((source_end-start)*48000))
    if content_samples <= 0:
        raise ValueError('Segment has no retained audio')
    # Input allowance permits filters to drain. Output -frames:v and -t can
    # stop the encoder before the final audio packet has been consumed.
    graph = (f'[0:v]{video_filter},trim=end_frame={frames},setpts=N/({fps}*TB)[v];'
             f'[0:a]aresample=48000,atrim=end_sample={content_samples},'
             f'apad=whole_len={samples},atrim=end_sample={samples},asetpts=N/SR/TB,'
             f'afade=t=in:st=0:d=0.012,afade=t=out:st={max(0,duration-.012):.8f}:d=0.012[a]')
    return ['ffmpeg','-y','-hide_banner','-loglevel','error','-ss',f'{start:.8f}',
            '-t',f'{duration+1:.8f}','-i',str(source),'-filter_complex',graph,
            '-map','[v]','-map','[a]','-fps_mode','passthrough','-c:v','libx264',
            '-preset','ultrafast','-crf','10','-c:a','pcm_s16le',str(destination)]


def digest(path):
    with open(path,'rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def reusable(path, recipe):
    stamp=Path(str(path)+'.clock.json')
    if not path.exists() or not stamp.exists():return False
    try:
        data=json.loads(stamp.read_text())
        if data['recipe']!=recipe or data['sha256']!=digest(path):return False
        require(path,recipe['frames'],recipe['fps'])
        return True
    except (OSError,ValueError,KeyError,subprocess.CalledProcessError):return False


def save_stamp(path,recipe):
    measured=require(path,recipe['frames'],recipe['fps'])
    Path(str(path)+'.clock.json').write_text(json.dumps({'recipe':recipe,'sha256':digest(path),'clock':measured},indent=2))


def inspect(path, fps):
    data = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_packets',
                        '-show_streams','-of','json',str(path)]))
    audio = next(s for s in data['streams'] if s['codec_type']=='audio')
    if audio['codec_name'] != 'pcm_s16le' or audio['sample_rate'] != '48000':
        raise ValueError('Segment must contain 48 kHz signed 16-bit PCM')
    frames = sum(p['codec_type']=='video' for p in data['packets'])
    samples = sum(int(p['size']) for p in data['packets'] if p['codec_type']=='audio') // (2*audio['channels'])
    expected = round(frames*48000/fps)
    result = {'video_frames':frames,'audio_samples':samples,'expected_samples':expected,
              'sample_error':samples-expected,'status':'pass' if samples==expected else 'fail'}
    return result


def require(path, frames, fps):
    result = inspect(path,fps)
    if result['status']!='pass' or result['video_frames']!=frames:
        raise ValueError(f'Segment clock mismatch: {path}: {result}; wanted {frames} frames')
    return result
