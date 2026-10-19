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
      await page.goto(origin+'/board/2026-10-19')
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
  const { chromium }=await import(pathToFileURL(modulePath).href)
  const browser=await chromium.launch({headless:true})
  let interactions=0
  const saved=async(collection,accept)=>{
    const deadline=Date.now()+30000
    while(Date.now()<deadline){if(accept((await api(collection)).documents))return;await new Promise(resolve=>setTimeout(resolve,150))}
    assert.fail(`Timed out waiting for durable ${collection} state`)
  }
  try {
    for(const width of [390,1440]) {
      const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']})
      await context.addCookies([{name:'cc_access',value:cookie.split('=')[1],url:origin}])
      const page=await context.newPage(); const errors=[]
      page.on('pageerror',e=>errors.push(e.message))
      await page.goto(origin+'/board/2026-10-19')
      await page.locator('input[data-tick="mon-substack"]').first().waitFor()
      await page.waitForFunction(()=>!document.querySelector('input[data-tick="mon-substack"]').disabled)
      for(const tab of ['ideas','monday','wednesday','friday']) {
        await page.locator('#tab-'+tab).click()
        assert.equal(await page.locator('#panel-'+tab).isVisible(),true)
        if(screenshotDir)await page.screenshot({path:`${screenshotDir}/${tab}-${width}.png`})
      }
      await page.locator('#tab-monday').click()
      const pictures=await page.locator('#panel-monday img').evaluateAll(imgs=>imgs.map(i=>({loaded:i.complete&&i.naturalWidth>0,src:!!i.src})))
      assert.ok(pictures.length>0&&pictures.every(p=>p.loaded&&p.src))
      const tick=page.locator('input[data-tick="mon-substack"]').first()
      if (!await tick.isChecked()) await tick.locator('..').click()
      await saved('ticks',docs=>docs.find(d=>d.id==='mon-substack')?.body.done===true)
      assert.equal((await api('ticks')).documents.find(d=>d.id==='mon-substack').body.done,true)
      await page.reload(); await page.waitForFunction(()=>document.querySelector('input[data-tick="mon-substack"]').checked)
      await page.locator('#tab-monday').click()
      const copy=page.locator('button[data-act="text"]').first()
      const copyTarget=await copy.getAttribute('data-ref')
      const expectedText=await page.locator('#'+copyTarget).textContent()
      await copy.click()
      assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expectedText)
      await page.locator('button[data-act="image"]').first().click()
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
      const article=page.locator('#mon-link-article')
      await article.fill('https://example.com/browser-story'); await article.blur()
      await saved('links',docs=>docs.find(d=>d.id==='mon')?.body.article==='https://example.com/browser-story')
      assert.equal((await api('links')).documents.find(d=>d.id==='mon').body.article,'https://example.com/browser-story')
      await page.locator('#tab-friday').click()
      const edit=page.locator('textarea[data-review-id="fri-article"]')
      await edit.fill(`Browser words ${width}`);await page.locator('[data-act="save-review"]').first().click()
      await saved('edits',docs=>docs.find(d=>d.id==='fri-article')?.body.text===`Browser words ${width}`)
      assert.equal((await api('edits')).documents.find(d=>d.id==='fri-article').body.text,`Browser words ${width}`)
      // Polling must never upgrade the version on an in-progress edit.
      const before=(await api('edits')).documents.find(d=>d.id==='fri-article')
      await edit.fill(`Unsaved words ${width}`)
      page.once('dialog',d=>d.dismiss())
      await page.getByRole('navigation',{name:'Publishing weeks'}).getByRole('link',{name:'Week of 12 Oct'}).click()
      assert.equal(new URL(page.url()).pathname,'/board/2026-10-19','cancelled week change retains unsaved work')
      assert.equal(await edit.inputValue(),`Unsaved words ${width}`)
      await write('edits','fri-article',{...before.body,text:`Other session ${width}`},before.revision)
      const tickBefore=(await api('ticks')).documents.find(d=>d.id==='mon-substack')
      await write('ticks','mon-substack',{...tickBefore.body,done:false},tickBefore.revision)
      await page.waitForTimeout(5500)
      assert.equal(await edit.inputValue(),`Unsaved words ${width}`)
      assert.equal(await tick.isChecked(),false,'remote API change refreshes the visible tick')
      page.once('dialog',d=>d.dismiss())
      await page.locator('[data-act="save-review"]').first().click(); await page.waitForTimeout(300)
      assert.equal((await api('edits')).documents.find(d=>d.id==='fri-article').body.text,`Other session ${width}`)
      assert.equal(await edit.inputValue(),`Unsaved words ${width}`)
      page.once('dialog',d=>d.accept())
      await page.locator('[data-act="save-review"]').first().click(); await page.waitForTimeout(300)
      await saved('edits',docs=>docs.find(d=>d.id==='fri-article')?.body.text===`Unsaved words ${width}`)
      assert.equal((await api('edits')).documents.find(d=>d.id==='fri-article').body.text,`Unsaved words ${width}`)
      await page.route('**/edits/fri-article',route=>route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'}))
      await edit.fill(`Retry words ${width}`);await page.locator('[data-act="save-review"]').first().click();await page.waitForTimeout(300)
      assert.ok((await page.locator('#panel-friday').innerText()).includes('Not saved'))
      assert.equal(await edit.inputValue(),`Retry words ${width}`)
      await page.unroute('**/edits/fri-article')
      await page.locator('[data-act="save-review"]').first().click();await page.waitForTimeout(300)
      await saved('edits',docs=>docs.find(d=>d.id==='fri-article')?.body.text===`Retry words ${width}`)
      assert.equal((await api('edits')).documents.find(d=>d.id==='fri-article').body.text,`Retry words ${width}`)
      await page.getByRole('button',{name:'Comments',exact:true}).click()
      await page.getByRole('textbox',{name:'Your comment'}).fill(`Comment ${width}`)
      await page.getByRole('button',{name:'Save comment',exact:true}).click();await page.waitForTimeout(400)
      await saved('comments',docs=>docs.some(d=>d.body.text===`Comment ${width}`))
      assert.ok((await api('comments')).documents.some(d=>d.body.text===`Comment ${width}`))
      await page.getByRole('button',{name:'Reply',exact:true}).last().click()
      await page.getByRole('textbox',{name:'Your comment'}).fill(`Reply ${width}`)
      await page.getByRole('button',{name:'Save comment',exact:true}).click();await page.waitForTimeout(400)
      await saved('comments',docs=>docs.some(d=>d.body.text===`Reply ${width}`))
      assert.ok((await api('comments')).documents.some(d=>d.body.text===`Reply ${width}`))
      await page.getByRole('button',{name:'Close',exact:true}).click()
      await page.locator('#tab-ideas').click()
      await page.locator('input[data-pick="mon"]').first().locator('..').click();await page.waitForTimeout(400)
      assert.ok((await api('picks')).documents.some(d=>d.id==='mon'))
      const queue=page.locator('[data-queue-mark]').first()
      assert.ok(await queue.count()); await queue.locator('..').click();await page.waitForTimeout(400);assert.ok((await api('queue')).documents.length>0)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow')
      if(screenshotDir)await page.screenshot({path:`${screenshotDir}/board-${width}.png`,fullPage:true})
      assert.deepEqual(errors,[])
      interactions+=17
      await context.close()
    }
    console.log(`PASS: ${interactions} browser tasks at phone and desktop widths; tabs, images, tick persistence, downloads, links, edits, comments/replies and picks`)
  } finally {await browser.close()}
}
