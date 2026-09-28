import type { VercelResponse } from '@vercel/node'
import { supportsSampling } from './_content.js'
import { thinkingParam } from './_models.js'
import * as meter from './_meter.js'

/**
 * Server-sent events for the model calls a human sits and waits on.
 *
 * The problem this solves is not a slow API, it is a silent one. These routes
 * take 20 to 60 seconds and returned nothing at all until they were finished,
 * so the best possible client could only ever draw a nicer way of waiting. The
 * first sentence usually exists two seconds in; withholding it until the last
 * sentence is written is the whole wait.
 *
 * Deliberately small. Three event names, no framework:
 *
 *   delta  { text }   a chunk of the answer, append it
 *   done   { ...any } the final payload the non-streaming route used to return
 *   error  { error }  a failure AFTER headers are already out
 *
 * That last one is why `error` is an event rather than a status code. Once the
 * first byte is written the status is 200 forever, so a mid-stream failure has
 * to be reported in-band or it reads to the client as a successful empty
 * answer. A green transport carrying nothing is still a failure.
 */

export function openStream(res: VercelResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    Connection: 'keep-alive',
    // Belt and braces for any proxy that buffers by default.
    'X-Accel-Buffering': 'no',
  })
  // Flush the headers immediately so the client's reader resolves now rather
  // than when the first token happens to arrive.
  res.write(': open\n\n')
}

export function send(res: VercelResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function fail(res: VercelResponse, error: string, detail?: string): void {
  send(res, 'error', { error, detail })
  res.end()
}

export interface StreamClaudeOpts {
  apiKey: string
  model: string
  maxTokens: number
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  /** Sampling temperature. Omit to let the caller inherit the provider default.
   *
   *  This was missing, and its absence was invisible: the non-streaming helpers
   *  in _content.ts default to 0.5 / 0.6, and every route that uses them tunes
   *  the value deliberately (0 for classifiers, 0.3 for graders, 0.5-0.6 for
   *  drafting). The streaming path silently ran at the provider default instead,
   *  so /content-ideas/:id/revise — the most-used rewrite surface in the
   *  composer — was the one generative call in the content engine with no
   *  temperature control at all. */
  temperature?: number
  /** Ask for adaptive thinking. Off by default, and explicitly sent as
   *  disabled on models that would otherwise run it: omitting the field on
   *  Sonnet 5 spends the whole max_tokens budget on reasoning and streams no
   *  text at all, which reaches the client as a successful empty answer. */
  think?: boolean
  /** Called with each text delta, so the caller can both relay and accumulate. */
  onText: (chunk: string) => void
  /** Called once the provider has accepted the request, before the first
   *  delta. A caller opens its own stream here, so a refusal (a usage limit,
   *  a bad key, an overload) still reaches its client as an HTTP status
   *  rather than as an event inside a 200. */
  onOpen?: () => void
  signal?: AbortSignal
  /** Agent stamp for the usage meter. A stream reports its token counts in the
   *  SSE itself (`message_start` carries input, `message_delta` carries output),
   *  so a streamed call is metered exactly like a blocking one. */
  agent?: string
  /** Cache the system prefix. Opt-in for the same reason as ClaudeOpts.cache:
   *  a write is priced above an uncached send, so it pays only where the same
   *  system prompt goes out again inside the TTL. */
  cache?: boolean
}

/**
 * Call Anthropic with `stream: true` and pull text deltas out of its SSE.
 *
 * Returns the accumulated text so the caller still has the whole answer for the
 * things that need it whole: the audit log, the database write, the `done`
 * payload. Streaming is an addition to those, never a replacement.
 */
export async function streamClaude(opts: StreamClaudeOpts): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      ...thinkingParam(opts.model, opts.think === true),
      // A cache breakpoint on the stable prefix when the caller asked for one.
      // Same floor and same reasoning as cacheableSystem in _content.ts: a
      // prefix under the model minimum is silently not cached, and a write is
      // priced above an ordinary input token, so this is opt-in per call site.
      // revise is the site that most wants it: one draft, many passes, minutes
      // apart, with the rubric and corpus identical every time.
      system: opts.cache && opts.system && opts.system.length >= 6000
        ? [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }]
        : opts.system,
      messages: opts.messages,
      ...(opts.temperature !== undefined && supportsSampling(opts.model) ? { temperature: opts.temperature } : {}),
      stream: true,
    }),
    signal: opts.signal,
  })

  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => '')
    let said = text
    try { said = String(JSON.parse(text)?.error?.message || text) } catch { /* not JSON: keep the text */ }
    const e = Object.assign(new Error(`anthropic_${r.status}:${said.slice(0, 300)}`), { status: r.status })
    await meter.anthropicFailure({ agent: opts.agent, model: opts.model, error: e })
    throw e
  }
  opts.onOpen?.()

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let out = ''
  let inputTokens = 0
  let outputTokens = 0
  /** The raw usage object, accumulated across message_start and message_delta. */
  let usage: Record<string, unknown> = {}

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE frames are separated by a blank line. Anything after the last blank
      // line is a partial frame and has to stay in the buffer: a token boundary
      // that lands mid-JSON is the normal case, not an edge case.
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const evt = JSON.parse(raw) as {
              type?: string
              delta?: { type?: string; text?: string }
              message?: { usage?: Record<string, unknown> }
              usage?: Record<string, unknown>
              error?: { message?: string }
            }
            // Tagged, so the parse guard below re-throws it. It used to re-throw
            // only messages starting "anthropic", and a mid-stream overload says
            // "Overloaded": the error was swallowed as an unreadable frame and
            // the half-written text returned as a finished answer.
            if (evt.type === 'error') {
              const kind = (evt.error as { type?: string } | undefined)?.type
              throw Object.assign(new Error(`anthropic_stream_error:${kind ? `${kind}: ` : ''}${evt.error?.message || 'the stream reported an error'}`), { streamError: true })
            }
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
              out += evt.delta.text
              opts.onText(evt.delta.text)
            }
            // Token counts arrive in their own frames, not with the text.
            if (evt.type === 'message_start') {
              // message_start carries the FULL usage object, cache fields included.
              // Reading two numbers off it and discarding the rest is what made a
              // cached call and an uncached one identical in meter_daily.
              if (evt.message?.usage) usage = { ...usage, ...evt.message.usage }
              inputTokens = Number(evt.message?.usage?.input_tokens) || inputTokens
              outputTokens = Number(evt.message?.usage?.output_tokens) || outputTokens
            }
            if (evt.type === 'message_delta' && evt.usage) {
              usage = { ...usage, ...evt.usage }
              outputTokens = Number(evt.usage.output_tokens) || outputTokens
            }
          } catch (e) {
            // A frame we cannot parse is not fatal on its own; a reported error is.
            if ((e as { streamError?: boolean })?.streamError || (e instanceof Error && e.message.startsWith('anthropic'))) throw e
          }
        }
      }
    }
  } catch (e) {
    // Failed after the provider accepted the call: metered as a failure, with
    // whatever usage it had already reported, and re-thrown for the caller's
    // own error event.
    await meter.anthropicFailure({ agent: opts.agent, model: opts.model, usage, error: e })
    throw e
  }

  await meter.anthropicCall({ agent: opts.agent, model: opts.model, usage, inputTokens, outputTokens })
  return out
}
