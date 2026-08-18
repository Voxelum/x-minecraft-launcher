import { describe, expect, it } from 'vitest'
import { getErrorMessage, isDownloadError } from './error'

describe('getErrorMessage', () => {
  it('uses a serialized service error description', () => {
    expect(getErrorMessage({
      name: 'ModrinthApiError',
      status: 401,
      description: 'Authentication method was not valid',
    })).toBe('Authentication method was not valid')
  })

  it('extracts a Modrinth API description from a serialized body', () => {
    expect(getErrorMessage({
      body: JSON.stringify({
        error: 'unauthorized',
        description: 'Authentication Error: Authentication method was not valid',
      }),
    })).toBe('Authentication Error: Authentication method was not valid')
  })

  it('falls back to standard error messages', () => {
    expect(getErrorMessage(new Error('Network unavailable'))).toBe('Network unavailable')
  })

  it('recognizes nested serialized download failures', () => {
    expect(isDownloadError([{
      name: 'InstallFileDownloadError',
      cause: { code: 'ECONNRESET' },
    }])).toBe(true)
    expect(isDownloadError({
      name: 'AggregateError',
      errors: [{ name: 'SocketError' }],
    })).toBe(true)
  })

  it('does not classify postprocess failures as download failures', () => {
    expect(isDownloadError({
      name: 'ProcessExitError',
      message: 'load patch bundle failed unexpectedly',
    })).toBe(false)
  })
})