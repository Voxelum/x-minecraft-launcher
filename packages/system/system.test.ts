import { join } from 'path'
import { openFileSystem } from './index'
import { assert } from 'console'
import { describe, test, expect } from 'vitest'

describe('FileSystem', () => {
  describe('#cd', () => {
    describe('fs', () => {
      test('should be able to cd', async ({ mock: mockRoot }) => {
        const root = join(mockRoot, 'mods')
        const fs = await openFileSystem(root)
        expect(fs.root).toEqual(root)
        fs.cd('abc/bcd')
        expect(fs.root).toEqual(join(root, 'abc/bcd'))
      })
      test('should be able to cd .. in normal fs', async ({ mock: mockRoot }) => {
        const root = join(mockRoot, 'mods')
        const fs = await openFileSystem(root)
        expect(fs.root).toEqual(root)
        fs.cd('..')
        expect(fs.root).toEqual(mockRoot)
      })
    })
    describe('node-zip', () => {
      test('should be able to cd', async ({ mock: mockRoot }) => {
        const root = join(mockRoot, 'mods', 'sample-mod.jar')
        const fs = await openFileSystem(root)
        expect(fs.root).toEqual(root)
        fs.cd('abc/bcd')
        expect(fs.root).toEqual(`${root}/abc/bcd`)
      })
      test('should be able to cd ..', async ({ mock: mockRoot }) => {
        const root = join(mockRoot, 'mods', 'sample-mod.jar')
        const fs = await openFileSystem(root)
        expect(fs.root).toEqual(root)
        fs.cd('abc/bcd')
        fs.cd('..')
        expect(fs.root).toEqual(`${root}/abc`)
      })
      test('should be able to cd .. at root', async ({ mock: mockRoot }) => {
        const root = join(mockRoot, 'mods', 'sample-mod.jar')
        const fs = await openFileSystem(root)
        expect(fs.root).toEqual(root)
        fs.cd('..')
        expect(fs.root).toEqual(root)
      })
      test('should be able to cd .', async ({ mock: mockRoot }) => {
        const root = join(mockRoot, 'mods', 'sample-mod.jar')
        const fs = await openFileSystem(root)
        expect(fs.root).toEqual(root)
        fs.cd('.')
        expect(fs.root).toEqual(root)
      })

      test('should be able to cd ./abc', async ({ mock: mockRoot }) => {
        const root = join(mockRoot, 'mods', 'sample-mod.jar')
        const fs = await openFileSystem(root)
        expect(fs.root).toEqual(root)
        fs.cd('./abc')
        expect(fs.root).toEqual(`${root}/abc`)
      })

      test('should be able to cd ../abc', async ({ mock: mockRoot }) => {
        const root = join(mockRoot, 'mods', 'sample-mod.jar')
        const fs = await openFileSystem(root)
        expect(fs.root).toEqual(root)
        fs.cd('bcd/xyz')
        fs.cd('../abc')
        expect(fs.root).toEqual(`${root}/bcd/abc`)
      })

      test('should be able to cd /zzzz/abc', async ({ mock: mockRoot }) => {
        const root = join(mockRoot, 'mods', 'sample-mod.jar')
        const fs = await openFileSystem(root)
        expect(fs.root).toEqual(root)
        fs.cd('bcd/xyz')
        fs.cd('/zzzz/abc')
        expect(fs.root).toEqual(`${root}/zzzz/abc`)
      })
    })
  })
  describe('#listFiles', () => {
    test('should list file in jar', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'mods', 'sample-mod.jar'))
      const files = await fs.listFiles('/')
      expect(files).toEqual(['Config.class', 'mcmod.info', 'NuclearCraft.class'])
    })
    test('should list file in litemods', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'mods', 'sample-mod.litemod'))
      const files = await fs.listFiles('/')
      expect(files).toEqual(['META-INF', 'com', 'assets', 'litemod.json'])
    })
    test('should list file in zip', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', 'sample-resourcepack.zip'))
      const files = await fs.listFiles('/')
      expect(files).toEqual(['pack.mcmeta', 'pack.png'])
    })
    test('should list nested file in zip', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      const files = await fs.listFiles('assets')
      expect(files).toEqual(['.mcassetsroot', 'minecraft', 'realms'])
    })
  })
  describe('#missingFile', () => {
    test('should detect missing file', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      await expect(fs.missingFile('assetss')).resolves.toBeTruthy()
    })
    test('should detect non-missing file', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      await expect(fs.missingFile('assets')).resolves.toBeFalsy()
    })
  })
  describe('#existsFile', () => {
    test('should detect missing file', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      await expect(fs.existsFile('assetss')).resolves.toBeFalsy()
    })
    test('should detect non-missing file', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      await expect(fs.existsFile('assets')).resolves.toBeTruthy()
    })
  })
  describe('#walkFiles', () => {
    test('should walk every files in folder', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks'))
      const paths: string[] = []
      await fs.walkFiles('/', (path) => {
        paths.push(path)
      })
      expect(paths).toHaveLength(5)
    })
    test('should walk every files in zip', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      const paths: string[] = []
      await fs.walkFiles('/', (path) => {
        paths.push(path)
      })
      expect(paths).toEqual([
        'assets/.mcassetsroot',
        'assets/minecraft/blockstates/grass_block.json',
        'assets/minecraft/models/block/block.json',
        'assets/minecraft/models/block/grass_block.json',
        'assets/minecraft/models/block/grass_block_snow.json',
        'assets/minecraft/shaders/post/antialias.json',
        'assets/minecraft/shaders/program/antialias.fsh',
        'assets/minecraft/shaders/program/antialias.json',
        'assets/minecraft/textures/block/dirt.png',
        'assets/minecraft/textures/block/grass_block_side.png',
        'assets/minecraft/textures/block/grass_block_side_overlay.png',
        'assets/minecraft/textures/block/grass_block_snow.png',
        'assets/minecraft/textures/block/grass_block_top.png',
        'data/.mcassetsroot',
        'data/minecraft/recipes/bookshelf.json',
      ])
    })
  })
  describe('#isDirectory', () => {
    test('should identify dir on root', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      await expect(fs.isDirectory('assets')).resolves.toBeTruthy()
    })
    test('should identify nested dir', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      await expect(fs.isDirectory('assets/minecraft')).resolves.toBeTruthy()
    })
    test('should identify nested file', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      await expect(fs.isDirectory('assets/.mcassetsroot')).resolves.toBeFalsy()
    })
    test('should identify wrong nested dir', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      await expect(fs.isDirectory('assets/.mcas')).resolves.toBeFalsy()
    })
    test('should identify wrong nested file', async ({ mock: mockRoot }) => {
      const fs = await openFileSystem(join(mockRoot, 'resourcepacks', '1.14.4.zip'))
      await expect(fs.isDirectory('assets/.mcassetsrootxxx')).resolves.toBeFalsy()
    })
  })
})
