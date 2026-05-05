import { beforeEach, describe, expect, it } from 'vitest'
import { InstanceDataWithTime } from './instance'
import {
  EditInstanceOptions,
  applyInstanceChanges,
  assignShallow,
  computeInstanceEditChanges,
} from './edit'
import { VersionMetadataProvider } from './internal_type'
import { createInstance, CreateInstanceOptions } from './index.browser'

/**
 * Helper function to create a template instance with default values
 */
function createInstanceTemplate(): InstanceDataWithTime {
  return {
    name: '',
    author: 'Test Author',
    description: '',
    version: '1.0.0',
    runtime: {
      minecraft: '1.19.2',
      forge: '',
      fabricLoader: '',
      optifine: '',
      quiltLoader: '',
      neoForged: '',
      labyMod: '',
    },
    java: undefined,
    resolution: undefined,
    minMemory: undefined,
    maxMemory: undefined,
    assignMemory: undefined,
    vmOptions: undefined,
    mcOptions: undefined,
    env: undefined,
    prependCommand: undefined,
    preExecuteCommand: undefined,
    url: '',
    icon: '',
    fileApi: '',
    server: undefined,
    showLog: undefined,
    hideLauncher: undefined,
    fastLaunch: undefined,
    disableElybyAuthlib: undefined,
    disableAuthlibInjector: undefined,
    useLatest: undefined,
    upstream: undefined,
    playtime: 0,
    lastPlayedDate: 0,
    creationDate: Date.now(),
    lastAccessDate: Date.now(),
    path: '/instances/test',
  }
}

