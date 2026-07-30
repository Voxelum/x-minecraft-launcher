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

  // The first-launch guided tour overlay blocks sidebar clicks — dismiss it.
  await shell.dismissTutorial()

  await shell.navAccounts.click()
  await shell.meUserSwitcher.waitFor({ state: 'visible', timeout: 10_000 })
  await shoot(ctx, '01-me-page', {
    caption: 'Step 1. Open the **Accounts** page from the side bar.',
  })

  // Open the login dialog. With no accounts yet, the identity row opens it
  // directly; once accounts exist it opens a menu whose "add" button does.
  await shell.meUserSwitcher.click()
  if (await shell.accountsAdd.isVisible().catch(() => false)) {
    await shell.accountsAdd.click()
  }

  await shell.selectOfflineAuthority()
  await shell.loginUsername.fill(username)
  await shoot(ctx, '02-fill-username', {
    caption: `Step 2. Choose **Offline** and enter a username (\`${username}\`).`,
  })

  await shell.loginSubmit.click()
  // The login dialog closes on a successful offline login.
  await shell.loginAuthority.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})
  await shoot(ctx, '03-added', {
    caption: 'Step 3. The new account appears in your **Accounts** list.',
  })
}
