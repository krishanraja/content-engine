export const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|VIDEO_STUDIO_(?:EXPORT_TOKEN|RUNNER_TOKEN|RUNNER_SIGNING_KEY|MCP_TOKEN)|YOUTUBE_ACCESS_TOKEN)[ \t]*=[ \t]*(?![ \t]*(?:$|<|\[|\$\{|REPLACE_ME|CHANGE_ME))[^\s#]{20,}/im,
  /#\s*paste:\s*(?!\s*(?:[<[]|\$\{|REPLACE_ME|CHANGE_ME))\S{20,}/i,
  /\bvst_(?:rt2?|sig2?|exp2?|mcp)_[a-f0-9]{64,}\b/i,
  /\b(?:rt|sk|ex)_[a-f0-9]{32,}\b/i,
  /\b(?:gh[pousr]|glpat|xox[baprs]|npm|pypi)_[A-Za-z0-9_-]{20,}\b/i,
  /\bsk-[a-z0-9_-]{20,}\b/i,
  /\bya29\.[a-z0-9_-]{20,}\b/i,
  /authorization\s*:\s*["']Bearer\s+[a-z0-9._-]{20,}["']/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]

export function containsCommittedSecret(body: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(body))
}
