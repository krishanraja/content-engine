import { z } from 'zod'
export const Params = z.object({
  cards:z.array(z.object({id:z.string().min(1),label:z.string(),unit:z.string().optional()}).strict()).min(2).max(6),
  chart:z.object({expected:z.string(),lines:z.array(z.object({id:z.string(),label:z.string()}).strict()).min(1).max(2)}).strict().optional(),
  tabs:z.array(z.string()).max(5).default([]),
  rows:z.array(z.string()).max(6).default([]),
}).strict().superRefine((p,c)=>{if(new Set(p.cards.map(x=>x.id)).size!==p.cards.length)c.addIssue({code:'custom',message:'duplicate card id'})})
