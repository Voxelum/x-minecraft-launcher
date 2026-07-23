import type {
  ModpackAsyncTask,
  ModpackDeployment,
  ModpackDeploymentService,
  ModpackValidationReport,
  SelectedModpackPackage,
  SignedModpackUpload,
} from '@xmcl/runtime-api/src/services/ModpackDeploymentService'
import { ModpackDeploymentApiException } from '@xmcl/runtime-api/src/services/ModpackDeploymentService'
import { describe, expect, test } from 'vitest'
import { useModpackDeployment } from './modpackDeployment'

const baseTime = Date.parse('2026-07-22T12:00:00.000Z')
const validReport = {
  importId: 'import-1',
  sourceFormat: 'mrpack' as const,
  status: 'valid' as const,
  configFiles: ['config/server.toml'],
  dataFiles: ['data/example/tags.json'],
  mods: [{
    provider: 'modrinth' as const,
    projectId: 'project-1',
    fileId: 'file-1',
    filename: 'example.jar',
  }],
  rejectedFiles: [],
}
const deploymentPreview = {
  deploymentId: 'deployment-1',
  statusVersion: 1,
  configFiles: [{ path: 'config/server.toml', change: 'replace' as const }],
  dataFiles: [{ path: 'data/example/tags.json', change: 'add' as const }],
  mods: [{
    provider: 'modrinth' as const,
    projectId: 'project-1',
    fileId: 'file-1',
    change: 'add' as const,
  }],
  warnings: [],
}

function task(
  status: ModpackAsyncTask['status'],
  version: number,
  result?: unknown,
  taskId = 'task-1',
): ModpackAsyncTask {
  return {
    taskId,
    requestId: 'request-1',
    status,
    result,
    createdAt: new Date(baseTime).toISOString(),
    updatedAt: new Date(baseTime + version * 1_000).toISOString(),
  }
}

class ModpackDeploymentMock implements ModpackDeploymentService {
  calls: Array<{ operation: string; key?: string }> = []
  validationResponses: ModpackValidationReport[] = [validReport]
  taskResponses: ModpackAsyncTask[] = []
  uploadError?: unknown
  applyError?: unknown
  rollbackError?: unknown
  deployment: ModpackDeployment = {
    deploymentId: 'deployment-1',
    serverId: 'server-1',
    importId: 'import-1',
    status: 'ready',
    statusVersion: 1,
    createdAt: new Date(baseTime).toISOString(),
    updatedAt: new Date(baseTime).toISOString(),
  }

  async createImport(_serverId: string, input: {
    fileName: string
    sizeBytes: number
    sourceFormat: 'mrpack' | 'curseforge_zip'
    idempotencyKey: string
  }) {
    this.calls.push({ operation: 'createImport', key: input.idempotencyKey })
    return {
      importId: 'import-1',
      constraints: { maxSizeBytes: 1024, allowedFormats: ['mrpack' as const, 'curseforge_zip' as const] },
    }
  }

  async requestUploadUrl(_importId: string, input: {
    sizeBytes: number
    contentType: string
    idempotencyKey: string
  }): Promise<SignedModpackUpload> {
    this.calls.push({ operation: 'requestUploadUrl', key: input.idempotencyKey })
    return {
      url: 'https://objects.example.com/signed',
      method: 'PUT',
      headers: {},
      maxSizeBytes: 1024,
      expiresAt: new Date(baseTime + 60_000).toISOString(),
    }
  }

  async uploadPackage() {
    this.calls.push({ operation: 'uploadPackage' })
    if (this.uploadError) throw this.uploadError
  }

  async completeImport(_importId: string, idempotencyKey: string) {
    this.calls.push({ operation: 'completeImport', key: idempotencyKey })
    return task('queued', 0)
  }

  async getValidation() {
    return this.validationResponses.shift() ?? validReport
  }

  async createDeployment(_serverId: string, _importId: string, idempotencyKey: string) {
    this.calls.push({ operation: 'createDeployment', key: idempotencyKey })
    return { deploymentId: 'deployment-1', task: task('succeeded', 1, undefined, 'task-create') }
  }

  async getDeployment() {
    return this.deployment
  }

  async listDeployments() {
    return { items: [this.deployment] }
  }

  async preview(_deploymentId: string, idempotencyKey: string) {
    this.calls.push({ operation: 'preview', key: idempotencyKey })
    return task('succeeded', 2, deploymentPreview, 'task-preview')
  }

  async apply(_deploymentId: string, _statusVersion: number, idempotencyKey: string) {
    this.calls.push({ operation: 'apply', key: idempotencyKey })
    if (this.applyError) throw this.applyError
    this.deployment = { ...this.deployment, status: 'succeeded', statusVersion: 2 }
    return task('succeeded', 3, undefined, 'task-apply')
  }

  async rollback(_deploymentId: string, _statusVersion: number, idempotencyKey: string) {
    this.calls.push({ operation: 'rollback', key: idempotencyKey })
    if (this.rollbackError) throw this.rollbackError
    this.deployment = { ...this.deployment, status: 'rolled_back', statusVersion: 3 }
    return task('succeeded', 4, undefined, 'task-rollback')
  }

  async getTask() {
    return this.taskResponses.shift() ?? task('succeeded', 5)
  }
}

function selectedPackage(name = 'pack.mrpack'): SelectedModpackPackage {
  const body = new Blob(['package'])
  return { name, size: body.size, type: 'application/zip', body }
}

function createClient(service = new ModpackDeploymentMock()) {
  let key = 0
  return {
    service,
    client: useModpackDeployment(service, {
      serverId: 'server-1',
      sleep: async () => {},
      maxPollAttempts: 8,
      createIdempotencyKey: operation => `${operation}-${++key}`,
    }),
  }
}

