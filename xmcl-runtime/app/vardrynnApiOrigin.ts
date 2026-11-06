import {
  VARDRYNN_API_ORIGIN_FLIGHT,
  VARDRYNN_API_VERSION,
  parseVardrynnStatus,
  type VardrynnServiceStatus,
} from '@xmcl/runtime-api'
import { isUpstreamLauncherUrl } from '~/network/upstreamNetworkPolicy'

export const VARDRYNN_SERVICE_UNCONFIGURED = 'vardrynn_service_unconfigured'

const STATUS_TIMEOUT = 5_000
const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]']

/**
 * Validate the build-time service origin. Anything rejected here leaves the
 * service unconfigured; there is deliberately no default to fall back to.
 */
export function resolveVardrynnApiOrigin(
  value: unknown,
  options: { allowLoopback?: boolean; onInvalid?: () => void } = {},
): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const origin = parseOrigin(value.trim(), options.allowLoopback)
  if (!origin) options.onInvalid?.()
  return origin
}

function parseOrigin(value: string, allowLoopback = false): string | undefined {
  try {
    const url = new URL(value)
    const loopbackHttp =
      allowLoopback && url.protocol === 'http:' && LOOPBACK_HOSTS.includes(url.hostname)
    if (
      (url.protocol !== 'https:' && !loopbackHttp) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.replace(/\/+$/, '') !== '' ||
      isUpstreamLauncherUrl(url)
    ) return undefined
    return url.origin
  } catch {
    return undefined
  }
}

export function getVardrynnApiOrigin(flights: Record<string, any>): string | undefined {
  return flights[VARDRYNN_API_ORIGIN_FLIGHT]
}

export function requireVardrynnApiOrigin(flights: Record<string, any>): string {
  const origin = getVardrynnApiOrigin(flights)
  if (!origin) throw new Error(VARDRYNN_SERVICE_UNCONFIGURED)
  return origin
}

export async function fetchVardrynnServiceStatus(
  fetch: (input: URL, init: RequestInit) => Promise<Response>,
  origin: string | undefined,
): Promise<VardrynnServiceStatus> {
  if (!origin) return { state: 'unconfigured' }
  let response: Response
  try {
    // A redirect could leave the approved origin, so it is a failure here.
    response = await fetch(new URL(`/${VARDRYNN_API_VERSION}/status`, origin), {
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(STATUS_TIMEOUT),
    })
  } catch {
    return { state: 'unreachable' }
  }
  if (!response.ok) return { state: response.status >= 500 ? 'unreachable' : 'incompatible' }
  return parseVardrynnStatus(await response.json().catch(() => undefined))
}
