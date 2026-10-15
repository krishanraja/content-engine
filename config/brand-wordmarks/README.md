# Official wordmarks, by hash

Every official wordmark pinned in `config/studio.json` is kept here, named by its
own sha256, so a render never depends on the repository the mark came from
staying public. `krishanraja/control-center` went private on 2026-10-15 and its
raw URLs began answering 404.

`packages/core/src/brand-assets.ts` reads a mark from the runner's cache, then
from here, and only then from the pinned source repository. Wherever the bytes
come from, they must hash to the pinned sha256 or the render refuses.

A newly pinned mark goes here in the same change that pins it:
`tests/brand-assets.test.ts` fails when a pinned mark has no copy here or a copy
here does not hash to its name. Never edit a file in place: a changed mark is a
new hash, a new file and a new pin.
