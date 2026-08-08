import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_XMCL_AI_API_BASE_URL,
  DEFAULT_XMCL_API_BASE_URL,
  DEFAULT_XMCL_SIGNALING_API_BASE_URL,
  resolveXmclApiEndpoints,
  resolveXmclApiBaseUrl,
} from './xmclApiBaseUrl'

describe('resolveXmclApiBaseUrl', () => {
  it('normalizes a HTTPS origin and strips trailing slashes', () => {
    expect(resolveXmclApiBaseUrl('https://edge.example.test///')).toBe('https://edge.example.test')
  })

  it('falls back safely and warns when the override is not a HTTPS origin', () => {
    const logger = { warn: vi.fn() }

    expect(resolveXmclApiBaseUrl('http://example.test/api', logger)).toBe(DEFAULT_XMCL_API_BASE_URL)
    expect(logger.warn).toHaveBeenCalledWith(
      'Ignoring invalid xmclApiUrl flight; using default XMCL API origins.',
    )
  })

  it('uses the production API when the flight is absent', () => {
    expect(resolveXmclApiBaseUrl(undefined)).toBe(DEFAULT_XMCL_API_BASE_URL)
  })

  it('defines a separate production signaling origin', () => {
    expect(DEFAULT_XMCL_SIGNALING_API_BASE_URL).toBe('https://signaling.xmcl.app')
  })

  it('resolves all production service origins together', () => {
    expect(resolveXmclApiEndpoints(undefined)).toEqual({
      common: DEFAULT_XMCL_API_BASE_URL,
      ai: DEFAULT_XMCL_AI_API_BASE_URL,
      signaling: DEFAULT_XMCL_SIGNALING_API_BASE_URL,
    })
  })

  it('uses one custom origin for all service surfaces', () => {
    expect(resolveXmclApiEndpoints('https://edge.example.test')).toEqual({
      common: 'https://edge.example.test',
      ai: 'https://edge.example.test',
      signaling: 'https://edge.example.test',
    })
  })
})
