/**
 * High-level task: create a new instance with an optional mod loader.
 *
 * Uses the AddInstanceDialog. With network mocking disabled, this hits the
 * live Minecraft / loader meta endpoints (Mojang, Fabric/Forge/NeoForge).
 *
 * Selection contract:
 *   - The Minecraft version picker is keyed off `version-input-minecraft`.
 *   - Each loader picker (`fabric`, `forge`, `neoforge`, `quilt`) has its own
 *     `version-input-{loader}` block. The first option of the autocomplete is
 *     accepted by pressing ArrowDown then Enter — that resolves to the latest
 *     compatible version returned by the live meta endpoint.
 */
import { LauncherFixture } from '../../fixtures/launcher'
import { AppShell } from '../pom/AppShell'
import { shoot } from '../shoot'

export type LoaderKind = 'fabric' | 'forge' | 'neoforge' | 'quilt'

export interface CreateInstanceArgs {
  name: string
  /** Minecraft version label that appears in the version picker. */
  minecraft?: string
  /** Optional mod loader. Picks the latest version compatible with `minecraft`. */
  loader?: LoaderKind
  /** Take screenshots for the tutorial. Default true. */
  shoot?: boolean
  /**
   * Prepended to every step key (e.g. `forge-`). Lets a single spec call
   * `createInstance` more than once without colliding screenshot file names.
   */
  stepPrefix?: string
}

/** Open AddInstanceDialog from the sidebar. */
export async function openAddInstance(launcher: LauncherFixture): Promise<void> {
  const shell = new AppShell(launcher.main)
  // Either the home "+" or the sidebar "add instance" works.
  const addBtn = shell.navAddInstance.or(shell.createInstance).first()
  await addBtn.click()
  await shell.addInstanceDialog.waitFor({ state: 'visible', timeout: 10_000 })
}

/** Pick the first non-empty option from the currently-focused autocomplete. */
async function pickFirst(launcher: LauncherFixture): Promise<void> {
  await launcher.main.keyboard.press('ArrowDown')
  await launcher.main.waitForTimeout(150)
  await launcher.main.keyboard.press('Enter')
}

export async function createInstance(
  launcher: LauncherFixture,
  args: CreateInstanceArgs,
): Promise<void> {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }
  const shouldShoot = args.shoot ?? true
  const prefix = args.stepPrefix ?? ''
  const key = (k: string) => `${prefix}${k}`

  await openAddInstance(launcher)
  if (shouldShoot) {
    await shoot(ctx, key('01-add-dialog'), {
      caption: 'Step 1. Open **Create instance** from the side bar.',
    })
  }

  await shell.addInstanceName.fill(args.name)
  if (shouldShoot) {
    await shoot(ctx, key('02-name'), {
      caption: `Step 2. Name the instance (here: \`${args.name}\`).`,
    })
  }

  const mcInput = shell.versionInput('minecraft')
  await mcInput.click()
  if (args.minecraft) {
    await mcInput.fill(args.minecraft)
    await launcher.main.waitForTimeout(250)
  }
  await pickFirst(launcher)
  if (shouldShoot) {
    await shoot(ctx, key('03-version'), {
      caption: args.minecraft
        ? `Step 3. Pick the **Minecraft** version (here: \`${args.minecraft}\`).`
        : 'Step 3. Accept the **latest Minecraft release**.',
      detail: 'Loader (Forge / Fabric / NeoForge / Quilt) is picked separately below.',
    })
  }

  if (args.loader) {
    const loaderInput = shell.versionInput(args.loader)
    await loaderInput.click()
    await launcher.main.waitForTimeout(800) // give the loader meta a moment to load
    await pickFirst(launcher)
    if (shouldShoot) {
      await shoot(ctx, key('04-loader'), {
        caption: `Step 4. Pick a **${args.loader[0].toUpperCase()}${args.loader.slice(1)}** loader version.`,
      })
    }
  }

  await shell.addInstanceCreate.click()
  await shell.addInstanceDialog
    .waitFor({ state: 'hidden', timeout: 60_000 })
    .catch(() => {})
  if (shouldShoot) {
    await shoot(ctx, key('05-created'), {
      caption: 'Step 5. The new instance is selected and visible in the side bar.',
    })
  }
}
