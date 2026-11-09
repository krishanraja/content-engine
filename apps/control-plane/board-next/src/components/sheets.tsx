// Sheets for what he does not need to see until he asks: the full prompt before copying, and his long-form thoughts.
// Built on vaul (the drawer under 21st.dev's Drawer with snap points): a bottom sheet on a phone, a side sheet on a desk.
import * as React from 'react'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { Button, cx } from './ui'
import { api, sayError } from '../api'

function useWide() {
  const [wide, setWide] = React.useState(() => matchMedia('(min-width: 768px)').matches)
  React.useEffect(() => {
    const m = matchMedia('(min-width: 768px)'); const on = () => setWide(m.matches)
    m.addEventListener('change', on); return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

function Sheet({ open, onOpenChange, title, children, footer }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode; footer: React.ReactNode }) {
  const wide = useWide()
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={wide ? 'right' : 'bottom'}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content aria-describedby={undefined}
          className={cx('fixed z-50 flex flex-col bg-card text-ink outline-none',
            wide ? 'inset-y-3 right-3 w-[min(560px,calc(100vw-24px))] rounded-[22px]' : 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[22px]')}>
          {!wide && <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-line" />}
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <Drawer.Title className="min-w-0 truncate text-lg font-bold">{title}</Drawer.Title>
            <Button tone="ghost" onClick={() => onOpenChange(false)} aria-label="Close">Close</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          <div className="border-t border-line px-5 py-4">{footer}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/** Copy prompt: shows the whole prompt first, then copies it, with "Open Claude" beside it (21st.dev Copy Button pattern). */
export function PromptButton({ label, prompt, target = 'claude' }: { label: string; prompt: string; target?: 'claude' | 'perplexity' }) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success('Prompt copied') }
    catch { toast.error('Copy is blocked here. Select the text and copy it.') }
  }
  const href = target === 'perplexity' ? 'https://www.perplexity.ai/' : 'https://claude.ai/code'
  return (
    <>
      <Button tone="secondary" onClick={() => setOpen(true)} icon={<span aria-hidden className="font-mono text-xs">⧉</span>}>{label}</Button>
      <Sheet open={open} onOpenChange={setOpen} title={label}
        footer={<div className="flex flex-col gap-2 sm:flex-row [&>*]:w-full sm:[&>*]:w-auto">
          <Button tone="primary" onClick={copy}>{copied ? 'Copied' : 'Copy prompt'}</Button>
          <Button tone="secondary" onClick={() => { void copy(); window.open(href, '_blank', 'noopener') }}>{target === 'perplexity' ? 'Copy and open Perplexity' : 'Copy and open Claude'}</Button>
        </div>}>
        <p className="mb-3 text-sm text-muted">{target === 'perplexity' ? 'Paste it into Perplexity Deep Research, then drop the Markdown it gives you on the day.' : 'Paste it into a new Claude Code session. It assumes the session knows nothing.'}</p>
        <pre className="whitespace-pre-wrap rounded-2xl border border-line bg-bg p-4 font-mono text-[13px] leading-relaxed">{prompt}</pre>
      </Sheet>
    </>
  )
}

/** "Add your thoughts": his long-form words on one step, kept on this device until the board confirms the save. */
export function ThoughtsLink({ day, step, label = 'Add your thoughts' }: { day: string; step: string; label?: string }) {
  const key = `desk-thoughts:${location.pathname}:${day}:${step}`
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState(() => { try { return localStorage.getItem(key) || '' } catch { return '' } })
  const [busy, setBusy] = React.useState(false)
  const keep = (v: string) => { setText(v); try { if (v) localStorage.setItem(key, v); else localStorage.removeItem(key) } catch { /* private window */ } }
  const save = async () => {
    if (!text.trim()) { toast('Write your thoughts first.'); return }
    setBusy(true)
    try { await api.feedback(day, step, text.trim()); keep(''); setOpen(false); toast.success('Saved on the board, pinned to this step.') }
    catch (e) { toast.error(sayError(e)) }
    setBusy(false)
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 font-mono text-[13px] font-semibold text-muted hover:text-ink">
        <span aria-hidden>+</span>{text ? 'Your unsent thoughts' : label}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={label}
        footer={<div className="flex flex-col gap-2 sm:flex-row [&>*]:w-full sm:[&>*]:w-auto"><Button tone="primary" busy={busy} onClick={save}>Save my thoughts</Button></div>}>
        <label className="mb-2 block text-sm text-muted" htmlFor={key}>Say as much as you like. It is kept on this device until it saves.</label>
        <textarea id={key} value={text} onChange={e => keep(e.target.value)} rows={10}
          className="min-h-[40dvh] w-full resize-y rounded-2xl border border-line bg-bg p-4 text-[16px] leading-relaxed outline-none focus:border-ink" />
      </Sheet>
    </>
  )
}
