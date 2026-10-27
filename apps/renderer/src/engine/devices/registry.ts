import type { DeviceRegistry } from './types'

/** Device id (the spec's object.device, config/techniques.json render_adapter) -> component.
 *  Each device card adds exactly one line here. FormatMaster refuses an object whose device is missing. */
export const DEVICES: DeviceRegistry = {}
