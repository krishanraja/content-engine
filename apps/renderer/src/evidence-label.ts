export type EvidenceLabelInput = {
  viewer_intent?: 'maintain_connection' | 'verify_claim' | 'inspect_artifact' | 'understand_mechanism' | undefined
  source_role?: 'news_hook' | 'claim_evidence' | 'mechanism_proof' | 'context' | undefined
  temporality?: 'fresh_news' | 'current' | 'evergreen' | 'live_artifact' | undefined
}

export function evidenceIntentLabel(overlay: EvidenceLabelInput): string {
  if (overlay.source_role === 'context' && (overlay.temporality === 'fresh_news' || overlay.temporality === 'current')) return 'CURRENT CONTEXT'
  if (overlay.viewer_intent === 'inspect_artifact') return 'LOOK AT THIS'
  if (overlay.viewer_intent === 'understand_mechanism') return 'HOW IT WORKS'
  if (overlay.viewer_intent === 'maintain_connection') return 'CONTEXT'
  return 'SOURCE'
}
