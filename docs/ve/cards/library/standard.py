"""Shared artwork gates. Optional raster spans replace fitted SVG widths on the host."""
from collections import defaultdict
from math import ceil, floor
from xml.etree import ElementTree as ET


CHARTS = {'video-vertical-chart', 'video-wide-chart', 'carousel-chart',
          'social-number', 'newsletter-figure-chart'}
VIDEO_DOCUMENTS = {'video-vertical-'+kind for kind in ('document','quote','split','pip','plate')} | {
    'video-wide-document', 'video-wide-quote', 'video-wide-side-by-side'}


def threshold_crop(root):
    """Locate the original screenshot's '30' in the composed evidence, in frame pixels."""
    for crop in root.findall(".//svg[@data-evidence-ink]"):
        sx, sy, sw, sh = map(float, crop.get('viewBox').split())
        if sx <= 576 and sx+sw >= 624 and sy <= 1047 and sy+sh >= 1081:
            scale = float(crop.get('width'))/sw
            x, y = float(crop.get('x')), float(crop.get('y'))
            return ((floor(x+(576-sx)*scale), floor(y+(1047-sy)*scale),
                     ceil(x+(624-sx)*scale), ceil(y+(1081-sy)*scale)), scale)
    return None


def audit(item, markup, painted=None, raster=None, templates=None):
    root = ET.fromstring('<svg>'+markup+'</svg>')
    # Browser innerHTML may carry explicit SVG namespaces.
    for el in root.iter():
        el.tag = el.tag.split('}')[-1]
    unit = item['width']/1080
    findings = []
    headlines = defaultdict(list)
    headline_owners = {}
    signatures = []
    families = defaultdict(set)
    for el in root.iter():
        key = el.get('data-align-name')
        if el.tag == 'use':
            signatures.append(el.get('href','').lstrip('#'))
        if el.get('data-evidence-ink') and float(el.get('data-evidence-ink')) < 33*unit-.01:
            findings.append('11: document lettering below the source floor')
        if el.tag != 'text' or not key:
            continue
        face = el.get('font-family')
        size = float(el.get('font-size'))
        text = ''.join(el.itertext())
        if text.lower() != 'makeyourmindup.ai' and size < 33*unit-.02:
            findings.append('3: '+key+' below the reading floor')
        if face == 'Fraunces' and el.get('data-slot') and item['slots'].get(key, {}).get('role')=='body':
            display = (item['layout'] in ('desktop','mobile') and key=='body_1'
                       or item['archetype']==4 and key=='body_2' and el.get('font-style')=='italic'
                       or text=='Follow for more')
            if not display and not 36*unit-.02 <= size <= 44*unit+.02:
                findings.append('3: '+key+' outside the 36 to 44 px supporting range')
        if 'data-slot' in el.attrib:
            families[key].add(face)
            families[key].update(span.get('font-family') for span in el.iter('tspan') if span.get('font-family'))
        if face != 'Anton' or not el.get('data-bounds'):
            continue
        headline_owners[key] = (templates or {}).get(el.get('data-template'), item)
        measure = float(el.get('data-bounds').split()[2])
        width = float(el.get('data-ink-width'))
        index = len(headlines[key])
        if painted is not None and key in painted and index < len(painted[key]):
            width = painted[key][index][0]
        headlines[key].append((float(el.get('y')),size,width/measure))
        if float(el.get('letter-spacing',0)) != 0:
            findings.append('2: tracking on '+key)
    for key,faces in families.items():
        if len(faces)>1:
            findings.append('1: mixed faces in '+key)
    for key,rows in headlines.items():
        if len(rows)>3 or max(row[2] for row in rows)<.70:
            findings.append('2: '+key+' exceeds three lines or occupies less than 70% of its reading column')
        if (item.get('colour_aperture') and (item['layout'].startswith('why-') or item['layout']=='rail')
                and max(row[2] for row in rows)<.92):
            findings.append('2: question occupies less than 92% of the reading column')
        owner = headline_owners[key]
        rule = owner['slots'].get(key, {})
        tight = owner.get('colour_aperture') or rule.get('payoff_line') or rule.get('tight_leading')
        for first,second in zip(rows,rows[1:]):
            leading = (second[0]-first[0])/first[1]
            if (tight and not .90-.0001<=leading<=.95+.0001) or (not tight and abs(leading-1)>.0001):
                findings.append('2: '+key+' outside its approved leading')
    if 's3h' in signatures and 'd' in signatures:
        findings.append('6: separate D with S3h')
    if sum(m in ('v4','s3h','v9') for m in signatures)>1:
        findings.append('6: multiple wordmarks')
    for el in root.iter('use'):
        name = el.get('data-align-name')
        if name=='s3h' and 'signature_column' in item:
            minimum = .60*item['signature_column'][1]
            width = float(el.get('width'))*645/700
        elif name=='v4' and headlines and item['archetype']!=8:
            measure=max(float(t.get('data-bounds').split()[2]) for t in root.iter('text') if t.get('font-family')=='Anton' and t.get('data-bounds'))
            minimum = .40*measure
            width = float(el.get('width'))
        else:
            continue
        if painted and name in painted:
            width = painted[name][0][0]
        if width+.01<minimum:
            findings.append('6: '+name+' below its minimum ink width')
    for el in root.iter('g'):
        if el.get('data-align-name')!='source logo':
            continue
        image=el.find('image')
        height=float(image.get('height')) if image is not None else 0
        if painted and 'source logo' in painted:
            height=painted['source logo'][0][1]
        if height+.01<56*unit or image is None:
            findings.append('5: company mark below its minimum or missing its source silhouette')
    zones = item['safe_zones']
    if any('stroke-dasharray' in el.attrib for el in root.iter()):
        findings.append('dashed guide in an item export')
    if item['id'] in VIDEO_DOCUMENTS:
        left, _, width, _ = zones['content_box']
        paper = root.find('.//rect[@data-document-paper]')
        crop = threshold_crop(root)
        if item['layout'] in ('split', 'pip', 'plate'):
            width = item['width']-2*left
        elif item['id']=='video-wide-side-by-side':
            right = left+width
            face_x, _, face_w, _ = zones['footage']
            left = face_x+face_w+32
            width = right-left
        if (paper is None or abs(float(paper.get('width'))-width)>.1
                or abs(float(paper.get('x'))-left)>.1):
            findings.append('11: evidence misses its full reading column')
        fragments = root.findall(".//svg[@data-evidence-ink]")
        if fragments:
            right_edge = max(float(el.get('x'))+float(el.get('width')) for el in fragments)
            left_edge = min(float(el.get('x')) for el in fragments)
            if (right_edge-left_edge < width-32*unit-.1
                    or any(el.find('image') is None or
                           not el.find('image').get('href','').endswith('/m-spotify.png')
                           for el in fragments)):
                findings.append('11: source pixels fail to fill the document measure')
        if crop is None:
            findings.append('11: missing threshold from the source screenshot')
        else:
            bounds, scale = crop
            if raster is None:
                digits = 29*scale  # Painted height of 30 in the 1080-wide Spotify capture.
            else:
                mask = raster.crop(bounds).convert('L').point(lambda v: 255 if v<112 else 0)
                box = mask.getbbox()
                digits = box[3]-box[1] if box else 0
            if digits < 33*unit:
                findings.append('11: painted threshold below the reading floor')
    if item['id']=='carousel-howto-step' and raster is not None:
        sample = threshold_crop(root)
        if sample:
            mask = raster.crop(sample[0]).convert('L').point(lambda v: 255 if v<112 else 0)
            box = mask.getbbox()
            if box is None or box[3]-box[1]<33*unit:
                findings.append('11: unreadable threshold in the how-to screenshot')
    if item['id'] in CHARTS:
        bar = root.find(".//g[@data-layer='scale']/rect[@fill='#FFD84D']")
        headline = root.find(".//text[@data-slot='headline_1']")
        if bar is None or float(bar.get('height')) < zones['content_box'][3]*.25:
            findings.append('chart bar below a quarter of the content zone')
        if headline is None or headline.get('font-family')!='Anton' or '30' not in (headline.text or ''):
            findings.append('missing Anton threshold headline')
        for key in ('0 s','10 s','20 s','threshold tick'):
            tick = root.find(f".//text[@data-align-name='{key}']")
            if (tick is None or float(tick.get('font-size'))<33*unit
                    or (painted is not None and painted.get(key, [(0,0)])[0][1]<33*unit)):
                findings.append('3: axis label below the reading floor')
    if item['layout']=='banner' or item['id']=='profile-youtube-endscreen':
        safe = zones.get('safe', {}).get('all_devices', zones['content_box'])
        mark = root.find(".//use[@data-align-name='s3h']")
        mark_h = float(mark.get('height'))*631/700 if mark is not None else 0
        if painted is not None:
            mark_h = painted.get('s3h', [(0,0)])[0][1]
        if mark_h < .60*safe[3]:
            findings.append('6: signature below 60% of safe-area height')
        colours = ('#FF6A4D','#FFD84D','#B7A6FF','#7EF0C0')
        bars = [el for el in root.iter('rect') if el.get('fill') in colours]
        if ([el.get('fill') for el in bars]!=list(colours)
                or float(bars[-1].get('height'))<.9*mark_h):
            findings.append('missing full-size colour steps beside S3h')
        elif mark is not None:
            x, y, w, h = safe
            mark_right = float(mark.get('x'))+float(mark.get('width'))*671/700
            start = float(bars[0].get('x'))
            step_w = float(bars[0].get('width'))
            baseline = float(bars[-1].get('y'))+float(bars[-1].get('height'))
            if (start < max(x,mark_right) or start+4*step_w>x+w+.1 or baseline>y+h+.1
                    or float(bars[-1].get('y'))<y-.1):
                findings.append('colour steps outside their safe column')
            for n,bar in enumerate(bars,1):
                bx,by,bw,bh = (float(bar.get(key)) for key in ('x','y','width','height'))
                if (abs(bx-start-(n-1)*step_w)>.1 or abs(bw-step_w)>.1
                        or abs(by+bh-baseline)>.1 or abs(bh-float(bars[-1].get('height'))*n/4)>.1):
                    findings.append('uneven colour steps')
        if item['id']=='profile-youtube-endscreen':
            cta = root.find(".//text[@data-slot='body_1']")
            if (cta is None or float(cta.get('font-size')) < 33*unit
                    or (painted is not None and painted.get('body_1', [(0,0)])[0][1]<33*unit)):
                findings.append('3: end screen invitation below the reading floor')
    return list(dict.fromkeys(findings))
