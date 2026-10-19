# Monday release gates: 19 October 2026

Target: content-engine, branch codex/monday-release-gates from main b991871.
Production: content-engine-flame-nu.vercel.app; private board content.krishraja.com.
North Star contribution: finish Monday's publishing work without another paid fact run or repeated caption decisions.

Krish approved: "Approve the auditable manual-review route". He also accepted
both current final videos: "I watched both; accept playback". Monday's no-spend
hold remains in force. Wednesday starts only after Monday is publish-ready.

The manual route is POST /api/content-ideas/:id/fact-check with action
manual_review. It requires the operator bearer, Krish's approval words, the
exact contradicted sentence and checker run, article/source hashes, a reason,
and an exact quote from a filed verbatim HTTPS source. It stores a separate
fact_manual_reviews history; the automated verdict remains untouched. The
GET exposes all and active reviews. A new body, source set or checker run
invalidates the acceptance. Repeated identical requests return the original
receipt. The row's updated_at lease prevents lost updates. No provider call
is made. Ordinary sign_off still refuses contradicted claims.

Pass signals: stale/missing evidence, non-operator writes and concurrent writes
fail closed; original verdict and history survive; repeated calls are
idempotent; live GET and making-record status agree. Tests cover these cases.
Rollback: revert the PR through GitHub and redeploy the previous main revision
b99187110e60d8ac067c7f5a9e8cb5c774f9f8c2. The separate audit history remains in
metadata; the prior runtime ignores it, restoring the original fact hold.
No interaction data or source records are removed.

The dated OpenAI changelog was reread on 19 October at
https://developers.openai.com/api/docs/changelog. The August 21 entry supports
the filed promotional-price passage. The source receipt is dated-source-receipt.json.

Playback acceptance is bound to both exact MP4 hashes in playback-acceptance.json.
Technical measurements and human acceptance must remain distinct; sampled
frames and automated sync estimates are not a claim of continuous agent listening.
