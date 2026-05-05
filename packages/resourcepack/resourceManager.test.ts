import { ResourceManager } from './resourceManager'
import { join } from 'path'
import { ResourcePack, ResourceLocation } from './resourcePack'
import { ModelLoader } from './modelLoader'
import { describe, test, expect, vi } from 'vitest'

const mock = join(__dirname, '..', '..', 'mock')

describe('ResourceLocation', () => {
  describe('#ofModelPath', () => {
    test('default', () => {
      const l = ResourceLocation.ofModelPath('block/grass')
      expect(l.domain).toEqual('minecraft')
      expect(l.path).toEqual('models/block/grass.json')
    })
    test('custom domain', () => {
      const l = ResourceLocation.ofModelPath('my-modid:block/grass')
      expect(l.domain).toEqual('my-modid')
      expect(l.path).toEqual('models/block/grass.json')
    })
  })
  describe('#ofTexturePath', () => {
    test('default', () => {
      const l = ResourceLocation.ofTexturePath('block/grass')
      expect(l.domain).toEqual('minecraft')
      expect(l.path).toEqual('textures/block/grass.png')
    })
    test('custom domain', () => {
      const l = ResourceLocation.ofTexturePath('my-modid:block/grass')
      expect(l.domain).toEqual('my-modid')
      expect(l.path).toEqual('textures/block/grass.png')
    })
  })
  describe('#ofPath', () => {
    test('default', () => {
      const l = ResourceLocation.fromPath('some/block/image.png')
      expect(l.domain).toEqual('minecraft')
      expect(l.path).toEqual('some/block/image.png')
    })
    test('custom domain', () => {
      const l = ResourceLocation.fromPath('my-modid:some/block/image.png')
      expect(l.domain).toEqual('my-modid')
      expect(l.path).toEqual('some/block/image.png')
    })
  })
  test('#getAssetsPath', () => {
    const path = ResourceLocation.getAssetsPath({ domain: 'modid', path: 'path/to/file' })
    expect(path).toEqual('assets/modid/path/to/file')
  })
})

describe('ResourceManager', () => {
  test('#addResourceSource', async () => {
    const man = new ResourceManager()
    const dummy: any = {
      info() {
        return {}
      },
      domains() {
        return []
      },
    }
    await man.addResourcePack(dummy)
    expect(man.allResourcePacks).toHaveLength(1)
    expect(man.allResourcePacks[0]).toEqual({})
  })
  describe('#get', () => {
    test('should get the resource', async () => {
      const man = new ResourceManager()
      const dummy: any = {
        info() {
          return {}
        },
        domains() {
          return []
        },
        get() {
          return { location: { domain: 'a', path: 'b' } }
        },
      }
      await man.addResourcePack(dummy)
      await expect(man.get(ResourceLocation.fromPath('abc'))).resolves.toEqual({
        location: { domain: 'a', path: 'b' },
      })
    })
    test('should return empty if resource not found', async () => {
      const man = new ResourceManager()
      const dummy: any = {
        info() {
          return {}
        },
        domains() {
          return []
        },
        get() {
          return undefined
        },
      }
      await man.addResourcePack(dummy)
      await expect(man.get(ResourceLocation.fromPath('abc'))).resolves.toEqual(undefined)
    })
    test('should iterate resource sources from back to front', async () => {
      const man = new ResourceManager()
      const srcA: any = {
        info() {
          return {}
        },
        domains() {
          return []
        },
        get(r: any) {
          return { location: { domain: 'a', path: 'a' } }
        },
      }
      const srcB: any = {
        info() {
          return {}
        },
        domains() {
          return []
        },
        get(r: any) {
          return { location: { domain: 'b', path: 'b' } }
        },
      }
      await man.addResourcePack(srcA)
      await man.addResourcePack(srcB)
      await expect(man.get(ResourceLocation.fromPath('abc'))).resolves.toEqual({
        location: { domain: 'b', path: 'b' },
      })
    })
  })

  test('#clear', async () => {
    const man = new ResourceManager()
    const monitor = vi.fn()
    const dummy: any = {
      info() {
        return {}
      },
      domains() {
        return []
      },
      get(r: any) {
        monitor()
        return { location: r }
      },
    }
    await man.addResourcePack(dummy)
    await man.get({ domain: 'a', path: 'b' })
    man.clear()
    const result = await man.get({ domain: 'a', path: 'b' })
    expect(result).toBeUndefined()
    expect(monitor).toBeCalledTimes(1)
  })
  test('#swap', async () => {
    const man = new ResourceManager()
    const monitor = vi.fn()
    const dummy: any = {
      info() {
        return 'A'
      },
      domains() {
        return []
      },
      get(r: any) {
        monitor()
        return { location: r }
      },
    }
    const dummyB: any = {
      info() {
        return 'B'
      },
      domains() {
        return []
      },
      get(r: any) {
        monitor()
        return { location: r }
      },
    }
    await man.addResourcePack(dummy)
    await man.addResourcePack(dummyB)

    expect(man.allResourcePacks).toEqual(['A', 'B'])
    man.swap(0, 1)
    expect(man.allResourcePacks).toEqual(['B', 'A'])
  })
})

describe('ModelLoader', () => {
  describe('#loadModel', () => {
    test('should load grass block model', async () => {
      const man = new ResourceManager()
      await man.addResourcePack(await ResourcePack.open(join(mock, 'resourcepacks', '1.14.4.zip')))
      const loader = new ModelLoader(man)
      const model = await loader.loadModel('block/grass_block')
      expect(model).toBeTruthy()
      expect(model.textures).toEqual({
        particle: 'block/dirt',
        bottom: 'block/dirt',
        top: 'block/grass_block_top',
        side: 'block/grass_block_side',
        overlay: 'block/grass_block_side_overlay',
      })
      expect(model.display).toBeTruthy()
      expect(model.elements).toBeTruthy()

      expect(loader.textures['block/grass_block_side_overlay']).toBeTruthy()
      expect(loader.textures['block/grass_block_side']).toBeTruthy()
      expect(loader.textures['block/dirt']).toBeTruthy()
    })
  })
})
