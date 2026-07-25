import { z } from 'zod'
import { GenericEventEmitter } from '../events'
import type { ServiceKey } from './Service'

export const SharedHostingServiceSchema = z.object({
  serviceId: z.string().min(1),
  subscriptionId: z.string().min(1),
  planId: z.string().min(1),
  status: z.string().min(1),
  workspace: z.object({
    revision: z.number().int().nonnegative(),
    sizeBytes: z.number().int().nonnegative(),
    syncedAt: z.string().optional(),
    storageOverageSince: z.string().optional(),
    storageGraceEndsAt: z.string().optional(),
  }).strict(),
  statusReason: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict()

export const SharedHostingBundleImportSchema = z.object({
  importId: z.string().min(1),
  serviceId: z.string().min(1),
  sourceFormat: z.literal('xmcl_server_bundle'),
  status: z.enum(['awaiting_upload', 'validating', 'valid', 'invalid']),
  validation: z.unknown().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict()

export const SharedHostingBundleUploadSchema = z.object({
  uploadUrl: z.string().url().refine(value => {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  }),
  expiresAt: z.string(),
  maxSizeBytes: z.number().int().positive(),
}).strict()

export const SharedHostingDeploymentSchema = z.object({
  deploymentId: z.string().min(1),
  serviceId: z.string().min(1),
  importId: z.string().min(1),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  status: z.enum([
    'compile_queued',
    'compiling',
    'compile_failed',
    'published',
    'awaiting_stop_sync',
    'selected',
  ]),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  descriptor: z.unknown().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict()

export const SharedWorldSeedSchema = z.object({
  seedId: z.string().min(1),
  serviceId: z.string().min(1),
  status: z.enum(['awaiting_upload', 'validating', 'valid', 'invalid', 'selected']),
  worldName: z.string().min(1).optional(),
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  expectedSizeBytes: z.number().int().positive(),
  files: z.array(z.object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    sizeBytes: z.number().int().nonnegative(),
  }).strict()).optional(),
  validation: z.object({ code: z.string().min(1) }).strict().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict()

export const SharedWorldSeedUploadSchema = SharedHostingBundleUploadSchema

export type SharedHostingServiceRecord = z.infer<typeof SharedHostingServiceSchema>
export type SharedHostingBundleImport = z.infer<typeof SharedHostingBundleImportSchema>
export type SharedHostingBundleUpload = z.infer<typeof SharedHostingBundleUploadSchema>
export type SharedHostingDeployment = z.infer<typeof SharedHostingDeploymentSchema>
export type SharedWorldSeed = z.infer<typeof SharedWorldSeedSchema>
export type SharedWorldSeedUpload = z.infer<typeof SharedWorldSeedUploadSchema>

export interface SharedHostingDeploymentServiceEventMap {
  'shared-hosting-bundle-upload-progress': {
    idempotencyKey: string
    uploadedBytes: number
    totalBytes: number
  }
  'shared-hosting-world-seed-upload-progress': {
    idempotencyKey: string
    uploadedBytes: number
    totalBytes: number
  }
}

/**
 * Generated from the reviewed shared-runtime catalog lock. This is catalog
 * data, not a Minecraft-version-to-Java mapping: the resolved local version
 * supplies the exact component/major pair and the exporter verifies it here.
 */
export const REVIEWED_SHARED_RUNTIME_CATALOG = {
  sha256: '7d35cc796811673ad1d22272d0ca3e5614d4ed7b3c6b01defb6e2330fe48bcc3',
  requirements: [
    { component: 'jre-legacy', major: 8 },
    { component: 'java-runtime-alpha', major: 16 },
    { component: 'java-runtime-beta', major: 17 },
    { component: 'java-runtime-gamma', major: 17 },
    { component: 'java-runtime-gamma-snapshot', major: 17 },
    { component: 'java-runtime-delta', major: 21 },
    { component: 'java-runtime-epsilon', major: 25 },
  ],
} as const

export interface SharedHostingDeploymentClientOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  getSessionToken: () => string | undefined | Promise<string | undefined>
}

export interface CreateSharedHostingBundleImport {
  serviceId: string
  expectedSha256: string
  expectedSizeBytes: number
  idempotencyKey: string
}

export interface CreateSharedWorldSeed {
  serviceId: string
  expectedSha256: string
  expectedSizeBytes: number
  idempotencyKey: string
}

export interface LocalWorldSeedCandidate {
  name: string
  path: string
  logicalSizeBytes: number
}

export class SharedHostingDeploymentApiError extends Error {
  readonly name = 'SharedHostingDeploymentApiError'

  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code)
  }
}

/**
 * Main-process API client for the local-instance shared-server handoff. It
 * never persists or logs the one-time object-store PUT URL.
 */
export class SharedHostingDeploymentApiClient {
  private readonly baseUrl: string
  private readonly fetch: typeof globalThis.fetch

  constructor(private readonly options: SharedHostingDeploymentClientOptions) {
    this.baseUrl = (options.baseUrl ?? 'https://api.xmcl.app').replace(/\/+$/, '')
    this.fetch = options.fetch ?? globalThis.fetch
  }

  listServices() {
    return this.request('/v1/shared-hosting/services', SharedHostingServiceSchema.array())
  }

  createBundleImport(input: CreateSharedHostingBundleImport) {
    validateImport(input)
    return this.mutate(
      `/v1/shared-hosting/services/${encodeId(input.serviceId)}/modpack-imports`,
      input.idempotencyKey,
      {
        sourceFormat: 'xmcl_server_bundle',
        expectedSha256: input.expectedSha256.toLowerCase(),
        expectedSizeBytes: input.expectedSizeBytes,
      },
      SharedHostingBundleImportSchema,
    )
  }

  createUploadUrl(importId: string, idempotencyKey: string) {
    return this.mutate(
      `/v1/shared-hosting/modpack-imports/${encodeId(importId)}/upload-url`,
      idempotencyKey,
      undefined,
      SharedHostingBundleUploadSchema,
    )
  }

  completeBundleImport(importId: string, idempotencyKey: string) {
    return this.mutate(
      `/v1/shared-hosting/modpack-imports/${encodeId(importId)}/complete`,
      idempotencyKey,
      undefined,
      SharedHostingBundleImportSchema,
    )
  }

  createDeployment(serviceId: string, importId: string, idempotencyKey: string) {
    return this.mutate(
      `/v1/shared-hosting/services/${encodeId(serviceId)}/modpack-deployments`,
      idempotencyKey,
      { importId },
      SharedHostingDeploymentSchema,
    )
  }

  listDeployments(serviceId: string) {
    return this.request(
      `/v1/shared-hosting/services/${encodeId(serviceId)}/modpack-deployments`,
      z.object({ items: SharedHostingDeploymentSchema.array() }).strict(),
    ).then(value => value.items)
  }

  createWorldSeed(input: CreateSharedWorldSeed) {
    validateWorldSeed(input)
    return this.mutate(
      `/v1/shared-hosting/services/${encodeId(input.serviceId)}/world-seeds`,
      input.idempotencyKey,
      { expectedSha256: input.expectedSha256.toLowerCase(), expectedSizeBytes: input.expectedSizeBytes },
      SharedWorldSeedSchema,
    )
  }

  createWorldSeedUploadUrl(seedId: string, idempotencyKey: string) {
    return this.mutate(
      `/v1/shared-hosting/world-seeds/${encodeId(seedId)}/upload-url`,
      idempotencyKey,
      undefined,
      SharedWorldSeedUploadSchema,
    )
  }

  completeWorldSeed(seedId: string, idempotencyKey: string) {
    return this.mutate(
      `/v1/shared-hosting/world-seeds/${encodeId(seedId)}/complete`,
      idempotencyKey,
      undefined,
      SharedWorldSeedSchema,
    )
  }

  listWorldSeeds(serviceId: string) {
    return this.request(
      `/v1/shared-hosting/services/${encodeId(serviceId)}/world-seeds`,
      SharedWorldSeedSchema.array(),
    )
  }

  private mutate<T>(
    path: string,
    idempotencyKey: string,
    body: unknown,
    schema: z.ZodType<T>,
  ) {
    const key = validIdempotencyKey(idempotencyKey)
    return this.request(path, schema, {
      method: 'POST',
      headers: {
        'Idempotency-Key': key,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  }

  private async request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    const token = await this.options.getSessionToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    let response: Response
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, { ...init, headers })
    } catch {
      throw new SharedHostingDeploymentApiError(0, 'network_error', true)
    }
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new SharedHostingDeploymentApiError(response.status, 'invalid_api_response', false)
    }
    if (!response.ok) {
      const code = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'shared_hosting_request_failed'
      throw new SharedHostingDeploymentApiError(
        response.status,
        code,
        response.status === 408 || response.status === 429 || response.status >= 500,
      )
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) throw new SharedHostingDeploymentApiError(response.status, 'invalid_api_response', false)
    return parsed.data
  }
}

export interface SharedHostingDeploymentService extends GenericEventEmitter<SharedHostingDeploymentServiceEventMap> {
  listSharedHostingServices(): Promise<SharedHostingServiceRecord[]>
  createSharedHostingBundleImport(input: CreateSharedHostingBundleImport): Promise<SharedHostingBundleImport>
  completeSharedHostingBundleImport(importId: string, idempotencyKey: string): Promise<SharedHostingBundleImport>
  createSharedHostingDeployment(serviceId: string, importId: string, idempotencyKey: string): Promise<SharedHostingDeployment>
  listSharedHostingDeployments(serviceId: string): Promise<SharedHostingDeployment[]>
  uploadLocalServerBundle(input: CreateSharedHostingBundleImport & {
    bundlePath: string
    maxAttempts?: number
  }): Promise<SharedHostingDeployment>
  cancelSharedHostingBundleUpload(idempotencyKey: string): Promise<void>
  listSharedHostingWorldSeeds(serviceId: string): Promise<SharedWorldSeed[]>
  listLocalWorldSeeds(instancePath: string): Promise<LocalWorldSeedCandidate[]>
  uploadLocalWorldSeed(input: {
    instancePath: string
    saveName: string
    serviceId: string
    idempotencyKey: string
    maxAttempts?: number
  }): Promise<SharedWorldSeed>
  cancelSharedHostingWorldSeedUpload(idempotencyKey: string): Promise<void>
}

export const SharedHostingDeploymentServiceKey: ServiceKey<SharedHostingDeploymentService> =
  'SharedHostingDeploymentService'

function validateImport(input: CreateSharedHostingBundleImport) {
  if (
    !validSha256(input.expectedSha256) ||
    !Number.isSafeInteger(input.expectedSizeBytes) ||
    input.expectedSizeBytes < 1 ||
    input.expectedSizeBytes > 512 * 1024 * 1024
  ) throw new RangeError('Invalid shared-server bundle hash or size')
}

function validateWorldSeed(input: CreateSharedWorldSeed) {
  if (
    !validSha256(input.expectedSha256) ||
    !Number.isSafeInteger(input.expectedSizeBytes) ||
    input.expectedSizeBytes < 1 ||
    input.expectedSizeBytes > 512 * 1024 * 1024
  ) throw new RangeError('Invalid shared world seed hash or size')
}

function validSha256(value: string) {
  return /^[a-f0-9]{64}$/i.test(value)
}

function encodeId(value: string) {
  const id = value.trim()
  if (!id) throw new RangeError('Resource id cannot be empty')
  return encodeURIComponent(id)
}

function validIdempotencyKey(value: string) {
  const key = value.trim()
  if (!key || key.length > 255 || /[\x00-\x1f\x7f]/.test(key)) {
    throw new RangeError('Invalid idempotency key')
  }
  return key
}
