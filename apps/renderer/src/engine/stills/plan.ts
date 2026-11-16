import { CAPTION_THEMES } from '../captions/names'
export type Layer = 'motion' | 'treatment' | 'captions'
export type Zone = {name:string; x0:number; y0:number; x1:number; y1:number}
export const MOTION_IDS = ['ai-music-slam','character-ai-receipts','eating-jobs-ladder','dark-keynote','data-story','full-visual','hud-terminal','line-boil','living-ui','paper-cutout','riso-halftone','single-line-drawing','swiss-kinetic-type','vertical-captions'] as const
export const TREATMENT_IDS = ['face-with-proof','voice-led-pictures','data-story','fry-talking-head','scoreboard-test','kinetic-movement','receipt-animation'] as const
// Each line is a different editorial moment from the two approved stories.
const beats = [
 'SINGING STILL IN','60 TRILLION TOKENS','COUNT WHAT GOT DONE','7%','200 → 100','WHO DID WHICH BIT?',
 '31% JUNK','A CENT A RAT TAIL','I’m movin’ to the sun','SONGWRITING RULED OUT','AI MUSIC / HUMAN MUSIC',
 'TikTok came first','AI IS ALREADY IN THE MUSIC YOU LOVE','a robot humming underneath',
 'AI didn’t help here','Hanoi paid for tails','The thin AI layer','The rat-tail problem','TikTok or the charts?',
 'HALF THE TARGET','THE BILL IS NOT THE WORK',
 'all over TikTok','a Reiki healer','her own lyrics','pressed a button','a whole song','cats and weddings','dads dancing badly',
 'strangers went hunting','a top producer','rebuilt by hand','Ultra Naté','under her voice','still compete for singing',
 'already both','in 1902','afraid of plague','hand in the tail','very much alive','rat farms','Token Legend','Cache Wizard',
 'the board went dark','unnecessary tasks','three companies backed down','useful queries stayed','nine in ten','sales went up',
] as const
const layouts = ['stage-1236-cream-band','desk-portrait-band','hero-216-object-580','sweep-monolith','zero-axis-diptych','exploded-audio-lanes','locked-terminal','boiling-tail-poster','zoomed-lyrics-field','torn-verdict-collage','offset-print-disc','continuous-causal-route','twelve-column-editorial','vertical-voice-wave',
 'proof-window-triptych','hanoi-panorama','provenance-section','question-portrait-space','chart-race-scoreboard','diagonal-target-crash','long-perforated-bill']
const types = ['Anton tilted verdict','Plex receipt columns','Anton counter above object','Anton 800px numeral','Plex axis + Anton delta','Archivo lane hierarchy','Plex locked value','handwritten serif marginalia','Archivo form zoom','slab serif paper stamp','bold grotesk spot-print','Plex causal labels','Anton grid headline','Archivo voice ladder','serif question + mono proof','serif panorama caption','mono provenance taxonomy','Fraunces conversational question','condensed ranked figures','Anton diagonal command','Plex itemised bill']
export function stillIds(): {layer:Layer; id:string}[] {
 return [...MOTION_IDS.map(id=>({layer:'motion' as const,id})), ...TREATMENT_IDS.map(id=>({layer:'treatment' as const,id})), ...CAPTION_THEMES.map(id=>({layer:'captions' as const,id}))]
}
export function coverPlan(layer:Layer,id:string) {
 const index=stillIds().findIndex(s=>s.layer===layer&&s.id===id)
 if(index<0) throw new Error(`Unknown StyleStill ${layer}/${id}`)
 const caption=index>=21, n=index-21
 return {scene:beats[index]!, beat:beats[index]!, layout:caption?`caption-${id}-backdrop-${n}`:layouts[index]!,
 type:caption?`${id} native caption`:types[index]!, palette:`ink-${index}`,
 zones:caption ? [{name:'device',x0:0,y0:0,x1:1080,y1:540},{name:'caption',x0:0,y0:550,x1:1080,y1:1360},{name:'device',x0:0,y0:1400,x1:1080,y1:1920}] : [{name:'device',x0:0,y0:0,x1:1080,y1:1920}] }
}
