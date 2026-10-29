// Local HTTP + actual SQL integration. Storage is a private in-memory fixture.
// node --import tsx tests/integration/board-runtime.ts /path/to/pglite/dist/index.js
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
import { createHash, sign } from 'node:crypto'
import assert from 'node:assert/strict'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { canonical, digest } from '../../apps/control-plane/api/board/_contracts.js'
import { scriptHash } from '../../apps/control-plane/api/_teleprompter.js'
import { BoardDeliverySchema, MEDIA_STANDARD_HASH, canonicalMediaJson, mediaDigest } from '../../packages/core/src/media-quality.js'
import { MediaFixture } from '../helpers/media-quality.js'
import rolloutConfig from '../../config/media-quality-rollout.json' with { type: 'json' }
import { parseMediaQualityRollout } from '../../packages/core/src/media-rollout.js'

// readMediaRef dynamically loads the library path helpers, whose module also
// constructs a Supabase client. Satisfy that import with synthetic credentials;
// every operation below still uses our injected private in-memory fixture.
process.env.SUPABASE_URL='https://storage-fixture.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only'

// Activate only this disposable process's imported module fixture. No file is
// written and production exposes no request/environment activation override.
const originalRollout = { ...rolloutConfig }
const syntheticEvidence = { path: 'docs/plans/synthetic-runtime-fixture.json', sha256: 'a'.repeat(64) }
const syntheticPassed = { verdict: 'passed', standard_sha256: MEDIA_STANDARD_HASH, evidence: [syntheticEvidence] }
Object.assign(rolloutConfig, parseMediaQualityRollout({ schema_version: 1, status: 'active', standard_sha256: MEDIA_STANDARD_HASH,
  activation: { approved_by: 'Krish', approved_at: '2026-10-26T00:00:00Z', repository_review: syntheticEvidence,
    reviewer_key_ids: ['final'], calibration: syntheticPassed, regression: syntheticPassed, readiness: syntheticPassed } }))

const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const pg = new PGlite()
await pg.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;')
await pg.exec(await readFile(new URL('../../supabase/migrations/20261019120743_publish_board_web.sql', import.meta.url), 'utf8'))
// The rejection inbox exactly as its migration makes it (the table, its checks, its index and its hold trigger), so an
// asset Reject is filed against the real constraints; the migration's other tables need ones this database lacks.
const rejections=await readFile(new URL('../../supabase/migrations/20261116090000_rejections.sql', import.meta.url), 'utf8')
await pg.exec(rejections.slice(rejections.indexOf('create table public.taste_rejection_inbox ('), rejections.indexOf('create table public.taste_floor_standards (')))
// The piece's row as the making route reads and writes it: its making record in meta, guarded on updated_at.
await pg.exec(`create table public.content_ideas (id uuid primary key, meta jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(),
  state text not null default 'drafting', idea text, lane_slot text, scheduled_for date, published_at timestamptz, published_url text, transformed_outputs jsonb, buried_at timestamptz);
  grant select, insert, update on public.taste_rejection_inbox, public.content_ideas to service_role;`)
