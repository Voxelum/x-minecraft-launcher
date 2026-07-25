import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import {
  SharedHostingDeploymentApiError,
  type SharedHostingBundleUpload,
} from '@xmcl/runtime-api'

export interface SharedHostingUploadProgress {
  uploadedBytes: number
  totalBytes: number
}

/**
 * Streams an exact pre-signed PUT without logging or retaining its URL.
 */
export async function uploadLocalServerBundle(
  upload: SharedHostingBundleUpload,
  bundlePath: string,
  expectedSizeBytes: number,
  onProgress: (progress: SharedHostingUploadProgress) => void = () => {},
  signal?: AbortSignal,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<void> {
  if (upload.maxSizeBytes !== expectedSizeBytes) {
    throw new Error('shared_hosting_upload_size_mismatch')
  }
  const info = await stat(bundlePath)
  if (!info.isFile() || info.size !== expectedSizeBytes) {
    throw new Error('shared_hosting_bundle_changed')
  }
  let uploadedBytes = 0
  const input = Readable.toWeb(createReadStream(bundlePath)) as ReadableStream<Uint8Array>
  const body = input.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      uploadedBytes += chunk.byteLength
      onProgress({ uploadedBytes, totalBytes: expectedSizeBytes })
      controller.enqueue(chunk)
    },
  }))
  const response = await fetchImpl(upload.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(expectedSizeBytes),
    },
    body,
    signal,
    redirect: 'error',
    // Node's streaming fetch requires duplex. It is not part of the DOM
    // RequestInit declaration used by the renderer.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
  if (!response.ok) {
    throw new SharedHostingDeploymentApiError(
      response.status,
      'shared_hosting_upload_failed',
      response.status === 408 || response.status === 429 || response.status >= 500,
    )
  }
  if (uploadedBytes !== expectedSizeBytes) {
    throw new Error('shared_hosting_upload_size_mismatch')
  }
}
