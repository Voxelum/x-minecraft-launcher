/**
 * High-level task: install a modpack from the Store.
 *
 * Drives the live Modrinth/CurseForge endpoints (no mocks). The flow is:
 *
 *   1. Sidebar → Store
 *   2. Type a search query → wait for project cards
 *   3. Click the first matching card → project detail page
 *   4. Click **Install** → version dialog opens
 *   5. Click the first version row → version detail
 *   6. Click **Install** in the dialog → modpack downloads
 *   7. The HomeInstanceInstallDialog opens → click **Update** to confirm
 *   8. Wait until the launcher returns to Home with the new instance
 */
import { LauncherFixture } from '../../fixtures/launcher'
import { AppShell } from '../pom/AppShell'
import { shoot } from '../shoot'

export interface InstallFromStoreArgs {
  /** Search keyword (e.g. "fabulously optimized"). */
  query: string
  /** Optional fuzzy substring of the project title to disambiguate. */
  matchTitle?: string
  /** Hard cap for the modpack download phase. */
  downloadTimeoutMs?: number
}

export async function installModpackFromStore(
  launcher: LauncherFixture,
  args: InstallFromStoreArgs,
): Promise<void> {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }

  await shell.navStore.click()
  await shell.storePage.waitFor({ state: 'visible', timeout: 15_000 })
  await shoot(ctx, '01-store', {
    caption: 'Step 1. Open the **Store** from the side bar.',
  })

  await shell.storeSearch.click()
  await shell.storeSearch.fill(args.query)
  // Wait for live search results.
  await shell.storeProjectCards.first().waitFor({ state: 'visible', timeout: 30_000 })
  await launcher.main.waitForTimeout(500)
  await shoot(ctx, '02-search', {
    caption: `Step 2. Search for **${args.query}**.`,
  })

  // Pick the best card. If a title hint was given, prefer a card whose text
  // contains it; otherwise take the first one.
  let target = shell.storeProjectCards.first()
  if (args.matchTitle) {
    const matched = shell.storeProjectCards.filter({ hasText: args.matchTitle }).first()
    if (await matched.count() > 0) target = matched
  }
  await target.click()

  await shell.storeInstall.waitFor({ state: 'visible', timeout: 30_000 })
  await shoot(ctx, '03-project', {
    caption: 'Step 3. Open the project, then click **Install**.',
  })
  await shell.storeInstall.click()

  await shell.installVersionDialog.waitFor({ state: 'visible', timeout: 15_000 })
  // The first version row is `StoreProjectInstallVersionDialogVersion`. Click
  // it to enter the version-detail view, which exposes the confirm button.
  const firstVersionRow = shell.installVersionDialog
    .locator('[class*="rounded-lg"]')
    .filter({ hasNot: launcher.main.locator('.v-toolbar') })
    .first()
  await firstVersionRow.click().catch(() => {})
  await shell.installVersionConfirm.waitFor({ state: 'visible', timeout: 15_000 })
  await shoot(ctx, '04-version', {
    caption: 'Step 4. Pick the **latest version** in the dialog.',
  })

  await shell.installVersionConfirm.click()

  // Modpack downloads → HomeInstanceInstallDialog opens.
  const downloadTimeout = args.downloadTimeoutMs ?? 5 * 60_000
  await shell.installInstanceConfirm.waitFor({
    state: 'visible',
    timeout: downloadTimeout,
  })
  await shoot(ctx, '05-confirm', {
    caption: 'Step 5. Review the file changes, then click **Update** to install.',
  })

  await shell.installInstanceConfirm.click()

  // Wait for the dialog to close and the launcher to return to Home.
  await launcher.main
    .waitForFunction(
      () => !document.querySelector('[data-testid="install-instance-confirm"]'),
      undefined,
      { timeout: downloadTimeout },
    )
    .catch(() => {})
  await launcher.main.waitForTimeout(1500)
  await shoot(ctx, '06-home', {
    caption: 'Step 6. The modpack is installed and you are returned to **Home**.',
  })
}
