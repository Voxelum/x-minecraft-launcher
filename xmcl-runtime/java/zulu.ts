import { installZuluJava as installerInstallZuluJava, selectZuluJRE, type ZuluJRE } from '@xmcl/installer'
import { readJson, writeFile } from 'fs-extra'
import { existsSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { LauncherApp } from '~/app'
import index from './zulu.json'

// Re-export types and functions from @xmcl/installer
export { installZuluJava, selectZuluJRE, type ZuluJRE } from '@xmcl/installer'

export type ZuluJavaType =
  | 'java-runtime-alpha'
  | 'java-runtime-beta'
  | 'java-runtime-gamma'
  | 'java-runtime-gamma-snapshot'
  | 'java-runtime-delta'
  | 'jre-legacy'

// Required component keys the launcher fetches a Zulu build for.
// If any of these is missing or empty on the cached/remote payload,
// the document is considered unhealthy and we fall back to the
// bundled `index`. See issue #1459 — production hit "No zulu jre
// found for win32 x64" because a corrupted on-disk zulu.json with
// missing/empty arrays was being preferred over the bundled one.
const ZULU_TYPES = [
  'java-runtime-alpha',
  'java-runtime-beta',
  'java-runtime-gamma',
  'java-runtime-gamma-snapshot',
  'java-runtime-delta',
  'jre-legacy',
] as const satisfies readonly ZuluJavaType[]

const zuluJreSchema = z.object({
  features: z.array(z.string()),
  architecture: z.string(),
  os: z.string(),
  sha256: z.string(),
  size: z.number(),
  url: z.string(),
})

const zuluCacheSchema = z
  .object({
    modified: z.string(),
  })
  .catchall(z.array(zuluJreSchema))

type ZuluCache = {
  modified: string
  // Component arrays keyed by the launcher's component name
  // (`java-runtime-alpha` etc.). Other keys may be present; we
  // only access the ones in ZULU_TYPES.
  [k: string]: unknown
}

/**
 * Validate a parsed Zulu index against the expected schema and ensure
 * every component the launcher cares about resolves to at least one
 * build, otherwise treat it as corrupt and let the caller fall back to
 * the bundled copy.
 */
function isHealthyZuluCache(data: unknown): data is ZuluCache {
  const parsed = zuluCacheSchema.safeParse(data)
  if (!parsed.success) return false
  for (const t of ZULU_TYPES) {
    const arr = (parsed.data as Record<string, unknown>)[t]
    if (!Array.isArray(arr) || arr.length === 0) return false
  }
  return true
}

/**
 * Setup Zulu cache by downloading the latest Zulu JRE index.
 *
 * The remote payload is validated before being persisted so a transient
 * proxy/CDN giving back HTML, an empty body, or a partial JSON can
 * never overwrite a healthy cache (or the bundled fallback).
 */
export async function setupZuluCache(app: LauncherApp) {
  const filePath = join(app.appDataPath, 'zulu.json')
  if (!existsSync(filePath)) {
    await writeFile(filePath, JSON.stringify(index, null, 2))
  }

  const onDisk = await readJson(filePath).catch(() => undefined)
  const content: ZuluCache = isHealthyZuluCache(onDisk) ? onDisk : index

  const response = await app.fetch('https://raw.githubusercontent.com/Voxelum/xmcl-static-resource/refs/heads/main/zulu.json', {
    headers: {
      ['If-Modified-Since']: content.modified,
    },
  })
  if (response.ok) {
    const remote = await response.json().catch(() => undefined)
    if (isHealthyZuluCache(remote)) {
      await writeFile(filePath, JSON.stringify(remote, null, 2))
    }
  }
}

/**
 * Get the best matching Zulu JRE for the current platform.
 *
 * Loads from the on-disk cache first; if the cache is missing,
 * unparseable, or the platform/arch lookup fails on it, falls back to
 * the bundled `index` before giving up. That bundled file always ships
 * with full win32/linux/darwin x64+arm64 coverage so a "No zulu jre
 * found for win32 x64" should be impossible in practice — if it ever
 * surfaces again the error message now records exactly which sources
 * were tried and how many entries each one offered.
 */
export async function getZuluJRE(app: LauncherApp, type: ZuluJavaType): Promise<ZuluJRE> {
  const zuluCachePath = join(app.appDataPath, 'zulu.json')
  const onDisk = await readJson(zuluCachePath).catch(() => undefined)

  const sources: Array<{ source: 'cache' | 'bundled'; data: ZuluCache }> = []
  if (isHealthyZuluCache(onDisk)) {
    sources.push({ source: 'cache', data: onDisk })
  }
  sources.push({ source: 'bundled', data: index as ZuluCache })

  const tried: string[] = []
  for (const { source, data } of sources) {
    const array = data[type] as ZuluJRE[] | undefined
    const count = Array.isArray(array) ? array.length : 0
    const selected = count > 0 ? selectZuluJRE(array!) : undefined
    tried.push(`${source}=${count}`)
    if (selected) return selected
  }

  throw new Error(
    `No zulu jre found for ${process.platform} ${process.arch} (type=${type}; tried ${tried.join(', ')})`,
  )
}