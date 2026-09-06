import { InstanceInstallLock } from '@xmcl/instance'
import { isSystemError } from '@xmcl/utils'
import { readJson, readdir, rename, writeJson } from 'fs-extra'
import { join } from 'path'
import { setTimeout } from 'timers/promises'

export async function readPendingInstalls(instancePath: string) {
  const directory = join(instancePath, '.install')
  const entries = await readdir(directory).catch((error) => {
    if (isSystemError(error) && error.code === 'ENOENT') return []
    throw error
  })
  const paths = [
    join(instancePath, '.install-profile'),
    ...entries.filter(name => name.endsWith('.json')).sort().map(name => join(directory, name)),
  ]
  const result: Array<{ path: string; state: InstanceInstallLock }> = []
  for (const path of paths) {
    const value = await readJson(path).catch((error) => {
      if (isSystemError(error) && error.code === 'ENOENT') return undefined
      throw error
    })
    if (value) {
      const state = InstanceInstallLock.parse(value)
      state.revision ??= state.mtime
      result.push({ path, state })
    }
  }
  return result.sort((a, b) => (b.state.revision ?? 0) - (a.state.revision ?? 0))
}

// Readers must see either the old complete JSON or the new complete JSON.
export async function writeInstallState(path: string, state: unknown) {
  const temporary = `${path}.tmp`
  await writeJson(temporary, state)
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, path)
      return
    } catch (error) {
      if (process.platform !== 'win32' || attempt >= 5 ||
          !isSystemError(error) || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error
      // Windows can briefly hold the destination open in a reader or watcher.
      await setTimeout(20 * 2 ** attempt)
    }
  }
}
