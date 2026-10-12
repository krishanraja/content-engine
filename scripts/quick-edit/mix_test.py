#!/usr/bin/env python3
"""The proof that the mix works: synthetic media through make.py, measured.

Everything is made here and written under .cache/quick-edit/mix-test only
(audio and video are never committed): a 20 second voice-like recording
with pauses and its words file, a looping chord as the music bed with a
stand-in licence and ledger, a synthetic sting per shape, the graphics and
the end cards. Then make.py renders three cuts and their reports are checked
against the levels in config/music-library.json:

  tall 9x16 and wide 16x9, each with the sting and the bed: the timeline adds
  up, the file is 30 fps with 48 kHz stereo sound, integrated loudness is
  -14 +-1 LUFS, true peak is at most -1 dBTP, the bed sits at its intro,
  voice and outro levels, the gap under the voice is about 17 LU, and the
  tall logo pill shows only after the sting;

  tall 9x16 as things stand today (the sting a candidate, no approved track):
  no intro, voice only, and the report says why, at the same loudness.

    python mix_test.py            prints the measured numbers, exits 1 on a miss
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import intro  # noqa: E402
import music  # noqa: E402

REPO = HERE.parents[1]
WORK = REPO / '.cache' / 'quick-edit' / 'mix-test'
LILAC, MINT, INK = (0xB7, 0xA6, 0xFF), (0x7E, 0xF0, 0xC0), (0x0C, 0x15, 0x12)
TEXT = ('this is a test of the music under the voice and it should sit low while I am talking '
        'then rise again when I stop so the end card has music behind it and the intro is loud '
        'before my face comes in and the whole thing lands at minus fourteen').split()


def ff(*args):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *map(str, args)], check=True)


def words():
    """Word times like a person talking: 0.32 s words, short gaps, a breath
    every six words, and one long pause make.py will tighten."""
    out, t = [], 0.3
    for n, w in enumerate(TEXT):
        out.append({'w': w, 's': round(t, 3), 'e': round(t + 0.32, 3)})
        t += 0.32 + (0.28 if n % 6 == 5 else 0.1)
        if n == 17:
            t += 0.9
    return out


def make_media():
    shutil.rmtree(WORK, ignore_errors=True)
    (WORK / 'music' / 'licences').mkdir(parents=True)
    ws = words()
    dur = round(ws[-1]['e'] + 0.6, 2)
    (WORK / 'words.json').write_text(json.dumps({'duration': dur, 'words': ws}))
    # The voice: a buzzy tone with its harmonics plus breath noise, shaped
    # into syllables, sounding only inside the words.
    on = '+'.join(f"between(t,{w['s']},{w['e']})" for w in ws)
    ff('-f', 'lavfi', '-i', f"aevalsrc='0.5*sin(2*PI*140*t)+0.3*sin(2*PI*280*t)+0.2*sin(2*PI*420*t)+0.1*sin(2*PI*1120*t)':s=48000:d={dur}",
       '-f', 'lavfi', '-i', f'anoisesrc=color=pink:amplitude=0.25:seed=7:d={dur}:r=48000',
       '-filter_complex', f"[1]bandpass=f=1800:width_type=o:w=2[n];[0][n]amix=inputs=2:normalize=0,asetnsamples=n=240:p=0,"
                          f"volume='if({on},0.55+0.45*sin(2*PI*5.5*t),0)':eval=frame,lowpass=f=6000[a]",
       '-map', '[a]', '-ac', '1', WORK / 'voice.wav')
    ff('-f', 'lavfi', '-i', f'testsrc2=s=720x1280:r=30:d={dur}', '-i', WORK / 'voice.wav', '-c:v', 'libx264', '-preset', 'ultrafast',
       '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', WORK / 'source.mp4')
    # The bed: a chord with a slow swell, 12 s, looping cleanly.
    notes = (130.81, 261.63, 329.63, 392.0, 523.25)
    ff(*[x for f in notes for x in ('-f', 'lavfi', '-i', f'sine=f={f}:d=12:r=48000')],
       '-filter_complex', f'{"".join(f"[{i}]" for i in range(len(notes)))}amix=inputs={len(notes)}:normalize=0,'
                          "volume='0.35*(0.8+0.2*sin(2*PI*t/3))':eval=frame,aformat=channel_layouts=stereo",
       WORK / 'music' / 'chord-loop.wav')
    (WORK / 'music' / 'licences' / 'chord-loop.txt').write_text('stand-in licence for the mix test, not a real one\n')
    # Graphics.
    from PIL import Image, ImageDraw
    Image.new('RGBA', (1080, 1000), LILAC + (255,)).save(WORK / 'panel-9x16.png')
    Image.new('RGBA', (1314, 1080), LILAC + (255,)).save(WORK / 'panel-16x9.png')
    frame = Image.new('RGBA', (1920, 1080), INK + (255,))
    ImageDraw.Draw(frame).rectangle((0, 0, 200, 1080), fill=MINT + (255,))
    frame.save(WORK / 'frame16.png')
    logo = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0))
    ImageDraw.Draw(logo).rounded_rectangle((320, 50, 760, 225), radius=22, fill=MINT + (255,))
    logo.save(WORK / 'logo.png')
    for asp, size in (('9x16', '1080x1920'), ('16x9', '1920x1080')):
        ff('-f', 'lavfi', '-i', f'color=c=0x0C1512:s={size}:r=30:d=4', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '4',
           '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', WORK / f'end-{asp}.mp4')
    # A synthetic sting per shape, through intro.py's own finishing path.
    ff('-f', 'lavfi', '-i', 'color=c=0xB7A6FF:s=540x960:r=30:d=1.5', '-vf', "drawbox=x='t*200':y=400:w=100:h=100:color=0x0C1512:t=fill",
       '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', WORK / 'sting-src.mp4')
    for asp in intro.SHAPES:
        intro.finish(WORK / 'sting-src.mp4', WORK / f'sting-{asp}.mp4', asp, 1.5)
    # The stand-in ledger: the committed one's levels, one approved track.
    ledger = json.loads(music.LEDGER.read_text(encoding='utf-8'))
    facts = music.measure(WORK / 'music' / 'chord-loop.wav')
    ledger['tracks'] = [{
        'id': 'mix-test-chord', 'title': 'Mix test chord', 'artist': 'ffmpeg', 'provider': 'mix test', 'provider_track_id': None,
        'provider_url': None, 'licence_type': 'stand-in', 'licence_id': 'MIX-TEST', 'licensee': 'nobody', 'licence_file': 'licences/chord-loop.txt',
        'acquired_on': '2026-10-01', 'expires_on': None, 'platforms': list(music.PLATFORMS), 'monetisation_ok': True, 'content_id_cleared': True,
        'attribution': None, 'restrictions': 'test only', 'file': 'chord-loop.wav', **facts, 'intro_cue_s': 0.0, 'outro_cue_s': None,
        'mood': 'steady', 'status': 'approved', 'approved_by': 'Krish', 'approved_on': '2026-10-12',
        'approval_words': 'synthetic mix test track, not a real approval', 'loopable': True}]
    (WORK / 'music-library.json').write_text(json.dumps(ledger, indent=2))
    cue = {'id': 'panel', 'panel': 'panel-{aspect}.png', 'start': 'then rise again', 'end': 'behind it'}
    base = {'source': 'source.mp4', 'words': 'words.json', 'crop': [720, 1280, 0, 0], 'cues': [cue], 'frame16': 'frame16.png',
            'endcard': {'9x16': 'end-9x16.mp4', '16x9': 'end-16x9.mp4'}, 'logo': {'png': 'logo.png'}, 'subject': 'Mix test', 'piece_id': 'mix-test'}
    (WORK / 'full.json').write_text(json.dumps({**base, 'name': 'full', 'intro': {'9x16': 'sting-9x16.mp4', '16x9': 'sting-16x9.mp4'}}))
    (WORK / 'today.json').write_text(json.dumps({**base, 'name': 'today'}))
    return ledger['levels']


def render(config, out, shape, env):
    p = subprocess.run([sys.executable, str(HERE / 'make.py'), str(WORK / config), '--out', str(WORK / out), '--only', shape],
                       capture_output=True, text=True, env=env)
    if p.returncode:
        raise SystemExit(f'make.py failed on {config} {shape}:\n{p.stderr[-3000:]}')
    return json.loads((WORK / out / f'{Path(config).stem}.report.json').read_text())


def probe(path):
    data = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-show_entries',
                                      'stream=codec_type,r_frame_rate,nb_read_packets,sample_rate,channels:format=duration',
                                      '-of', 'json', str(path)], capture_output=True, text=True, check=True).stdout)
    v = next(s for s in data['streams'] if s['codec_type'] == 'video')
    a = next(s for s in data['streams'] if s['codec_type'] == 'audio')
    return {'fps': v['r_frame_rate'], 'frames': int(v['nb_read_packets']), 'rate': int(a['sample_rate']), 'channels': a['channels'],
            'seconds': float(data['format']['duration'])}


def pixel(path, t, xy):
    from PIL import Image
    png = WORK / 'pixel.png'
    ff('-ss', f'{t:.3f}', '-i', path, '-frames:v', '1', png)
    return Image.open(png).convert('RGB').getpixel(xy)


def near(rgb, want, tol=40):
    return all(abs(a - b) <= tol for a, b in zip(rgb, want))


def main():
    levels = make_media()
    env = {**os.environ, 'MINDMAKE_MUSIC_ROOT': str(WORK / 'music'), 'MINDMAKE_MUSIC_LEDGER': str(WORK / 'music-library.json')}
    today_env = {k: v for k, v in os.environ.items() if k not in ('MINDMAKE_MUSIC_ROOT', 'MINDMAKE_MUSIC_LEDGER')}
    checks, table = [], []
    tol = levels['tolerance_lu']
    for shape, out in (('9x16', 'tall'), ('16x9', 'wide')):
        r = render('full.json', out, shape, env)
        L = r['loudness']
        final = WORK / out / r['shapes'][shape]['file']
        info = probe(final)
        table.append((f'{shape} with sting and bed', r['total_seconds'], L))
        checks += [
            (f'{shape}: the sting is 1.5 s and the clock adds up', (r['intro_seconds'], round(r['intro_seconds'] + r['main_seconds'] + r['outro_seconds'], 3)),
             (1.5, r['total_seconds'])),
            (f'{shape}: 30 fps, every frame there, 48 kHz stereo', (info['fps'], abs(info['frames'] - round(r['total_seconds'] * 30)) <= 1, info['rate'], info['channels']),
             ('30/1', True, 48000, 2)),
            (f'{shape}: the file is as long as the clock', abs(info['seconds'] - r['total_seconds']) <= 0.05, True),
            (f'{shape}: the bed is the approved track', r['music'] and r['music']['track_id'], 'mix-test-chord'),
            (f'{shape}: the final pass was a plain gain', L['normalisation'], 'linear'),
            (f'{shape}: integrated {L["integrated"]} LUFS is -14 +-{tol}', abs(L['integrated'] - levels['final_integrated_lufs']) <= tol, True),
            (f'{shape}: true peak {L["true_peak"]} dBTP is at most {levels["max_true_peak_dbtp"]}', L['true_peak'] <= levels['max_true_peak_dbtp'], True),
            (f'{shape}: the intro {L["intro_short_term"]} LUFS is about {levels["intro_lufs"]}', abs(L['intro_short_term'] - levels['intro_lufs']) <= 1.5, True),
            (f'{shape}: the voice {L["voice_short_term"]} LUFS is about {levels["final_integrated_lufs"]}',
             abs(L['voice_short_term'] - levels['final_integrated_lufs']) <= 1.5, True),
            (f'{shape}: the outro {L["outro_short_term"]} LUFS is about {levels["outro_lufs"]}', abs(L['outro_short_term'] - levels['outro_lufs']) <= 1.5, True),
            (f'{shape}: the bed sits {L["bed_to_voice_lu"]} LU under the voice, about {levels["final_integrated_lufs"] - levels["bed_lufs"]:g}',
             abs(L['bed_to_voice_lu'] - (levels['final_integrated_lufs'] - levels['bed_lufs'])) <= 1.5, True),
            (f'{shape}: a preview in the sting and the old ones moved on', all((WORK / out / f'preview-{shape}-{n}.jpg').exists() for n in ('intro', '00', '01', '02')), True),
            (f'{shape}: the sting is the first thing on screen', near(pixel(final, 0.5, (intro.SHAPES[shape][0] // 2, intro.SHAPES[shape][1] // 2)), LILAC), True),
        ]
        if shape == '9x16':
            I = r['intro_seconds']
            checks += [
                ('9x16: no logo pill over the sting', near(pixel(final, I - 0.3, (540, 140)), MINT), False),
                ('9x16: the logo pill shows as his face comes in', near(pixel(final, I + 1.0, (540, 140)), MINT), True),
                ('9x16: and is gone by 3 s into the main, as before', near(pixel(final, I + 3.3, (540, 140)), MINT), False),
            ]
    r = render('today.json', 'today', '9x16', today_env)
    L = r['loudness']
    table.append(('9x16 as today, voice only', r['total_seconds'], L))
    checks += [
        ('today: no sting while it is a candidate, and the report says why', (r['intro_seconds'], any('candidate' in w for w in r['warnings'])),
         (0.0, intro.load()['status'] == 'candidate')),
        ('today: no music without an approved track, and the report says why', (r['music'], any('voice only' in w for w in r['warnings'])), (None, True)),
        (f'today: integrated {L["integrated"]} LUFS is -14 +-{tol}', abs(L['integrated'] - levels['final_integrated_lufs']) <= tol, True),
        (f'today: true peak {L["true_peak"]} dBTP is at most {levels["max_true_peak_dbtp"]}', L['true_peak'] <= levels['max_true_peak_dbtp'], True),
    ]
    print(f'{"cut":28} {"secs":>6} {"integ":>6} {"peak":>6} {"intro":>6} {"voice":>6} {"outro":>6} {"gap":>5}')
    for name, secs, L in table:
        cells = [L[k] for k in ('integrated', 'true_peak', 'intro_short_term', 'voice_short_term', 'outro_short_term', 'bed_to_voice_lu')]
        print(f'{name:28} {secs:6.2f} ' + ' '.join(f'{c:6.1f}' if c is not None else f'{"-":>6}' for c in cells))
    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'mix test passed: {len(checks)} checks')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
