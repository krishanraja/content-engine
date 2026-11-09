// The board's small parts. Every control keeps its text inside it (nowrap, ellipsis, the full text as its title) and is
// at least 44px tall, so nothing wraps, spills or shrinks under a thumb.
import * as React from 'react'

export const cx = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ')

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'ghost'; busy?: boolean; icon?: React.ReactNode }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ tone = 'secondary', busy, icon, className, children, title, ...rest }, ref) {
  const label = typeof children === 'string' ? children : undefined
  return (
    <button ref={ref} type="button" title={title ?? label} aria-busy={busy || undefined} {...rest}
      className={cx(
        'inline-flex h-11 min-w-0 max-w-full shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold sm:px-5',
        'whitespace-nowrap transition-[background,box-shadow,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55',
        tone === 'primary' && 'bg-ink text-bg hover:shadow-[0_6px_18px_-8px_rgba(12,21,18,.6)]',
        tone === 'secondary' && 'border border-line bg-card text-ink hover:bg-soft',
        tone === 'ghost' && 'text-muted hover:bg-soft hover:text-ink',
        busy && 'cursor-progress',
        className)}>
      {icon}{busy ? <Spinner /> : null}<span className="truncate">{children}</span>
    </button>
  )
})

export function Spinner() {
  return <span aria-hidden className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
}

/** The status dot (21st.dev Status Dot, edwinvakayil, restyled): a dot, with a ripple while something is live or running. */
export function StatusDot({ tone, pulse, label }: { tone: 'ok' | 'amber' | 'bad' | 'muted'; pulse?: boolean; label: string }) {
  const color = { ok: 'var(--ok)', amber: 'var(--amber)', bad: 'var(--bad)', muted: 'var(--muted)' }[tone]
  return (
    <span role="status" aria-label={label} className="relative inline-flex size-5 shrink-0 items-center justify-center" style={{ ['--dot' as string]: color }}>
      {pulse && <span aria-hidden className="ripple absolute size-2 rounded-full" />}
      <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
    </span>
  )
}

export function Chip({ tone = 'muted', children }: { tone?: 'ok' | 'amber' | 'bad' | 'muted' | 'ink'; children: React.ReactNode }) {
  return (
    <span className={cx('inline-flex h-6 max-w-full shrink-0 items-center truncate rounded-full px-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide',
      tone === 'ok' && 'bg-[color-mix(in_srgb,var(--ok)_16%,transparent)] text-ok',
      tone === 'amber' && 'bg-[color-mix(in_srgb,var(--amber)_16%,transparent)] text-amber',
      tone === 'bad' && 'bg-[color-mix(in_srgb,var(--bad)_14%,transparent)] text-bad',
      tone === 'muted' && 'bg-soft text-muted',
      tone === 'ink' && 'bg-ink text-bg')}>{children}</span>
  )
}

/** Count Up (21st.dev, unlumen, restyled): the number rolls up to its value once. */
export function CountUp({ to }: { to: number }) {
  const [n, setN] = React.useState(0)
  React.useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return }
    let k = 0; const id = setInterval(() => { k += 1; setN(Math.min(to, k)); if (k >= to) clearInterval(id) }, 90)
    return () => clearInterval(id)
  }, [to])
  return <span className="tabular-nums">{n}</span>
}

/**
 * The one layout every step and card shares, so nothing moves (PLAN.md, "One layout grammar"): title with its chip at
 * the right, one line of why, the thing itself, the action bar (primary, secondary, then the prompt pinned at the far
 * right), and "Add your thoughts" at the bottom left.
 */
export function Panel({ title, chip, why, children, actions, after }: {
  title: React.ReactNode; chip?: React.ReactNode; why?: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; after?: React.ReactNode
}) {
  return (
    <section className="rounded-[20px] border border-line bg-card p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3 className="min-w-0 text-[17px] font-bold leading-snug sm:text-lg">{title}</h3>
        {chip ? <div className="shrink-0">{chip}</div> : null}
      </div>
      {why ? <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-muted">{why}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
      {actions ? <div className="mt-4">{actions}</div> : null}
      {after ? <div className="mt-2">{after}</div> : null}
    </section>
  )
}

/** The action bar: same places everywhere. On a phone the buttons stack full width in the same order. */
export function ActionBar({ primary, secondary, prompt }: { primary?: React.ReactNode; secondary?: React.ReactNode; prompt?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
      {primary}
      {secondary}
      {prompt ? <div className="flex sm:ml-auto [&>*]:w-full sm:[&>*]:w-auto">{prompt}</div> : null}
    </div>
  )
}
