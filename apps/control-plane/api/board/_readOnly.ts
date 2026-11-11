import { ARCHIVE_LINE, liveBoardUrl } from './_liveBoard.js'

// The engine's own board pages are a read-only archive (Ruling, Krish, 2026-11-11: one live board, in Control Centre;
// the old board is a read-only archive). Both pages it serves, the desk (/board/<Monday>) and the older baked board
// (/board/<Monday>?archive=1), are served with a same-origin referrer, so a write they make names the page it came
// from, and the board refuses it (423 archive_read_only) while the live board's writes, from Control Centre, pass. The
// baked board also carries the banner and a guard that turns any press into "Do this on the live board".

/** The referrer policy the archive pages are served with: their own requests name the page, nothing leaves the site. */
export const ARCHIVE_REFERRER_POLICY = 'same-origin'

/** Whether a write came from one of the engine's own board pages (the archive), by the page its referrer names. */
export function fromArchivePage(referer: string | string[] | undefined): boolean {
  const raw = Array.isArray(referer) ? referer[0] : referer
  if (!raw) return false
  try { return /^\/board\//.test(new URL(raw).pathname) } catch { return false }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The baked board with the archive banner and the read-only guard, put just inside its body. Nothing else changes. */
export function readOnlyArchive(html: string, week: string): string {
  const live = liveBoardUrl(week)
  const banner = `<div role="note" data-archive-banner style="position:sticky;top:0;z-index:2147483646;background:#FDE68A;color:#0C1512;`
    + `font:600 15px/1.4 system-ui,-apple-system,sans-serif;padding:10px 16px;border-bottom:1px solid #0C1512">${esc(ARCHIVE_LINE)}. `
    + `This page is read-only. <a href="${esc(live)}" data-archive-live style="color:inherit;text-decoration:underline">Open the live board</a></div>`
  // Any write the page tries (a press) is not sent: it says where to do it instead, at the day it was pressed on.
  const guard = `<script data-archive-guard>(function(){var LIVE=${JSON.stringify(live)};var f=window.fetch;`
    + `function day(){var a=document.activeElement,d=a&&a.closest&&a.closest('[data-live-day],[data-day]');return d?(d.getAttribute('data-live-day')||d.getAttribute('data-day')||''):''}`
    + `function say(){var url=LIVE+(day()?(LIVE.indexOf('?')<0?'?':'&')+'day='+encodeURIComponent(day().slice(0,3)):'');var n=document.getElementById('archive-note');`
    + `if(!n){n=document.createElement('div');n.id='archive-note';n.setAttribute('role','status');n.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;`
    + `background:#0C1512;color:#F4EFE4;font:600 15px/1.4 system-ui,sans-serif;padding:12px 16px;border-radius:14px;text-align:center';document.body.appendChild(n)}`
    + `n.innerHTML='This is the archive. <a style="color:#7EF0C0;text-decoration:underline" href="'+url.replace(/"/g,'&quot;')+'">Do this on the live board</a>'}`
    + `window.fetch=function(u,o){var m=((o&&o.method)||'GET').toUpperCase();if(m!=='GET'&&m!=='HEAD'&&String(u).indexOf('/api/board')>=0){say();`
    + `return Promise.resolve(new Response(JSON.stringify({ok:false,error:'archive_read_only'}),{status:423,headers:{'Content-Type':'application/json'}}))}return f.apply(this,arguments)}})()</script>`
  const m = /<body\b[^>]*>/i.exec(html)
  if (!m) return banner + guard + html
  const at = m.index + m[0].length
  return html.slice(0, at) + banner + guard + html.slice(at)
}
