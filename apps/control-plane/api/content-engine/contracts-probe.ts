import type { VercelRequest, VercelResponse } from '@vercel/node'

// THROWAWAY. Phase 3 step 1: does @mindmake/contracts resolve and execute
// inside a deployed control-plane function?
//
// The question is not whether the code is right, it is whether Vercel's
// install (root directory apps/control-plane, no install override) links the
// workspace package at all, and if it does, whether the tracer transpiles its
// raw ./src/index.ts under node_modules. Node 24 does not type-strip there.
// Reasoning about this is worthless; the deployment is the answer.

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    // Relative into the workspace source, not the package name. The whole repo
    // is the deployment root (/var/task), so this is a .ts file Vercel's builder
    // compiles like any route, rather than raw TypeScript under node_modules.
    const mod = await import('../../../../packages/contracts/src/index.js')
    const names = Object.keys(mod).filter(k => /Schema$/.test(k)).sort()
    let parsed: unknown = 'not attempted'
    const schema = (mod as Record<string, unknown>).ProductionBriefV1Schema as
      | { safeParse: (v: unknown) => { success: boolean; error?: { issues?: unknown[] } } }
      | undefined
    if (schema?.safeParse) {
      const result = schema.safeParse({})
      parsed = { ran: true, success: result.success, issue_count: result.error?.issues?.length ?? 0 }
    }
    return res.status(200).json({ ok: true, resolved: true, schema_count: names.length, sample: names.slice(0, 6), parsed })
  } catch (error) {
    return res.status(200).json({
      ok: true,
      resolved: false,
      name: (error as Error).name,
      message: (error as Error).message.slice(0, 400),
      code: (error as NodeJS.ErrnoException).code || null,
    })
  }
}
