// What this deployment needs before it can do its job.
//
// Names only, never values. The health route reports which of these are set so
// a half-configured deployment says so in one request instead of failing one
// route at a time in production. `required` means the engine cannot serve its
// core without it; `feature` means one lane goes quiet and the rest is fine.
//
// CRON_SECRET is deliberately in `feature`, not `required`: while Control
// Center still runs the content crons, this deployment must NOT have it. An
// unset secret makes every cron 401 and record nothing, which is the only safe
// state while two deployments point at one database.

export interface RequiredVar { name: string; why: string; kind: 'required' | 'feature' }

export const REQUIRED_VARS: RequiredVar[] = [
  { name: 'SUPABASE_URL', why: 'every route reads and writes the OS database', kind: 'required' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', why: 'the service-role client', kind: 'required' },
  { name: 'ACCESS_CODE', why: 'the operator cookie guard; unset fails OPEN on cookie-guarded routes', kind: 'required' },
  { name: 'APP_ORIGIN', why: 'the Origin the operator mutation guard demands', kind: 'required' },
  { name: 'VIDEO_STUDIO_CSRF_SECRET', why: 'operator mutations in the Studio (32+ bytes)', kind: 'required' },
  { name: 'ANTHROPIC_API_KEY', why: 'the Composer, the brief, the lenses, the judges', kind: 'required' },
  { name: 'OPENAI_API_KEY', why: 'embeddings: dedupe, clustering, reject-reason neighbours', kind: 'required' },
  { name: 'VIDEO_STUDIO_RUNNER_TOKEN', why: 'the Windows runner bearer; must match the value in its Credential Manager', kind: 'required' },
  { name: 'VIDEO_STUDIO_RUNNER_SIGNING_KEY', why: 'runner receipt signatures; must match the runner', kind: 'required' },
  { name: 'CRON_SECRET', why: 'the scheduled jobs. Leave UNSET until Control Center stops running them', kind: 'feature' },
  { name: 'VIDEO_STUDIO_PREVIEW_BUCKET', why: 'private Before/After proxies', kind: 'feature' },
  { name: 'VIDEO_STUDIO_MCP_TOKEN', why: 'the portable Studio session gateway for Codex and Claude Code', kind: 'feature' },
  { name: 'VIDEO_STUDIO_EXPORT_TOKEN', why: 'the candidates export the Studio radar reads', kind: 'feature' },
  { name: 'CTRL_SUPABASE_URL', why: 'feed ingest reads the CTRL headlines pool', kind: 'feature' },
  { name: 'CTRL_SUPABASE_SERVICE_KEY', why: 'feed ingest reads the CTRL headlines pool', kind: 'feature' },
  { name: 'PERPLEXITY_API_KEY', why: 'Challenge this, dive deeper, research', kind: 'feature' },
  { name: 'EXA_API_KEY', why: 'the lens radar', kind: 'feature' },
  { name: 'APIFY_TOKEN', why: 'the creator scout and community scraping', kind: 'feature' },
  { name: 'GITHUB_TOKEN', why: 'the Saturday build-signals read', kind: 'feature' },
  { name: 'GITHUB_REPOS', why: 'which repos build signals reads', kind: 'feature' },
  { name: 'N8N_CONTENT_FACTORY_WEBHOOK_URL', why: 'Save Draft and the brief push', kind: 'feature' },
  { name: 'NEWSAPI_KEY', why: 'dated proof in Challenge this', kind: 'feature' },
  { name: 'LENS_RADAR_SECRET', why: 'the lens radar accepts this alongside CRON_SECRET', kind: 'feature' },
  { name: 'AEO_DISPATCH_TOKEN', why: 'the Run now button that fires the AEO engine workflow', kind: 'feature' },
  { name: 'GOOGLE_SERVICE_ACCOUNT_EMAIL', why: 'Drive and Workspace access', kind: 'feature' },
  { name: 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', why: 'Drive and Workspace access', kind: 'feature' },
]

export function envReadiness() {
  const set = (name: string) => Boolean((process.env[name] || '').trim())
  const missingRequired = REQUIRED_VARS.filter(v => v.kind === 'required' && !set(v.name))
  const missingFeature = REQUIRED_VARS.filter(v => v.kind === 'feature' && !set(v.name))
  return {
    ready: missingRequired.length === 0,
    missing_required: missingRequired.map(v => ({ name: v.name, why: v.why })),
    missing_feature: missingFeature.map(v => ({ name: v.name, why: v.why })),
  }
}
