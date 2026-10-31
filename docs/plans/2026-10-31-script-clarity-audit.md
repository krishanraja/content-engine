# Can a slow listener follow the scripts? An audit, 31 October 2026

Krish, 31 Oct 2026, reading his voiceovers aloud: "I still feel like all my video scripts are a little bit hard to follow", "I think it's so complex, and then the last paragraph of all my scripts still sounds a bit bossy and preachy."

This audit covers every script from 12 to 30 October, the long cut and the 90-second cut. The articles are mentioned only briefly. The week of 2 November has no drafts yet: the Sunday ideas run is on 1 November. So whatever Krish decides here applies to that week's scripts from the first draft.

## What the numbers show

Counted by `story_check.py`'s new listening counts (`listening_warnings`). A figure is an amount, count or share; years are not counted. A name is a distinct capitalised thing that does not open its sentence.

| Script | Words | Figures | Names | Close sentences | Orders in close |
|---|---|---|---|---|---|
| 12 Oct long | 482 | 11 | 5 | 0 | 0 |
| 14 Oct long | 489 | 3 | 11 | 0 | 0 |
| 19 Oct long | 793 | **24** | 7 | 0 | 0 |
| 21 Oct long | 798 | 3 | 12 | 5 | 3 |
| 23 Oct long | 820 | 3 | **27** | 4 | 3 |
| 26 Oct long | 795 | 10 | 14 | **11** | 1 |
| 28 Oct long | 823 | 0 | 9 | 5 | 3 |
| 30 Oct long | 823 | 9 | 5 | 6 | 3 |
| 21 Oct short | 195 | 3 | 8 | 3 | 2 |
| 26 Oct short | 192 | 6 | 7 | 5 | 1 |
| 28 Oct short | 194 | 0 | 5 | 3 | 2 |
| 30 Oct short | 195 | 0 | 3 | 2 | 2 |
| **30 Oct long, rewritten (below)** | 722 | **0** | **5** | **2** | **0** |
| **30 Oct short, rewritten (below)** | 188 | **0** | **3** | **2** | **0** |

## What is wrong, in order of how much it hurts

1. **The reading gate measures the wrong thing for the ear.** Every script passes it: the sentences average 8 to 11 words, and none is over 20. But nearly every sentence brings a new fact. Short sentences do not make a script easy to hear. What makes it hard is how much it asks the listener to hold.
2. **Too many figures.** The 30 Oct long cut asks the listener to hold 27%, 9%, 20, 13, 43%, 400,000, 600,000, 75% and half a million rows. 19 Oct asks for 24. Someone hearing it once keeps about three. Every figure after that pushes out the story.
3. **Too many names and side-stories.** On 26 Oct the listener meets Google, Disney, OpenAI and Sora, a bankruptcy, lawsuits, Netflix, Warner, Skydance, Paramount, Universal and Comcast, and then a four-question checklist. 23 Oct names 27 things. By the middle the listener has lost the thread, and with it the feeling of "I get it".
4. **The hooks are two-step puzzles.** For example: "Disney asked a dying AI firm to go bust first. That way it could hire the team and leave the lawsuits behind. So why are Disney and Google both paying for pieces of the same company?" That gives away the ending before the listener has the setup, then asks a question they can't hold yet.
5. **Terms are half explained.** Examples: "AI agents, which work on tasks by themselves", "reuse discount", "usage limit", "connect the apps it needs to your work Claude now, in its settings". None of these is compared to anything the listener already knows.
6. **No map and no recap.** No script says up front how many parts it has. None says "so the one thing to remember is" before the close. Writing for the eye skips both; listening needs both.
7. **The close turned bossy the day the fixed line arrived (21 Oct).** "Here's what I'd do with this info if I were you" is followed by up to 11 sentences of orders: Pick, Ask, Look, Give, Make sure, Check. On 28 and 30 Oct a second instruction paragraph sits just before it ("And if you run IT ... decide now", "Good juniors will ask you ... so have an answer"). The words say "I'd", but the shape is a to-do list for the viewer. The scripts of 9 to 14 October ended on a prediction and a question, and read warmer.
8. **Articles.** "3 things you can do tomorrow" works on the page, because a reader can scan and skip. The articles have the same density (a figure in most sentences), but a reader can slow down, and a listener can't.

## The fix, proposed (needs Krish's yes, because it changes house rules)

