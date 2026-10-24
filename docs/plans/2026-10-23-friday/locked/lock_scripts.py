"""Writes the four locked scripts (script-*.md) from timings.json, with the audio edits. Run from the repository root."""
import json, re
from pathlib import Path
D = Path('docs/plans/2026-10-23-friday/locked'); T = json.loads((D/'timings.json').read_text())
FIX = [(r'\bfour slaver\b','forced labour'),(r'\bforced labor\b','forced labour'),(r'\brock checking\b','Grok checking'),
       (r"\bgrok\b",'Grok'),(r'\bchat GPT\b','ChatGPT'),(r'\bJack,? GPT,?','ChatGPT,'),(r'\bChatGPT, and DeepSeek\b','ChatGPT and DeepSeek'),
       (r'MakeYourMindUp\.ai','makeyourmindup.ai'),(r'\bcursor\b','Cursor'),(r'\banthropic\b','Anthropic'),
       (r'China has a company here','China has company here'),(r'asked for Chinese chatbots','asked four Chinese chatbots'),
       (r'makeyourmindup \.ai','makeyourmindup.ai'),(r'\bThey asked Claude','I asked Claude'),(r'as everyone know,','as everyone knows,')]
HEARD = ['"four slaver" is "forced labour" (re-heard)', '"rock" is "Grok"', '"chat GPT" / "Jack GPT" is "ChatGPT"',
         '"China has a company here" is "China has company here"', '"asked for Chinese chatbots" is "asked four Chinese chatbots"',
         '"They asked Claude" is "I asked Claude" (re-heard with small.en and medium.en)', '"as everyone know" is "as everyone knows"']
EDITS = {
 'vo-5min': [
  ('L04-fling', 'SPLICE', 'After "from a holiday" (33.99 s) insert "fling." from the 90-second voiceover take (slice_7C38..., 16.68-17.04 s): he did not say it in this take (silence from 34.0 s, measured). Same mic, same morning. Match level; listen.'),
  ('L33-taiwan', 'CUT', 'Cut "That was the second question," (247.79-249.25 s, word edges from vo-b.words.json): it splits "Taiwan, which China says belongs to it".'),
  ('L40-do', 'CUT', 'Cut the doubled "one" in "And one to one from another country" so it reads "And to one from another country".'),
 ],
 'cam-5min': [
  ('L18-claude', 'CUT', 'Cut "from an American perspective." after "answered every single one": the newspaper never said it. Cover the join with the picture (no jump cut on his face).'),
  ('L22-app', 'CUT', 'Cut "So it stores your data in the country that you\'re using it.": false (DeepSeek\'s policy: it stores your data in the People\'s Republic of China). Lay the policy capture over "it says what it stores, what you type in China" so the line reads by picture.'),
 ],
 'cam-90s': [
  ('S07-claude', 'CUT', 'Cut "the American questions, of course." so the line ends "answered all.": the newspaper\'s questions were news questions, and "Claude answered all of them". Cover the join with the picture.'),
  ('S12-call', 'NO TRIM (Krish, 24 Oct: "keep")', 'Keep the call as recorded, including "Sometimes the latter supersedes the former, so that\'s fine too." The cut runs about 103 s.'),
 ],
 'vo-90s': [],
}
NAMES = {'vo-5min':'5-minute voiceover (pictures only, 16:9)','cam-5min':'5-minute on camera (16:9 output; the take is a portrait selfie, 1080x1920)','vo-90s':'90-second voiceover (pictures only, 9:16)','cam-90s':'90-second on camera (9:16; the take is a portrait selfie, 1080x1920)'}
for take, meta in T.items():
    if take.startswith('_'): continue
    lines = [f'# Locked script: {NAMES[take]}', '',
             f'Recorded 24 October 2026 by Krish. Take: `{meta["file"]}` (sha256 `{meta["sha256"]}...`, {meta["duration"]} s), fetched with',
             f'`python scripts/post-pack/recording.py get "{meta["file"]}"`. These are the words he said, beat by beat, timed by',
             '`beats.py` (`timings.json`). Codex cues against these words and these times; nothing on screen may carry a word that',
             'is not in `visual-copy.json`.', '',
             'Transcriber mishearings corrected here (the audio is untouched): ' + '; '.join(HEARD) + '.', '']
    ed = EDITS[take]
    lines += ['## Audio edits (do these, then re-time from the edited audio)', '']
    lines += ([f'- **{b} · {k}.** {t}' for b, k, t in ed] or ['- None. Use the take as recorded.'])
    lines += ['', '## The words, beat by beat', '', '| Beat | Start | End | Said |', '|---|---|---|---|']
    for b in meta['beats']:
        s = b['said']
        for a, r in FIX: s = re.sub(a, r, s)
        lines.append(f'| {b["beat"]} | {b["start"]:.2f} | {b["end"]:.2f} | {s} |')
    (D/f'script-{take}.md').write_text('\n'.join(lines)+'\n')
print(sorted(p.name for p in D.iterdir()))
