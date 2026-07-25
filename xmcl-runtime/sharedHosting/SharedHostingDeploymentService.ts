import {
  SharedHostingDeploymentApiClient,
  SharedHostingDeploymentApiError,
  SharedHostingDeploymentServiceKey,
  type CreateSharedHostingBundleImport,
  type SharedHostingBundleImport,
  type SharedHostingDeployment,
  type SharedHostingDeploymentService as ISharedHostingDeploymentService,
  type SharedHostingServiceRecord,
} from '@xmcl/runtime-api'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { resolveXmclApiBaseUrl } from '~/app/xmclApiBaseUrl'
import { CommercialAccountService, kCommercialSessionAuthorization } from '~/commercialAccount'
import { AbstractService, ExposeServiceKey } from '~/service'
import { uploadLocalServerBundle } from './uploadBundle'

export interface UploadLocalServerBundleOptions extends CreateSharedHostingBundleImport {
  bundlePath: string
  maxAttempts?: number
}

@ExposeServiceKey(SharedHostingDeploymentServiceKey)
export class SharedHostingDeploymentService
  extends AbstractService
  implements ISharedHostingDeploymentService {
  private readonly client: SharedHostingDeploymentApiClient
  private readonly uploadControllers = new Map<string, AbortController>()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(CommercialAccountService) account: CommercialAccountService,
  ) {
    super(app)
    this.client = new SharedHostingDeploymentApiClient({
      baseUrl: resolveXmclApiBaseUrl('https://xmcl-web-api.cijhn.workers.dev', app.getLogger('ApiBaseUrl')),
      fetch: ((input, init) => app.fetch(input, init)) as typeof fetch,
      getSessionToken: async () => (await account[kCommercialSessionAuthorization]())?.accessToken,
    })
  }

  listSharedHostingServices(): Promise<SharedHostingServiceRecord[]> {
    return this.client.listServices()
  }

  createSharedHostingBundleImport(input: CreateSharedHostingBundleImport): Promise<SharedHostingBundleImport> {
    return this.client.createBundleImport(input)
  }

  completeSharedHostingBundleImport(importId: string, idempotencyKey: string): Promise<SharedHostingBundleImport> {
    return this.client.completeBundleImport(importId, idempotencyKey)
  }

  createSharedHostingDeployment(serviceId: string, importId: string, idempotencyKey: string): Promise<SharedHostingDeployment> {
    return this.client.createDeployment(serviceId, importId, idempotencyKey)
  }

  listSharedHostingDeployments(serviceId: string): Promise<SharedHostingDeployment[]> {
    return this.client.listDeployments(serviceId)
  }

  /**
   * Main-process orchestration for the launcher review/export/upload sequence.
   * Only progress byte counts leave this method; pre-signed URLs never do.
   */
  async uploadLocalServerBundle(
    options: UploadLocalServerBundleOptions,
  ): Promise<SharedHostingDeployment> {
    if (this.uploadControllers.has(options.idempotencyKey)) {
      throw new Error('shared_hosting_upload_in_progress')
    }
    const controller = new AbortController()
    this.uploadControllers.set(options.idempotencyKey, controller)
    try {
      const imported = await this.client.createBundleImport(options)
      const attempts = Math.max(1, Math.min(3, options.maxAttempts ?? 2))
      let uploaded = false
      let lastError: unknown
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const grant = await this.client.createUploadUrl(imported.importId, options.idempotencyKey)
          await uploadLocalServerBundle(
            grant,
            options.bundlePath,
            options.expectedSizeBytes,
            (progress) => this.emit('shared-hosting-bundle-upload-progress', {
              idempotencyKey: options.idempotencyKey,
              ...progress,
            }),
            controller.signal,
          )
          uploaded = true
          break
        } catch (error) {
          lastError = error
          if (!(error instanceof SharedHostingDeploymentApiError) || !error.retryable || controller.signal.aborted) break
        }
      }
      if (!uploaded) throw lastError
      const completed = await this.client.completeBundleImport(imported.importId, options.idempotencyKey)
      if (completed.status !== 'valid') throw new Error('shared_hosting_bundle_invalid')
      return await this.client.createDeployment(options.serviceId, imported.importId, options.idempotencyKey)
    } finally {
      this.uploadControllers.delete(options.idempotencyKey)
    }
  }

  async cancelSharedHostingBundleUpload(idempotencyKey: string): Promise<void> {
    this.uploadControllers.get(idempotencyKey)?.abort()
  }
}
