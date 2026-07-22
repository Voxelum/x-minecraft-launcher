import { describe, expect, it } from 'vitest'
import { MicrosoftMinecraftXboxLoginError } from '@xmcl/user'
import { isAccountSuspendedError, isNetworkError, isUserCanceledError } from './MicrosoftAuthErrors'

describe('isAccountSuspendedError', () => {
  it('recognizes the permanent account suspension response', () => {
    const error = new MicrosoftMinecraftXboxLoginError(
      403,
      JSON.stringify({ details: { reason: 'ACCOUNT_SUSPENDED' } }),
    )

    expect(isAccountSuspendedError(error)).toBe(true)
  })

  it('does not classify unrelated login failures as suspension', () => {
    expect(isAccountSuspendedError(new MicrosoftMinecraftXboxLoginError(403, '{"details":{"reason":"OTHER"}}'))).toBe(false)
    expect(isAccountSuspendedError(new MicrosoftMinecraftXboxLoginError(429, '{"details":{"reason":"ACCOUNT_SUSPENDED"}}'))).toBe(false)
  })
})

describe('isUserCanceledError', () => {
  it('recognizes both MSAL cancellation spellings', () => {
    expect(isUserCanceledError(new Error('user_canceled: account picker closed'))).toBe(true)
    expect(isUserCanceledError(new Error('user_cancelled: authorization closed'))).toBe(true)
  })

  it('does not classify unrelated authentication errors as cancellation', () => {
    expect(isUserCanceledError(new Error('network_error: request failed'))).toBe(false)
  })
})

describe('isNetworkError', () => {
  it('recognizes MSAL network_error results', () => {
    expect(isNetworkError({ errorCode: 'network_error' })).toBe(true)
    expect(isNetworkError(new Error('network_error: token endpoint unreachable'))).toBe(true)
  })

  it('does not classify user cancellation as a network error', () => {
    expect(isNetworkError(new Error('user_canceled: account picker closed'))).toBe(false)
  })
})
