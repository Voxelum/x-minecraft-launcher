import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, effectScope, ref, shallowRef, watch } from 'vue'
import type { GameProfile } from '@xmcl/user'
import {
  applyInstanceLinkPreferences,
  useInstanceCreation,
  type InstanceLinkOperations,
} from './instanceCreation'

const { services, notify, endAction } = vi.hoisted(() => ({
  services: {
    createInstance: vi.fn(),
    deleteInstance: vi.fn(),
    installInstanceFiles: vi.fn(),
    resumeInstanceInstall: vi.fn(),
    linkSharedSave: vi.fn(),
    linkShared: vi.fn(),
    linkGameOptions: vi.fn(),
    link: vi.fn(),
  },
  notify: vi.fn(),
  endAction: vi.fn(),
}))

vi.mock('@/composables', () => ({ useService: () => services }))
vi.mock('./version', () => ({ kLatestMinecraftVersion: Symbol('version') }))
vi.mock('@/util/inject', () => ({ injection: () => ({ release: ref('1.20.1') }) }))
vi.mock('./notifier', () => ({ useNotifier: () => ({ notify }) }))
vi.mock('@vueuse/core', () => ({
  useLocalStorage: (_key: string, defaults: () => unknown) => ref(defaults()),
}))

function createOperations(overrides: Partial<InstanceLinkOperations> = {}) {
  return {
    linkSaves: vi.fn().mockResolvedValue(undefined),
    linkResourcePacks: vi.fn().mockResolvedValue(undefined),
    linkShaderPacks: vi.fn().mockResolvedValue(undefined),
    linkOptions: vi.fn().mockResolvedValue(undefined),
    linkServers: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('applyInstanceLinkPreferences', () => {
  test('applies no link when every preference is unchecked', async () => {
    const ops = createOperations()
    const failed = await applyInstanceLinkPreferences('/path', {
      saves: false,
      resourcepacks: false,
      shaderpacks: false,
      options: false,
      servers: false,
    }, ops)

    expect(failed).toEqual([])
    expect(ops.linkSaves).not.toHaveBeenCalled()
    expect(ops.linkResourcePacks).not.toHaveBeenCalled()
    expect(ops.linkShaderPacks).not.toHaveBeenCalled()
    expect(ops.linkOptions).not.toHaveBeenCalled()
    expect(ops.linkServers).not.toHaveBeenCalled()
  })

  test('links only the checked folders with the instance path', async () => {
    const ops = createOperations()
    const failed = await applyInstanceLinkPreferences('/instance', {
      saves: true,
      resourcepacks: false,
      shaderpacks: true,
      options: false,
      servers: false,
    }, ops)

    expect(failed).toEqual([])
    expect(ops.linkSaves).toHaveBeenCalledWith('/instance')
    expect(ops.linkResourcePacks).not.toHaveBeenCalled()
    expect(ops.linkShaderPacks).toHaveBeenCalledWith('/instance')
  })

  test('links the options.txt and servers.dat files when checked', async () => {
    const ops = createOperations()
    const failed = await applyInstanceLinkPreferences('/instance', {
      saves: false,
      resourcepacks: false,
      shaderpacks: false,
      options: true,
      servers: true,
    }, ops)

    expect(failed).toEqual([])
    expect(ops.linkOptions).toHaveBeenCalledWith('/instance')
    expect(ops.linkServers).toHaveBeenCalledWith('/instance')
  })

  test('reports the failed folder while still linking the others', async () => {
    const ops = createOperations({
      linkResourcePacks: vi.fn().mockRejectedValue(new Error('EPERM')),
    })
    const failed = await applyInstanceLinkPreferences('/instance', {
      saves: true,
      resourcepacks: true,
      shaderpacks: true,
      options: false,
      servers: false,
    }, ops)

    expect(failed).toEqual(['resourcepacks'])
    expect(ops.linkSaves).toHaveBeenCalledWith('/instance')
    expect(ops.linkShaderPacks).toHaveBeenCalledWith('/instance')
  })

  test('aggregates multiple independent failures', async () => {
    const ops = createOperations({
      linkSaves: vi.fn().mockRejectedValue(new Error('locked')),
      linkShaderPacks: vi.fn().mockRejectedValue(new Error('locked')),
      linkServers: vi.fn().mockRejectedValue(new Error('locked')),
    })
    const failed = await applyInstanceLinkPreferences('/instance', {
      saves: true,
      resourcepacks: true,
      shaderpacks: true,
      options: false,
      servers: true,
    }, ops)

    expect(failed).toEqual(['saves', 'shaderpacks', 'servers'])
    expect(ops.linkResourcePacks).toHaveBeenCalledWith('/instance')
  })
})

describe('useInstanceCreation', () => {
  let scope: ReturnType<typeof effectScope>

  beforeEach(() => {
    vi.resetAllMocks()
    for (const [name, value] of Object.entries({ ref, shallowRef, computed, watch })) {
      vi.stubGlobal(name, value)
    }
    vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
    vi.stubGlobal('rendererTelemetry', {
      startAction: vi.fn().mockResolvedValue({ id: 'create', traceparent: 'trace' }),
      endAction,
    })
    services.createInstance.mockResolvedValue('C:\\instances\\pack')
    services.installInstanceFiles.mockResolvedValue(undefined)
    services.resumeInstanceInstall.mockResolvedValue([])
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
    vi.unstubAllGlobals()
  })

  const createForm = () => scope.run(() =>
    useInstanceCreation(ref({ name: 'Player' } as GameProfile), ref([])))!
  const files = [{ path: 'mods/example.jar', hashes: { sha1: 'hash' } }]
  const template = {
    name: 'Pack',
    upstream: { type: 'modrinth-modpack' as const, projectId: 'project', versionId: 'version' },
  }

  test('blocks import creation before metadata or files resolve, including parse failures', async () => {
    const form = createForm()
    form.prepareImport()
    await expect(form.create()).rejects.toThrow('Instance files are not resolved')
    expect(services.createInstance).not.toHaveBeenCalled()

    const parseError = new Error('Invalid archive')
    let reject!: (error: Error) => void
    const parsing = form.update(template, new Promise((_resolve, fail) => { reject = fail }))
    expect(form.loading.value).toBe(true)
    expect(form.canCreate.value).toBe(false)
    await expect(form.create()).rejects.toThrow('Instance files are not resolved')
    reject(parseError)
    await expect(parsing).rejects.toBe(parseError)
    await expect(form.create()).rejects.toBe(parseError)
    expect(form.files.value).toEqual([])
    expect(form.loading.value).toBe(false)
    expect(services.createInstance).not.toHaveBeenCalled()
    expect(services.installInstanceFiles).not.toHaveBeenCalled()
  })

  test.each(['Error', 'AbortError'])('retains and selects a failed %s import, then resumes the same instance', async (name) => {
    const form = createForm()
    const failure = Object.assign(new Error('Download interrupted'), { name })
    const selected = ref('')
    await form.update(template, Promise.resolve(files))
    services.installInstanceFiles.mockImplementation(async () => {
      expect(selected.value).toBe('C:\\instances\\pack')
      throw failure
    })

    await expect(form.create(path => { selected.value = path })).rejects.toBe(failure)
    expect(form.error.value).toBe(failure)
    expect(form.loading.value).toBe(false)
    expect(form.data.name).toBe('Pack')
    expect(services.deleteInstance).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith({
      level: 'error', title: 'installInstance.name', body: 'Download interrupted',
    })
    expect(endAction).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'error' }))

    await expect(form.create()).resolves.toBe('C:\\instances\\pack')
    expect(services.createInstance).toHaveBeenCalledOnce()
    expect(services.installInstanceFiles).toHaveBeenCalledOnce()
    expect(services.resumeInstanceInstall).toHaveBeenCalledWith('C:\\instances\\pack')
    expect(form.error.value).toBeNull()
    expect(form.data.upstream).toBeUndefined()
    expect(form.isManual.value).toBe(true)
  })

  test('does not report a resume with unresolved files as success', async () => {
    const form = createForm()
    const failure = new Error('checksum mismatch')
    await form.update(template, Promise.resolve(files))
    services.installInstanceFiles.mockRejectedValue(failure)
    await expect(form.create()).rejects.toBe(failure)
    services.resumeInstanceInstall.mockResolvedValue([failure])

    await expect(form.create()).rejects.toMatchObject({ errors: [failure] })
    expect(form.data.name).toBe('Pack')
    expect(services.createInstance).toHaveBeenCalledOnce()
    services.resumeInstanceInstall.mockResolvedValue([])
    await expect(form.create()).resolves.toBe('C:\\instances\\pack')
    expect(services.createInstance).toHaveBeenCalledOnce()
  })

  test('does not reuse a previous file list after another archive fails to parse', async () => {
    const form = createForm()
    await form.update(template, Promise.resolve(files))
    const failure = new Error('Invalid archive')
    await expect(form.update({ name: 'Broken pack' }, Promise.reject(failure))).rejects.toBe(failure)

    await expect(form.create()).rejects.toBe(failure)
    expect(form.files.value).toEqual([])
    expect(services.createInstance).not.toHaveBeenCalled()
  })

  test('blocks duplicate submissions while installation is running', async () => {
    const form = createForm()
    await form.update(template, Promise.resolve(files))
    let complete!: () => void
    const installation = new Promise<void>(resolve => { complete = resolve })
    services.installInstanceFiles.mockReturnValue(installation)
    let selected!: () => void
    const selection = new Promise<void>(resolve => { selected = resolve })
    const first = form.create(selected)
    await selection
    await expect(form.create()).resolves.toBeUndefined()
    expect(services.createInstance).toHaveBeenCalledOnce()
    expect(services.resumeInstanceInstall).not.toHaveBeenCalled()
    complete()
    await expect(first).resolves.toBe('C:\\instances\\pack')
  })

  test('allows a manual instance after explicitly resetting a failed import', async () => {
    const form = createForm()
    await expect(form.update(template, Promise.reject(new Error('Bad archive')))).rejects.toThrow()
    form.reset()
    await expect(form.create()).resolves.toBe('C:\\instances\\pack')
    expect(services.installInstanceFiles).not.toHaveBeenCalled()
    expect(services.createInstance).toHaveBeenCalledWith(expect.objectContaining({ name: '1.20.1' }))
  })
})
