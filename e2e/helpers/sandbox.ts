/**
 * Sandbox seeding helper.
 *
 * Each spec gets a fresh launcher root from the fixture. To make a journey
 * meaningful (e.g. "edit instance settings") we often need to PRE-SEED that
 * root with a synthetic instance / version directory layout.
 *
 * Files under e2e/fixtures/sandbox/ are copied into the launcher's gameData
 * before the Electron app starts. Because the fixture writes the `root`
 * file BEFORE launching the app, the seed lands at the same path the
 * launcher will read.
 */
import { cp, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SANDBOX_ROOT = resolve(__dirname, '../fixtures/sandbox')

export interface SeedInstance {
  name: string
  /** Minecraft version (e.g. '1.20.4'). */
  minecraft: string
  /** Optional resolved-version JSON `id` to embed. Defaults to minecraft. */
  versionId?: string
}

/**
 * Copy the static sandbox tree into `gameDataPath`, then optionally
 * synthesize a minimal instance record so the Home view has something to
 * select.
 */
export async function seedSandbox(gameDataPath: string, instance?: SeedInstance): Promise<void> {
  // Copy any baseline files (mods/ resourcepacks/ etc) shipped under fixtures/sandbox.
  await cp(SANDBOX_ROOT, gameDataPath, { recursive: true }).catch(() => {})

  if (!instance) return

  const versionId = instance.versionId ?? instance.minecraft

  // Minimal version JSON so the launcher recognizes it as installed.
  const versionDir = join(gameDataPath, 'versions', versionId)
  await mkdir(versionDir, { recursive: true })
  await writeFile(
    join(versionDir, `${versionId}.json`),
    JSON.stringify({
      id: versionId,
      type: 'release',
      mainClass: 'net.minecraft.client.main.Main',
      arguments: { game: [], jvm: [] },
      libraries: [],
      assets: 'legacy',
      assetIndex: { id: 'legacy', sha1: '0', size: 0, totalSize: 0, url: '' },
      downloads: {},
      releaseTime: '2024-01-01T00:00:00+00:00',
      time: '2024-01-01T00:00:00+00:00',
      minimumLauncherVersion: 21,
    }),
  )

  // Synthetic instance.
  const safeName = instance.name.replace(/[^a-zA-Z0-9-_]/g, '_')
  const instanceDir = join(gameDataPath, 'instances', safeName)
  await mkdir(instanceDir, { recursive: true })
  await writeFile(
    join(instanceDir, 'instance.json'),
    JSON.stringify({
      name: instance.name,
      runtime: { minecraft: instance.minecraft },
      version: versionId,
      lastAccessDate: Date.now(),
      creationDate: Date.now(),
    }),
  )
}
