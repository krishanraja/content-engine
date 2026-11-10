# Eye contact: how to record for it, correct it and check it

Krish, 5 Nov 2026: eye gaze correction "for all post-processing of my makeyourmindup videos". 9 Nov: "Highest of high
standards we're going to need some significant work on the eye gaze", "make it stronger, the eye contact needs to be
visible", then "Do both" (Maxine's own eye on the big glances, and fix it at recording). The Maxine eye was built and
failed two blind reviews, so it is opt-in; what makes eye contact visible is the recording (section 1).

This is the one how-to. What it measured and what is still open is in `STATUS.md` (the eye gaze lines). The code is
`scripts/velib/eyeline.py` (the pass), `scripts/velib/eyeline_review.py` (the blind sheets and numbers),
`scripts/velib/maxine_pod.py` and `.github/workflows/maxine-trial.yml` (the Maxine run); tests are
`tests/ve_eyeline_test.py`.

## What it does

`ve eyeline` turns his eyes back toward the lens on a take, before ingest, and changes nothing else: the take's sound
is copied untouched and every frame time is kept (checked before the file is kept). Per frame, for both eyes together:

| What the take shows | What the pass does |
|---|---|
| Reading drift, up to about 16 degrees off the lens | Pushes his own eye sideways toward the lens: one resample, the iris travels whole with its own colour and catchlight, pinned at both eye corners. |
| A held glance past about 16 degrees (0.6 iris radii), both eyes open, head frontal | The push brings it part of the way (about 45 degrees of iris travel at most). **Off by default, `--maxine-eye` to try:** lays in Maxine's own eye, lids included, with his own iris and catchlight set where Maxine drew the iris. It makes the big glances visibly come back, but two fresh blind readers on 9 Nov blocked it (7 of 66 moments each, every one a Maxine eye): in the window light his right iris reads grey at a glance, and turned to the lens beside his brown left iris the eyes look two colours; a big move also softens the iris edge, and a closing lid cuts a moved iris flat. Never publish a take made with it without a blind review that passes. |
| Under 3 degrees off | Nothing. |
| A blink or closing eye, a squint (under 55% of the iris in view), a look well up or down (white under both irises, or the upper lid over a third of each), a head turned past 15 degrees, no face | Nothing: left exactly as filmed. A glance up and to one side that shows neither is a glance, and is corrected. |

His upper lid is lowered a little where the iris is moved, to cover it as it does when he looks at the lens (that
takes out the stare). Nothing moves up or down: a vertical push stretched the catchlight against the lid.

What it cannot do: his eyes rest about 4 degrees **below** the lens when he reads, on almost every frame. The pass
leaves that as filmed, because no clean edit removes it. Only the recording can (next section).

## 1. Record for it (the fix at the camera)

On Wednesday 11 Nov's takes (ai-music-short and ai-music-long), his gaze while reading sat a median 8 degrees from the
lens: about 4 degrees below it, and sweeping sideways about 7 degrees as his eyes cross each line. Nothing in post
removes that as cleanly as the camera can:

- **Put the reading line on the lens.** In the Teleprompter app, set the reading position (the line he reads from) as
  close to the camera as the app allows. Text below the camera pulls his eyes down; that is the 4 degrees.
- **Narrow the text column.** Each line his eyes cross is a sideways sweep. At 1 m from the lens, a column 6 cm wide
  keeps the sweep within about 1.7 degrees either side; at 60 cm, keep it to about 4 cm. Fewer words per line, larger
  type.
