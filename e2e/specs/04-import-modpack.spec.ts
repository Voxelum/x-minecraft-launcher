/**
 * Storyline 4 — Import a Modrinth modpack (.mrpack).
 *
 *   open launcher → AddInstance dialog → Import → pick a .mrpack file →
 *   review → install.
 *
 * The .mrpack fixture is fetched at runtime from the live Modrinth CDN to
 * avoid committing binary blobs. We pick a small, stable modpack version so
 * the download is fast.
 */
import { test, expect } from '../fixtures/launcher'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppShell } from '../helpers/pom/AppShell'
import { importModpack } from '../helpers/tasks/importModpack'
import { shoot } from '../helpers/shoot'

test.setTimeout(10 * 60_000)

const MODPACK_PROJECT = 'fabulously-optimized'

async function fetchSampleModpack(): Promise<string> {
  // Resolve the latest released version of Fabulously Optimized for the
  // newest available game version, then download its primary file.
  const versions = await fetch(
    `https://api.modrinth.com/v2/project/${MODPACK_PROJECT}/version?featured=true`,
  ).then((r) => r.json() as Promise<Array<{
    files: Array<{ url: string; primary: boolean; filename: string }>
  }>>)
  const version = versions[0]
  if (!version) throw new Error(`No featured versions for ${MODPACK_PROJECT}`)
  const file = version.files.find((f) => f.primary) ?? version.files[0]
  if (!file) throw new Error('Modpack has no files')

  const ab = await fetch(file.url).then((r) => r.arrayBuffer())
  const buf = Buffer.from(ab as ArrayBuffer)
  const dir = await mkdtemp(join(tmpdir(), 'xmcl-e2e-modpack-'))
  const out = join(dir, file.filename)
  await writeFile(out, buf)
  return out
}

test('Import flow — install a Modrinth modpack from disk', async ({ launcher }) => {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }
  await shell.waitReady()

  await shoot(ctx, '00-launcher-opened', {
    caption: 'The launcher opens on the **Home** view.',
  })

  const modpackFile = await fetchSampleModpack()
  await importModpack(launcher, { modpackFile, name: 'Imported Pack' })

  await expect(shell.instanceItems).toHaveCount(1)
  await shoot(ctx, '99-done', {
    caption: 'Done — the imported modpack is selected and installed.',
  })
})
