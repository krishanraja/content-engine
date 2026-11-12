// Browser acceptance against the local HTTP/SQL runtime, never production.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
export async function checkVisual({modulePath, origin, cookie, screenshotDir, sourceData, api}) {
  const {chromium}=await import(pathToFileURL(modulePath).href)
  const browser=await chromium.launch({headless:true})
  let imageCount=0,tabCount=0
  try {
    for(const width of [390,1440]) {
      const context=await browser.newContext({viewport:{width,height:900}})
      await context.addCookies([{name:'cc_access',value:cookie.split('=')[1],url:origin}])
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
      await page.goto(origin+'/board/2026-10-19?archive=1')
      const weeks=page.getByRole('navigation',{name:'Publishing weeks'})
      await weeks.getByRole('link',{name:'Week of 12 Oct'}).waitFor()
      assert.equal(await weeks.getByRole('link',{name:'Week of 19 Oct'}).getAttribute('aria-current'),'page')
      await page.waitForFunction(()=>[...document.querySelectorAll('input[data-tick]')].every(i=>!i.disabled))
      if(sourceData) {
        const picks=(await api('picks')).documents
        await page.waitForFunction(count=>document.querySelectorAll('input[data-pick]:checked').length===count,picks.length)
        const comments=(await api('comments')).documents
        await page.getByRole('button',{name:'Comments',exact:true}).click()
        await page.getByText(comments[0].body.text,{exact:true}).waitFor()
        assert.equal(await page.getByRole('button',{name:'Reply',exact:true}).count(),comments.filter(d=>d.id===d.body.thread_id).length)
        if(screenshotDir)await page.screenshot({path:`${screenshotDir}/source-comments-${width}.png`})
        await page.getByRole('button',{name:'Close',exact:true}).click()
      }
      const ids=await page.locator('[role="tab"]').evaluateAll(tabs=>tabs.map(t=>t.id))
      assert.ok(ids.length>=3)
      for(const id of ids) {
        await page.locator('#'+id).click()
        const panel=page.locator('#'+id.replace('tab-','panel-'))
        assert.ok(await panel.isVisible())
        await page.waitForFunction(()=>[...document.querySelectorAll('[role="tabpanel"]:not([hidden]) img')].every(i=>i.complete))
        const images=await panel.locator('img').evaluateAll(imgs=>imgs.map(i=>i.naturalWidth))
        assert.ok(images.every(n=>n>0),'every supplied image loads')
        imageCount+=images.length;tabCount++
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
        if(screenshotDir)await page.screenshot({path:`${screenshotDir}/source-${id}-${width}.png`})
      }
      assert.deepEqual(errors,[]);await context.close()
    }
    console.log(`PASS: supplied source HTML streamed through real handler; ${tabCount} tab views and ${imageCount} loaded images at 390px/1440px, no overflow or runtime exceptions`)
  } finally {await browser.close()}
}
export async function checkBrowser({modulePath, origin, cookie, api, write, screenshotDir}) {
  // The old board is a read-only archive (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old board is
  // a read-only archive). It still reads, copies and downloads, and shows another session's writes, but none of its
  // presses leaves the page: each says where to make it on the live board, and the board's state stays as it was.
  const { chromium }=await import(pathToFileURL(modulePath).href)
  const browser=await chromium.launch({headless:true})
  let interactions=0
  const saved=async(collection,accept)=>{
    const deadline=Date.now()+30000
    while(Date.now()<deadline){if(accept((await api(collection)).documents))return;await new Promise(resolve=>setTimeout(resolve,150))}
    assert.fail(`Timed out waiting for durable ${collection} state`)
  }
  const LIVE='https://controlcenter.krishraja.com/#/content?week=2026-10-19'
  try {
    for(const width of [390,1440]) {
      const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']})
      await context.addCookies([{name:'cc_access',value:cookie.split('=')[1],url:origin}])
      const page=await context.newPage(); const errors=[], writes=[]
      page.on('pageerror',e=>errors.push(e.message))
      page.on('request',r=>{if(r.method()!=='GET'&&r.method()!=='HEAD'&&new URL(r.url()).pathname.startsWith('/api/board'))writes.push(`${r.method()} ${r.url()}`)})
      // A press on the archive: the page says where to make it (the live board at this week), nothing is sent, and the
      // collection it would have written reads exactly as before.
      const refused=async(collection,press)=>{
        const before=JSON.stringify((await api(collection)).documents)
        await page.evaluate(()=>document.getElementById('archive-note')?.remove())
        await press()
        const note=page.locator('#archive-note')
        await note.waitFor()
        assert.match(await note.innerText(),/This is the archive\. Do this on the live board/)
        assert.ok((await note.locator('a').getAttribute('href')).startsWith(LIVE),'the note links to the live board at this week')
        await page.waitForTimeout(300)
        assert.deepEqual(writes,[],'no press leaves the archive page')
        assert.equal(JSON.stringify((await api(collection)).documents),before,`${collection} unchanged by a press on the archive`)
        await page.evaluate(()=>document.getElementById('archive-note')?.remove())
        interactions++
      }
      await page.goto(origin+'/board/2026-10-19?archive=1')
      const banner=page.locator('[data-archive-banner]')
      assert.match(await banner.innerText(),/This is the archive\. The live Publish Board is in Control Centre\. This page is read-only\./)
      assert.equal(await banner.locator('[data-archive-live]').getAttribute('href'),LIVE)
      await page.locator('input[data-tick="mon-substack"]').first().waitFor()
      await page.waitForFunction(()=>!document.querySelector('input[data-tick="mon-substack"]').disabled)
      for(const tab of ['ideas','monday','wednesday','friday']) {
        await page.locator('#tab-'+tab).click()
        assert.equal(await page.locator('#panel-'+tab).isVisible(),true)
        if(screenshotDir)await page.screenshot({path:`${screenshotDir}/${tab}-${width}.png`})
        interactions++
      }
      await page.locator('#tab-monday').click()
      const pictures=await page.locator('#panel-monday img').evaluateAll(imgs=>imgs.map(i=>({loaded:i.complete&&i.naturalWidth>0,src:!!i.src})))
      assert.ok(pictures.length>0&&pictures.every(p=>p.loaded&&p.src))
      // Another session's write shows on the archive by its own poll: the board still reads live. The tick is for the
      // piece the board holds on Monday (its CONF), since a tick saved for another piece is not this piece's.
      const tick=page.locator('input[data-tick="mon-substack"]').first()
      const conf=JSON.parse((await page.locator('script').allTextContents()).map(t=>/const CONF = (\{.*?\});\n/s.exec(t)?.[1]).find(Boolean))
      const tickBefore=(await api('ticks')).documents.find(d=>d.id==='mon-substack')
      const piece_id=conf.days.find(d=>d.key==='mon').piece_id
      await write('ticks','mon-substack',{...tickBefore.body,piece_id,done:!tickBefore.body.done},tickBefore.revision)
      await saved('ticks',docs=>docs.find(d=>d.id==='mon-substack')?.body.done===!tickBefore.body.done)
      for(let i=0;i<40&&await tick.isChecked()!==!tickBefore.body.done;i++) await page.waitForTimeout(250)
      assert.equal(await tick.isChecked(),!tickBefore.body.done,'another session\'s change refreshes the visible tick')
      await page.reload(); await page.locator('input[data-tick="mon-substack"]').first().waitFor()
      await page.waitForFunction(done=>document.querySelector('input[data-tick="mon-substack"]').checked===done,!tickBefore.body.done)
      await page.locator('#tab-monday').click()
      // Copying and downloading are reads, and stay.
      const copy=page.locator('button[data-act="text"]').first()
      const copyTarget=await copy.getAttribute('data-ref')
      const expectedText=await page.locator('#'+copyTarget).textContent()
      await copy.click()
      await page.waitForFunction(async expected=>(await navigator.clipboard.readText())===expected,expectedText)
      assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expectedText)
      await page.locator('button[data-act="image"]').first().click()
      await page.waitForFunction(async()=>(await navigator.clipboard.read()).some(item=>item.types.includes('image/png')))
      assert.ok((await page.evaluate(async()=>(await navigator.clipboard.read()).flatMap(item=>item.types))).includes('image/png'))
      const downloadEvent=page.waitForEvent('download')
      const downloadButton=page.locator('button[data-act="download"]').first()
      const imageId=await downloadButton.getAttribute('data-ref')
      const sourceBytes=Buffer.from((await page.locator('#'+imageId).getAttribute('src')).split(',')[1],'base64')
      await downloadButton.click()
      const download=await downloadEvent; assert.match(download.suggestedFilename(),/\.png$/)
      assert.equal(await download.failure(),null)
      const savedBytes=await readFile(await download.path())
      assert.equal(savedBytes.length,sourceBytes.length)
      assert.equal(createHash('sha256').update(savedBytes).digest('hex'),createHash('sha256').update(sourceBytes).digest('hex'))
      interactions+=3
      // Every press the old board had is refused on it: a tick, a link, a saved edit, a comment, a pick and a queue mark.
      await refused('ticks',()=>tick.locator('..').click())
      const article=page.locator('#mon-link-article')
      await refused('links',async()=>{await article.fill(`https://example.com/archive-${width}`);await article.blur()})
      await page.locator('#tab-friday').click()
      const edit=page.locator('textarea[data-review-id="fri-article"]')
      await refused('edits',async()=>{await edit.fill(`Archive words ${width}`);await page.locator('[data-act="save-review"]').first().click()})
      await page.getByRole('button',{name:'Comments',exact:true}).click()
      await page.getByRole('textbox',{name:'Your comment'}).fill(`Comment ${width}`)
      await refused('comments',()=>page.getByRole('button',{name:'Save comment',exact:true}).click())
      await page.getByRole('button',{name:'Close',exact:true}).click()
      await page.locator('#tab-ideas').click()
      // A pick he already holds does not change on a tap, so the press is on another idea of the day.
      await refused('picks',()=>page.locator('input[data-pick="mon"]:not(:checked)').first().locator('..').click())
      const queue=page.locator('[data-queue-mark]').first()
      assert.ok(await queue.count())
      await refused('queue',()=>queue.locator('..').click())
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow')
      if(screenshotDir)await page.screenshot({path:`${screenshotDir}/board-${width}.png`,fullPage:true})
      assert.deepEqual(errors,[])
      await context.close()
    }
    console.log(`PASS: ${interactions} browser tasks on the read-only archive at phone and desktop widths; banner, tabs, images, another session's tick, copy and download read; ticks, links, edits, comments, picks and queue marks refused with nothing sent`)
  } finally {await browser.close()}
}
