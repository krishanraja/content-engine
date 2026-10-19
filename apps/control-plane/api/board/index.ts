import { createBoardHandler } from './_handler.js'
export default createBoardHandler(async () => (await import('../_supabase.js')).supabase)
