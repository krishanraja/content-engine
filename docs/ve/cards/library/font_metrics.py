"""Font metrics for browser-free planning and verification."""
from PIL import ImageFont


def font_metrics(root):
    fonts=root/'assets/fonts/makeyourmindup'
    metrics={}
    def measure_face(key,f):
        charset=set(''.join(chr(v) for v in range(32,127))+'“”≤£−’×')
        metrics[key]={}
        for ch in charset:
            left,top,right,bottom=f.getbbox(ch,anchor='ls')
            mask=f.getmask(ch).getbbox()
            metrics[key][ch]=[f.getlength(ch)/256,-top/256,bottom/256,(left+(mask[0] if mask else 0))/256]
    for face,filename in [('Mono','DMMono-Regular.ttf'),('Anton','Anton-Regular.ttf'),('Fraunces','Fraunces-Upright-Variable.ttf')]:
        measure_face(face,ImageFont.truetype(str(fonts/filename),256))
    for weight in (400,500,600,800):
        f=ImageFont.truetype(str(fonts/'Fraunces-Upright-Variable.ttf'),256)
        f.set_variation_by_axes([14,weight,50,0])
        measure_face('Fraunces'+str(weight),f)
    f=ImageFont.truetype(str(root/'assets/fonts/makeyourmindup/Fraunces-Italic-Variable.ttf'),256)
    f.set_variation_by_axes([14,500,50,0])
    measure_face('FrauncesItalic500',f)
    metrics['Fraunces']=metrics['Fraunces500']
    return metrics
