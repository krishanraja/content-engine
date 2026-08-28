import { describe, expect, it } from 'vitest'
import { classifyError } from '@mindmake/core'

describe('stable CLI error categories', () => {
  it('separates policy, external, media, and state failures', () => {
    expect(classifyError(new Error('hard editorial block cannot be overridden')).exitCode).toBe(20)
    expect(classifyError(new Error('YouTube upload failed')).exitCode).toBe(30)
    expect(classifyError(new Error('ffmpeg failed')).exitCode).toBe(40)
    expect(classifyError(new Error('job artifact is missing')).exitCode).toBe(50)
  })
})
