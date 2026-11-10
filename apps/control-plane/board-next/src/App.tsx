import * as React from 'react'
import { Toaster, toast } from 'sonner'
import { Command } from 'cmdk'
import { api, BoardError, week, type Day, type PathKey, type View } from './api'
import { Button, Chip, CountUp, Panel, StatusDot, cx } from './components/ui'
import { DayActions, StepPanel, Stepper } from './components/path'
import { ReviewCard } from './components/review'

const TONE: Record<Day['who'], 'amber' | 'bad' | 'muted' | 'ok'> = { you: 'amber', stuck: 'bad', engine: 'muted', growth: 'muted', done: 'ok' }
const WORD: Record<Day['who'], string> = { you: 'Needs you', stuck: 'Stuck', engine: 'In hand', growth: 'With Growth', done: 'Done' }
const NEXT: Record<Day['who'], string> = { you: 'Next, you', stuck: 'Stuck', engine: 'Next, the engine', growth: 'Next, Growth', done: 'Done' }
const STOPS = ['Idea', 'Story', 'Make', 'Approve', 'Live']
const TEXT = { amber: 'text-amber', bad: 'text-bad', muted: 'text-muted', ok: 'text-ok' } as const

function useView() {
  const [view, setView] = React.useState<View | null>(null)
  const [readAt, setReadAt] = React.useState(0)
  const [error, setError] = React.useState<null | 'locked' | 'offline'>(null)
  const load = React.useCallback(async () => {
    try { const v = await api.view(); setView(v); setReadAt(Date.now()); setError(null) }
    catch (e) { setError(e instanceof BoardError && e.status === 401 ? 'locked' : 'offline') }
  }, [])
  React.useEffect(() => {
    void load()
    const id = setInterval(() => { if (!document.querySelector('textarea:focus')) void load() }, 10_000)
    return () => clearInterval(id)
  }, [load])
  return { view, readAt, error, load }
}

function Live({ readAt, error }: { readAt: number; error: null | 'locked' | 'offline' }) {
  const [, tick] = React.useState(0)
  React.useEffect(() => { const id = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(id) }, [])
  const s = Math.round((Date.now() - readAt) / 1000)
  const stale = Boolean(error) || (readAt > 0 && s > 30)
  const text = error === 'locked' ? 'Locked' : stale ? 'Reconnecting' : !readAt ? 'Loading' : s < 5 ? 'Live' : `Live, ${s}s ago`
  return <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs font-semibold text-muted"><StatusDot tone={stale ? 'amber' : 'ok'} pulse={!stale && readAt > 0} label={text} /><span className="truncate">{text}</span></span>
}

