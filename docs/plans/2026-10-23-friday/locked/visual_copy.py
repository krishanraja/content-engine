"""Builds visual-copy.json and assets.json for the four Friday videos, and refuses a beat or asset that does not exist.

    python docs/plans/2026-10-23-friday/locked/visual_copy.py

Every string that goes on screen is here and nowhere else. Codex reads visual-copy.json (what) with timings.json (when)
and motion-system.md (how). Rules: on-screen words add what the voice does not say (a source, a date, a number, a name,
the changed word); every value cites its source; nothing generated stands in for evidence.
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
POST = '3 Posts/2026-10-23 Fri mind.the.gap - Two passports'
EV = f'{POST}/2 Covers and images/Evidence/'
TS = f'{POST}/2 Covers and images/AI test screenshots/'

ASSETS = {
    # evidence captures, 24 Oct 2026, proving sentence highlighted (captures.json in the same folder holds URL and time)
    'E-fortune':   {'file': EV + 'fortune-chesky.png', 'url': 'https://fortune.com/2025/10/21/brian-chesky-openai-tools-not-ready', 'label': 'BLOOMBERG VIA FORTUNE · 21 OCT 2025'},
    'E-techcrunch':{'file': EV + 'techcrunch-cursor.png', 'url': 'https://techcrunch.com/2026/03/22/cursor-admits-its-new-coding-model-was-built-on-top-of-moonshot-ais-kimi', 'label': 'TECHCRUNCH · 22 MAR 2026'},
    'E-npr':       {'file': EV + 'npr-lindy.png', 'url': 'https://www.kunc.org/npr-news/2026-07-15/american-ai-is-expensive-some-startups-are-turning-to-cheap-chinese-models', 'label': 'NPR · 15 JUL 2026'},
    'E-stanford-models': {'file': EV + 'stanford-models.png', 'url': 'https://hai.stanford.edu/ai-index/2026-ai-index-report/research-and-development', 'label': 'STANFORD AI INDEX 2026'},
    'E-stanford-gap':    {'file': EV + 'stanford-gap.png', 'url': 'https://hai.stanford.edu/ai-index/2026-ai-index-report', 'label': 'STANFORD AI INDEX 2026'},
    'E-csmonitor': {'file': EV + 'csmonitor.png', 'url': 'https://www.csmonitor.com/World/Asia-Pacific/2026/0923/china-ai-chatbots-communist-party', 'label': 'CS MONITOR · 23 SEP 2026'},
    'E-willison':  {'file': EV + 'willison-grok.png', 'url': 'https://simonwillison.net/2025/Jul/11/grok-musk/', 'label': 'SIMON WILLISON · 11 JUL 2025'},
    'E-register':  {'file': EV + 'register-hsbc.png', 'url': 'https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926', 'label': 'THE REGISTER · 1 DEC 2025'},
    'E-korea':     {'file': EV + 'koreaherald.png', 'url': 'https://www.koreaherald.com/article/10656367', 'label': 'KOREA HERALD · JAN 2026'},
    'E-uae':       {'file': EV + 'uae-k2.png', 'url': 'https://kyodonewsprwire.jp/release/202509104907', 'label': 'MBZUAI AND G42 · SEP 2025'},
    'E-saudi':     {'file': EV + 'saudi-humain.png', 'url': 'https://www.arabnews.com/node/2613023/amp', 'label': 'ARAB NEWS · 26 AUG 2025'},
    'E-india':     {'file': EV + 'india-sarvam.png', 'url': 'https://www.businesstoday.in/tech-today/news/story/india-selects-sarvam-to-build-sovereign-ai-model-under-indiaai-mission-473791-2025-04-27', 'label': 'BUSINESS TODAY · 28 APR 2025'},
    'E-uk':        {'file': EV + 'uk-fund.png', 'url': 'https://www.sovereignai.gov.uk/', 'label': 'UK SOVEREIGN AI FUND'},
    'E-deepseek-policy': {'file': EV + 'deepseek-privacy.png', 'url': 'https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html', 'label': 'DEEPSEEK PRIVACY POLICY · READ 24 OCT 2026'},
    'E-nist':      {'file': EV + 'nist-caisi.png', 'url': 'https://www.nist.gov/news-events/news/2025/09/caisi-evaluation-deepseek-ai-models-finds-shortcomings-and-risks', 'label': 'NIST CAISI · 30 SEP 2025'},
    # Krish's screen recordings, 24 Oct 2026 (engine recordings store; recording.py get NAME)
    'F-xinjiang':  {'file': 'xinxiang.mp4', 'sha256': '38ae06f278cc', 'label': 'MY TEST · 24 OCT · SCREEN RECORDING',
                    'note': '14.8 s, 2174x1560. Prompt sent at 2.25 s; the answer streams from 3.0 s, is complete by about 4.0 s, and is replaced by "Sorry, that\'s beyond my current scope. Let\'s talk about something else." at 5.25 s (frames checked). Crop the top-left "New chat" label and anything personal.'},
    'F-turkmenistan': {'file': 'turkmenistan.mp4', 'sha256': 'c14933aaeb28', 'label': 'MY TEST · 24 OCT · SCREEN RECORDING',
                    'note': '12.1 s, 2154x1524. Answers in full and stays. Crop the chat title and anything personal.'},
    # the 23 Oct test screenshots already in the library
    'T-claude-A1': {'file': TS + 'claude-A1-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    'T-chatgpt-A1': {'file': TS + 'chatgpt-A1-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    'T-deepseek-A1': {'file': TS + 'deepseek-A1-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    'T-claude-A2': {'file': TS + 'claude-A2-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    'T-chatgpt-A2': {'file': TS + 'chatgpt-A2-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    'T-deepseek-A2': {'file': TS + 'deepseek-A2-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    'T-claude-B1': {'file': TS + 'claude-B1-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    'T-chatgpt-B1': {'file': TS + 'chatgpt-B1-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    'T-deepseek-B1': {'file': TS + 'deepseek-B1-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    'T-B2-row':    {'file': TS + '{claude,chatgpt,deepseek}-B2-r1-1.png', 'label': 'MY TEST · 23 OCT'},
    # official marks through Brandfetch (config/logo-registry.json), never drawn
    'M-marks': {'file': 'Brandfetch', 'names': ['Airbnb', 'Alibaba (Qwen)', 'Cursor', 'Moonshot AI (Kimi)', 'Lindy', 'DeepSeek', 'Anthropic (Claude)', 'OpenAI (ChatGPT)', 'xAI (Grok)', 'Mistral AI', 'HSBC', 'Zhipu (GLM)']},
    # drawn objects (motion-system.md, "The cast of objects")
    'O-passport': {'file': 'build', 'note': 'motion-system.md object 1'},
    'O-sheet': {'file': 'build', 'note': 'object 2: an evidence capture on paper'},
    'O-route': {'file': 'build', 'note': 'object 3'},
    'O-tiles': {'file': 'build', 'note': 'object 4'},
    'O-chat': {'file': 'build', 'note': 'object 5'},
    'O-split': {'file': 'build', 'note': 'object 6'},
    'O-checklist': {'file': 'build', 'note': 'object 7'},
    'O-outro': {'file': 'config/story-intro-outro.json', 'note': 'the approved outro'},
}

R = 'research-gaps.md'
# Each beat: surface (cream = what it says, ink = where it lives), the pictures in order, the words on screen (each
# one adds), the source label, the sentence highlighted on the evidence, numbers with sources, and the on-camera use.
B = {
 'L01-hook': dict(surface='ink', pictures=['F-xinjiang at real speed from 2.25 s, freeze on the refusal'], on_screen=[], label='F-xinjiang',
    cam='Cold open on the footage for the first sentence, cut to his face on "So does it matter".'),
 'L02-why': dict(surface='cream', pictures=['O-passport x7, face down, fanned like a deck; each flips just enough to show its mark (M-marks: Claude, ChatGPT, DeepSeek, Qwen, Kimi, Mistral, Grok)'], on_screen=[], cam='Face.'),
 'L03-airbnb': dict(surface='cream', pictures=['E-fortune slides in; push to the quote', 'Airbnb mark beside Qwen\'s passport: BORN CHINA (ALIBABA) · LIVES NOT STATED'],
    on_screen=['BRIAN CHESKY · AIRBNB CEO', 'BORN: CHINA', 'LIVES: NOT STATED'], label='E-fortune', highlight="We're relying a lot on Alibaba's Qwen model.",
    numbers=[], sources=[R + ' §2 Airbnb and Qwen (Chesky to Bloomberg, Fortune 21 Oct 2025); the source does not say where Airbnb runs Qwen'], cam='Cutaway for the whole beat.'),
 'L04-fling': dict(surface='cream', pictures=['E-fortune, highlighter moves on to "It\'s also fast and cheap"; then dead still through the punchline'],
    on_screen=[], label='E-fortune', highlight="It's also fast and cheap", cam='Cutaway, then his face for the punchline only if the take has a reaction; otherwise hold the still.'),
 'L05-cursor': dict(surface='cream', pictures=['E-techcrunch', "Kimi's passport: BORN CHINA (MOONSHOT AI)", 'Cursor mark'],
    on_screen=['CURSOR COMPOSER 2', 'BUILT ON KIMI K2.5', 'BORN: CHINA'], label='E-techcrunch',
    highlight='It was a miss to not mention the Kimi base in our blog from the start.', sources=[R + ' §2 Cursor and Kimi K2.5'], cam='Cutaway.'),
 'L06-lindy': dict(surface='cream', pictures=['E-npr', 'O-tiles: a cost bar of 10 tiles (ANTHROPIC, BEFORE) shrinks to 1 tile (DEEPSEEK-V4) on "ten times"'],
    on_screen=['100% OF ITS TRAFFIC', '10x'], label='E-npr', highlight='It was just 10x cheaper',
    numbers=[{'value': '10x cheaper', 'source': R + ' §2 Lindy (Crivello to NPR)'}, {'value': '100% of traffic to DeepSeek-V4', 'source': R + ' §2 Lindy'}], cam='Cutaway.'),
 'L07-race': dict(surface='cream', pictures=['O-tiles: an empty board with two columns, USA and CHINA, waiting'], on_screen=['USA', 'CHINA'], cam='Cutaway.'),
 'L08-stanford': dict(surface='cream', pictures=['O-tiles: one tile per model drops into each column on the numbers, 59 and 35', 'E-stanford-models as a small sheet in the corner'],
    on_screen=['59', '35', 'NOTABLE AI MODELS MADE IN 2025'], label='E-stanford-models',
    highlight="produced 59 notable models in 2025 to China's 35", numbers=[{'value': '59 v 35', 'source': R + ' §3 Stanford HAI AI Index 2026'}], cam='Cutaway.'),
 'L09-gap': dict(surface='cream', pictures=['O-tiles: two quality bars rise almost level; a hairline marks the gap', 'E-stanford-gap'],
    on_screen=['2.7%', 'BEST US MODEL (ANTHROPIC) v BEST CHINESE · MARCH 2026'], label='E-stanford-gap',
    highlight="as of March 2026 Anthropic's top model leads by just 2.7%", numbers=[{'value': '2.7% (he says "about three percent")', 'source': R + ' §3 quality gap'}], cam='Cutaway.'),
 'L10-everyone': dict(surface='cream', pictures=['The one whip pan: five sheets in a row, each landing on its country\'s name: E-uk, E-register (Mistral), E-uae and E-saudi together on "the Gulf", E-india, E-korea'],
    on_screen=['UK · SOVEREIGN AI FUND', 'FRANCE · MISTRAL', 'UAE · K2 THINK', 'SAUDI ARABIA · HUMAIN CHAT', 'INDIA · SARVAM', 'SOUTH KOREA · NATIONAL AI PROJECT'],
    label='each sheet carries its own label', sources=[R + ' §4', 'research-sovereign-ai-corpus.md, United Kingdom'], cam='Cutaway.'),
 'L11-sovereign': dict(surface='cream', pictures=['O-passport x5 in a row, each BORN field filling with its own country: UK, FRANCE, UAE, INDIA, SOUTH KOREA'],
    on_screen=['BORN: UK', 'BORN: FRANCE', 'BORN: UAE', 'BORN: INDIA', 'BORN: SOUTH KOREA'], cam='Cutaway.'),
 'L12-korea': dict(surface='cream', pictures=['E-korea'], on_screen=['NAVER CLOUD · DROPPED'], label='E-korea',
    highlight="Naver Cloud's attempt to develop its own vision encoder ran into trouble due to its use of pretrained prediction-making parameters from Alibaba's Qwen 2.5-VL 32B, a Chinese-developed model.",
    sources=[R + ' §4 South Korea'], cam='Cutaway.'),
 'L13-awkward': dict(surface='cream', pictures=['Naver\'s passport BORN SOUTH KOREA; a small insert slides out of it: QWEN 2.5-VL · BORN CHINA. Dead still for "awkward".'],
    on_screen=['BORN: SOUTH KOREA', 'PART: QWEN 2.5-VL · BORN CHINA'], cam='Cutaway, hold.'),
 'L14-passports': dict(surface='cream', pictures=['The hero passport builds: page, mark box empty, BORN types on "born", LIVES types on "lives"; on "whose computers it runs on" a small server icon appears in the LIVES field'],
    on_screen=['BORN', 'LIVES'], cam='Cutaway for the whole beat (it is the piece\'s idea).'),
 'L15-born': dict(surface='cream', pictures=['The passport tilts back; E-csmonitor slides over it'], on_screen=['200 QUESTIONS · 4 CHINESE CHATBOTS'], label='E-csmonitor',
    sources=[R + ' §1a'], cam='Cutaway.'),
 'L16-third': dict(surface='cream', pictures=['O-tiles: 100 tiles under the four marks (DeepSeek, Kimi, Qwen, GLM); 35 flip amber in a wave'],
    on_screen=['35%'], label='E-csmonitor', highlight='In more than one-third of cases (35%)',
    numbers=[{'value': '35%', 'source': R + ' §1a', 'note': 'show as 35 of 100, never as 70 of 200: the Monitor gives a percentage, not a count'}], cam='Cutaway.'),
 'L17-deepseek63': dict(surface='cream', pictures=['O-tiles: a DeepSeek row of 100; 63 flip amber'], on_screen=['DEEPSEEK 63%'], label='E-csmonitor',
    highlight='That figure rose to 63% for DeepSeek', numbers=[{'value': '63% (he says "nearly two out of three")', 'source': R + ' §1a'}], cam='Cutaway.'),
 'L18-claude': dict(surface='cream', pictures=["A Claude row of 100 tiles, all mint; Claude's passport: BORN USA"], on_screen=['BORN: USA'], label='E-csmonitor',
    sources=[R + ' §1a: "Claude answered all of them"'], cam='Cutaway; it covers the audio cut ("from an American perspective").'),
 'L19-grok': dict(surface='cream', pictures=['E-willison, push to the search box', "Grok's passport: BORN USA (xAI)"], on_screen=['GROK 4 · JULY 2025', 'BORN: USA'], label='E-willison',
    highlight='from:elonmusk (Israel OR Palestine OR Hamas OR Gaza)', sources=[R + ' §1d'], cam='Cutaway.'),
 'L20-boss': dict(surface='cream', pictures=['Hold dead still on the highlighted search'], on_screen=[], label='E-willison', cam='Cutaway, hold.'),
 'L21-lives': dict(surface='ink', pictures=['The passport flips; the surface turns to ink with it; LIVES glows mint'], on_screen=['LIVES'], cam='Cutaway.'),
 'L22-app': dict(surface='ink', pictures=['O-route: phone to server; a border line labelled PEOPLE\'S REPUBLIC OF CHINA; three packets cross it', 'E-deepseek-policy as a small lit sheet', "DeepSeek's passport: LIVES CHINA (amber)"],
    on_screen=["PEOPLE'S REPUBLIC OF CHINA", 'LIVES: CHINA'], label='E-deepseek-policy',
    highlight="we directly collect, process and store your Personal Data in People's Republic of China.",
    sources=['DeepSeek privacy policy, read 24 Oct 2026'], cam='Cutaway; on the camera take it covers the cut sentence and carries the garbled line.'),
 'L23-home': dict(surface='ink', pictures=['O-route redraws: the server moves inside a bank building outline', 'E-register headline', "Mistral's passport: BORN FRANCE · LIVES HSBC'S OWN COMPUTERS", 'HSBC and Mistral marks'],
    on_screen=['BORN: FRANCE', "LIVES: HSBC'S OWN COMPUTERS"], label='E-register', highlight="self-hosted AI models that operate on HSBC's internal technology systems", sources=['The Register, 1 Dec 2025, quoting HSBC (read 24 Oct 2026)'], cam='Cutaway.'),
 'L24-selfhost': dict(surface='ink', pictures=["DeepSeek's passport: the LIVES field rewrites from CHINA to US GOVERNMENT SERVERS; the route's server moves across the border"],
    on_screen=['LIVES: US GOVERNMENT SERVERS'], sources=[R + ' §1c (CAISI ran downloaded weights on its own servers)'], cam='Cutaway.'),
 'L25-nist': dict(surface='cream', pictures=['E-nist slides in; the stamp slaps onto the passport: STILL GAVE BEIJING\'S LINE'],
    on_screen=['4x', "STILL GAVE BEIJING'S LINE"], label='E-nist',
    highlight='DeepSeek models echoed four times as many inaccurate and misleading CCP narratives as U.S. reference models did.',
    numbers=[{'value': '4x as many CCP narratives', 'source': R + ' §1b NIST CAISI'}], cam='Cutaway.'),
 'L26-takechina': dict(surface='cream', pictures=['The passport alone: LIVES reads USA (mint) on the first sentence; BORN: CHINA pulses amber on the second; dead still'],
    on_screen=['LIVES: USA', 'BORN: CHINA'], cam='Cutaway, hold.'),
 'L27-tried': dict(surface='cream', pictures=['Three passports dealt onto the desk: Claude, ChatGPT, DeepSeek'], on_screen=['MY TEST · 23 OCT · 3 RUNS EACH'], label='MY TEST',
    sources=['test-results/scores.md'], cam='Face; the three passports as a lower band for the last sentence.'),
 'L28-method': dict(surface='cream', pictures=['O-split: one prompt with the country as an amber slot that swaps'], on_screen=[], label='MY TEST', cam='Cutaway.'),
 'L29-cotton': dict(surface='cream', pictures=['O-split: prompt A1 and A2 stacked, XINJIANG and TURKMENISTAN lit amber'], on_screen=['XINJIANG', 'TURKMENISTAN'], label='MY TEST',
    sources=['test-results/predictions-and-checklist.md (prompts as typed)'], cam='Cutaway.'),
 'L30-blocked': dict(surface='cream', pictures=['A dated tag drops on each prompt'], on_screen=['US BAN · JUNE 2022', 'US BAN · MAY 2018'],
    sources=['test-design.md: Xinjiang under the Uyghur Forced Labor Prevention Act from June 2022; Turkmenistan under a Withhold Release Order, May 2018'], cam='Cutaway.'),
 'L31-flagged': dict(surface='cream', pictures=['A 3 x 2 grid (Claude, ChatGPT, DeepSeek x Xinjiang, Turkmenistan) of answer thumbnails (T-claude-A1, T-claude-A2, T-chatgpt-A1, T-chatgpt-A2, T-deepseek-A2); "forced labour" highlighted in each; a mint tick lands in five cells; the DeepSeek x Xinjiang cell stays empty'],
    on_screen=['FORCED LABOUR'], label='MY TEST', highlight='forced labour', sources=['test-results/scores.md, pair A'], cam='Cutaway.'),
 'L32-deleted': dict(surface='ink', pictures=['The empty cell opens into F-xinjiang at real speed beside F-turkmenistan; then a 4x slow replay of 3.0-5.25 s (lines break into amber scanlines); a counter on "every single time"'],
    on_screen=['XINJIANG', 'TURKMENISTAN', '1 OF 3', '2 OF 3', '3 OF 3'], label='F-xinjiang',
    numbers=[{'value': '3 of 3 runs', 'source': 'test-results/scores.md (23 Oct); the counter is labelled 23 OCT · 3 OF 3 RUNS, the footage 24 OCT'}], cam='Cutaway for the whole beat.'),
 'L33-taiwan': dict(surface='cream', pictures=['O-split: prompts B1 and B2, TAIWAN and SINGAPORE lit amber'], on_screen=['TAIWAN', 'SINGAPORE'], label='MY TEST', cam='Cutaway; on the voiceover it covers the cut ("That was the second question").'),
 'L34-draw': dict(surface='cream', pictures=['T-claude-B1, T-chatgpt-B1, T-deepseek-B1 side by side, "cross-strait" highlighted in each; T-B2-row below, dimmed; stamp A DRAW'],
    on_screen=['CROSS-STRAIT', 'A DRAW'], label='MY TEST', highlight='cross-strait', sources=['test-results/scores.md, pair B'], cam='Cutaway.'),
 'L35-knew': dict(surface='ink', pictures=['O-chat: the deleted Xinjiang answer, readable for a beat (text as captured), then it wipes again; hold on the refusal'],
    on_screen=['WRITTEN, THEN DELETED · 23 OCT'], label='MY TEST',
    highlight='Key risks: UK Modern Slavery Act transparency obligations; potential Uyghur Forced Labour Prevention Act (US) exposure if you export',
    sources=['test-results/answers.md, DeepSeek A1 run 1 (text captured before deletion)'], cam='Cutaway.'),
 'L36-call': dict(surface='cream', pictures=["DeepSeek's passport returns: LIVES circled on \"where your data ends up\", BORN circled on \"check what it tells you\""],
    on_screen=['LIVES', 'BORN'], cam='Face; the circled passport as a side panel.'),
 'L37-cheap': dict(surface='cream', pictures=['The 10x cost bar from L06 returns, small'], on_screen=['10x'], cam='Face.'),
 'L38-supply': dict(surface='ink', pictures=['A product outline opens into its parts; one part glows amber; a stamp: TARIFF'], on_screen=['TARIFF'], cam='Face, then the parts as a cutaway on "tariffs".'),
 'L39-reckon': dict(surface='ink', pictures=['The parts become passports; one amber'], on_screen=['MY VIEW'], cam='Face.'),
 'L40-do': dict(surface='cream', pictures=['O-checklist, three lines ticking on their words'], on_screen=['WHICH AI · WHERE IT RUNS', 'YOUR QUESTIONS · AN AI FROM ANOTHER COUNTRY', 'A SECOND AI, READY'],
    cam='Face with the checklist building beside him.'),
 'L41-close': dict(surface='cream', pictures=['O-outro'], on_screen=[], cam='Outro card.'),
}
S = {
 'S01-hook': 'L01-hook', 'S02-airbnb': 'L03-airbnb', 'S03-fling': 'L04-fling', 'S04-passports': 'L14-passports',
 'S05-newspaper': 'L15-born', 'S06-third': 'L16-third', 'S07-claude': 'L18-claude', 'S09-work': 'L29-cotton',
 'S10-flagged': 'L31-flagged', 'S11-deleted': 'L32-deleted', 'S12-call': 'L36-call', 'S14-close': 'L41-close',
}
S_OWN = {
 'S08-lives': dict(surface='ink', pictures=['The passport flips to ink (as L21), then the route to China (as L22)'], on_screen=["PEOPLE'S REPUBLIC OF CHINA", 'LIVES: CHINA'],
    label='E-deepseek-policy', highlight="we directly collect, process and store your Personal Data in People's Republic of China.", cam='Cutaway.'),
 'S13-do': dict(surface='cream', pictures=['O-checklist, two lines'], on_screen=['WHICH AI · WHERE IT LIVES', 'A SECOND AI, READY'], cam='Face with the checklist beside him.'),
 'S13b-recap': dict(surface='cream', pictures=['The hero passport: BORN lights on "passport number one", LIVES on "passport number two"'], on_screen=['BORN', 'LIVES'], cam='Cutaway (on-camera take only).'),
 'S13c-second': dict(surface='cream', pictures=['The checklist\'s second line ticks'], on_screen=['A SECOND AI, READY'], cam='Face (on-camera take only).'),
}
SHORT_NOTES = {
 'S01-hook': 'The short\'s whole cold open: the deletion freezes on the refusal under "Does that matter?".',
 'S09-work': 'Three passports (Claude, ChatGPT, DeepSeek) dealt first, then the Xinjiang prompt types on; no Turkmenistan prompt in the short.',
 'S10-flagged': 'Two cells only: Claude and ChatGPT on Xinjiang, ticks.',
 'S11-deleted': 'As L32, cut to fit; keep the 4x replay and the counter.',
}


def main():
    timings = json.loads((HERE / 'timings.json').read_text())
    ids = {b['beat'] for t, v in timings.items() if not t.startswith('_') for b in v['beats']}
    out = {'_about': 'What goes on screen, beat by beat, for the four Friday videos. When comes from timings.json; how from '
                     'motion-system.md. Built by visual_copy.py; edit that, never this file.', 'beats': {}}
    for bid, spec in B.items():
        out['beats'][bid] = spec
    for sid, lid in S.items():
        out['beats'][sid] = {**B[lid], 'same_as': lid, **({'short_note': SHORT_NOTES[sid]} if sid in SHORT_NOTES else {})}
    out['beats'].update(S_OWN)
    missing = ids - set(out['beats']); extra = set(out['beats']) - ids
    if missing or extra:
        raise SystemExit(f'beats without copy: {sorted(missing)}; copy without beats: {sorted(extra)}')
    for bid, spec in out['beats'].items():
        refs = [p.split()[0].rstrip(',;:') for p in spec['pictures']] + [spec.get('label', '')]
        for r in refs:
            if r[:2] in ('E-', 'F-', 'T-', 'O-', 'M-') and r not in ASSETS:
                raise SystemExit(f'{bid}: unknown asset {r}')
    (HERE / 'visual-copy.json').write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    (HERE / 'assets.json').write_text(json.dumps({'_about': 'Every asset the four videos use and where it is.', 'assets': ASSETS}, indent=1, ensure_ascii=False) + '\n')
    print(len(out['beats']), 'beats with copy;', len(ASSETS), 'assets')


if __name__ == '__main__':
    main()
