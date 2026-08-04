import { EventEmitter } from 'events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type ExternalCredentialChange,
  ExternalCredentialService,
} from '../credential/ExternalCredentialService'
import { XmclAccountService } from './XmclAccountService'
import { pluginXmclAccountMicrosoftBridge } from './pluginXmclAccountMicrosoftBridge'

vi.mock('./XmclAccountService', () => ({
  XmclAccountService: class XmclAccountService {},
}))

vi.mock('../user/UserService', () => ({
  UserService: class UserService {},
}))

class CredentialLifecycle {
  private listener: ((change: ExternalCredentialChange) => void) | undefined

  onCredentialChange = vi.fn((listener: (change: ExternalCredentialChange) => void) => {
    this.listener = listener
    return () => {
      this.listener = undefined
    }
  })

  emit(change: ExternalCredentialChange) {
    this.listener?.(change)
  }
}

function createApp(bootstrap = vi.fn().mockResolvedValue(undefined)) {
  const logger = { warn: vi.fn() }
  const credentials = new CredentialLifecycle()
  const app = Object.assign(new EventEmitter(), {
    registry: {
      getOrCreate: vi.fn((service) => {
        if (service === ExternalCredentialService) return Promise.resolve(credentials)
        if (service === XmclAccountService)
          return Promise.resolve({ bootstrapMicrosoft: bootstrap })
        throw new Error('unexpected service')
      }),
    },
    getLogger: vi.fn().mockReturnValue(logger),
  })
  return { app, bootstrap, credentials, logger }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Xmcl Microsoft bridge', () => {
  it('bridges a Microsoft lifecycle notification once using its persisted profile id', async () => {
    const { app, bootstrap, credentials } = createApp()
    pluginXmclAccountMicrosoftBridge(app as any, {} as any)
    await vi.waitFor(() => expect(credentials.onCredentialChange).toHaveBeenCalledTimes(1))

    credentials.emit({
      provider: 'microsoft',
      type: 'microsoft-authenticated',
      occurredAt: Date.now(),
      subject: 'persisted-microsoft-id',
    })

    await vi.waitFor(() => {
      expect(bootstrap).toHaveBeenCalledTimes(1)
      expect(bootstrap).toHaveBeenCalledWith('persisted-microsoft-id')
    })
  })

  it('does not retry when xmcl bootstrap fails', async () => {
    const bootstrap = vi.fn().mockRejectedValue(new Error('xmcl bootstrap failed'))
    const { app, credentials, logger } = createApp(bootstrap)
    pluginXmclAccountMicrosoftBridge(app as any, {} as any)
    await vi.waitFor(() => expect(credentials.onCredentialChange).toHaveBeenCalledTimes(1))

    vi.useFakeTimers()
    try {
      credentials.emit({
        provider: 'microsoft',
        type: 'microsoft-authenticated',
        occurredAt: Date.now(),
        subject: 'microsoft-user-id',
      })

      await vi.advanceTimersByTimeAsync(5 * 60_000)

      expect(bootstrap).toHaveBeenCalledTimes(1)
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to bootstrap XMCL account from Microsoft authentication.',
        expect.any(Error),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for a Microsoft credential lifecycle event during startup', async () => {
    const { app, bootstrap, credentials } = createApp()

    pluginXmclAccountMicrosoftBridge(app as any, {} as any)
    await vi.waitFor(() => expect(credentials.onCredentialChange).toHaveBeenCalledTimes(1))

    expect(bootstrap).not.toHaveBeenCalled()
  })
})
