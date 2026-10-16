import { describe, expect, test } from 'vitest'
import { generateBaseName, generateDistinctName, getEffectiveInstanceName, validateInstanceName } from './instanceName'
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

  test('should prioritize custom modloader version when provided', () => {
    expect(generateBaseName(rt({ minecraft: '1.20.1', forge: '47.4.10' }), '3.1.0-beta.2+26.2')).toBe('1.20.1-3.1.0-beta.2')
  })

  test('should format name with custom modloader metadata from localStorage', () => {
    const store: Record<string, string> = {
      xmcl_user_custom_modloaders: JSON.stringify([
        {
          id: 'connector',
          name: 'Sinytra Connector',
          versions: [{ version: '3.1.0-beta.2+26.2' }],
        },
      ]),
    }
    const orig = (globalThis as any).localStorage
    ;(globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
    }
    try {
      expect(generateBaseName(rt({ minecraft: '1.20.1', forge: '47.4.10' }), '3.1.0-beta.2+26.2')).toBe('1.20.1-Sinytra-Connector-3.1.0-beta.2')
    } finally {
      ;(globalThis as any).localStorage = orig
    }
  })

  test('should format name for Babric when b1.7.3 and fabricLoader are used', () => {
    expect(generateBaseName(rt({ minecraft: 'b1.7.3', fabricLoader: '0.19.5' }))).toBe('b1.7.3-Babric-0.19.5')
  })

  test('should format name for Legacy Fabric when legacy version and fabricLoader are used without localStorage', () => {
    expect(generateBaseName(rt({ minecraft: '1.8.9', fabricLoader: '0.14.21' }))).toBe('1.8.9-Legacy-Fabric-0.14.21')
  })

  test('should format name for Ornithe when ornithe version and fabricLoader are used without localStorage', () => {
    expect(generateBaseName(rt({ minecraft: '1.2.5', fabricLoader: '0.16.10' }))).toBe('1.2.5-Ornithe-0.16.10')
  })

  test('should format name with custom modloader from localStorage when fabricLoader is used', () => {
    const store: Record<string, string> = {
      xmcl_user_custom_modloaders: JSON.stringify([
        {
          id: 'legacy-fabric',
          name: 'Legacy Fabric',
          gameVersions: ['1.13.2'],
          versions: [{ version: '0.14.21' }],
        },
      ]),
    }
    const orig = (globalThis as any).localStorage
    ;(globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
    }
    try {
      expect(generateBaseName(rt({ minecraft: '1.13.2', fabricLoader: '0.14.21' }))).toBe('1.13.2-Legacy-Fabric-0.14.21')
    } finally {
      ;(globalThis as any).localStorage = orig
    }
  })

  test('should format name for any future custom modloader matching by icon or version', () => {
    const store: Record<string, string> = {
      xmcl_user_custom_modloaders: JSON.stringify([
        {
          id: 'future-loader',
          name: 'Future Super Loader',
          icon: 'custom-icon-url-123',
          versions: [{ version: '5.0.0' }],
        },
      ]),
    }
    const orig = (globalThis as any).localStorage
    ;(globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
    }
    try {
      // By fabricLoader
      expect(generateBaseName(rt({ minecraft: '1.21.1', fabricLoader: '5.0.0' }))).toBe('1.21.1-Future-Super-Loader-5.0.0')
      // By icon
      expect(generateBaseName(rt({ minecraft: '1.21.1', neoForged: '21.1.50' }), '', 'custom-icon-url-123')).toBe('1.21.1-Future-Super-Loader-21.1.50')
    } finally {
      ;(globalThis as any).localStorage = orig
    }
  })

  test('should not mistake standard modern Fabric for custom loaders even if Babric/Legacy exist in localStorage', () => {
    const store: Record<string, string> = {
      xmcl_user_custom_modloaders: JSON.stringify([
        {
          id: 'babric',
          name: 'Babric',
          gameVersions: ['b1.7.3', 'b1.7.2'],
          versions: [{ version: '0.19.5' }],
        },
        {
          id: 'legacy-fabric',
          name: 'Legacy Fabric',
          gameVersions: ['1.12.2', '1.8.9'],
          versions: [{ version: '0.16.14' }],
        },
      ]),
    }
    const orig = (globalThis as any).localStorage
    ;(globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
    }
    try {
      // 1.20.1 with fabric 0.19.5 (same version as babric) must remain official fabric!
      expect(generateBaseName(rt({ minecraft: '1.20.1', fabricLoader: '0.19.5' }))).toBe('1.20.1-fabric0.19.5')
      // b1.7.3 with fabric 0.19.5 should be Babric
      expect(generateBaseName(rt({ minecraft: 'b1.7.3', fabricLoader: '0.19.5' }))).toBe('b1.7.3-Babric-0.19.5')
      // 1.12.2 with fabric 0.16.14 should be Legacy Fabric
      expect(generateBaseName(rt({ minecraft: '1.12.2', fabricLoader: '0.16.14' }))).toBe('1.12.2-Legacy-Fabric-0.16.14')
    } finally {
      ;(globalThis as any).localStorage = orig
    }
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
 *   const effectiveName = getEffectiveInstanceName(input, placeHolderName)
 *   return !instances.some(i => i.name === effectiveName)
 *
 * When the user leaves the name field empty, the effective name
 * should be the placeholder (generated distinct name), NOT empty string.
 */
describe('instance name validation logic', () => {
  /** Simulates the validation rule from StepConfig.vue */
  function validateName(input: string, placeHolderName: string, instanceNames: string[]): boolean {
    const effectiveName = getEffectiveInstanceName(input, placeHolderName)
    return effectiveName !== '' && !instanceNames.some(name => name === effectiveName)
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

  test('empty input without a generated placeholder should be invalid', () => {
    expect(validateName('', '', [])).toBe(false)
  })
})

describe('validateInstanceName', () => {
  test('should accept valid names', () => {
    expect(validateInstanceName('my-instance')).toBe(true)
    expect(validateInstanceName('1.20.1-forge47.2.0')).toBe(true)
    expect(validateInstanceName('My Server 2')).toBe(true)
    expect(validateInstanceName('测试实例')).toBe(true)
    expect(validateInstanceName('instance_v2')).toBe(true)
  })

  test('should reject names with invalid characters', () => {
    expect(validateInstanceName('my<instance')).toBe('invalidChars')
    expect(validateInstanceName('my>instance')).toBe('invalidChars')
    expect(validateInstanceName('my:instance')).toBe('invalidChars')
    expect(validateInstanceName('my"instance')).toBe('invalidChars')
    expect(validateInstanceName('my/instance')).toBe('invalidChars')
    expect(validateInstanceName('my\\instance')).toBe('invalidChars')
    expect(validateInstanceName('my|instance')).toBe('invalidChars')
    expect(validateInstanceName('my?instance')).toBe('invalidChars')
    expect(validateInstanceName('my*instance')).toBe('invalidChars')
  })

  test('should reject Windows reserved device names', () => {
    expect(validateInstanceName('CON')).toBe('reservedName')
    expect(validateInstanceName('PRN')).toBe('reservedName')
    expect(validateInstanceName('AUX')).toBe('reservedName')
    expect(validateInstanceName('NUL')).toBe('reservedName')
    expect(validateInstanceName('COM1')).toBe('reservedName')
    expect(validateInstanceName('COM9')).toBe('reservedName')
    expect(validateInstanceName('LPT1')).toBe('reservedName')
    expect(validateInstanceName('con')).toBe('reservedName')
    expect(validateInstanceName('CON.txt')).toBe('reservedName')
  })

  test('should allow names that contain but are not reserved names', () => {
    expect(validateInstanceName('CONTROLLER')).toBe(true)
    expect(validateInstanceName('my-con')).toBe(true)
    expect(validateInstanceName('AUXILIARY')).toBe(true)
  })

  test('should reject path traversal patterns', () => {
    expect(validateInstanceName('..')).toBe('pathTraversal')
    expect(validateInstanceName('../etc')).toBe('pathTraversal')
    expect(validateInstanceName('foo/../bar')).toBe('pathTraversal')
    expect(validateInstanceName('foo\\..\\bar')).toBe('pathTraversal')
  })

  test('should reject whitespace-only or dots-only names', () => {
    expect(validateInstanceName('')).toBe('whitespaceOnly')
    expect(validateInstanceName('   ')).toBe('whitespaceOnly')
    expect(validateInstanceName('...')).toBe('whitespaceOnly')
    expect(validateInstanceName('. .')).toBe('whitespaceOnly')
  })

  test('should reject names ending with dot or space', () => {
    expect(validateInstanceName('instance.')).toBe('trailingDotOrSpace')
    expect(validateInstanceName('instance ')).toBe('trailingDotOrSpace')
  })

  test('should accept names starting with dot (hidden dirs are ok)', () => {
    expect(validateInstanceName('.minecraft')).toBe(true)
  })
})
