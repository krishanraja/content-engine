import { z } from 'zod'
export const CameraSchema = z.object({
  k: z.number().finite().positive(), rot: z.number().finite(), tx: z.number().finite(), ty: z.number().finite(),
  backdrop: z.enum(['cotton','cotton_flip','hardware']),
  bg: z.object({k:z.number().finite().positive(),x:z.number().finite(),y:z.number().finite(),rot:z.number().finite().default(0)}).strict().optional(),
}).strict()
export const ParamsSchema = z.object({
  cameras: z.record(z.string(),CameraSchema), start:z.string().min(1),
  glass:z.record(z.string(),z.record(z.string(),z.unknown())),
}).strict().superRefine((p,ctx)=>{
  if (!p.cameras[p.start]) ctx.addIssue({code:'custom',message:'start must name a camera',path:['start']})
})
export type StageCamera = z.infer<typeof CameraSchema>
