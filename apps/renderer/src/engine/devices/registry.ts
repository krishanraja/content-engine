import { Device as HandPhoneStage } from './hand_phone_stage'
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
