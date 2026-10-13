import { describe, expect, it } from 'vitest'
import { agentClients, check, closingWrites, migrationKinds, routeKinds, tombstonesIn, triggerClients } from '../../scripts/check-one-close.js'

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
  })

  it("rule 4: the trigger's session list must equal AGENT_CLIENTS", () => {
    expect(agentClients("export const AGENT_CLIENTS = new Set(['codex', 'runner'])")).toEqual(['codex', 'runner'])
    const sql = "create or replace function public.only_a_check_or_krish_closes() returns trigger\n or (old.closes_on = 'session' and new.closed_by in ('codex', 'runner', 'cron')) then"
    expect(triggerClients([['20261023_one.sql', sql]])).toEqual({ file: '20261023_one.sql', clients: ['codex', 'cron', 'runner'] })
  })
})
