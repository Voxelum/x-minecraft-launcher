import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { MarketType } from '@xmcl/runtime-api'
import { useLocaleError } from '../composables/error'
import { getModpackProviderPath, parseModpackUrlInput, routeModpackUrlInput } from '../composables/modpackUrlInput'

// Compile the real SFC setup, without a DOM or a second copy of its orchestration.
// Only the service/router/network boundaries are replaced.
const source = readFileSync(new URL('./AppImportUrlDialog.vue', import.meta.url), 'utf8')
const script = compileScript(parse(source).descriptor, { id: 'url-import-test' })
const compiled = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const service = {
  openModpack: vi.fn(), handleUrl: vi.fn(), installModapckFromMarket: vi.fn(),
  createInstance: vi.fn(), editInstance: vi.fn(), installInstanceFiles: vi.fn(),
  getModpackArchiveFiles: vi.fn(),
}
const versionInstaller = {
  getInstanceLock: () => ({ runExclusive: (run: () => Promise<void>) => run() }),
  getInstallInstruction: vi.fn(),
  handleInstallInstruction: vi.fn(),
}
const clients = {
  clientModrinthV2: { getProject: vi.fn(), getProjectVersions: vi.fn() },
  clientCurseforgeV1: { searchMods: vi.fn(), getModFiles: vi.fn(), getFiles: vi.fn() },
}
const install = vi.fn()
const finish = vi.fn()
const notify = vi.fn()
const fetchMock = vi.fn()
const shown = Vue.ref(false)
let onShow: (value?: unknown) => void
const hide = () => { shown.value = false }
let scope: Vue.EffectScope
function setup() {
  scope = Vue.effectScope()
  const modules: Record<string, unknown> = {
    vue: Vue,
    '@/composables/dialog': { useDialog: (_key: unknown, callback: typeof onShow) => {
      onShow = callback
      return { isShown: shown, hide, show: vi.fn() }
    } },
    '@/composables/modpackPaste': { ImportUrlDialogKey: 'import-url-dialog' },
    '@/composables/modpackUrlInput': { getModpackProviderPath, parseModpackUrlInput, routeModpackUrlInput },
    '@/composables/modpackInstaller': { useModpackInstaller: () => install, useModpackFinishInstall: () => finish },
    '@/composables': { useService: () => service },
    '@xmcl/runtime-api': { MarketType },
    '@/util/clients': clients,
    '@/composables/notifier': { useNotifier: () => ({ notify }) },
    '@/util/inject': { injection: () => ({ ...versionInstaller, selectedInstance: Vue.ref('previous'), instances: Vue.ref([]), all: Vue.ref([]) }) },
    '@/composables/instanceVersionInstall': { kInstanceVersionInstall: 'version' },
    '@/composables/java': { kJavaContext: 'java' },
    '@/composables/instances': { kInstances: 'instances' },
    '@/composables/error': { useLocaleError },
  }
  const module = { exports: {} as { default: { setup: (props: object, context: object) => Record<string, any> } } }
  new Function('require', 'module', 'exports', compiled)((id: string) => {
    if (!(id in modules)) throw new Error(`Unmocked dependency: ${id}`)
    return modules[id]
  }, module, module.exports)
  const state = scope.run(() => module.exports.default.setup({}, { expose: () => {} }))!
  shown.value = true
  onShow()
  return state
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}
const response = (data: unknown) => ({ ok: true, json: async () => data })
const modrinthVersion = { id: 'v1', project_id: 'p1', name: 'Version 1', game_versions: ['1.20.4'], loaders: ['fabric'] }

