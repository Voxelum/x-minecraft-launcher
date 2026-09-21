import { Version } from '@xmcl/core'
import type { JavaRecord } from '@xmcl/runtime-api'
import { describe, expect, test, vi } from 'vitest'
import { getJavaPathOrInstall } from './instanceVersionInstall'

vi.mock('@/telemetry', () => ({
  isRuntimeServiceError: vi.fn(),
  trackRendererException: vi.fn(),
}))

describe('getJavaPathOrInstall', () => {
  const resolved = Version.resolve('minecraft', [Version.normalizeVersionJson(JSON.stringify({
    id: 'GTNH',
    clientVersion: '1.7.10',
    mainClass: 'com.gtnewhorizons.retrofuturabootstrap.Main',
    compatibleJavaMajors: [17, 21, 23, 24, 25],
    libraries: [],
  }), 'minecraft')])
  const java = (majorVersion: number): JavaRecord => ({
    path: `/java${majorVersion}`,
    version: `${majorVersion}.0.1`,
    majorVersion,
    valid: true,
  })

  test('does not install Java 17 when compatible Java 21 is already available', () => {
    expect(getJavaPathOrInstall([], [java(8), java(21)], resolved, 'instance')).toBe('/java21')
  })

  test('requests Java 17 instead of accepting Java 8', () => {
    expect(getJavaPathOrInstall([], [java(8)], resolved, 'instance')).toEqual({
      component: 'java-runtime-gamma', majorVersion: 17,
    })
  })
})
