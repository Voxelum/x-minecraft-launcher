import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_XMCL_API_BASE_URL, resolveXmclApiBaseUrl } from './xmclApiBaseUrl'

describe('resolveXmclApiBaseUrl', () => {
  it('normalizes a HTTPS origin and strips trailing slashes', () => {
    expect(resolveXmclApiBaseUrl('https://xmcl-web-api.cijhn.workers.dev///')).toBe(
      'https://xmcl-web-api.cijhn.workers.dev',
    )
  })

  it('falls back safely and warns when the override is not a HTTPS origin', () => {
    const logger = { warn: vi.fn() }

    expect(resolveXmclApiBaseUrl('http://example.test/api', logger)).toBe(DEFAULT_XMCL_API_BASE_URL)
    expect(logger.warn).toHaveBeenCalledWith(
      'Ignoring invalid XMCL_API_BASE_URL; using the default XMCL API origin.',
    )
  })
})
