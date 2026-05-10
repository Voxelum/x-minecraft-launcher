/**
 * Storyline 1 — Base flow.
 *
 *   open launcher → onboarding (offline login) → install vanilla Minecraft
 *
 * Hits live launchermeta.mojang.com to populate the Minecraft version list,
 * then accepts the latest release version.
 */
import { test, expect } from '../fixtures/launcher'
import { AppShell } from '../helpers/pom/AppShell'
import { completeOnboarding } from '../helpers/tasks/onboarding'
import { createInstance } from '../helpers/tasks/createInstance'
import { shoot } from '../helpers/shoot'

test.use({ launcherOptions: { bootstrap: true } })

// Vanilla Minecraft install can take several minutes (assets + libraries).
test.setTimeout(10 * 60_000)

test('Base flow — onboard, login (offline), install vanilla Minecraft', async ({
  launcher,
}) => {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }

  await shoot(ctx, '00-launcher-opened', {
    caption: 'The launcher opens on the **first-launch wizard**.',
  })

  await completeOnboarding(launcher, { username: 'TestPlayer' })
  await expect(shell.sidebar).toBeVisible()

  await createInstance(launcher, {
    name: 'Vanilla',
    // Leaving `minecraft` undefined accepts the latest release returned by
    // the live Mojang manifest — keeps the test robust against future MC
    // releases.
  })

  await expect(shell.instanceItems).toHaveCount(1)
  await shoot(ctx, '99-done', {
    caption: 'Done — the new vanilla instance is selected and ready to launch.',
  })
})
