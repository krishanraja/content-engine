"""Prove every camera warp has a constant rigid crop and covered borders."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np

def digest(path):
    with path.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()

ap=argparse.ArgumentParser();ap.add_argument('folder',type=Path);a=ap.parse_args();p=a.folder
receipt=json.loads((p/'stabilisation.json').read_text(encoding='utf-8'))
assert receipt['output_sha256']==digest(p/'camera-stable.mkv')
warps=np.load(p/'camera-path.npz')['warps'];assert len(warps)==receipt['frame_count']
if receipt.get('camera_path_sha256'):assert receipt['camera_path_sha256']==digest(p/'camera-path.npz')
linear=warps[:,:2,:2];gram=linear.transpose(0,2,1)@linear
assert np.allclose(gram,np.eye(2)[None]*receipt['static_zoom']**2,atol=1e-7),'Warp introduced non-rigid deformation or variable zoom'
det=np.linalg.det(linear);assert np.all(det>0)
corners=np.array([[0,0],[1079,0],[0,1919],[1079,1919]])
delta=corners[None]-warps[:,None,:2,2]
x=(linear[:,None,1,1]*delta[:,:,0]-linear[:,None,0,1]*delta[:,:,1])/det[:,None]
y=(-linear[:,None,1,0]*delta[:,:,0]+linear[:,None,0,0]*delta[:,:,1])/det[:,None]
assert x.min()>=-.001 and x.max()<=1079.001 and y.min()>=-.001 and y.max()<=1919.001,'Exposed output border'
result={'status':'pass','source_sha256':receipt['source_sha256'],'camera_sha256':receipt['output_sha256'],
    'camera_path_sha256':digest(p/'camera-path.npz'),'frames_checked':len(warps),'constant_zoom':receipt['static_zoom'],
    'rigid_transform_only':True,'all_output_corners_covered':True,
    'scope':'All mathematical warp matrices; sampled final pictures are reviewed separately'}
(p/'geometry-review.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result),flush=True)
