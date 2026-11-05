import { afterEach, expect, it, vi } from 'vitest'
import { join } from 'path'
import { pluginSetup } from './pluginSetup'

vi.mock('./setupWorkerEntry?worker', () => ({ default: () => undefined }))
vi.mock('@xmcl/worker', () => ({
  createLazyWorker: () => [{ getDiskInfo: async () => [] }, () => undefined],
}))

afterEach(() => vi.unstubAllEnvs())

it('onboards into a new Vardrynn game directory instead of reusing the XMCL default', async () => {
  vi.stubEnv('XMCL_E2E_GAME_DATA', '')
  const handlers = new Map<string, () => Promise<unknown>>()
  await pluginSetup({
    getLogger: () => ({ log() {}, warn() {}, error() {} }),
    registryDisposer() {},
    controller: { handle: (name: string, handler: () => Promise<unknown>) => handlers.set(name, handler) },
    host: { getPath: () => '/home/player', getLocale: () => 'en' },
    minecraftDataPath: '/home/player/.minecraft',
  } as any, {} as any)
  expect(await handlers.get('preset')!()).toMatchObject({ defaultPath: join('/home/player', '.vardrynn') })
})
