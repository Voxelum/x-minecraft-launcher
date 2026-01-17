import { installZuluJava as installerInstallZuluJava, selectZuluJRE, type ZuluJRE } from '@xmcl/installer'
import { readJson, writeFile } from 'fs-extra'
import { existsSync } from 'fs'
import { join } from 'path'
import { LauncherApp } from '~/app'
import index from './zulu.json'

// Re-export types and functions from @xmcl/installer
export { installZuluJava, selectZuluJRE, type ZuluJRE } from '@xmcl/installer'

/**
 * Setup Zulu cache by downloading the latest Zulu JRE index
 */
export async function setupZuluCache(app: LauncherApp) {
  const filePath = join(app.appDataPath, 'zulu.json')
  if (!existsSync(filePath)) {
    await writeFile(filePath, JSON.stringify(index, null, 2))
  }

  const content = await readJson(filePath).catch(() => index) as typeof index

  const response = await app.fetch('https://raw.githubusercontent.com/Voxelum/xmcl-static-resource/refs/heads/main/zulu.json', {
    headers: {
      ['If-Modified-Since']: content.modified,
    },
  })
  if (response.ok) {
    await writeFile(filePath, JSON.stringify(await response.json(), null, 2))
  }
}

/**
 * Get the best matching Zulu JRE for the current platform
 */
export async function getZuluJRE(app: LauncherApp, type:
  'java-runtime-alpha' |
  'java-runtime-beta' |
  'java-runtime-gamma' |
  'java-runtime-gamma-snapshot' |
  'java-runtime-delta' |
  'jre-legacy'
): Promise<ZuluJRE> {
  const zuluCachePath = join(app.appDataPath, 'zulu.json')
  const content = await readJson(zuluCachePath).catch(() => index) as typeof index
  const array = content[type] || []
  const selected = selectZuluJRE(array)
  if (!selected) {
    throw new Error(`No zulu jre found for ${process.platform} ${process.arch}`)
  }
  return selected
}