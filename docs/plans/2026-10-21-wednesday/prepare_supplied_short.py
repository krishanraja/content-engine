"""Apply the retained speech windows to Krish's supplied stabilised take."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/quick-edit'))
import make
import segment_clock


def main():
    w=Path(sys.argv[1]).resolve();source=w/'sources/user-stabilized-short.mp4'
    out=w/'supplied-short';parts=out/'parts';parts.mkdir(parents=True,exist_ok=True)
    expected='86ab5f6367d9f63350595949799cff8e7653b9b18be83f35e13566704ebb8cd3'
    assert segment_clock.digest(source)==expected,'Supplied replacement changed'
    rate=make.source_rate(source);conform=make.conform_filter(rate,24)
    rows=[];listing=[]
    for i,line in enumerate((w/'render-short/stage1.plan').read_text().splitlines()[1:]):
        a,b,end,crop=re.fullmatch(r'([\d.]+) ([\d.]+) source_end=(None|[\d.]+) crop=([\d:]+)',line).groups()
        a,b=float(a),float(b);frames=round((b-a)*24);path=parts/f'{i:03d}.mkv'
        recipe={'source_sha256':expected,'start':a,'frames':frames,'fps':24,'video_filter':f'crop={crop},{conform}','source_end':None if end=='None'else float(end)}
        if not segment_clock.reusable(path,recipe):
            args=segment_clock.encode_args(source,path,a,frames,24,recipe['video_filter'],source_end=recipe['source_end'])
            args[args.index('-i'):args.index('-i')]=['-threads','2']
            args[-1:-1]=['-threads','4','-filter_complex_threads','1']
            subprocess.run(args,check=True);segment_clock.save_stamp(path,recipe)
        rows.append(recipe);listing.append(f"file '{path.as_posix()}'")
        print(f'Prepared supplied camera segment {i+1}',flush=True)
    joined=out/'camera.mkv';manifest=parts/'list.txt';manifest.write_text('\n'.join(listing)+'\n')
    subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-f','concat','-safe','0','-i',str(manifest),'-c','copy',str(joined)],check=True)
    frames=sum(r['frames']for r in rows);assert frames==2145;segment_clock.require(joined,frames,24)
    evidence={'method':'User-supplied auto-stabilised original; retained native speech windows, no additional stabilisation',
        'supplied_recording_sha256':expected,'original_recording_sha256':'012c82c8efe059e5d88528ef321a3589dd225a53480a5146ca2180328db15cd4',
        'output_sha256':segment_clock.digest(joined),'frame_count':frames,'source_rate':rate,'conform':conform,'segments':rows,
        'review_status':'not_run; this is preparation, not perceptual acceptance'}
    (out/'source-replacement.json').write_text(json.dumps(evidence,indent=2),encoding='utf-8')
    print(json.dumps({'camera':str(joined),'frames':frames,'sha256':evidence['output_sha256']}),flush=True)


if __name__=='__main__':main()
