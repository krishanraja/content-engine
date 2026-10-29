import { describe, expect, it } from 'vitest'
import { engineRuntimeRoot, expandWindowsVars, localRoots, pruneTargets, readLocalRoots, repoPath, worktreePath } from '../packages/core/src/paths.js'

// W2.11: one local layout. config/studio.json local_roots names where the repositories, their worktrees and the
// engine's runtime live on a home computer; every reader resolves from it (worker A's check:local-paths refuses a
// hard-coded dev path). Synthetic environment only.

const env = { USERPROFILE: 'C:\\Users\\someone', LOCALAPPDATA: 'C:\\Users\\someone\\AppData\\Local' }

describe('local roots (W2.11)', () => {
  it('resolves a repository, a branch worktree and the runtime from config', () => {
    const roots = localRoots()
    expect(repoPath('content-engine', roots, env)).toBe('C:\\Users\\someone\\dev\\makeyourmindup\\content-engine')
    expect(worktreePath('content-engine', 'claude/w2-11', roots, env)).toBe('C:\\Users\\someone\\dev\\makeyourmindup\\.worktrees\\content-engine\\claude-w2-11')
    expect(engineRuntimeRoot(roots, env)).toBe('C:\\Users\\someone\\AppData\\Local\\makeyourmindup')
  })
  it('refuses a folder name that climbs out, and a variable the computer does not set', () => {
    expect(() => repoPath('..', localRoots(), env)).toThrow(/not a folder name/)
    expect(() => expandWindowsVars('%NOPE%\\x', {})).toThrow(/not set/)
    expect(() => readLocalRoots({ local_roots: { repos: 'x', worktrees: 'y', runtime: 'z', engine_runtime: [] } })).toThrow(/local_roots needs/)
  })
  it('pruning touches only engine-made runtime listed in the manifest', () => {
    const { allowed, refused } = pruneTargets(['cache', 'renders', 'Documents', '..'], localRoots(), env)
    expect(allowed).toEqual(['C:\\Users\\someone\\AppData\\Local\\makeyourmindup\\cache', 'C:\\Users\\someone\\AppData\\Local\\makeyourmindup\\renders'])
    expect(refused).toEqual(['Documents', '..'])
  })
})
