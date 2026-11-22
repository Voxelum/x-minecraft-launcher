import { readdir, rm } from 'fs/promises'
import { join } from 'path'
import { isSystemError } from '@xmcl/utils'

/** Prefix temporary runtime directories with the installing process ID. */
export function javaStagingPrefix(root: string) {
  return join(root, `.xmcl-java-${process.pid}-`)
}

/** Remove recognized staging directories only when their owning process no longer exists. */
export async function cleanupAbandonedJavaStaging(root: string) {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (isSystemError(error) && error.code === 'ENOENT') return
    throw error
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const match = /^\.xmcl-java-([1-9]\d*)-[A-Za-z0-9]{6}$/.exec(entry.name)
    if (!match) continue
    const pid = Number(match[1])
    if (!Number.isSafeInteger(pid) || pid > 0x7fffffff) continue
    try {
      process.kill(pid, 0)
      continue
    } catch (error) {
      if (isSystemError(error) && error.code === 'EPERM') continue
      if (!isSystemError(error) || error.code !== 'ESRCH') throw error
    }
    await rm(join(root, entry.name), { recursive: true, force: true })
  }
}
