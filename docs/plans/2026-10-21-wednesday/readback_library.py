"""Hash the library's actual newest downloads; never retain signed URLs."""
import concurrent.futures
import hashlib
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts'))
import engine

def main():
    w=Path(sys.argv[1]).resolve()
    result=json.loads((w/'pack-result.json').read_text(encoding='utf-8'))
    pack=Path(result['path']);manifest=json.loads((pack/'.pack.json').read_text(encoding='utf-8'))
    held=json.loads((w/'review-library-plan.json').read_text(encoding='utf-8'))
    items=[(manifest['library_prefix']+'/'+r['path'],r['sha256'],r['bytes']) for r in manifest['files']]
    for name in held['files']:
        p=Path(held['folder'])/name
        with p.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
        items.append((held['prefix']+'/'+name,digest,p.stat().st_size))
    token=engine.operator_key()
    def verify(item):
        path,digest,size=item
        status,body=engine.call('GET','/api/library/file?path='+urllib.parse.quote(path,safe=''),token=token)
        d=json.loads(body) if isinstance(body,str) else body
        assert status==200 and d.get('ok'),path
        assert d['file']['sha256']==digest and d['file']['bytes']==size,path
        url=d['download']['url'];parsed=urllib.parse.urlsplit(url)
        assert parsed.scheme=='https' and parsed.hostname.endswith('.supabase.co'),'Unexpected library download origin'
        sha=hashlib.sha256();count=0
        with urllib.request.urlopen(url,timeout=300) as response:
            while block:=response.read(1024*1024):sha.update(block);count+=len(block)
        assert sha.hexdigest()==digest and count==size,path
        print('Verified library',path,count,flush=True)
        return {'path':path,'sha256':digest,'bytes':size,'status':'pass'}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(verify,items))
    report={'release_status':'review','verified_files':rows,'scope':'Actual newest library downloads, not an assertion that the Drive runner has written them'}
    (w/'library-readback.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Library readback complete',len(rows),flush=True)

if __name__=='__main__':main()
