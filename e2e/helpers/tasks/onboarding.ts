/**
 * High-level task: complete the first-launch onboarding wizard.
 *
 * Captures one screenshot per wizard step so the resulting tutorial section
 * shows the user exactly what each page looks like.
 */
import { LauncherFixture } from '../../fixtures/launcher'
import { AppShell } from '../pom/AppShell'
import { shoot } from '../shoot'

export interface OnboardingOptions {
  /** Account name to use during the offline-login step. */
  username?: string
  /** Skip the account step entirely. */
  skipAccount?: boolean
}

export async function completeOnboarding(
  launcher: LauncherFixture,
  opts: OnboardingOptions = {},
): Promise<void> {
  const shell = new AppShell(launcher.main)
  const ctx = { main: launcher.main, manifest: launcher.manifest }

  await shell.waitReady()

  await shoot(ctx, '01-locale', {
    caption: 'Step 1. Pick your **language** and click **Next**.',
    waitFor: [shell.setupLocaleSelect],
  })
  await shell.setupNext.click()

  await shoot(ctx, '02-appearance', {
    caption: 'Step 2. Choose a **theme** and click **Next**.',
    waitFor: [shell.setupAppearance],
  })
  await shell.setupNext.click()

  await shoot(ctx, '03-data-root', {
    caption: 'Step 3. Confirm where the launcher will store **game data**, then click **Next**.',
    waitFor: [shell.setupDataRoot],
  })
  await shell.setupNext.click()

  await shoot(ctx, '04-account', {
    caption: opts.skipAccount
      ? 'Step 4. Skip the **account** step — add one later from **Accounts**.'
      : 'Step 4. Add your **Minecraft account**, then click **Confirm**.',
    waitFor: [shell.setupAccount],
  })

  if (opts.skipAccount) {
    await shell.setupNext.click()
  } else {
    await shell.setupAccountAdd.click()
    // The default authority is Microsoft (needs a real email); switch to the
    // offline account system before entering a plain username.
    await shell.selectOfflineAuthority()
    await shell.loginUsername.fill(opts.username ?? 'TestPlayer')
    await shell.loginSubmit.click()
    // Offline login is instant and closes the dialog. Wait for the dialog's
    // overlay to go away before advancing, or the fading scrim eats the click.
    await shell.loginSubmit.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
    await shell.setupNext.click()
  }

  await shell.sidebar.waitFor({ state: 'visible', timeout: 30_000 })

  // The first-launch guided tour (driver.js) auto-starts here and its overlay
  // blocks all subsequent clicks — dismiss it before the storyline continues.
  await shell.dismissTutorial()

  await shoot(ctx, '05-home', {
    caption: 'You are in! The **Home** view is where you launch and manage instances.',
  })
}
