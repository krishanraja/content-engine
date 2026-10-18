# Why the content engine used half a 20x Max plan in a week (audit, 18 Oct 2026)

Krish, 2026-10-18: "we are going to need to audit why exactly this content engine costs me half my 20X max
plan in AI tokens this week, and what we can actually do about it next week."

## What was measured

The plan is spent by Claude sessions, not by the engine's API calls (those are API credits, `meter_daily`).
This session's own transcript (`session_01YHC9kjnvJEzYDeFDdADLBq`, "Content engine 14 Oct", 12 to 18 Oct) records
the tokens of every model call. Other sessions this week (the 17 Oct Friday session in Krish's other account,
"compound", "job board", "heartside" and others) are not readable from here, so their share is not measured.

| | Model calls | Tokens read | Tokens written |
|---|---|---|---|
| This session | 2,393 (all Opus 5.5) | 1,086M (1,078M from cache) | 1.7M |
| Its subagents and workflows | 912 | 145M | under 0.1M |

## Why

1. **Every step re-reads the whole conversation.** The session ran for six days, so its context sat at a median of
   459k tokens and peaked at 783k. 1,455 of 2,393 calls (61%) ran above 400k and read 841M tokens (78% of the total).
   The first call of the session read 55k. The same work in fresh, short sessions would read a fraction of this.
2. **Many small steps.** About 700 tool calls (543 shell commands), each one a full re-read.
3. **Big things pulled into the conversation.** Reads of the 11 MB publish board, images, long logs and error tracebacks
   stay in the context and are re-read on every later step.
4. **The most expensive model for everything.** Rendering, packing, filing and board rebuilds ran on Opus 5.5 too.
5. **Agents and workflows**: 145M (12%), each re-reading its own large context.

## What to do next week

1. **One fresh session per job** (a day's piece, the board, a fix), started from its handover file, and stopped when
   the job is done. This is the biggest saving: it keeps each step near 50k to 150k instead of 460k.
2. **Hand over, don't run on.** When a session's work changes topic, write the handover and start a new session.
3. **Fewer, bigger steps.** One script that does five things is one re-read, not five.
4. **Keep big outputs out.** Read the board through the engine's builder and saved files, never into the chat;
   look at one contact sheet per output; keep logs quiet.
5. **Sonnet for production work** (renders, packs, board rebuilds, filing), Opus for writing and judgment.
6. **Agents and workflows only for work that needs a separate reader**, never to save typing.
