import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  AnalyticsObservationV1Schema,
  CandidateV1Schema,
  ExperimentV1Schema,
  FeedbackEventV1Schema,
  JobManifestV1Schema,
  PreferenceRuleV1Schema,
} from '@mindmake/contracts'
import { studioPaths } from './paths.js'

async function readJsonLines(path: string): Promise<unknown[]> {
  try { return (await readFile(path, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) }
  catch { return [] }
}

async function readJsonArray(path: string): Promise<unknown[]> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export async function rebuildIndex(): Promise<{ indexed: number; counts: Record<string, number>; path: string }> {
  const paths = studioPaths()
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(paths.indexPath)
  db.exec(`
    drop table if exists jobs;
    drop table if exists candidates;
    drop table if exists feedback;
    drop table if exists preference_rules;
    drop table if exists analytics;
    drop table if exists experiments;
    drop table if exists candidate_search;
    create table jobs (job_id text primary key, series text not null, mode text not null, source_kind text not null, created_at text not null, updated_at text not null, manifest_json text not null) strict;
    create table candidates (candidate_id text primary key, job_id text not null, series text not null, hook text not null, payoff text not null, candidate_json text not null) strict;
    create virtual table candidate_search using fts5(candidate_id unindexed, hook, payoff, transcript);
    create table feedback (feedback_id text primary key, job_id text not null, stage text not null, action text not null, scope_level text not null, scope_key text not null, confirmation text not null, feedback_json text not null) strict;
    create table preference_rules (rule_id text primary key, status text not null, scope_level text not null, scope_key text not null, assertion text not null, rule_json text not null) strict;
    create table analytics (observation_id text primary key, job_id text not null, platform text not null, observation_json text not null) strict;
    create table experiments (experiment_id text primary key, platform text not null, status text not null, primary_variable text not null, experiment_json text not null) strict;
  `)
  const insertJob = db.prepare('insert into jobs values (?, ?, ?, ?, ?, ?, ?)')
  const insertCandidate = db.prepare('insert into candidates values (?, ?, ?, ?, ?, ?)')
  const insertSearch = db.prepare('insert into candidate_search values (?, ?, ?, ?)')
  const insertFeedback = db.prepare('insert into feedback values (?, ?, ?, ?, ?, ?, ?, ?)')
  const insertRule = db.prepare('insert into preference_rules values (?, ?, ?, ?, ?, ?)')
  const insertAnalytics = db.prepare('insert into analytics values (?, ?, ?, ?)')
  const insertExperiment = db.prepare('insert into experiments values (?, ?, ?, ?, ?)')
  const counts = { jobs: 0, candidates: 0, feedback: 0, preference_rules: 0, analytics: 0, experiments: 0 }
  let entries: string[] = []
  try { entries = await readdir(paths.jobsRoot) } catch { entries = [] }
  for (const entry of entries) {
    try {
      const job = JobManifestV1Schema.parse(JSON.parse(await readFile(join(paths.jobsRoot, entry, 'job.json'), 'utf8')))
      insertJob.run(job.job_id, job.series, job.mode, job.source.kind, job.created_at, job.updated_at, JSON.stringify(job))
      counts.jobs += 1
      let candidateFiles: string[] = []
      try { candidateFiles = await readdir(join(paths.jobsRoot, entry, 'candidates')) } catch { candidateFiles = [] }
      for (const file of candidateFiles.filter((name) => name.endsWith('.json'))) {
        try {
          const candidate = CandidateV1Schema.parse(JSON.parse(await readFile(join(paths.jobsRoot, entry, 'candidates', file), 'utf8')))
          insertCandidate.run(candidate.candidate_id, candidate.job_id, candidate.series, candidate.hook, candidate.payoff, JSON.stringify(candidate))
          insertSearch.run(candidate.candidate_id, candidate.hook, candidate.payoff, candidate.transcript)
          counts.candidates += 1
        } catch { /* Ignore invalid candidate files; immutable artifacts remain authoritative. */ }
      }
    } catch { /* Ignore incomplete or unrelated runtime folders. */ }
  }
  for (const raw of await readJsonLines(join(paths.runtimeRoot, 'learning', 'feedback.jsonl'))) {
    try {
      const item = FeedbackEventV1Schema.parse(raw)
      insertFeedback.run(item.feedback_id, item.job_id, item.stage, item.action, item.scope.level, item.scope.key, item.confirmation, JSON.stringify(item))
      counts.feedback += 1
    } catch { /* Ignore invalid derived rows. */ }
  }
  for (const raw of await readJsonArray(join(paths.runtimeRoot, 'learning', 'rules.json'))) {
    try {
      const item = PreferenceRuleV1Schema.parse(raw)
      insertRule.run(item.rule_id, item.status, item.scope.level, item.scope.key, item.assertion, JSON.stringify(item))
      counts.preference_rules += 1
    } catch { /* Ignore invalid derived rows. */ }
  }
  for (const raw of await readJsonLines(join(paths.runtimeRoot, 'analytics', 'observations.jsonl'))) {
    try {
      const item = AnalyticsObservationV1Schema.parse(raw)
      insertAnalytics.run(item.observation_id, item.job_id, item.platform, JSON.stringify(item))
      counts.analytics += 1
    } catch { /* Ignore invalid derived rows. */ }
  }
  for (const raw of await readJsonArray(join(paths.runtimeRoot, 'analytics', 'experiments.json'))) {
    try {
      const item = ExperimentV1Schema.parse(raw)
      insertExperiment.run(item.experiment_id, item.platform, item.status, item.primary_variable, JSON.stringify(item))
      counts.experiments += 1
    } catch { /* Ignore invalid derived rows. */ }
  }
  db.close()
  return { indexed: counts.jobs, counts, path: paths.indexPath }
}

function tokenSet(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 3))
}

export async function compareCorpusNovelty(value: string): Promise<{ novelty: number; nearest_candidate_id: string | null; similarity: number }> {
  const path = studioPaths().indexPath
  if (!existsSync(path)) return { novelty: 1, nearest_candidate_id: null, similarity: 0 }
  const query = tokenSet(value)
  if (!query.size) return { novelty: 1, nearest_candidate_id: null, similarity: 0 }
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(path)
  const rows = db.prepare('select candidate_id, hook, payoff from candidates limit 1000').all() as Array<{ candidate_id: string; hook: string; payoff: string }>
  db.close()
  let nearest: string | null = null
  let best = 0
  for (const row of rows) {
    const candidate = tokenSet(`${row.hook} ${row.payoff}`)
    const intersection = [...query].filter((word) => candidate.has(word)).length
    const union = new Set([...query, ...candidate]).size
    const similarity = union ? intersection / union : 0
    if (similarity > best) { best = similarity; nearest = row.candidate_id }
  }
  return { novelty: Math.round((1 - best) * 1000) / 1000, nearest_candidate_id: nearest, similarity: Math.round(best * 1000) / 1000 }
}
