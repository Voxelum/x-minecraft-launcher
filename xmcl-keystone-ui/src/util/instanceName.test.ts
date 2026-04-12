import { describe, expect, test } from 'vitest'
import { generateBaseName, generateDistinctName } from './instanceName'
import type { RuntimeVersions } from '@xmcl/instance'

const rt = (overrides: Partial<RuntimeVersions>): RuntimeVersions => ({
  minecraft: '',
  forge: '',
  neoForged: '',
  fabricLoader: '',
  quiltLoader: '',
  optifine: '',
  labyMod: '',
  ...overrides,
})

describe('generateBaseName', () => {
  test('should return minecraft version as base name', () => {
    expect(generateBaseName(rt({ minecraft: '1.20.1' }))).toBe('1.20.1')
  })

  test('should append forge version', () => {
    expect(generateBaseName(rt({ minecraft: '1.20.1', forge: '47.2.0' }))).toBe('1.20.1-forge47.2.0')
  })

  test('should append fabric version', () => {
    expect(generateBaseName(rt({ minecraft: '1.20.1', fabricLoader: '0.14.21' }))).toBe('1.20.1-fabric0.14.21')
  })

  test('should append quilt version', () => {
    expect(generateBaseName(rt({ minecraft: '1.20.1', quiltLoader: '0.19.0' }))).toBe('1.20.1-quilt0.19.0')
  })

  test('should append neoforge version', () => {
    expect(generateBaseName(rt({ minecraft: '1.20.1', neoForged: '20.4.0' }))).toBe('1.20.1-neoforge20.4.0')
  })

  test('should append labymod version', () => {
    expect(generateBaseName(rt({ minecraft: '1.20.1', labyMod: '4.0.0' }))).toBe('1.20.1-labyMod4.0.0')
  })

  test('should append optifine alongside loader', () => {
    expect(generateBaseName(rt({ minecraft: '1.20.1', forge: '47.2.0', optifine: 'HD_U_I6' }))).toBe('1.20.1-forge47.2.0-optifineHD_U_I6')
  })

  test('should only use first matching loader (forge > fabric > quilt > neoForged > labyMod)', () => {
    expect(generateBaseName(rt({ minecraft: '1.20.1', forge: '47.2.0', fabricLoader: '0.14.21' }))).toBe('1.20.1-forge47.2.0')
  })
})

describe('generateDistinctName', () => {
  test('should return base name when no conflicts', () => {
    expect(generateDistinctName('1.20.1', [])).toBe('1.20.1')
    expect(generateDistinctName('1.20.1', ['1.19.4', '1.18.2'])).toBe('1.20.1')
  })

  test('should append -1 when name conflicts', () => {
    expect(generateDistinctName('1.20.1', ['1.20.1'])).toBe('1.20.1-1')
  })

  test('should increment suffix until unique', () => {
    // name accumulates: 1.20.1 -> 1.20.1-1 -> 1.20.1-1-2
    expect(generateDistinctName('1.20.1', ['1.20.1', '1.20.1-1'])).toBe('1.20.1-1-2')
    expect(generateDistinctName('1.20.1', ['1.20.1', '1.20.1-1', '1.20.1-1-2'])).toBe('1.20.1-1-2-3')
  })

  test('should handle empty base name', () => {
    expect(generateDistinctName('', [''])).toBe('-1')
  })
})

/**
 * Test the name validation logic used in StepConfig.vue:
 *   const effectiveName = trimmed || placeHolderName
 *   return !instances.some(i => i.name === effectiveName)
 *
 * When the user leaves the name field empty, the effective name
 * should be the placeholder (generated distinct name), NOT empty string.
 */
describe('instance name validation logic', () => {
  /** Simulates the validation rule from StepConfig.vue */
  function validateName(input: string, placeHolderName: string, instanceNames: string[]): boolean {
    const trimmed = input.trim()
    const effectiveName = trimmed || placeHolderName
    return !instanceNames.some(name => name === effectiveName)
  }

  test('empty input with unique placeholder should be valid', () => {
    // placeholder is "1.20.1" and no instance has that name
    expect(validateName('', '1.20.1', ['my-server', 'test'])).toBe(true)
  })

  test('empty input with conflicting placeholder should be invalid', () => {
    // placeholder is "1.20.1" but an instance already has that name
    expect(validateName('', '1.20.1', ['1.20.1', 'other'])).toBe(false)
  })

  test('whitespace-only input should use placeholder', () => {
    expect(validateName('   ', '1.20.1', ['1.20.1'])).toBe(false)
    expect(validateName('   ', '1.20.1-1', ['1.20.1'])).toBe(true)
  })

  test('non-empty input should validate against actual input, not placeholder', () => {
    expect(validateName('my-instance', '1.20.1', ['1.20.1'])).toBe(true)
    expect(validateName('my-instance', '1.20.1', ['my-instance'])).toBe(false)
  })

  test('input matching placeholder but no conflict should be valid', () => {
    expect(validateName('1.20.1', '1.20.1', [])).toBe(true)
  })

  test('original bug: empty input should NOT conflict with empty-name instances', () => {
    // With the old logic: v.trim() === "" matches instance with name ""  -> false positive!
    // With the fix: effectiveName = placeHolderName = "1.20.1", no conflict -> valid
    expect(validateName('', '1.20.1', [''])).toBe(true)
  })
})
