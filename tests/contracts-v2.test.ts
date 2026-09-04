import { describe, expect, it } from 'vitest'
import {
  AnyJobManifestSchema, AnyRenderManifestSchema, DraftPackageV2Schema, JobManifestV2Schema,
  RenderManifestV2Schema, SCHEMA_VERSION, SourceBundleV1Schema, SourceVisualAnalysisV1Schema,
  StageArtifactV2Schema, StageNameSchema, StageNameV2Schema, VisualAssetV1Schema,
  VisualNarrativePlanV1Schema,
} from '@mindmake/contracts'

const H='a'.repeat(64), H2='b'.repeat(64)
const sourceBundle={schema_version:1 as const,bundle_id:'bundle-1',primary_source_id:'camera-main',sources:[{source_id:'camera-main',kind:'video' as const,role:'primary_camera' as const,ref:'source.mp4',rights:'owned' as const,sync:{strategy:'already_mixed' as const,offset_ms:0},include_in_edit:true}]}
const cameraPlan={camera_plan_id:'camera-plan-1',source_id:'camera-main',subject_track_ids:['subject-1'],start_ms:0,end_ms:1000,framing:'medium_close' as const,movement:'locked' as const,lead_room:'auto' as const,protected_region_ids:[],keyframes:[{at_ms:0,crop:{x:0,y:0,width:1,height:1},zoom:1,rotation_degrees:0,confidence:1}],easing:'hold' as const,max_velocity:1,max_acceleration:1,minimum_hold_ms:250,quality_floor:{minimum_effective_width_px:1080,allow_upscale:false},confidence:1,fallback:'Use a stable full-height crop.'}
const shot={shot_id:'shot-1',beat_id:'beat-1',start_ms:0,end_ms:1000,source_id:'camera-main',source_start_ms:0,source_end_ms:1000,subject_track_ids:['subject-1'],primary_attention_target:{kind:'presenter' as const},technique_ids:['stable-crop'],camera_plan:cameraPlan,layers:[{layer_id:'source-layer',z_index:0,kind:'source' as const,target_id:'camera-main',anchor:'full' as const,opacity:1,blend_mode:'normal' as const,protected:false}],transition_in:'none' as const,transition_out:'none' as const,audio_continuity:'direct' as const,rationale:'Keep Krish as the clear final focus.'}
const visualPlan={schema_version:1 as const,plan_id:'plan-1',job_id:'job-1',candidate_id:'candidate-1',candidate_hash:H,claims_artifact_hash:H,source_analysis_artifact_hash:H,technique_registry_hash:H,preference_snapshot_hash:H,duration_ms:1000,treatment_lane:'restrained' as const,beats:[{beat_id:'beat-1',start_ms:0,end_ms:1000,transcript:'This is the ending.',source_spans:[{source_id:'camera-main',start_ms:0,end_ms:1000}],claim_ids:[],narrative_function:'ending' as const,viewer_task:'land_payoff' as const,emotional_function:'trust' as const,visual_density:'rest' as const,proof_dependency:false,primary_attention_target:{kind:'presenter' as const},rationale:'End cleanly on Krish and the conclusion.'}],asset_requirements:[],resolved_assets:[],shot_directives:[shot],budget:{estimated_cost_gbp:0,maximum_cost_gbp:15,exception_approved:false},disclosures:[{platform:'youtube_shorts' as const,decision:'not_required' as const,rationale:'No meaningfully altered material is used.'}],fallbacks:[],strategy_summary:'A restrained single-beat ending led by the presenter.'}
const analysis={schema_version:1 as const,analysis_id:'analysis-1',job_id:'job-1',source_bundle_hash:H,coordinate_space:'normalized_0_1' as const,timebase:'source_local_ms' as const,generated_at:new Date().toISOString(),capabilities:{tier:1 as const,analyzers:{opencv:'test'},unavailable:[],fallbacks:[]},sources:[{source_id:'camera-main',source_hash:H,duration_ms:1000,width:3840,height:2160,fps:30,audio_hz:48000,canonical_offset_ms:0}],shots:[{shot_id:'source-shot-1',source_id:'camera-main',start_ms:0,end_ms:1000,transition:'source_start' as const,confidence:1}],subjects:[{track_id:'subject-1',source_id:'camera-main',role:'unknown' as const,start_ms:0,end_ms:1000,face_keyframes:[{at_ms:0,bounds:{x:.4,y:.2,width:.2,height:.2},confidence:.9}],body_keyframes:[],hand_keyframes:[],detection_confidence:.9}],active_speakers:[],gestures:[],gaze:[],negative_space:[],protected_regions:[],sidecars:[],quality_issues:[]}

