/** Test-only bridge. There is intentionally no service/IPC API for this hook. */
import { lstat, readFile, realpath, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { isAbsolute, join, relative, resolve, sep } from 'path'
import { setTimeout } from 'timers/promises'
import type { RestoreFault } from './restoreTransaction'

const points = new Set(['staging-after', 'prepared', 'old-before', 'old-after', 'old-done', 'new-before', 'new-after', 'new-done', 'publish-before', 'publish-after', 'committed-before'])
export async function getE2ERestoreFault(appDataPath: string, signal?: AbortSignal): Promise<RestoreFault | undefined> {
  // Production does not even stat a fault file. An opt-in flag alone is not
  // enough: require the actual launcher profile to be an explicitly redirected
  // fresh temporary E2E root, never the default or user-selected normal profile.
  const root = process.env.XMCL_E2E_APP_DATA
  if (process.env.XMCL_E2E !== '1' || process.env.XMCL_E2E_NO_LAUNCH !== '1' || !root || !isAbsolute(root)) return undefined
  const actualRoot = await realpath(root)
  const temp = await realpath(tmpdir())
  const rel = relative(temp, actualRoot)
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`) || resolve(appDataPath) !== join(actualRoot, 'xmcl')) return undefined
  if (await realpath(appDataPath) !== join(actualRoot, 'xmcl')) return undefined
  const path = join(appDataPath, '.xmcl-restore-fault.json')
  const st = await lstat(path).catch(e => { if (e.code === 'ENOENT') return undefined; throw e })
  if (!st) return undefined
  if (!st.isFile() || st.isSymbolicLink() || st.size > 1024) throw new Error('Invalid isolated E2E restore fault file')
  const value = JSON.parse(await readFile(path, 'utf8'))
  if (!value || Object.keys(value).some(k => !['point', 'target', 'rollbackFailure', 'pauseMs'].includes(k)) || !points.has(value.point) || !Number.isInteger(value.target) || value.target < -1 || value.target > 1000 || (value.rollbackFailure !== undefined && typeof value.rollbackFailure !== 'boolean')) throw new Error('Invalid isolated E2E restore fault configuration')
  if (value.pauseMs !== undefined && (value.point !== 'staging-after' || !Number.isInteger(value.pauseMs) || value.pauseMs < 1 || value.pauseMs > 10000 || value.rollbackFailure)) throw new Error('Invalid isolated E2E restore pause')
  let triggered = false
  return async (point, index) => {
    if (!triggered && point === value.point && index === value.target) {
      triggered = true
      if (value.pauseMs !== undefined) {
        const marker = join(appDataPath, '.xmcl-restore-staging-ready')
        await writeFile(marker, JSON.stringify({ point, target: index }), { flag: 'wx', mode: 0o600 })
        try { await setTimeout(value.pauseMs, undefined, { signal }) } finally { await rm(marker) }
      } else throw new Error(`[E2E] Injected restore failure ${point}:${index}`)
    }
    if (triggered && value.rollbackFailure && point === 'rollback-before') throw new Error('[E2E] Injected restore rollback failure')
  }
}
