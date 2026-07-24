import type { Logger } from '~/infra'

export const DEFAULT_XMCL_API_BASE_URL = 'https://api.xmcl.app'

/**
 * Resolves the XMCL-owned API origin used by main-process API consumers.
 */
export function resolveXmclApiBaseUrl(
  override = 'https://xmcl-web-api.cijhn.workers.dev',
  logger?: Pick<Logger, 'warn'>,
): string {
  if (!override?.trim()) return DEFAULT_XMCL_API_BASE_URL

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

  logger?.warn('Ignoring invalid XMCL_API_BASE_URL; using the default XMCL API origin.')
  return DEFAULT_XMCL_API_BASE_URL
}