**The close (replaces SCRIPT_CLOSE's fixed line and the list of orders).** Say one thing Krish would do, in his first person, in at most two sentences. No list, and none of "you should", "make sure" or "decide now". Then end on "The full deep dive is at makeyourmindup.ai." as now. The advice for particular people (IT, people early in their career) moves to the article.

**Listening rules (a new house rule, LISTENING):**
- **One story.** At most one side-story, and about 8 names in a long cut (4 in a short).
- **Figures.** At most 3 in a long cut and 1 in a short. Say them as people do: "one in four became fewer than one in ten", not "27% to 9%". Every other figure goes in the article.
- **Terms.** The first time a hard term comes up, compare it to something the listener already knows.
- **The hook.** Say what happened, then the question it raises. Never give the twist away first.
- **A map and a recap.** Say the parts at the start ("three parts"). Say the one thing to remember just before the close.

**What is already built (a warning, never a refusal, until he decides).** `story_check.py` counts figures, names, close sentences and orders in the close on every script. It warns over the limits above, and cites his words. It refuses nothing until he makes LISTENING a house rule.

## Worked example: 30 Oct, long cut, rewritten

It passes the reading gate (no sentence over 20 words), the kill list, the copy lint and the listening counts, with 0 figures held, 5 names and a 2-sentence close. Its voice distance is 0.444, against 0.528 for the draft (lower is closer to Krish). The only check it fails is SCRIPT_CLOSE, because it drops the fixed line. That failure is the decision this audit asks for.

```text
Anthropic, which makes the AI called Claude, has almost stopped hiring beginners. So if AI now does the work beginners learn on, where will tomorrow's experts come from?

I've been reading a study Anthropic did of its own staff. It matters to anyone who hires people, or wants to get hired, so let me walk you through it. There are three parts. What's happening, why this time is different, and why it matters to you.

So first, what's happening. A couple of years ago, about one in four of Anthropic's new technical staff were beginners. That means people in their first proper job. Now it's fewer than one in ten. And when its managers were asked why they hire fewer, many gave the same answer. AI.

Think about how a beginner learns. You hand them the first rough version of something, like a report or a bit of code. They get parts of it wrong, someone older puts them right, and slowly they get good. That first draft is their training. But now AI writes the first draft. So there's less of that work for a beginner, and fewer reasons to hire one.

And it isn't just Anthropic. Researchers looked at thousands of American companies and found the same thing. Where firms started using AI, they took on fewer beginners. Meanwhile, jobs for experienced people kept on growing.

Now, before anyone panics, machines have taken the bottom of a job before. When cash machines arrived, everyone thought bank tellers were finished. But banks spent the money they saved on more branches. So tellers kept their jobs, and spent more time helping customers. Then spreadsheets came along. Adding up numbers by hand shrank as a job, but accountant jobs grew. Accounting got cheaper, so people wanted more of it.

So each time, the boring bottom of the job went, and the job that was left got bigger.

Which brings me to the second part, and why I think this time is different. With cash machines and spreadsheets, there was still a first step on the ladder. A teller could still learn by working with customers. A new accountant still had somewhere to start. This time, AI takes that first step itself. It does the very work beginners used to learn on.

And it happens quietly. No one gets a letter saying their job has gone. The job just never gets advertised, so the people it hurts never show up anywhere.

Now the third part, why this matters to you. Anthropic's managers say what they need most now is judgement. That means being able to tell good work from bad. And that makes sense, because someone has to check what the AI does. But here's the catch. Where do people learn judgement? In their beginner years, doing the dull work and getting it wrong. Take those years away, and you still need the judgement. You just have nowhere left to grow it.

So I reckon this is every company's problem, and Anthropic is just early to it. The experts you'll need in a few years are beginners somewhere today. And if no one hires them, no one trains them.

This one's personal for me. Back in 2008, I was a beginner at Microsoft. Yes, the people who make Excel. Someone gave me a really boring job, changing the layout of a giant spreadsheet by hand, row after row. I had a hunch there was a better way, so I went looking. And I found out how to get Excel to repeat my clicks for me. It took me a few days to get it working, and I worried I was wasting them. But in the end, three weeks of work became a few hours.

And the bigger lesson wasn't the trick itself. I learned to spot a boring job that repeats, and to keep going when the fix doesn't work first time. I only learned that because someone gave me the dull job.

So if there's one thing to take from this, it's that the boring work beginners do isn't wasted. It's where experts come from.

If I ran a team, I'd do one thing this week. I'd write down who my experts will be in five years. And what real work they're learning on right now.

The full deep dive is at makeyourmindup.ai.
```

## Worked example: 30 Oct, 90-second cut, rewritten

This one passes the same gates and fails only SCRIPT_CLOSE. It is 188 words.

```text
Anthropic, which makes the AI called Claude, has almost stopped hiring beginners. So where will tomorrow's experts come from?

A couple of years ago, about one in four of its new technical staff were beginners. Now it's fewer than one in ten, and many of its managers say AI is why.

Here's the problem. Beginners learn by doing the first rough draft and being put right. But now AI writes the first draft, so there's less work for them to learn on.

Machines have taken boring work before, with cash machines and spreadsheets. But each time, there was still a first step on the ladder. I reckon this time is different, because AI takes that first step itself.

When I was a beginner at Microsoft, I got a really boring spreadsheet job. And it taught me to spot work that repeats, and to fix it.

So the dull work beginners do isn't wasted. It's where experts come from.

If I ran a team, I'd do one thing. I'd write down who my future experts are, and what they're learning on today.

The full deep dive is at makeyourmindup.ai.
```
