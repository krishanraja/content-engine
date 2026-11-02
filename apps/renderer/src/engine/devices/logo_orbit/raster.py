"""Local SVG pixel probe for the device regression tests (system librsvg + Pillow)."""
import ctypes as C
import ctypes.util
import io
import json
import sys
from PIL import Image
r = C.CDLL(ctypes.util.find_library('rsvg-2'))
c = C.CDLL(ctypes.util.find_library('cairo'))
def bind(lib, name, args, result):
    fn = getattr(lib, name); fn.argtypes = args; fn.restype = result; return fn
ptr = C.c_void_p
svg = sys.stdin.buffer.read()
handle = bind(r, 'rsvg_handle_new_from_data', [C.c_char_p, C.c_size_t, ptr], ptr)(svg, len(svg), None)
class Dimensions(C.Structure):
    _fields_ = [('width', C.c_int), ('height', C.c_int), ('em', C.c_double), ('ex', C.c_double)]
d = Dimensions()
bind(r, 'rsvg_handle_get_dimensions', [ptr, C.POINTER(Dimensions)], None)(handle, C.byref(d))
surface = bind(c, 'cairo_image_surface_create', [C.c_int, C.c_int, C.c_int], ptr)(0, d.width, d.height)
ctx = bind(c, 'cairo_create', [ptr], ptr)(surface)
assert bind(r, 'rsvg_handle_render_cairo', [ptr, ptr], C.c_int)(handle, ctx)
bind(c, 'cairo_surface_flush', [ptr], None)(surface)
stride = bind(c, 'cairo_image_surface_get_stride', [ptr], C.c_int)(surface)
data = bind(c, 'cairo_image_surface_get_data', [ptr], ptr)(surface)
im = Image.frombytes('RGBA', (d.width, d.height), C.string_at(data, stride*d.height), 'raw', 'BGRA', stride)
print(json.dumps({'bbox': im.getbbox(), 'size': im.size, 'pixels': [im.getpixel(tuple(map(int, xy.split(',')))) for xy in sys.argv[1:]]}))
bind(c, 'cairo_destroy', [ptr], None)(ctx)
bind(c, 'cairo_surface_destroy', [ptr], None)(surface)
