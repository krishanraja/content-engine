import { z } from 'zod'
export const Params = z.object({
  images: z.array(z.string().min(1)).max(3).default([]),
  object: z.literal('branch').default('branch'),
  parts: z.number().int().min(1).max(100).default(20),
  copies: z.number().int().min(0).max(10).default(3),
  towers: z.object({left:z.number().int().min(0).max(100),right:z.number().int().min(0).max(100)}).default({left:20,right:7}),
  labels: z.record(z.string(), z.string().max(80)).default({}),
}).strict()
