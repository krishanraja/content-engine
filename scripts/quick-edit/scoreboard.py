"""A single editorial round tally, timed on the speech clock."""
import math


def states(events,total,until=None):
    end=total if until is None else float(until)
    if not math.isfinite(end)or not 0<end<=total:raise ValueError('Invalid scoreboard end')
    rows=[];last=0.;grok=muse=0
    for e in events:
        at=e['at_s'];g,m=e['grok'],e['muse']
        if not isinstance(at,(float,int))or not math.isfinite(at)or not last<at<end:raise ValueError('Score event outside its ordered speech clock')
        if type(g)is not int or type(m)is not int or min(g,m)<0:raise ValueError('Score totals must be non-negative integers')
        if (g-grok,m-muse)not in {(1,0),(0,1)}:raise ValueError('A score event awards exactly one point')
        rows.append({'start':last,'end':at,'grok':grok,'muse':muse});last=at;grok,muse=g,m
    rows.append({'start':last,'end':end,'grok':grok,'muse':muse})
    return rows


def graph(source,target,aspect,total,config):
    rows=states(config['events'],total,config.get('until_s'))
    # Match the landscape card's content edges and optical centre.
    x,y,w,h,font=(656,24,1216,112,72)if aspect=='16x9'else(48,24,984,112,70)
    filters=[]
    for row in rows:
        start,end=row['start'],row['end'];enabled=f"gte(t,{start:.6f})*lt(t,{end:.6f})"
        text=f"GROK {row['grok']} - {row['muse']} MUSE"
        filters.extend([f"drawbox=x={x}:y={y}:w={w}:h={h}:color=0x0C1512@0.97:t=fill:enable='{enabled}'",
            f"drawbox=x={x}:y={y}:w={w//2}:h=5:color=0x79EDBE:t=fill:enable='{enabled}'",
            f"drawbox=x={x+w//2}:y={y}:w={w//2}:h=5:color=0xB6A2FF:t=fill:enable='{enabled}'",
            ])
        # Use fixed glyph sizes for the pop and settled state. Rebuilding a
        # font cache each frame is fragile in Windows FFmpeg/Freetype builds.
        text_states=[(font,enabled)]if start==0 else[(round(font*1.14),f'gte(t,{start:.6f})*lt(t,{start+.18:.6f})'),(font,f'gte(t,{start+.18:.6f})*lt(t,{end:.6f})')]
        for size,when in text_states:
            filters.append(f"drawtext=fontfile=fonts/Anton.ttf:text='{text}':fontsize={size}:fontcolor=0xF6F3EB:x='{x}+({w}-text_w)/2':y='{y}+({h}-text_h)/2':enable='{when}'")
    return [f'[{source}]'+','.join(filters)+f'[{target}]']
