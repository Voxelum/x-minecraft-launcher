export const DEFAULT_XMCL_API_BASE_URL = 'https://api.xmcl.app'
export const DEFAULT_XMCL_AI_API_BASE_URL = 'https://ai.xmcl.app'
export const DEFAULT_XMCL_SIGNALING_API_BASE_URL = 'https://signaling.xmcl.app'

export interface XmclApiEndpoints {
  common: string
  ai: string
  signaling: string
}

export function resolveXmclApiEndpoints(
  override: unknown,
  onInvalid?: () => void,
): XmclApiEndpoints {
  const custom = validOrigin(override)
  if (custom) {
    return {
      common: custom,
      ai: custom,
      signaling: custom,
    }
  }
  if (typeof override === 'string' && override.trim()) onInvalid?.()
  return {
    common: DEFAULT_XMCL_API_BASE_URL,
    ai: DEFAULT_XMCL_AI_API_BASE_URL,
    signaling: DEFAULT_XMCL_SIGNALING_API_BASE_URL,
  }
}

function validOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value.trim())
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.replace(/\/+$/, '') !== ''
    ) return undefined
    return url.origin
  } catch {
    return undefined
  }
}