async function reachReport(client: ReturnType<typeof useModpackDeployment>) {
  client.selectPackage(selectedPackage())
  await client.uploadAndValidate()
}

async function reachPreview(client: ReturnType<typeof useModpackDeployment>) {
  await reachReport(client)
  client.reportConfirmed.value = true
  await client.preparePreview()
}

describe('useModpackDeployment', () => {
  test('requires the server report and preview confirmations before apply', async () => {
    const { client } = createClient()
    await reachReport(client)

    expect(client.canPreparePreview.value).toBe(false)
    client.reportConfirmed.value = true
    expect(client.canPreparePreview.value).toBe(true)
    await client.preparePreview()
    expect(client.canApply.value).toBe(false)
    client.previewConfirmed.value = true
    expect(client.canApply.value).toBe(true)

    await client.apply()
    expect(client.phase.value).toBe('applied')
  })

  test('keeps server rejections visible and prevents partial deployment', async () => {
    const { client, service } = createClient()
    service.validationResponses = [{
      ...validReport,
      status: 'invalid',
      rejectedFiles: [
        { path: 'mods/uploaded.jar', reason: 'Uploaded jars are forbidden' },
        { path: '../escape.sh', reason: 'Path traversal and scripts are forbidden' },
      ],
    }]
    await reachReport(client)

    client.reportConfirmed.value = true
    expect(client.report.value?.rejectedFiles).toHaveLength(2)
    expect(client.canPreparePreview.value).toBe(false)
    await expect(client.preparePreview()).rejects.toThrow('valid server report')
  })

  test('does not treat a contradictory valid report with rejections as deployable', async () => {
    const { client, service } = createClient()
    service.validationResponses = [{
      ...validReport,
      rejectedFiles: [{ path: 'mods/uploaded.jar', reason: 'Uploaded jars are forbidden' }],
    }]
    await reachReport(client)

    client.reportConfirmed.value = true
    expect(client.canPreparePreview.value).toBe(false)
  })

  test('handles pending, duplicate, and out-of-order task updates', async () => {
    const { client, service } = createClient()
    service.validationResponses = [{ ...validReport, status: 'pending' }, validReport]
    service.taskResponses = [
      task('running', 2),
      task('queued', 1),
      task('running', 2),
      task('succeeded', 3),
    ]

    await reachReport(client)

    expect(client.currentTask.value?.status).toBe('succeeded')
    expect(client.report.value?.status).toBe('valid')
    expect(client.phase.value).toBe('report')
  })

  test('retries an interrupted upload with the same idempotency keys', async () => {
    const { client, service } = createClient()
    service.uploadError = new TypeError('connection reset')
    client.selectPackage(selectedPackage())
    await expect(client.uploadAndValidate()).rejects.toThrow('connection reset')
    const firstKeys = service.calls
      .filter(call => ['createImport', 'requestUploadUrl'].includes(call.operation))
      .map(call => call.key)

    service.uploadError = undefined
    await client.retry()
    const secondKeys = service.calls
      .filter(call => ['createImport', 'requestUploadUrl'].includes(call.operation))
      .map(call => call.key)

    expect(secondKeys).toEqual([...firstKeys, ...firstKeys])
    expect(client.phase.value).toBe('report')
  })

  test('refreshes status and invalidates a stale preview on status conflict', async () => {
    const { client, service } = createClient()
    await reachPreview(client)
    client.previewConfirmed.value = true
    service.applyError = new ModpackDeploymentApiException({
      error: 'deployment_status_conflict',
      message: 'A newer deployment already changed the server',
      requestId: 'request-conflict',
    }, 409)
    service.deployment = { ...service.deployment, statusVersion: 4 }

    await expect(client.apply()).rejects.toThrow('newer deployment')

    expect(client.phase.value).toBe('conflict')
    expect(client.error.value).toMatchObject({ category: 'conflict', retryable: false })
    expect(client.deployment.value?.statusVersion).toBe(4)
    expect(client.preview.value).toBeUndefined()
    expect(client.previewConfirmed.value).toBe(false)

    const oldPreviewKey = service.calls.find(call => call.operation === 'preview')?.key
    await client.preparePreview()
    const previewKeys = service.calls.filter(call => call.operation === 'preview').map(call => call.key)
    expect(previewKeys).toHaveLength(2)
    expect(previewKeys[1]).not.toBe(oldPreviewKey)
  })

  test.each([
    [401, 'authentication_required', 'auth', false],
    [502, 'modrinth_provider_failed', 'provider', true],
    [502, 'worker_staging_failed', 'worker', true],
  ] as const)('classifies auth/provider/worker failures', async (status, code, category, retryable) => {
    const { client, service } = createClient()
    service.uploadError = new ModpackDeploymentApiException({
      error: code,
      message: `${category} failure`,
      requestId: `request-${category}`,
    }, status)
    client.selectPackage(selectedPackage())

    await expect(client.uploadAndValidate()).rejects.toThrow(`${category} failure`)
    expect(client.error.value).toMatchObject({ category, retryable })
  })

  test('offers rollback after a worker apply failure and restores the snapshot', async () => {
    const { client, service } = createClient()
    await reachPreview(client)
    client.previewConfirmed.value = true
    service.applyError = new ModpackDeploymentApiException({
      error: 'worker_staging_failed',
      message: 'Worker staging failed; previous deployment remains active',
      requestId: 'request-worker',
    }, 502)

    await expect(client.apply()).rejects.toThrow('previous deployment remains active')
    expect(client.canRollback.value).toBe(true)
    service.applyError = undefined
    await client.rollback()

    expect(client.phase.value).toBe('rolled-back')
    expect(client.deployment.value?.status).toBe('rolled_back')
  })
})
