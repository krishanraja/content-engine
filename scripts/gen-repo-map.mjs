#!/usr/bin/env node
// Writes docs/REPO_MAP.md: the directories, the exported signatures of every TypeScript module (no bodies), the
// content engine's routes and the Studio's stations. A session reads this map instead of opening files to find
// where something lives. It reads committed (indexed) files only, so files a run leaves behind never change it. `--check` fails when the committed map is stale; `npm run verify` runs it.
//
// Usage: node scripts/gen-repo-map.mjs [--check]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'REPO_MAP.md')
const MAX = 120

// now-notes/ holds closeout notes only until the fold moves them into NOW.md, so the map never lists it: a branch
// carrying a note would otherwise fail check:repo-map, and main would go stale again at the fold.
const tracked = execFileSync('git', ['ls-files', '--cached'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/).filter((file) => file && file !== 'docs/REPO_MAP.md' && !file.startsWith('now-notes/')).sort()

const oneLine = (text) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > MAX ? `${flat.slice(0, MAX - 1)}…` : flat
}

// The first line of a file's leading comment, when it has one.
function purposeOf(source) {
  const match = source.match(/^(?:#![^\n]*\n)?\s*(?:\/\/ *([^\n]+)|\/\*\*?\s*\n?\s*\*? *([^\n]+))/)
  const line = (match?.[1] ?? match?.[2] ?? '').replace(/\*\/\s*$/, '').trim()
  return line && !/^(?:eslint|@ts-|prettier)/.test(line) ? oneLine(line) : ''
}

function exportsOf(file) {
  const source = readFileSync(join(ROOT, file), 'utf8')
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const exported = (node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  const text = (node) => source.slice(node.getStart(sf), node.end)
  const lines = []
  for (const node of sf.statements) {
    if (ts.isExportAssignment(node)) {
      lines.push(`export default ${oneLine(text(node.expression)).slice(0, 60)}`)
      continue
    }
    if (ts.isExportDeclaration(node)) {
      lines.push(oneLine(text(node)))
      continue
    }
    if (!exported(node)) continue
    const isDefault = (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    const prefix = isDefault ? 'default ' : ''
    if (ts.isFunctionDeclaration(node)) {
      const head = source.slice(node.getStart(sf), node.body ? node.body.getStart(sf) : node.end)
      lines.push(oneLine(head.replace(/^export\s+(?:default\s+)?/, prefix)))
    } else if (ts.isInterfaceDeclaration(node)) {
      lines.push(`${prefix}interface ${node.name.text}${node.typeParameters ? `<${node.typeParameters.map((p) => p.name.text).join(', ')}>` : ''}`)
    } else if (ts.isTypeAliasDeclaration(node)) {
      // A short alias is shown whole; a long one by name, since its shape is one jump away in the file.
      const alias = oneLine(text(node.type))
      lines.push(`type ${node.name.text}${node.typeParameters ? `<${node.typeParameters.map((p) => p.name.text).join(', ')}>` : ''}${alias.length <= 60 ? ` = ${alias}` : ''}`)
    } else if (ts.isClassDeclaration(node)) {
      lines.push(`${prefix}class ${node.name?.text ?? '(anonymous)'}`)
    } else if (ts.isEnumDeclaration(node)) {
      lines.push(`enum ${node.name.text}`)
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const name = decl.name.getText(sf)
        const init = decl.initializer
        if (decl.type) lines.push(oneLine(`const ${name}: ${text(decl.type)}`))
        else if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          const head = source.slice(init.getStart(sf), init.body.getStart(sf)).replace(/\s*=>\s*$/, '')
          lines.push(oneLine(`const ${name} = ${head} =>`))
        } else lines.push(`const ${name}`)
      }
    }
  }
  return { purpose: purposeOf(source), lines }
}

// apps/control-plane/api/foo/[id]/bar.ts -> /api/foo/[id]/bar; index.ts names its folder. `_` files are helpers.
function routes() {
  return tracked
    .filter((file) => /^apps\/control-plane\/api\/.+\.ts$/.test(file) && !file.split('/').some((part) => part.startsWith('_')) && !file.endsWith('.test.ts'))
    .map((file) => file.replace(/^apps\/control-plane/, '').replace(/\.ts$/, '').replace(/\/index$/, ''))
}

function stations() {
  const registry = JSON.parse(readFileSync(join(ROOT, '.agents/skills/mindmake-video/stations/registry.json'), 'utf8'))
  return registry.station_contracts.map(({ station_id, definition_path }) => {
    const station = JSON.parse(readFileSync(join(ROOT, definition_path), 'utf8'))
    return `| \`${station_id}\` | v${station.station_version} | ${station.status} | ${oneLine(station.purpose ?? '')} | ${(station.implementation_owners ?? []).map((p) => `\`${p}\``).join(', ')} |`
  })
}

// Folders only, no file counts: a count would change with every plan or note a session adds, and the map would go
// stale for no change in where code lives.
function directories() {
  const dirs = new Set()
  for (const file of tracked) {
    const parts = file.split('/')
    if (parts.length < 2) continue
    const deep = parts.length > 2 && ['apps', 'packages', 'docs', 'scripts', 'supabase', 'tests', '.agents', 'config'].includes(parts[0])
    dirs.add(deep ? `${parts[0]}/${parts[1]}` : parts[0])
  }
  return [...dirs].sort().map((dir) => `- \`${dir}/\``)
}

function build() {
  const out = [
    '# Repository map',
    '',
    '> Generated by `npm run repo-map` (`scripts/gen-repo-map.mjs`); `npm run check:repo-map` fails when it is stale.',
    '> Never edit by hand. It is a map of where things are, not current state: that is `NOW.md` and `docs/STATE.md`.',
    '',
    'Find the file here, then open only that file. Signatures are one line each with no bodies; a long one ends in `…`.',
    '',
    '## Directories',
    '',
    ...directories(),
    '',
    '## Content engine routes',
    '',
    'Each is a Vercel handler under `apps/control-plane/api`; `_*.ts` files beside them are shared helpers (listed under Modules).',
    '',
    ...routes().map((route) => `- \`${route}\``),
    '',
    '## Studio stations',
    '',
    'From `.agents/skills/mindmake-video/stations/registry.json`; each station\'s instructions are its `STATION.md`.',
    '',
    '| Station | Version | Status | Purpose | Implemented in |',
    '| --- | --- | --- | --- | --- |',
    ...stations(),
    '',
    '## Modules',
    '',
    'Every tracked TypeScript module outside tests, with its leading comment and its exports.',
    '',
  ]
  const modules = tracked.filter((file) => /^(?:apps|packages|scripts)\/.+\.(?:ts|tsx)$/.test(file) && !/\.(?:test|d)\.tsx?$/.test(file) && !file.includes('/fixtures/'))
  for (const file of modules) {
    const { purpose, lines } = exportsOf(file)
    if (!lines.length && !purpose) continue
    out.push(`### \`${file}\``)
    if (purpose) out.push('', purpose)
    if (lines.length) out.push('', ...lines.map((line) => `- \`${line.replace(/`/g, "'")}\``))
    out.push('')
  }
  return `${out.join('\n').replace(/\n+$/, '')}\n`
}

const next = build()
if (process.argv.includes('--check')) {
  let current = ''
  try { current = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') } catch {}
  if (current !== next) {
    const was = current.split('\n')
    const now = next.split('\n')
    const at = now.findIndex((line, i) => line !== was[i])
    process.stderr.write(`docs/REPO_MAP.md is stale: run \`npm run repo-map\` and commit it (first difference, line ${at + 1}: committed ${JSON.stringify(was[at] ?? '')}, now ${JSON.stringify(now[at] ?? '')})\n`)
    process.exit(1)
  }
  process.stdout.write('docs/REPO_MAP.md is current\n')
} else {
  writeFileSync(OUT, next)
  process.stdout.write(`docs/REPO_MAP.md written (${next.length} bytes)\n`)
}
