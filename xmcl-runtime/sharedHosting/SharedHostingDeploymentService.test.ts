import { randomUUID } from 'crypto'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { uploadLocalServerBundle } from './uploadBundle'

describe('uploadLocalServerBundle', () => {
  it('streams the exact bundle bytes without placing a signed URL in request metadata', async () => {
    const root = join(process.cwd(), '.test-artifacts', `shared-upload-${randomUUID()}`)
    const path = join(root, 'bundle.xmcl-server-bundle')
    try {
      await mkdir(root, { recursive: true })
      await writeFile(path, Buffer.from([1, 2, 3, 4]))
      const progress: number[] = []
      const requests: Array<{ url: string; headers: Headers; redirect: RequestRedirect | undefined; bytes: Uint8Array }> = []
      await uploadLocalServerBundle(
        {
          uploadUrl: 'https://storage.example/object?temporary=redacted',
          expiresAt: '2026-07-25T00:10:00.000Z',
          maxSizeBytes: 4,
        },
        path,
        4,
        ({ uploadedBytes }) => progress.push(uploadedBytes),
        undefined,
        async (url, init) => {
          const bytes = new Uint8Array(await new Response(init?.body).arrayBuffer())
          requests.push({
            url: String(url),
            headers: new Headers(init?.headers),
            redirect: init?.redirect,
            bytes,
          })
          return new Response(undefined, { status: 200 })
        },
      )
      expect(progress.at(-1)).toBe(4)
      expect(requests).toEqual([{
        url: 'https://storage.example/object?temporary=redacted',
        headers: expect.objectContaining({}),
        redirect: 'error',
        bytes: new Uint8Array([1, 2, 3, 4]),
      }])
      expect(requests[0].headers.get('content-length')).toBe('4')
      expect(requests[0].headers.get('authorization')).toBeNull()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
