import { z } from 'zod'
import type { ServiceKey } from './Service'

export const ModpackSourceFormatSchema = z.enum(['mrpack', 'curseforge_zip'])
export const ModpackProviderSchema = z.enum(['modrinth', 'curseforge'])
export const ModpackValidationStatusSchema = z.enum(['pending', 'valid', 'invalid'])
export const ModpackDeploymentStatusSchema = z.enum([
  'preparing',
  'ready',
  'applying',
  'succeeded',
  'apply_failed',
  'rolling_back',
  'rolled_back',
  'rollback_failed',
])
export const ModpackTaskStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
])

export const ModpackApiErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1),
  details: z.unknown().optional(),
}).strict()

export const ModpackAsyncTaskSchema = z.object({
  taskId: z.string().min(1),
  requestId: z.string().min(1),
  status: ModpackTaskStatusSchema,
  resource: z.object({
    type: z.string().min(1),
    id: z.string().min(1),
  }).strict().optional(),
  result: z.unknown().optional(),
  error: ModpackApiErrorSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

export const ModpackValidationReportSchema = z.object({
  importId: z.string().min(1),
  sourceFormat: ModpackSourceFormatSchema,
  status: ModpackValidationStatusSchema,
  configFiles: z.array(z.string()),
  dataFiles: z.array(z.string()),
  mods: z.array(z.object({
    provider: ModpackProviderSchema,
    projectId: z.string().min(1),
    fileId: z.string().min(1),
    filename: z.string().min(1),
  }).strict()),
  rejectedFiles: z.array(z.object({
    path: z.string(),
    reason: z.string().min(1),
  }).strict()),
}).strict()

const DeploymentFileSchema = z.object({
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
}).strict()

export const DeploymentManifestSchema = z.object({
  manifestVersion: z.number().int().positive(),
  deploymentId: z.string().min(1),
  serverId: z.string().min(1),
  sourceFormat: ModpackSourceFormatSchema,
  compatibility: z.object({
    minecraftVersion: z.string().min(1),
    loader: z.enum(['vanilla', 'forge', 'fabric', 'quilt', 'neoforge']),
    loaderVersion: z.string().min(1).optional(),
    javaMajor: z.number().int().positive(),
    templateId: z.string().min(1),
  }).strict(),
  configFiles: z.array(DeploymentFileSchema),
  dataFiles: z.array(DeploymentFileSchema),
  mods: z.array(z.object({
    provider: ModpackProviderSchema,
    projectId: z.string().min(1),
    fileId: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict()),
  rollbackSnapshotId: z.string().min(1),
}).strict()

export const ModpackDeploymentSchema = z.object({
  deploymentId: z.string().min(1),
  serverId: z.string().min(1),
  importId: z.string().min(1),
  status: ModpackDeploymentStatusSchema,
  statusVersion: z.number().int().nonnegative(),
  manifest: DeploymentManifestSchema.optional(),
  lastTaskId: z.string().min(1).optional(),
  failure: ModpackApiErrorSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()

const DeploymentPreviewItemSchema = z.object({
  path: z.string().min(1),
  change: z.enum(['add', 'replace', 'remove', 'unchanged']),
}).strict()

export const DeploymentPreviewSchema = z.object({
  deploymentId: z.string().min(1),
  statusVersion: z.number().int().nonnegative(),
  configFiles: z.array(DeploymentPreviewItemSchema),
  dataFiles: z.array(DeploymentPreviewItemSchema),
  mods: z.array(z.object({
    provider: ModpackProviderSchema,
    projectId: z.string().min(1),
    fileId: z.string().min(1),
    change: z.enum(['add', 'replace', 'remove', 'unchanged']),
  }).strict()),
  warnings: z.array(z.string()),
}).strict()

const CreateImportResponseSchema = z.object({
  importId: z.string().min(1),
  constraints: z.object({
    maxSizeBytes: z.number().int().positive(),
    allowedFormats: z.array(ModpackSourceFormatSchema).min(1),
  }).strict(),
}).strict()

const SignedUploadSchema = z.object({
  url: z.string().url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  maxSizeBytes: z.number().int().positive(),
  expiresAt: z.string().datetime(),
}).strict()

const CreateDeploymentResponseSchema = z.object({
  deploymentId: z.string().min(1),
  task: ModpackAsyncTaskSchema,
}).strict()

const DeploymentPageSchema = z.object({
  items: z.array(ModpackDeploymentSchema),
  nextCursor: z.string().min(1).optional(),
}).strict()

export type ModpackSourceFormat = z.infer<typeof ModpackSourceFormatSchema>
export type ModpackApiError = z.infer<typeof ModpackApiErrorSchema>
export type ModpackAsyncTask = z.infer<typeof ModpackAsyncTaskSchema>
export type ModpackValidationReport = z.infer<typeof ModpackValidationReportSchema>
export type DeploymentManifest = z.infer<typeof DeploymentManifestSchema>
export type ModpackDeployment = z.infer<typeof ModpackDeploymentSchema>
export type DeploymentPreview = z.infer<typeof DeploymentPreviewSchema>
export type SignedModpackUpload = z.infer<typeof SignedUploadSchema>

export interface SelectedModpackPackage {
  name: string
  size: number
  type?: string
  body: Blob
}

export interface ModpackDeploymentService {
  createImport(serverId: string, input: {
    fileName: string
    sizeBytes: number
    sourceFormat: ModpackSourceFormat
    idempotencyKey: string
  }): Promise<z.infer<typeof CreateImportResponseSchema>>
  requestUploadUrl(importId: string, input: {
    sizeBytes: number
    contentType: string
    idempotencyKey: string
  }): Promise<SignedModpackUpload>
  uploadPackage(upload: SignedModpackUpload, file: SelectedModpackPackage): Promise<void>
  completeImport(importId: string, idempotencyKey: string): Promise<ModpackAsyncTask>
  getValidation(importId: string): Promise<ModpackValidationReport>
  createDeployment(serverId: string, importId: string, idempotencyKey: string): Promise<{
    deploymentId: string
    task: ModpackAsyncTask
  }>
  getDeployment(deploymentId: string): Promise<ModpackDeployment>
  listDeployments(serverId: string, cursor?: string): Promise<{
    items: ModpackDeployment[]
    nextCursor?: string
  }>
  preview(deploymentId: string, idempotencyKey: string): Promise<ModpackAsyncTask>
  apply(deploymentId: string, statusVersion: number, idempotencyKey: string): Promise<ModpackAsyncTask>
  rollback(deploymentId: string, statusVersion: number, idempotencyKey: string): Promise<ModpackAsyncTask>
  getTask(taskId: string): Promise<ModpackAsyncTask>
}

export const ModpackDeploymentServiceKey: ServiceKey<ModpackDeploymentService> = 'ModpackDeploymentService'

export class ModpackDeploymentApiException extends Error {
  constructor(
    readonly response: ModpackApiError,
    readonly status: number,
  ) {
    super(response.message)
    this.name = 'ModpackDeploymentApiException'
  }
}

export interface ModpackDeploymentHttpOptions {
  baseUrl: string
  getAccessToken: () => string | undefined | Promise<string | undefined>
  fetch?: typeof globalThis.fetch
}

export class ModpackDeploymentHttpService implements ModpackDeploymentService {
  private readonly fetch: typeof globalThis.fetch
  private readonly baseUrl: string

  constructor(private readonly options: ModpackDeploymentHttpOptions) {
    this.fetch = options.fetch ?? globalThis.fetch
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
  }

  async createImport(serverId: string, input: {
    fileName: string
    sizeBytes: number
    sourceFormat: ModpackSourceFormat
    idempotencyKey: string
  }) {
    return this.request(
      `/v1/servers/${encodeURIComponent(serverId)}/modpack-imports`,
      CreateImportResponseSchema,
      {
        method: 'POST',
        idempotencyKey: input.idempotencyKey,
        body: {
          fileName: input.fileName,
          sizeBytes: input.sizeBytes,
          sourceFormat: input.sourceFormat,
        },
      },
    )
  }

  async requestUploadUrl(importId: string, input: {
    sizeBytes: number
    contentType: string
    idempotencyKey: string
  }) {
    return this.request(
      `/v1/modpack-imports/${encodeURIComponent(importId)}/upload-url`,
      SignedUploadSchema,
      {
        method: 'POST',
        idempotencyKey: input.idempotencyKey,
        body: {
          sizeBytes: input.sizeBytes,
          contentType: input.contentType,
        },
      },
    )
  }

  async uploadPackage(upload: SignedModpackUpload, file: SelectedModpackPackage) {
    if (file.size !== file.body.size || file.size > upload.maxSizeBytes) {
      throw new RangeError('Selected package does not satisfy the signed upload size constraint')
    }
    if (new URL(upload.url).protocol !== 'https:') {
      throw new TypeError('Signed upload URL must use HTTPS')
    }
    const response = await this.fetch(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: file.body,
    })
    if (!response.ok) {
      throw new ModpackDeploymentApiException({
        error: 'upload_failed',
        message: `Package upload failed with HTTP ${response.status}`,
        requestId: response.headers.get('x-request-id') || 'signed-upload',
      }, response.status)
    }
  }

  async completeImport(importId: string, idempotencyKey: string) {
    return this.writeTask(`/v1/modpack-imports/${encodeURIComponent(importId)}/complete`, {}, idempotencyKey)
  }

  async getValidation(importId: string) {
    return this.request(
      `/v1/modpack-imports/${encodeURIComponent(importId)}/validation`,
      ModpackValidationReportSchema,
    )
  }

  async createDeployment(serverId: string, importId: string, idempotencyKey: string) {
    return this.request(
      `/v1/servers/${encodeURIComponent(serverId)}/modpack-deployments`,
      CreateDeploymentResponseSchema,
      {
        method: 'POST',
        body: { importId },
        idempotencyKey,
      },
    )
  }

  async getDeployment(deploymentId: string) {
    return this.request(
      `/v1/modpack-deployments/${encodeURIComponent(deploymentId)}`,
      ModpackDeploymentSchema,
    )
  }

  async listDeployments(serverId: string, cursor?: string) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    return this.request(
      `/v1/servers/${encodeURIComponent(serverId)}/modpack-deployments${query}`,
      DeploymentPageSchema,
    )
  }

  async preview(deploymentId: string, idempotencyKey: string) {
    return this.writeTask(
      `/v1/modpack-deployments/${encodeURIComponent(deploymentId)}/preview`,
      {},
      idempotencyKey,
    )
  }

  async apply(deploymentId: string, statusVersion: number, idempotencyKey: string) {
    return this.writeTask(
      `/v1/modpack-deployments/${encodeURIComponent(deploymentId)}/apply`,
      { statusVersion },
      idempotencyKey,
    )
  }

  async rollback(deploymentId: string, statusVersion: number, idempotencyKey: string) {
    return this.writeTask(
      `/v1/modpack-deployments/${encodeURIComponent(deploymentId)}/rollback`,
      { statusVersion },
      idempotencyKey,
    )
  }

  async getTask(taskId: string) {
    return this.request(`/v1/tasks/${encodeURIComponent(taskId)}`, ModpackAsyncTaskSchema)
  }

  private writeTask(path: string, body: unknown, idempotencyKey: string) {
    return this.request(path, ModpackAsyncTaskSchema, {
      method: 'POST',
      body,
      idempotencyKey,
    })
  }

  private async request<T>(path: string, schema: z.ZodType<T>, init?: {
    method: 'POST'
    body: unknown
    idempotencyKey: string
  }): Promise<T> {
    const token = await this.options.getAccessToken()
    if (!token) {
      throw new ModpackDeploymentApiException({
        error: 'authentication_required',
        message: 'Sign in to deploy a modpack',
        requestId: 'client',
      }, 401)
    }
    const headers = new Headers({
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    })
    if (init) {
      headers.set('content-type', 'application/json')
      headers.set('idempotency-key', init.idempotencyKey)
    }
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init ? JSON.stringify(init.body) : undefined,
    })
    const payload = await this.readJson(response)
    if (!response.ok) {
      const parsed = ModpackApiErrorSchema.safeParse(payload)
      throw new ModpackDeploymentApiException(
        parsed.success
          ? parsed.data
          : {
              error: response.status === 401 ? 'authentication_required' : 'request_failed',
              message: `Modpack deployment request failed with HTTP ${response.status}`,
              requestId: response.headers.get('x-request-id') || 'unknown',
            },
        response.status,
      )
    }
    return schema.parse(payload)
  }

  private async readJson(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return undefined
    try {
      return JSON.parse(text)
    } catch {
      throw new ModpackDeploymentApiException({
        error: 'invalid_response',
        message: 'The modpack deployment service returned invalid JSON',
        requestId: response.headers.get('x-request-id') || 'unknown',
      }, response.status)
    }
  }
}