describe('V2 contracts remain additive',()=>{
  it('preserves every V1 version and parses V1 and V2 job manifests independently',()=>{
    expect(SCHEMA_VERSION).toBe(1)
    const when=new Date().toISOString()
    const v1={schema_version:1,job_id:'job-v1',created_at:when,updated_at:when,series:'money_of_ai',mode:'solo',purpose:'production',source:{kind:'file',ref:'source.mp4',rights:'owned'},config_hash:H,skill_hashes:{},pinned_inputs:{config_path:'pinned/studio.json',skill_paths:{}},stages:Object.fromEntries(StageNameSchema.options.map(s=>[s,{status:'pending',updated_at:when}])),approvals:[]}
    expect(AnyJobManifestSchema.parse(v1).schema_version).toBe(1)
    const v2={schema_version:2,job_id:'job-v2',created_at:when,updated_at:when,series:'built_with_ai',mode:'solo',purpose:'production',presenter_name:'Krish',source_bundle:sourceBundle,target_platforms:['youtube_shorts'],treatment_lane:'premium',consent_refs:[],config_hash:H,skill_hashes:{},pinned_inputs:{config_path:'pinned/studio.json',skill_paths:{}},stages:Object.fromEntries(StageNameV2Schema.options.map(s=>[s,{status:'pending',updated_at:when}])),approvals:[]}
    expect(JobManifestV2Schema.parse(v2).schema_version).toBe(2)
    expect(AnyJobManifestSchema.parse(v2).schema_version).toBe(2)
    expect(JobManifestV2Schema.parse({...v2,mode:'short_native',source_bundle:undefined}).source_bundle).toBeUndefined()
    expect(()=>JobManifestV2Schema.parse({...v2,mode:'solo',source_bundle:undefined})).toThrow('require a source bundle')
  })

  it('enforces source identity, synchronization and primary-video invariants',()=>{
    expect(SourceBundleV1Schema.parse(sourceBundle).primary_source_id).toBe('camera-main')
    expect(()=>SourceBundleV1Schema.parse({...sourceBundle,sources:[sourceBundle.sources[0],sourceBundle.sources[0]]})).toThrow('source IDs must be unique')
    expect(()=>SourceBundleV1Schema.parse({...sourceBundle,sources:[{...sourceBundle.sources[0],kind:'audio',role:'isolated_audio'}]})).toThrow('primary source must contain video')
    expect(()=>SourceBundleV1Schema.parse({...sourceBundle,sources:[{...sourceBundle.sources[0],rights:'commentary_exception'}]})).toThrow('attribution')
    expect(SourceBundleV1Schema.parse({...sourceBundle,sources:[{...sourceBundle.sources[0],rights:'commentary_exception',attribution:'Original publisher',rights_rationale:'A short transformative excerpt is necessary to examine the claim.',editorial_purpose:'Critique the specific claim while preserving its original context.'}]}).sources[0]?.rights).toBe('commentary_exception')
  })

  it('uses a consented canonical participant roster while retaining singular compatibility',()=>{
    const guest={kind:'job_local' as const,label:'Guest',consent_ref:'consent/guest-1.json'}
    const guestCamera={...sourceBundle.sources[0],source_id:'camera-guest',role:'guest_camera' as const,participants:[guest]}
    expect(SourceBundleV1Schema.parse({...sourceBundle,sources:[sourceBundle.sources[0],guestCamera]}).sources[1]?.participants).toEqual([guest])
    expect(()=>SourceBundleV1Schema.parse({...sourceBundle,sources:[sourceBundle.sources[0],{...guestCamera,participants:[{kind:'job_local',label:'Guest'}]}]})).toThrow('consent_ref')
    expect(()=>SourceBundleV1Schema.parse({...sourceBundle,sources:[sourceBundle.sources[0],{...guestCamera,participants:[guest,{...guest,label:'Same consent'}]}]})).toThrow('duplicate declarations')
    expect(()=>SourceBundleV1Schema.parse({...sourceBundle,sources:[sourceBundle.sources[0],{...guestCamera,participant:guest}]})).toThrow('never both')
    const legacy={...guestCamera,participants:undefined,participant:guest}
    expect(SourceBundleV1Schema.parse({...sourceBundle,sources:[sourceBundle.sources[0],legacy]}).sources[1]?.participant).toEqual(guest)
    expect(()=>SourceBundleV1Schema.parse({...sourceBundle,sources:[sourceBundle.sources[0],{...guestCamera,participants:[]}]})).toThrow('require a consented job-local participant roster')
    expect(()=>SourceBundleV1Schema.parse({...sourceBundle,sources:[sourceBundle.sources[0],{...guestCamera,role:'mixed_program',participants:[]}]})).toThrow('require a participant roster')
  })

  it('validates normalized source analysis without accepting persistent guest biometrics',()=>{
    expect(SourceVisualAnalysisV1Schema.parse(analysis).subjects[0]?.role).toBe('unknown')
    expect(()=>SourceVisualAnalysisV1Schema.parse({...analysis,subjects:[{...analysis.subjects[0],role:'guest',profile_id:'guest-profile',profile_version_hash:H}]})).toThrow('guest identities must remain job-local')
    expect(()=>SourceVisualAnalysisV1Schema.parse({...analysis,subjects:[{...analysis.subjects[0],embedding:[0.1,0.2]}]})).toThrow()
    expect(()=>SourceVisualAnalysisV1Schema.parse({...analysis,gestures:[{gesture_id:'gesture-1',track_id:'missing-track',start_ms:0,end_ms:500,hand:'right',kind:'point',confidence:.9}]})).toThrow('unknown subject track')
  })

  it('enforces continuous beat coverage, a terminal payoff and no generated evidence',()=>{
    expect(VisualNarrativePlanV1Schema.parse(visualPlan).beats).toHaveLength(1)
    expect(()=>VisualNarrativePlanV1Schema.parse({...visualPlan,beats:[{...visualPlan.beats[0],start_ms:100}]})).toThrow('continuous ordered timeline')
    expect(()=>VisualNarrativePlanV1Schema.parse({...visualPlan,beats:[{...visualPlan.beats[0],narrative_function:'context'}]})).toThrow('last beat must be payoff or ending')
    expect(()=>VisualNarrativePlanV1Schema.parse({...visualPlan,asset_requirements:[{asset_id:'proof-1',content_kind:'generated_still',truth_role:'evidence',narrative_job:'prove',claim_ids:[],brief:'Show proof of the exact factual claim.',generated_allowed:true,required:true,fallback:'Use the primary source instead.'}]})).toThrow('evidence cannot allow generation')
    const generatedEvidence={asset_id:'fake-proof',media_kind:'image',content_kind:'generated_still',truth_role:'evidence',path:'fake.png',sha256:H,source_url:'https://example.com',rights:'generated',attribution:'Generated',rights_rationale:'Supporting visual created for this video.',generated:true,label:'Illustration',approval:{state:'unreviewed'}}
    expect(()=>VisualAssetV1Schema.parse(generatedEvidence)).toThrow('generated media cannot be evidence')
  })

  it('validates V2 stage payloads instead of accepting arbitrary visual artifacts',()=>{
    const envelope={schema_version:2 as const,job_id:'job-1',stage:'source_analysis' as const,created_at:new Date().toISOString(),input_hashes:{normalize:H},config_hash:H,tool_versions:{analyzer:'test'},payload:analysis,artifact_hash:H2}
    expect(StageArtifactV2Schema.parse(envelope).stage).toBe('source_analysis')
    expect(()=>StageArtifactV2Schema.parse({...envelope,payload:{}})).toThrow()

    const assetsEnvelope={...envelope,stage:'assets' as const,payload:{visual_plan_artifact_hash:H,assets:[],generated_shots:[],editorial_evidence:{packet_path:'review/evidence.json',packet_hash:H,contact_sheet_path:'review/contact-sheet.png',contact_sheet_hash:H2}}}
    expect(StageArtifactV2Schema.parse(assetsEnvelope).stage).toBe('assets')
    expect(()=>StageArtifactV2Schema.parse({...assetsEnvelope,payload:{...assetsEnvelope.payload,editorial_evidence:{...assetsEnvelope.payload.editorial_evidence,packet_hash:'wrong'}}})).toThrow()
  })
})

