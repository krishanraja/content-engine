# Round 12 · Template locks

The Library has 194 active templates. All 194 start in `pending_approval`. There are zero live locks and zero approval-history entries. The approvals in the regression test existed only in a temporary copy.

## What the tests exercised

Reproduce the checks with `python -B -m unittest test_locking` in the Library directory. The tests invoked the public `render.py` commands against five copied templates. They used resvg at each template's native dimensions and FFmpeg for the motion proof. The video fixture shortens the vertical why card to five frames so a change between matching endpoints can be exercised repeatedly.

| Change in the temporary copy | Observed result |
| --- | --- |
| Hold the writer guard while running the gate | Read-only verification could proceed. A concurrent approval update was refused. |
| Lock a favicon and a video with a named test reviewer and exact words | Both locks passed. A duplicate approval failed. Leading and trailing spaces in the original words survived. |
| Change one path in the shared D | The gate exited non-zero and named `profile-favicon-32`. Changed-only rendering stopped before updating the manifest. Restoring the path passed. |
| Change the duration of the video's type movement | The first and settled RGB hashes stayed equal to the approval. Both the ordered source frames and the decoded H.264 frames changed. The gate named `video-vertical-why-1`. |
| Change both templates in the same run, then restore them | A single gate invocation named both failures. After restoration both approvals passed. |
| Unlock with a brief naming a similar ID | The command refused the unlock. The exact ID succeeded, preserving the brief's SHA-256 and previous approval in history. A plain-text withdrawal also retained its reason. A fresh approval created a new history entry. |
| Establish a manifest, then repeat the same render | The first run produced five native PNGs and one item film. The second captured zero templates and preserved the file timestamps. The stored output hashes matched the files. |
| Change a shared symbol, then change the icon drawing code | Each edit selected exactly the two favicon consumers. |
| Change a single registry entry, then replace one bank still | Each edit selected only `carousel-howto-cover`. Replacing the still also changed its exported pixels. |
| Damage one PNG and remove another | The next run repaired exactly those two files. The following run captured zero. |

The regression also exercises the full-render handoff to changed-only rendering with a native capture callback. It promotes the staged item files and report, then the next changed-only run skips every item.

## Worktree verification

`python render.py --check-locks` passed with zero live approvals. The dependency planner resolved all 194 items. A second read using the cached graph returned identical inputs. `python verify_static.py` ran the lock gate and passed all 194 templates, 396 spacing pairs, 1,358 stress previews and five samples from each of the four sequences.

SHA-256 of the live files matched the values read at the start of the round.

| File | SHA-256 |
| --- | --- |
| `library.html` | `6d136e1b29f44e1ece55df1f594ec445136239af38fadc5190e1117526c967d1` |
| `library.json` | `2956be0ae9656db031c84464a8a20e14009d8013f713bcb0ec7bb2faa5389d82` |

No browser was launched. Chromium captures and the first production manifest are for the host. Its in-progress render started with the earlier renderer. The first full or changed-only run with this version establishes the production baseline. Normal rounds can then use `--changed` and the mandatory lock gate. [Locking instructions](LOCKING.md)
