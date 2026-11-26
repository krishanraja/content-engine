"""Resolve the locked book illustrations against the rendered library."""
from collections import Counter
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
SCRATCH = "../../../../.scratch"
items = json.loads((HERE.parent / "library/library.json").read_text(encoding="utf8"))["items"]
by_id = {item["id"]: item for item in items}
families = Counter(item["family"] for item in items)


def manifest():
    source = (HERE / "content.md").read_text(encoding="utf8").split("\n## ", 1)[1]
    assets = {}
    for kind, name in re.findall(r"\[image: (\w+) ([\w-]+)\]", source):
        if kind == "library":
            item = by_id[name]
            path = f"library/out/items/{item['id']}.png"
        elif kind == "still":
            path = f"why-ladder/assets/{name}.png"
        elif (kind, name) == ("board", "full-look"):
            path = "identity-round2/out/full-look.png"
        else:
            raise ValueError((kind, name))
        assets[f"{kind} {name}"] = f"{SCRATCH}/{path}"
    sheets = {name: {"file": f"{SCRATCH}/library/out/sheets/{name}.png", "count": count}
              for name, count in families.items()}
    return {"assets": assets, "sheets": sheets}


if __name__ == "__main__":
    (HERE / "assets.json").write_text(json.dumps(manifest(), indent=2) + "\n", encoding="utf8")
