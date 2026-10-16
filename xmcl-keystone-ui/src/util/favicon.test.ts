import { describe, expect, test } from 'vitest'
import { getInstanceIcon } from './favicon'
import { BuiltinImages } from '@/constant'
import { KNOWN_LOADER_ICONS } from '@/composables/modloaderCustom'
import type { InstanceData } from '@xmcl/instance'

const createMockInstance = (overrides: Partial<InstanceData> = {}): InstanceData => ({
  name: 'Test',
  path: '/test',
  version: '',
  runtime: {
    minecraft: '1.20.1',
    forge: '',
    fabricLoader: '',
    neoForged: '',
    quiltLoader: '',
    optifine: '',
    labyMod: '',
  },
  server: null,
  icon: '',
  edition: 'java',
  ...overrides,
} as InstanceData)

describe('getInstanceIcon', () => {
  test('should return official fabric icon for modern Minecraft with fabricLoader', () => {
    const inst = createMockInstance({
      runtime: {
        minecraft: '1.20.1',
        fabricLoader: '0.19.5',
      } as any,
    })
    expect(getInstanceIcon(inst, undefined)).toBe(BuiltinImages.fabric)
  })

  test('should return Legacy Fabric icon for 1.12.2 with fabricLoader', () => {
    const inst = createMockInstance({
      runtime: {
        minecraft: '1.12.2',
        fabricLoader: '0.16.14',
      } as any,
    })
    expect(getInstanceIcon(inst, undefined)).toBe(KNOWN_LOADER_ICONS['legacy-fabric'])
  })

  test('should return Babric icon for b1.7.3 with fabricLoader', () => {
    const inst = createMockInstance({
      runtime: {
        minecraft: 'b1.7.3',
        fabricLoader: '0.19.5',
      } as any,
    })
    expect(getInstanceIcon(inst, undefined)).toBe(KNOWN_LOADER_ICONS['babric'])
  })

  test('should ignore stale custom loader icon if instance is running pure Fabric', () => {
    const connectorIcon = 'https://cdn.modrinth.com/data/u58R1TMW/icon.webp'
    const store: Record<string, string> = {
      xmcl_user_custom_modloaders: JSON.stringify([
        {
          id: 'connector',
          name: 'Sinytra Connector',
          icon: connectorIcon,
          gameVersions: ['1.20.1'],
          versions: [{ version: '3.1.0-beta.2+26.2' }],
        },
      ]),
    }
    const mockStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
    }
    const origGlobal = (globalThis as any).localStorage
    ;(globalThis as any).localStorage = mockStorage
    if (typeof window !== 'undefined') {
      ;(window as any).localStorage = mockStorage
    }
    try {
      const inst = createMockInstance({
        icon: connectorIcon,
        version: '1.20.1-fabric0.19.5',
        runtime: {
          minecraft: '1.20.1',
          fabricLoader: '0.19.5',
        } as any,
      })
      // Since it is running pure Fabric and version does not match Connector's version, it should recover to official fabric
      expect(getInstanceIcon(inst, undefined)).toBe(BuiltinImages.fabric)
    } finally {
      ;(globalThis as any).localStorage = origGlobal
      if (typeof window !== 'undefined') {
        ;(window as any).localStorage = origGlobal
      }
    }
  })

  test('should return Ornithe icon for 1.2.5 with fabricLoader', () => {
    const inst = createMockInstance({
      runtime: {
        minecraft: '1.2.5',
        fabricLoader: '0.16.10',
      } as any,
    })
    expect(getInstanceIcon(inst, undefined)).toBe(KNOWN_LOADER_ICONS['ornithe'])
  })

  test('should recover from stale Babric icon if instance was switched to pure Fabric', () => {
    const inst = createMockInstance({
      icon: KNOWN_LOADER_ICONS['babric'],
      runtime: {
        minecraft: '1.20.1',
        fabricLoader: '0.15.11',
      } as any,
    })
    expect(getInstanceIcon(inst, undefined)).toBe(BuiltinImages.fabric)
  })

  test('should recover from stale Forge icon if instance was switched to pure Fabric', () => {
    const inst = createMockInstance({
      icon: BuiltinImages.forge,
      runtime: {
        minecraft: '1.20.1',
        fabricLoader: '0.15.11',
      } as any,
    })
    expect(getInstanceIcon(inst, undefined)).toBe(BuiltinImages.fabric)
  })

  test('should preserve custom user-uploaded icon when not a loader icon', () => {
    const userIcon = 'image://user/custom-avatar.png'
    const inst = createMockInstance({
      icon: userIcon,
      runtime: {
        minecraft: '1.20.1',
        fabricLoader: '0.19.5',
      } as any,
    })
    expect(getInstanceIcon(inst, undefined)).toBe(userIcon)
  })

  test('should return correct icons for all default modloaders when icon is empty or corrupted', () => {
    const forgeInst = createMockInstance({
      icon: 'http://launcher/media?path=/assets/forge.webp',
      runtime: { minecraft: '1.20.1', forge: '47.2.0' } as any,
    })
    expect(getInstanceIcon(forgeInst, undefined)).toBe(BuiltinImages.forge)

    const neoInst = createMockInstance({
      icon: '',
      runtime: { minecraft: '1.20.4', neoForged: '20.4.80' } as any,
    })
    expect(getInstanceIcon(neoInst, undefined)).toBe(BuiltinImages.neoForged)

    const quiltInst = createMockInstance({
      icon: '/assets/quilt.svg',
      runtime: { minecraft: '1.20.1', quiltLoader: '0.25.0' } as any,
    })
    expect(getInstanceIcon(quiltInst, undefined)).toBe(BuiltinImages.quilt)

    const optifineInst = createMockInstance({
      icon: '',
      runtime: { minecraft: '1.12.2', optifine: 'HD_U_G5' } as any,
    })
    expect(getInstanceIcon(optifineInst, undefined)).toBe(BuiltinImages.optifine)

    const labyInst = createMockInstance({
      icon: 'http://launcher/media?path=/assets/labymod.webp',
      runtime: { minecraft: '1.20.1', labyMod: '4.1.0' } as any,
    })
    expect(getInstanceIcon(labyInst, undefined)).toBe(BuiltinImages.labyMod)

    const vanillaInst = createMockInstance({
      icon: '',
      runtime: { minecraft: '1.20.1' } as any,
    })
    expect(getInstanceIcon(vanillaInst, undefined)).toBe(BuiltinImages.minecraft)
  })
})
