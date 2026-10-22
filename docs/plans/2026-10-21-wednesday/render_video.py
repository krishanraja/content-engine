"""Run the house renderer with bounded encoding threads for this workstation.

Only the near-lossless stage-one intermediate uses ultrafast (CRF 10 is
unchanged). Final encoding, audio processing and all house guards are unchanged.
"""
import runpy
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/quick-edit'))
import make

original_run=make.run
def bounded_run(args, **kwargs):
    args=list(args)
    if args and str(args[0])=='ffmpeg':
        args[1:1]=['-threads','6','-filter_threads','1','-filter_complex_threads','1']
        if '-crf' in args and str(args[args.index('-crf')+1])=='10' and '-preset' in args:
            args[args.index('-preset')+1]='ultrafast'
        args[-1:-1]=['-threads','6']
    return original_run(args, **kwargs)

make.run=bounded_run
if __name__=='__main__':
    make.main()
