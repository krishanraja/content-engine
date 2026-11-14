import { Device as LivingScreen } from './living_screen'
import { Device as LadderStage } from './ladder_stage'
import { Device as QuotaChart } from './quota_chart'
import { Device as AgentSwarm } from './agent_swarm'
import { Device as WallScreen } from './wall_screen'
import { Device as Arrangement } from './arrangement'
import { Device as SlotMachine } from './slot_machine'
import { Device as UploadFlood } from './upload_flood'
import { Device as Leaderboard } from './leaderboard'
import { Device as OfficeFloor } from './office_floor'
import { Device as LogoOrbit } from './logo_orbit'
import { Device as TypingBubble } from './typing_bubble'
import { Device as CursorBuddy } from './cursor_buddy'
import { Device as LogoCard } from './logo_card'
import { Device as HandPhoneStage } from './hand_phone_stage'
import { Device as SlamWord } from './slam_word'
import type { DeviceRegistry } from './types'
import { TestGrid } from './test_grid'
import { Device as RecordCard } from './record_card'
import { Device as QueryChip } from './query_chip'
import { Device as EvidenceCard } from './evidence_card'
import { Device as KineticStat } from './kinetic_stat'
import { Device as ThreadCard } from './thread_card'
import { Device as PassportPage } from './passport_page'
import { Device as Scribble } from './scribble'
import { Device as Headline } from './headline'
import { Device as Sticker } from './sticker'
import { Device as Stamp } from './stamp'
import { Device as StatStrip } from './stat_strip'
import { Device as Marquee } from './marquee'
import { Device as QuoteCard } from './quote_card'

/** Device id (the spec's object.device, config/techniques.json render_adapter) -> component.
 *  Each device card adds exactly one line here. FormatMaster refuses an object whose device is missing. */
export const DEVICES: DeviceRegistry = {
  slam_word: SlamWord,
  living_screen: LivingScreen,
  ladder_stage: LadderStage,
  quota_chart: QuotaChart,
  agent_swarm: AgentSwarm,
  wall_screen: WallScreen,
  arrangement: Arrangement,
  slot_machine: SlotMachine,
  upload_flood: UploadFlood,
  leaderboard: Leaderboard,
  office_floor: OfficeFloor,
  typing_bubble: TypingBubble,
  cursor_buddy: CursorBuddy,
  logo_card: LogoCard,
  logo_orbit: LogoOrbit,
  headline: Headline,
  sticker: Sticker,
  stamp: Stamp,
  stat_strip: StatStrip,
  marquee: Marquee,
  quote_card: QuoteCard,
  hand_phone_stage: HandPhoneStage,
  test_grid: TestGrid,
  record_card: RecordCard,
  query_chip: QueryChip,
  evidence_card: EvidenceCard,
  kinetic_stat: KineticStat,
  thread_card: ThreadCard,
  passport_page: PassportPage,
  scribble: Scribble,
}
