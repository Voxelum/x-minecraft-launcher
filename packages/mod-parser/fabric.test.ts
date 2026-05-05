import * as path from 'path'
import { readFabricMod } from './fabric'
import { describe, test, expect } from 'vitest'
import { openFileSystem } from '@xmcl/system'

describe('Fabric', () => {
  describe('#readFabricMod', () => {
    test('should read the simple fabric json', async ({ mock }) => {
      const mod = await readFabricMod(path.join(mock, 'mods', 'fabric-sample.jar'))
      expect(mod).toBeTruthy()
      expect(mod).toEqual({
        schemaVersion: 1,
        id: 'appleskin',
        version: '1.0.8',
        name: 'AppleSkin',
        description: 'Adds various food-related HUD improvements',
        authors: ['squeek502'],
        contact: {
          sources: 'https://github.com/squeek502/AppleSkin',
          homepage: 'https://minecraft.curseforge.com/projects/appleskin',
          issues: 'https://github.com/squeek502/AppleSkin/issues',
        },
        license: 'Unlicense',
        icon: 'assets/appleskin/appleskin.png',
        environment: '*',
        entrypoints: { client: ['squeek.appleskin.AppleSkin'] },
        mixins: ['appleskin.mixins.json'],
        depends: { fabricloader: '>=0.4.0', fabric: '*' },
      })
    })
    test('should not close if the fs is the input', async ({ mock }) => {
      const fs = await openFileSystem(path.join(mock, 'mods', 'fabric-sample.jar'))
      const mod = await readFabricMod(fs)
      expect(fs.isClosed()).toBe(false)
    })
  })
})
