import { z } from 'zod'
import type { ServiceKey } from './Service'

export const CLOUD_SERVER_CONTRACT = 'm4.server-control.v1-proposal'

export const CloudServerStatusSchema = z.enum([
  'creating',
  'stopped',
  'starting',
  'running',
  'stopping',
  'suspended',
  'billing_blocked',
  'failed',
  'deleting',
  'deleted',
])

export const CloudServerSchema = z.object({
  serverId: z.string().min(1),
  accountId: z.string().min(1),
  provider: z.literal('vultr'),
  region: z.literal('taipei'),
  status: CloudServerStatusSchema,
  desiredStatus: z.enum(['running', 'stopped', 'deleted']),
  statusVersion: z.number().int().nonnegative(),
  statusReason: z.string().optional(),
  address: z.string().optional(),
  leaseId: z.string().min(1).optional(),
}).strict()

export const CloudServerListSchema = z.array(CloudServerSchema)

export const CloudServerLogSchema = z.object({
  logId: z.string().min(1),
  serverId: z.string().min(1),
  source: z.literal('cloud_server'),
  sequence: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
  stream: z.enum(['stdout', 'stderr']),
  message: z.string(),
}).strict()

export const CloudServerLogPageSchema = z.object({
  items: z.array(CloudServerLogSchema),
  nextCursor: z.string().min(1).optional(),
}).strict()

export const CloudServerLogsOptionsSchema = z.object({
  serverId: z.string().min(1),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(500).optional(),
}).strict()

export const CloudServerApiErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1),
  details: z.unknown().optional(),
}).strict()

export const CloudServerTaskStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
])

