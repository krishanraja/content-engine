// A revised off-day option, judged where it shows (21st.dev Approval Card, syeddhasnainn, restyled). The press writes
// the same queue/off-<day>-<id> record the full board writes, bound to the same hashes (api/board/_offdaySides.ts).
import * as React from 'react'
import { toast } from 'sonner'
import { api, sayError, week, type Review } from '../api'
import { Button, Chip, cx } from './ui'
import { useUndo } from '../undo'

export function ReviewCard({ review, day, label, reload }: { review: Review; day: string; label: string; reload: () => void }) {
  const o = review.option, side = review.side, d = o.direction || {}
  const key = `desk-draft:${week}:${review.doc_id}`
  const [words, setWords] = React.useState(() => { try { return localStorage.getItem(key) || '' } catch { return '' } })
  const [asking, setAsking] = React.useState<null | 'improve' | 'reject'>(null)
  const [status, setStatus] = React.useState<null | string>(null)
  const undo = useUndo()
  const keep = (v: string) => { setWords(v); try { if (v) localStorage.setItem(key, v); else localStorage.removeItem(key) } catch { /* private window */ } }
  const press = (verdict: 'approve' | 'improve' | 'reject') => {
    if (verdict !== 'approve' && !words.trim()) { setAsking(verdict); return }
    undo(`${verdict === 'approve' ? 'Approving' : verdict === 'improve' ? 'Sending your Improve on' : 'Rejecting'} ${o.id}`, async () => {
      const at = new Date().toISOString(), prev = (review.prev || {}) as Record<string, unknown>
      const shaOf = (s: string) => (s === 'idea' ? o.idea_sha256 : o.direction_sha256)
      const body: Record<string, unknown> = { pick: review.doc_id, use: 'offday', day, week, option_id: o.id, format: o.format, source: o.source, copy_sha256: o.copy_sha256, at }
      for (const s of ['idea', 'direction']) if (s === 'idea' || o.direction_sha256) body[s] = prev[s] || { verdict: null, words: null, sha256: shaOf(s), at }
      if (prev.note) body.note = prev.note
      if (prev.mock) body.mock = prev.mock
      body[side] = { verdict, words: words.trim() || null, sha256: shaOf(side), at, ...(verdict === 'approve' ? { shown: side === 'idea' ? o.shown_idea : o.direction } : {}) }
      try {
        await api.put('queue', review.doc_id, body, review.revision ?? 0)
        keep(''); setStatus(verdict === 'approve' ? 'Approved' : verdict === 'improve' ? 'Improve sent' : 'Rejected')
        toast.success(verdict === 'approve' ? 'Approved. Growth makes it.' : verdict === 'improve' ? 'Saved. The revise run brings the new version back here.' : 'Rejected, with your reason.')
        setTimeout(reload, 1500)
      } catch (e) { toast.error(sayError(e)) }
    })
  }
  return (
    <section className="rounded-[20px] border border-line bg-card p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3 className="min-w-0 text-[17px] font-bold leading-snug">{label}: the revised {side === 'direction' ? 'direction' : 'idea'}</h3>
        <div className="shrink-0">{status ? <Chip tone="ok">{status}</Chip> : <Chip tone="amber">Needs you</Chip>}</div>
      </div>
      {o.revised && <p className="mt-1 text-[15px] text-muted">Revised from your words: “{o.revised.words}”</p>}
      <div className="mt-4 rounded-2xl border border-line bg-bg p-4">
        {side === 'direction' ? (
          <>
            <p className="font-semibold">{d.look}</p>
            {d.format && <p className="mt-1 font-mono text-xs text-muted">{d.format}</p>}
            {d.frames?.length ? <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px]">{d.frames.map((f, n) => <li key={n}>{f.words} <span className="text-muted">({f.picture})</span></li>)}</ol> : null}
          </>
        ) : (
          <>
            <p className="font-semibold">{o.hook || o.copy}</p>
            <p className="mt-1 text-[15px] text-muted">{o.pitch?.see || o.copy}</p>
          </>
        )}
      </div>
      {asking && (
        <div className="mt-3">
          <label className="mb-1 block text-sm font-semibold" htmlFor={key}>{asking === 'improve' ? 'What should change?' : 'Why not?'}</label>
          <textarea id={key} value={words} onChange={e => keep(e.target.value)} rows={3} autoFocus
            className="w-full rounded-2xl border border-line bg-bg p-3 text-[16px] outline-none focus:border-ink" />
        </div>
      )}
      <div className={cx('mt-4 flex flex-col gap-2 sm:flex-row [&>*]:w-full sm:[&>*]:w-auto', status && 'opacity-60')}>
        <Button tone="primary" disabled={Boolean(status)} onClick={() => press('approve')}>Approve</Button>
        <Button disabled={Boolean(status)} onClick={() => press('improve')}>{asking === 'improve' ? 'Send my Improve' : 'Improve'}</Button>
        <Button tone="ghost" disabled={Boolean(status)} onClick={() => press('reject')}>{asking === 'reject' ? 'Send my reason' : 'Reject'}</Button>
      </div>
    </section>
  )
}
