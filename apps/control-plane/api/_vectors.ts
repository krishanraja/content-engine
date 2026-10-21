// Stored embeddings, read without a model call. Pure: no imports, so a unit test and a pure module
// (_weekSources.ts, _ideaQueue.ts) can use them without the meter or the database client.

/** A row's embedding as numbers: PostgREST answers pgvector as its text literal ("[0.1,0.2]"), a fixture as an
 *  array, and the nightly cluster job keeps a freshly made one in `_vec`. */
export function parseVec(r: { embedding?: unknown; _vec?: number[] | null } | null | undefined): number[] | null {
  if (!r) return null
  if (Array.isArray(r._vec)) return r._vec
  if (typeof r.embedding === 'string') {
    try {
      const v = JSON.parse(r.embedding)
      return Array.isArray(v) ? v as number[] : null
    } catch { return null }
  }
  if (Array.isArray(r.embedding)) return r.embedding as number[]
  return null
}

/** Cosine similarity between two equal-dimension vectors. Returns 0 if either
 *  vector is degenerate. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}
