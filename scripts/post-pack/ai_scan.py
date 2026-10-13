#!/usr/bin/env python3
"""The model scan: read an article the way AI scanners do, with a language
model, and name the sentences a model would most easily have written.

Krish, 2026-10-13: "we need more aggressive anti AI scanning techniques by
10X". voice_check.py finds the habits; this measures predictability, the
core of what GPTZero-style scanners score. It runs two small open models
(Qwen2.5-0.5B and its Instruct twin) on this machine, nothing sent anywhere:

  - perplexity: how surprised the model is by each word, as mean log loss.
    Machine prose is unsurprising.
  - Binoculars (Hans et al., 2024): that loss divided by how surprised the
    model expects to be. Lower reads as machine-written.
  - the most predictable sentences, lowest loss first, to rewrite.

Calibration on 13 October 2026 (whole-piece log loss / Binoculars):
  a machine-written article on Muse 2.31 / 0.996
  CNN's reported review 3.31 / 1.017, The Register's 3.45 / 1.091 (human)
  Monday's article, flagged 93% AI by a scanner, 3.81 / 1.048
So predictability alone did not catch Monday's: its tells were style
(voice_check.py, which now scores it 41.4). This scan is the second gate:
both must pass.

    pip install torch --index-url https://download.pytorch.org/whl/cpu && pip install transformers
    python ai_scan.py ARTICLE.md [--json] [--top 10]

Exit 0 passes, 1 fails, 2 when the models cannot load.
"""
import argparse
import json
import re
import sys

FLOOR_LOG_PPL = 3.2     # under this the piece reads machine-made
FLOOR_BINOCULARS = 1.02  # under this, likewise
SENTENCE_FLOOR = 2.6     # a sentence this predictable is named for a rewrite
OBS, PERF = 'Qwen/Qwen2.5-0.5B', 'Qwen/Qwen2.5-0.5B-Instruct'


def prose(text):
    text = re.sub(r'^#+ .*$', '', text, flags=re.M)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    return re.sub(r'\*\*|__', '', text).strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('article')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--top', type=int, default=10)
    a = ap.parse_args()
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        torch.set_num_threads(4)
        tok = AutoTokenizer.from_pretrained(OBS)
        mo = AutoModelForCausalLM.from_pretrained(OBS, dtype=torch.float32).eval()
        mp = AutoModelForCausalLM.from_pretrained(PERF, dtype=torch.float32).eval()
    except Exception as e:  # noqa: BLE001
        print(f'ai scan: the models could not load ({e}). Install them with the pip lines in this file.', file=sys.stderr)
        sys.exit(2)
    text = prose(open(a.article, encoding='utf-8').read())

    with torch.no_grad():
        ids = tok(text, return_tensors='pt').input_ids[0]
        loss = xent = 0.0
        n = 0
        for i in range(0, len(ids), 400):
            c = ids[max(0, i - 1): i + 400].unsqueeze(0)
            if c.shape[1] < 20:
                continue
            lo = torch.log_softmax(mo(c).logits[0, :-1], -1)
            pp = torch.softmax(mp(c).logits[0, :-1], -1)
            tgt = c[0, 1:]
            loss += -lo.gather(1, tgt[:, None]).sum().item()
            xent += -(pp * lo).sum().item()
            n += len(tgt)
        log_ppl, bino = loss / n, loss / xent
        sents = []
        for s in re.split(r'(?<=[.!?])\s+', text.replace('\n', ' ')):
            t = tok(s, return_tensors='pt').input_ids
            if t.shape[1] < 8:
                continue
            lo = torch.log_softmax(mo(t).logits[0, :-1], -1)
            sents.append((round(-lo.gather(1, t[0, 1:][:, None]).mean().item(), 2), s.strip()))
    sents.sort()
    flat = [s for s in sents if s[0] < SENTENCE_FLOOR][:a.top]
    passes = log_ppl >= FLOOR_LOG_PPL and bino >= FLOOR_BINOCULARS
    r = {'log_ppl': round(log_ppl, 3), 'binoculars': round(bino, 3), 'floors': [FLOOR_LOG_PPL, FLOOR_BINOCULARS],
         'passes': passes, 'most_predictable': [{'loss': l, 'sentence': s} for l, s in flat]}
    if a.json:
        print(json.dumps(r, indent=1))
    else:
        for l, s in flat:
            print(f'  {l:4.2f}  {s[:110]}')
        print(f'model scan: log loss {log_ppl:.2f} (floor {FLOOR_LOG_PPL}), Binoculars {bino:.3f} (floor {FLOOR_BINOCULARS}): '
              + ('passes' if passes else 'reads machine-made; rewrite the sentences above in his words, then run it again'))
    sys.exit(0 if passes else 1)


if __name__ == '__main__':
    main()