/** One day: the same layout for every day of every week. Collapsed by default to one row and its next action. */
function DayCard({ day, open, onToggle, reload }: { day: Day; open: boolean; onToggle: () => void; reload: () => void }) {
  const [step, setStep] = React.useState<PathKey | null>(day.path?.current ?? null)
  React.useEffect(() => { setStep(day.path?.current ?? null) }, [day.path?.current])
  return (
    <article id={`day-${day.day}`} className="rounded-[22px] border border-line bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="grid w-full grid-cols-[72px_minmax(0,1fr)_24px] items-start gap-x-3 gap-y-2 p-4 text-left sm:grid-cols-[96px_minmax(0,1fr)_200px_24px] sm:items-center sm:p-5">
        <span className="min-w-0"><span className="block font-mono text-sm font-semibold">{day.label}</span><span className="block break-words font-mono text-[11px] leading-snug text-muted">{day.kind}</span></span>
        <span className="min-w-0"><span className="block break-words text-[16px] font-semibold leading-snug">{day.title}</span><span className="block break-words font-mono text-xs text-muted">{day.series}</span></span>
        <span className="col-span-3 row-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1" aria-label={`Stage ${day.stop + 1} of 5: ${STOPS[day.stop]}`}>
          <span className="flex items-center">
            {STOPS.map((s, n) => (
              <span key={s} className="relative flex flex-1 flex-col items-center gap-1">
                {n < STOPS.length - 1 && <span aria-hidden className={cx('absolute left-1/2 top-[6px] w-full border-t-2', n < day.stop || day.who === 'done' ? 'border-ok' : 'border-dashed border-line')} />}
                <span aria-hidden className={cx('relative z-10 size-3.5 rounded-full border-2',
                  n < day.stop || day.who === 'done' ? 'border-ok bg-ok' : n === day.stop ? (day.who === 'stuck' ? 'border-bad bg-bad' : 'border-amber bg-amber') : 'border-line bg-card')} />
                <span className="font-mono text-[10px] text-muted">{s}</span>
              </span>
            ))}
          </span>
        </span>
        <span aria-hidden className={cx('col-start-3 row-start-1 mt-1 text-muted transition-transform sm:col-start-4 sm:mt-0', open && 'rotate-90')}>›</span>
      </button>
      <div className="border-t border-line px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        <p className="min-w-0 text-[15px] leading-snug"><span className={cx('mr-2 font-mono text-[11px] font-semibold uppercase', TEXT[TONE[day.who]])}>{NEXT[day.who]}</span>{day.next}</p>
        {!open && day.actions.length > 0 && <div className="mt-3"><DayActions day={day} reload={reload} onReview={onToggle} /></div>}
        {day.run && <p className="mt-2 truncate font-mono text-xs text-muted">Last run of {day.run.workflow}: {day.run.state} · <a className="underline" href={day.run.url} target="_blank" rel="noopener">open run</a></p>}
        {open && (
          <div className="mt-4 flex flex-col gap-4">
            {day.path && step && <><Stepper path={day.path} open={step} onOpen={setStep} /><StepPanel key={step} day={day} step={step} reload={reload} /></>}
            {day.reviews?.map(r => <ReviewCard key={r.doc_id} review={r} day={day.day} label={`${day.label} · ${r.option.id}`} reload={reload} />)}
            {!day.path && !day.reviews?.length && day.actions.length > 0 && <Panel title={day.next} chip={<Chip tone={TONE[day.who]}>{WORD[day.who]}</Chip>} why={`Runs on: ${day.runs_on}`} actions={<DayActions day={day} reload={reload} />} />}
            {day.detail.length > 0 && (
              <details className="rounded-2xl border border-line bg-bg">
                <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 font-mono text-[13px] font-semibold text-muted">What stands behind it</summary>
                <dl className="grid gap-3 px-4 pb-4 sm:grid-cols-3">{day.detail.map(x => <div key={x.h} className="min-w-0"><dt className="font-mono text-[11px] uppercase text-muted">{x.h}</dt><dd className="break-words text-[14px]">{x.p}</dd></div>)}</dl>
              </details>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

/** Focus mode: one thing at a time, the most urgent first. Enter does it, N skips it. */
function Focus({ view, reload, openDay }: { view: View; reload: () => void; openDay: (d: string) => void }) {
  const [skip, setSkip] = React.useState(0)
  const items = view.yours
  const n = items.length
  const item = n ? items[skip % n] : null
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,[role=dialog]')) return
      if (e.key.toLowerCase() === 'n' && n > 1) setSkip(s => s + 1)
    }
    addEventListener('keydown', on); return () => removeEventListener('keydown', on)
  }, [n])
  if (!item) return <Panel title={view.days.every(d => d.who === 'done') ? 'Week done' : 'Nothing needs you'} why="Everything left is with the engine or Growth. Each day below says what runs next." />
  const day = view.days.find(d => d.day === item.day)!
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs font-semibold text-muted">{(skip % n) + 1} of {n} · {item.label}</p>
        {n > 1 && <Button tone="ghost" onClick={() => setSkip(s => s + 1)} title="Skip for now (N)">Skip for now</Button>}
      </div>
      {item.review ? <ReviewCard review={item.review} day={item.day} label={item.label} reload={reload} />
        : <Panel title={item.next} chip={<Chip tone={TONE[day.who]}>{WORD[day.who]}</Chip>} why={`${day.label} · ${day.title}`}
            actions={<DayActions day={day} reload={reload} onReview={() => openDay(day.day)} />}
            after={day.path ? <button type="button" onClick={() => openDay(day.day)} className="min-h-11 font-mono text-[13px] font-semibold text-muted hover:text-ink">Open the day's path ›</button> : undefined} />}
    </div>
  )
}

function Palette({ view, open, setOpen, openDay }: { view: View | null; open: boolean; setOpen: (o: boolean) => void; openDay: (d: string) => void }) {
  if (!view) return null
  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Jump to anything"
      className="fixed left-1/2 top-[12vh] z-50 w-[min(560px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[20px] border border-line bg-card text-ink shadow-2xl"
      overlayClassName="fixed inset-0 z-40 bg-black/40">
      <Command.Input placeholder="A day, a piece, a step" className="h-14 w-full border-b border-line bg-transparent px-5 text-[16px] outline-none" />
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="p-4 text-muted">Nothing matches.</Command.Empty>
        <Command.Group heading="Days">
          {view.days.map(d => (
            <Command.Item key={d.day} value={`${d.label} ${d.title} ${d.series}`} onSelect={() => { setOpen(false); openDay(d.day) }}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 data-[selected=true]:bg-soft">
              <span className="min-w-0 truncate"><b className="font-mono text-sm">{d.label}</b> {d.title}</span><Chip tone={TONE[d.who]}>{WORD[d.who]}</Chip>
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Elsewhere">
          <Command.Item value="full board" onSelect={() => { location.href = `/board/${week}` }} className="flex min-h-11 cursor-pointer items-center rounded-xl px-3 data-[selected=true]:bg-soft">The full board for this week</Command.Item>
          <Command.Item value="production standards" onSelect={() => { location.href = '/board/standards' }} className="flex min-h-11 cursor-pointer items-center rounded-xl px-3 data-[selected=true]:bg-soft">Production standards</Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}

export function App() {
  const { view, readAt, error, load } = useView()
  const [open, setOpen] = React.useState<Record<string, boolean>>({})
  const [palette, setPalette] = React.useState(false)
  const [weeks, setWeeks] = React.useState<string[]>([])
  React.useEffect(() => { api.weeks().then(w => setWeeks(w.weeks.slice(0, 4).reverse())).catch(() => {}) }, [])
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) } }
    addEventListener('keydown', on); return () => removeEventListener('keydown', on)
  }, [])
  const count = view?.yours.length ?? 0
  React.useEffect(() => { document.title = count ? `(${count}) The Desk` : 'The Desk' }, [count])
  const prev = React.useRef<View | null>(null)
  React.useEffect(() => {
    // A run that has just ended says so where he is, whichever day it was on.
    if (prev.current && view) for (const d of view.days) {
      const was = prev.current.days.find(x => x.day === d.day)?.run
      if (was && d.run && was.state !== d.run.state && ['done', 'failed'].includes(d.run.state)) toast(`${d.label}: ${d.run.workflow} ${d.run.state === 'done' ? 'finished' : 'failed'}`)
    }
    prev.current = view
  }, [view])
  const openDay = (d: string) => { setOpen(o => ({ ...o, [d]: true })); setTimeout(() => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }
  const span = view ? `${new Date(view.days[0].date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })} to ${new Date(view.days[view.days.length - 1].date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}` : ''
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-3 px-4">
          <Live readAt={readAt} error={error} />
          {view?.north_star && <span className="ml-auto flex shrink-0 items-baseline gap-1.5"><b className="font-display text-2xl leading-none"><CountUp to={view.north_star.current} /></b><span className="font-mono text-xs text-muted">of {view.north_star.target}<span className="hidden sm:inline"> published</span> this week</span></span>}
          <Button tone="secondary" className={cx(!view?.north_star && 'ml-auto')} onClick={() => setPalette(true)} title="Jump to anything (⌘K)">Jump</Button>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 pb-24">
        <nav aria-label="Publishing weeks" className="flex gap-2 overflow-x-auto pt-5 [scrollbar-width:none]">
          {weeks.map(w => <a key={w} href={`/board/${w}`} aria-current={w === week ? 'page' : undefined}
            className={cx('inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-[15px] font-semibold', w === week ? 'border-ink bg-ink text-bg' : 'border-line bg-card')}>
            Week of {new Date(w + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</a>)}
          <a href={`/board/${week}?archive=1`} className="inline-flex h-11 shrink-0 items-center rounded-full border border-dashed border-line px-4 text-[15px] font-semibold text-muted hover:bg-soft">Old board (archive)</a>
        </nav>
        <p className="mt-5 font-mono text-xs font-semibold uppercase tracking-widest text-muted">{span}</p>
        <h1 className="mt-1 font-display text-[clamp(40px,8vw,72px)] uppercase leading-[0.95]">{!view ? 'The Desk' : count ? `${count} thing${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} you` : view.days.every(d => d.who === 'done') ? 'Week done' : 'Nothing needs you'}</h1>
        {error === 'locked' && <p className="mt-4 rounded-2xl bg-[color-mix(in_srgb,var(--bad)_12%,var(--card))] p-4 font-semibold text-bad">Unlock the board to see it live: <a className="underline" href={`https://content.krishraja.com/board/${week}`}>open it at content.krishraja.com</a> and sign in there.</p>}
        {error === 'offline' && view && <p className="mt-4 rounded-2xl bg-soft p-4 font-semibold">Reconnecting. Showing what was true at {new Date(readAt).toTimeString().slice(0, 5)}.</p>}
        {view && (
          <>
            <ul aria-label="The week at a glance" className="mt-5 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-6">
              {view.days.map(d => (
                <li key={d.day} className="min-w-0">
                  <button type="button" onClick={() => openDay(d.day)} className="flex min-h-16 w-full min-w-0 flex-col items-start justify-center gap-1 rounded-2xl border border-line bg-card px-3 text-left hover:bg-soft">
                    <span className="font-mono text-xs text-muted">{d.label}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold"><StatusDot tone={TONE[d.who]} label={WORD[d.who]} /><span className="truncate">{WORD[d.who]}</span></span>
                  </button>
                </li>
              ))}
            </ul>
            <section aria-labelledby="move" className="mt-10">
              <h2 id="move" className="font-display text-[28px] uppercase leading-none">Your move</h2>
              <p className="mt-1 text-[15px] text-muted">One thing at a time, most urgent first.</p>
              <div className="mt-4"><Focus view={view} reload={load} openDay={openDay} /></div>
            </section>
            <section aria-labelledby="week-h" className="mt-10">
              <h2 id="week-h" className="font-display text-[28px] uppercase leading-none">The week, day by day</h2>
              <p className="mt-1 text-[15px] text-muted">Every day has the same shape. Open one for its path.</p>
              <div className="mt-4 flex flex-col gap-3">{view.days.map(d => <DayCard key={d.day} day={d} open={Boolean(open[d.day])} onToggle={() => setOpen(o => ({ ...o, [d.day]: !o[d.day] }))} reload={load} />)}</div>
            </section>
            <details className="mt-10 rounded-[22px] border border-line bg-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5"><span className="font-display text-[22px] uppercase">What moved</span><span className="font-mono text-xs text-muted">{view.moved.length} recent</span></summary>
              <ol className="ml-7 mr-5 border-l-2 border-line pb-5">
                {view.moved.map((m, k) => <li key={k} className="relative py-2 pl-5"><span aria-hidden className="absolute -left-[7px] top-3.5 size-3 rounded-full border-2 border-muted bg-card" /><time className="block font-mono text-xs text-muted">{new Date(m.at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</time><span className="text-[15px]">{m.text}</span></li>)}
              </ol>
            </details>
          </>
        )}
      </main>
      <Palette view={view} open={palette} setOpen={setPalette} openDay={openDay} />
      <Toaster position="bottom-center" toastOptions={{ className: 'font-sans', style: { background: 'var(--ink)', color: 'var(--bg)', border: 'none' } }} />
    </>
  )
}
