/** Path prefix of the service contract described in VARDRYNN_SERVICE_API.md. */
export const VARDRYNN_API_VERSION = 'v1'

/** The local flight carrying the validated origin. It is never set remotely. */
export const VARDRYNN_API_ORIGIN_FLIGHT = 'vardrynnApiBaseUrl'

export type VardrynnOperationalState = 'ok' | 'degraded' | 'maintenance'

/** `GET /v1/status` */
export interface VardrynnStatusResponse {
  apiVersion: typeof VARDRYNN_API_VERSION
  state: VardrynnOperationalState
  message?: string
}

/** `GET /v1/config` */
export interface VardrynnConfigResponse {
  apiVersion: typeof VARDRYNN_API_VERSION
  flags: Record<string, string | number | boolean>
}

export interface VardrynnNewsItem {
  category: string
  image: {
    url: string
    width: number
    height: number
  }
  date: string
  title: string
  description: string
  link: string
}

/** `GET /v1/news` */
export interface VardrynnNewsResponse {
  apiVersion: typeof VARDRYNN_API_VERSION
  items: VardrynnNewsItem[]
}

/** `GET /v1/releases/latest` */
export interface VardrynnReleaseResponse {
  apiVersion: typeof VARDRYNN_API_VERSION
  version: string
  channel: string
  publishedAt: string
  notesUrl: string
  assets: Array<{
    platform: string
    arch: string
    url: string
    sha256: string
    signature: string
  }>
}

/** `POST /v1/sessions` and `GET /v1/sessions/current` */
export interface VardrynnSessionResponse {
  apiVersion: typeof VARDRYNN_API_VERSION
  accountId: string
  expiresAt: string
}

/**
 * What the launcher can say about the service. Everything other than an
 * operational state means online features are off and local features continue.
 */
export type VardrynnServiceState =
  | VardrynnOperationalState
  | 'unconfigured'
  | 'unreachable'
  | 'incompatible'

export interface VardrynnServiceStatus {
  state: VardrynnServiceState
  message?: string
}

export function parseVardrynnStatus(body: unknown): VardrynnServiceStatus {
  const { apiVersion, state, message } = (body ?? {}) as Partial<VardrynnStatusResponse>
  if (apiVersion !== VARDRYNN_API_VERSION || !['ok', 'degraded', 'maintenance'].includes(state as string)) {
    return { state: 'incompatible' }
  }
  return typeof message === 'string' ? { state: state!, message } : { state: state! }
}

export function parseVardrynnNews(body: unknown): VardrynnNewsItem[] {
  const { apiVersion, items } = (body ?? {}) as Partial<VardrynnNewsResponse>
  return apiVersion === VARDRYNN_API_VERSION && Array.isArray(items) ? items : []
}
