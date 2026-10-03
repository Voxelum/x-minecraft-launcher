import type { DownloadOptions } from '@xmcl/file-transfer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import filenamify from 'filenamify'
import { downloadStaged } from '../market/downloadStaged'

export async function downloadModpackUrl(
  source: string,
  directory: string,
  options: Omit<DownloadOptions, 'url' | 'destination'>,
): Promise<string> {
  const url = new URL(source)
  const filename = filenamify(decodeURIComponent(url.pathname.split('/').pop() || 'modpack.zip'))
    || 'modpack.zip'
  const sourceId = createHash('sha256').update(source).digest('hex')
  await mkdir(directory, { recursive: true })
  // Each import needs fresh bytes and its own path: open ZIPs and shared profiles
  // are cached by path, and their zip:// downloads must remain usable afterwards.
  const attempt = await mkdtemp(join(directory, `${sourceId}-`))
  const destination = join(attempt, filename)
  try {
    await downloadStaged({ ...options, url: source, destination })
    return destination
  } catch (error) {
    await rm(attempt, { recursive: true, force: true })
    throw error
  }
}
