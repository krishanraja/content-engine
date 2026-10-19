// PreToolUse on Bash and every MCP tool: nothing publishes, posts, sends or schedules by itself.
// AGENTS.md: "Public publishing is never automatic"; the canon: anything that publishes or sends needs
// Krish's explicit approval immediately before it. "ask" puts the call to him in person; it is never auto-approved.
//
// Left alone on purpose, because AGENTS.md is his standing approval for them:
// - scripts/post-pack/send.py: every post's assets go to his library folder the same day (Krish, 2026-10-06).
// - Teleprompter create_folder, create_script, update_script: each checked script goes to his account (Krish, 2026-10-12).
// - scripts/engine.py: the content engine never posts.
import { decide, readEvent } from './lib.mjs'

const event = readEvent()
const tool = String(event.tool_name || '')
const input = event.tool_input || {}

// AGENTS.md, Teleprompter: "Never: move_script or update_folder".
if (/^mcp__Teleprompter__(?:move_script|update_folder)$/.test(tool)) {
  decide('deny', 'publish-guard: AGENTS.md never allows move_script or update_folder in Krish\'s Teleprompter account; his folders and settings are his.')
}

const SENDS = [
  /(?:^|_)send_(?:message|email)$/i, // Gmail, Slack, Instantly
  /(?:^|_)(?:reply|forward)(?:_to_email)?$/i,
  /(?:^|_)email_forward$/i,
  /schedule_message$/i,
  /publish/i, // Descript, n8n, Higgsfield, Shopify, Riverside, Canva templates, TikTok
  /(?:^|_)social_upload_create$/i,
  /(?:^|_)hosting_create_episode$/i,
  /(?:^|_)tiktok_/i,
  /(?:^|_)(?:create_deployment|request_promote|assign_alias|deploy_[a-z_]+)$/i,
  /(?:^|_)(?:activate_campaign|campaigns_bulk_activate|subsequences_resume)$/i,
  /(?:^|_)(?:share_file|share_meeting|create_share)$/i,
  /(?:^|_)execute_workflow$/i,
]

if (tool.startsWith('mcp__')) {
  const verb = tool.split('__').pop() || ''
  if (SENDS.some((pattern) => pattern.test(verb))) {
    decide('ask', `publish-guard: ${tool} sends, publishes or schedules outside the engine. Nothing publishes itself; Krish approves this one call in person, or it does not run.`)
  }
  process.exit(0)
}

if (tool === 'Bash') {
  const command = String(input.command || '')
  const POSTS = [
    [/\bgit\s+push\b(?=.*(?:\s|:|\/)(?:main|master)\b)/, 'pushes to main'],
    [/\bgh\s+(?:pr\s+merge|release\s+create)\b/, 'merges or releases on GitHub'],
    [/\bvercel\b(?=.*(?:\bdeploy\b|--prod\b|\bpromote\b|\balias\b))/, 'deploys to Vercel'],
    [/\b(?:curl|wget|Invoke-RestMethod|Invoke-WebRequest)\b(?=[^\n]*(?:-X\s*(?:POST|PUT|PATCH)|--data|-d\s|-F\s|--form|-Method\s+(?:Post|Put|Patch)))(?=[^\n]*(?:linkedin|facebook|instagram|tiktok|youtube|googleapis\.com\/upload|twitter|api\.x\.com|slack\.com|hooks\.slack|api\.instantly|n8n\.cloud\/webhook|sendgrid|mailgun|resend\.com|beehiiv|substack|buffer|hootsuite))/i, 'posts to a publishing, social or mail API'],
  ]
  for (const [pattern, what] of POSTS) {
    if (pattern.test(command)) decide('ask', `publish-guard: this command ${what}. Nothing publishes itself; Krish approves this one command in person, or it does not run.`)
  }
}
process.exit(0)
