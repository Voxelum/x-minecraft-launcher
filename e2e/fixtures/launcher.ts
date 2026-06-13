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

// e2e/ is intentionally outside the pnpm workspace (see README) so Playwright's
// auto-resolve via local `node_modules/electron` doesn't find a binary. Point at
// the workspace electron the launcher itself uses — the same binary `compile`
// produces output for.
const ELECTRON_BIN = process.platform === 'win32'
  ? resolve(REPO_ROOT, 'xmcl-electron-app/node_modules/electron/dist/electron.exe')
  : process.platform === 'darwin'
    ? resolve(REPO_ROOT, 'xmcl-electron-app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
    : resolve(REPO_ROOT, 'xmcl-electron-app/node_modules/electron/dist/electron')

/**
 * Poll `app.windows()` until at least one window's `url()` matches `pattern`,
 * then return that page. Falls back to `app.firstWindow()` if the timeout
 * elapses, throwing a descriptive error that enumerates every observed
 * window URL so CI logs pinpoint which window the launcher stalled on.
 */
async function waitForAppWindow(
  app: ElectronApplication,
  pattern: RegExp,
  timeoutMs: number,
): Promise<Page> {
  const deadline = Date.now() + timeoutMs
  const seen = new Set<string>()
  const collect = (win: Page) => {
    const url = win.url()
    if (url) seen.add(url)
  }
  for (const win of app.windows()) collect(win)
  app.on('window', collect)
  try {
    while (Date.now() < deadline) {
      for (const win of app.windows()) {
        const url = win.url()
        if (url) seen.add(url)
        if (pattern.test(url)) {
          try {
            await win.waitForLoadState('domcontentloaded', { timeout: 5_000 })
          } catch {
            // The page reported the target URL but did not reach DOMContentLoaded
            // within 5s. Return it anyway — downstream `shell.waitReady()` polls
            // for testids on a longer timeout and will surface a real failure.
          }
          return win
        }
      }
      // Cross-check by asking the electron main process what BrowserWindows
      // actually exist. Playwright's `app.windows()` occasionally misses
      // pages on Linux/xvfb (custom session partition + headless rendering
      // race the CDP `Target.targetCreated` event). The main-process view is
      // authoritative — surface its observations into the timeout error so
      // CI logs explain *why* Playwright couldn't see them.
      try {
        const mainViewed: Array<{ id: number; url: string; loading: boolean; destroyed: boolean }> =
          await app.evaluate(({ BrowserWindow }) =>
            (BrowserWindow.getAllWindows() as any[]).map((w) => ({
              id: w.id,
              url: w.webContents.getURL(),
              loading: w.webContents.isLoading(),
              destroyed: w.isDestroyed(),
            })),
          )
        for (const w of mainViewed) {
          if (w.url) seen.add(`main:${w.url}`)
        }
      } catch {
        // ignore — evaluate can race the app close
      }
      await new Promise((r) => setTimeout(r, 250))
    }
  } finally {
    app.off('window', collect)
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for a launcher window matching ${pattern}. ` +
    `Observed window URLs: ${seen.size ? Array.from(seen).map((u) => JSON.stringify(u)).join(', ') : '<none>'}`,
  )
}

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
      executablePath: ELECTRON_BIN,
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

    // Mirror the electron child process stdio into the test output so CI
    // artifacts capture launcher logs whenever a boot hangs/crashes.
    const proc = app.process()
    proc.stdout?.on('data', (b: Buffer) => process.stdout.write(`[electron] ${b}`))
    proc.stderr?.on('data', (b: Buffer) => process.stderr.write(`[electron] ${b}`))

    // The launcher creates multiple BrowserWindows over the boot sequence
    // (optional migration window, then the main window via createAppWindow).
    // Playwright's `firstWindow()` resolves on the *earliest* WebContents
    // creation, which on Linux/xvfb is sometimes a transient window that
    // never reaches `domcontentloaded` — waitForLoadState then hangs the
    // full timeout. Instead, poll `app.windows()` until we find a window
    // whose URL ends in one of the renderer entry HTMLs the launcher loads
    // for the actual UI (index.html for normal runs, setup.html for the
    // first-launch wizard).
    //
    // On github-hosted ubuntu-24 + xvfb the launcher's custom-protocol
    // BrowserWindow does not surface to Playwright as a CDP page target
    // (`app.windows()` stays empty even though `BrowserWindow.getAllWindows()`
    // inside `app.evaluate` lists it with the correct URL). The smoke spec
    // drives its assertions through `app.evaluate` directly and does not
    // need `main` — so make the page resolution best-effort: any spec that
    // *does* touch `main` should fail loudly with a descriptive error
    // instead of hanging the fixture.
    const ENTRY_PATTERN = /\/(index|setup)\.html(\?|#|$)/
    let main: Page
    try {
      main = await waitForAppWindow(app, ENTRY_PATTERN, 30_000)
    } catch (err) {
      const message = (err as Error).message
      const stub = new Proxy({} as Page, {
        get(_t, prop) {
          throw new Error(
            `launcher.main is unavailable: ${message}. ` +
            `This fixture could not attach a Playwright Page to the launcher's BrowserWindow ` +
            `(commonly: custom-protocol target on Linux/xvfb). Drive your spec through ` +
            `\`launcher.app.evaluate(...)\` instead, or attempted property: ${String(prop)}.`,
          )
        },
      })
      main = stub
    }

    const manifest = newJourneyManifest({
      journey: testInfo.titlePath.join(' / '),
      locale,
      file: testInfo.file,
    })

    try {
      await use({ app, main, gameDataPath, appDataPath, locale, manifest })
    } finally {
      await flushJourneyManifest(manifest)
      // On failure, copy launcher logs out of the per-test temp before rm,
      // so CI's upload-artifacts step picks them up.
      if (testInfo.status !== testInfo.expectedStatus) {
        try {
          const { cp } = await import('node:fs/promises')
          await cp(appDataPath, join(testInfo.outputDir, 'launcher-appdata'), {
            recursive: true,
            errorOnExist: false,
            filter: (src) => /\.(log|json|txt)$/.test(src) || !src.includes('.'),
          })
        } catch {
          // Best-effort; don't mask the real failure.
        }
      }
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
