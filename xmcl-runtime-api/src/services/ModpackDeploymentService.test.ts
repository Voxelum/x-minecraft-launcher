import { describe, expect, test, vi } from 'vitest'
import {
  DeploymentManifestSchema,
  ModpackDeploymentApiException,
  ModpackDeploymentHttpService,
  ModpackValidationReportSchema,
} from './ModpackDeploymentService'

const timestamp = '2026-07-22T12:00:00.000Z'
const task = {
  taskId: 'task-1',
  requestId: 'request-1',
  status: 'queued',
  createdAt: timestamp,
  updatedAt: timestamp,
}

describe('M9 modpack deployment contract proposal', () => {
  test('accepts the server-owned validation report and immutable manifest', () => {
    expect(ModpackValidationReportSchema.parse({
      importId: 'import-1',
      sourceFormat: 'mrpack',
      status: 'invalid',
      configFiles: ['config/server.toml'],
      dataFiles: ['data/example/tags.json'],
      mods: [{
        provider: 'modrinth',
        projectId: 'project-1',
        fileId: 'file-1',
        filename: 'example.jar',
      }],
      rejectedFiles: [{ path: 'mods/uploaded.jar', reason: 'uploaded jars are forbidden' }],
    }).status).toBe('invalid')

    expect(DeploymentManifestSchema.parse({
      manifestVersion: 1,
      deploymentId: 'deployment-1',
      serverId: 'server-1',
      sourceFormat: 'curseforge_zip',
      compatibility: {
        minecraftVersion: '1.21.1',
        loader: 'neoforge',
        loaderVersion: '21.1.1',
        javaMajor: 21,
        templateId: 'template-1',
      },
      configFiles: [],
      dataFiles: [],
      mods: [{
        provider: 'curseforge',
        projectId: '10',
        fileId: '20',
        sha256: 'a'.repeat(64),
      }],
      rollbackSnapshotId: 'snapshot-1',
    }).rollbackSnapshotId).toBe('snapshot-1')
  })

  test('rejects uploaded executable content and arbitrary mod URLs in reports', () => {
    expect(ModpackValidationReportSchema.safeParse({
      importId: 'import-1',
      sourceFormat: 'mrpack',
      status: 'valid',
      configFiles: [],
      dataFiles: [],
      mods: [{
        provider: 'url',
        projectId: 'https://example.com',
        fileId: 'file',
        filename: 'payload.jar',
      }],
      rejectedFiles: [],
    }).success).toBe(false)
  })
})

describe('ModpackDeploymentHttpService', () => {
  test('sends auth and stable idempotency metadata to the control plane', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(
      JSON.stringify({ deploymentId: 'deployment-1', task }),
      { status: 202, headers: { 'content-type': 'application/json' } },
    ))
    const service = new ModpackDeploymentHttpService({
      baseUrl: 'https://api.example.com/',
      getAccessToken: () => 'account-session',
      fetch,
    })

    await service.createDeployment('server/1', 'import-1', 'deploy-key')

    const [url, init] = fetch.mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(url).toBe('https://api.example.com/v1/servers/server%2F1/modpack-deployments')
    expect(headers.get('authorization')).toBe('Bearer account-session')
    expect(headers.get('idempotency-key')).toBe('deploy-key')
  })

  test('fails locally when authentication is missing', async () => {
    const fetch = vi.fn()
    const service = new ModpackDeploymentHttpService({
      baseUrl: 'https://api.example.com',
      getAccessToken: () => undefined,
      fetch,
    })

    await expect(service.getValidation('import-1')).rejects.toMatchObject({
      status: 401,
      response: { error: 'authentication_required' },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  test('uploads only the opaque package body and never forwards account auth', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }))
    const service = new ModpackDeploymentHttpService({
      baseUrl: 'https://api.example.com',
      getAccessToken: () => 'account-session',
      fetch,
    })
    const body = new Blob(['opaque zip bytes'], { type: 'application/zip' })

    await service.uploadPackage({
      url: 'https://objects.example.com/signed',
      method: 'PUT',
      headers: { 'x-upload-token': 'signed-only' },
      maxSizeBytes: 1024,
      expiresAt: timestamp,
    }, {
      name: 'pack.mrpack',
      size: body.size,
      type: body.type,
      body,
    })

    const [, init] = fetch.mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(init?.body).toBe(body)
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('x-upload-token')).toBe('signed-only')
  })

  test('surfaces structured provider and worker failures', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      error: 'worker_staging_failed',
      message: 'Worker could not verify provider download',
      requestId: 'request-worker',
      details: { provider: 'curseforge' },
    }), { status: 502 }))
    const service = new ModpackDeploymentHttpService({
      baseUrl: 'https://api.example.com',
      getAccessToken: () => 'account-session',
      fetch,
    })

    const error = await service.apply('deployment-1', 3, 'apply-key').catch(value => value)
    expect(error).toBeInstanceOf(ModpackDeploymentApiException)
    expect(error).toMatchObject({
      status: 502,
      response: {
        error: 'worker_staging_failed',
        requestId: 'request-worker',
      },
    })
  })
})
