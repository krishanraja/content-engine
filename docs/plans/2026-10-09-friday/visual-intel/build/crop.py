"""Crop a PNG into a review image: python3 -I crop.py IN.png OUT.png top bottom [left right]"""
import sys
from PIL import Image
im = Image.open(sys.argv[1])
t, b = int(sys.argv[3]), int(sys.argv[4])
l = int(sys.argv[5]) if len(sys.argv) > 5 else 0
r = int(sys.argv[6]) if len(sys.argv) > 6 else im.width
im.crop((l, t, r, b)).save(sys.argv[2])
print(im.size)
