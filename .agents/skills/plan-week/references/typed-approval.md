# His typed approval of a lock or of scripts

Ruling (Krish, 2026-11-12): "Scripts and locks only." His own typed words in a session count as his approval
of a narrative lock and of a piece's scripts. Putting an idea on the publish board still needs his press on the
board: a typed yes never places an idea, and the ideas gate (`idea_outcomes`, `content_ideas_board_gate`) is
unchanged.

Only words he typed to you, copied exactly, with when and where he typed them and this session's link. Never a
summary, a paraphrase or your reading of his mood.

His words must name the approval (Ruling, Krish, 2026-11-17): "approve", "approved", "approval", "sign" or "signed"
(for a lock, also "lock it"). "Ready in teleprompter for me" was carried as an approval of Tue 17's voiceover script
and was not one. Words that do not name it are not carried; `board_session.py` refuses them, and so do the board and
`teleprompter_send.py`. When he says something else, the scripts are on the card for him to read, edit and approve:
point him there.

## The lock

```
python3 scripts/post-pack/board_session.py <uuid> approve lock --week <Monday> --day <mon|wed|fri> \
  --lock <path to the lock> --sign --words "<his exact words>" --said-at <ISO time> \
  --where "<where he typed them>" --session-ref <session link>
```

`--sign` writes the lock's signature line (`Signed by Krish: "<his words>", <date>, lock sha256 <hash>`) when it is
not there yet. The board saves picks `<day>-lock-words-<first 8 of the piece id>`, one document a piece, bound to the lock body's sha256, and shows the lock as
"Approved in your words" with his quote, the day and where.

## The scripts

```
python3 scripts/post-pack/board_session.py <uuid> approve scripts --week <Monday> --day <mon|wed|fri> \
  --long <long script> --short <short script> --long-title <title> --short-title <title> \
  --folder-title <folder> --words "<his exact words>" --said-at <ISO time> --where "<where>" \
  --session-ref <session link>
```

The board saves picks `<day>-scripts-words-<first 8 of the piece id>`, one document a piece, bound to the words he approved, and the server sends them to
Teleprompter exactly as it does for his Approve scripts press, held the same way until the scripts' check and the
two fresh readers have passed. A refusal (`typed_approval_is_a_yes`, or any other) is reported to him as it came.

## Taking it back

His approval of a lock or of scripts can be taken back: by his Take back my approval press on the card, or by his own
typed words that name it ("take it back", "undo", "reopen", "unapprove", "withdraw", "revoke" or "edit"; Ruling, Krish,
2026-11-17).

```
python3 scripts/post-pack/board_session.py <uuid> approve scripts --take-back --week <Monday> --day <day> \
  --words "<his exact words>" --said-at <ISO time> --where "<where>" --session-ref <session link>
```

The board saves picks `<day>-scripts-back-<first 8 of the piece id>` (kind `take_back`). Every approval made before it
stops counting, the card asks for his Approve again with the scripts to read and edit, and `teleprompter_send.py` reads
it as a withdrawal. Nothing in his Teleprompter is deleted.
