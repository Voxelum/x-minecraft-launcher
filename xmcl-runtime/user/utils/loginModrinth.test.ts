import { EventEmitter } from 'events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { loginModrinth } from './loginModrinth'

function createStorage() {
  const values = new Map<string, string>()
  return {
    values,
    get: vi.fn(async (service: string, account: string) => values.get(`${service}/${account}`)),
    put: vi.fn(async (service: string, account: string, value: string) => {
      values.set(`${service}/${account}`, value)
    }),
  }
}

let previousApiBaseUrl: string | undefined

afterEach(() => {
  if (previousApiBaseUrl === undefined) delete process.env.XMCL_API_BASE_URL
  else process.env.XMCL_API_BASE_URL = previousApiBaseUrl
})

describe('loginModrinth', () => {
  it('stores successful OAuth credentials once and emits one lifecycle signal', async () => {
    previousApiBaseUrl = process.env.XMCL_API_BASE_URL
    process.env.XMCL_API_BASE_URL = 'https://xmcl-web-api.cijhn.workers.dev/'
    const storage = createStorage()
    const app = Object.assign(new EventEmitter(), {
      secretStorage: storage,
      getLogger: vi.fn().mockReturnValue({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }),
      serverPort: Promise.resolve(25555),
      shell: {
        openInBrowser: vi.fn(),
      },
      controller: {
        requireFocus: vi.fn(),
      },
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'modrinth-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      }),
    })
    const credentials = new ExternalCredentialService(app as any)
    const changes: unknown[] = []
    credentials.onCredentialChange((change) => changes.push(change))
    const userService = new EventEmitter()
    vi.mocked(app.shell.openInBrowser).mockImplementation(() => {
      queueMicrotask(() =>
        userService.emit('modrinth-authorize-code', undefined, 'authorization-code'),
      )
      return Promise.resolve(true)
    })

    await loginModrinth(
      app as any,
      userService as any,
      ['USER_READ'],
      false,
      undefined,
      credentials,
    )

    expect(JSON.parse(storage.values.get('xmcl-external-credentials/modrinth')!)).toMatchObject({
      accessToken: 'modrinth-access-token',
      scopes: ['USER_READ'],
    })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ provider: 'modrinth', type: 'stored' })
    expect(String(vi.mocked(app.fetch).mock.calls[0]![0]))
      .toBe('https://xmcl-web-api.cijhn.workers.dev/modrinth/auth?code=authorization-code&redirect_uri=http%3A%2F%2F127.0.0.1%3A25555%2Fmodrinth-auth')
  })
})
