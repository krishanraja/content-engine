// PreToolUse on Bash, Write, Edit and MultiEdit: no secret enters a command or a file, and no .env file is written.
// AGENTS.md (canon, "Secrets"): never write a credential into source, documentation, logs or chat.
// The shapes are the one list check-no-secrets.ts scans the tree with (scripts/secret-patterns.ts).
import { decide, readEvent, repoPath, secretPatterns, writtenText } from './lib.mjs'

const PATTERNS = secretPatterns()
const containsCommittedSecret = (text) => PATTERNS.some((pattern) => pattern.test(text))

const event = readEvent()
const input = event.tool_input || {}
const tool = event.tool_name || ''

// .env.example is the checked-in template and holds no values.
const ENV_FILE = /(?:^|\/)\.env(?:\.(?!example$)[^/]+)?$/
const ENV_WRITE = /(?:>>?|\btee\b(?:\s+-a)?|\bcp\b[^|;&]*|\bmv\b[^|;&]*)\s*["']?(?:\S*\/)?\.env(?:\.(?!example\b)[\w.-]+)?["']?(?:\s|$|[;&|])/

if (tool === 'Bash') {
  const command = String(input.command || '')
  if (containsCommittedSecret(command)) decide('deny', 'secret-guard: this command carries a secret-shaped string. Refer to the secret by its name and read it at run time (scripts/get-credential.ps1, the environment); never put the value in a command.')
  if (ENV_WRITE.test(command)) decide('deny', 'secret-guard: this command writes a .env file. Secrets are set on the machine by Krish (scripts/set-credential.ps1), never by a session.')
} else if (['Write', 'Edit', 'MultiEdit'].includes(tool)) {
  const path = repoPath(input.file_path)
  if (ENV_FILE.test(path)) decide('deny', `secret-guard: ${path} is a .env file. Only .env.example, which holds no values, is written by a session.`)
  if (containsCommittedSecret(writtenText(input))) decide('deny', `secret-guard: the text for ${path} carries a secret-shaped string (scripts/secret-patterns.ts). Name the secret instead of writing its value.`)
}
process.exit(0)
