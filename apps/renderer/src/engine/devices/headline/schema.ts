import { z } from 'zod'
export const ParamsSchema = z.object({
  // 'assemble' lands each word from a scale; 'blur' (the platform walkthrough, Krish, 2026-11-20) sharpens each word from 8 px
  // of blur over 3 frames, 4 frames apart, never a move: the Character.ai card's WORD BLUR-IN.
  reveal: z.enum(['assemble', 'blur']).optional(),
  // Per-word tone: these words in mint (or the series colour) with no box behind them, the platform walkthrough's two-tone line.
  tone: z.array(z.object({ line: z.number().int().min(0).max(1), word: z.number().int().nonnegative(),
    colour: z.enum(['mint', 'channel']).default('mint') }).strict()).max(3).optional(),
  // A soft ink shadow under the lines, for legibility over a busy wall (the UI wall behind a platform-walkthrough headline).
  shadow: z.boolean().default(false),
  lines: z.array(z.string().trim().min(1)).min(1).max(2),
  swipe: z.object({ line: z.number().int().min(0).max(1), word: z.number().int().nonnegative() }).strict().optional(),
  dek: z.string().min(1).optional(),
  // The ground it sits on: ink by default; 'light' draws the lines in ink on face-with-proof's light STAGE wash.
  ground: z.enum(['ink', 'light']).default('ink'),
  // An ink panel behind the dek, for a dek that sits over a light plate (a wide cut over the cotton photograph).
  dekBack: z.boolean().default(false),
  dekAt: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), w: z.number().positive() }).strict().optional(),
  // `h` is the room the lines may fill: the 270 px headline zone by default, taller only for a splash title.
  at: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), w: z.number().positive(), h: z.number().min(270).max(420).optional() }).strict().optional(),
}).strict().superRefine((p, ctx) => {
  if (p.swipe && !p.lines[p.swipe.line]?.split(/\s+/)[p.swipe.word])
    ctx.addIssue({ code: 'custom', message: 'Swipe must address one existing word' })
  for (const t of p.tone ?? []) if (!p.lines[t.line]?.split(/\s+/)[t.word])
    ctx.addIssue({ code: 'custom', message: 'A tone must address one existing word' })
})
