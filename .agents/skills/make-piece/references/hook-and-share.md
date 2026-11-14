# The hook, the person it is for, and the caption (make-piece, Scripts step)

Krish, 2026-11-05, sharing an Instagram checklist: "Can you ensure my teleprompter scripts and captions follow rules
like this every time? Adapt the existing protocol towards this instead of making broad sweeping random changes."
His three choices that day are the house rules HOOK_AND_CTA, PERSONAL_INTRO, LISTENING and YOUTUBE_PACKAGE
(`apps/control-plane/api/_houseRules.ts`); this file is how a script and its captions meet them.

## The first second

- The hook is the first sentence. It would stop someone scrolling in under one second.
- It opens on one of four things, and always leaves the one question the video answers (LISTENING):
  the biggest mistake, the result, an unexpected fact, or the middle of the story.
- The topic's keyword, the words people would search for it, is spoken in that first sentence and shown on screen in
  the first beat. The on-screen words add to the line (a number, a name, a date), never repeat it.
- Nothing is said in front of it: no "Hey guys", no welcome, no "in this video", no long intro.
  `story_check.py` refuses a greeting or an intro in the first sentence. On screen, nothing goes in front of the hook
  on any cut, ever: no logo animation and no sting (house rule HOOK_IS_THE_INTRO; Ruling, Krish, 2026-11-12: "Nothing
  before the hook, ever. Remove the sting exception for good."), so each script's first sentence is the first thing
  the viewer hears and sees.
- His personal line (PERSONAL_INTRO: what he has been doing with the thing, why it matters, that he wants to break it
  down) comes second or third, one short sentence. `story_check.py` warns when it comes first.

## The person it is for

Somewhere in the script, one line makes the viewer think of a specific person who needs it, named by their situation:
"the colleague who signs off your AI budget", "whoever runs payroll". Never an ask: no "share this", "send this to",
"tag a friend" (Growth's `share_cta` refuses those). The spoken script makes no ask at all; it still closes on the
deep dive line (SCRIPT_CLOSE).

## The read-back's two extra questions

After Reader A's retelling (Scripts step 4), ask Reader A, in the same conversation, word for word:

```
Two more questions. 1. Would the first sentence alone stop you scrolling in under one second? Answer yes or no, and say why in one line. 2. Name one specific person you know, by their role or situation, who you would send this video to, or say "no one".
```

The script passes only on a yes and a named person. A no rewrites the hook; "no one" means the line about the person
it is for is missing or too vague: add it or sharpen it, then read back again.

## Captions and the pinned comment (YOUTUBE_PACKAGE)

- The caption on a Short, Reel or TikTok opens with the keyword in its first line, as people would search it.
- It carries one save line saying what to keep it for ("Save this for your next budget meeting"), never a generic
  "like and share".
- The pinned comment (`comment_question` in post.json, which `publish_kit.py` pins under the full-article line) asks
  one specific question about the piece, never "thoughts?" or "agree?".
- Where his audience asked a question in the comments, the next piece can answer it in their own words.
- All of it passes `copy_lint.py --applies-to channel_copy` and the kill list.