// His scores exactly as their migration makes them (W2.1), loaded after content_ideas, which they reference.
await pg.exec((await readFile(new URL('../../supabase/migrations/20261118090000_piece_scores.sql', import.meta.url), 'utf8')).replace(/^begin;$|^commit;$/gm, ''))
await pg.exec('set role service_role')
type Row = Record<string, unknown>
class Query {
  filters: [string, unknown][] = []; sorting = ''; offset = 0; count = 10000; single = false; payload: Row[] | null = null; jsonFilter: [string,unknown] | null = null
  constructor(readonly table: string) { assert.match(table,/^(board_[a-z]+|content_ideas|taste_rejection_inbox|piece_scores|piece_scores_current)$/) }
  select(_fields: string) { return this }
  eq(key: string, value: unknown) { this.filters.push([key,value]); return this }
  contains(key: string,value: unknown) { this.jsonFilter=[key,value]; return this }
  nulls: string[] = []; gtes: [string,unknown][] = []
  is(key: string,value: null) { assert.equal(value,null); assert.match(key,/^[a-z_][a-z0-9_]*$/); this.nulls.push(key); return this }
  gte(key: string,value: unknown) { assert.match(key,/^[a-z_][a-z0-9_]*$/); this.gtes.push([key,value]); return this }
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
      const where=this.filters.map(([k],i)=>{
        // A JSON field (the approvals and titles views filter body->>kind), else a plain column.
        const json=/^([a-z_][a-z0-9_]*)->>([a-z_][a-z0-9_]*)$/.exec(k)
        if(json)return `${json[1]}->>'${json[2]}'=$${i+1}`
        assert.match(k,/^[a-z_][a-z0-9_]*$/); return `${k}=$${i+1}` })
      if(this.jsonFilter){params.push(JSON.stringify(this.jsonFilter[1]));where.push(`${this.jsonFilter[0]} @> $${params.length}::jsonb`)}
      for(const k of this.nulls)where.push(`${k} is null`)
      for(const [k,v] of this.gtes){params.push(v);where.push(`${k}>=$${params.length}`)}
      const result=await pg.query(`select * from ${this.table}${where.length?' where '+where.join(' and '):''}${this.sorting} limit ${this.count} offset ${this.offset}`,params)
      return {data:this.single?result.rows[0]||null:result.rows,error:null}
    } catch(error) {return {data:null,error}}
  }
  then(resolve: (v: unknown)=>unknown,reject: (e: unknown)=>unknown) {return this.run().then(resolve,reject)}
}
let origin=''
const originalFetch=globalThis.fetch
globalThis.fetch=(input,init)=>{
  const url=input instanceof Request?input.url:String(input)
  assert.equal(new URL(url).origin,origin,'standalone fixture forbids non-local HTTP requests')
  return originalFetch(input,init)
}
const objects=new Map<string,{data:Buffer,type:string}>()
// Fresh per-process keys and labelled synthetic evidence; never real review authority.
const media=new MediaFixture()
process.env.MEDIA_REVIEW_PUBLIC_KEYS=JSON.stringify(media.keys)
const reviewedManifest=(manifest: {version:number;week:string;html:unknown;assets:Record<string,unknown>})=>{
  const evidence=media.put(`board-${mediaDigest(canonicalMediaJson(manifest))}.json`,JSON.stringify({synthetic_test_evidence:true,note:'Isolated HTTP/SQL/browser fixture; no real media approval'}))
  for(const [key,data] of media.objects)objects.set(key,{data,type:'application/json'})
  const payload={schema_version:1,kind:'board_delivery',standard_sha256:MEDIA_STANDARD_HASH,
    manifest_sha256:mediaDigest(canonicalMediaJson(manifest)),reviewer_run_id:'synthetic-board-runtime',
    reviewed_at:'2026-10-26T00:00:00.000Z',evidence:[evidence],all_media_bound:true,no_unqualified_ready_claims:true,qualifications:[]}
  const delivery_review=BoardDeliverySchema.parse({key_id:'final',payload,signature:sign(null,Buffer.from(canonicalMediaJson(payload)),media.key.privateKey).toString('base64')})
  return {...manifest,delivery_review}
}
let badSignature=false
const db={
  from:(table:string)=>table==='content_library_files'?media.db.from():new Query(table),
  rpc:async(name:string,args:Row)=>{
    assert.ok(['board_save','board_activate'].includes(name))
    const result=await pg.query(`select ${name}(${Object.keys(args).map((_,i)=>`$${i+1}`).join(',')}) as result`,Object.values(args))
    return {data:result.rows[0].result,error:null}
  },
  storage:{getBucket:async()=>({data:{public:false},error:null}),from:()=>({
    info:async(key:string)=>({error:objects.has(key)?null:new Error('missing')}),
    createSignedUploadUrl:async(key:string)=>({data:{signedUrl:`${origin}/storage/${key}`},error:null}),
    createSignedUrl:async(key:string)=>({data:{signedUrl:`${origin}/storage/${key}?expires=${badSignature&&key.startsWith('boards/')?0:Date.now()+300000}`},error:null})
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
const put=async(path:string,body:unknown,expected=200,h:Record<string,string>=headers)=>{const r=await fetch(origin+path,{method:'PUT',headers:h,body:JSON.stringify(body)});assert.equal(r.status,expected,await r.clone().text());return r.json()}
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
  {
    // Krish's presses go through the real SQL with no migration: each lands in a collection board_documents already
    // takes, only his cookie writes it, and Approve scripts records the server's answer in a second CAS revision. The
    // server sends only words the piece's making record shows checked and read back; with no Teleprompter key the
    // send makes no request and answers no_key.
    const presses='/api/board/2026-11-09', krish={'Content-Type':'application/json',Cookie:cookie,Origin:origin}
    const piece='11111111-2222-4333-8444-555555555555'
    delete process.env.TELEPROMPTER_API_KEY
    const hashes={long:scriptHash('Said long.'),short:scriptHash('Said short.')}
    const read=(sha:string)=>({script_sha256:sha,at:'2026-11-08T10:00:00Z',by:'Claude Code',readers:['one','two'],found:'nothing lost'})
    await pg.query('insert into content_ideas (id, meta) values ($1, $2)',[piece,{making:{updated_at:'2026-11-08T10:00:00Z',by:'Claude Code',
      script_check:{passed:true,checked_at:'2026-11-08T10:00:00Z',problems:[],hashes,read_back:{long:read(hashes.long),short:read(hashes.short)}}}}])
    const approval={kind:'approve_scripts',day:'mon',piece_id:piece,approved:true,texts:{long:'Said long.',short:'Said short.'},
      titles:{long:'Mon 9 Nov - 5-minute - X',short:'Mon 9 Nov - 90-second - X'},folder_title:'Mon 9 Nov follow.the.money - X'}
    await put(presses+'/picks/mon-scripts',{body:approval,revision:0},403)
    const approved=await put(presses+'/picks/mon-scripts',{body:approval,revision:0},200,krish)
    assert.equal(approved.revision,2);assert.equal(approved.send.status,'no_key');assert.match(approved.body.scripts.long,/^[a-f0-9]{64}$/)
    const view=(await get(presses+'/approvals')).documents
    assert.deepEqual(view.map((d:Row)=>d.id),['mon-scripts']);assert.equal(view[0].updated_by,'Krish');assert.equal(view[0].body.send.status,'no_key')
    // Words the check did not pass (his edit since) are held for a session, and nothing is sent.
    const edited=await put(presses+'/picks/wed-scripts',{body:{...approval,day:'wed',texts:{long:'Said long, then changed.',short:'Said short.'}},revision:0},200,krish)
    assert.equal(edited.send.status,'held');assert.match(edited.send.error,/not the words the scripts' check passed/)
    // A rejected asset files his reason in the inbox once, against the table's own checks; a rejected idea files nothing.
    const reject={kind:'reject_asset',day:'mon',piece_id:piece,asset:'video-short',label:'90-second video',reason:'The captions drift.',
      drive_id:'a'.repeat(33),at_ms:83000,formats:['short_video'],at:'2026-11-09T07:40:00Z'}
    assert.equal((await put(presses+'/picks/mon-reject-video-short',{body:reject,revision:0},200,krish)).inbox,'filed')
    assert.equal((await put(presses+'/picks/mon-reject-video-short',{body:reject,revision:1},200,krish)).inbox,'filed')
    await put(presses+'/queue/mon-3',{body:{pick:'mon-3',use:'not_for_us',queued:false,reason:'Done to death.'},revision:0},200,krish)
    await put(presses+'/queue/mon-4',{body:{pick:'mon-4',use:'not_for_us',queued:false},revision:0},400,krish)
    const inbox=(await pg.query('select said, said_where, piece, formats, master_drive_id, at_ms, whole_cut, repository, client_report_id from taste_rejection_inbox')).rows as Row[]
    assert.equal(inbox.length,1,'the same words saved again file nothing twice, and an idea files nothing')
    assert.deepEqual({...inbox[0],client_report_id:undefined},{said:'The captions drift.',said_where:'publish board, 2026-11-09 mon',piece,formats:['short_video'],
      master_drive_id:'a'.repeat(33),at_ms:83000,whole_cut:false,repository:'krishanraja/content-engine',client_report_id:undefined})
    // His press stays his: the operator key cannot write over it, whatever the body carries.
    await put(presses+'/queue/mon-3',{body:{pick:'mon-3',queued:false},revision:1},403)
    for(const [collection,id,value] of [
      ['queue','mon-2',{pick:'mon-2',use:'next_week',target_week:'2026-11-16',queued:true}],
      ['queue','off-tue-o1',{pick:'off-tue-o1',use:'offday',day:'tue',approved:true,copy_sha256:'c'.repeat(64)}],
      // Growth's mix runs every day (Krish, 2026-10-29: "Mix wins: every day"): an option on a series day is pressed too.
      ['queue','off-mon-meme-c1',{pick:'off-mon-meme-c1',use:'offday',day:'mon',approved:true,copy_sha256:'c'.repeat(64)}],
      ['picks','mon',{pick:'mon-2',day:'mon',story:'Choice',note:'Lead with the deal.'}],
      ['picks','mon-titles',{kind:'titles',day:'mon',picks:{long_title:'X'}}],
      ['picks','mon-publish',{kind:'approve_publish',day:'mon',piece_id:piece,approved:true}],
    ] as const){
      await put(`${presses}/${collection}/${id}`,{body:value,revision:0},403)
      await put(`${presses}/${collection}/${id}`,{body:value,revision:0},200,krish)
    }
    assert.deepEqual((await get(presses+'/titles')).documents.map((d:Row)=>d.id),['mon-titles'])
    // A piece he records stays an off-day piece: on Monday it is refused.
    await put(presses+'/queue/off-mon-r1',{body:{pick:'off-mon-r1',use:'offday',day:'mon',approved:true,copy_sha256:'c'.repeat(64),kind:'recorded',
      piece_id:piece,series:'follow_the_money',style:'to_camera',script:'Words.',folder_title:'F',title:'T'},revision:0},400,krish)
    await put(presses+'/approvals/mon-scripts',{body:approval,revision:2},400,krish)
    // His Scores press (W2.1): only his cookie writes it, each save files one piece_scores row against the table's own
    // checks, the same marks saved again file nothing twice, a new score is a new row (history kept), and only his
    // scores count in piece_scores_current. A model's guess is stored labelled and never counts.
    const score={kind:'scores',piece_id:piece,narrative:8,production:6,basis:'hindsight',note:'The hook landed; the cut dragged.'}
    await put(presses+'/picks/score-'+piece,{body:score,revision:0},403)
    await put(presses+'/picks/score-'+piece,{body:{...score,narrative:11},revision:0},400,krish)
    await put(presses+'/picks/score-'+piece,{body:{...score,piece_id:'22222222-2222-4333-8444-555555555555'},revision:0},400,krish)
    const first=await put(presses+'/picks/score-'+piece,{body:score,revision:0},200,krish)
    assert.equal(first.scores,'filed')
    const again=await put(presses+'/picks/score-'+piece,{body:score,revision:first.revision},200,krish)
    assert.equal(again.scores,'filed')
    assert.equal((await put(presses+'/picks/score-'+piece,{body:{...score,production:7,note:null},revision:again.revision},200,krish)).scores,'filed')
    const rows=(await pg.query('select narrative, production, basis, scored_by, counts, note, said_where from piece_scores order by id')).rows as Row[]
    assert.equal(rows.length,2,'the same score saved again files nothing twice; a changed one is a new row')
    assert.deepEqual(rows[0],{narrative:8,production:6,basis:'hindsight',scored_by:'krish',counts:true,note:'The hook landed; the cut dragged.',said_where:`publish board, 2026-11-09 picks/score-${piece}`})
    await pg.query("insert into piece_scores (piece_id,narrative,production,basis,scored_by,said_where,client_report_id) values ($1,10,10,'hindsight','model:guess','test',$2)",[piece,'d'.repeat(64)])
    const current=(await pg.query('select narrative, production, note from piece_scores_current where piece_id=$1',[piece])).rows as Row[]
    assert.deepEqual(current,[{narrative:8,production:7,note:null}],'his latest score counts; the model guess never does')
    // The Archive reads every published piece with his current scores, newest first; a model guess never shows.
    await pg.query(`update content_ideas set state='published', idea='The idea', lane_slot='follow_the_money', published_at='2026-11-09T12:00:00Z',
      published_url='https://example.com/p/one', meta=meta || '{"making":{"channels":{"youtube":{"url":"https://example.com/v/one"}}}}'::jsonb where id=$1`,[piece])
    const archive=await get(presses+'/archive')
    assert.equal(archive.scores,'live')
    assert.deepEqual(archive.rows,[{piece_id:piece,date:'2026-11-09',series:'follow_the_money',title:'The idea',
      links:[{label:'Substack',url:'https://example.com/p/one'},{label:'YouTube',url:'https://example.com/v/one'}],
      scores:{hindsight:{narrative:8,production:7,note:null,scored_at:(archive.rows[0].scores.hindsight||{}).scored_at}}}])
    await put(presses+'/archive/x',{body:{},revision:0},400,krish)
    // The engine's role has no update or delete, and even the owner cannot change or drop a score.
    await assert.rejects(pg.query('update piece_scores set narrative=1'),/permission denied/)
    await pg.exec('reset role')
    await assert.rejects(pg.query('update piece_scores set narrative=1'),/kept as he gave it/)
    await assert.rejects(pg.query('delete from piece_scores'),/kept as he gave it/)
    await pg.exec('set role service_role')
  }
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
  const unsignedManifest={version:1,week:'2026-10-19',html:htmlFile,assets:{file:assetFile}}
  await put(week,{manifest:unsignedManifest,revision:0},409)
  assert.equal((await get(week)).build_id,null,'missing independent review never activates a build')
  const manifest=reviewedManifest(unsignedManifest)
  const published=await put(week,{manifest,revision:0})
  assert.equal(published.build_id,digest(canonical(manifest)))
  assert.equal((await put(week,{manifest,revision:0})).revision,1)
  assert.equal((await fetch(origin+'/api/board/weeks')).status,401)
  assert.deepEqual((await get('/api/board/weeks')).weeks,['2026-10-19'])
  const priorHtml={...htmlFile,key:htmlFile.key.replace('2026-10-19','2026-10-12')}
  objects.set(priorHtml.key,{data:html,type:htmlFile.type})
  await put('/api/board/2026-10-12',{manifest:reviewedManifest({version:1,week:'2026-10-12',html:priorHtml,assets:{}}),revision:0})
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
    await put(week,{manifest:reviewedManifest({version:1,week:'2026-10-19',html:file,assets:{}}),revision:1})
    const {checkBrowser:interact,checkVisual}=await import('../board-browser.mjs')
    const checkBrowser=process.argv[6]==='visual'?checkVisual:interact
    await checkBrowser({modulePath:process.argv[3],origin,cookie,api:(collection:string)=>get(week+'/'+collection),write:(collection:string,id:string,body:unknown,revision:number)=>put(`${week}/${collection}/${id}`,{body,revision},200,collection==='edits'?{'Content-Type':'application/json',Cookie:cookie,Origin:origin}:headers),screenshotDir:process.argv[5],sourceData:!!process.argv[7]})
  }
}finally{globalThis.fetch=originalFetch;Object.assign(rolloutConfig, originalRollout);await new Promise<void>(resolve=>server.close(()=>resolve()));await pg.close()}
