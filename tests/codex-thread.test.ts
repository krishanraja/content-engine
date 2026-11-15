// scripts/codex_thread.mjs: the one way Claude starts Codex (Ruling, Krish, 2026-11-15). These tests never start Codex;
// they hold the parts that decide what a thread is called, where it lives and what `read` prints.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { codexHome, findSessionFile, firstLine, parseArgs, readTurns } from '../scripts/codex_thread.mjs';

describe('codex_thread.mjs', () => {
  it('titles a thread by the first non-blank line of its message', () => {
    expect(firstLine('\n  ve card test for codex-visibility: read AGENTS.md\nmore')).toBe('ve card test for codex-visibility: read AGENTS.md');
    expect(firstLine('')).toBe('Codex thread');
  });

  it('reads options and keeps the thread and message as positionals', () => {
    const opts = parseArgs(['send', 'abc', 'hello', '--cwd', 'x', '--prompt-file', 'p.md', '--detach', '--json']);
    expect(opts.positional).toEqual(['send', 'abc', 'hello']);
    expect(opts).toMatchObject({ cwd: 'x', promptFile: 'p.md', detach: true, json: true });
  });

  it('runs in his everyday Codex home unless one is named', () => {
    const before = process.env.VE_CODEX_DESKTOP_HOME;
    delete process.env.VE_CODEX_DESKTOP_HOME;
    try {
      expect(codexHome()).toBe(path.join(os.homedir(), '.codex'));
      expect(codexHome({ home: '/tmp/h' })).toBe(path.resolve('/tmp/h'));
    } finally {
      if (before !== undefined) process.env.VE_CODEX_DESKTOP_HOME = before;
    }
  });

  it('reads Claude and Desktop turns from the session file and leaves injected context out', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cxt-'));
    const dir = path.join(home, 'sessions', '2026', '11', '15');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'rollout-2026-11-15T16-35-01-t1.jsonl');
    const rows = [
      { type: 'session_meta', payload: { id: 't1', cwd: 'C:/repo', originator: 'codex_thread', source: 'vscode' } },
      { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '# AGENTS.md instructions' }] } },
      { timestamp: 'a', type: 'event_msg', payload: { type: 'item_completed', turn_id: 'u1', item: { type: 'UserMessage', content: [{ type: 'text', text: 'from Claude' }] } } },
      { timestamp: 'b', type: 'event_msg', payload: { type: 'item_completed', turn_id: 'u1', item: { type: 'CommandExecution' } } },
      { timestamp: 'c', type: 'event_msg', payload: { type: 'item_completed', turn_id: 'u1', item: { type: 'AgentMessage', content: [{ type: 'Text', text: 'OK' }] } } },
      { timestamp: 'd', type: 'event_msg', payload: { type: 'item_completed', turn_id: 'u2', item: { type: 'UserMessage', content: [{ type: 'text', text: 'hello from Desktop' }] } } },
    ];
    fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    expect(findSessionFile(home, 't1')).toBe(file);
    const { meta, turns } = readTurns(file);
    expect(meta.cwd).toBe('C:/repo');
    expect(turns.map((t: { role: string; text: string }) => [t.role, t.text])).toEqual([
      ['user', 'from Claude'], ['codex', 'OK'], ['user', 'hello from Desktop'],
    ]);
  });
});
