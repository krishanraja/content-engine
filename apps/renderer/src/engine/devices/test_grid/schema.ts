import { z } from 'zod'
import type { EngineObject } from '../../props'

const Id = z.string().min(1).refine((id) => id.trim() === id && !/[:,*]/.test(id), 'Ids cannot contain selector punctuation or surrounding whitespace')

export const TestGridParamsSchema = z.object({
  rows: z.array(z.object({ id: Id, label: z.string().min(1), logoSrc: z.string().min(1).optional() }).strict()).min(1),
  cols: z.array(z.object({ id: Id, label: z.string().min(1) }).strict()).min(1),
  cells: z.array(z.object({ row: Id, col: Id, datasetLabel: z.string().min(1) }).strict()).min(1),
  answerKey: z.boolean(),
}).strict().superRefine((params, ctx) => {
  const rows = new Set(params.rows.map((row) => row.id))
  const cols = new Set(params.cols.map((col) => col.id))
  const coordinates = new Set(params.cells.map((cell) => `${cell.row}:${cell.col}`))
  if (rows.size !== params.rows.length || cols.size !== params.cols.length) {
    ctx.addIssue({ code: 'custom', message: 'Row and column ids must be unique' })
  }
  if (params.cells.some((cell) => !rows.has(cell.row) || !cols.has(cell.col))) {
    ctx.addIssue({ code: 'custom', path: ['cells'], message: 'Every cell must reference a declared row and column' })
  }
  if (coordinates.size !== params.cells.length || coordinates.size !== rows.size * cols.size) {
    ctx.addIssue({ code: 'custom', path: ['cells'], message: 'Provide exactly one cell for every row and column pair' })
  }
})

export type TestGridParams = z.infer<typeof TestGridParamsSchema>

/** Resolve data once by its explicit label, never by array position or display text. */
export function resolveTestGrid(object: EngineObject) {
  const params = TestGridParamsSchema.parse(object.params)
  const dataset = object.dataset
  if (!dataset) throw new Error('test_grid requires object.dataset')
  const cells = params.rows.flatMap((row) => params.cols.map((col) => {
    const cell = params.cells.find((candidate) => candidate.row === row.id && candidate.col === col.id)!
    const matches = dataset.rows.filter((candidate) => candidate.label === cell.datasetLabel)
    const value = matches[0]?.value
    if (matches.length !== 1 || value === undefined || !Number.isFinite(value)) {
      throw new Error(`test_grid requires one finite dataset value for ${cell.datasetLabel}`)
    }
    return { ...cell, id: `${row.id}:${col.id}`, value }
  }))
  return { params, dataset, cells }
}
