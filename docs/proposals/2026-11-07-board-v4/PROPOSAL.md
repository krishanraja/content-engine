# Proposal: publish board v4 and the pre-production sheet

Status: proposal, 7 Nov 2026. Nothing here is built. The board layout changes only with Krish's recorded words
(`docs/PUBLISH_BOARDS.md`, `scripts/check_board_layout.py --update --approved`). Mockup: `mockup.html` beside this
file (open it in a browser; nothing on it saves).

## The problem, in his words (7 Nov)

"I still have to keep looking for things, and I have to keep trying to figure out where stuff is, which isn't ideal.
It also doesn't allow me to give feedback for every day of publishing stuff last week, say, for example, the off days."

"I want to be able to answer all the questions up front on what we should do in terms of creative production... I want
the system to be able to experiment and be creative, but not have any nasty surprises along the way when Codex is
producing something. It's important we have mockups and really clear ideas before full production."

## What changes

### 1. A Desk the board opens on (replaces Today)
One list: everything waiting on him, ordered by when it is due, each line one sentence and one button that opens the
exact thing in place. Everything waiting on the engine or Growth is folded underneath, so he sees it without acting.
Built from what the board already knows (`waiting`, the making record's gates, the presses still unmade), so nothing
new is typed by hand.

### 2. Every day the same seven stages, off days included
Idea, Script, Recorded, Creative, Cut, Published, Scored. The week strip shows six days (Mon to Sat) as cards with
the seven stages as a bar: green done, amber with someone else, red waiting on him. Off days stop being a section of
the Ideas tab and get the same card and the same stages (a carousel's Script is its copy, Recorded is skipped).

The four steps of today's layout map on to it: Brief = Idea, Drafts = Script, Record = Recorded, Publish = Cut and
Published. Creative and Scored are new.

### 3. Creative: one pre-production sheet, one press
After the script and the takes, before Codex or ve builds anything. Each section shows options drawn on a frame of
his own take, never described in words alone:

| Section | What he sees | What it feeds |
|---|---|---|
| A. Opener and close | The first 7 seconds and the last 8, in words and as a frame; the hook test result and two alternative hooks | the script and `style.idea` |
| B. Subtitles | Three caption treatments on his frame with Instagram's and YouTube's safe zones drawn | `style` captions; one treatment for the whole cut (F35 lists every type role) |
| C. Motion style | Two or three styles from the bank's `motion` layer (17 today), each a 3-second loop on his footage, each marked liked, untested or experiment | `style.motion` (required by `ve lint` from 9 Nov) |
| D. The one idea | The one object, what each move means, the real artifacts shown full frame, and the never-list | `style.idea` (F31, F32) |
| E. Storyboard | 6 to 10 frames with the beat line and time, tap to comment | the `ve expect` sheet his Sign storyboard press binds |
| F. Thumbnails | Two or three, each rendered into a mock Instagram grid (3:4 crop) beside the last five posts and a YouTube results row | covers and thumbnails (`build.py --cover --thumbs`, this week's skin) |
| G. After you sign | What will be built next and the two-loop limit | the proof gate (F04, F13, F34) |

One press, **Sign creative**, records each pick and binds the storyboard sheet: it replaces the separate Sign
storyboard and Pick a style presses, and keeps Approve proof and Approve cut as they are. Codex receives a card only
from a signed sheet, so it never invents a look (its cards already carry `## Motion style` from the pick). Experiments
are welcome on the sheet: an untested style can be picked, and the proof shows it moving before anything scales.

### 4. Scored, for every post
After a post is live, the Scored stage carries the two marks (narrative, production) for every day, off days
included, with views when Growth has them. A "Last week" tab lists the six days in one table, so Sunday's review is
one screen. Uses the existing `picks/score-<piece>` document and `piece_scores`; off-day posts need a piece id
(Growth's `offdays` already carry one when he records; carousels would get one when filed).

### 5. Bugs attached to their piece
Each file in Bugs & Issues is shown on its piece's card with its cause, the guard that catches it now, and done or
not. The 7 Nov screenshots are the first three.

## What it costs and what it touches

- `config/board-layout.json` (a `v4` block), `scripts/post-pack/week_board.py` and its views, the fixture
  `fixtures/week-board/fixed-layout.json` (updated with his words), the board API for the Creative press
  (`picks/<day>-creative`), and `scripts/velib` to read the press into the spec. No new service, no spend.
- About two sessions: one for the Desk, the stages and off-day scoring; one for the Creative sheet and its press.
- From the week of 16 Nov if he says yes on Sunday 8 Nov; the 9 Nov board keeps v3, with the Creative sheet for Wed
  11 and Fri 13 shown as a page beside it so this week's two videos still get it.

## What he is asked

1. Yes or no to the Desk, the seven stages and the Last week tab.
2. Yes or no to the Creative sheet as the one gate before any build, replacing the two separate presses.
3. Whether to try it on Wed 11 and Fri 13 this week, outside the board, before it is built in.