- **Stand further back from the lens** when the framing allows: the same column subtends a smaller angle from further
  away (the angle is about the column's half-width over the distance).
- **Look into the lens for the hook and the close.** Those two lines matter most and are short enough to say from
  memory. A glance away while thinking is natural and the pass leaves short ones alone.
- Check a take straight away: `ve faces <piece> --take <id>` (after ingest) names the windows where he is off the lens,
  and `eyeline_review.py` (section 5) reports the median distance from the lens.

## 2. Make the Maxine copy (spend: Krish approves each run)

Maxine (NVIDIA Eye Contact NIM, licensed for his own channels, Krish confirmed with NVIDIA on 6 Nov) runs on a rented
GPU from GitHub Actions. It gives the pass where the lens is, per eye; with `--maxine-eye`, also its own eye for the big glances.

Dispatch **Maxine eye contact trial** (`.github/workflows/maxine-trial.yml`), from the Actions tab or with the GitHub
API, with:

| Input | Value |
|---|---|
| `take` | the recording's name in the store, e.g. `ai-music-short.mp4` (`python scripts/post-pack/recording.py list`) |
| `confirm` | exactly `spend approved by Krish`, and only when he has, for this run |
| `image` | `1.5.0` (pinned: `latest`, 1.5.1, refused a take 1.5.0 took) |
| `variants` | `{"b40": ["--bitrate", "40000000", "--detect-closure", "1", "--eye-size-sensitivity", "2"]}` |
| `clip_seconds` | `0` (the whole take) |
| `split_seconds` | `0` for a take up to about 100 s; `90` for a longer one (the NIM refused the 315 s take whole; chunks are cut on forced keyframes, run on the one pod and joined frame for frame) |
| `max_minutes` | `30` (`40` with `split_seconds`): the image pull alone takes about 10 minutes |
| `max_usd` | `0.25` (`0.35` with `split_seconds`): a cap, not a charge |

Cost seen: $0.04 for the 96 s take on an RTX A4500, about 13 minutes with the image pull. It writes one artifact,
`maxine-<run id>`, kept 3 days: `<take>.maxine.b40.mp4` (or `<take>.maxine.joined.mp4` with `split_seconds`), the
re-encoded `clip.<take>` the NIM saw, and the pod's receipt. Fetch it with
`gh run download <run id> -n maxine-<run id> -D <dir>` (or the Actions API: artifacts, then zip).

`take=entitlement-check` (free, no GPU) says whether the NGC key can pull the image and lists its tags.

A take without its own Maxine copy can still be corrected for the reading drift: give it `--lens` with the receipt of
another take of the same recording session (section 4). It cannot use `--maxine-eye`.

## 3. Set up the machine (once)

- Python 3.12 with `mediapipe==0.10.21` (the version pinned in `requirements.lock.txt`), `opencv-contrib-python`
  4.11 and numpy 1.26. A virtual environment keeps them apart from anything else:
  `python3.12 -m venv ~/ve312 && ~/ve312/bin/pip install mediapipe==0.10.21`.
- `libegl1` on Linux (`apt-get install -y libegl1`), for MediaPipe.
- ffmpeg n8.1.2 from `. scripts/ve-env.sh` (Bash).
- The face model is fetched once to `.cache/models/face_landmarker.task` (pinned by sha256).
- Fetch the takes: `python scripts/post-pack/recording.py get <name>` (to `.cache/recordings/`).

## 4. Correct the takes

With the take's own Maxine copy (best):

```
python scripts/ve.py eyeline <piece> --media <take> --backend maxine --maxine-copy <take>.maxine.b40.mp4
```

Add `--maxine-eye` only to try Maxine's own eye on the big glances (the table above): it failed two blind reviews,
so its file is published only after a blind review of that take passes.

Without one, on a take from the same session as a take that has one (drift only):

```
python scripts/ve.py eyeline <piece> --media <take> --lens <piece ve dir>/eyeline/eyeline.<that take>.json
```

It writes into `<piece ve dir>/eyeline/` (or `--out <dir>`): `<take>.eyeline.mp4`, the receipt `eyeline.<take>.json`
(frames corrected, `maxine_eye_frames`, the lens point and head pose, the settings, any problem), and the Critic's
strips and eye loop (`--no-qc` skips them and the full-rate read-back). It takes about 2.5 minutes for a 96 s take
plus the reads. Exit 0 keeps the file; exit 1 refuses and keeps nothing, naming why.

Then ingest the corrected file: `ve ingest <piece> --take <id> --media <take>.eyeline.mp4 ...` (RUNBOOK.md, S3).

## 5. Check it: a blind review, every time

Nothing is called ready from the numbers (AGENTS.md rule 6). For each corrected take:

```
python scripts/velib/eyeline_review.py <take> <take>.eyeline.mp4 --out <dir> --readings <dir> --lens <eyeline receipt>
```

(`--copy <maxine copy>` instead of `--lens` measures against the copy directly.) It writes:

- `sheet.<stem>.<n>.jpg`: every flagged moment of the take (each off-lens window, blink, look up or down, head turn
  and the biggest moves), each as panels X and Y in a random order, both eyes at 2x and the face at 1x, sheets under
  2,000 px tall so a reader sees them at full size;
- `key.<stem>.json`: which panel is the corrected one. Keep it from the reviewer;
- `numbers.<stem>.json`: distance from the lens before and after, iris colour change (CIE76; untouched frames read
  about 1.0 at the median, the re-encode floor), catchlight, lid opening, blinks and every blink the corrected file
  lost (a half-blink on the 0.5 line can show here; look at it before calling it lost).

Give only the sheets to a fresh reviewer (never the producer) with this brief: judge every moment for artefacts in
either panel (iris colour, catchlight, iris edge, eye opening, the whites, lids and lashes), say which panel looks at
the camera more at face size, and give PUBLISH or DO NOT PUBLISH with every blocking moment. Then score their notes
and picks against the key. Stills cannot show flicker: Krish watches the cut at full size at his gate.

## When it refuses or looks wrong

| What you see | Why, and what to do |
|---|---|
| `its copy has N frames and the take M` | The Maxine copy is not this take, or a chunk failed. Re-run the dispatch for this take. |
| The NIM says `Only H.264 8-bit videos with Constant Frame Rate are supported` | Use `image=1.5.0`; for a take over about 100 s add `split_seconds=90`. |
| The same error on a 48 fps phone export (10 Nov) | The workflow now re-encodes any take above 30 fps to 30 fps before the NIM sees it (suspected cause: the NIM took 30 fps takes and refused 48 fps). |
| `time cap ... reached`, runtime none | The image was still pulling: raise `max_minutes` to 30 (40 with chunks). |
| `not one setup` with `--lens` | His head sat more than 4 degrees from where it sat on the calibrated take: make this take its own Maxine copy. |
| `not the receipt of a Maxine eyeline run` | `--lens` needs the receipt of a run with `--backend maxine` that recorded both eyes' lens points. |
| `changed nothing on N frames` | The Maxine copy equals the take (the wrong file was given). |
| A frame count or sound refusal | The pass never keeps such a file; check the take is the one ingested. |
| ImportError for cv2 or mediapipe, or an EGL error | Section 3. |
| A glance left looking away | It was short (under 4 frames), a look up or down, a turned head, or the take had no Maxine copy. |
