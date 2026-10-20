# Wednesday scripts: draft-review record

20 October 2026. Piece d7a20885-7001-4661-b444-9d7ca1043416.

## Status and authority

Krish asked for both spoken drafts on the existing live board, with editing and comments. He asked for the long cut to feel like a science experiment, with humour and real-world visuals planned throughout, produced after copy approval. These are editorial drafts, not approved recording scripts. Nothing is sent to Teleprompter, posted, booked, cancelled or purchased in this step.

The work moves the repository North Star by bringing an existing article to two reviewable video scripts. It adds no production pipeline or general taste rule.

## Source and checks

The merged PR #120 revision, `620cdb3c5fc804ad24f4ba8fcf0307cadc89ef04`, supplied the article and evidence boundaries. Krish's live article save, revision 1 of `wed-article-draft`, adds his phishing-email sentence. The live board comment supplies the experiment/visual direction. Both weeks' six feedback collections were read before building. No unrelated private evidence was opened.

The final draft word counts, hashes and reading checks are in `wednesday-script-checks.json`. Both cuts pass the length, plain-language, sentence-length, quotation and jargon checks. Both pass `voice_check.py` at its existing threshold. These mechanical checks do not establish Krish's approval or exact delivery time.

Board verification and authoritative live readback passed. Both TypeScript typecheck stages passed. The full local `npm run verify` then stalled at Vitest startup without reporting test results; that attempt was stopped rather than reported as a pass. The existing skill, public-copy, secret, workbench and repository-map checks were run separately. GitHub CI remains the full-suite merge gate.

The full `--series under_the_hood` checker reports two identity-placement failures for each script: it requires "I'm Krish" at the start and prohibits it at the end. The supplied piece-specific handover explicitly requires the opposite placement. The drafts therefore retain the exact Wednesday series sentence first and "I'm Krish" once at the end. Those two checker findings remain recorded, not falsely marked passed. Shared rules and tools are unchanged. Resolve that exception through the existing recording gates before a Teleprompter send.

## Separate readers

The repository make-piece skill explicitly calls for fresh manager read-backs and a narrator explainability reader. Separate agents received only their role prompt and the spoken words (or the single script file), without the article or editorial brief. This was simulated reading, not human playback.

Three rounds reviewed the long cut. Every reader retold the intended decision correctly: assistants can produce polished mistakes; useful help questions the request, asks for human decisions and admits gaps; the small personal trials establish no winner. One final-round manager reported "nothing"; the other asked for clearer references to the rejected scam emails, the old forecast and the extras table. Those lines were simplified afterwards. The narrator asked how the scam classification was established and how to judge reliable refusal. The former comes from Krish's explicit confirmation; no theft mechanism or investigation was invented. The latter is bounded by the preceding instruction to test the team's actual work; the closing line is Krish's locked choice.

Two rounds reviewed the short. Every retelling recovered the same point. The final-round narrator reported "nothing". Managers asked for clearer bag inclusion, stopover wording, the order of the different-inbox limitation and the table reference. Those were simplified afterwards.

These outcomes are not a unanimous fresh-reader pass on the final exact words. The drafts remain in review. After Krish's edits, rerun the mechanical checks and fresh read-backs on the approved exact text before recording or sending to Teleprompter. Do not turn a reader observation into Krish's preference or mark his silence as approval.

## Visual scope and board preservation

The separate visual plan maps each evidence beat to the viewer's question and the supplied result, using anonymised reproductions where possible. It includes the scam comparison, trip timeline, correction and duplicate-draft sequence, fee decision, send-permission prompts, cancellation sequence, all-three countercase, limitations, extras and plain-cell takeaway table. No images, screenshots, title options or video assets were generated.

The existing engine builder (`docs/plans/2026-10-19-week/update_wednesday.py` supplies the established build route) renders the board. Six existing Wednesday review IDs and their order remain; the five-minute script, short script and visual plan are appended. The existing special display label "Five everyday tests" retains its `four-draft-only-tests` ID. The Ideas, Monday and Friday panels are checked byte for byte; all 24 immutable assets are retained. Board activation uses an expected-build check and a fresh manifest readback. The interaction collections are separate from the HTML and are read back after activation.
