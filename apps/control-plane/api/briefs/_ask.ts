import { robustJson, type ClaudeOpts, type TokenUsage } from '../_content.js'

/** Name the first missing piece of the weekly brief's contract, or '' when the shape is good. */
export function shapeFault(p: any): string {
  if (!p || typeof p !== 'object') return 'not JSON'
  if (!p.title) return 'no title'
  if (!Array.isArray(p.headlines) || p.headlines.length < 3) return 'fewer than 3 clues'
  if (!p.belief) return 'no belief named, so there is nothing being argued'
  if (!p.standfirst) return 'no standfirst, so the verdict is buried'
  if (!p.evidence_md) return 'no investigation section'
  if (!p.next_year_md) return 'no twelve-month section'
  return ''
}

/** The first attempt: thinking on, with headroom above the 5000 the answer needs, because adaptive thinking spends
 *  the ceiling first. */
export const FIRST_ATTEMPT = { maxTokens: 12000, think: true } as const
/** The retry after a reply cut off at the ceiling (audit content-engine-7, 14 Nov 2026: the job failed every other
 *  Friday with "not JSON", the shape of a reply whose thinking ate the ceiling before the JSON closed). Thinking off
 *  and a higher ceiling, so the whole of it goes to the answer. A reply that closed but missed a field retries with
 *  the first attempt's settings and the fault named. */
export const ROOMY_RETRY = { maxTokens: 16000, think: false } as const

type Call = (opts: ClaudeOpts) => Promise<string>
export interface AskRecord { attempt: number; maxTokens: number; think: boolean; stopReason: string | null; outputTokens: number; chars: number; fault: string }

/** Ask for the weekly brief, at most twice. Every attempt is logged with its stop reason and output length, so a
 *  failure says whether the reply ran out of room or came back malformed. */
export async function askForBrief(call: Call, base: Omit<ClaudeOpts, 'maxTokens' | 'think' | 'onUsage'>,
  log: (line: string) => void = console.log): Promise<{ parsed: any; attempts: AskRecord[] }> {
  const attempts: AskRecord[] = []
  for (let attempt = 1; attempt <= 2; attempt++) {
    const last = attempts[attempts.length - 1]
    const cutOff = last?.stopReason === 'max_tokens'
    const settings = cutOff ? ROOMY_RETRY : FIRST_ATTEMPT
    const told = !last ? '' : cutOff
      ? '\n\nYour last reply ran out of room before the JSON closed. Return only the JSON, complete, with every required field.'
      : `\n\nYour last reply was rejected: ${last.fault}. Return the full JSON with every required field.`
    let usage: TokenUsage | null = null
    const raw = await call({ ...base, ...settings, system: `${base.system}${told}`, onUsage: (u) => { usage = u } })
    const got = usage as TokenUsage | null
    const candidate = robustJson(raw)
    const fault = shapeFault(candidate)
    const record: AskRecord = { attempt, maxTokens: settings.maxTokens, think: settings.think,
      stopReason: got?.stopReason ?? null, outputTokens: got?.output ?? 0, chars: String(raw ?? '').length, fault }
    attempts.push(record)
    log(`[briefs_assemble] attempt ${attempt}: stop_reason ${record.stopReason ?? 'unknown'}, ${record.outputTokens} output tokens, `
      + `${record.chars} characters, ceiling ${record.maxTokens}, thinking ${record.think ? 'on' : 'off'}: ${fault || 'good shape'}`)
    if (!fault) return { parsed: candidate, attempts }
  }
  const last = attempts[attempts.length - 1]!
  const why = last.stopReason === 'max_tokens' ? `${last.fault}, cut off at ${last.maxTokens} tokens` : last.fault
  throw new Error(`assemble: model returned an unusable shape (${why})`)
}
