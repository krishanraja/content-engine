import { describe, expect, it } from 'vitest'
import { checkVideoEngineTrigger, shouldLaunchVideoEngine, VIDEO_ENGINE_TRIGGER_CASES } from '../scripts/check-video-engine-trigger'

describe('Video Engine launcher trigger', () => {
  it.each(VIDEO_ENGINE_TRIGGER_CASES)('$label', ({ message, userMessageIndex, expected }) => {
    expect(shouldLaunchVideoEngine({ message, userMessageIndex })).toBe(expected)
  })

  it('keeps the repo skill and UI metadata aligned with the executable contract', async () => {
    await expect(checkVideoEngineTrigger()).resolves.toBeUndefined()
  })
})
