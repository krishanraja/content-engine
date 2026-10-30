import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
const { OVERNIGHT_REASONS, overnightReadiness, parseLaneReport } = await import('../apps/control-plane/api/library/_lanes.js')

// The overnight run (plan Wave 2, W2.6) on Krish's home computers: Codex and scripts only, started by his Titles press
// through the recordings pass that already polls the engine with no window, and never a Claude on a timer.
// Ruling (Krish, 2026-10-29): "FYI, I want zero Claude routines. No Claude schedules of any kind in this architecture".
// Krish, 2026-10-28: "HIDE ALL CONSOLE POP UPS FOREVER FROM EVERY REPO AND LOCAL TASK".

const ROOT = join(__dirname, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
const upload = read('scripts/recordings-upload.ps1')
const fn = (source: string, name: string) => {
  const start = source.search(new RegExp(`\\nfunction ${name}\\b`))
  expect(start, name).toBeGreaterThan(-1)
  const next = source.indexOf('\nfunction ', start + 1)
  return source.slice(start, next > -1 ? next : undefined)
}
const PY = process.platform === 'win32' ? 'python' : 'python3'

describe('the overnight run', () => {
  it('its profile, Critic, repair rounds and Monday board hold on synthetic fixtures', () => {
    const run = spawnSync(PY, ['tests/overnight_test.py'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    expect(run.status, run.stdout + run.stderr).toBe(0)
  }, 120_000)

  it('starts from the recordings pass on his Titles press, once, with no window, and adds no scheduled task', () => {
    const pass = upload.slice(upload.indexOf('  if (-not $Check) {\n'), upload.indexOf('function Publish-Music {'))
    expect(pass).toContain('try { Invoke-Overnight } catch {')
    expect(pass.indexOf('Invoke-Overnight')).toBeLessThan(pass.indexOf('Send-LaneReport'))
    const start = fn(upload, 'Invoke-Overnight')
    expect(start).toContain("Invoke-StudioPython @($OvernightScript, 'due', '--json')")
    expect(start).toContain("[string](Get-Field $last 'week') -ne $week")
    expect(start).toContain("Start-Hidden $StudioPython")
    const hidden = fn(upload, 'Start-Hidden')
    expect(hidden).toContain('$start.CreateNoWindow = $true')
    expect(hidden).toContain('$start.UseShellExecute = $false')
    expect(fn(upload, 'Get-OvernightRole')).toContain("@('primary', 'standby') -contains $role")
    expect(upload).toContain("'MINDMAKE_OVERNIGHT_ROLE')")
    expect(fn(upload, 'Send-LaneReport')).toContain("$report['overnight'] = $script:Overnight")
    for (const path of ['scripts/overnight/overnight.py', 'scripts/overnight/critic.py', 'scripts/overnight/critic_run.py', 'scripts/overnight/codex_profile.py']) {
      const text = read(path)
      expect(text, path).not.toMatch(/Register-ScheduledTask|schtasks|crontab|claude\s+(-p|--print)|anthropics\/claude-code-action/)
    }
    // The run's own children start with no console window on Windows.
    expect(read('scripts/overnight/overnight.py')).toContain('0x08000000 if sys.platform == \'win32\'')
    expect(read('scripts/produce_day.py')).toContain("ap.add_argument('--cut', choices=sorted(SHAPE)")
  })

  it('the lane keeps the overnight block as codes, days and times, never a path or a message', () => {
    const report = parseLaneReport({
      machine: 'SURFACE', problems: [],
      overnight: {
        week: '2026-11-16', role: 'standby', state: 'finished', started_at: '2026-11-09T02:00:00Z', finished_at: '2026-11-09T05:10:00Z',
        critic_calibrated: true, file: 'C:\\Users\\krish\\cut.mp4',
        cuts: [
          { day: 'mon', cut: 'short', status: 'held', reason_code: 'needs_new_take', where: 'composition at 1:15', url: null, reason: 'a whole message' },
          { day: 'wed', cut: 'short', status: 'made', reason_code: null, where: 'composition at 1:15: the chart is cramped', url: 'https://drive.google.com/file/d/abc/view' },
          { day: 'sun', cut: 'short', status: 'made' },
          { day: 'fri', cut: 'short', status: 'held', reason_code: 'made_up', url: 'file:///C:/x' },
        ],
      },
    }, new Date(0).toISOString())!
    expect(report.overnight).toEqual({
      week: '2026-11-16', role: 'standby', state: 'finished', started_at: '2026-11-09T02:00:00Z', finished_at: '2026-11-09T05:10:00Z',
      critic_calibrated: true,
      cuts: [
        { day: 'mon', cut: 'short', status: 'held', reason_code: 'needs_new_take', where: 'composition at 1:15', url: null },
        { day: 'wed', cut: 'short', status: 'made', reason_code: null, where: null, url: 'https://drive.google.com/file/d/abc/view' },
        { day: 'fri', cut: 'short', status: 'held', reason_code: null, where: null, url: null },
      ],
    })
    expect(parseLaneReport({ machine: 'A', problems: [], overnight: { week: 'x', role: 'primary', state: 'finished' } }, '')).not.toHaveProperty('overnight')
    // The reasons the lane keeps are exactly the run's.
    const py = read('scripts/overnight/overnight.py')
    const reasons = [...py.slice(py.indexOf('REASONS = {'), py.indexOf('\n}', py.indexOf('REASONS = {'))).matchAll(/^ {4}'([a-z_]+)':/gm)].map((m) => m[1])
    expect(reasons).toEqual([...OVERNIGHT_REASONS])
  })

  it('says whether both computers passed their last preflight, by role', () => {
    const at = '2026-11-07T18:05:00Z'
    const now = Date.parse('2026-11-08T12:00:00Z')
    const report = (machine: string, role: string, ok: boolean) => parseLaneReport({ machine, problems: [], preflight: { at, ok, failed: ok ? [] : ['disk'], role } }, at)!
    expect(overnightReadiness([report('DESK', 'primary', true), report('SURFACE', 'standby', true)], now).ready).toBe(true)
    const one = overnightReadiness([report('DESK', 'primary', true), report('SURFACE', 'standby', false)], now)
    expect(one.ready).toBe(false)
    expect(one.standby).toEqual({ machine: 'SURFACE', ok: false, at, failed: ['disk'] })
    expect(overnightReadiness([report('DESK', 'primary', true)], now)).toMatchObject({ standby: null, ready: false })
    expect(overnightReadiness([report('DESK', 'none', true)], now).primary).toBeNull()
  })

  it('a repair round is one bounded GitHub job, started by the board or his press, writing records only', () => {
    const text = read('.github/workflows/repair-round.yml')
    expect(text).not.toMatch(/^\s*schedule:/m)
    expect(text).toContain('workflow_dispatch:')
    expect(text).toContain('repository_dispatch:\n    types: [repair-round]')
    expect(text).toContain('--max-turns 120')
    expect(text).toMatch(/group: repair-round-\$\{\{ github\.event\.inputs\.week \|\| github\.event\.client_payload\.week \}\}/)
    const tools = /--allowedTools "([^"]*)"/.exec(text)![1]!.split(',')
    expect(tools.filter((t) => /^(Edit|Write|MultiEdit|NotebookEdit)\b/.test(t))).toEqual([])
    expect(text).toContain('contents: read')
    const steps = text.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n')
    expect(steps).not.toMatch(/git push|gh pr/)
    expect(read('scripts/overnight/overnight.py')).toContain("'gh', 'workflow', 'run', setting['workflow']")
    expect(JSON.parse(read('config/overnight.json')).repair_round.workflow).toBe('repair-round.yml')
  })
})
