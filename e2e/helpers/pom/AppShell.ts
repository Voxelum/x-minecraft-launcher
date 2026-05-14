/**
 * Page Object Model — anchor selectors for stable journey scripts.
 *
 * RULE: every locator here MUST use getByTestId() or getByRole(). Never use
 * text content (it changes between locales) or class names (they're styling).
 *
 * Add new test ids to the corresponding *.vue file when needed and document
 * them here. The data-testid set is the contract between the launcher and
 * the e2e suite.
 */
import { Locator, Page } from '@playwright/test'

export class AppShell {
  constructor(public main: Page) {}

  // Bootstrap / setup wizard
  get setupRoot(): Locator { return this.main.getByTestId('setup-root') }
  get setupNext(): Locator { return this.main.getByTestId('setup-next') }
  get setupPrev(): Locator { return this.main.getByTestId('setup-prev') }
  get setupLocaleSelect(): Locator { return this.main.getByTestId('setup-locale-select') }
  get setupAppearance(): Locator { return this.main.getByTestId('setup-appearance') }
  get setupDataRoot(): Locator { return this.main.getByTestId('setup-data-root') }
  get setupAccount(): Locator { return this.main.getByTestId('setup-account') }
  get setupAccountAdd(): Locator { return this.main.getByTestId('setup-account-add') }
  get setupAccountSkip(): Locator { return this.main.getByTestId('setup-account-skip') }

  // Main app shell — sidebar
  get sidebar(): Locator { return this.main.getByTestId('app-sidebar') }
  get navAccounts(): Locator { return this.main.getByTestId('nav-accounts') }
  get navStore(): Locator { return this.main.getByTestId('nav-store') }
  get navMultiplayer(): Locator { return this.main.getByTestId('nav-multiplayer') }
  get navSettings(): Locator { return this.main.getByTestId('nav-settings') }
  get navAddInstance(): Locator { return this.main.getByTestId('nav-add-instance') }

  /** Navigate via the router directly — robust against sidebar variant changes. */
  async goto(path: string): Promise<void> {
    await this.main.evaluate((p) => {
      const win = window as unknown as { __router?: { push: (p: string) => Promise<void> } }
      if (win.__router) return win.__router.push(p)
      window.location.assign(p)
    }, path)
  }

  // Login form
  get loginAuthority(): Locator { return this.main.getByTestId('login-authority') }
  get loginUsername(): Locator { return this.main.getByTestId('login-username') }
  get loginPassword(): Locator { return this.main.getByTestId('login-password') }
  get loginSubmit(): Locator { return this.main.getByTestId('login-submit') }

  // Home / instance bar
  get launchButton(): Locator { return this.main.getByTestId('launch-button') }
  get createInstance(): Locator { return this.main.getByTestId('create-instance') }
  get instanceItems(): Locator { return this.main.getByTestId('instance-item') }

  // Add Instance dialog
  get addInstanceDialog(): Locator { return this.main.getByTestId('add-instance-dialog') }
  get addInstanceName(): Locator { return this.main.getByTestId('add-instance-name') }
  get addInstanceCreate(): Locator { return this.main.getByTestId('add-instance-create') }
  get addInstanceNext(): Locator { return this.main.getByTestId('add-instance-next') }
  get addInstanceCancel(): Locator { return this.main.getByTestId('add-instance-cancel') }
  get addInstanceImport(): Locator { return this.main.getByTestId('add-instance-import') }

  /** Inner combobox of a `version-input-{loader}` block. */
  versionInput(loader: 'minecraft' | 'fabric' | 'forge' | 'neoforge' | 'quilt'): Locator {
    return this.main
      .getByTestId(`version-input-${loader}`)
      .locator('input[role="combobox"]')
      .first()
  }

  // Store
  get storePage(): Locator { return this.main.getByTestId('store-page') }
  get storeSearch(): Locator { return this.main.getByTestId('store-search') }
  get storeProjectCards(): Locator { return this.main.getByTestId('store-project-card') }
  get storeInstall(): Locator { return this.main.getByTestId('store-install') }

  // Install version dialog (modpack version chooser)
  get installVersionDialog(): Locator { return this.main.getByTestId('install-version-dialog') }
  get installVersionConfirm(): Locator { return this.main.getByTestId('install-version-confirm') }

  // HomeInstanceInstallDialog (modpack file diff confirm)
  get installInstanceConfirm(): Locator { return this.main.getByTestId('install-instance-confirm') }

  // Settings
  get settingsPage(): Locator { return this.main.getByTestId('settings-page') }
  get settingsProxyHost(): Locator { return this.main.getByTestId('settings-proxy-host') }
  get settingsCheckUpdate(): Locator { return this.main.getByTestId('settings-check-update') }

  // Accounts (Me page)
  get accountsAdd(): Locator { return this.main.getByTestId('accounts-add') }
  get accountItems(): Locator { return this.main.getByTestId('account-item') }

  // Multiplayer
  get multiplayerPage(): Locator { return this.main.getByTestId('multiplayer-page') }
  get multiplayerJoin(): Locator { return this.main.getByTestId('multiplayer-join') }
  get multiplayerGroupId(): Locator { return this.main.getByTestId('multiplayer-group-id') }

  // Generic helpers
  async waitReady(): Promise<void> {
    await this.main.waitForFunction(
      () => !!document.querySelector('[data-testid="setup-root"], [data-testid="app-sidebar"]'),
      undefined,
      { timeout: 30_000 },
    )
  }

  async isBootstrapVisible(): Promise<boolean> {
    return await this.setupRoot.isVisible().catch(() => false)
  }
}
