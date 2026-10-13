import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { agentClients, check, clientsProblem, closingWrites, kindsProblem, migrationKinds, routeKinds, tombstonesIn, triggerClients } from '../../scripts/check-one-close.js'

// Step 4, part C: nothing in the engine closes a board item but the board
// route (scripts/check-one-close.ts). Krish, 2026-10-11: "this entire session
// was created to deduplicate and eliminate entropy." Each rule fails on a
// made-up breach and passes the tree as it is.

describe('the one-close guard', () => {
  it('passes the tree as it is', () => {
    expect(check()).toEqual([])
  })

  it('rule 1: a board write into done or archived anywhere but the board route fails, in any language', () => {
    const ts = "await supabase.from('work_board_items').update({ lane: 'archived', closed_by: 'engine: x' }).eq('id', id)"
    expect(closingWrites('apps/control-plane/api/purge/run.ts', ts)).toHaveLength(1)
    expect(closingWrites('apps/control-plane/api/workbench.ts', ts)).toEqual([])
    const py = "BOARD_PATH = '/api/workbench'\nsend = [{'id': i, 'lane': 'done'} for i in ids]\n"
    expect(closingWrites('scripts/post-pack/making.py', py)).toHaveLength(1)
    const call = "def board(item_id, lane):\n    call('POST', '/api/workbench', {})\n\nboard(f'videos-{d}', 'done', 'made')\n"
    expect(closingWrites('scripts/produce_day.py', call)).toHaveLength(1)
    // A comment, a self-test's fake board and a file that never touches the board pass.
    expect(closingWrites('scripts/x.ts', "// boardCall: lane: 'done' was the old way\nconst x = 1")).toEqual([])
    expect(closingWrites('scripts/x.py', "BOARD_PATH = 'x'\n\ndef self_test():\n    board = {'id': 'a', 'lane': 'done'}\n\nprint(1)\n")).toEqual([])
    expect(closingWrites('apps/x.ts', "const step = { lane: 'done' }")).toEqual([])
  })

  it('rule 1: a write of closed_by anywhere but the board route fails, whatever lane it names', () => {
    // The deleted _boardClose.ts passed the lane through a variable: lane: c.lane.
    const ts = "await supabase.from('work_board_items').update({ lane: next, closed_by: 'engine: x' }).eq('id', id)"
    expect(closingWrites('apps/control-plane/api/x.ts', ts)).toHaveLength(1)
    const py = "making.board_upsert([{'id': i, 'lane': end, 'closed_by': 'Krish'} for i, end in ends.items()])\n"
    expect(closingWrites('scripts/x.py', py)).toHaveLength(1)
    expect(closingWrites('scripts/x.py', "row['closed_by'] = who\n")).toHaveLength(1)
    expect(closingWrites('apps/control-plane/api/workbench.ts', ts)).toEqual([])
    // Reading it, comparing it or typing it is not a write.
    expect(closingWrites('apps/x.ts', "supabase.from('work_board_items').select('id,lane,closed_by')\nif (row.closed_by === 'Krish') x()\ninterface R { closed_by: string | null }")).toEqual([])
    expect(closingWrites('scripts/x.py', "if item['closed_by'] == 'Krish':\n    pass\n")).toEqual([])
  })

  it('rule 2: an old closer\'s name fails, outside a comment', () => {
    expect(tombstonesIn('apps/x.ts', "import { itemsToClose } from './_boardClose.js'")).toHaveLength(2)
    expect(tombstonesIn('scripts/x.py', 'closed = making.board_close(ends)')).toHaveLength(1)
    expect(tombstonesIn('scripts/x.py', '# board_close went in step 4')).toEqual([])
    expect(tombstonesIn('apps/x.ts', "select public.board_close_ref_ok(k, ref, idea, id)")).toEqual([])
  })

  it('rule 3: the route\'s kinds must equal the newest migration\'s', () => {
    const route = "export const PIECE_KINDS = ['record', 'published'] as const\nexport const CLOSE_KINDS = new Set<string>([...PIECE_KINDS, 'session'])"
    expect(routeKinds(route)).toEqual(['published', 'record', 'session'])
    const migrations: Array<[string, string]> = [
      ['20261001_a.sql', "add constraint work_board_items_closes_on_check check (closes_on in ('record'))"],
      ['20261022_b.sql', "add constraint work_board_items_closes_on_check check (closes_on is null or closes_on in ('record','published','session'))"],
      ['20261023_c.sql', 'create table x (y int)'],
    ]
    expect(migrationKinds(migrations)).toEqual({ file: '20261022_b.sql', kinds: ['published', 'record', 'session'] })
    // The comparison itself: agreeing passes, a migration missing a kind fails, and so does an unreadable route.
    expect(kindsProblem(route, migrations)).toBeNull()
    const missing: Array<[string, string]> = [...migrations, ['20261024_d.sql', "add constraint work_board_items_closes_on_check check (closes_on in ('record','published'))"]]
    expect(kindsProblem(route, missing)).toMatch(/^rule 3: CLOSE_KINDS in .* \(published, record, session\) differs from 20261024_d\.sql \(published, record\)$/)
    expect(kindsProblem('const x = 1', migrations)).toMatch(/^rule 3: CLOSE_KINDS could not be read/)
    expect(kindsProblem(route, [])).toMatch(/^rule 3: no migration sets/)
  })

  it("rule 4: the trigger's session list must equal AGENT_CLIENTS", () => {
    expect(agentClients("export const AGENT_CLIENTS = new Set(['codex', 'runner'])")).toEqual(['codex', 'runner'])
    const sql = "create or replace function public.only_a_check_or_krish_closes() returns trigger\nlanguage plpgsql as $$\ndeclare\n  agents constant text[] := array['codex', 'runner', 'cron'];\nbegin"
    expect(triggerClients([['20261023_one.sql', sql]])).toEqual({ file: '20261023_one.sql', clients: ['codex', 'cron', 'runner'] })
    // The comparison itself: agreeing passes, a trigger missing a client fails, and so does one with no list.
    const edit = "export const AGENT_CLIENTS = new Set(['codex', 'runner', 'cron'])"
    expect(clientsProblem(edit, [['20261023_one.sql', sql]])).toBeNull()
    const chatgpt = "export const AGENT_CLIENTS = new Set(['codex', 'runner', 'cron', 'chatgpt'])"
    expect(clientsProblem(chatgpt, [['20261023_one.sql', sql]])).toMatch(/^rule 4: the trigger in 20261023_one\.sql lets codex, cron, runner close session work, but AGENT_CLIENTS is chatgpt, codex, cron, runner$/)
    const noList = "create or replace function public.only_a_check_or_krish_closes() returns trigger as $$ begin return new; end $$"
    expect(clientsProblem(edit, [['20261023_one.sql', sql], ['20261030_two.sql', noList]])).toMatch(/^rule 4: .*20261030_two\.sql/)
    expect(clientsProblem('const x = 1', [['20261023_one.sql', sql]])).toMatch(/^rule 4: AGENT_CLIENTS could not be read/)
    expect(clientsProblem(edit, [])).toMatch(/^rule 4: no migration defines/)
  })

  it('rule 5: the board skills rule (validate-skills.py, board_item_problems) catches an item with no closes_on and a close', () => {
    const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
    const py = process.platform === 'win32' ? 'python' : 'python3'
    const run = spawnSync(py, [join(root, 'scripts', 'validate-skills.py'), '--self-test'], { encoding: 'utf8' })
    expect(run.stderr).toBe('')
    expect(run.status).toBe(0)
    expect(run.stdout).toContain('an item with no closes_on and a close are each caught; a clean skill passes')
  })
})
