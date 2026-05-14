/**
 * Storyline 2 — Mod flow.
 *
 *   open launcher (already logged in) → create instance with Fabric loader →
 *   browse Modrinth/CurseForge for mods (Iris), resource packs (Better 3D)
 *   and shader packs (Complementary Reimagined) → trigger the instance file
 *   install dialog.
 */
import { test } from '../fixtures/launcher'
import { AppShell } from '../helpers/pom/AppShell'
import { addOfflineAccount } from '../helpers/tasks/addAccount'
import { createInstance } from '../helpers/tasks/createInstance'
import { browseInstanceContent } from '../helpers/tasks/browseContent'
import { shoot } from '../helpers/shoot'

test.setTimeout(10 * 60_000)

test('Mod flow — Fabric instance with mods, resource packs and shaders', async ({
  launcher,
}) => {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }
  await shell.waitReady()

  await shoot(ctx, '00-launcher-opened', {
    caption: 'The launcher opens on the **Home** view.',
  })

  await addOfflineAccount(launcher, 'ModExplorer')

  await createInstance(launcher, {
    name: 'Fabric Garden',
    loader: 'fabric',
  })

  await browseInstanceContent(launcher, {
    mod: 'iris',
    resourcePack: 'Better 3D',
    shaderPack: 'complementary reimagined',
  })

  await shell.goto('/')
  await shoot(ctx, '99-done', {
    caption: 'Done — Fabric instance with mods, resource packs and shaders is ready.',
  })
})
