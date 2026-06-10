import { describe, test, expect } from 'vitest'
import type { JavaRecord } from '@xmcl/runtime-api'
import { resolvePinChoice, shouldClearPinOnRemove } from './javaPin'

const rec = (path: string): JavaRecord => ({
  path, version: '21', majorVersion: 21, valid: true,
})

describe('resolvePinChoice', () => {
  test('Auto sentinel (empty path) clears the pin', () => {
    expect(resolvePinChoice(rec(''), false, undefined)).toBeUndefined()
  })

  test('undefined value clears the pin', () => {
    expect(resolvePinChoice(undefined, false, undefined)).toBeUndefined()
  })

  test('manual mode → always writes the chosen path', () => {
    expect(resolvePinChoice(rec('/opt/jdk21'), false, '/opt/jdk21')).toBe('/opt/jdk21')
    expect(resolvePinChoice(rec('/opt/jdk17'), false, '/opt/jdk21')).toBe('/opt/jdk17')
  })

  test('auto mode → re-picking the auto-resolved JDK stays on auto', () => {
    // The footgun: user thinks they're confirming auto but actually creates
    // a pin to that exact path.
    expect(resolvePinChoice(rec('/opt/jdk21'), true, '/opt/jdk21')).toBeUndefined()
  })

  test('auto mode → picking a different JDK pins it', () => {
    expect(resolvePinChoice(rec('/opt/jdk17'), true, '/opt/jdk21')).toBe('/opt/jdk17')
  })

  test('auto mode with no auto path resolved yet → picking anything pins it', () => {
    expect(resolvePinChoice(rec('/opt/jdk21'), true, undefined)).toBe('/opt/jdk21')
  })
})

describe('shouldClearPinOnRemove', () => {
  test('pin matches removed → clear', () => {
    expect(shouldClearPinOnRemove('/opt/jdk21', '/opt/jdk21')).toBe(true)
  })

  test('pin differs from removed → keep', () => {
    expect(shouldClearPinOnRemove('/opt/jdk17', '/opt/jdk21')).toBe(false)
  })

  test('no current pin → nothing to clear', () => {
    expect(shouldClearPinOnRemove('/opt/jdk21', undefined)).toBe(false)
    expect(shouldClearPinOnRemove('/opt/jdk21', '')).toBe(false)
  })

  test('no removed path (defensive) → keep', () => {
    expect(shouldClearPinOnRemove(undefined, '/opt/jdk21')).toBe(false)
    expect(shouldClearPinOnRemove('', '/opt/jdk21')).toBe(false)
  })
})
