/**
 * Artifact-bound user confirmation references.
 *
 * Every positive Krish decision at a Studio gate carries a confirmation reference that binds the gate and the
 * exact artifact hash, followed by a non-empty human-readable receipt. Three prefixes are accepted:
 *
 * - `studio-user-confirmation:<client>:<gate>:<hash>:<receipt>` for any supported studio client
 * - `codex-user-confirmation:<gate>:<hash>:<receipt>` (legacy Codex receipts remain valid)
 * - `control-center-confirmation:<gate>:<hash>:<receipt>` (Control Center review decisions)
 *
 * The `<client>` segment is a lowercase token: a letter followed by 1 to 39 letters, digits or hyphens.
 * A new client must never generate the legacy prefix.
 */
export const STUDIO_CONFIRMATION_CLIENT_PATTERN = /^[a-z][a-z0-9_-]{1,39}$/
const PORTABLE_CONFIRMATION_PREFIX = /^studio-user-confirmation:([a-z][a-z0-9_-]{1,39}):/

export const STUDIO_CONFIRMATION_CLIENT_PLACEHOLDER = '<client>'

function receiptAfter(reference: string, prefix: string): boolean {
  return reference.startsWith(prefix) && Boolean(reference.slice(prefix.length).trim())
}

/** Legacy and Control Center prefixes that bind `gate` and `hash`, in the order they are documented. */
export function legacyConfirmationRefPrefixes(gate: string, hash: string): string[] {
  return [`codex-user-confirmation:${gate}:${hash}:`, `control-center-confirmation:${gate}:${hash}:`]
}

/** The portable prefix rendered with a placeholder client token, for CLI hints and error messages. */
export function portableConfirmationRefPrefix(gate: string, hash: string, client: string = STUDIO_CONFIRMATION_CLIENT_PLACEHOLDER): string {
  return `studio-user-confirmation:${client}:${gate}:${hash}:`
}

/** Every accepted prefix for `gate` and `hash`, portable form first. */
export function confirmationRefPrefixes(gate: string, hash: string): string[] {
  return [portableConfirmationRefPrefix(gate, hash), ...legacyConfirmationRefPrefixes(gate, hash)]
}

/**
 * True when `reference` binds `gate` and `hash` under one of the accepted prefixes and carries a non-empty receipt.
 * A missing reference, an unknown prefix, a malformed client segment, or a reference bound to another gate or hash
 * is not a confirmation.
 */
export function confirmationRefMatches(reference: string | null | undefined, gate: string, hash: string): boolean {
  if (typeof reference !== 'string') return false
  if (legacyConfirmationRefPrefixes(gate, hash).some((prefix) => receiptAfter(reference, prefix))) return true
  const portable = PORTABLE_CONFIRMATION_PREFIX.exec(reference)
  if (!portable) return false
  return receiptAfter(reference.slice(portable[0].length), `${gate}:${hash}:`)
}
