import { readLiteloaderMod } from './liteloader'
import { describe, test, expect } from 'vitest'

describe('Liteloader', () => {
  describe('#meta', () => {
    test('should not be able to read other file', async ({ mock }) => {
      await expect(readLiteloaderMod(`${mock}/mods/sample-mod.jar`)).rejects.toHaveProperty(
        'name',
        'IllegalInputType',
      )
      await expect(readLiteloaderMod(`${mock}/saves/sample-map.zip`)).rejects.toHaveProperty(
        'name',
        'IllegalInputType',
      )
      await expect(
        readLiteloaderMod(`${mock}/resourcepacks/sample-resourcepack.zip`),
      ).rejects.toHaveProperty('name', 'IllegalInputType')
      await expect(readLiteloaderMod(`${mock}/not-exist.zip`)).rejects.toBeTruthy()
    })
    test('should be able to parse liteloader info', async ({ mock }) => {
      const metadata = await readLiteloaderMod(`${mock}/mods/sample-mod.litemod`)
      if (!metadata) {
        throw new Error('Should not happen')
      }
      expect(metadata.name).toEqual('ArmorsHUDRevived')
      expect(metadata.mcversion).toEqual('1.12.r2')
      expect(metadata.revision).toEqual(143)
      expect(metadata.author).toEqual('Shadow_Hawk')
    })
  })
})
