"""Use the native compositor with the measured camera-only stabilisation."""
import argparse
from pathlib import Path

from render_visual_revision import prepare,render

ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('cut',choices=['long','short']);ap.add_argument('--preview',action='store_true');ap.add_argument('--prepare',action='store_true');ap.add_argument('--verify-existing',action='store_true');a=ap.parse_args();w=a.work.resolve()
if a.prepare:prepare(w,a.cut,suffix='stable',card_folder='cards-stable')
else:render(w,a.cut,a.preview,camera=w/f'stability-{a.cut}/full/camera-stable.mkv',
       output_folder=f'render-{a.cut}-stable',accepted_folder=f'render-{a.cut}-revised',profile_folder=f'kit-{a.cut}-stable',existing=a.verify_existing)