export const CloudServerTaskSchema = z.object({
  taskId: z.string().min(1),
  requestId: z.string().min(1),
  status: CloudServerTaskStatusSchema,
  resource: z.object({
    type: z.literal('server'),
    id: z.string().min(1),
  }).strict().optional(),
  result: z.unknown().optional(),
  error: CloudServerApiErrorSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

export const CloudServerTaskAcceptedSchema = z.object({
  taskId: z.string().min(1),
  requestId: z.string().min(1),
}).strict()

export const CloudServerCreateRequestSchema = z.object({
  plan: z.string().min(1),
}).strict()

/**
 * M4-local usage proposal. M3 remains authoritative for rates, balances, and
 * settlement; this only presents the M5 server-time meter for one server.
 */
export const CloudServerUsageSchema = z.object({
  serverId: z.string().min(1),
  resource: z.literal('server_time'),
  unit: z.literal('second'),
  quantity: z.number().int().nonnegative(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

export type CloudServerStatus = z.infer<typeof CloudServerStatusSchema>
export type CloudServer = z.infer<typeof CloudServerSchema>
export type CloudServerLog = z.infer<typeof CloudServerLogSchema>
export type CloudServerLogPage = z.infer<typeof CloudServerLogPageSchema>
export type CloudServerLogsOptions = z.infer<typeof CloudServerLogsOptionsSchema>
export type CloudServerApiErrorBody = z.infer<typeof CloudServerApiErrorSchema>
export type CloudServerTaskStatus = z.infer<typeof CloudServerTaskStatusSchema>
export type CloudServerTask = z.infer<typeof CloudServerTaskSchema>
export type CloudServerTaskAccepted = z.infer<typeof CloudServerTaskAcceptedSchema>
export type CloudServerCreateRequest = z.infer<typeof CloudServerCreateRequestSchema>
export type CloudServerUsage = z.infer<typeof CloudServerUsageSchema>

export type CloudServerErrorCategory = 'permission' | 'balance' | 'quota' | 'provider' | 'api'

export interface CloudServerMutationOptions {
  /**
   * Stable per user intent. Retrying the same operation must reuse this key.
   */
  idempotencyKey: string
}

export interface CloudServerApiClientOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  getSessionToken: () => string | undefined | Promise<string | undefined>
  maxAttempts?: number
}

export class CloudServerApiError extends Error {
  readonly name = 'CloudServerApiError'

  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
    readonly requestId: string,
    readonly category: CloudServerErrorCategory,
    readonly retryable: boolean,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export interface CloudServerService {
  listServers(): Promise<CloudServer[]>
  getServer(serverId: string): Promise<CloudServer>
  getServerLogs(options: CloudServerLogsOptions): Promise<CloudServerLogPage>
  createServer(request: CloudServerCreateRequest, options: CloudServerMutationOptions): Promise<CloudServerTaskAccepted>
  startServer(serverId: string, options: CloudServerMutationOptions): Promise<CloudServerTaskAccepted>
  stopServer(serverId: string, options: CloudServerMutationOptions): Promise<CloudServerTaskAccepted>
  restartServer(serverId: string, options: CloudServerMutationOptions): Promise<CloudServerTaskAccepted>
  deleteServer(serverId: string, options: CloudServerMutationOptions): Promise<CloudServerTaskAccepted>
  getTask(taskId: string): Promise<CloudServerTask>
  getUsage(serverId: string): Promise<CloudServerUsage>
}

export const CloudServerServiceKey: ServiceKey<CloudServerService> = 'CloudServerService'

/**
 * Public XMCL M4 API consumer. Provider credentials and provider response
 * shapes are intentionally absent: this client only accepts the public XMCL
 * contract.
 */
export class CloudServerApiClient implements CloudServerService {
  private readonly baseUrl: string
  private readonly fetch: typeof globalThis.fetch
  private readonly maxAttempts: number

  constructor(private readonly options: CloudServerApiClientOptions) {
    this.baseUrl = (options.baseUrl ?? 'https://api.xmcl.app').replace(/\/+$/, '')
    this.fetch = options.fetch ?? globalThis.fetch
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 2)
  }

  listServers() {
    return this.request('/v1/servers', CloudServerListSchema)
  }

  getServer(serverId: string) {
    return this.request(`/v1/servers/${encodeId(serverId)}`, CloudServerSchema)
  }

  getServerLogs(options: CloudServerLogsOptions) {
    const parsed = CloudServerLogsOptionsSchema.parse(options)
    const query = new URLSearchParams()
    if (parsed.cursor) query.set('cursor', parsed.cursor)
    if (parsed.limit) query.set('limit', parsed.limit.toString())
    const suffix = query.size === 0 ? '' : `?${query}`
    return this.request(`/v1/servers/${encodeId(parsed.serverId)}/logs${suffix}`, CloudServerLogPageSchema)
  }

  createServer(request: CloudServerCreateRequest, options: CloudServerMutationOptions) {
    const body = CloudServerCreateRequestSchema.parse(request)
    return this.mutate('/v1/servers', 'POST', options, body)
  }

  startServer(serverId: string, options: CloudServerMutationOptions) {
    return this.serverCommand(serverId, 'start', options)
  }

  stopServer(serverId: string, options: CloudServerMutationOptions) {
    return this.serverCommand(serverId, 'stop', options)
  }

  restartServer(serverId: string, options: CloudServerMutationOptions) {
    return this.serverCommand(serverId, 'restart', options)
  }

  deleteServer(serverId: string, options: CloudServerMutationOptions) {
    return this.mutate(`/v1/servers/${encodeId(serverId)}`, 'DELETE', options)
  }

  getTask(taskId: string) {
    return this.request(`/v1/tasks/${encodeId(taskId)}`, CloudServerTaskSchema)
  }

  getUsage(serverId: string) {
    return this.request(`/v1/servers/${encodeId(serverId)}/usage`, CloudServerUsageSchema)
  }

  private serverCommand(serverId: string, command: 'start' | 'stop' | 'restart', options: CloudServerMutationOptions) {
    return this.mutate(`/v1/servers/${encodeId(serverId)}/${command}`, 'POST', options)
  }

  private mutate(path: string, method: 'POST' | 'DELETE', options: CloudServerMutationOptions, body?: unknown) {
    const idempotencyKey = options.idempotencyKey.trim()
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw new RangeError('idempotencyKey must contain between 1 and 128 characters')
    }
    return this.request(path, CloudServerTaskAcceptedSchema, {
      method,
      headers: {
        'Idempotency-Key': idempotencyKey,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  private async request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
    const sessionToken = await this.options.getSessionToken()
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`)

    let response: Response | undefined
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        response = await this.fetch(`${this.baseUrl}${path}`, { ...init, headers })
      } catch (cause) {
        if (attempt < this.maxAttempts) continue
        throw new CloudServerApiError(
          0,
          'network_error',
          'The XMCL server API could not be reached.',
          '',
          'api',
          true,
          undefined,
          { cause },
        )
      }
      if (!isTransientStatus(response.status) || attempt === this.maxAttempts) break
    }

    if (!response) {
      throw new CloudServerApiError(0, 'network_error', 'The XMCL server API could not be reached.', '', 'api', true)
    }
    const payload = await readJson(response)
    if (!response.ok) throw toCloudServerApiError(response.status, payload)

    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      throw new CloudServerApiError(
        response.status,
        'invalid_api_response',
        'The XMCL server API returned an invalid response.',
        response.headers.get('x-request-id') ?? '',
        'api',
        false,
        undefined,
        { cause: parsed.error },
      )
    }
    return parsed.data
  }
}

export function isCloudServerTaskTerminal(task: CloudServerTask): boolean {
  return task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled'
}

function encodeId(value: string): string {
  const id = value.trim()
  if (!id) throw new RangeError('Resource id cannot be empty')
  return encodeURIComponent(id)
}

function isTransientStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch (cause) {
    throw new CloudServerApiError(
      response.status,
      'invalid_api_response',
      'The XMCL server API returned an invalid response.',
      response.headers.get('x-request-id') ?? '',
      'api',
      false,
      undefined,
      { cause },
    )
  }
}

function toCloudServerApiError(status: number, payload: unknown): CloudServerApiError {
  const parsed = CloudServerApiErrorSchema.safeParse(payload)
  if (!parsed.success) {
    return new CloudServerApiError(
      status,
      'invalid_api_response',
      'The XMCL server API returned an invalid error response.',
      '',
      'api',
      false,
      undefined,
      { cause: parsed.error },
    )
  }
  const body = parsed.data
  return new CloudServerApiError(
    status,
    body.error,
    body.message,
    body.requestId,
    classifyCloudServerError(status, body.error),
    isRetryableApiError(status, body.error),
    sanitizeApiDetails(body.details),
  )
}

export function classifyCloudServerError(status: number, errorCode: string): CloudServerErrorCategory {
  if (status === 401 || status === 403 || errorCode === 'session_required' || errorCode === 'permission_denied') {
    return 'permission'
  }
  if (status === 402 || errorCode === 'usage_authorization_rejected' || errorCode === 'balance_insufficient') {
    return 'balance'
  }
  if (status === 429 || errorCode === 'quota_exceeded' || errorCode === 'provider_capacity_unavailable') {
    return 'quota'
  }
  if (errorCode.startsWith('provider_')) return 'provider'
  return 'api'
}

function isRetryableApiError(status: number, errorCode: string): boolean {
  return isTransientStatus(status) || status === 408 || errorCode === 'provider_timeout' || errorCode === 'provider_unavailable'
}

function sanitizeApiDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeApiDetails)
  if (!value || typeof value !== 'object') return value

  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (/(?:token|secret|authorization|api.?key|provider.?body|provider.?response|provider.?resource.?id)/i.test(key)) continue
    result[key] = sanitizeApiDetails(child)
  }
  return result
}
