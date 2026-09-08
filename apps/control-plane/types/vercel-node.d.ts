// The two types every route signature uses, declared locally.
//
// The routes are written exactly as they were in Control Center,
// `import type { VercelRequest, VercelResponse } from '@vercel/node'`, so that
// their history stays readable and a diff against that repo shows only what
// actually changed. But the import is type-only in every one of them, and the
// package itself is never executed here: Vercel's builder supplies the real
// runtime at deploy time.
//
// Depending on it anyway cost something real. `@vercel/node@5.10.2` pins
// `undici@5.28.4` and `path-to-regexp@6.1.0`, both carrying high-severity
// advisories, and this repo's CI runs `npm audit --audit-level=high` on every
// push. An npm override could not dislodge the exact pin, and weakening the
// audit gate to accommodate a types-only dependency would trade a real
// guarantee for a convenience.
//
// So the contract is declared here instead. It covers exactly the surface the
// routes use; anything reaching past it is a compile error, which is the point.
// Keep it in step with the real package when a route needs more.

declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'node:http'

  export interface VercelRequestQuery {
    [key: string]: string | string[] | undefined
  }

  export interface VercelRequestCookies {
    [key: string]: string
  }

  export interface VercelRequest extends IncomingMessage {
    query: VercelRequestQuery
    cookies: VercelRequestCookies
    /** Parsed by the runtime when the request carries a JSON content type. */
    body: any
  }

  export interface VercelResponse extends ServerResponse {
    send: (body: any) => VercelResponse
    json: (jsonBody: any) => VercelResponse
    status: (statusCode: number) => VercelResponse
    redirect: (statusOrUrl: string | number, url?: string) => VercelResponse
  }

  export type VercelApiHandler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>
}
