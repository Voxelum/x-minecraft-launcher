/**
 * Core Playwright fixture: launches a real Electron instance against an
 * isolated, freshly-created launcher root.
 *
 * Determinism guarantees:
 *  - Per-test temp directory for both Electron `userData` and the XMCL game
 *    data root. No shared state between tests.
 *  - Auto-updater disabled via XMCL_E2E env var.
 *  - Real `java` spawn short-circuited via XMCL_E2E_NO_LAUNCH.
 *  - Microsoft OAuth not exercised in this PR — tests use offline auth.
 *
 * Tutorial guarantees:
 *  - The fixture exposes a `manifest` recorder that all `shoot()` calls write
 *    into. After the test, the manifest is flushed to artifacts/screenshots
 *    so scripts/build-tutorial.ts can compile docs.
 */
import { _electron, ElectronApplication, Page, test as base } from '@playwright/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  JourneyManifest,
  flushJourneyManifest,
  newJourneyManifest,
} from '../helpers/manifest'
import { SeedInstance, seedSandbox } from '../helpers/sandbox'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')
const ELECTRON_ENTRY = resolve(REPO_ROOT, 'xmcl-electron-app/dist/index.js')

export interface LauncherFixture {
  /** Underlying Playwright Electron application. */
  app: ElectronApplication
  /** First main window. */
  main: Page
  /** Per-test isolated game data root. */
  gameDataPath: string
  /** Per-test isolated Electron userData / app data path. */
  appDataPath: string
  /** Active locale for this test (carried from project metadata). */
  locale: string
  /** Mutable manifest the shoot() helper appends to. */
  manifest: JourneyManifest
}

export interface LauncherOptions {
  /**
   * If true, skip writing the `root` file so the launcher shows the bootstrap
   * (first-launch) wizard. Default: false.
   */
  bootstrap?: boolean
  /**
   * Pre-seed the launcher root with sandbox files (see helpers/sandbox.ts).
   * Pass an instance descriptor to also create a synthetic instance + version.
   */
  seed?: SeedInstance | true
  /** Locale override (defaults to project metadata). */
  locale?: string
}

export const test = base.extend<{
  launcher: LauncherFixture
  launcherOptions: LauncherOptions
}>({
  // Default options — overridden per-test with `test.use({ launcherOptions: { ... } })`.
  launcherOptions: [{ bootstrap: false }, { option: true }],

  launcher: async ({ launcherOptions }, use, testInfo) => {
    const projectLocale =
      (testInfo.project.use as { locale?: string } | undefined)?.locale ?? 'en'
    const locale = launcherOptions.locale ?? projectLocale

    const tempRoot = await mkdtemp(join(tmpdir(), 'xmcl-e2e-'))
    const appDataPath = join(tempRoot, 'appData')
    const gameDataPath = join(tempRoot, 'gameData')
    await mkdir(appDataPath, { recursive: true })
    await mkdir(gameDataPath, { recursive: true })

    // Layout matches what xmcl-runtime/app/LauncherApp.ts expects:
    //   {appDataPath}/xmcl/root  -> contains the game data path
    // We write directly into the e2e-controlled appData parent so a fresh
    // run skips the bootstrap dialog. To trigger bootstrap, leave it absent.
    if (!launcherOptions.bootstrap) {
      const xmclDir = join(appDataPath, 'xmcl')
      await mkdir(xmclDir, { recursive: true })
      await writeFile(join(xmclDir, 'root'), gameDataPath)
    }

    if (launcherOptions.seed) {
      const inst = launcherOptions.seed === true ? undefined : launcherOptions.seed
      await seedSandbox(gameDataPath, inst)
    }

    const app = await _electron.launch({
      executablePath: undefined, // Use the workspace electron binary auto-resolved by Playwright.
      args: [ELECTRON_ENTRY],
      cwd: resolve(REPO_ROOT, 'xmcl-electron-app/dist'),
      env: {
        ...process.env,
        // Test-mode flags consumed by main process hooks (see ElectronLauncherApp.ts).
        XMCL_E2E: '1',
        XMCL_E2E_APP_DATA: appDataPath,
        XMCL_E2E_NO_LAUNCH: '1',
        XMCL_E2E_LOCALE: locale,
        // Make the launcher logs deterministic.
        NODE_ENV: 'production',
        FORCE_COLOR: '0',
      },
      timeout: 60_000,
      recordVideo: { dir: testInfo.outputDir },
    })

    const main = await app.firstWindow()
    await main.waitForLoadState('domcontentloaded')

    const manifest = newJourneyManifest({
      journey: testInfo.titlePath.join(' / '),
      locale,
      file: testInfo.file,
    })

    try {
      await use({ app, main, gameDataPath, appDataPath, locale, manifest })
    } finally {
      await flushJourneyManifest(manifest)
      try {
        await app.close()
      } catch {
        // Electron may already be torn down by a test failure; ignore.
      }
      await rm(tempRoot, { recursive: true, force: true }).catch(() => {})
    }
  },
})

export { expect } from '@playwright/test'
