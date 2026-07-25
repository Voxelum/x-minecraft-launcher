import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import { SharedHostingDeploymentApiError, type SharedWorldSeedUpload } from '@xmcl/runtime-api'

export async function uploadLocalWorldSeed(
  upload: SharedWorldSeedUpload,
  archivePath: string,
  expectedSizeBytes: number,
  onProgress: (progress: { uploadedBytes: number; totalBytes: number }) => void = () => {},
  signal?: AbortSignal,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<void> {
  if (upload.maxSizeBytes !== expectedSizeBytes) throw new Error('shared_world_seed_upload_size_mismatch')
  const info = await stat(archivePath)
  if (!info.isFile() || info.size !== expectedSizeBytes) throw new Error('shared_world_seed_archive_changed')
  let uploadedBytes = 0
  const body = (Readable.toWeb(createReadStream(archivePath)) as ReadableStream<Uint8Array>)
    .pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        uploadedBytes += chunk.byteLength
        onProgress({ uploadedBytes, totalBytes: expectedSizeBytes })
        controller.enqueue(chunk)
      },
    }))
  const response = await fetchImpl(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Length': String(expectedSizeBytes) },
    body,
    signal,
    redirect: 'error',
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
  if (!response.ok) {
    throw new SharedHostingDeploymentApiError(response.status, 'shared_world_seed_upload_failed', response.status === 408 || response.status === 429 || response.status >= 500)
  }
  if (uploadedBytes !== expectedSizeBytes) throw new Error('shared_world_seed_upload_size_mismatch')
}
