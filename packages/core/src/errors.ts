import { ZodError } from 'zod'

export const EXIT_CODES = {
  unexpected: 1,
  validation: 10,
  policy_block: 20,
  external_service: 30,
  media_tool: 40,
  state: 50,
} as const

export function classifyError(error: unknown): { code: keyof typeof EXIT_CODES; exitCode: number; message: string } {
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof ZodError || /schema|invalid|must match|requires --input/i.test(message)) return { code: 'validation', exitCode: EXIT_CODES.validation, message }
  if (/approval|hard (?:editorial )?block|rights|licen[cs]e|only permits private|truth|QA did not pass/i.test(message)) return { code: 'policy_block', exitCode: EXIT_CODES.policy_block, message }
  if (/YouTube|provider|credential|radar .*returned|upload|HTTP\s+\d/i.test(message)) return { code: 'external_service', exitCode: EXIT_CODES.external_service, message }
  if (/ffmpeg|ffprobe|transcrib|video|audio|caption timestamp|recorded take/i.test(message)) return { code: 'media_tool', exitCode: EXIT_CODES.media_tool, message }
  if (/job|stage|artifact|rule|experiment|runtime/i.test(message)) return { code: 'state', exitCode: EXIT_CODES.state, message }
  return { code: 'unexpected', exitCode: EXIT_CODES.unexpected, message }
}
