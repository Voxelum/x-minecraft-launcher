import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import skyOdyssey from '../util/__fixtures__/ftb-sky-odyssey.json'
import { useFeedTheBeastModpackInstall } from './ftb'

vi.mock('@/util/clients', () => ({ clientFTB: {} }))
vi.mock('./instanceVersion', () => ({ kInstanceVersion: Symbol() }))
vi.mock('./instanceVersionInstall', () => ({ kInstanceVersionInstall: Symbol() }))
vi.mock('./instances', () => ({ kInstances: Symbol() }))
vi.mock('./java', () => ({ kJavaContext: Symbol() }))
vi.mock('./swrvConfig', () => ({ kSWRVConfig: Symbol() }))
vi.mock('@vueuse/core', () => ({ useLocalStorage: () => ref([]) }))
vi.mock('@/util/inject', () => ({ injection: () => context }))
vi.mock('./service', () => ({ useService: () => services }))

const services = { createInstance: vi.fn(), installInstanceFiles: vi.fn() }
const context = {
  all: ref([]), instances: ref([]), selectedInstance: ref(''),
  getVersionHeader: () => undefined, getResolvedVersion: vi.fn(),
  getInstallInstruction: vi.fn(), handleInstallInstruction: vi.fn(),
  getInstanceLock: () => ({ runExclusive: (fn: () => Promise<void>) => fn() }),
}
const project = { id: 8, name: 'FTB Sky Odyssey', art: [], authors: [] } as any

describe('FTB install completion', () => {
  beforeEach(() => {
    vi.stubGlobal('useRouter', () => ({ currentRoute: ref({ path: '/' }), push: vi.fn() }))
    services.createInstance.mockResolvedValue('/instance')
    services.installInstanceFiles.mockResolvedValue(undefined)
    context.getInstallInstruction.mockResolvedValue({})
    context.handleInstallInstruction.mockResolvedValue(undefined)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

  it('does not report completion while file installation is pending', async () => {
    let complete!: () => void
    services.installInstanceFiles.mockReturnValue(new Promise<void>(resolve => { complete = resolve }))
    const result = useFeedTheBeastModpackInstall().installModpack(skyOdyssey as any, project)
    let finished = false
    result.then(() => { finished = true })
    await vi.waitFor(() => expect(services.installInstanceFiles).toHaveBeenCalled())
    expect(finished).toBe(false)
    complete()
    await result
    expect(finished).toBe(true)
  })

  it('does not report completion while runtime installation is pending', async () => {
    let complete!: () => void
    context.handleInstallInstruction.mockReturnValue(new Promise<void>(resolve => { complete = resolve }))
    const result = useFeedTheBeastModpackInstall().installModpack(skyOdyssey as any, project)
    let finished = false
    result.then(() => { finished = true })
    await vi.waitFor(() => expect(context.handleInstallInstruction).toHaveBeenCalled())
    expect(finished).toBe(false)
    complete()
    await result
    expect(finished).toBe(true)
  })

  it.each(['files', 'runtime'])('propagates %s failures to the install caller', async (part) => {
    const error = new Error(`${part} failed`)
    if (part === 'files') services.installInstanceFiles.mockRejectedValue(error)
    else context.handleInstallInstruction.mockRejectedValue(error)
    await expect(useFeedTheBeastModpackInstall().installModpack(skyOdyssey as any, project)).rejects.toBe(error)
  })
})
