# Renders the report pages with the proving lines highlighted. First fetch the report (never committed):
#   curl -sSL -o report.pdf "https://www-cdn.anthropic.com/72628f1863c53432195db83279252dfd2cb53158/Employment%20at%20Anthropic.pdf"
# then run from this folder: python3 hl.py
import subprocess,re,sys
from PIL import Image,ImageDraw
pdf='report.pdf'; DPI=110
jobs=[(1,None,'report-cover'),(3,'The proportion of junior technical hires fell even faster, from 27% to 9%','report-27-9'),
(2,'By August interactive AI agent hours outnumbered employees','report-6-1'),
(3,'Around a third of ML and a fifth of SWE managers reported hiring less due to AI','report-managers'),
(16,'removed from the object-level work that originally built their skills','report-object-level'),
(18,'will not benefit those not hired to begin with','report-not-hired'),
(2,'Hiring managers increasingly emphasize applicants','report-judgment'),
(10,'75% of their work','report-75')]
for page,phrase,name in jobs:
    subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-r',str(DPI),'-png','-singlefile',pdf,name],check=True)
    im=Image.open(name+'.png').convert('RGB')
    if phrase:
        html=subprocess.run(['pdftotext','-f',str(page),'-l',str(page),'-bbox',pdf,'-'],capture_output=True,text=True).stdout
        words=[(float(a),float(b),float(c),float(d),w) for a,b,c,d,w in re.findall(r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<',html)]
        target=phrase.split(); n=len(target); norm=lambda s:re.sub(r'\W','',s.lower())
        hit=None
        for i in range(len(words)-n+1):
            if all(norm(words[i+k][4])==norm(target[k]) for k in range(n)): hit=words[i:i+n];break
        if not hit: print('NOT FOUND',name); 
        else:
            ov=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(ov);s=DPI/72
            for a,b,c,e,w in hit: d.rectangle([a*s-2,b*s-1,c*s+2,e*s+1],fill=(255,216,77,120))
            im=Image.alpha_composite(im.convert('RGBA'),ov).convert('RGB')
            ys=[w[1] for w in hit]; cy=int(sum(ys)/len(ys)*s)
            im=im.crop((0,max(0,cy-260),im.width,min(im.height,cy+260)))
    im.save(name+'.jpg',quality=88); print('ok',name,im.size)
