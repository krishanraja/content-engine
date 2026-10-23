"""Stage approved Wednesday cuts at their final library destinations."""

import json
import os
import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
import quality


def main():
    work = Path(sys.argv[1]).resolve()
    result = json.loads((work / 'pack-result.json').read_text(encoding='utf-8'))
    prefix = f'3 Posts/{result["folder"]}/3 Video'
    output = work / 'delivery-media'
    output.mkdir(exist_ok=True)
    staged = []
    for cut, shape, name in [
        ('long', '16x9', 'Muse vs Grok Bot - wide 16x9 - YouTube, Substack'),
        ('short', '9x16', 'Muse vs Grok Bot - tall 9x16 - Shorts, Reels, TikTok, LinkedIn'),
    ]:
        video = work / f'render-{cut}-narrative' / f'muse-vs-grok-{cut}-{shape}.mp4'
        source_receipt = Path(str(video) + '.validation.json')
        target = output / f'{name}.mp4'
        if target.exists():
            assert quality.digest(target) == quality.digest(video)
        else:
            try:
                os.link(video, target)
            except OSError:
                shutil.copy2(video, target)
        receipt = json.loads(source_receipt.read_text(encoding='utf-8'))
        receipt['library_path'] = f'{prefix}/{target.name}'
        target_receipt = Path(str(target) + '.validation.json')
        target_receipt.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        assert not quality.delivery_problems(target, target_receipt, receipt['library_path'])
        source_srt = video.with_suffix('.srt')
        if source_srt.is_file():
            shutil.copy2(source_srt, output / f'{name}.srt')
        staged.append({'name': target.name, 'sha256': receipt['video_sha256'],
                       'receipt': target_receipt.name, 'library_path': receipt['library_path']})
    (work / 'delivery-library-plan.json').write_text(
        json.dumps({'folder': str(output), 'prefix': prefix, 'files': staged}, indent=2) + '\n',
        encoding='utf-8')
    print(json.dumps({'ready_cuts': len(staged), 'library_prefix': prefix}))


if __name__ == '__main__':
    main()
