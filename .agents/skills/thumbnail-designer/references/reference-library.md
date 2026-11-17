# The reference library

Reference for `.agents/skills/thumbnail-designer/SKILL.md`, step 1. The references a thumbnail is designed against are
Krish's own inspiration board: the Production Inspo cards (Drive, `Ventures > Inspiration > Production Inspo`;
`docs/DRIVE.md`), which Control Centre's inspiration board shows as cards. A card he ticked as a style to use is an
instruction, not a suggestion (`.agents/skills/ve/references/board-references.md`).

## Reading them

- Start with the thumbnail reference set: `GET /api/inspiration/candidates?role=thumbnail&limit=10`. It offers his
  thumbnail study first (the files he filed together in a subfolder of an Inspo folder, such as "VEED Studio - Instagram
  Thumbnail Study"; each candidate's `collection` names the set), then any card the engine's read says teaches a
  thumbnail. A read grounded in his own words (`style.grounded: true`, `grounded_in`) is his steer; a bare read is a
  guess. Read the set before drawing, and still look at each card you name (below).
- Find the cards through the routes that already read them: the board's cards by id (`GET /api/inspiration/cards`,
  as `scripts/velib/board.py` reads them), and the style bank's entries in `config/style-references.json`.
- Open each one by its Drive id with the Drive connector, or fetch it with
  `python3 scripts/quick-edit/references.py fetch --out .cache/references` (an ignored folder). Never save one inside a
  tracked folder of this repository.
- No outside image ever enters the repository: not a card, not a screenshot of one, not a crop. The brief names a
  reference by its card and its source, never by a file here.

## When a reference counts

A reference goes in the brief only when all four hold:

1. **It is sourced**: its card id or name, and where it lives (its Drive file id or an https link).
2. **It was actually looked at**: you opened it in this session, and `looked_at` says when. A card picked from its
   title alone does not count.
3. **It is not a near copy of another**: two cards that teach the same thing count as one; keep the clearer one.
4. **It carries a note on why it works**: one line on what it does that this thumbnail should learn from ("one
   number fills the tile", "the product's own screen, cropped tight"), never "looks good".

A reference teaches a principle, never a layout to copy. The options stay in the Receipt and the week's one skin.
