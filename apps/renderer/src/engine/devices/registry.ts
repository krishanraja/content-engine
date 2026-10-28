import type { DeviceRegistry } from './types'
import { TestGrid } from './test_grid'
import { Device as RecordCard } from './record_card'
import { Device as QueryChip } from './query_chip'
import { Device as EvidenceCard } from './evidence_card'
import { Device as KineticStat } from './kinetic_stat'
import { Device as PassportPage } from './passport_page'

/** Device id (the spec's object.device, config/techniques.json render_adapter) -> component.
 *  Each device card adds exactly one line here. FormatMaster refuses an object whose device is missing. */
export const DEVICES: DeviceRegistry = {
  test_grid: TestGrid,
  record_card: RecordCard,
  query_chip: QueryChip,
  evidence_card: EvidenceCard,
  kinetic_stat: KineticStat,
  passport_page: PassportPage,
}
