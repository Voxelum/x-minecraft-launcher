/**
 * High-level task: walk through the in-instance content pages (mods,
 * resource packs, shaders) using the global `keyword` query parameter to
 * pre-fill the search.
 *
 * Each page exposes a remote/marketplace search wired through the
 * `kSearchModel` composable. Setting `?keyword=…` on the route makes the
 * search reactive without driving a text input.
 */
import { LauncherFixture } from '../../fixtures/launcher'
import { AppShell } from '../pom/AppShell'
import { shoot } from '../shoot'

export interface BrowseContentArgs {
  /** Mod search keyword (e.g. "iris"). */
  mod?: string
  /** Resource pack keyword (e.g. "Better 3D"). */
  resourcePack?: string
  /** Shader pack keyword (e.g. "complementary reimagined"). */
  shaderPack?: string
}

export async function browseInstanceContent(
  launcher: LauncherFixture,
  args: BrowseContentArgs,
): Promise<void> {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }

  if (args.mod) {
    await shell.goto(`/mods?keyword=${encodeURIComponent(args.mod)}`)
    await launcher.main.waitForTimeout(1500) // give the live search a moment
    await shoot(ctx, '10-mods-search', {
      caption: `Step. Open **Mods** for this instance and search for \`${args.mod}\`.`,
      detail: 'Switch source between Modrinth and CurseForge with the icon button next to the title.',
    })
    // Try to focus the first remote result so the detail pane shows it.
    await launcher.main.locator('[data-testid="app-sidebar"]').first().waitFor().catch(() => {})
    await shoot(ctx, '11-mods-detail', {
      caption: `Step. Pick a result (here: \`${args.mod}\`) — the detail pane shows versions and dependencies.`,
    })
  }

  if (args.resourcePack) {
    await shell.goto(`/resourcepacks?keyword=${encodeURIComponent(args.resourcePack)}`)
    await launcher.main.waitForTimeout(1500)
    await shoot(ctx, '20-resourcepacks-search', {
      caption: `Step. Browse **Resource packs** for \`${args.resourcePack}\`.`,
    })
  }

  if (args.shaderPack) {
    await shell.goto(`/shaderpacks?keyword=${encodeURIComponent(args.shaderPack)}`)
    await launcher.main.waitForTimeout(1500)
    await shoot(ctx, '30-shaderpacks-search', {
      caption: `Step. Browse **Shader packs** for \`${args.shaderPack}\`.`,
      detail: 'Shaders only render with a compatible loader (Iris / Optifine).',
    })
  }
}
