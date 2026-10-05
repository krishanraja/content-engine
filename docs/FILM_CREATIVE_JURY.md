# Film creative jury

> Scope: a check for Studio films that lives in the content engine (`apps/control-plane/api/_judges/film.ts`); no route calls it yet. For the whole system start at `README.md`.

The Content Engine has a permanent, demanding jury for Mindmake films. It examines idea, strategy, story, business consequence, functional clarity, art direction, cinematography, editing, sound, finish, format fitness, accessibility and integrity. A separate prosecutor makes the strongest case against shipping.

The jury is benchmarked against the published criteria for [Cannes Lions Film](https://www.canneslions.com/awards/lions/film/what-you-need-to-know), [Film Craft](https://www.canneslions.com/awards/lions/film-craft), [Creative Strategy](https://www.canneslions.com/awards/lions/creative-strategy), [Digital Craft](https://www.canneslions.com/awards/lions/digital-craft/what-you-need-to-know) and the [Integrity Standards](https://www.canneslions.com/awards/awards-support/integrity-standards). This is an internal standard, not an affiliation with Cannes Lions or a claim to reproduce its jury process.

## Operating contract

- One judge owns one question.
- Every judge works independently and cannot see the others.
- Every verdict cites a frame, timecode, artifact or user test. Unsupported opinion is an abstention.
- Facts and direct observation stay separate from inference.
- Scores are never averaged. The report preserves the lowest and highest non-adversarial scores, all kills and revisions, the prosecution and material dissent.
- The panel reports. Krish decides.
- Running the core jury spends no model or generation credits. A future visual evaluator may call models outside the pure jury module, but only against an approved evidence packet and budget.

The implementation lives in [`api/_judges/film.ts`](../apps/control-plane/api/_judges/film.ts). Its structural guard runs with the rest of the control-plane checks.

## Evidence packet

Every review binds to an exact artifact hash and records the stage honestly: style test, animatic, rough cut or final. The minimum useful packet contains:

1. The review master and technical metadata, including runtime, dimensions, frame rate, streams and decode result.
2. A time-indexed contact sheet dense enough to reveal the whole sequence.
3. Full-resolution frames for every claimed strength, failure or generative artifact.
4. The accepted brief and the exact public meaning the viewer is expected to take away.
5. Hard-gate inspection results, with the inspection method and limitations.
6. Muted comprehension evidence from unfamiliar viewers when semantic clarity is being claimed.
7. Crop, playback, reduced-motion and accessibility evidence when judging a final release.
8. Asset, claim, provenance, rights and redaction records when judging integrity.

Missing evidence produces an abstention or an unverified hard gate. It never produces a guessed pass.

## Mindmake film hard gates

The reusable jury includes eight release gates. Four are fatal constraint failures; four require revision before production or release.

| Gate | Requirement | Effect when failed |
| --- | --- | --- |
| Object only | No people, faces, hands, silhouettes, skin, human reflections, robots or anthropomorphic AI | Kill |
| Writing contract | Writing is limited to approved diegetic division plaques and the designed sign-off stamp | Kill |
| Evidence honesty | Real evidence, generated illustration and reconstructed demonstration stay distinct | Kill |
| Privacy and rights | No private information, unapproved likeness or unlicensed asset | Kill |
| Muted semantic chain | An unfamiliar viewer can state input, work, output and consequence while muted | Revise |
| Human authority | The final consequential decision visibly remains unresolved for human approval | Revise |
| No text rescue | The visual story remains clear when plaques and stamp are masked | Revise |
| Use context | The release is proven in every website, presentation and talk context it claims | Revise |

## The award-ready signal

`award_ready` is deliberately difficult to earn and is never an automatic approval. It is true only when:

- every hard gate passes or is genuinely not applicable;
- no judge abstains, kills or asks for revision;
- every non-adversarial judge scores at least 8 out of 10;
- the prosecutor's strongest objection scores no more than 3 out of 10.

An early prototype can be highly promising without being award-ready. The system judges the artifact at its real stage and does not pretend absent sound, crops, accessibility assets or audience tests already exist.

## Credit gate

No Higgsfield generation starts because a film is beautiful or because its average score would have been high. Before a new cinematic render, the approved credit-free animatic must pass object-only and writing constraints, and must score at least 8 on the three-second read, causal story, role identity and business consequence. Human authority and muted semantic-chain gates must also pass. Krish remains the production gate.
