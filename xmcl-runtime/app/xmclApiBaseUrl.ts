import type { Logger } from '~/infra'
import {
  DEFAULT_XMCL_AI_API_BASE_URL,
  DEFAULT_XMCL_API_BASE_URL,
  DEFAULT_XMCL_SIGNALING_API_BASE_URL,
  resolveXmclApiEndpoints,
} from '@xmcl/runtime-api'

export const XMCL_API_BASE_URL_FLIGHT = 'xmclApiBaseUrl'

/**
 * Backwards-compatible common-origin resolver for main-process consumers.
 */
export function resolveXmclApiBaseUrl(override: unknown, logger?: Pick<Logger, 'warn'>): string {
  return resolveXmclApiEndpoints(override, () => {
    logger?.warn('Ignoring invalid xmclApiUrl flight; using default XMCL API origins.')
  }).common
}

export {
  DEFAULT_XMCL_AI_API_BASE_URL,
  DEFAULT_XMCL_API_BASE_URL,
  DEFAULT_XMCL_SIGNALING_API_BASE_URL,
  resolveXmclApiEndpoints,
}
