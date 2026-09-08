import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

// The replay registry and the artifact redactor decide, respectively, what may
// be re-run and what a failure is allowed to store. Both are the kind of file
// that goes quietly stale: a new cron lands, nobody adds it to JOBS, and the
// recovery path for it silently does not exist. This asserts the two stay in
// step with the routes and the schedule that actually ship.

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const failures: string[] = []
let checks = 0

function check(condition: boolean, message: string): void {
  checks += 1
  if (!condition) failures.push(message)
}

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

// ---------------------------------------------------------------- purity ---
// Both files are imported by tests and by this guard, which run with no
// database, no network and no key. An import of _supabase.js loads the client
// at module scope and throws when the env is unset, so a check covering these
// would not fail, it would not run. That already happened twice.
for (const pure of ['api/content-engine/_jobs.ts', 'api/_runArtifacts.ts']) {
  const source = read(pure)
  const imports = [...source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map(m => m[1])
  for (const specifier of imports) {
    check(
      specifier.startsWith('node:'),
      `${pure} imports ${specifier}; it must import nothing outside node: so the guard and its tests run without credentials`,
    )
  }
}

// ------------------------------------------------------- registry vs code ---
const jobsSource = read('api/content-engine/_jobs.ts')
const registered = new Map<string, string>()
for (const match of jobsSource.matchAll(/^\s{2}([a-z][a-z0-9_]*): \{ path: '([^']+)'/gm)) {
  registered.set(match[1], match[2])
}
check(registered.size > 10, `_jobs.ts registry parsed ${registered.size} entries; the regex has drifted from the file`)

// Every job that records itself must be replayable or explicitly refused.
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (entry.endsWith('.ts')) out.push(rel)
  }
  return out
}

