import { access, stat } from 'fs/promises'
import { checksum } from './utils'

/**
 * Represent a issue for your diagnosed minecraft client.
 */
export interface Issue {
  /**
   * The type of the issue.
   */
  type: 'missing' | 'corrupted'
  /**
   * The role of the file in Minecraft.
   */
  role: string
  /**
   * The path of the problematic file.
   */
  file: string
  /**
   * The useful hint to fix this issue. This should be a human readable string.
   */
  hint: string
  /**
   * The expected checksum of the file. Can be an empty string if this file is missing or not check checksum at all!
   */
  expectedChecksum: string
  /**
   * The actual checksum of the file. Can be an empty string if this file is missing or not check checksum at all!
   */
  receivedChecksum: string
}

export interface DiagnoseOptions {
  checksum?: (file: string, algorithm: string) => Promise<string>
  strict?: boolean
  signal?: AbortSignal
}

/**
 * Diagnose a single file by a certain checksum algorithm. By default, this use sha1
 */
export async function diagnoseFile<T extends string>(
  {
    file,
    expectedChecksum,
    role,
    hint,
    algorithm,
  }: { file: string; expectedChecksum: string; role: T; hint: string; algorithm?: string },
  options?: DiagnoseOptions,
): Promise<Issue | undefined> {
  let issue = false
  let receivedChecksum = ''
  algorithm = algorithm ?? 'sha1'

  const checksumFunc = options?.checksum ?? checksum
  const signal = options?.signal
  const fileExisted = await access(file).then(
    () => true,
    () => false,
  )
  if (signal?.aborted) return
  if (!fileExisted) {
    issue = true
  } else if (expectedChecksum !== '') {
    receivedChecksum = await checksumFunc(file, algorithm).catch((e) => {
      if (e.code === 'ENOENT') {
        return ''
      }
      throw e
    })
    if (signal?.aborted) return
    issue = receivedChecksum !== expectedChecksum
  } else {
    const fstat = await stat(file).catch(() => ({ size: 0 }))
    if (fstat.size === 0) {
      issue = true
    }
  }
  const type = fileExisted ? 'corrupted' : ('missing' as const)
  if (issue) {
    return {
      type,
      role,
      file,
      expectedChecksum,
      receivedChecksum,
      hint,
    } as const
  }
  return undefined
}
