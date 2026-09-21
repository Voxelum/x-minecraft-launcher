import { describe, expect, test } from 'vitest'
import { getCompatibleJavaVersion } from './java'

describe('getCompatibleJavaVersion', () => {
  test('selects a supported downloadable runtime for GTNH instead of Java 8', () => {
    expect(getCompatibleJavaVersion([25, 17, 21, 23, 24], {
      component: 'jre-legacy', majorVersion: 8,
    })).toEqual({ component: 'java-runtime-gamma', majorVersion: 17 })
  })

  test('preserves an explicitly recommended compatible runtime', () => {
    const preferred = { component: 'java-runtime-delta', majorVersion: 21 }
    expect(getCompatibleJavaVersion([17, 21, 25], preferred)).toBe(preferred)
  })

  test('chooses a downloadable allowed major rather than an unsupported lower major', () => {
    expect(getCompatibleJavaVersion([23, 25])).toEqual({
      component: 'java-runtime-epsilon', majorVersion: 25,
    })
  })

  test('does not substitute an incompatible downloadable major', () => {
    expect(getCompatibleJavaVersion([23])).toEqual({ component: '', majorVersion: 23 })
  })

  test.each([[], [0], [-1], [17.5], [NaN]])('rejects invalid compatibility metadata %j', (majors) => {
    expect(() => getCompatibleJavaVersion(majors)).toThrow('compatibleJavaMajors')
  })
})
