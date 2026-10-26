import { readFileSync } from 'node:fs'
import { briefProblems, MEDIA_STANDARD, MEDIA_STANDARD_HASH } from '../packages/core/src/media-quality.js'
import { assertQualifiedFile, assertProductionBrief } from '../packages/core/src/media-delivery.js'
import { mediaQualityEnforced, mediaQualityRollout } from '../packages/core/src/media-rollout.js'

const [command, path, piece] = process.argv.slice(2)
try {
  if (command === 'rollout') console.log(JSON.stringify({ ok: true, enforced: mediaQualityEnforced(), rollout: mediaQualityRollout() }))
  else if (command === 'show') console.log(JSON.stringify({ standard: MEDIA_STANDARD, standard_sha256: MEDIA_STANDARD_HASH }))
  else if (command === 'brief' && path) {
    const problems = briefProblems(JSON.parse(readFileSync(path, 'utf8')))
    console.log(JSON.stringify({ ok: !problems.length, problems, standard_sha256: MEDIA_STANDARD_HASH }))
    if (problems.length) process.exitCode = 1
  } else if (command === 'delivery' && path) {
    await assertQualifiedFile(path, piece)
    console.log(JSON.stringify({ ok: true, standard_sha256: MEDIA_STANDARD_HASH }))
  } else if (command === 'production' && path) {
    await assertProductionBrief(path, true)
    console.log(JSON.stringify({ ok: true, standard_sha256: MEDIA_STANDARD_HASH }))
  } else throw new Error('Use media-standard.ts show | brief BRIEF.json | delivery FILE [PIECE]')
} catch (e) { console.error(e instanceof Error ? e.message : 'media standard check failed'); process.exitCode = 1 }