describe('V2 render and package boundaries',()=>{
  const output={platform:'youtube_shorts' as const,width:1080 as const,height:1920 as const,fps:30 as const,audio_hz:48000 as const,safe_zones:{top_px:100,right_px:100,bottom_px:300,left_px:100},maximum_duration_ms:180000}
  const render={schema_version:2 as const,manifest_id:'manifest-1',job_id:'job-1',candidate_id:'candidate-1',candidate_hash:H,visual_plan_artifact_hash:H,series:'built_with_ai' as const,treatment_id:'restrained-v2',treatment_lane:'restrained' as const,target_platform:'youtube_shorts' as const,output,duration_ms:1000,sources:[{source_id:'camera-main',kind:'video' as const,path:'clip.mp4',sha256:H,duration_ms:1000,width:3840,height:2160,fps:30,audio_hz:48000,canonical_offset_ms:0}],shot_directives:[shot],assets:[],generated_shots:[],captions:[{start_ms:0,end_ms:1000,text:'This is the ending.',emphasis:[]}],caption_provenance:{transcript_hash:H,verified:true as const,exact_word_fidelity:true as const,source_token_count:4,caption_token_count:4},audio_plan:{dialogue_source_ids:['camera-main'],dialogue_master_source_id:'camera-main',dialogue_edits:[{edit_id:'dialogue-1',source_id:'camera-main',output_start_ms:0,output_end_ms:1000,source_start_ms:0,source_end_ms:1000,gain_db:0,fade_in_ms:0,fade_out_ms:0}],transitions:[],music:[],effects:[],target_lufs:-14 as const,maximum_true_peak_dbtp:-1 as const},branding:{mode:'none' as const,wordmark_hashes:[]},disclosures:[{platform:'youtube_shorts' as const,decision:'not_required' as const,rationale:'No altered or synthetic content is used.'}],fixed_seed:'0123456789abcdef'}

  it('binds a render to one platform profile and known sources',()=>{
    expect(RenderManifestV2Schema.parse(render).target_platform).toBe('youtube_shorts')
    expect(AnyRenderManifestSchema.parse(render).schema_version).toBe(2)
    expect(()=>RenderManifestV2Schema.parse({...render,output:{...output,platform:'linkedin'}})).toThrow('output platform must match')
  })

  it('represents audio-only render sources without fake visual dimensions',()=>{
    const audio={source_id:'dialogue-iso',kind:'audio' as const,path:'dialogue.m4a',sha256:H2,duration_ms:1000,width:null,height:null,fps:null,audio_hz:48000,canonical_offset_ms:0}
    const withIso={...render,sources:[...render.sources,audio],audio_plan:{...render.audio_plan,dialogue_source_ids:['dialogue-iso'],dialogue_master_source_id:'dialogue-iso',dialogue_edits:[{...render.audio_plan.dialogue_edits[0]!,source_id:'dialogue-iso'}]}}
    expect(RenderManifestV2Schema.parse(withIso).sources[1]).toMatchObject({kind:'audio',width:null,height:null,fps:null})
    expect(()=>RenderManifestV2Schema.parse({...withIso,sources:[...render.sources,{...audio,width:1,height:1,fps:30}]})).toThrow()
  })

  it('keeps public publishing human-controlled',()=>{
    const draft={schema_version:2 as const,package_id:'package-1',job_id:'job-1',platform:'linkedin' as const,render_manifest_hash:H,master_path:'master.mp4',master_hash:H,captions_path:'captions.srt',captions_hash:H,cover_path:'cover.jpg',cover_hash:H,platform_metadata_path:'platform-metadata.json',platform_metadata_hash:H,titles_path:'titles.txt',titles_hash:H,post_path:'post.txt',post_hash:H,titles:['A title'],description:'Description',post_copy:'Post copy',claim_ledger_path:'claims.json',claim_ledger_hash:H,asset_ledger_path:'assets.json',asset_ledger_hash:H,provenance_path:'provenance.json',provenance_hash:H,disclosure:{platform:'linkedin' as const,decision:'not_required' as const,rationale:'No altered or synthetic content is used.'},delivery:{mode:'local_package' as const,privacy:'not_applicable' as const,public_publish_allowed:false as const},created_at:new Date().toISOString()}
    expect(DraftPackageV2Schema.parse(draft).delivery.public_publish_allowed).toBe(false)
    expect(()=>DraftPackageV2Schema.parse({...draft,delivery:{...draft.delivery,mode:'private_upload',privacy:'private'}})).toThrow('only YouTube')
  })
})
