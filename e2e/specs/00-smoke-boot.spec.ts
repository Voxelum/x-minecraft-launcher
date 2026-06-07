/**
 * Storyline 0 — Boot smoke.
 *
 * Catches bundler-level regressions where the production renderer fails to
 * start at all — e.g. the rolldown chunk-splitting bug that shipped in
 * 0.56.5 (`Uncaught ReferenceError: init_runtime_dom_esm_bundler is not
 * defined` in `VSpacer-*.js`, see vitejs/vite#22583). This kind of bug only
 * reproduces against the production build, never in dev mode, so we must
 * exercise the packaged `xmcl-electron-app/dist/` bundle in both shapes a
 * real user can encounter:
 *
 *   - **New user**: empty appData, no `root` file → onboarding wizard renders
 *   - **Old user**: existing root with a seeded instance → main shell renders
 *
 * Both tests collect every uncaught page error and console error and fail
 * fast on any `ReferenceError` / `is not defined` / missing init helper.
 *
 * Keep this spec deliberately thin — it must NOT depend on network, Mojang
 * meta, or any per-route content. The only contract it asserts is "the
 * launcher window can render its first interactive surface".
 */
import { test, expect } from '../fixtures/launcher'
import { AppShell } from '../helpers/pom/AppShell'

interface BootDiagnostics {
  pageErrors: Error[]
  consoleErrors: string[]
}

async function attachDiagnostics(page: import('@playwright/test').Page): Promise<BootDiagnostics> {
  const diag: BootDiagnostics = { pageErrors: [], consoleErrors: [] }
  page.on('pageerror', (err) => diag.pageErrors.push(err))
  page.on('console', (msg) => {
    if (msg.type() === 'error') diag.consoleErrors.push(msg.text())
  })
  // Some bundler-level crashes (e.g. the vitejs/vite#22583 rolldown
  // chunk-splitting regression) fire `window.onerror` BEFORE Playwright's
  // pageerror event listener attaches, so they get lost. Install a tiny
  // early hook via addInitScript — guaranteed to run before any chunk
  // imports — that buffers the message into a global we can read back.
  await page.addInitScript(() => {
    const errs: string[] = []
    ;(window as unknown as { __bootErrors: string[] }).__bootErrors = errs
    window.addEventListener('error', (e) => {
      errs.push(`${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`)
    })
    window.addEventListener('unhandledrejection', (e) => {
      errs.push(`unhandledrejection: ${String((e as PromiseRejectionEvent).reason)}`)
    })
  }).catch(() => {
    // addInitScript may fail if the page has already navigated; fall back
    // to the event listeners above.
  })
  return diag
}

// Renderer-level boot failures the launcher must never silently ship.
// Each entry is matched as a case-insensitive substring across both
// pageerror messages and console.error output.
const BOOT_BREAKERS = [
  'is not defined',
  'init_runtime_dom_esm_bundler',
  'init_runtime_core_esm_bundler',
  'init_reactivity_esm_bundler',
  'init_shared_esm_bundler',
  'Failed to fetch dynamically imported module',
  'Unexpected token',
  'SyntaxError',
]

function assertNoBootBreakers(diag: BootDiagnostics, earlyErrors: string[] = []): void {
  const all = [
    ...diag.pageErrors.map((e) => `pageerror: ${e.message}`),
    ...diag.consoleErrors.map((m) => `console.error: ${m}`),
    ...earlyErrors.map((m) => `window.onerror: ${m}`),
  ]
  const fatal = all.filter((line) =>
    BOOT_BREAKERS.some((needle) => line.toLowerCase().includes(needle.toLowerCase())),
  )
  expect(
    fatal,
    `Renderer reported a boot-level failure. Full diagnostics:\n${all.join('\n') || '<none>'}`,
  ).toEqual([])
}

async function readEarlyErrors(page: import('@playwright/test').Page): Promise<string[]> {
  return await page
    .evaluate(() => (window as unknown as { __bootErrors?: string[] }).__bootErrors ?? [])
    .catch(() => [] as string[])
}

test.describe('Boot smoke', () => {
  test.describe('new user (no existing root)', () => {
    test.use({ launcherOptions: { bootstrap: true } })

    test('main renderer boots without uncaught errors and shows the onboarding wizard', async ({
      launcher,
    }) => {
      const diag = await attachDiagnostics(launcher.main)
      const shell = new AppShell(launcher.main)

      await waitReadyOrReport(shell, diag)
      // A brand-new launcher must land on the setup wizard, not the shell.
      await expect(shell.setupRoot).toBeVisible()

      // Give async ESM module init / dynamic imports a beat to surface any
      // late ReferenceError before we sample diagnostics.
      await launcher.main.waitForTimeout(2_000)
      assertNoBootBreakers(diag, await readEarlyErrors(launcher.main))
    })
  })

  test.describe('existing user (seeded root with one instance)', () => {
    test.use({
      launcherOptions: {
        seed: { name: 'SmokeInstance', minecraft: '1.20.4' },
      },
    })

    test('main renderer boots without uncaught errors and shows the app shell', async ({
      launcher,
    }) => {
      const diag = await attachDiagnostics(launcher.main)
      const shell = new AppShell(launcher.main)

      await waitReadyOrReport(shell, diag)
      // Existing-user path must skip the wizard and render the main shell.
      await expect(shell.sidebar).toBeVisible()

      await launcher.main.waitForTimeout(2_000)
      assertNoBootBreakers(diag, await readEarlyErrors(launcher.main))
    })
  })
})

/**
 * `AppShell.waitReady()` times out generically when the renderer crashes
 * before Vue mounts. If that happens AND we've already captured a boot
 * breaker on the page, prefer that explicit error so a regression like
 * vitejs/vite#22583 is named in the failure output instead of disguised as
 * a 30s wait timeout.
 */
async function waitReadyOrReport(shell: AppShell, diag: BootDiagnostics): Promise<void> {
  try {
    await shell.waitReady()
  } catch (timeoutErr) {
    const early = await readEarlyErrors(shell.main)
    if (diag.pageErrors.length || diag.consoleErrors.length || early.length) {
      assertNoBootBreakers(diag, early)
    }
    // No captured pageerror (possibly fired before listener attached) but
    // the launcher still failed to render. Snapshot the page state so the
    // failure message points at the right culprit (blank renderer, bad URL,
    // or unmounted Vue app) rather than a bare 30s timeout.
    const snapshot = await shell.main
      .evaluate(() => ({
        url: location.href,
        bodyChildren: document.body?.children.length ?? -1,
        bodyHtml: (document.body?.innerHTML ?? '').slice(0, 400),
        title: document.title,
      }))
      .catch((e) => ({ snapshotError: String(e) }))
    throw new Error(
      `Launcher renderer never reached a ready state.\n` +
      `Page snapshot: ${JSON.stringify(snapshot, null, 2)}\n` +
      `Captured diagnostics: ${JSON.stringify(diag, null, 2)}\n` +
      `Original: ${(timeoutErr as Error).message}`,
    )
  }
}
