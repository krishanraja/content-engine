import type React from 'react'
import type { EngineEvent, EngineObject, EngineTokens } from '../props'

/** A layout slot in frame pixels (see ../layouts). */
export interface Box { left: number; top: number; width: number; height: number }

export interface DeviceProps {
  object: EngineObject
  events: readonly EngineEvent[]
  box: Box
  tokens: EngineTokens
  aspect: '9:16' | '16:9'
  frame: number
}

export type DeviceComponent = (props: DeviceProps) => React.ReactElement | null

/** devices/registry.ts maps a device id (config/techniques.json render_adapter) to its component. */
export type DeviceRegistry = Readonly<Record<string, DeviceComponent>>
