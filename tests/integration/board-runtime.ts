// Local HTTP + actual SQL integration. Storage is a private in-memory fixture.
// node --import tsx tests/integration/board-runtime.ts /path/to/pglite/dist/index.js
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { canonical, digest } from '../../apps/control-plane/api/board/_contracts.js'

const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const pg = new PGlite()
await pg.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;')
await pg.exec(await readFile(new URL('../../supabase/migrations/20261019120743_publish_board_web.sql', import.meta.url), 'utf8'))
await pg.exec('set role service_role')
type Row = Record<string, unknown>
class Query {
  filters: [string, unknown][] = []; sorting = ''; offset = 0; count = 10000; single = false; payload: Row[] | null = null; jsonFilter: [string,unknown] | null = null
  constructor(readonly table: string) { assert.match(table,/^board_[a-z]+$/) }
  select(_fields: string) { return this }
  eq(key: string, value: unknown) { this.filters.push([key,value]); return this }
  contains(key: string,value: unknown) { this.jsonFilter=[key,value]; return this }
  order(key: string, options?: {ascending?:boolean}) { assert.match(key,/^[a-z_][a-z0-9_]*$/); this.sorting=` order by ${key} ${options?.ascending===false?'desc':'asc'}`; return this }
  range(start: number,end: number) { this.offset=start; this.count=end-start+1; return this }
  limit(n: number) { this.count=n; return this }
  maybeSingle() { this.single=true; return this }
  upsert(values: Row | Row[]) { this.payload=Array.isArray(values)?values:[values]; return this }
  async run() {
    try {
      if (this.payload) {
        for (const row of this.payload) {
          const keys=Object.keys(row); keys.forEach(k=>assert.match(k,/^[a-z_][a-z0-9_]*$/))
          await pg.query(`insert into ${this.table} (${keys.join(',')}) values (${keys.map((_,i)=>`$${i+1}`).join(',')}) on conflict do nothing`,Object.values(row))
        }
        return {data:null,error:null}
      }
      const params=this.filters.map(([,v])=>v)
      const where=this.filters.map(([k],i)=>{ assert.match(k,/^[a-z_][a-z0-9_]*$/); return `${k}=$${i+1}` })
      if(this.jsonFilter){params.push(JSON.stringify(this.jsonFilter[1]));where.push(`${this.jsonFilter[0]} @> $${params.length}::jsonb`)}
      const result=await pg.query(`select * from ${this.table}${where.length?' where '+where.join(' and '):''}${this.sorting} limit ${this.count} offset ${this.offset}`,params)
      return {data:this.single?result.rows[0]||null:result.rows,error:null}
    } catch(error) {return {data:null,error}}
  }
  then(resolve: (v: unknown)=>unknown,reject: (e: unknown)=>unknown) {return this.run().then(resolve,reject)}
}
let origin=''
const objects=new Map<string,{data:Buffer,type:string}>()
let badSignature=false
const db={
  from:(table:string)=>new Query(table),
  rpc:async(name:string,args:Row)=>{
    assert.ok(['board_save','board_activate'].includes(name))
    const result=await pg.query(`select ${name}(${Object.keys(args).map((_,i)=>`$${i+1}`).join(',')}) as result`,Object.values(args))
    return {data:result.rows[0].result,error:null}
  },
  storage:{getBucket:async()=>({data:{public:false},error:null}),from:()=>({
    info:async(key:string)=>({error:objects.has(key)?null:new Error('missing')}),
    createSignedUploadUrl:async(key:string)=>({data:{signedUrl:`${origin}/storage/${key}`},error:null}),
    createSignedUrl:async(key:string)=>({data:{signedUrl:`${origin}/storage/${key}?expires=${badSignature?0:Date.now()+300000}`},error:null})
  })}
} as unknown as SupabaseClient
process.env.ACCESS_CODE='synthetic-runtime-code'
process.env.ENGINE_OPERATOR_TOKEN='synthetic-runtime-operator'
const handler=createBoardHandler(async()=>db)
const cookie=`cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
const server=createServer(async(request,response)=>{
  const url=new URL(request.url!,origin)
  if(url.pathname.startsWith('/storage/')){
    const key=url.pathname.slice('/storage/'.length)
    if(request.method==='PUT'){
      if(objects.has(key)){response.writeHead(409).end();return}
      const chunks=[];for await(const c of request)chunks.push(c)
      objects.set(key,{data:Buffer.concat(chunks),type:String(request.headers['content-type'])});response.writeHead(200).end();return
    }
    const file=objects.get(key)
    if(!file||Number(url.searchParams.get('expires'))<Date.now()){response.writeHead(403).end();return}
    response.writeHead(200,{'Content-Type':file.type === 'text/html' ? 'text/plain' : file.type});response.end(file.data);return
  }
  const chunks=[];for await(const c of request)chunks.push(c)
  const req=request as VercelRequest; const res=response as VercelResponse
  req.body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):undefined
  req.query=Object.fromEntries(url.searchParams)
  const parts=url.pathname.split('/').filter(Boolean)
  if(url.pathname==='/api/board/weeks'){req.query.op='weeks'}
  else if(parts[0]==='board'){req.query.week=parts[1];req.query.op=parts[1]?'html':'latest'}
  else {req.query.week=parts[2]; if(['uploads','imports','sources','assets'].includes(parts[3]))req.query.op=parts[3];else if(parts[3])req.query.collection=parts[3];if(parts[4])req.query.id=parts[4]}
  res.status=(code:number)=>{response.statusCode=code;return res}
  res.json=(value:unknown)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify(value));return res}
  res.redirect=((code:number,url:string)=>{response.writeHead(code,{Location:url});response.end();return res}) as VercelResponse['redirect']
  await handler(req,res)
})
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`
process.env.APP_ORIGIN=origin
const headers={Authorization:`Bearer ${process.env.ENGINE_OPERATOR_TOKEN}`,'Content-Type':'application/json'}
const get=async(path:string)=>{
  let result:any=null, next=path
  do {
    const r=await fetch(origin+next,{headers});assert.equal(r.status,200);const page=await r.json()
    if(result===null)result=page
    else {const field='documents' in result?'documents':'records';result[field].push(...page[field])}
    next=page.next_offset===null||page.next_offset===undefined?'':path.split('?')[0]+'?offset='+page.next_offset
  }while(next)
  return result
}
const put=async(path:string,body:unknown,expected=200,h=headers)=>{const r=await fetch(origin+path,{method:'PUT',headers:h,body:JSON.stringify(body)});assert.equal(r.status,expected,await r.clone().text());return r.json()}
const week='/api/board/2026-10-19'
try{
  assert.equal((await fetch(origin+week)).status,401)
  const body={done:true,day:'mon',piece_id:'fixture-piece',step:'substack',channel:'substack',label:'Substack',at:'2026-10-19T12:00:00Z'}
  await put(week+'/ticks/mon-substack',{body,revision:0})
  await put(week+'/ticks/mon-substack',{body:{...body,done:false},revision:0},409)
  await put(week+'/ticks/mon-substack',{body:{...body,done:false},revision:1})
  assert.equal((await get(week+'/ticks')).documents[0].body.done,false)
  await put(week+'/links/mon',{body:{article:'https://example.com/story',youtube:''},revision:0},401,{'Content-Type':'application/json',Cookie:cookie,Origin:'https://attacker.example'})
  await put(week+'/links/mon',{body:{article:'https://example.com/story',youtube:''},revision:0},200,{'Content-Type':'application/json',Cookie:cookie,Origin:origin})
  for(const [collection,id,value] of [
    ['edits','mon-article',{text:'Saved wording',day:'mon',item:'article'}],
    ['picks','mon',{pick:'mon-1',day:'mon',story:'Choice'}],
    ['queue','mon-1',{pick:'mon-1',queued:true}],
    ['comments','root',{thread_id:'root',anchor:'mon-article',text:'Note'}],
    ['comments','reply',{thread_id:'root',anchor:'mon-article',text:'Reply'}],
  ] as const){
    // An edit is only ever Krish's own save (his access cookie); the engine's key is refused (edit_is_his_save).
    const krish={'Content-Type':'application/json',Cookie:cookie,Origin:origin}
    if(collection==='edits')await put(`${week}/${collection}/${id}`,{body:value,revision:0},403)
    await put(`${week}/${collection}/${id}`,{body:value,revision:0},200,collection==='edits'?krish:headers);assert.ok((await get(`${week}/${collection}`)).documents.some((d:Row)=>d.id===id))}
  await put(week+'/comments/orphan',{body:{thread_id:'absent',anchor:'mon-article',text:'Wrong'},revision:0},400)
  for(let n=0;n<23;n++)await put(week+'/comments/page-'+String(n).padStart(2,'0'),{body:{thread_id:'page-'+String(n).padStart(2,'0'),anchor:'board-root',text:'Pagination '+n},revision:0})
  const firstPage=await (await fetch(origin+week+'/comments',{headers})).json()
  assert.equal(firstPage.documents.length,10);assert.equal(firstPage.next_offset,10)
  assert.equal((await get(week+'/comments')).documents.length,25,'every page is represented')
  const asset=Buffer.from('fixture-download')
  const html=Buffer.from('<!doctype html><html><body>'+ 'X'.repeat(6*1024*1024)+'</body></html>')
  const spec=(data:Buffer,type:string,name:string)=>({sha256:digest(data),bytes:data.length,type,name,key:`boards/2026-10-19/${digest(data)}`})
  const htmlFile=spec(html,'text/html','board.html'),assetFile=spec(asset,'text/plain','asset.txt')
  objects.set(htmlFile.key,{data:html,type:htmlFile.type});objects.set(assetFile.key,{data:asset,type:assetFile.type})
  const manifest={version:1,week:'2026-10-19',html:htmlFile,assets:{file:assetFile}}
  const published=await put(week,{manifest,revision:0})
  assert.equal(published.build_id,digest(canonical(manifest)))
  assert.equal((await put(week,{manifest,revision:0})).revision,1)
  assert.equal((await fetch(origin+'/api/board/weeks')).status,401)
  assert.deepEqual((await get('/api/board/weeks')).weeks,['2026-10-19'])
  const priorHtml={...htmlFile,key:htmlFile.key.replace('2026-10-19','2026-10-12')}
  objects.set(priorHtml.key,{data:html,type:htmlFile.type})
  await put('/api/board/2026-10-12',{manifest:{version:1,week:'2026-10-12',html:priorHtml,assets:{}},revision:0})
  assert.deepEqual((await get('/api/board/weeks')).weeks,['2026-10-19','2026-10-12'])
  await put(week,{manifest,revision:1},401,{'Content-Type':'application/json',Cookie:cookie,Origin:origin})
  const page=await fetch(origin+'/board/2026-10-19',{headers:{Cookie:cookie}})
  assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'private, no-store');assert.equal(digest(new Uint8Array(await page.arrayBuffer())),htmlFile.sha256)
  const downloaded=await fetch(origin+week+'/assets/file?sha='+assetFile.sha256,{headers})
  assert.equal(downloaded.headers.get('content-type'),assetFile.type)
  assert.equal(digest(new Uint8Array(await downloaded.arrayBuffer())),assetFile.sha256)
  badSignature=true
  assert.equal((await fetch(origin+week+'/assets/file',{headers})).status,403)
  badSignature=false
  assert.equal((await fetch(origin+week+'/assets/file',{headers})).status,200,'fresh click renews an expired link')
  const record={source:'https://claude.ai/artifact/Fixture',collection:'ticks',id:'mon-substack',body}
  for(let n=0;n<2;n++)assert.equal((await fetch(origin+week+'/imports',{method:'POST',headers,body:JSON.stringify({records:[record]})})).status,200)
  assert.equal((await get(week+'/imports')).records.length,1)
  const rawReply={source:record.source,collection:'comments',id:'root#reply-1',body:{thread_id:'root',anchor:null,text:'Original reply',at:'2026-10-16T13:05'}}
  for(let n=0;n<2;n++)assert.equal((await fetch(origin+week+'/imports',{method:'POST',headers,body:JSON.stringify({records:[rawReply]})})).status,200)
  const sourceReply=(await get(week+'/imports')).records.find((r:Row)=>r.doc_id==='root#reply-1')
  assert.deepEqual(sourceReply.body,rawReply.body,'source archive preserves null anchors and source reply IDs')
  await put(week+'/comments/invalid-source-shape',{body:rawReply.body,revision:0},400)
  const exportBytes=Buffer.from(JSON.stringify({complete:true,source:'https://claude.ai/artifact/Fixture'}))
  const exportedFile=spec(exportBytes,'application/json','source-export.json')
  objects.set(exportedFile.key,{data:exportBytes,type:exportedFile.type})
  const sourceFiles={export:exportedFile,html:htmlFile}
  const sourceArchive=async(files:unknown)=>fetch(origin+week+'/sources',{method:'POST',headers,body:JSON.stringify({source:record.source,files})})
  assert.equal((await sourceArchive(sourceFiles)).status,400,'missing manifests cannot be silently discarded')
  const evidencedFiles={...sourceFiles,manifest_unavailable:{accessible:false,reason:'No source manifest published'}}
  for(let n=0;n<2;n++)assert.equal((await sourceArchive(evidencedFiles)).status,200)
  const sources=await get(week+'/sources')
  assert.equal(sources.sources.length,1);assert.deepEqual(sources.sources[0].files,evidencedFiles)
  console.log('PASS: actual handlers over HTTP + PostgreSQL; cookie/operator/CSRF, all collections, conflicts, comments/replies, 6 MB streamed HTML, download hashes/expiry, import replay')
  if(process.env.BOARD_SOURCE_FIXTURE_FILE) {
    const plan=JSON.parse(await readFile(process.env.BOARD_SOURCE_FIXTURE_FILE,'utf8'))
    await pg.exec('reset role; truncate board_documents, board_ticks, board_history, board_imports; set role service_role;')
    for(let replay=0;replay<2;replay++) {
      for(const record of plan.records) assert.equal((await fetch(origin+`/api/board/${record.week}/imports`,{method:'POST',headers,body:JSON.stringify({records:[record]})})).status,200)
      for(const record of plan.winners) {
        const path=`/api/board/${record.week}/${record.collection}`
        const existing=(await get(path)).documents.find((d:Row)=>d.id===record.id)
        await put(path+'/'+record.id,{body:record.body,revision:existing?.revision||0})
        assert.deepEqual((await get(path)).documents.find((d:Row)=>d.id===record.id).body,record.body)
      }
    }
    for(const date of new Set(plan.records.map((r:Row)=>r.week))) assert.equal((await get(`/api/board/${date}/imports`)).records.length,plan.records.filter((r:Row)=>r.week===date).length)
    console.log(`PASS: all ${plan.records.length} supplied source records archived twice and all ${plan.winners.length} canonical records read back exactly, including reply anchors and source nulls`)
  }
  if(process.argv[3] && process.argv[4]) {
    if(process.argv[7]) {
      // Optional private source fixture is read from outside the repository.
      // This database exists only inside this disposable PGlite process.
      const exported=JSON.parse(await readFile(process.argv[7],'utf8'))
      assert.equal(exported.complete,true);assert.equal(exported.week,'2026-10-19')
      await pg.exec('reset role; truncate board_documents, board_ticks, board_history; set role service_role;')
      for(const [collection,documents] of Object.entries(exported.collections)) {
        for(const document of documents as {id:string,body:Row}[])await put(`${week}/${collection}/${document.id}`,{body:document.body,revision:0})
        const actual=(await get(`${week}/${collection}`)).documents
        assert.equal(actual.length,(documents as unknown[]).length)
        for(const document of documents as {id:string,body:Row}[])assert.deepEqual(actual.find((d:Row)=>d.id===document.id).body,document.body)
      }
      console.log('PASS: every supplied source document accepted and read back byte-equivalent as JSON through the real API')
    }
    const fixture=await readFile(process.argv[4]);const file=spec(fixture,'text/html','fixture.html')
    objects.set(file.key,{data:fixture,type:file.type})
    await put(week,{manifest:{version:1,week:'2026-10-19',html:file,assets:{}},revision:1})
    const {checkBrowser:interact,checkVisual}=await import('../board-browser.mjs')
    const checkBrowser=process.argv[6]==='visual'?checkVisual:interact
    await checkBrowser({modulePath:process.argv[3],origin,cookie,api:(collection:string)=>get(week+'/'+collection),write:(collection:string,id:string,body:unknown,revision:number)=>put(`${week}/${collection}/${id}`,{body,revision},200,collection==='edits'?{'Content-Type':'application/json',Cookie:cookie,Origin:origin}:headers),screenshotDir:process.argv[5],sourceData:!!process.argv[7]})
  }
}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await pg.close()}
