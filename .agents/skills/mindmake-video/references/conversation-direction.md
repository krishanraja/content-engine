# Conversation direction

## Source priority

Prefer isolated participant video and audio tracks because they preserve independent crops, reactions, dialogue repair, and speaker timing. Accept a mixed final when isolated tracks do not exist, but record the limitations and use conservative composition when a baked layout cannot be separated reliably.

Normalise every source independently, preserve its original hash and timebase, then align tracks without discarding drift evidence. Screen shares and presentation feeds are separate sources, not guests.

## Identity and privacy

Krish is always named Krish. Persistent recognition of Krish requires explicit local face enrolment. Voice is used only for job-local active-speaker timing in V2 and is not part of the durable identity profile. Store the encrypted face template outside GitHub and put only an opaque profile ID and version hash in manifests. Revocation removes the local profile and prevents future automatic recognition until reenrolment.

Guests receive anonymous, job-local track identities unless the job contains verified speaker metadata. Do not persist guest biometric templates. Do not infer or correct a guest's identity from resemblance or an ASR approximation.

Identity and active-speaker confidence are distinct. Low-confidence or conflicting results require review and fall back to a stable multi-person or mixed-feed composition.

## Editorial direction

Anchor the Short on Krish's strongest self-contained idea, but retain a guest's visible or audible contribution when it is needed for meaning, context, tension, or reaction.

- Cut to the active speaker when speech is the primary value.
- Use reaction shots only when the reaction adds information or emotional truth.
- Preserve overlap, laughter, interruption, or silence when removing it would change the relationship or meaning.
- Use J/L cuts and sound bridges to maintain continuity across visual changes.
- Do not manufacture a reaction by moving it away from its real context.
- When a speaker points, looks, demonstrates, or hands off an object, keep the relevant gesture and target visible or use a motivated cut to it.

For vertical composition, choose deliberately among single-speaker framing, speaker plus reaction, stacked participants, split screen, evidence plus speaker, and full evidence. Do not crop two people independently in a way that reverses their apparent eyelines or spatial relationship.

## Consent and failure cases

Record clipping, promotional use, likeness, voice, third-party material, and any cloud-processing permission separately where relevant. Rights and confidentiality remain hard gates.

Flag rather than guess when speakers overlap heavily, the active speaker is off-screen, audio and video drift, the only visible face is a listener, feeds are mirrored, a screen share obscures people, or the mixed source contains a baked split screen. Ask for isolated tracks or a precise pickup when the source cannot support a coherent premium edit.