beforeEach(() => {
  vi.resetAllMocks()
  for (const [name, value] of Object.entries(Vue)) vi.stubGlobal(name, value)
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
  vi.stubGlobal('useRouter', () => ({ currentRoute: Vue.ref({ path: '/' }), push: vi.fn() }))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('window', { open: vi.fn() })
  vi.stubGlobal('navigator', { clipboard: { readText: vi.fn(), writeText: vi.fn() } })
  service.openModpack.mockResolvedValue({ modpackPath: 'fixture.zip' })
  service.createInstance.mockResolvedValue('new-instance')
  versionInstaller.getInstallInstruction.mockResolvedValue({ runtime: 'fixture' })
  clients.clientModrinthV2.getProject.mockResolvedValue({ title: 'Project' })
  clients.clientModrinthV2.getProjectVersions.mockResolvedValue([modrinthVersion])
})
afterEach(() => { scope?.stop(); vi.unstubAllGlobals() })

describe('actual URL import dialog orchestration', () => {
  it('ignores duplicate Enter while resolving or importing an archive', async () => {
    const pending = deferred<{ modpackPath: string }>()
    service.openModpack.mockReturnValue(pending.promise)
    const state = setup()
    state.modpackUrl.value = 'https://example.com/download?id=1'
    const first = state.submitModpackUrl()
    const duplicate = state.submitModpackUrl()
    expect(service.openModpack).toHaveBeenCalledTimes(1)
    pending.resolve({ modpackPath: 'one.zip' })
    await Promise.all([first, duplicate])
    expect(finish).toHaveBeenCalledExactlyOnceWith('one.zip', undefined, undefined, undefined)
  })

  it('does not install a resolved archive after cancellation and reopening', async () => {
    const pending = deferred<{ modpackPath: string }>()
    service.openModpack.mockReturnValue(pending.promise)
    const state = setup()
    state.modpackUrl.value = 'https://example.com/old.zip'
    const old = state.submitModpackUrl()
    state.closeAll()
    await Vue.nextTick()
    shown.value = true
    onShow()
    pending.resolve({ modpackPath: 'old.zip' })
    await old
    expect(finish).not.toHaveBeenCalled()
    expect(state.isShownDialog.value).toBe(true)
    expect(state.modpackUrl.value).toBe('')
  })

  it('does not overwrite reopened dialog state with a stale provider response', async () => {
    const pending = deferred<typeof modrinthVersion[]>()
    clients.clientModrinthV2.getProjectVersions.mockReturnValue(pending.promise)
    const state = setup()
    state.modpackUrl.value = 'https://modrinth.com/modpack/project'
    const old = state.submitModpackUrl()
    await Vue.nextTick()
    state.closeAll()
    await Vue.nextTick()
    shown.value = true
    onShow()
    pending.resolve([modrinthVersion])
    await old
    expect(state.dialogStep.value).toBe('input')
    expect(state.availableVersions.value).toEqual([])
  })

  it('keeps provider failures visible instead of downloading HTML as an archive', async () => {
    clients.clientModrinthV2.getProjectVersions.mockRejectedValue(new Error('Provider offline'))
    const state = setup()
    state.modpackUrl.value = 'https://modrinth.com/modpack/project'
    await state.submitModpackUrl()
    expect(service.openModpack).not.toHaveBeenCalled()
    expect(state.urlError.value).toBe('Provider offline')
    expect(state.isShownDialog.value).toBe(true)
  })

  it('shows an empty-provider result without falling through to archive download', async () => {
    clients.clientModrinthV2.getProjectVersions.mockResolvedValue([])
    const state = setup()
    state.modpackUrl.value = 'https://modrinth.com/modpack/project'
    await state.submitModpackUrl()
    expect(service.openModpack).not.toHaveBeenCalled()
    expect(state.urlError.value).toBe('importModpack.noReleasesFound')
  })

  it('preserves selected Modrinth and CurseForge version installation', async () => {
    const state = setup()
    state.modpackUrl.value = 'https://modrinth.com/modpack/project/version/v1'
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(install).toHaveBeenCalledWith({ market: MarketType.Modrinth, projectId: 'p1', versionId: 'v1' })
    shown.value = true
    onShow()
    clients.clientCurseforgeV1.searchMods.mockResolvedValue({ data: [{ id: 12, name: 'CF' }] })
    clients.clientCurseforgeV1.getModFiles.mockResolvedValue({ data: [{ id: 34, displayName: 'File', gameVersions: ['1.20.4'] }] })
    state.modpackUrl.value = 'https://www.curseforge.com/minecraft/modpacks/test/files/34'
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(install).toHaveBeenCalledWith({ market: MarketType.CurseForge, modId: 12, fileId: 34 })
  })

  it('imports direct downloads with provider-like text in the query as archives', async () => {
    const state = setup()
    const url = 'https://example.com/download?source=https://modrinth.com/modpack/project'
    state.modpackUrl.value = url
    await state.submitModpackUrl()
    expect(service.openModpack).toHaveBeenCalledWith(url)
    expect(clients.clientModrinthV2.getProject).not.toHaveBeenCalled()
  })

  it('imports an explicit extensionless GitHub asset even when release discovery is unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('Offline'))
    const state = setup()
    const url = 'https://github.com/owner/repo/releases/download/v1/archive?token=1'
    state.modpackUrl.value = url
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(service.openModpack).toHaveBeenCalledWith(url)
  })

  it('keeps install failures visible and supports retry without reopening', async () => {
    fetchMock.mockResolvedValue(response([{ tag_name: 'v1', assets: [{ name: 'pack.zip', browser_download_url: 'https://example.com/pack.zip' }] }]))
    const state = setup()
    state.modpackUrl.value = 'https://github.com/owner/repo/releases'
    await state.submitModpackUrl()
    service.openModpack.mockRejectedValueOnce(new Error('Download failed'))
    await state.confirmVersionSelect()
    expect(state.isShownDialog.value).toBe(true)
    expect(state.urlError.value).toBe('Download failed')
    await state.confirmVersionSelect()
    expect(finish).toHaveBeenCalledOnce()
  })

  it('does not swallow a Technic archive failure or try to import the provider page', async () => {
    fetchMock.mockResolvedValue(response({ url: 'https://example.com/technic.zip', displayName: 'Technic' }))
    service.openModpack.mockRejectedValue(new Error('Invalid Technic archive'))
    const state = setup()
    state.modpackUrl.value = 'https://www.technicpack.net/modpack/test.123'
    await state.submitModpackUrl()
    expect(service.openModpack).toHaveBeenCalledExactlyOnceWith('https://example.com/technic.zip')
    expect(state.urlError.value).toBe('Invalid Technic archive')
  })

  it('opens BBSMC netdisk links without installing a cloud-drive HTML page', async () => {
    fetchMock.mockResolvedValueOnce(response({ title: 'BBSMC' }))
      .mockResolvedValueOnce(response([{ id: 'v1', disk_only: true, disk_urls: [{ url: 'https://pan.baidu.com/s/fixture' }] }]))
    const state = setup()
    state.modpackUrl.value = 'https://bbsmc.net/project/test'
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(window.open).toHaveBeenCalledWith('https://pan.baidu.com/s/fixture', '_blank')
    expect(service.openModpack).not.toHaveBeenCalled()
  })

  it('installs ATLauncher overrides and mods together without guessing or replacing its runtime', async () => {
    const overrides = [{ path: 'config/test.cfg', downloads: ['zip:///configs.zip?entry=config%2Ftest.cfg'], hashes: {} }]
    fetchMock.mockResolvedValueOnce(response({ data: { name: 'ATL', safeName: 'ATL', versions: [{ version: 'v1', minecraft: '1.20.4' }] } }))
      .mockResolvedValueOnce(response({ minecraft: '1.20.4', loader: { type: 'fabric', metadata: { version: '0.16.0' } }, configs: { filesize: 12 }, mods: [
        { file: 'client.jar', url: 'mods/client.jar', md5: 'abc', filesize: 3 },
        { file: 'server.jar', url: 'mods/server.jar', client: false },
        { file: 'optional.jar', url: 'mods/optional.jar', optional: true },
      ] }))
    service.getModpackArchiveFiles.mockResolvedValue(overrides)
    const state = setup()
    state.modpackUrl.value = 'https://atlauncher.com/pack/ATL'
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(service.createInstance).toHaveBeenCalledWith({ name: 'ATL - v1', runtime: { minecraft: '1.20.4', fabricLoader: '0.16.0' } })
    expect(service.installInstanceFiles).toHaveBeenCalledExactlyOnceWith({
      path: 'new-instance', oldFiles: [], files: [...overrides, {
        path: 'mods/client.jar', downloads: ['https://download.nodecdn.net/containers/atl/mods/client.jar'], hashes: { md5: 'abc' }, size: 3,
      }],
    })
    expect(service.openModpack).not.toHaveBeenCalled()
    expect(finish).not.toHaveBeenCalled()
    expect(versionInstaller.handleInstallInstruction).toHaveBeenCalledOnce()
  })

  it('does not create an incomplete ATLauncher instance or claim success when its configs download fails', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { name: 'ATL', versions: [{ version: 'v1' }] } }))
      .mockResolvedValueOnce(response({ minecraft: '1.20.4', configs: { filesize: 12 } }))
    service.getModpackArchiveFiles.mockRejectedValue(new Error('Configs unavailable'))
    const state = setup()
    state.modpackUrl.value = 'https://atlauncher.com/pack/ATL'
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(service.createInstance).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    expect(state.urlError.value).toBe('Configs unavailable')
  })

  it('retries failed ATLauncher file installation in the retained instance', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { name: 'ATL', versions: [{ version: 'v1' }] } }))
      .mockResolvedValue(response({ minecraft: '1.20.4', mods: [{ url: 'https://example.com/mod.jar', file: 'mod.jar' }] }))
    service.installInstanceFiles.mockRejectedValueOnce(new Error('Download failed')).mockResolvedValue(undefined)
    const state = setup()
    state.modpackUrl.value = 'https://atlauncher.com/pack/ATL'
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(state.urlError.value).toBe('Download failed')
    await state.confirmVersionSelect()
    expect(service.createInstance).toHaveBeenCalledTimes(1)
    expect(service.installInstanceFiles).toHaveBeenCalledTimes(2)
  })

  it.each(['curseforge://install?addonId=12&fileId=34', 'modrinth://modpack/project', 'xmcl://launcher/app?url=https%3A%2F%2Fexample.com'])('dispatches supported deep link %s only to the launcher', async (url) => {
    service.handleUrl.mockResolvedValue(true)
    const state = setup()
    state.modpackUrl.value = url
    await state.submitModpackUrl()
    expect(service.handleUrl).toHaveBeenCalledExactlyOnceWith(url)
    expect(service.openModpack).not.toHaveBeenCalled()
  })

  it('surfaces archive profile errors before attempting installation', async () => {
    service.openModpack.mockResolvedValue({ modpackPath: 'bad.zip', error: new Error('Invalid modpack') })
    const state = setup()
    state.modpackUrl.value = 'https://example.com/bad.zip'
    await state.submitModpackUrl()
    expect(finish).not.toHaveBeenCalled()
    expect(state.urlError.value).toBe('Invalid modpack')
    expect(state.urlLoading.value).toBe(false)
  })

  it('localizes serialized invalid-archive exceptions instead of showing [object Object]', async () => {
    service.openModpack.mockRejectedValue({ name: 'ModpackException', exception: { type: 'invalidModpack', path: 'bad.zip' } })
    const state = setup()
    state.modpackUrl.value = 'https://example.com/bad.zip'
    await state.submitModpackUrl()
    expect(state.urlError.value).toBe('errors.BadInstanceType')
    expect(finish).not.toHaveBeenCalled()
  })

  it('ignores a stale clipboard read after closing and reopening', async () => {
    const pending = deferred<string>()
    vi.mocked(navigator.clipboard.readText).mockReturnValue(pending.promise)
    const state = setup()
    const paste = state.pasteFromClipboard()
    state.closeAll()
    shown.value = true
    onShow()
    pending.resolve('https://example.com/old.zip')
    await paste
    expect(state.modpackUrl.value).toBe('')
  })

  it('reports PlanetMinecraft protection instead of attempting to download its page', async () => {
    const state = setup()
    state.modpackUrl.value = 'https://www.planetminecraft.com/mods/tag/modpacks/'
    await state.submitModpackUrl()
    expect(state.urlError.value).toBe('importModpack.pmcProtected')
    expect(service.openModpack).not.toHaveBeenCalled()
  })

  it.each([
    ['https://atlauncher.com/pack/test', { data: { versions: [] } }],
    ['https://bbsmc.net/project/test', []],
    ['https://www.technicpack.net/modpack/test', {}],
    ['https://github.com/owner/repo/releases', []],
  ])('keeps an empty provider response visible for %s', async (url, data) => {
    fetchMock.mockResolvedValue({ ...response(data), text: async () => '' })
    const state = setup()
    state.modpackUrl.value = url
    await state.submitModpackUrl()
    expect(service.openModpack).not.toHaveBeenCalled()
    expect(state.isShownDialog.value).toBe(true)
    expect(state.urlError.value).toBe('importModpack.noReleasesFound')
  })

  it.each(['https://atlauncher.com/pack/test', 'https://bbsmc.net/project/test', 'https://www.technicpack.net/modpack/test', 'https://github.com/owner/repo/releases'])('does not download provider HTML after an HTTP error for %s', async (url) => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, statusText: 'Rate limited' })
    const state = setup()
    state.modpackUrl.value = url
    await state.submitModpackUrl()
    expect(state.urlError.value).toContain('429')
    expect(service.openModpack).not.toHaveBeenCalled()
  })

  it('reports empty CurseForge results after the existing fallback search', async () => {
    clients.clientCurseforgeV1.searchMods.mockResolvedValue({ data: [] })
    const state = setup()
    state.modpackUrl.value = 'https://curseforge.com/minecraft/modpacks/test'
    await state.submitModpackUrl()
    expect(clients.clientCurseforgeV1.searchMods).toHaveBeenCalledTimes(2)
    expect(state.urlError.value).toBe('importModpack.noReleasesFound')
    expect(service.openModpack).not.toHaveBeenCalled()
  })

  it('uses the primary BBSMC archive and resolves CurseForge identity rather than storing modId zero', async () => {
    const state = setup()
    fetchMock.mockResolvedValueOnce(response({ title: 'BBSMC' })).mockResolvedValueOnce(response([{
      id: 'v1', files: [
        { url: 'https://example.com/secondary.zip' },
        { primary: true, url: 'https://curseforge.com/minecraft/modpacks/test/download/34' },
      ],
    }]))
    clients.clientCurseforgeV1.getFiles.mockResolvedValue([{ id: 34, modId: 12 }])
    state.modpackUrl.value = 'https://bbsmc.net/project/test'
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(install).toHaveBeenCalledWith({ market: MarketType.CurseForge, fileId: 34, modId: 12 })
    expect(service.openModpack).not.toHaveBeenCalled()
  })

  it('does not report successful copying when the netdisk clipboard operation fails', async () => {
    fetchMock.mockResolvedValueOnce(response({ title: 'BBSMC' }))
      .mockResolvedValueOnce(response([{ id: 'v1', disk_only: true, disk_urls: [{ url: 'https://pan.baidu.com/s/fixture' }] }]))
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Clipboard denied'))
    const state = setup()
    state.modpackUrl.value = 'https://bbsmc.net/project/test'
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(notify).not.toHaveBeenCalled()
    expect(state.urlError.value).toBe('Clipboard denied')
  })

  it('preserves the update-existing dialog opened by the shared market installer', async () => {
    const state = setup()
    state.modpackUrl.value = 'https://modrinth.com/modpack/project'
    await state.submitModpackUrl()
    install.mockImplementation(async () => { shown.value = false })
    await state.confirmVersionSelect()
    expect(finish).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('does not let an old rejection clear the loading state of a new request', async () => {
    const old = deferred<{ modpackPath: string }>()
    const next = deferred<{ modpackPath: string }>()
    service.openModpack.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    const state = setup()
    state.modpackUrl.value = 'https://example.com/old.zip'
    const first = state.submitModpackUrl()
    state.closeAll()
    shown.value = true
    onShow()
    state.modpackUrl.value = 'https://example.com/new.zip'
    const second = state.submitModpackUrl()
    old.resolve({ modpackPath: 'old.zip' })
    await first
    expect(state.urlLoading.value).toBe(true)
    next.resolve({ modpackPath: 'new.zip' })
    await second
    expect(finish).toHaveBeenCalledExactlyOnceWith('new.zip', undefined, undefined, undefined)
  })

  it('does not replace a missing explicit Modrinth version with the latest release', async () => {
    const state = setup()
    state.modpackUrl.value = 'https://modrinth.com/modpack/project/version/missing'
    await state.submitModpackUrl()
    expect(state.dialogStep.value).toBe('input')
    expect(state.urlError.value).toBe('importModpack.noReleasesFound')
    expect(install).not.toHaveBeenCalled()
  })

  it('fetches an explicit CurseForge file outside the initial listing', async () => {
    clients.clientCurseforgeV1.searchMods.mockResolvedValue({ data: [{ id: 12, name: 'CF' }] })
    clients.clientCurseforgeV1.getModFiles.mockResolvedValue({ data: [{ id: 35, displayName: 'Latest' }] })
    clients.clientCurseforgeV1.getFiles.mockResolvedValue([{ id: 34, modId: 12, displayName: 'Requested' }])
    const state = setup()
    state.modpackUrl.value = 'https://curseforge.com/minecraft/modpacks/test/files/34'
    await state.submitModpackUrl()
    await state.confirmVersionSelect()
    expect(install).toHaveBeenCalledWith({ market: MarketType.CurseForge, modId: 12, fileId: 34 })
  })

  it('matches GitHub tags exactly instead of treating v10 as v1', async () => {
    fetchMock.mockResolvedValue(response(['v10', 'v1'].map(tag => ({
      tag_name: tag, name: tag, assets: [{ name: 'pack.zip', browser_download_url: `https://github.com/owner/repo/releases/download/${tag}/pack.zip` }],
    }))))
    const state = setup()
    state.modpackUrl.value = 'https://github.com/owner/repo/releases/tag/v1'
    await state.submitModpackUrl()
    expect(state.selectedVersionId.value).toBe('https://github.com/owner/repo/releases/download/v1/pack.zip')
  })

  it('preserves GitHub release-page discovery when its API is rate limited', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Rate limited' })
      .mockResolvedValueOnce({ ok: true, text: async () => '<a href="/owner/repo/releases/download/v1/pack.zip">Download</a>' })
    const state = setup()
    state.modpackUrl.value = 'https://github.com/owner/repo'
    await state.submitModpackUrl()
    expect(state.dialogStep.value).toBe('version')
    expect(state.selectedVersionId.value).toBe('https://github.com/owner/repo/releases/download/v1/pack.zip')
    expect(state.availableVersions.value[0].title).toBe('v1 - pack.zip')
    expect(service.openModpack).not.toHaveBeenCalled()
  })

  it('uses the primary BBSMC file for both the netdisk label and action', async () => {
    fetchMock.mockResolvedValueOnce(response({ title: 'BBS' })).mockResolvedValueOnce(response([{
      id: 'v1', files: [{ url: 'https://example.com/secondary.zip' }, { primary: true, url: 'https://pan.baidu.com/s/fixture' }],
    }]))
    const state = setup()
    state.modpackUrl.value = 'https://bbsmc.net/modpack/test'
    await state.submitModpackUrl()
    expect(state.isSelectedVersionNetdisk.value).toBe(true)
    await state.confirmVersionSelect()
    expect(window.open).toHaveBeenCalledWith('https://pan.baidu.com/s/fixture', '_blank')
    expect(service.openModpack).not.toHaveBeenCalled()
  })
})
