/**
 * Storyline 3 — Other mod loaders.
 *
 *   open launcher → create instance with Forge → create instance with NeoForge
 *
 * Each loader fetches its own meta endpoint (Forge XML index, NeoForge maven
 * metadata). No mocks — the test exercises the live install path.
 */
import { test, expect } from '../fixtures/launcher'
import { AppShell } from '../helpers/pom/AppShell'
import { createInstance } from '../helpers/tasks/createInstance'
import { shoot } from '../helpers/shoot'

test.setTimeout(15 * 60_000)

test('Other modloaders — create Forge and NeoForge instances', async ({ launcher }) => {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }
  await shell.waitReady()

  await shoot(ctx, '00-launcher-opened', {
    caption: 'The launcher opens on the **Home** view.',
  })

  await createInstance(launcher, {
    name: 'Forge Workshop',
    loader: 'forge',
    stepPrefix: 'forge-',
  })

  await createInstance(launcher, {
    name: 'NeoForge Lab',
    loader: 'neoforge',
    stepPrefix: 'neoforge-',
  })

  await shell.goto('/')
  await expect(shell.instanceItems).toHaveCount(2)
  await shoot(ctx, '99-done', {
    caption: 'Done — both **Forge** and **NeoForge** instances appear in the side bar.',
  })
})
