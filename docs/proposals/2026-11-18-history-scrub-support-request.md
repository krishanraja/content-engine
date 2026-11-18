# GitHub Support request: remove the four retired Thu 5 Nov key frames

Written 2026-11-18. Krish Raja sends this (the account owner files it; a session cannot). The history rewrite is done; what
remains is what only GitHub can remove.

## What was done

Krish ordered four frames of his rejected Thu 5 Nov video deleted from existence ("DELETE THOSE FRAMES FOREVER"; "scrub it").
They were four JPEGs, `fixtures/ve/design-lock/face-with-proof/{hook,face,proof,close}.jpg`, added on 2026-11-03 in commit
`cb0d3cec2a340e5f67c42ee05e37ae15a3a0df63` and deleted on 2026-11-18 (commits `3c7ca46b65ec67a827d9f3fd99a90d43d0c8e7c0` and
`0a7d687708c56cff4189526700dcc875e81c031c`). On 2026-11-18 the repository's branches were rewritten (git filter-branch, the
four files removed from every commit descended from the first one) and force-pushed. From a fresh clone no branch reaches the
files or the four blobs any more.

## What GitHub still holds

The old objects are still reachable through the pull request refs (`refs/pull/<n>/head`) of about 540 pull requests (#342 to
#893), through the old commit shas, and through cached views. Only GitHub can remove those.

Blob shas to remove:

| File | Blob sha |
|---|---|
| fixtures/ve/design-lock/face-with-proof/hook.jpg | 8bd60523fcc6ea257a92097e6ae89648129310cf |
| fixtures/ve/design-lock/face-with-proof/face.jpg | e84212c1bcd972b43f25d965c97ee16558d972d8 |
| fixtures/ve/design-lock/face-with-proof/proof.jpg | 2edf45e2e8f91824d8dded6c7b4bd90256ddf045 |
| fixtures/ve/design-lock/face-with-proof/close.jpg | 4ab3b2b0e7b6c2ffb80227a019a56cd739f5a066 |

## Text to send (https://support.github.com/contact, "Remove sensitive data" / repository content)

> Repository: krishanraja/content-engine (public). I removed four image files from the repository's history on 2026-11-18 and
> force-pushed every branch, but they are still reachable through the pull request refs (refs/pull/*) and the old commit shas,
> and may be in cached views. Please remove the following blobs and every cached view and reference to them, then garbage
> collect: 8bd60523fcc6ea257a92097e6ae89648129310cf, e84212c1bcd972b43f25d965c97ee16558d972d8,
> 2edf45e2e8f91824d8dded6c7b4bd90256ddf045, 4ab3b2b0e7b6c2ffb80227a019a56cd739f5a066. They were added in commit
> cb0d3cec2a340e5f67c42ee05e37ae15a3a0df63 under fixtures/ve/design-lock/face-with-proof/. The pull requests whose refs still
> hold them are #342 to #893. They are my own video frames that I have withdrawn; there is no credential in them.

## What other work must know

- Every commit after 2026-11-03 has a new sha. Branches and open pull requests were rewritten, so a session or computer that
  still has the old history must not push it back: a push of the old history would bring the frames back. On each, run
  `git fetch origin` and move the work onto the new branch (for example `git rebase --onto origin/<branch> <old merge-base>`), or
  start from a fresh clone.
- A home computer's checkout of `main` has diverged: `git fetch origin && git reset --hard origin/main` once nothing is
  unpushed there.
- Commits before 2026-11-03 keep their shas. Rewritten commits lost any signature they carried.
- Old shas quoted in docs and notes (for example `@e4ff3c4` in titles) may no longer exist.
