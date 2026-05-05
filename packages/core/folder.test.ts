import { sep } from 'path'
import { MinecraftFolder } from '.'
import { describe, test, expect } from 'vitest'

describe('MinecraftFolder', () => {
  const mc = new MinecraftFolder('root')
  test('It should get the basic path according to root', () => {
    expect(mc.root).toBe('root')
    expect(mc.getAsset('aabbbb')).toBe('root/assets/objects/aa/aabbbb'.replace(/\//g, sep))
    expect(mc.getAssetsIndex('1.2')).toBe('root/assets/indexes/1.2.json'.replace(/\//g, sep))
    expect(mc.getMod('test.jar')).toBe('root/mods/test.jar'.replace(/\//g, sep))
    expect(mc.getResourcePack('test.zip')).toBe('root/resourcepacks/test.zip'.replace(/\//g, sep))
    expect(mc.getVersionJar('1.12')).toBe('root/versions/1.12/1.12.jar'.replace(/\//g, sep))
    expect(mc.getVersionJson('1.12')).toBe('root/versions/1.12/1.12.json'.replace(/\//g, sep))
    expect(mc.getVersionRoot('1.12')).toBe('root/versions/1.12'.replace(/\//g, sep))
    expect(mc.getLog('somelog.txt')).toBe('root/logs/somelog.txt'.replace(/\//g, sep))
    expect(mc.getNativesRoot('1.12')).toBe('root/versions/1.12/1.12-natives'.replace(/\//g, sep))
    expect(mc.getMapIcon('somemap')).toBe('root/saves/somemap/icon.png'.replace(/\//g, sep))
    expect(mc.getMapInfo('somemap')).toBe('root/saves/somemap/level.dat'.replace(/\//g, sep))
  })
})
