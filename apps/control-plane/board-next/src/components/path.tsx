// One day's guided path (PLAN.md, "Each day as a guided path"): six steps, only the current one open.
import * as React from 'react'
import { toast } from 'sonner'
import { api, sayError, type Day, type DayPath, type LookOption, type PathKey } from '../api'
import { ActionBar, Button, Chip, Panel, cx } from './ui'
import { PromptButton, ThoughtsLink } from './sheets'
import { useUndo } from '../undo'

/** The stepper (21st.dev ReUI Stepper with key-value stage details, Keenthemes, MIT; restyled): a dot per step, a dashed
 *  connector that turns solid as steps finish, the step's name under it. Steps are tabs: any can be looked at. */
export function Stepper({ path, open, onOpen }: { path: DayPath; open: PathKey | null; onOpen: (k: PathKey) => void }) {
  return (
    <div role="tablist" aria-label="The day's steps" className="grid grid-cols-3 gap-y-2 sm:grid-cols-6 sm:gap-y-0">
      {path.steps.map((s, n) => {
        const last = n === path.steps.length - 1
        return (
          <div key={s.key} className="relative flex min-w-0 flex-col items-center">
            {!last && <span aria-hidden className={cx('absolute left-1/2 top-[21px] hidden h-0 w-full border-t-2 sm:block',
              s.state === 'done' ? 'border-solid border-ok' : 'border-dashed border-line')} />}
            <button type="button" role="tab" aria-selected={open === s.key} onClick={() => onOpen(s.key)}
              title={`${s.label}: ${s.state === 'done' ? 'done' : s.state === 'current' ? 'now' : 'to come'}`}
              className="relative z-10 flex min-h-11 w-full min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-1 hover:bg-soft">
              <span className={cx('flex size-7 items-center justify-center rounded-full border-2 text-[12px] font-bold',
                s.state === 'done' && 'border-ok bg-ok text-bg',
                s.state === 'current' && 'border-amber bg-amber text-bg ring-4 ring-[color-mix(in_srgb,var(--amber)_22%,transparent)]',
                s.state === 'todo' && 'border-line bg-card text-muted',
                open === s.key && s.state !== 'current' && 'ring-2 ring-ink')}>
                {s.state === 'done' ? '✓' : n + 1}
              </span>
              <span className={cx('w-full truncate text-center font-mono text-[11px] font-semibold', s.state === 'todo' ? 'text-muted' : 'text-ink')}>
                {s.key === 'board' ? 'Storyboard' : s.key === 'cut' ? 'Cut' : s.label}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

const kb = (n: number) => (n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`)
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

/** A Markdown file dropped on the day (21st.dev File Dropzone, joyco, restyled): read in the browser, filed on the piece. */
export function Dropzone({ day, onFiled, role }: { day: Day; onFiled: () => void; role?: 'storyboard' }) {
  const [over, setOver] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const file = async (f: File | undefined) => {
    if (!f || !day.piece_id) return
    const ok = role === 'storyboard' ? /\.(html?|md|markdown|txt)$/i.test(f.name) : /\.(md|markdown|txt)$/i.test(f.name) || /markdown|text\/plain/.test(f.type)
    if (!ok) { toast.error(role === 'storyboard' ? 'Drop the storyboard file (.html or .md).' : 'Drop a Markdown file (.md).'); return }
    if (f.size > 400_000) { toast.error('That file is over 400 KB. Split it, or keep the main findings.'); return }
    setBusy(true)
    try { const text = await f.text(); await api.material(day.piece_id, f.name, text, role); toast.success(role === 'storyboard' ? `The storyboard is on file: ${f.name}.` : `${f.name} is on this piece. Every later step reads it.`); onFiled() }
    catch (e) { toast.error(sayError(e)) }
    setBusy(false)
  }
  return (
    <div onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); void file(e.dataTransfer.files[0]) }}
      className={cx('flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center transition-colors',
        over ? 'border-ok bg-[color-mix(in_srgb,var(--ok)_8%,transparent)]' : 'border-line bg-bg')}>
      <p className="text-[15px] text-muted">{busy ? 'Filing it on the piece…' : role === 'storyboard' ? 'Drop the session\'s storyboard here' : 'Drop your research Markdown here'}</p>
      <Button tone="ghost" busy={busy} onClick={() => input.current?.click()}>Choose a file</Button>
      <input ref={input} type="file" accept={role === 'storyboard' ? '.html,.htm,.md,.markdown,.txt,text/html,text/markdown' : '.md,.markdown,.txt,text/markdown,text/plain'} hidden onChange={e => void file(e.target.files?.[0])} />
    </div>
  )
}

/** The look picker (21st.dev Comparing Radio Cards, dhxwhy, restyled): real radio inputs; the picked card lifts with a
 *  ring, the recommended one carries its badge, each shows what it is and how proven it is on his channel. */
function LookCards({ options, value, onChange, recommended }: { options: LookOption[]; value: string; onChange: (v: string) => void; recommended: string | null }) {
  const name = React.useId()
  return (
    <div role="radiogroup" aria-label="Looks the engine can make" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {options.map(o => {
        const on = o.id === value
        return (
          <label key={o.id} className={cx('relative flex min-h-[120px] cursor-pointer flex-col rounded-2xl border bg-bg p-4 transition-[transform,box-shadow]',
            'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-mint',
            on ? '-translate-y-1 border-ink shadow-[0_18px_36px_-18px_rgba(12,21,18,.45)] ring-2 ring-ink' : 'border-line hover:-translate-y-0.5')}>
            <input type="radio" className="sr-only" name={name} value={o.id} checked={on} onChange={() => onChange(o.id)} />
            <span className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className={cx('flex size-[18px] shrink-0 items-center justify-center rounded-full border', on ? 'border-ink' : 'border-line')}>
                <span className={cx('size-2 rounded-full bg-ink transition-transform', on ? 'scale-100' : 'scale-0')} />
              </span>
              <span className="min-w-0 truncate text-[15px] font-semibold" title={o.name}>{o.name}</span>
            </span>
            <span className="mt-2 line-clamp-3 text-[14px] leading-snug text-muted">{o.pitch}</span>
            <span className="mt-auto flex flex-wrap gap-1.5 pt-3">
              {o.id === recommended && <Chip tone="ink">Recommended</Chip>}
              <Chip tone={o.status === 'proven' ? 'ok' : 'muted'}>{o.status || 'untested'}</Chip>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** The panel for the step he opened. Same five regions every time (ui.Panel). */
export function StepPanel({ day, step, reload }: { day: Day; step: PathKey; reload: () => void }) {
  const p = day.path!
  const undo = useUndo()
  const s = p.steps.find(x => x.key === step)!
  const chip = s.state === 'done' ? <Chip tone="ok">Done</Chip> : s.state === 'current' ? <Chip tone="amber">Now</Chip> : <Chip>To come</Chip>
  const thoughts = <ThoughtsLink day={day.day} step={step} />
  const claude = (prompt: string, label = 'Copy Claude prompt') => <PromptButton label={label} prompt={prompt} />

  if (step === 'research') return <ResearchStep day={day} reload={reload} chip={chip} thoughts={thoughts} claude={claude} />
  if (step === 'story') {
    return (
      <Panel title="Settle the story, then sign the narrative lock" chip={chip}
        why="A short back-and-forth in a Claude session with your research in hand: the deeper story, the arc, and the one thing a leader does. Its lock comes back here to sign."
        actions={<ActionBar primary={claude(p.prompts.story)} />} after={thoughts} />
    )
  }

  if (step === 'look') return <LookStep day={day} reload={reload} chip={chip} thoughts={thoughts} claude={claude} />
  if (step === 'board') {
    return (
      <Panel title="Storyboard and script, made together before you record"
        chip={p.storyboard ? chip : <Chip tone="amber">No storyboard yet</Chip>}
        why={p.storyboard ? 'One session writes both cuts with a frame for every line, in the look you picked. You approve them as one; the scripts then go to your Teleprompter and you record exactly what is drawn.'
          : 'Reminder: no storyboard is on file yet. Drop the session\'s storyboard here before you approve the scripts, or approve anyway.'}
        actions={<ActionBar primary={day.actions[0]?.kind === 'open' ? <DayActions day={day} reload={reload} only="first" /> : claude(p.prompts.storyboard)}
          secondary={day.actions.find(a => a.kind === 'run') ? <RunButton day={day} reload={reload} /> : undefined}
          prompt={day.actions[0]?.kind === 'open' ? claude(p.prompts.storyboard) : undefined} />}
        after={thoughts}>
        {p.storyboard
          ? <div className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5"><span className="min-w-0 flex-1 truncate font-semibold" title={p.storyboard.title}>{p.storyboard.title}</span><span className="shrink-0 font-mono text-xs text-muted">{when(p.storyboard.at)}</span></div>
          : <Dropzone day={day} onFiled={reload} role="storyboard" />}
      </Panel>
    )
  }

  return (
    <Panel title={s.label} chip={chip} why={step === p.current ? day.next : s.state === 'done' ? 'Done.' : 'This comes after the steps before it.'}
      actions={<ActionBar primary={step === p.current ? <DayActions day={day} reload={reload} only="first" /> : undefined}
        prompt={step === p.current ? <DayActions day={day} reload={reload} only="prompt" /> : undefined} />} after={thoughts} />
  )
}


type StepProps = { day: Day; reload: () => void; chip: React.ReactNode; thoughts: React.ReactNode; claude: (prompt: string, label?: string) => React.ReactNode }

function ResearchStep({ day, reload, chip, thoughts, claude }: StepProps) {
  const p = day.path!
  const undo = useUndo()

    const [busy, setBusy] = React.useState(false)
    // Busy from the press itself, so a second tap inside the Undo window never queues a second paid run.
    const run = () => {
      if (busy) return
      setBusy(true)
      undo(`Researching ${day.label} with sonar-pro`, async () => {
        try { const r = await api.research(day.piece_id!); toast.success(`Research filed: ${kb(r.material.bytes)}, ${r.sources} sources.`); reload() }
        catch (e) { toast.error(sayError(e)) }
        setBusy(false)
      }, 5000, () => setBusy(false))
    }
    return (
      <Panel title="Bring the evidence" chip={chip} why="The engine researches it now, or you run Perplexity Deep Research and drop the file here. Every later step reads what lands on the piece."
        actions={<ActionBar primary={<Button tone="primary" busy={busy} onClick={run}>Research it now</Button>}
          secondary={<PromptButton label="Copy Perplexity prompt" prompt={p.prompts.research} target="perplexity" />} prompt={claude(p.prompts.story, 'Copy Claude prompt')} />}
        after={thoughts}>
        <div className="flex flex-col gap-2">
          {p.materials.map(m => (
            <div key={m.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-semibold" title={m.title}>{m.title}</span>
              <span className="shrink-0 font-mono text-xs text-muted">{kb(m.bytes)}{m.at ? ` · ${when(m.at)}` : ''}</span>
            </div>
          ))}
          {p.research_file && <div className="rounded-xl border border-line bg-bg px-3 py-2.5 font-semibold">{day.day}-research.md <span className="font-mono text-xs font-normal text-muted">in the week's folder</span></div>}
          <Dropzone day={day} onFiled={reload} />
        </div>
      </Panel>
    )
  }

function LookStep({ day, reload, chip, thoughts, claude }: StepProps) {
  const p = day.path!
  const undo = useUndo()

    const rec = p.look.recommended
    const [pick, setPick] = React.useState(p.look.picked?.production || rec.production?.id || p.look.options[0]?.id || '')
    const [more, setMore] = React.useState(false)
    const [folded, setFolded] = React.useState<string[]>(p.look.picked?.inspiration || [])
    const [saved, setSaved] = React.useState(Boolean(p.look.picked))
    const shown = more ? p.look.options : p.look.options.filter(o => o.id === pick || o.id === rec.production?.id)
    const save = () => undo(`Look saved on ${day.label}`, async () => {
      try { await api.look(day.piece_id!, pick, rec.experiment?.id || null, folded); setSaved(true); reload() } catch (e) { toast.error(sayError(e)) }
    })
    return (
      <Panel title={rec.production ? `Recommended: ${rec.production.name}${rec.experiment ? `, with "${rec.experiment.name}"` : ''}` : 'Pick the look'} chip={chip}
        why={rec.why || 'Pick the look the piece is made in. The storyboard and script are written to it.'}
        actions={<ActionBar primary={<Button tone="primary" onClick={save} disabled={!pick}>{saved ? 'Look saved' : 'Use this look'}</Button>}
          secondary={<Button onClick={() => setMore(m => !m)}>{more ? 'Show fewer' : `See all ${p.look.options.length} looks`}</Button>}
          prompt={claude(p.prompts.mock, 'Copy mock prompt')} />}
        after={thoughts}>
        <LookCards options={shown} value={pick} onChange={v => { setPick(v); setSaved(false) }} recommended={rec.production?.id || null} />
        {(p.inspiration.cards.length > 0 || p.inspiration.unread > 0) && (
          <details className="group mt-4 rounded-2xl border border-line bg-bg">
            <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 font-semibold">
              <span>From your inspiration board</span>
              <span className="font-mono text-xs text-muted">{p.inspiration.cards.length} with your notes{p.inspiration.unread ? ` · ${p.inspiration.unread} without notes yet` : ''}</span>
            </summary>
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
              {p.inspiration.cards.map(c => {
                const on = folded.includes(c.name)
                return (
                  <div key={c.id} className="flex flex-col rounded-xl border border-line bg-card p-3">
                    <p className="text-[14px] leading-snug"><span className="font-mono text-[11px] text-muted">Your words: </span>“{c.words.length > 260 ? c.words.slice(0, 257) + '…' : c.words}”</p>
                    <p className="mt-2 truncate font-mono text-[11px] text-muted" title={c.name}>{c.name}</p>
                    <div className="mt-3"><Button onClick={() => setFolded(f => on ? f.filter(x => x !== c.name) : [...f, c.name])}>{on ? 'Folded in' : 'Fold it into this look'}</Button></div>
                  </div>
                )
              })}
            </div>
          </details>
        )}
        {saved && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-bg p-4 sm:flex-row sm:items-center [&>button]:w-full sm:[&>button]:w-auto">
            <p className="min-w-0 flex-1 text-[15px]"><b>Want a mock of it on your own footage first?</b> <span className="text-muted">A ve session renders it on your last take of this format.</span></p>
            <PromptButton label="Copy mock prompt" prompt={p.prompts.mock} />
          </div>
        )}
      </Panel>
    )
  }

/** A run press: sent after the Undo window, its result said where he pressed it. */
export function RunButton({ day, reload }: { day: Day; reload: () => void }) {
  const a = day.actions.find(x => x.kind === 'run')
  const undo = useUndo()
  const [busy, setBusy] = React.useState(false)
  if (!a || a.kind !== 'run') return null
  const go = () => {
    if (busy) return
    setBusy(true)
    undo(`Starting ${a.runs_on}`, async () => {
      try { const r = await api.run(a.job, a.input); toast.success(`Started on ${r.workflow}. Its progress shows on the day.`); setTimeout(reload, 4000) }
      catch (e) { toast.error(sayError(e)) }
      setBusy(false)
    }, 5000, () => setBusy(false))
  }
  return <Button tone={day.actions[0] === a ? 'primary' : 'secondary'} busy={busy} onClick={go}>{a.label}</Button>
}

/** A day's own actions, for days and steps without a richer panel: first is the primary, the Claude prompt sits at the right. */
export function DayActions({ day, reload, only, onReview }: { day: Day; reload: () => void; only?: 'first' | 'prompt'; onReview?: () => void }) {
  const first = day.actions.find(a => a.kind !== 'prompt') || day.actions[0]
  const claudePrompt = day.actions.find(a => a.kind === 'prompt' && /Claude/.test(a.label))
  const other = day.actions.find(a => a !== first && a !== claudePrompt)
  const render = (a: Day['actions'][number] | undefined, primary: boolean) => {
    if (!a) return undefined
    if (a.kind === 'prompt') return <PromptButton label={a.label} prompt={a.prompt} target={/Perplexity/.test(a.label) ? 'perplexity' : 'claude'} />
    if (a.kind === 'run') return <RunButton day={day} reload={reload} />
    if (a.kind === 'open') return <Button tone={primary ? 'primary' : 'secondary'} onClick={() => (/^https?:/.test(a.href) ? window.open(a.href, '_blank', 'noopener') : (location.href = a.href))}>{a.label}</Button>
    if (a.kind === 'review') return <Button tone={primary ? 'primary' : 'secondary'} onClick={onReview}>{a.label}</Button>
    return <Button tone={primary ? 'primary' : 'secondary'} onClick={onReview}>{a.label}</Button>
  }
  if (only === 'first') return render(first, true) ?? null
  if (only === 'prompt') return render(claudePrompt, false) ?? null
  return <ActionBar primary={render(first, true)} secondary={render(other, false)} prompt={first !== claudePrompt ? render(claudePrompt, false) : undefined} />
}
