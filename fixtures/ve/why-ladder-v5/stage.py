"""Stage local Library source images for the pop-song fixture. Pass its assets folder."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path


def stage(source: Path, destination: Path):
    assets = json.loads((destination / 'spec.json').read_text(encoding='utf-8'))['assets']
    for asset in assets:
        name = asset['path']
        data = source / name
        if hashlib.sha256(data.read_bytes()).hexdigest() != asset['sha256']:
            raise ValueError(f'{name} differs from the approved Library capture')
    for asset in assets:
        name = asset['path']
        shutil.copyfile(source / name, destination / name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    stage(parser.parse_args().source, Path(__file__).resolve().parent)
