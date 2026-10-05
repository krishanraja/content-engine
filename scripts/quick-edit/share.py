#!/usr/bin/env python3
"""Make a share copy of a finished video that fits under a size cap.

Chat uploads stop at 30 MiB, and a 2.5 minute 1080p master runs 40 to 75 MB.
This re-encodes with two-pass x264 at the bitrate the cap allows, so the copy
lands just under it. Every platform re-compresses on upload, so a share copy
at 1.5 Mbps loses nothing a viewer would see on a talking-head Short.

    python3 share.py in.mp4 out.mp4 [--cap-mib 29] [--audio-kbps 128]
"""
import argparse, json, os, subprocess, tempfile


def probe_seconds(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'json', path], capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)['format']['duration'])

def share_copy(src, dst, cap_mib=29.0, audio_kbps=128):
    """Two-pass x264 at the bitrate the cap allows. Returns what it wrote."""
    src, dst = str(src), str(dst)
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    secs = probe_seconds(src)
    budget_kbps = cap_mib * 1024 * 1024 * 8 / 1000 / secs * 0.96  # 4% for container and rate wobble
    v_kbps = int(budget_kbps - audio_kbps)
    if v_kbps < 400:
        raise SystemExit(f'cap too small: {v_kbps} kbps left for video over {secs:.1f}s')
    with tempfile.TemporaryDirectory() as tmp:
        log = os.path.join(tmp, 'pass')
        common = ['-c:v', 'libx264', '-preset', 'medium', '-b:v', f'{v_kbps}k',
                  '-maxrate', f'{int(v_kbps * 2)}k', '-bufsize', f'{int(v_kbps * 4)}k',
                  '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-passlogfile', log]
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, *common,
                        '-pass', '1', '-an', '-f', 'mp4', os.devnull], check=True)
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, *common,
                        '-pass', '2', '-c:a', 'aac', '-b:a', f'{audio_kbps}k', '-ar', '48000',
                        '-movflags', '+faststart', dst], check=True)
    size = os.path.getsize(dst) / 1024 / 1024
    if size >= cap_mib:
        raise SystemExit(f'{dst} is {size:.1f} MiB, over the {cap_mib} MiB cap')
    return {'file': dst, 'seconds': round(secs, 2), 'video_kbps': v_kbps, 'mib': round(size, 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--cap-mib', type=float, default=29.0)
    ap.add_argument('--audio-kbps', type=int, default=128)
    a = ap.parse_args()
    print(json.dumps(share_copy(a.src, a.dst, a.cap_mib, a.audio_kbps)))


if __name__ == '__main__':
    main()
