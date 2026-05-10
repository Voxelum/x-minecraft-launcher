/**
 * High-level task: add an offline (cracked-style) account from the Me page,
 * after the launcher is past the bootstrap wizard.
 */
import { LauncherFixture } from '../../fixtures/launcher'
import { AppShell } from '../pom/AppShell'
import { shoot } from '../shoot'

export async function addOfflineAccount(
  launcher: LauncherFixture,
  username = 'TestPlayer',
): Promise<void> {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }

  await shell.navAccounts.click()
  await shell.accountsAdd.waitFor({ state: 'visible', timeout: 10_000 })
  await shoot(ctx, '01-me-page', {
    caption: 'Step 1. Open the **Accounts** page from the side bar.',
  })

  await shell.accountsAdd.click()
  await shell.loginAuthority.click().catch(() => {})
  await shell.loginUsername.fill(username)
  await shoot(ctx, '02-fill-username', {
    caption: `Step 2. Choose **Offline** and enter a username (\`${username}\`).`,
  })

  await shell.loginSubmit.click()
  await shell.accountItems.first().waitFor({ state: 'visible', timeout: 10_000 })
  await shoot(ctx, '03-added', {
    caption: 'Step 3. The new account appears in your **Accounts** list.',
  })
}
