import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { useModpackFinishInstall } from './modpackInstaller'

const mocks = vi.hoisted(() => ({
  importModpack: vi.fn(),
  resolveLocalVersion: vi.fn(),
  getInstanceLock: vi.fn(),
  getInstallInstruction: vi.fn(),
  handleInstallInstruction: vi.fn(),
  notify: vi.fn(),
  push: vi.fn(),
  endAction: vi.fn(),
}))
vi.mock('./service', () => ({ useService: () => mocks }))
vi.mock('./notifier', () => ({ useNotifier: () => mocks }))
vi.mock('./instances', () => ({ kInstances: Symbol('instances') }))
vi.mock('./instanceVersionInstall', () => ({ kInstanceVersionInstall: Symbol('install') }))
vi.mock('./java', () => ({ kJavaContext: Symbol('java') }))
vi.mock('@/util/inject', () => ({ injection: () => ({ ...mocks, selectedInstance, all: ref([]) }) }))

const selectedInstance = ref('C:\\instances\\previous')
const currentRoute = ref({ path: '/store' })

describe('useModpackFinishInstall', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    selectedInstance.value = 'C:\\instances\\previous'
    currentRoute.value = { path: '/store' }
    vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
    vi.stubGlobal('useRouter', () => ({ currentRoute, push: mocks.push }))
    vi.stubGlobal('rendererTelemetry', {
      startAction: vi.fn().mockResolvedValue({ id: 'import', traceparent: 'trace' }),
      endAction: mocks.endAction,
    })
    mocks.push.mockImplementation(async (path: string) => { currentRoute.value.path = path })
    mocks.getInstanceLock.mockReturnValue({ runExclusive: (run: () => Promise<void>) => run() })
    mocks.getInstallInstruction.mockResolvedValue({ install: true })
  })

  afterEach(() => vi.unstubAllGlobals())

  test.each(['Error', 'AbortError'])('selects a newly retained pending instance after %s without claiming success', async (name) => {
    const failure = Object.assign(new Error('Download interrupted'), {
      name,
      installInstance: { instancePath: 'C:\\instances\\pack' },
    })
    mocks.importModpack.mockRejectedValue(failure)
    const finish = useModpackFinishInstall()

    await expect(finish('C:\\packs\\pack.zip', undefined, undefined)).rejects.toBe(failure)
    expect(selectedInstance.value).toBe('C:\\instances\\pack')
    expect(mocks.push).toHaveBeenCalledWith('/')
    expect(mocks.notify).toHaveBeenCalledWith({
      level: 'error', title: 'installInstance.name', body: 'Download interrupted',
    })
    expect(mocks.getInstanceLock).not.toHaveBeenCalled()
    expect(mocks.handleInstallInstruction).not.toHaveBeenCalled()
    expect(mocks.endAction).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'error' }))
  })

  test('keeps the current selection if parsing failed before instance creation', async () => {
    const failure = new Error('Invalid archive')
    mocks.importModpack.mockRejectedValue(failure)

    await expect(useModpackFinishInstall()('bad.zip', undefined, undefined)).rejects.toBe(failure)
    expect(selectedInstance.value).toBe('C:\\instances\\previous')
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.notify).toHaveBeenCalledOnce()
  })

  test('finds retained instance information in serialized aggregate errors', async () => {
    const failure = [
      { name: 'DownloadError', message: 'First download failed' },
      { name: 'DownloadError', message: 'Second download failed', installInstance: { instancePath: 'C:\\instances\\pack' } },
    ]
    mocks.importModpack.mockRejectedValue(failure)
    await expect(useModpackFinishInstall()('pack.zip', undefined, undefined)).rejects.toBe(failure)
    expect(selectedInstance.value).toBe('C:\\instances\\pack')
    expect(mocks.push).toHaveBeenCalledWith('/')
    expect(mocks.handleInstallInstruction).not.toHaveBeenCalled()
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
      body: 'First download failed\nSecond download failed',
    }))
  })

  test.each([false, true])('finds retained leaf metadata through nested errors and causes (serialized: %s)', async (serialized) => {
    const leaf = {
      name: 'DownloadError',
      message: 'Download failed',
      installInstance: { instancePath: 'C:\\instances\\pack' },
    }
    const failure = serialized
      ? { name: 'AggregateError', message: 'Import failed', errors: [{ cause: [leaf] }] }
      : new AggregateError([new Error('Wrapped download', { cause: [leaf] })], 'Import failed')
    mocks.importModpack.mockRejectedValue(failure)

    await expect(useModpackFinishInstall()('pack.zip', undefined, undefined)).rejects.toBe(failure)
    expect(selectedInstance.value).toBe('C:\\instances\\pack')
    expect(mocks.push).toHaveBeenCalledWith('/')
    expect(mocks.handleInstallInstruction).not.toHaveBeenCalled()
    expect(mocks.notify).toHaveBeenCalledOnce()
  })

  test('does not replace the original failure when its cause is cyclic', async () => {
    const failure = new Error('Import failed')
    failure.cause = failure
    mocks.importModpack.mockRejectedValue(failure)

    await expect(useModpackFinishInstall()('pack.zip', undefined, undefined)).rejects.toBe(failure)
    expect(selectedInstance.value).toBe('C:\\instances\\previous')
    expect(mocks.notify).toHaveBeenCalledOnce()
  })

  test('selects an existing updated instance even when the failure has no metadata', async () => {
    const failure = new Error('Download failed')
    mocks.importModpack.mockRejectedValue(failure)

    await expect(useModpackFinishInstall()('pack.zip', undefined, undefined, 'C:\\instances\\existing')).rejects.toBe(failure)
    expect(selectedInstance.value).toBe('C:\\instances\\existing')
    expect(mocks.handleInstallInstruction).not.toHaveBeenCalled()
  })

  test('installs the Minecraft version only after successful modpack import', async () => {
    const runtime = { minecraft: '1.20.1' }
    mocks.importModpack.mockResolvedValue({
      instancePath: 'C:\\instances\\pack', runtime, version: 'custom',
    })
    mocks.resolveLocalVersion.mockResolvedValue({ id: 'custom' })

    await useModpackFinishInstall()('pack.zip', undefined, undefined)
    expect(selectedInstance.value).toBe('C:\\instances\\pack')
    expect(mocks.resolveLocalVersion).toHaveBeenCalledWith('custom')
    expect(mocks.getInstallInstruction).toHaveBeenCalledWith(
      'C:\\instances\\pack', runtime, '', { id: 'custom' }, [], undefined, expect.anything(),
    )
    expect(mocks.handleInstallInstruction).toHaveBeenCalledWith({ install: true }, expect.anything())
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  test('preserves the install failure when navigation also fails', async () => {
    const failure = Object.assign(new Error('Download failed'), {
      installInstance: { instancePath: 'C:\\instances\\pack' },
    })
    mocks.importModpack.mockRejectedValue(failure)
    mocks.push.mockRejectedValue(new Error('Navigation failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(useModpackFinishInstall()('pack.zip', undefined, undefined)).rejects.toBe(failure)
      expect(mocks.notify).toHaveBeenCalledOnce()
    } finally {
      consoleError.mockRestore()
    }
  })
})
