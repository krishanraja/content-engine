"""Apply the corroborated caption correction without re-encoding the long video.

The long cut does not burn captions. Its speech, timing, source transcript and
signed-off script remain unchanged. Future renders use the same replacement
in configure_edits.py. Other uncertain passages remain explicitly unverified.
"""
import hashlib
import json
import re
from prepare_video import WORK, PLAN

folder=WORK/'long'
report=folder/'why-ai-prices-keep-changing-long.report.json'
if not report.is_file():
    raise SystemExit('Wait for the completed long render.')
receipts=[]
for suffix in ['-16x9.srt','.cut.txt']:
    path=folder/f'why-ai-prices-keep-changing-long{suffix}'
    before=path.read_text(encoding='utf-8')
    after,count=re.subn(r'and lesser price','unless a price',before)
    if count != 1 and 'unless a price' not in before:
        raise SystemExit(f'Expected correction absent from {path.name}; inspect before editing.')
    path.write_text(after,encoding='utf-8')
    receipts.append({'file':path.name,'changes':count,
                     'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(PLAN/'caption-review.json').write_text(json.dumps({
    'method':'Second local small.en ASR pass on source excerpts; not manual listening',
    'correction':'and lesser price -> unless a price',
    'source_excerpt_seconds':[252,262],
    'files':receipts,
    'listening_still_required':[
        {'source_seconds':[82,94],'issue':'four batch / twenty batch phrasing'},
        {'source_seconds':[157,167],'issue':'bill/build down and spoken self-correction'},
        {'source_seconds':[331,340],'issue':'where you work / way work phrase'}],
},indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipts,indent=2))
