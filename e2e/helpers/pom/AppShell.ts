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
      window.location.hash = p
    }, path)
  }

  // Login form
  get loginAuthority(): Locator { return this.main.getByTestId('login-authority') }
  /** An authority option inside the open authority dropdown, e.g. 'offline'. */
  loginAuthorityItem(slug: string): Locator { return this.main.getByTestId(`login-authority-item-${slug}`) }
  // Vuetify puts `data-testid` on the field's root <div>, so drill into the
  // actual <input> the value must be typed into (VCombobox / VTextField).
  get loginUsername(): Locator { return this.main.getByTestId('login-username').locator('input') }
  get loginPassword(): Locator { return this.main.getByTestId('login-password').locator('input') }
  get loginSubmit(): Locator { return this.main.getByTestId('login-submit') }

  /** Switch the login dialog's authority to the offline (`x://dev`) account system. */
  async selectOfflineAuthority(): Promise<void> {
    await this.loginAuthority.click()
    await this.loginAuthorityItem('offline').click()
  }

  // Home / instance bar
  get launchButton(): Locator { return this.main.getByTestId('launch-button') }
  get createInstance(): Locator { return this.main.getByTestId('create-instance') }
  get instanceItems(): Locator { return this.main.getByTestId('instance-item') }

  // Add Instance dialog
  get addInstanceDialog(): Locator { return this.main.getByTestId('add-instance-dialog') }
  get addInstanceName(): Locator { return this.main.getByTestId('add-instance-name').locator('input') }
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

  /** The loader selection card (vanilla / fabric / forge / neoforge / quilt) in AddInstance. */
  modloaderTab(loader: string): Locator {
    return this.main.getByTestId(`modloader-tab-${loader}`)
  }

  // Store
  get storePage(): Locator { return this.main.getByTestId('store-page') }
  get storeSearch(): Locator { return this.main.getByTestId('store-search').locator('input') }
  get storeProjectCards(): Locator { return this.main.getByTestId('store-project-card') }
  get storeInstall(): Locator { return this.main.getByTestId('store-install') }

  // Install version dialog (modpack version chooser)
  get installVersionDialog(): Locator { return this.main.getByTestId('install-version-dialog') }
  get installVersionItem(): Locator { return this.main.getByTestId('install-version-item') }
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
  /** The identity row on the Me page that opens the account menu / login dialog. */
  get meUserSwitcher(): Locator { return this.main.getByTestId('me-user-switcher') }

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

  /**
   * Dismiss the first-launch guided tour (driver.js) if it is showing. The
   * tour auto-starts on the Home view and its full-screen SVG overlay
   * (`.driver-overlay`) intercepts every pointer event, blocking scripted
   * clicks. Escape closes it (the tour is created with `allowClose: true`).
   */
  async dismissTutorial(): Promise<void> {
    const overlay = this.main.locator('.driver-overlay')
    // The tour auto-starts a moment after Home renders; give it a brief window
    // to appear (only costs time when it never shows), then close it.
    await overlay.first().waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {})
    for (let i = 0; i < 5; i++) {
      if (!(await overlay.count().catch(() => 0))) return
      await this.main.keyboard.press('Escape').catch(() => {})
      await overlay.first().waitFor({ state: 'detached', timeout: 2_000 }).catch(() => {})
    }
  }

  async isBootstrapVisible(): Promise<boolean> {
    return await this.setupRoot.isVisible().catch(() => false)
  }
}
