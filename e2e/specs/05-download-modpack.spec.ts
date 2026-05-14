/**
 * Storyline 5 — Download a modpack from the Store.
 *
 *   open launcher → Store → search "fabulously optimized" → open project →
 *   Install → pick latest version → confirm install → return to Home.
 */
import { test, expect } from '../fixtures/launcher'
import { AppShell } from '../helpers/pom/AppShell'
import { installModpackFromStore } from '../helpers/tasks/installFromStore'
import { shoot } from '../helpers/shoot'

test.setTimeout(10 * 60_000)

test('Download modpack flow — install Fabulously Optimized from the Store', async ({
  launcher,
}) => {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }
  await shell.waitReady()

  await shoot(ctx, '00-launcher-opened', {
    caption: 'The launcher opens on the **Home** view.',
  })

  await installModpackFromStore(launcher, {
    query: 'fabulously optimized',
    matchTitle: 'Fabulously',
  })

  await expect(shell.instanceItems).toHaveCount(1)
  await shoot(ctx, '99-done', {
    caption: 'Done — the modpack instance is installed and selected.',
  })
})
