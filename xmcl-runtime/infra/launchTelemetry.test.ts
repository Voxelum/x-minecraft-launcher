import { describe, expect, it } from 'vitest'
import { getMinecraftExitTelemetry, getMinecraftStartTelemetry } from './launchTelemetry'

describe('launch telemetry', () => {
  it('keeps launch lifecycle properties low-cardinality and privacy-safe', () => {
    const input = {
      side: 'client' as const,
      minecraft: '1.21.4',
      fabricLoader: '0.16.10',
      server: { host: 'private.example.com' },
      preExecuteCommand: 'secret-command',
      gameDirectory: 'C:\\Users\\private\\instance',
      env: { ACCESS_TOKEN: 'secret' },
      user: { username: 'private-user' },
    }

    expect(getMinecraftStartTelemetry(input)).toEqual({
      side: 'client',
      minecraft: '1.21.4',
      loader: 'fabric',
      hasServerTarget: true,
      hasPreExecuteCommand: true,
    })
  })

  it('classifies game exits without attaching crash reports', () => {
    expect(getMinecraftExitTelemetry({ code: 1, crashReport: 'sensitive report' })).toEqual({
      outcome: 'crash',
      exitCode: 1,
      signal: 'none',
      hasCrashReport: true,
    })
  })
})
