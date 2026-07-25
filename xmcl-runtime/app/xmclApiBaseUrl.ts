import type { Logger } from '~/infra'

export const DEFAULT_XMCL_API_BASE_URL = 'https://api.xmcl.app'
export const XMCL_API_BASE_URL_FLIGHT = 'xmclApiBaseUrl'

/**
 * Resolves the XMCL-owned API origin used by main-process API consumers.
 */
export function resolveXmclApiBaseUrl(override: unknown, logger?: Pick<Logger, 'warn'>): string {
  if (typeof override !== 'string' || !override.trim()) {
    return DEFAULT_XMCL_API_BASE_URL
  }

  try {
    const url = new URL(override.trim())
    const isOrigin =
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.replace(/\/+$/, '') === ''
    if (isOrigin) return url.origin
  } catch {
    // Fall through to the safe default.
  }

  logger?.warn('Ignoring invalid xmclApiBaseUrl flight; using the default XMCL API origin.')
  return DEFAULT_XMCL_API_BASE_URL
}
