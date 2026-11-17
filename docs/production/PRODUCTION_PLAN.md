# The production plan

Krish, 2026-11-17: "it should look for the recorded audio or video in the inbox, bring the file in to the piece, and
create the final production plan for me to open, review and then press the Claude production prompt button to copy the
final e2e prompt to the clipboard [...] The UI should also have mocked up 2 or 3 scenes using my real content stills
using the visual styles I selected, and give me the final opportunity to switch something out if it does not work".
And: "it should also leverage the https://github.com/krishanraja/higgsfield-generator where needed in post production".

## The route

1. His **My takes are in the Inbox** press reads the Video Engine Inbox, puts the takes named for the piece on it
   (`meta.takes_in`; video or audio, his Teleprompter `.aac` included) and starts `production-plan.yml` for the piece.
2. The run (Claude Code in GitHub Actions, on his subscription) makes the plan by the steps below and files it on the
   piece: the scene stills as image materials (role `plan_scene`), then the plan as one JSON material (role
   `production_plan`). The card shows "being made" until the plan is filed.
3. The card's **Open the production plan** shows the edit numbers, the two or three mocked scenes and every beat with
   its picture. On any beat he can press **Use this** on another option (saved on the week's picks as
   `plan-<8 hex>`, kind `plan_swaps`, bound to the plan's sha256). The plan file never changes.
4. **Claude production prompt** copies the one prompt with the plan and his swaps in it (`_takesIn.ts`
   `productionBrief`, `_productionPlan.ts` `planBrief`). He pastes it into a new session, which makes the cut.

## The run's steps

1. Fetch each take: `python3 scripts/post-pack/recording.py get "NAME" --wait 15` (names in `meta.takes_in`, read with
   `board_session.py PIECE show`).
2. The edit pass, by rule: `python3 scripts/post-pack/edit_pass.py --transcribe TAKE --words-out words.json --cap 90
   --out edit.json` for a short (no `--cap` for a long cut). It finds the restarted sentences (keeps the last full
   attempt), cuts silences longer than 0.6 s to a breath, measures the kept length and the even speed-up that brings a
   short under 90 seconds (never past 1.25x). Read its restarts against the approved words: a "restart" that is his
   script saying a phrase twice on purpose is kept, and the plan says so.
3. Plan the picture for every beat on the edited timings: what the words say, then the one picture that makes it land
   faster (AGENTS.md rule 6). The kinds: `face` (him on camera; video takes only), `logo` (official files only),
   `real_image` (a real photo or footage of what he names, from its source), `screenshot` (the real page or product he
   names), `social_post` (a real viral post that relates to his words, with its link), `motion` (a ve device or a Codex
   plate in his picked motion style), `generated` (a scene made with the higgsfield-generator skills,
   krishanraja/higgsfield-generator), `humour` (a comic absurdity on a line that carries one). Give each beat one or two
   other good options of a different kind, so he has something real to swap to.
4. The humour: read krishanraja/humour-engine's README (section 4, integrating) and ask it what comic readings his own
   words carry; read his humour style from ai-harness (krish-principles, krish-voice). A gold moment is a line of his
   whose own words carry the joke: "your software engineer is as confident as a crocodile hunter" becomes a nerdy
   engineer creeping up on a crocodile. List each with the words, the mechanism and the picture. Never invent a joke
   his words do not carry; never aim one at the viewer or at a named person's competence.
5. Mock two or three scenes, the beats that best show the look: a real still (a frame of his take,
   `--frame TAKE --at SECONDS`, or a real image saved from its source, `--image FILE`) drawn by
   `python3 scripts/post-pack/plan_scene.py` in his picked caption face and the series colour. Nothing is generated for
   a mock. File each: `python3 scripts/post-pack/board_session.py PIECE add scene-b3.png --role plan_scene --title
   "Scene b3: ..."`, and keep the material id it prints.
6. Write `plan.json` (below) under `docs/plans/<Monday>-week/`, check it parses, and file it:
   `python3 scripts/post-pack/board_session.py PIECE add plan.json --role production_plan --title "Production plan"`.
   Report done on the piece with the edit line.

## plan.json

```json
{
  "version": 1,
  "piece_id": "<the piece uuid>",
  "made_at": "2026-11-17T22:40:00Z",
  "takes": ["Which of your habits ... short cut.aac"],
  "edit": { "raw_seconds": 101.2, "restarts": [{ "at": 14.2, "said": "The habit that" }], "silences_cut": 9,
            "kept_seconds": 93.4, "cap_seconds": 90, "speed": 1.064, "final_seconds": 87.8 },
  "style": { "look": "<treatment id>", "motion": "<motion style id>", "captions": "<caption style id>" },
  "beats": [
    { "id": "b1", "from": 0.0, "to": 4.1, "words": "Which of your habits will cost you your job?",
      "picture": { "id": "face", "kind": "face", "what": "Him to camera, tight", "source": null },
      "options": [ { "id": "post", "kind": "social_post", "what": "The LinkedIn post ...", "source": "https://..." } ],
      "humour": null }
  ],
  "scenes": [ { "beat": "b1", "still": "<plan_scene material id>", "caption": "Which habit costs you your job?",
                "style": "<caption style>, <motion style>" } ],
  "humour": [ { "words": "as confident as a crocodile hunter", "mechanism": "incongruity", "beat": "b4",
                "gag": "A nerdy engineer in a khaki hat creeping up on a crocodile" } ]
}
```

Ids are lower case letters, digits, `-` and `_`. Kinds are the eight above. A beat's `options` never repeat its
`picture`. At most three scenes, each on a beat of the plan, each still a material filed on this piece.