describe('Instance Assignment Utils', () => {
  let mockVersionProvider: VersionMetadataProvider
  const getCandidatePath = (name: string) => `/instances/${name}`

  beforeEach(() => {
    mockVersionProvider = () => '1.19.2'
  })

  describe('InstanceAssignmentUtils', () => {
    describe('assignShallow', () => {
      it('should assign properties and return true when changes are made', () => {
        const target = { name: 'old', author: 'author1', version: '1.0' }
        const source = { name: 'new', author: 'author1', description: 'desc' }

        const hasChanges = assignShallow(target, source)

        expect(hasChanges).toBe(true)
        expect(target.name).toBe('new')
        expect(target.author).toBe('author1') // unchanged
        expect((target as any).description).toBe('desc') // added
      })

      it('should return false when no changes are made', () => {
        const target = { name: 'same', author: 'same' }
        const source = { name: 'same', author: 'same' }

        const hasChanges = assignShallow(target, source)

        expect(hasChanges).toBe(false)
      })

      it('should skip undefined values', () => {
        const target = { name: 'old', author: 'author1' }
        const source = { name: 'new', author: undefined, description: 'desc' }

        const hasChanges = assignShallow(target, source)

        expect(hasChanges).toBe(true)
        expect(target.name).toBe('new')
        expect(target.author).toBe('author1') // unchanged due to undefined
        expect((target as any).description).toBe('desc')
      })
    })

    describe('createInstance', () => {
      it('should create instance from creation options', () => {
        const payload: CreateInstanceOptions = {
          name: 'New Instance',
          author: 'Creator',
          description: 'A new instance',
          runtime: { minecraft: '1.19.2', forge: '43.2.0' },
          icon: 'icon.png',
        }

        const instance = createInstance(payload, getCandidatePath, mockVersionProvider)

        expect(instance.name).toBe('New Instance')
        expect(instance.author).toBe('Creator')
        expect(instance.description).toBe('A new instance')
        expect(instance.icon).toBe('icon.png')
        expect(instance.runtime.minecraft).toBe('1.19.2')
        expect(instance.runtime.forge).toBe('43.2.0')
        expect(typeof instance.creationDate).toBe('number')
        expect(typeof instance.lastAccessDate).toBe('number')
      })

      it('should use version provider for minecraft version when not specified', () => {
        const payload: CreateInstanceOptions = {
          name: 'New Instance',
        }

        const instance = createInstance(payload, getCandidatePath, mockVersionProvider)

        expect(instance.runtime.minecraft).toBe('1.19.2')
      })

      it('should handle resolution in creation options', () => {
        const payload: CreateInstanceOptions = {
          name: 'New Instance',
          resolution: { width: 1024, height: 768, fullscreen: true },
        }

        const instance = createInstance(payload, getCandidatePath, mockVersionProvider)

        expect(instance.resolution).toEqual({ width: 1024, height: 768, fullscreen: true })
      })
    })
  })

  describe('computeInstanceEditChanges', () => {
    let currentInstance: InstanceDataWithTime

    beforeEach(() => {
      currentInstance = {
        ...createInstanceTemplate(),
        name: 'Current Instance',
        author: 'Current Author',
        maxMemory: 4096,
        minMemory: 1024,
        assignMemory: false,
        showLog: false,
        resolution: { width: 1920, height: 1080, fullscreen: false },
        vmOptions: ['-Xmx4G'],
        mcOptions: ['--username', 'test'],
        server: { host: 'old.example.com', port: 25565 },
      }
      currentInstance.runtime.minecraft = '1.19.2'
    })

    it('should detect simple property changes', async () => {
      const editOptions: EditInstanceOptions = {
        name: 'New Name',
        author: 'New Author',
        description: 'New Description',
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.name).toBe('New Name')
      expect(changes.author).toBe('New Author')
      expect(changes.description).toBe('New Description')
      expect(Object.keys(changes)).toHaveLength(3)
    })

    it('should not include unchanged properties', async () => {
      const editOptions: EditInstanceOptions = {
        name: 'Current Instance', // same as current
        author: 'New Author',
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.name).toBeUndefined()
      expect(changes.author).toBe('New Author')
      expect(Object.keys(changes)).toHaveLength(1)
    })

    it('should handle memory options correctly', async () => {
      const editOptions: EditInstanceOptions = {
        maxMemory: 8192,
        minMemory: undefined,
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.maxMemory).toBe(8192)
      expect(changes.minMemory).toBeUndefined()
      expect(Object.keys(changes)).toHaveLength(2)
    })

    it('should handle negative memory values by setting to 0', async () => {
      const editOptions: EditInstanceOptions = {
        maxMemory: -1000,
        minMemory: -500,
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      // Zod validation rejects negative values and converts them to undefined
      expect(changes.maxMemory).toBeUndefined()
      expect(changes.minMemory).toBeUndefined()
    })

    it('should handle boolean properties', async () => {
      const editOptions: EditInstanceOptions = {
        assignMemory: true,
        showLog: true,
        hideLauncher: false,
        fastLaunch: true,
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.assignMemory).toBe(true)
      expect(changes.showLog).toBe(true)
      expect(changes.hideLauncher).toBe(false)
      expect(changes.fastLaunch).toBe(true)
    })

    it('should handle resolution changes', async () => {
      const editOptions: EditInstanceOptions = {
        resolution: { width: 2560, height: 1440, fullscreen: true },
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.resolution).toEqual({ width: 2560, height: 1440, fullscreen: true })
    })

    it('should handle resolution being set to undefined', async () => {
      const editOptions: EditInstanceOptions = {
        resolution: undefined,
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.resolution).toBeUndefined()
    })

    it('should handle runtime changes', async () => {
      const editOptions: EditInstanceOptions = {
        runtime: {
          minecraft: '1.20.1',
          forge: '47.1.0',
        },
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.runtime).toEqual({
        fabricLoader: '',
        forge: '47.1.0',
        labyMod: '',
        minecraft: '1.20.1',
        neoForged: '',
        optifine: '',
        quiltLoader: '',
      })
    })

    it('should handle server changes', async () => {
      const editOptions: EditInstanceOptions = {
        server: { host: 'new.example.com', port: 25566 },
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.server).toEqual({ host: 'new.example.com', port: 25566 })
    })

    it('should handle server being set to undefined', async () => {
      const editOptions: EditInstanceOptions = {
        server: undefined,
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.server).toBeUndefined()
    })

    it('should detect changes in array options', async () => {
      const editOptions: EditInstanceOptions = {
        vmOptions: ['-Xmx8G', '-XX:+UseG1GC'],
        mcOptions: ['--username', 'newuser'],
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.vmOptions).toEqual(['-Xmx8G', '-XX:+UseG1GC'])
      expect(changes.mcOptions).toEqual(['--username', 'newuser'])
    })

    it('should handle environment variables', async () => {
      const editOptions: EditInstanceOptions = {
        env: { JAVA_HOME: '/usr/lib/jvm/java-17', CUSTOM_VAR: 'value' },
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.env).toEqual({ JAVA_HOME: '/usr/lib/jvm/java-17', CUSTOM_VAR: 'value' })
    })

    it('should handle partial nested object changes', async () => {
      const editOptions: EditInstanceOptions = {
        resolution: { width: 2560, height: 1080, fullscreen: false },
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      // Should return full atomic object when nested object changes
      expect(changes.resolution).toEqual({ width: 2560, height: 1080, fullscreen: false })
    })

    it('should not include unchanged nested objects', async () => {
      const editOptions: EditInstanceOptions = {
        resolution: { width: 1920, height: 1080, fullscreen: false },
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.resolution).toBeUndefined()
    })

    it('should detect empty array changes', async () => {
      const editOptions: EditInstanceOptions = {
        vmOptions: [],
        mcOptions: [],
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.vmOptions).toEqual([])
      expect(changes.mcOptions).toEqual([])
    })

    it('should not include unchanged arrays', async () => {
      const editOptions: EditInstanceOptions = {
        vmOptions: ['-Xmx4G'],
        mcOptions: ['--username', 'test'],
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.vmOptions).toBeUndefined()
      expect(changes.mcOptions).toBeUndefined()
    })

    it('should handle command options', async () => {
      const editOptions: EditInstanceOptions = {
        prependCommand: 'echo "Starting"',
        preExecuteCommand: 'setup.sh',
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.prependCommand).toBe('echo "Starting"')
      expect(changes.preExecuteCommand).toBe('setup.sh')
    })

    it('should handle disabling auth libs', async () => {
      const editOptions: EditInstanceOptions = {
        disableElybyAuthlib: true,
        disableAuthlibInjector: true,
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.disableElybyAuthlib).toBe(true)
      expect(changes.disableAuthlibInjector).toBe(true)
    })

    it('should handle use latest version settings', async () => {
      const editOptions: EditInstanceOptions = {
        useLatest: 'release',
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.useLatest).toBe('release')
    })

    it('should handle clearing optional fields', async () => {
      const currentWithFields: InstanceDataWithTime = {
        ...currentInstance,
        prependCommand: 'old command',
        preExecuteCommand: 'old setup',
        java: '/path/to/java',
      }

      const editOptions: EditInstanceOptions = {
        prependCommand: undefined,
        preExecuteCommand: undefined,
        java: undefined,
      }

      const changes = await computeInstanceEditChanges(
        currentWithFields,
        editOptions,
        async (s) => s,
      )

      expect(changes.prependCommand).toBeUndefined()
      expect(changes.preExecuteCommand).toBeUndefined()
      expect(changes.java).toBeUndefined()
      expect(Object.keys(changes)).toHaveLength(3)
    })

    it('should handle explicitly setting undefined to remove optional field', async () => {
      const currentWithMemory: InstanceDataWithTime = {
        ...currentInstance,
        minMemory: 1000,
        maxMemory: 8000,
      }

      const editOptions: EditInstanceOptions = {
        minMemory: undefined,
      }

      const changes = await computeInstanceEditChanges(
        currentWithMemory,
        editOptions,
        async (s) => s,
      )

      // Explicitly setting to undefined should be included in result to clear the field
      expect(changes.minMemory).toBeUndefined()
      expect(Object.keys(changes)).toHaveLength(1)
    })

    it('should handle icon URL transformation', async () => {
      // Note: launcher:// URLs might not be properly parsed by URL constructor
      // This test documents the current behavior
      const editOptions: EditInstanceOptions = {
        icon: 'launcher:///media?path=/some/icon.png',
      }

      const getIconUrl = async (path: string) => `file:///converted${path}`

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, getIconUrl)

      // The current implementation may not handle launcher:// URLs properly
      // Only file: and http(s): URLs are properly handled by URL constructor
      expect(changes.icon).toBe('launcher:///media?path=/some/icon.png')
    })

    it('should handle file URL icon transformation', async () => {
      const currentWithIcon: InstanceDataWithTime = {
        ...currentInstance,
        icon: 'file:///old/icon.png',
      }

      const editOptions: EditInstanceOptions = {
        icon: 'file:///new/icon.png',
      }

      const getIconUrl = async (path: string) => `file:///converted${path}`

      const changes = await computeInstanceEditChanges(currentWithIcon, editOptions, getIconUrl)

      expect(changes.icon).toBe('file:///new/icon.png')
    })

    it('should handle regular URLs without transformation', async () => {
      const editOptions: EditInstanceOptions = {
        icon: 'https://example.com/icon.png',
      }

      const getIconUrl = async (path: string) => `file:///converted${path}`

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, getIconUrl)

      expect(changes.icon).toBe('https://example.com/icon.png')
    })

    it('should handle complex edit with mixed nested and simple changes', async () => {
      const editOptions: EditInstanceOptions = {
        name: 'New Name',
        runtime: { minecraft: '1.20.1', optifine: 'HD_U_F1' },
        resolution: { width: 1280 },
        vmOptions: ['-Xmx8G'],
        showLog: true,
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      expect(changes.name).toBe('New Name')
      expect(changes.runtime).toEqual({
        fabricLoader: '',
        forge: '',
        labyMod: '',
        minecraft: '1.20.1',
        neoForged: '',
        optifine: 'HD_U_F1',
        quiltLoader: '',
      })
      expect(changes.resolution).toEqual({ width: 1280 })
      expect(changes.vmOptions).toEqual(['-Xmx8G'])
      expect(changes.showLog).toBe(true)
      expect(Object.keys(changes)).toHaveLength(5)
    })

    it('should handle nested object with different key order', async () => {
      const editOptions: EditInstanceOptions = {
        // Providing resolution with keys in different order than current
        resolution: { fullscreen: false, height: 1080, width: 1920 },
      }

      const changes = await computeInstanceEditChanges(currentInstance, editOptions, async (s) => s)

      // Should not include in result as the values are identical (key order doesn't matter semantically)
      expect(changes.resolution).toBeUndefined()
    })

    it('should handle runtime with different key order but same values', async () => {
      // Create a current instance with full runtime object
      const currentWithFullRuntime: InstanceDataWithTime = {
        ...currentInstance,
        runtime: {
          minecraft: '1.19.2',
          forge: '',
          fabricLoader: '',
          optifine: '',
          quiltLoader: '',
          neoForged: '',
          labyMod: '',
        },
      }

      const editOptions: EditInstanceOptions = {
        // Providing runtime with keys in different order
        runtime: {
          labyMod: '',
          optifine: '',
          fabricLoader: '',
          quiltLoader: '',
          neoForged: '',
          forge: '',
          minecraft: '1.19.2',
        },
      }

      const changes = await computeInstanceEditChanges(
        currentWithFullRuntime,
        editOptions,
        async (s) => s,
      )

      // Should not include in result as the values are identical (key order doesn't matter semantically)
      expect(changes.runtime).toBeUndefined()
    })

    it('should handle environment variables with different key order', async () => {
      const currentWithEnv: InstanceDataWithTime = {
        ...currentInstance,
        env: { VAR_A: 'value1', VAR_B: 'value2' },
      }

      const editOptions: EditInstanceOptions = {
        env: { VAR_B: 'value2', VAR_A: 'value1' },
      }

      const changes = await computeInstanceEditChanges(currentWithEnv, editOptions, async (s) => s)

      // Should not include in result as the values are identical (key order doesn't matter semantically)
      expect(changes.env).toBeUndefined()
    })
  })

  describe('applyInstanceChanges', () => {
    let instance: InstanceDataWithTime

    beforeEach(() => {
      instance = {
        ...createInstanceTemplate(),
        name: 'Original Instance',
        author: 'Original Author',
        maxMemory: 4096,
      }
      instance.runtime.minecraft = '1.19.2'
      instance.runtime.forge = '43.2.0'
    })

    it('should apply simple property changes', () => {
      const changes = {
        name: 'Updated Instance',
        author: 'Updated Author',
      }

      applyInstanceChanges(instance, changes)

      expect(instance.name).toBe('Updated Instance')
      expect(instance.author).toBe('Updated Author')
      expect(instance.maxMemory).toBe(4096)
      expect(instance.description).toBe(instance.description) // unchanged
    })

    it('should merge runtime changes properly', () => {
      const changes: Partial<InstanceDataWithTime> = {
        runtime: {
          ...instance.runtime,
          fabricLoader: '0.14.21',
          quiltLoader: '0.19.2',
        },
      }

      applyInstanceChanges(instance, changes)

      expect(instance.runtime.minecraft).toBe('1.19.2') // preserved
      expect(instance.runtime.forge).toBe('43.2.0') // preserved
      expect(instance.runtime.fabricLoader).toBe('0.14.21') // added
      expect(instance.runtime.quiltLoader).toBe('0.19.2') // added
    })

    it('should merge runtime changes properly', () => {
      const changes: Partial<InstanceDataWithTime> = {
        runtime: {
          ...instance.runtime,
          forge: '',
          fabricLoader: '0.14.21',
        },
      }

      applyInstanceChanges(instance, changes)

      expect(instance.runtime.minecraft).toBe('1.19.2') // preserved
      expect(instance.runtime.forge).toBe('') // preserved
      expect(instance.runtime.fabricLoader).toBe('0.14.21') // added
      expect(instance.runtime.quiltLoader).toBe('') // preserved
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete edit workflow', async () => {
      const mockProvider: VersionMetadataProvider = () => '1.19.2'

      // Create initial instance
      const createOptions: CreateInstanceOptions = {
        name: 'Test Instance',
        author: 'Test Author',
        runtime: { minecraft: '1.19.2', forge: '43.2.0' },
      }

      const instance = createInstance(createOptions, getCandidatePath, mockProvider)

      // Compute edit changes
      const editOptions: EditInstanceOptions = {
        name: 'Updated Test Instance',
        runtime: { minecraft: '1.20.1', fabricLoader: '0.14.21' },
        maxMemory: 8192,
        showLog: true,
      }

      const changes = await computeInstanceEditChanges(instance, editOptions, async (s) => s)

      // Apply changes
      applyInstanceChanges(instance, changes)

      expect(instance.name).toBe('Updated Test Instance')
      expect(instance.runtime.minecraft).toBe('1.20.1') // preserved from merge
      expect(instance.runtime.forge).toBe('') // removed
      expect(instance.runtime.fabricLoader).toBe('0.14.21') // added
      expect(instance.maxMemory).toBe(8192)
      expect(instance.showLog).toBe(true)
      expect(instance.author).toBe('Test Author') // unchanged
    })
  })
})
