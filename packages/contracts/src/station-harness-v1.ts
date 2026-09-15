import { z } from 'zod'
import { ApprovalGateV2Schema, StageNameV2Schema } from './v2.js'

export const StationSourceModeV1Schema = z.enum(['extract', 'solo', 'short_native'])
export type StationSourceModeV1 = z.infer<typeof StationSourceModeV1Schema>

const RepoPathV1Schema = z.string().min(1).refine(
  (value) => !value.startsWith('/') && !value.startsWith('\\') && !/^[a-zA-Z]:/.test(value) && !value.split(/[\\/]/).includes('..'),
  { message: 'station paths must be repository-relative and cannot traverse directories' },
)

const StageListV1Schema = z.array(StageNameV2Schema).refine(
  (value) => new Set(value).size === value.length,
  { message: 'stage lists cannot contain duplicates' },
)

const SourceModeStageMapV1Schema = z.object({
  extract: StageListV1Schema,
  solo: StageListV1Schema,
  short_native: StageListV1Schema,
}).strict()

export const StationDefinitionV1Schema = z.object({
  schema_version: z.literal(1),
  station_id: StageNameV2Schema,
  station_version: z.number().int().positive(),
  status: z.literal('active'),
  purpose: z.string().min(20),
  instruction_path: RepoPathV1Schema,
  implementation_owners: z.array(RepoPathV1Schema).min(1),
  contract_owners: z.array(RepoPathV1Schema).min(1),
  prerequisites: SourceModeStageMapV1Schema,
  consumes: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1),
  produces: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1),
  approval_gate: ApprovalGateV2Schema.nullable(),
  hard_gates: z.array(z.string().min(8)).min(1),
  soft_gates: z.array(z.string().min(8)),
  invalidates_on_change: SourceModeStageMapV1Schema,
  failure: z.object({
    behavior: z.enum(['block', 'retry', 'stable_fallback']),
    fallback: z.string().min(20),
  }).strict(),
  learning: z.object({
    reads_active_preferences: z.boolean(),
    emits_observations: z.boolean(),
    may_activate_rules: z.literal(false),
  }).strict(),
  validation: z.object({
    test_paths: z.array(RepoPathV1Schema).min(1),
    regression_cases: z.array(z.string().min(12)).min(2),
  }).strict(),
}).strict()
export type StationDefinitionV1 = z.infer<typeof StationDefinitionV1Schema>

export const StationRegistryV1Schema = z.object({
  schema_version: z.literal(1),
  registry_id: z.literal('mindmake-production-stations'),
  registry_version: z.number().int().positive(),
  station_contracts: z.array(z.object({
    station_id: StageNameV2Schema,
    definition_path: RepoPathV1Schema,
  }).strict()).min(1).refine(
    (value) => new Set(value.map((entry) => entry.station_id)).size === value.length,
    { message: 'station registry cannot contain duplicate station IDs' },
  ),
  external_inputs: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).refine(
    (value) => new Set(value).size === value.length,
    { message: 'external station inputs cannot contain duplicates' },
  ),
  terminal_outputs: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1).refine(
    (value) => new Set(value).size === value.length,
    { message: 'terminal station outputs cannot contain duplicates' },
  ),
  assemblies: SourceModeStageMapV1Schema,
}).strict().superRefine((value, context) => {
  const registered = new Set(value.station_contracts.map((entry) => entry.station_id))
  for (const [mode, stages] of Object.entries(value.assemblies)) {
    for (const stage of stages) {
      if (!registered.has(stage)) context.addIssue({ code: 'custom', path: ['assemblies', mode], message: `assembly references unregistered station ${stage}` })
    }
    if (new Set(stages).size !== registered.size || stages.some((stage) => !registered.has(stage))) {
      context.addIssue({ code: 'custom', path: ['assemblies', mode], message: 'every assembly must contain every registered station exactly once' })
    }
  }
})
export type StationRegistryV1 = z.infer<typeof StationRegistryV1Schema>