const declared = new Map<string, string>()
for (const file of walk('api')) {
  if (file.endsWith('/_runs.ts')) continue
  for (const match of readFileSync(join(ROOT, file), 'utf8').matchAll(/withContentRun\(\s*'([a-z][a-z0-9_]*)'/g)) {
    declared.set(match[1], file)
  }
}
check(declared.size > 10, `found only ${declared.size} withContentRun jobs; the scan is wrong, not the code`)

for (const [job, file] of declared) {
  check(
    registered.has(job),
    `${file} records job '${job}' but api/content-engine/_jobs.ts does not list it, so it has no recovery path. Add it, marking it manual_only if re-running it costs money or deletes.`,
  )
  const path = registered.get(job)
  if (!path) continue
  // The registry's path must be the route that actually runs the job, or a
  // replay runs something else and reports success.
  const expected = `api${path.replace(/^\/api/, '')}.ts`
  check(
    file === expected,
    `_jobs.ts maps '${job}' to ${path} (${expected}) but withContentRun('${job}') is in ${file}`,
  )
}
for (const job of registered.keys()) {
  check(declared.has(job), `_jobs.ts lists '${job}' but no route records it; the entry is stale`)
}

// ---------------------------------------------------- registry vs schedule ---
const crons = JSON.parse(read('vercel.json')).crons as { path: string; schedule: string }[]
const registeredPaths = new Set(registered.values())
for (const cron of crons) {
  check(
    registeredPaths.has(cron.path),
    `vercel.json schedules ${cron.path} but no job in _jobs.ts points at it, so a failure of it cannot be replayed`,
  )
}

// -------------------------------------------------------------- redaction ---
const artifactSource = read('api/_runArtifacts.ts')

// The prefixes of every credential family these routes actually handle. A
// redactor that misses one writes it into a table and then into an eval case.
for (const prefix of ['sk', 'rt', 'ex', 'pk', 'sbp', 'vcp', 'ghp']) {
  check(
    new RegExp(`[|(]${prefix}[|)]`).test(artifactSource),
    `_runArtifacts.ts does not redact ${prefix}_ prefixed tokens; this repo handles them`,
  )
}
check(/eyJ/.test(artifactSource), '_runArtifacts.ts must redact JWTs: the Supabase service key is one')
check(/Bearer/.test(artifactSource), '_runArtifacts.ts must redact Authorization values')
check(
  /SECRET_KEY\s*=\s*\/\(/.test(artifactSource) && /secret\|token\|key/.test(artifactSource),
  '_runArtifacts.ts must redact by key name as well as by value shape',
)
check(
  /depth >= 2/.test(artifactSource),
  '_runArtifacts.ts must cap walk depth; an unbounded walk over a fetch error reaches the request headers',
)

// The kind vocabulary is a CHECK constraint in the database. A route writing a
// value the table refuses fails in production and nowhere else, which is
// exactly how the inspiration artifact vocabularies shipped broken once.
const migration = readFileSync(join(ROOT, '..', '..', 'supabase', 'migrations', '20260912090000_run_artifacts.sql'), 'utf8')
const constraint = migration.match(/kind in \(([^)]+)\)/)
check(Boolean(constraint), 'the run artifacts migration no longer declares a kind CHECK constraint')
if (constraint) {
  const allowed = [...constraint[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort()
  const code = artifactSource.match(/ARTIFACT_KINDS = \[([^\]]+)\]/)
  check(Boolean(code), 'ARTIFACT_KINDS is no longer a literal array in _runArtifacts.ts')
  if (code) {
    const declaredKinds = [...code[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort()
    check(
      JSON.stringify(allowed) === JSON.stringify(declaredKinds),
      `ARTIFACT_KINDS ${JSON.stringify(declaredKinds)} does not match the table's CHECK constraint ${JSON.stringify(allowed)}`,
    )
  }
}

// ------------------------------------------------------------ replay route ---
const replaySource = read('api/content-engine/runs/replay.ts')
check(
  !/req\.headers\.host|req\.headers\['host'\]/.test(replaySource),
  'replay.ts must not build its target URL from the Host header: the request carries CRON_SECRET and Host is caller-controlled',
)
check(
  /VERCEL_PROJECT_PRODUCTION_URL|VERCEL_URL/.test(replaySource),
  'replay.ts must take its host from the platform',
)
check(
  /guardOperatorOrCron\(req, res/.test(replaySource),
  'replay.ts must use guardOperatorOrCron: plain guard() fails open when ACCESS_CODE is unset, and this route can invoke every job in the engine',
)

// ------------------------------------------------- how contracts are imported ---
// `@mindmake/contracts` resolves at build time and fails at runtime. npm links
// the workspace package, the tracer resolves to its raw ./src/index.ts under
// node_modules, and that file is neither bundled nor executable by Node.
// Verified on a preview deployment: ERR_MODULE_NOT_FOUND for
// /var/task/node_modules/@mindmake/contracts/src/index.ts, behind a green build.
//
// This is the Phase 1 failure exactly: a control plane that builds clean and
// ships functions that cannot run. It cost a production readback to find once.
// The relative path works because the whole repo is the deployment root, so the
// file is compiled like any route.
for (const file of walk('api')) {
  const source = readFileSync(join(ROOT, file), 'utf8')
  // Any import form, not just `from '…'`. The first version of this check only
  // matched the `from` form and passed a bare side-effect import, which is the
  // same runtime failure. Caught by testing the guard against the bad code.
  check(
    !/['"]@mindmake\/contracts(?:\/[^'"]*)?['"]/.test(source),
    `${file} names @mindmake/contracts. That resolves during the build and throws ERR_MODULE_NOT_FOUND at runtime. Import the source relatively instead, the way _runnerContracts.ts does.`,
  )
}

// --------------------------------- contracts dependencies are declared here ---
// Vercel installs this app's package.json, not the workspace root's, so a
// package the contracts source imports is absent at runtime unless the control
// plane declares it too. The five runner routes shipped a green build and then
// answered 500 to everything with
// "Cannot find package 'zod' imported from /var/task/packages/contracts/src/index.js":
// the contracts file compiled and shipped, its dependency did not.
//
// Versions must match exactly. Two copies of zod would mean a schema built by
// one and parsed by the other, which fails in ways that look like bad data.
{
  const contractsPkg = JSON.parse(readFileSync(join(ROOT, '..', '..', 'packages', 'contracts', 'package.json'), 'utf8'))
  const appPkg = JSON.parse(read('package.json'))
  const appDeps: Record<string, string> = { ...appPkg.dependencies, ...appPkg.devDependencies }
  for (const [name, version] of Object.entries(contractsPkg.dependencies || {}) as [string, string][]) {
    check(
      appDeps[name] === version,
      `apps/control-plane/package.json must declare ${name}@${version}, the version @mindmake/contracts uses. It is ${appDeps[name] ? `pinned to ${appDeps[name]}` : 'absent'}, so the deployed function cannot load the schemas it imports.`,
    )
  }
}

if (failures.length > 0) {
  console.error(`FAIL ${failures.length} of ${checks} run recovery checks`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`PASS ${checks} run recovery checks (${registered.size} jobs, ${crons.length} crons)`)
